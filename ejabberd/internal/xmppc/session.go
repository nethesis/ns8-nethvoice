// Package xmppc: short loopback XMPP sessions as a user, for what the Acrobits
// services need (archive, send, push, upload slots).
package xmppc

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/xml"
	"fmt"
	"net"
	"strings"
	"sync"
	"time"

	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/address"
	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/ns"
	"mellium.im/sasl"
	"mellium.im/xmlstream"
	"mellium.im/xmpp"
	"mellium.im/xmpp/jid"
	"mellium.im/xmpp/mux"
	"mellium.im/xmpp/stanza"
)

// Message is one archived chat message, flattened.
type Message struct {
	ID    string // archive id (stanza-id)
	MsgID string // the id the sender put on the message
	From  string // bare JID; for a group message, the room
	To    string // bare JID
	Room  string // group address when the message came through a group
	Nick  string // sender's username inside the group
	Body  string
	OOB   string   // the first attachment
	Files []string // every attachment, in order (one message may carry several)
	At    time.Time
}

// Session is one authenticated client session.
type Session struct {
	s    *xmpp.Session
	conn net.Conn
	me   jid.JID
	host string

	mu      sync.Mutex
	queries map[string][]Message // queryid -> collected results
}

// Dial opens a plaintext c2s connection to addr and authenticates user@host with
// the given password (the CTI JWT). ejabberd asks chat-extauth, which asks the middleware.
func Dial(ctx context.Context, addr, host, user, password string) (*Session, error) {
	// A resource per connection: two at once for the same user must not replace each other.
	origin, err := jid.Parse(fmt.Sprintf("%s@%s/gateway-%s", user, host, randomID()))
	if err != nil {
		return nil, fmt.Errorf("xmpp login %s: %w", user, err)
	}
	domain, err := jid.Parse(host)
	if err != nil {
		return nil, err
	}
	// The login must not hang on a stuck server: bound the whole negotiation.
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	conn, err := (&net.Dialer{Timeout: 5 * time.Second}).DialContext(ctx, "tcp", addr)
	if err != nil {
		return nil, err
	}
	if dl, ok := ctx.Deadline(); ok {
		_ = conn.SetDeadline(dl)
	}
	// The connection is loopback and plaintext by design: tell mellium it is
	// already secure, or SASL PLAIN is refused as "features advertised out of order".
	negotiator := xmpp.NewNegotiator(func(_ *xmpp.Session, _ *xmpp.StreamConfig) xmpp.StreamConfig {
		return xmpp.StreamConfig{Features: []xmpp.StreamFeature{xmpp.SASL("", password, sasl.Plain), xmpp.BindResource()}}
	})
	s, err := xmpp.NewSession(ctx, domain, origin, conn, xmpp.Secure, negotiator)
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("xmpp login %s: %w", user, err)
	}
	_ = conn.SetDeadline(time.Time{})
	ses := &Session{s: s, conn: conn, me: s.LocalAddr(), host: host, queries: map[string][]Message{}}
	m := mux.New(stanza.NSClient, mux.Message(stanza.NormalMessage, xml.Name{Space: ns.MAM, Local: "result"}, mux.MessageHandlerFunc(ses.onResult)))
	go func() { _ = s.Serve(m) }()
	return ses, nil
}

// Close ends the stream and drops the connection; nothing waits for the server's goodbye.
func (ses *Session) Close() error {
	_ = ses.s.Close()
	return ses.conn.Close()
}

// Me is the bare JID of the account.
func (ses *Session) Me() string { return ses.me.Bare().String() }

// Send delivers a chat message and returns its origin id.
func (ses *Session) Send(ctx context.Context, to, body string, oob ...string) (string, error) {
	return ses.send(ctx, to, body, oob, stanza.ChatMessage)
}

// SendGroup posts to a room this account is subscribed to (MucSub: no need to join).
func (ses *Session) SendGroup(ctx context.Context, room, body string, oob ...string) (string, error) {
	return ses.send(ctx, room, body, oob, stanza.GroupChatMessage)
}

