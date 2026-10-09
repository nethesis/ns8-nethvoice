package push

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	webpush "github.com/SherClockHolmes/webpush-go"

	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/address"
	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/logx"
	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/store"
)

// Router looks a node up in the store and sends to the right place.
// Nodes are prefixed: "web:" for browsers, "pnm:" for Acrobits devices.
type Router struct {
	Store       *store.Store
	VAPIDPublic string
	VAPIDPriv   string
	Subscriber  string // mailto: for the push services' abuse contact
	PNMURL      string
	Names       func(username string) string                  // display name lookup, may be nil
	Address     func(username string) string                  // the number the phone app knows an operator by, may be nil
	RoomName    func(ctx context.Context, room string) string // group name lookup, may be nil
	// ArchiveID: archive id of the newest message user exchanged with peer; the app
	// dedupes push and fetch by it (push Id == sms_id). May be nil.
	ArchiveID func(ctx context.Context, user, peer string) string
	client    *http.Client
}

func NewRouter(st *store.Store, pnmURL string) (*Router, error) {
	r := &Router{Store: st, PNMURL: pnmURL, Subscriber: "mailto:noreply@nethesis.it", client: &http.Client{Timeout: 20 * time.Second}}
	pub, _ := st.Meta("vapid_public")
	priv, _ := st.Meta("vapid_private")
	if pub == "" || priv == "" {
		var err error
		priv, pub, err = webpush.GenerateVAPIDKeys()
		if err != nil {
			return nil, err
		}
		if err := st.SetMeta("vapid_public", pub); err != nil {
			return nil, err
		}
		if err := st.SetMeta("vapid_private", priv); err != nil {
			return nil, err
		}
		logx.Debugf("push: generated VAPID keys")
	}
	r.VAPIDPublic, r.VAPIDPriv = pub, priv
	return r, nil
}

func (r *Router) Deliver(ctx context.Context, n Notification) {
	// ejabberd also notifies for stanzas without a body sent to an offline user
	// (a typing indicator, a reaction): nothing to show, so nothing to wake the device for.
	if strings.TrimSpace(n.Body) == "" {
		return
	}
	switch {
	case strings.HasPrefix(n.Node, "web:"):
		r.web(ctx, n)
	case strings.HasPrefix(n.Node, "pnm:"):
		r.pnm(ctx, n)
	default:
		log.Printf("push: unknown node %q", n.Node)
	}
}

func (r *Router) web(ctx context.Context, n Notification) {
	sub, err := r.Store.WebSub(n.Node)
	if err != nil || sub == nil || ownMessage(n.Sender, sub.Username) || r.Store.Away(sub.Username) {
		return
	}
	from, name := r.who(ctx, n.Sender)
	payload, _ := json.Marshal(map[string]any{"from": from, "name": name, "body": r.text(n.Sender, n.Body), "count": n.Count})
	resp, err := webpush.SendNotificationWithContext(ctx, payload, &webpush.Subscription{Endpoint: sub.Endpoint, Keys: webpush.Keys{P256dh: sub.P256dh, Auth: sub.Auth}},
		&webpush.Options{HTTPClient: r.client, Subscriber: r.Subscriber, VAPIDPublicKey: r.VAPIDPublic, VAPIDPrivateKey: r.VAPIDPriv, TTL: 86400, Urgency: webpush.UrgencyHigh})
	if err != nil {
		log.Printf("push web %s: %v", sub.Username, err)
		return
	}
	resp.Body.Close()
	if resp.StatusCode == 404 || resp.StatusCode == 410 {
		_ = r.Store.DeleteWebSub(n.Node, "")
		logx.Debugf("push web %s: subscription gone, removed", sub.Username)
	} else {
		if resp.StatusCode >= 400 {
			log.Printf("push web %s: from %s (%s), HTTP %d", sub.Username, from, name, resp.StatusCode)
		} else {
			logx.Debugf("push web %s: from %s (%s), HTTP %d", sub.Username, from, name, resp.StatusCode)
		}
	}
}

