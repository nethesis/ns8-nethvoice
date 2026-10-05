package api

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"net/url"
	"path"
	"strings"
	"sync"
	"time"

	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/address"
	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/logx"
	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/store"
	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/xmppc"
)

type Server struct {
	Host        string // XMPP domain = CTI host
	C2SAddr     string
	PushService string // push.<host>
	VAPIDPublic string
	Store       *store.Store
	MW          *Middleware
	EjabberdAPI string // ejabberd's mod_http_api on loopback, for archive purges
	PublicHost  string // the CTI host: attachment links point there, whatever host they were uploaded under
	UploadURL   string // ejabberd's upload service on loopback, for attachments relayed from the app

	failures window // failed Acrobits logins
	sends    window // messages from the app
	files    window // attachments from the app
}

// apiClient talks to ejabberd on loopback; it must never hang a request.
var apiClient = &http.Client{Timeout: 10 * time.Second}

// maxBody bounds every request body: the largest legitimate one is a chat message.
const maxBody = 64 << 10

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	// Browsers (chat-island): Web Push registration.
	mux.HandleFunc("GET /push/vapid", s.vapid)
	mux.HandleFunc("POST /push/web", s.webSubscribe)
	mux.HandleFunc("DELETE /push/web/{node}", s.webUnsubscribe)
	mux.HandleFunc("GET /push/mobile", s.mobile)
	mux.HandleFunc("GET /users/inactive", s.inactive)
	mux.HandleFunc("DELETE /conversations/{peer}", s.deleteConversation)
	// Acrobits mobile app: the three web services it is provisioned with.
	mux.HandleFunc("POST /api/client/fetch_messages", s.fetchMessages)
	mux.HandleFunc("POST /api/client/send_message", s.sendMessage)
	mux.HandleFunc("POST /api/client/push_token_report", s.pushTokenReport)
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) { w.Write([]byte("ok")) })
	return withCORS(mux)
}

// statusWriter remembers the status code so failed requests can be logged.
type statusWriter struct {
	http.ResponseWriter
	code int
}

func (s *statusWriter) WriteHeader(c int) { s.code = c; s.ResponseWriter.WriteHeader(c) }

func withCORS(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w0 http.ResponseWriter, r *http.Request) {
		w := &statusWriter{ResponseWriter: w0, code: 200}
		defer func() {
			if w.code >= 500 {
				log.Printf("http %s %s -> %d", r.Method, r.URL.Path, w.code)
			} else if w.code >= 400 {
				logx.Debugf("http %s %s -> %d", r.Method, r.URL.Path, w.code)
			}
		}()
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, maxBody)
		h.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func fail(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"message": msg})
}

// mobile lists the operators with the app registered for push: not in the chat
// right now, but a message reaches their phone.
func (s *Server) mobile(w http.ResponseWriter, r *http.Request) {
	if _, _, err := s.bearerUser(r); err != nil {
		fail(w, 401, "unauthorized")
		return
	}
	users, err := s.Store.PNMUsers()
	if err != nil {
		log.Printf("mobile: %v", err)
		fail(w, 500, "internal error")
		return
	}
	if users == nil {
		users = []string{}
	}
	writeJSON(w, 200, map[string]any{"users": users})
}

// deleteConversation purges the caller's own archive with an operator or a group.
// The other side keeps its copy, as in any messenger; leaving the room is the client's job.
func (s *Server) deleteConversation(w http.ResponseWriter, r *http.Request) {
	user, _, err := s.bearerUser(r)
	if err != nil {
		fail(w, 401, "unauthorized")
		return
	}
	peer := r.PathValue("peer")
	if peer == "" {
		fail(w, 400, "peer is required")
		return
	}
	if !strings.Contains(peer, "@") {
		peer += "@" + s.Host
	}
	if err := s.ejabberd(r.Context(), "remove_mam_for_user_with_peer", map[string]string{"user": user, "host": s.Host, "with": peer}, nil); err != nil {
		log.Printf("purge %s with %s: %v", user, peer, err)
		fail(w, 502, "chat server error")
		return
	}
	logx.Debugf("archive of %s with %s purged", user, peer)
	w.WriteHeader(http.StatusNoContent)
}