func (ses *Session) send(ctx context.Context, to, body string, oob []string, typ stanza.MessageType) (string, error) {
	id := newID()
	var sb strings.Builder
	sb.WriteString("<body>")
	_ = xml.EscapeText(&sb, []byte(body))
	sb.WriteString("</body>")
	fmt.Fprintf(&sb, `<origin-id xmlns="%s" id="%s"/><store xmlns="%s"/>`, ns.SID, id, ns.Hints)
	for _, u := range oob {
		sb.WriteString(`<x xmlns="` + ns.OOB + `"><url>`)
		_ = xml.EscapeText(&sb, []byte(u))
		sb.WriteString(`</url></x>`)
	}
	dest, err := jid.Parse(to)
	if err != nil {
		return "", err
	}
	msg := stanza.Message{To: dest, Type: typ, ID: id}
	return id, ses.s.Send(ctx, msg.Wrap(xml.NewDecoder(strings.NewReader(sb.String()))))
}

// EnablePush registers node on the push service for this account (XEP-0357).
func (ses *Session) EnablePush(ctx context.Context, service, node string) error {
	payload := fmt.Sprintf(`<enable xmlns="%s" jid="%s" node="%s"/>`, ns.Push, attr(service), attr(node))
	r, err := ses.s.SendIQElement(ctx, xml.NewDecoder(strings.NewReader(payload)), stanza.IQ{Type: stanza.SetIQ})
	if err != nil {
		return err
	}
	defer r.Close()
	return checkResult(r)
}

// DisablePush removes node from the push service for this account.
func (ses *Session) DisablePush(ctx context.Context, service, node string) error {
	payload := fmt.Sprintf(`<disable xmlns="%s" jid="%s" node="%s"/>`, ns.Push, attr(service), attr(node))
	r, err := ses.s.SendIQElement(ctx, xml.NewDecoder(strings.NewReader(payload)), stanza.IQ{Type: stanza.SetIQ})
	if err != nil {
		return err
	}
	defer r.Close()
	return checkResult(r)
}

// History returns archived messages. With afterID set it pages forward from
// that archive id; otherwise it returns the newest `max` messages.
func (ses *Session) History(ctx context.Context, afterID string, max int) (msgs []Message, complete bool, err error) {
	return ses.query(ctx, "", afterID, max)
}

// Last returns the newest archived message exchanged with an operator or a group.
func (ses *Session) Last(ctx context.Context, with string) (Message, error) {
	msgs, _, err := ses.query(ctx, with, "", 1)
	if err != nil {
		return Message{}, err
	}
	if len(msgs) == 0 {
		return Message{}, fmt.Errorf("mam: nothing with %s", with)
	}
	return msgs[len(msgs)-1], nil
}

func (ses *Session) query(ctx context.Context, with, afterID string, max int) (msgs []Message, complete bool, err error) {
	qid := newID()
	ses.mu.Lock()
	ses.queries[qid] = nil
	ses.mu.Unlock()
	defer func() { ses.mu.Lock(); delete(ses.queries, qid); ses.mu.Unlock() }()

	var rsm string
	if afterID != "" {
		rsm = fmt.Sprintf(`<set xmlns="%s"><max>%d</max><after>%s</after></set>`, ns.RSM, max, text(afterID))
	} else {
		rsm = fmt.Sprintf(`<set xmlns="%s"><max>%d</max><before/></set>`, ns.RSM, max)
	}
	filter := ""
	if with != "" {
		filter = fmt.Sprintf(`<x xmlns="%s" type="submit"><field var="FORM_TYPE" type="hidden"><value>%s</value></field><field var="with"><value>%s</value></field></x>`, ns.Data, ns.MAM, text(with))
	}
	payload := fmt.Sprintf(`<query xmlns="%s" queryid="%s">%s%s</query>`, ns.MAM, qid, filter, rsm)
	r, err := ses.s.SendIQElement(ctx, xml.NewDecoder(strings.NewReader(payload)), stanza.IQ{Type: stanza.SetIQ})
	if err != nil {
		return nil, false, err
	}
	defer r.Close()
	var res struct {
		Type string `xml:"type,attr"`
		Fin  struct {
			Complete string `xml:"complete,attr"`
		} `xml:"urn:xmpp:mam:2 fin"`
		Error *struct {
			Inner string `xml:",innerxml"`
		} `xml:"error"`
	}
	if err := xml.NewTokenDecoder(r).Decode(&res); err != nil {
		return nil, false, err
	}
	if res.Error != nil {
		return nil, false, fmt.Errorf("mam: %s", res.Error.Inner)
	}
	ses.mu.Lock()
	msgs = ses.queries[qid]
	ses.mu.Unlock()
	return msgs, res.Fin.Complete == "true", nil
}