// who turns the XMPP sender into what the client keys conversations by: a
// username for an operator, the room address for a group, with a display name.
func (r *Router) who(ctx context.Context, sender string) (from, name string) {
	if address.IsRoom(sender) {
		room := address.Bare(sender)
		name = room
		if r.RoomName != nil {
			if n := r.RoomName(ctx, room); n != "" {
				name = n
			}
		}
		return room, name
	}
	from = address.Local(sender)
	return from, r.name(from)
}

// preview replaces a bare attachment name (what an attachment carries as body) with what it is.
func preview(body string) string {
	// A reply starts with the quoted message ("> Name: …"): the notification shows the answer.
	for strings.HasPrefix(body, ">") {
		i := strings.IndexByte(body, '\n')
		if i < 0 {
			break
		}
		body = strings.TrimSpace(body[i+1:])
	}
	if strings.ContainsAny(body, " \n") || !strings.Contains(body, ".") {
		return body
	}
	switch strings.ToLower(body[strings.LastIndexByte(body, '.'):]) {
	case ".m4a", ".ogg", ".opus", ".webm", ".mp3", ".wav", ".aac":
		return "Voice message"
	case ".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".avif":
		return "Photo"
	case ".mp4", ".mov":
		return "Video"
	case ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".zip", ".txt", ".csv", ".odt", ".ods":
		return "File: " + body
	}
	return body
}

// text is the message as a notification shows it: in a group, who wrote it comes first.
func (r *Router) text(sender, body string) string {
	body = preview(body)
	if address.IsRoom(sender) {
		if i := strings.IndexByte(sender, '/'); i >= 0 {
			return r.name(sender[i+1:]) + ": " + body
		}
	}
	return body
}

// ownMessage: a room hands every subscriber its messages, the author's own included.
func ownMessage(sender, user string) bool {
	if !address.IsRoom(sender) {
		return false
	}
	i := strings.IndexByte(sender, '/')
	return i >= 0 && sender[i+1:] == user
}

// pnm sends the same NotifyTextMessage matrix2acrobits sends today.
func (r *Router) pnm(ctx context.Context, n Notification) {
	tok, err := r.Store.PNM(n.Node)
	if err != nil || tok == nil || ownMessage(n.Sender, tok.Username) || r.Store.Away(tok.Username) {
		return
	}
	// A group shows in the app as a thread named after the room: the push must open that one.
	// The app keys threads by the address it fetches messages with: a number for an operator, the name for a group.
	from, name := r.who(ctx, n.Sender)
	if address.IsRoom(n.Sender) {
		from = address.Thread(name)
	} else if r.Address != nil {
		from = r.Address(from)
	}
	// Without the archive id the app notifies twice: once for the push, once for the fetch.
	id := ""
	if r.ArchiveID != nil && n.Sender != "" {
		id = r.ArchiveID(ctx, tok.Username, address.Bare(n.Sender))
	}
	if id == "" {
		id = fmt.Sprintf("%d", time.Now().UnixNano())
	}
	body, _ := json.Marshal(map[string]any{
		"verb": "NotifyTextMessage", "AppId": tok.AppID, "DeviceToken": tok.Token, "Selector": tok.Selector,
		"UserName": from, "UserDisplayName": name, "Message": r.text(n.Sender, n.Body), "Id": id, "ThreadId": from, "Badge": atoi(n.Count),
	})
	req, _ := http.NewRequestWithContext(ctx, "POST", r.PNMURL, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := r.client.Do(req)
	if err != nil {
		log.Printf("push pnm %s: %v", tok.Username, err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode == 404 {
		_ = r.Store.DeletePNM(n.Node)
		logx.Debugf("push pnm %s: token rejected, removed", tok.Username)
	} else {
		if resp.StatusCode >= 400 {
			log.Printf("push pnm %s: from %s, id %s, HTTP %d", tok.Username, from, id, resp.StatusCode)
		} else {
			logx.Debugf("push pnm %s: from %s, id %s, HTTP %d", tok.Username, from, id, resp.StatusCode)
		}
		if resp.StatusCode == 200 {
			r.Store.Pushed(n.Node)
		}
	}
}

func (r *Router) name(username string) string {
	if r.Names != nil {
		if n := r.Names(username); n != "" {
			return n
		}
	}
	return username
}

func atoi(s string) int {
	n := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0
		}
		n = n*10 + int(c-'0')
	}
	return n
}