// groupByName finds a room the account is subscribed to by its name or address.
func (s *Server) groupByName(ctx context.Context, ses *xmppc.Session, name string) string {
	rooms, err := ses.Groups(ctx)
	if err != nil {
		return ""
	}
	for _, room := range rooms {
		if room == name || strings.EqualFold(ses.RoomName(ctx, room), name) {
			return room
		}
	}
	return ""
}

// ---- browsers ----

func (s *Server) vapid(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, 200, map[string]string{"publicKey": s.VAPIDPublic, "service": s.PushService})
}

// bearerUser resolves the CTI JWT in the Authorization header to a username.
func (s *Server) bearerUser(r *http.Request) (user, jwt string, err error) {
	jwt = strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	if jwt == "" {
		return "", "", ErrUnauthorized
	}
	user, err = s.MW.WhoAmI(r.Context(), jwt)
	return user, jwt, err
}

// webSubscribe stores a Web Push subscription and returns the XEP-0357 node the
// browser must enable on its XMPP session.
func (s *Server) webSubscribe(w http.ResponseWriter, r *http.Request) {
	user, _, err := s.bearerUser(r)
	if err != nil {
		fail(w, 401, "unauthorized")
		return
	}
	var in struct {
		Endpoint string `json:"endpoint"`
		Keys     struct {
			P256dh string `json:"p256dh"`
			Auth   string `json:"auth"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil || in.Endpoint == "" || in.Keys.P256dh == "" || in.Keys.Auth == "" {
		fail(w, 400, "endpoint and keys are required")
		return
	}
	if !pushEndpoint(in.Endpoint) {
		fail(w, 400, "endpoint is not a known push service")
		return
	}
	node, err := s.Store.PutWebSub(store.WebSub{Node: "web:" + randomID(), Username: user, Endpoint: in.Endpoint, P256dh: in.Keys.P256dh, Auth: in.Keys.Auth})
	if err != nil {
		log.Printf("web subscribe %s: %v", user, err)
		fail(w, 500, "internal error")
		return
	}
	writeJSON(w, 200, map[string]string{"node": node, "service": s.PushService})
}

func (s *Server) webUnsubscribe(w http.ResponseWriter, r *http.Request) {
	user, _, err := s.bearerUser(r)
	if err != nil {
		fail(w, 401, "unauthorized")
		return
	}
	if err := s.Store.DeleteWebSub(r.PathValue("node"), user); err != nil {
		log.Printf("web unsubscribe %s: %v", user, err)
		fail(w, 500, "internal error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// pushHosts are the browsers' push services: the gateway posts only there, never
// to an address a client picked (an internal host, a server that never answers).
var pushHosts = []string{
	"fcm.googleapis.com", "android.googleapis.com", // Chrome, Edge on Android, Brave, Opera
	".push.services.mozilla.com", // Firefox
	".push.apple.com",            // Safari
	".notify.windows.com",        // Edge on Windows
}

func pushEndpoint(endpoint string) bool {
	u, err := url.Parse(endpoint)
	if err != nil || u.Scheme != "https" || u.Port() != "" {
		return false
	}
	h := strings.ToLower(u.Hostname())
	for _, p := range pushHosts {
		if h == p || (strings.HasPrefix(p, ".") && strings.HasSuffix(h, p)) {
			return true
		}
	}
	return false
}

// ---- Acrobits ----

// acrobitsAuth reads the credentials Acrobits puts in the body (JSON, with the
// same field names matrix2acrobits accepts) and opens an XMPP session as the user.
type acrobitsReq struct {
	Username string `json:"username"`
	From     string `json:"from"`
	Password string `json:"password"`
	// fetch_messages
	LastKnownSmsID     string `json:"last_known_sms_id"`
	LastKnownSentSmsID string `json:"last_known_sent_sms_id"`
	// send_message
	SmsTo       string `json:"sms_to"`
	SmsBody     string `json:"sms_body"`
	ContentType string `json:"content_type"`
	// The names the provisioning proxy has used since the Matrix work are accepted too.
	LastID       string `json:"last_id"`
	LastSentID   string `json:"last_sent_id"`
	To           string `json:"to"`
	Body         string `json:"body"`
	AppIDMsgsAlt string `json:"appId_msgs"`
	// push_token_report
	Selector   string `json:"selector"`
	TokenMsgs  string `json:"token_msgs"`
	AppIDMsgs  string `json:"app_id_msgs"`
	TokenCalls string `json:"token_calls"`
}

func (s *Server) acrobitsSession(w http.ResponseWriter, r *http.Request) (*acrobitsReq, *xmppc.Session, string, bool) {
	var in acrobitsReq
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		fail(w, 400, "invalid JSON")
		return nil, nil, "", false
	}
	if in.Username == "" {
		in.Username = in.From
	}
	if in.LastKnownSmsID == "" {
		in.LastKnownSmsID = in.LastID
	}
	if in.LastKnownSentSmsID == "" {
		in.LastKnownSentSmsID = in.LastSentID
	}
	if in.SmsTo == "" {
		in.SmsTo = in.To
	}
	if in.SmsBody == "" {
		in.SmsBody = in.Body
	}
	if in.AppIDMsgs == "" {
		in.AppIDMsgs = in.AppIDMsgsAlt
	}
	in.Username = strings.SplitN(in.Username, "@", 2)[0]
	if in.Username == "" || in.Password == "" {
		fail(w, 401, "username and password are required")
		return nil, nil, "", false
	}
	if s.throttled(in.Username) {
		fail(w, 429, "too many failed logins, retry later")
		return nil, nil, "", false
	}
	// A QR-code login carries a persistent CTI token instead of the password: use it as is.
	// It is the only way in with two-factor authentication, which a password login cannot pass.
	if looksLikeJWT(in.Password) {
		ses, jwt, code, msg := s.openWithToken(r, in.Username, in.Password)
		if ses == nil {
			if code == 401 {
				s.failed(in.Username)
			}
			fail(w, code, msg)
			return nil, nil, "", false
		}
		s.Store.Seen(in.Username)
		return &in, ses, jwt, true
	}
	// A cached token the CTI has since revoked fails once: log in again and retry.
	for attempt := 0; ; attempt++ {
		jwt, err := s.MW.Login(r.Context(), in.Username, in.Password)
		if err != nil {
			if errors.Is(err, ErrUnauthorized) {
				s.failed(in.Username)
				fail(w, 401, "invalid credentials")
			} else {
				log.Printf("acrobits %s: login: %v", in.Username, err)
				fail(w, 502, "CTI unavailable")
			}
			return nil, nil, "", false
		}
		if needsOTP(jwt) {
			s.MW.Forget(in.Username, in.Password)
			fail(w, 401, "two-factor authentication is on: log in to the app with the QR code")
			return nil, nil, "", false
		}
		ses, jwt, code, msg := s.openWithToken(r, in.Username, jwt)
		if ses != nil {
			s.Store.Seen(in.Username)
			return &in, ses, jwt, true
		}
		if code == 403 {
			fail(w, code, msg)
			return nil, nil, "", false
		}
		s.MW.Forget(in.Username, in.Password)
		if attempt > 0 {
			fail(w, 502, "chat server unavailable")
			return nil, nil, "", false
		}
	}
}

// openWithToken checks a CTI token belongs to user and has the chat, then opens the XMPP session.
func (s *Server) openWithToken(r *http.Request, user, jwt string) (*xmppc.Session, string, int, string) {
	owner, err := s.MW.WhoAmI(r.Context(), jwt)
	switch {
	case errors.Is(err, ErrForbidden):
		return nil, "", 403, err.Error()
	case errors.Is(err, ErrUnauthorized):
		return nil, "", 401, "invalid credentials"
	case err != nil:
		log.Printf("acrobits %s: whoami: %v", user, err)
		return nil, "", 502, "CTI unavailable"
	case owner != user:
		// A token only ever logs in the account it was issued to.
		log.Printf("acrobits %s: token belongs to %s", user, owner)
		return nil, "", 401, "invalid credentials"
	}
	ses, err := xmppc.Dial(r.Context(), s.C2SAddr, s.Host, user, jwt)
	if err != nil {
		log.Printf("acrobits %s: %v", user, err)
		return nil, "", 502, "chat server unavailable"
	}
	return ses, jwt, 0, ""
}

// looksLikeJWT tells a token (three base64url parts) from a password.
func looksLikeJWT(p string) bool {
	parts := strings.Split(p, ".")
	if len(parts) != 3 || len(p) < 40 {
		return false
	}
	for _, part := range parts {
		if part == "" {
			return false
		}
		for _, c := range part {
			if !(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '-' || c == '_' || c == '=') {
				return false
			}
		}
	}
	return true
}

// needsOTP reads the middleware's own claims: a password login of a 2FA account gets a
// token that works nowhere until the OTP is verified. Only a hint, the middleware decides.
func needsOTP(jwt string) bool {
	parts := strings.Split(jwt, ".")
	if len(parts) != 3 {
		return false
	}
	raw, err := base64.RawURLEncoding.DecodeString(strings.TrimRight(parts[1], "="))
	if err != nil {
		return false
	}
	var c struct {
		TwoFA       bool `json:"2fa"`
		OTPVerified bool `json:"otp_verified"`
	}
	if json.Unmarshal(raw, &c) != nil {
		return false
	}
	return c.TwoFA && !c.OTPVerified
}

// throttled limits password guessing through the Acrobits endpoints: five failures a minute per account.
func (s *Server) throttled(user string) bool { return s.failures.count(user) >= 5 }

func (s *Server) failed(user string) { s.failures.add(user) }

// window counts each user's events in the last minute.
type window struct {
	mu sync.Mutex
	m  map[string][]time.Time
}

func (w *window) count(user string) int {
	w.mu.Lock()
	defer w.mu.Unlock()
	recent := w.m[user][:0]
	for _, t := range w.m[user] {
		if time.Since(t) < time.Minute {
			recent = append(recent, t)
		}
	}
	if len(recent) == 0 {
		delete(w.m, user)
	} else {
		w.m[user] = recent
	}
	return len(recent)
}

func (w *window) add(user string) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.m == nil {
		w.m = map[string][]time.Time{}
	}
	w.m[user] = append(w.m[user], time.Now())
}

// over records an event and tells whether the user went past max this minute.
func (w *window) over(user string, max int) bool {
	if w.count(user) >= max {
		return true
	}
	w.add(user)
	return false
}

// archiveID tells an archive id (a decimal timestamp) from anything else an app may send back.
func archiveID(id string) bool {
	if id == "" || len(id) > 20 {
		return false
	}
	for _, c := range id {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

// olderID compares two archive ids as numbers.
func olderID(a, b string) bool {
	if len(a) != len(b) {
		return len(a) < len(b)
	}
	return a < b
}

type sms struct {
	SmsID       string `json:"sms_id"`
	SendingDate string `json:"sending_date"`
	Sender      string `json:"sender,omitempty"`
	Recipient   string `json:"recipient,omitempty"`
	SmsText     string `json:"sms_text"`
	ContentType string `json:"content_type,omitempty"`
	StreamID    string `json:"stream_id,omitempty"`
}

// fetchMessages: archive after the last id the app knows, split into received and sent.
func (s *Server) fetchMessages(w http.ResponseWriter, r *http.Request) {
	in, ses, jwt, ok := s.acrobitsSession(w, r)
	if !ok {
		return
	}
	defer ses.Close()
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	// Page forward from the older of the two ids the app knows; anything that is not
	// an archive id (an old pending copy, say) is ignored rather than failing forever.
	after := ""
	for _, id := range []string{in.LastKnownSmsID, in.LastKnownSentSmsID} {
		if archiveID(id) && (after == "" || olderID(id, after)) {
			after = id
		}
	}
	var msgs []xmppc.Message
	for page := 0; page < 5; page++ {
		batch, complete, err := ses.History(ctx, after, 100)
		if err != nil {
			log.Printf("fetch %s: %v", in.Username, err)
			fail(w, 502, "chat server error")
			return
		}
		msgs = append(msgs, batch...)
		if complete || len(batch) == 0 || after == "" {
			break // without an id the app wants the newest page only
		}
		after = batch[len(batch)-1].ID
	}
	users, _ := s.MW.Users(ctx, jwt)
	me := ses.Me()
	received, sent := []sms{}, []sms{}
	names := map[string]string{} // room -> name, asked once per request
	for _, m := range msgs {
		// Reactions and other stanzas without text or file: nothing the app can show.
		if strings.TrimSpace(m.Body) == "" && m.OOB == "" {
			continue
		}
		item := sms{SmsID: m.ID, SendingDate: m.At.UTC().Format(time.RFC3339), SmsText: emojify(m.Body), ContentType: "text/plain"}
		// An attachment goes out in the app's own file transfer format, so it shows a player or a picture.
		// Messages the app sent before the gateway converted them stay in that format: hand them back as such.
		attached := m.OOB != ""
		if _, ok := parseFileTransfer("", m.Body); ok && !attached {
			item.ContentType = fileTransferType
		}
		if m.Room != "" {
			// A group, which the app does not know: it shows as a thread named after the room,
			// each line prefixed with who wrote it, and replies go back to the room.
			name, ok := names[m.Room]
			if !ok {
				name = address.Thread(ses.RoomName(ctx, m.Room))
				names[m.Room] = name
			}
			item.StreamID = name
			if m.Nick == in.Username {
				item.Recipient = name
				if attached {
					item.SmsText, item.ContentType = s.fileTransferText(ctx, m.OOB, m.Body), fileTransferType
				}
				sent = append(sent, item)
			} else {
				item.Sender = name
				author := s.displayName(users, m.Nick)
				if attached {
					caption := author
					if m.Body != "" && m.Body != path.Base(m.OOB) {
						caption = author + ": " + m.Body
					}
					item.SmsText, item.ContentType = s.fileTransferText(ctx, m.OOB, caption), fileTransferType
				} else if item.ContentType != fileTransferType {
					item.SmsText = author + ": " + emojify(m.Body)
				}
				received = append(received, item)
			}
			continue
		}
		if attached {
			item.SmsText, item.ContentType = s.fileTransferText(ctx, m.OOB, m.Body), fileTransferType
		}
		if m.From == me {
			item.Recipient = s.address(users, m.To)
			item.StreamID = item.Recipient
			sent = append(sent, item)
		} else {
			item.Sender = s.address(users, m.From)
			item.StreamID = item.Sender
			received = append(received, item)
		}
	}
	writeJSON(w, 200, map[string]any{"date": time.Now().UTC().Format(time.RFC3339), "received_smss": received, "sent_smss": sent})
}

// address renders an operator for Acrobits: the main extension when known, else the username.
func (s *Server) address(users *userCache, bareJID string) string {
	user := strings.SplitN(bareJID, "@", 2)[0]
	if users != nil {
		if u, ok := users.byUser[user]; ok && u.Extension != "" {
			return u.Extension
		}
	}
	return user
}

// displayName is the operator's full name when the CTI knows it, else the username.
func (s *Server) displayName(users *userCache, user string) string {
	if users != nil {
		if u, ok := users.byUser[user]; ok && u.Name != "" {
			return u.Name
		}
	}
	return user
}

// sendMessage: sms_to is an extension, a username or a group name; the body goes out as one chat message.
func (s *Server) sendMessage(w http.ResponseWriter, r *http.Request) {
	in, ses, jwt, ok := s.acrobitsSession(w, r)
	if !ok {
		return
	}
	defer ses.Close()
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	if in.SmsTo == "" || in.SmsBody == "" {
		fail(w, 400, "sms_to and sms_body are required")
		return
	}
	users, _ := s.MW.Users(ctx, jwt)
	to := strings.SplitN(in.SmsTo, "@", 2)[0]
	known := false
	if users != nil {
		if u, ok := users.byExt[to]; ok {
			to, known = u, true
		} else if _, ok := users.byUser[to]; ok {
			known = true
		}
	}
	dest, group := to+"@"+s.Host, false
	if !known {
		if dest = s.groupByName(ctx, ses, address.Name(in.SmsTo)); dest == "" {
			fail(w, 404, "unknown recipient")
			return
		}
		group = true
	}
	f, isFile := parseFileTransfer(in.ContentType, in.SmsBody)
	// A flood from one account must not fill the chat server or its disk.
	if s.sends.over(in.Username, 30) || isFile && s.files.over(in.Username, 10) {
		fail(w, 429, "too many messages, retry later")
		return
	}
	var id string
	var err error
	if isFile {
		// Photos and voice notes from the app: fetched from Acrobits, decrypted, stored on our upload service.
		fctx, fcancel := context.WithTimeout(r.Context(), 60*time.Second)
		id, err = s.sendFileTransfer(fctx, ses, dest, group, f)
		fcancel()
	} else if group {
		id, err = ses.SendGroup(ctx, dest, emojify(in.SmsBody), "")
	} else {
		id, err = ses.Send(ctx, dest, emojify(in.SmsBody), "")
	}
	if err != nil {
		log.Printf("send %s: %v", in.Username, err)
		fail(w, 502, "chat server error")
		return
	}
	// The app keeps a pending copy: give it the id the archive will use, or it shows the message twice.
	if archived := ses.FindSent(ctx, id); archived != "" {
		id = archived
	}
	writeJSON(w, 200, map[string]string{"sms_id": id})
}

// pushTokenReport stores the device token and enables push for the account on ejabberd.
func (s *Server) pushTokenReport(w http.ResponseWriter, r *http.Request) {
	in, ses, _, ok := s.acrobitsSession(w, r)
	if !ok {
		return
	}
	defer ses.Close()
	if in.Selector == "" || in.TokenMsgs == "" {
		fail(w, 400, "selector and token_msgs are required")
		return
	}
	// Nodes used to be the selector itself, which anybody could name: retire the old one.
	legacy := "pnm:" + in.Selector
	old, _ := s.Store.PNM(legacy)
	if old != nil && old.Username == in.Username {
		_ = s.Store.DeletePNM(legacy)
	} else {
		old = nil
	}
	node, err := s.Store.PutPNM(store.PNMToken{Node: "pnm:" + randomID(), Username: in.Username, Selector: in.Selector, Token: in.TokenMsgs, AppID: in.AppIDMsgs})
	if err != nil {
		log.Printf("push token %s: %v", in.Username, err)
		fail(w, 500, "internal error")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	if err := ses.EnablePush(ctx, s.PushService, node); err != nil {
		log.Printf("push token %s: enable: %v", in.Username, err)
		fail(w, 502, "chat server error")
		return
	}
	if old != nil {
		_ = ses.DisablePush(ctx, s.PushService, legacy)
		logx.Debugf("push token %s: legacy node retired", in.Username)
	}
	writeJSON(w, 200, map[string]string{"status": "ok"})
}

func randomID() string {
	b := make([]byte, 12)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