// onResult collects <message><result queryid><forwarded><message/></forwarded></result></message>.
func (ses *Session) onResult(_ stanza.Message, t xmlstream.TokenReadEncoder) error {
	var m struct {
		Result struct {
			QueryID   string `xml:"queryid,attr"`
			ID        string `xml:"id,attr"`
			Forwarded struct {
				Delay struct {
					Stamp string `xml:"stamp,attr"`
				} `xml:"urn:xmpp:delay delay"`
				Message struct {
					ID   string `xml:"id,attr"`
					From string `xml:"from,attr"`
					To   string `xml:"to,attr"`
					Body string `xml:"body"`
					OOB  []struct {
						URL string `xml:"url"`
					} `xml:"jabber:x:oob x"`
					// A group message reaches a subscriber wrapped in a pubsub event.
					Event struct {
						Items struct {
							Node string `xml:"node,attr"`
							Item struct {
								Message struct {
									ID   string `xml:"id,attr"`
									From string `xml:"from,attr"`
									Body string `xml:"body"`
									OOB  []struct {
										URL string `xml:"url"`
									} `xml:"jabber:x:oob x"`
								} `xml:"message"`
							} `xml:"item"`
						} `xml:"items"`
					} `xml:"http://jabber.org/protocol/pubsub#event event"`
				} `xml:"message"`
			} `xml:"urn:xmpp:forward:0 forwarded"`
		} `xml:"urn:xmpp:mam:2 result"`
	}
	if err := xml.NewTokenDecoder(t).Decode(&m); err != nil {
		return err
	}
	at, _ := time.Parse(time.RFC3339Nano, m.Result.Forwarded.Delay.Stamp)
	fm := m.Result.Forwarded.Message
	urls := func(xs []struct {
		URL string `xml:"url"`
	}) (files []string) {
		for _, x := range xs {
			if x.URL != "" {
				files = append(files, x.URL)
			}
		}
		return files
	}
	msg := Message{ID: m.Result.ID, MsgID: fm.ID, From: address.Bare(fm.From), To: address.Bare(fm.To), Body: fm.Body, Files: urls(fm.OOB), At: at}
	if fm.Event.Items.Node == ns.MucSubMessages {
		inner := fm.Event.Items.Item.Message
		msg.Room, msg.MsgID, msg.Body, msg.Files = address.Bare(fm.From), inner.ID, inner.Body, urls(inner.OOB)
		if i := strings.IndexByte(inner.From, '/'); i >= 0 {
			msg.Nick = inner.From[i+1:]
		}
	}
	if len(msg.Files) > 0 {
		msg.OOB = msg.Files[0]
	}
	ses.mu.Lock()
	if list, tracked := ses.queries[m.Result.QueryID]; tracked {
		ses.queries[m.Result.QueryID] = append(list, msg)
	}
	ses.mu.Unlock()
	return nil
}

func checkResult(r xml.TokenReader) error {
	var res struct {
		Type  string `xml:"type,attr"`
		Error *struct {
			Inner string `xml:",innerxml"`
		} `xml:"error"`
	}
	if err := xml.NewTokenDecoder(r).Decode(&res); err != nil {
		return err
	}
	if res.Type == "error" {
		msg := ""
		if res.Error != nil {
			msg = res.Error.Inner
		}
		return fmt.Errorf("iq error: %s", msg)
	}
	return nil
}

// text and attr escape a value for an XML payload built as a string.
func text(v string) string {
	var sb strings.Builder
	_ = xml.EscapeText(&sb, []byte(v))
	return sb.String()
}

func attr(v string) string { return strings.ReplaceAll(text(v), `"`, "&quot;") }

func newID() string { return fmt.Sprintf("%x", time.Now().UnixNano()) }

