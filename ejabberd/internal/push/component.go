// Package push is the XEP-0357 app server: ejabberd notifies the component, the gateway
// delivers to the browser (Web Push) or the phone (Acrobits PNM).
package push

import (
	"context"
	"encoding/xml"
	"log"
	"net"
	"strings"
	"sync"
	"time"

	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/address"
	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/logx"
	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/ns"
	"mellium.im/xmlstream"
	"mellium.im/xmpp"
	"mellium.im/xmpp/component"
	"mellium.im/xmpp/disco"
	"mellium.im/xmpp/jid"
	"mellium.im/xmpp/mux"
	"mellium.im/xmpp/stanza"
)

// Notification is what XEP-0357 carries: a count and the last message.
type Notification struct {
	Node   string // the node ejabberd publishes to; the store knows whose it is
	Count  string
	Sender string // JID of the sender; a room JID with the author as resource for a group
	Body   string
}

// Deliverer routes a notification to whatever the node is bound to.
type Deliverer interface {
	Deliver(ctx context.Context, n Notification)
}

// The live component session, for lookups made while delivering, and a small name cache.
var (
	sessMu  sync.Mutex
	session *xmpp.Session
	selfJID jid.JID // stanzas from a component must carry its address, or ejabberd drops the stream
	names   = map[string]nameEntry{}
)

type nameEntry struct {
	name string
	at   time.Time
}

func setSession(s *xmpp.Session, self jid.JID) {
	sessMu.Lock()
	session, selfJID = s, self
	sessMu.Unlock()
}

// RoomName asks the MUC service what a room is called (disco#info), remembering it for a while.
func RoomName(ctx context.Context, room string) string {
	sessMu.Lock()
	s, self := session, selfJID
	e, ok := names[room]
	sessMu.Unlock()
	if ok && time.Since(e.at) < 10*time.Minute {
		return e.name
	}
	if s == nil {
		return ""
	}
	// A room address ejabberd accepts may still be one mellium refuses: never panic on it.
	to, err := jid.Parse(room)
	if err != nil {
		log.Printf("push: room name for %q: %v", room, err)
		return ""
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	info, err := disco.GetInfoIQ(ctx, "", stanza.IQ{From: self, To: to, Type: stanza.GetIQ}, s)
	if err != nil {
		log.Printf("push: room name for %s: %v", room, err)
		return ""
	}
	name := ""
	for _, id := range info.Identity {
		if id.Name != "" {
			name = id.Name
			break
		}
	}
	sessMu.Lock()
	if len(names) > 1000 {
		names = map[string]nameEntry{}
	}
	names[room] = nameEntry{name: name, at: time.Now()}
	sessMu.Unlock()
	return name
}

// ServeComponent keeps a component session with ejabberd, reconnecting forever.
func ServeComponent(ctx context.Context, addr, host, secret string, d Deliverer) {
	self, err := jid.Parse(address.Push(host))
	if err != nil {
		log.Fatalf("push component: %v", err)
	}
	server, _ := jid.Parse(host)
	down := false // one line per outage, not one a second while ejabberd restarts
	for ctx.Err() == nil {
		if err := runOnce(ctx, addr, self, server, secret, d, &down); err != nil && ctx.Err() == nil {
			if !down {
				log.Printf("push component: %v; reconnecting every second", err)
			}
			down = true
		}
		// Quick: while the component is away ejabberd routes push.<host> over s2s, fails,
		// and disables that user's push until their client enables it again.
		select {
		case <-ctx.Done():
		case <-time.After(time.Second):
		}
	}
}

// deliveries bounds the notifications being delivered at once: a slow push service
// must not turn every incoming message into another goroutine waiting on it.
var deliveries = make(chan struct{}, 32)

func runOnce(ctx context.Context, addr string, self, server jid.JID, secret string, d Deliverer, down *bool) error {
	conn, err := (&net.Dialer{Timeout: 5 * time.Second}).DialContext(ctx, "tcp", addr)
	if err != nil {
		return err
	}
	defer conn.Close()
	s, err := component.NewSession(ctx, self, []byte(secret), conn)
	if err != nil {
		return err
	}
	logx.Debugf("push component: connected as %s", self)
	*down = false
	setSession(s, self)
	defer setSession(nil, jid.JID{})
	runCtx, stop := context.WithCancel(ctx)
	defer stop()
	go func() { <-runCtx.Done(); _ = s.Close() }()

	handler := mux.IQHandlerFunc(func(iq stanza.IQ, t xmlstream.TokenReadEncoder, start *xml.StartElement) error {
		var p struct {
			Publish struct {
				Node string `xml:"node,attr"`
				Item struct {
					Notification struct {
						X struct {
							Fields []struct {
								Var   string `xml:"var,attr"`
								Value string `xml:"value"`
							} `xml:"field"`
						} `xml:"jabber:x:data x"`
					} `xml:"urn:xmpp:push:0 notification"`
				} `xml:"item"`
			} `xml:"publish"`
		}
		// The mux already consumed the payload start element: put it back in
		// front, so the decoder sees a well-formed <pubsub>...</pubsub>.
		if err := xml.NewTokenDecoder(xmlstream.MultiReader(xmlstream.Token(*start), t)).Decode(&p); err != nil {
			return err
		}
		// Only the server publishes notifications (XEP-0357 §5, from the user's domain).
		// Anything else is a user talking to the component directly: answer, deliver nothing.
		if !iq.From.Equal(server) {
			log.Printf("push: publish from %s refused", iq.From)
			_, err := xmlstream.Copy(t, iq.Error(stanza.Error{Type: stanza.Cancel, Condition: stanza.Forbidden}))
			return err
		}
		n := Notification{Node: p.Publish.Node}
		for _, f := range p.Publish.Item.Notification.X.Fields {
			switch f.Var {
			case "message-count":
				n.Count = f.Value
			case "last-message-sender":
				n.Sender = f.Value // full JID: for a group message the resource is the author's username
			case "last-message-body":
				n.Body = f.Value
			}
		}
		select {
		case deliveries <- struct{}{}:
			go func() {
				defer func() { <-deliveries }()
				defer func() {
					if r := recover(); r != nil {
						log.Printf("push: delivery to %s panicked: %v", n.Node, r)
					}
				}()
				ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
				defer cancel()
				d.Deliver(ctx, n)
			}()
		default:
			log.Printf("push: too many deliveries in flight, %s dropped", n.Node)
		}
		// Answer the IQ so ejabberd does not retry.
		_, err := xmlstream.Copy(t, iq.Result(xmlstream.Wrap(nil, xml.StartElement{Name: xml.Name{Space: ns.Pubsub, Local: "pubsub"}})))
		return err
	})
	// disco#info: say what we are, so a client probing the services gets an answer, not an error.
	disco := mux.IQHandlerFunc(func(iq stanza.IQ, t xmlstream.TokenReadEncoder, _ *xml.StartElement) error {
		payload := xml.NewDecoder(strings.NewReader(`<query xmlns="` + ns.DiscoInfo + `"><identity category="pubsub" type="push" name="NethVoice chat push"/><feature var="` + ns.DiscoInfo + `"/><feature var=ns.Push/></query>`))
		_, err := xmlstream.Copy(t, iq.Result(payload))
		return err
	})
	m := mux.New(ns.Component,
		mux.IQ(stanza.SetIQ, xml.Name{Space: ns.Pubsub, Local: "pubsub"}, handler),
		mux.IQ(stanza.GetIQ, xml.Name{Space: ns.DiscoInfo, Local: "query"}, disco))
	return s.Serve(m)
}