// Groups lists the rooms this account is subscribed to (MucSub).
func (ses *Session) Groups(ctx context.Context) ([]string, error) {
	payload := fmt.Sprintf(`<subscriptions xmlns="%s"/>`, ns.MucSub)
	muc, err := jid.Parse(address.MUC(ses.host))
	if err != nil {
		return nil, err
	}
	r, err := ses.s.SendIQElement(ctx, xml.NewDecoder(strings.NewReader(payload)), stanza.IQ{Type: stanza.GetIQ, To: muc})
	if err != nil {
		return nil, err
	}
	defer r.Close()
	var res struct {
		Subs []struct {
			JID string `xml:"jid,attr"`
		} `xml:"urn:xmpp:mucsub:0 subscriptions>subscription"`
	}
	if err := xml.NewTokenDecoder(r).Decode(&res); err != nil {
		return nil, err
	}
	rooms := make([]string, 0, len(res.Subs))
	for _, s := range res.Subs {
		rooms = append(rooms, s.JID)
	}
	return rooms, nil
}

// RoomName asks a room what it is called; the address when it has no name.
func (ses *Session) RoomName(ctx context.Context, room string) string {
	payload := fmt.Sprintf(`<query xmlns="%s"/>`, ns.DiscoInfo)
	to, err := jid.Parse(room)
	if err != nil {
		return room
	}
	r, err := ses.s.SendIQElement(ctx, xml.NewDecoder(strings.NewReader(payload)), stanza.IQ{Type: stanza.GetIQ, To: to})
	if err != nil {
		return room
	}
	defer r.Close()
	var res struct {
		Identities []struct {
			Name string `xml:"name,attr"`
		} `xml:"http://jabber.org/protocol/disco#info query>identity"`
	}
	if err := xml.NewTokenDecoder(r).Decode(&res); err != nil {
		return room
	}
	for _, id := range res.Identities {
		if id.Name != "" {
			return id.Name
		}
	}
	return room
}

// FindSent returns the archive id of a message this account just sent, by the
// id it was sent with: the app matches its pending copy against it.
func (ses *Session) FindSent(ctx context.Context, msgID string) string {
	for attempt := 0; attempt < 3; attempt++ {
		msgs, _, err := ses.History(ctx, "", 20)
		if err == nil {
			for _, m := range msgs {
				if m.MsgID == msgID {
					return m.ID
				}
			}
		}
		select {
		case <-ctx.Done():
			return ""
		case <-time.After(150 * time.Millisecond):
		}
	}
	return ""
}

// Slot asks the server's upload service (XEP-0363) where to PUT a file and where it will be served.
func (ses *Session) Slot(ctx context.Context, filename string, size int64, contentType string) (put, get string, headers map[string]string, err error) {
	service, err := jid.Parse(address.Upload(ses.host))
	if err != nil {
		return "", "", nil, err
	}
	payload := fmt.Sprintf(`<request xmlns="%s" filename="%s" size="%d" content-type="%s"/>`, ns.Upload, attr(filename), size, attr(contentType))
	r, err := ses.s.SendIQElement(ctx, xml.NewDecoder(strings.NewReader(payload)), stanza.IQ{Type: stanza.GetIQ, To: service})
	if err != nil {
		return "", "", nil, err
	}
	defer r.Close()
	var res struct {
		Type string `xml:"type,attr"`
		Slot struct {
			Put struct {
				URL     string `xml:"url,attr"`
				Headers []struct {
					Name  string `xml:"name,attr"`
					Value string `xml:",chardata"`
				} `xml:"header"`
			} `xml:"put"`
			Get struct {
				URL string `xml:"url,attr"`
			} `xml:"get"`
		} `xml:"urn:xmpp:http:upload:0 slot"`
		Error *struct {
			Inner string `xml:",innerxml"`
		} `xml:"error"`
	}
	if err := xml.NewTokenDecoder(r).Decode(&res); err != nil {
		return "", "", nil, err
	}
	if res.Error != nil || res.Slot.Put.URL == "" || res.Slot.Get.URL == "" {
		msg := "no slot"
		if res.Error != nil {
			msg = res.Error.Inner
		}
		return "", "", nil, fmt.Errorf("upload slot: %s", msg)
	}
	headers = map[string]string{}
	for _, h := range res.Slot.Put.Headers {
		headers[h.Name] = h.Value
	}
	return res.Slot.Put.URL, res.Slot.Get.URL, headers, nil
}

func randomID() string {
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
