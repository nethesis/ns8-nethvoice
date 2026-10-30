package api

// The guest's side: their page and what it calls, with the guest's own token.

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/address"
	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/cti"
	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/logx"
	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/store"
	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/xmppc"
)

// GuestAppDir holds the guest page: chat-island's guest build (index.html and its assets).
var GuestAppDir = "/opt/ejabberd/guest"

// opName is an operator's name for guests: the middleware's directory, which needs an operator's token
// seen since the gateway started, else the CTI's users.json; the username at worst.
func (s *Server) opName(user string) string {
	if n := s.MW.Name(user); n != user {
		return n
	}
	if s.CTIConfig != "" {
		if names, err := cti.Names(s.CTIConfig); err == nil && names[user] != "" {
			return names[user]
		}
	}
	return user
}

// guestFrom is the guest a page speaks for, by their own token: still in the room, within their call budget.
func (s *Server) guestFrom(w http.ResponseWriter, r *http.Request) (*store.Guest, bool) {
	token := strings.TrimPrefix(r.Header.Get("Authorization"), "Guest ")
	if len(token) != 48 {
		fail(w, http.StatusUnauthorized, "not a guest")
		return nil, false
	}
	g, err := s.Store.GuestByToken(hashToken(token))
	if err != nil || g == nil {
		fail(w, http.StatusUnauthorized, "not a guest")
		return nil, false
	}
	if g.Removed {
		fail(w, http.StatusGone, "removed from the chat")
		return nil, false
	}
	if s.guestCalls.over(g.ID, guestCalls) {
		fail(w, http.StatusTooManyRequests, "slow down")
		return nil, false
	}
	return g, true
}

// guestStill: the guest a waiting request speaks for was not removed meanwhile.
func (s *Server) guestStill(id string) bool {
	g, err := s.Store.Guest(id)
	return err == nil && g != nil && !g.Removed
}

// guestPageHandler: GET /g/: the page; it reads the link's token from the fragment of its own address.
func (s *Server) guestPageHandler(w http.ResponseWriter, _ *http.Request) {
	page, err := os.ReadFile(filepath.Join(GuestAppDir, "index.html"))
	if err != nil {
		http.Error(w, "guest page not installed", http.StatusServiceUnavailable)
		return
	}
	s.guestHeaders(w)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Write(page)
}

// guestAssets: GET /guest-app/…: the page's scripts and styles.
func (s *Server) guestAssets() http.Handler {
	files := http.StripPrefix("/guest-app/", http.FileServer(http.Dir(GuestAppDir)))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/") {
			http.NotFound(w, r) // files only, no listing
			return
		}
		s.guestHeaders(w)
		w.Header().Set("Cache-Control", "public, max-age=86400")
		files.ServeHTTP(w, r)
	})
}

// guestHeaders: the link is in the page's address, it must not leave through a referrer or a frame.
func (s *Server) guestHeaders(w http.ResponseWriter) {
	h := w.Header()
	h.Set("Referrer-Policy", "no-referrer")
	h.Set("X-Frame-Options", "DENY")
	h.Set("X-Content-Type-Options", "nosniff")
	// Scripts only from the page's own build, not from anything uploaded to the same host.
	h.Set("Content-Security-Policy", "default-src 'none'; script-src https://"+s.PublicHost+"/chat-gw/guest-app/; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
}

// guestChat: GET /guest/chat: who the page is, the room's name and who made it.
func (s *Server) guestChat(w http.ResponseWriter, r *http.Request) {
	g, ok := s.guestFrom(w, r)
	if !ok {
		return
	}
	e, err := s.Store.ExtRoom(g.Room)
	if err != nil || e == nil {
		fail(w, http.StatusGone, "the chat is gone")
		return
	}
	_, _ = s.MW.Directory(r.Context()) // names known before the first one is asked
	writeJSON(w, http.StatusOK, map[string]any{"id": g.ID, "name": g.Name, "nick": g.Nick, "title": e.Title, "operator": s.opName(e.Owner), "members": s.extMembers(r.Context(), e)})
}

type extMember struct {
	Name     string `json:"name"`
	External bool   `json:"external"`
}

// extMembers: who is in the room, by name only: operators first, then the guests in the order they joined.
func (s *Server) extMembers(ctx context.Context, e *store.ExtRoom) []extMember {
	out := []extMember{}
	var affs []struct {
		Affiliation string `json:"affiliation"`
		JID         string `json:"jid"`
	}
	if err := s.ejabberd(ctx, "get_room_affiliations", map[string]string{"room": e.Room, "service": address.MUC(s.Host)}, &affs); err == nil {
		for _, a := range affs {
			if (a.Affiliation == "member" || a.Affiliation == "owner") && !IsGuest(a.JID) {
				out = append(out, extMember{Name: s.opName(address.Local(a.JID))})
			}
		}
	}
	if list, err := s.Store.Guests(e.Room); err == nil {
		for _, g := range list {
			if !g.Removed {
				out = append(out, extMember{Name: g.Nick, External: true})
			}
		}
	}
	return out
}

type guestReply struct {
	ID     string `json:"id"`
	Author string `json:"author"` // nick
	Quote  string `json:"quote,omitempty"`
}

type guestMsg struct {
	ID     string      `json:"id"`  // archive id
	OID    string      `json:"oid"` // the sender's id: reactions and replies point to it
	SID    string      `json:"sid"` // the room's id: a retraction names it
	Mine   bool        `json:"mine"`
	Nick   string      `json:"nick"`
	Author string      `json:"author"`
	Body   string      `json:"body"`
	Files  []string    `json:"files,omitempty"`
	At     int64       `json:"at"`
	Reply  *guestReply `json:"reply,omitempty"`
}

type guestReaction struct {
	Target string   `json:"target"`
	Nick   string   `json:"nick"`
	Emojis []string `json:"emojis"`
}

type guestPage struct {
	Messages    []guestMsg      `json:"messages"`
	Reactions   []guestReaction `json:"reactions"`
	Retractions []guestReaction `json:"retractions"` // sids (or oids) taken back, by whom (no emojis)
	Complete    bool            `json:"complete"`    // nothing older
	First       string          `json:"first"`       // archive ids of the page, whatever they hold: where the next one starts
	Last        string          `json:"last"`
}

// guestMessages: GET /guest/messages?after=<id> what came after id; ?before=<id> the page before it;
// neither: the last page. With nothing new after id it waits for the push that says something
// arrived, up to guestWait (wait=0: no wait).
func (s *Server) guestMessages(w http.ResponseWriter, r *http.Request) {
	g, ok := s.guestFrom(w, r)
	if !ok {
		return
	}
	q := r.URL.Query()
	after, before, wait := q.Get("after"), q.Get("before"), q.Get("wait") != "0" && q.Get("before") == ""
	if (after != "" && !archiveID(after)) || (before != "" && !archiveID(before)) {
		fail(w, http.StatusBadRequest, "bad id")
		return
	}
	ctx := r.Context()
	// Registered before reading: a message landing in between still wakes this request.
	wake := s.guestWait.wait(g.ID)
	if wake == nil {
		fail(w, http.StatusTooManyRequests, "too many open")
		return
	}
	defer s.guestWait.drop(g.ID, wake)
	page, err := s.readGuest(ctx, g, after, before)
	if err == nil && page.empty() && wait {
		select {
		case <-wake:
			if !s.guestStill(g.ID) {
				fail(w, http.StatusGone, "removed from the chat")
				return
			}
			page, err = s.readGuest(ctx, g, after, before)
		case <-time.After(guestWait):
		case <-ctx.Done():
			return
		}
	}
	if err != nil {
		log.Printf("guests: read %s: %v", g.ID, err)
		fail(w, http.StatusBadGateway, "archive unavailable")
		return
	}
	writeJSON(w, http.StatusOK, page)
}

func (p *guestPage) empty() bool {
	return len(p.Messages) == 0 && len(p.Reactions) == 0 && len(p.Retractions) == 0
}

// readGuest reads the guest's own archive: their room only.
func (s *Server) readGuest(ctx context.Context, g *store.Guest, after, before string) (*guestPage, error) {
	ses, err := s.guestSession(ctx, g.ID)
	if err != nil {
		return nil, err
	}
	defer ses.Close()
	// The room's own archive: everything since it was made, for who joins late too.
	room := g.Room + "@" + address.MUC(s.Host)
	raw, complete, err := ses.RoomPage(ctx, room, after, before, 50)
	if err != nil {
		return nil, err
	}
	if after != "" {
		complete = false
	}
	page := &guestPage{Messages: []guestMsg{}, Reactions: []guestReaction{}, Retractions: []guestReaction{}, Complete: complete}
	if len(raw) > 0 {
		page.First, page.Last = raw[0].ID, raw[len(raw)-1].ID
	}
	for _, m := range raw {
		switch {
		case m.Retract != "":
			page.Retractions = append(page.Retractions, guestReaction{Target: m.Retract, Nick: m.Nick, Emojis: []string{}})
		case m.ReactTo != "":
			page.Reactions = append(page.Reactions, guestReaction{Target: m.ReactTo, Nick: m.Nick, Emojis: m.Reactions})
		case m.Body != "" || len(m.Files) > 0:
			page.Messages = append(page.Messages, s.guestMessage(g, m))
		}
	}
	return page, nil
}

func (s *Server) guestMessage(g *store.Guest, m xmppc.Message) guestMsg {
	author := m.Nick
	if usernameRe.MatchString(m.Nick) {
		author = s.opName(m.Nick) // an operator: their name; a guest's nick is their name already
	}
	files := make([]string, len(m.Files))
	for i, f := range m.Files {
		files[i] = s.publicURL(f)
	}
	out := guestMsg{ID: m.ID, OID: m.OriginID, SID: m.RoomSID, Mine: m.Nick == g.Nick, Nick: m.Nick, Author: author, Body: m.Body, Files: files, At: m.At.UnixMilli()}
	if m.ReplyID != "" {
		rep := &guestReply{ID: m.ReplyID}
		if i := strings.IndexByte(m.ReplyTo, '/'); i >= 0 {
			rep.Author = m.ReplyTo[i+1:]
		}
		// The quote is the fallback's span of the body (characters): shown apart, cut from the text.
		chars := []rune(m.Body)
		if m.QuoteStart >= 0 && m.QuoteEnd > m.QuoteStart && m.QuoteEnd <= len(chars) {
			rep.Quote = strings.TrimSpace(strings.TrimPrefix(string(chars[m.QuoteStart:m.QuoteEnd]), ">"))
			out.Body = strings.TrimSpace(string(chars[:m.QuoteStart]) + string(chars[m.QuoteEnd:]))
		}
		out.Reply = rep
	}
	return out
}

// guestSend: POST /guest/messages {"body", "files", "reply"}: files are links from guestUpload.
func (s *Server) guestSend(w http.ResponseWriter, r *http.Request) {
	g, ok := s.guestFrom(w, r)
	if !ok {
		return
	}
	var req struct {
		Body  string      `json:"body"`
		Files []string    `json:"files"`
		Reply *guestReply `json:"reply"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || (strings.TrimSpace(req.Body) == "" && len(req.Files) == 0) || utf8.RuneCountInString(req.Body) > 4000 || len(req.Files) > 10 {
		fail(w, http.StatusBadRequest, "empty or too long")
		return
	}
	if req.Reply != nil && (req.Reply.ID == "" || len(req.Reply.ID) > 64 || req.Reply.Author == "" || utf8.RuneCountInString(req.Reply.Author) > 80 || utf8.RuneCountInString(req.Reply.Quote) > 200) {
		fail(w, http.StatusBadRequest, "bad reply")
		return
	}
	// Only this server's uploads travel as attachments, by a clean /upload/ path.
	for _, f := range req.Files {
		if _, ok := uploadPath(f); !ok || hostOf(f) != s.PublicHost || !strings.HasPrefix(f, "https://") {
			fail(w, http.StatusBadRequest, "bad attachment")
			return
		}
	}
	if s.sends.over(g.ID, 20) {
		fail(w, http.StatusTooManyRequests, "slow down")
		return
	}
	ses, err := s.guestSession(r.Context(), g.ID)
	if err != nil {
		log.Printf("guests: send %s: %v", g.ID, err)
		fail(w, http.StatusBadGateway, "not sent")
		return
	}
	defer ses.Close()
	room := g.Room + "@" + address.MUC(s.Host)
	// Who is quoted and what they said come from the room's archive, never from the page.
	var target xmppc.Message
	if req.Reply != nil {
		target, ok = roomMessage(r.Context(), ses, room, req.Reply.ID)
	}
	if req.Reply != nil && ok {
		quote := []rune(strings.Join(strings.Fields(s.guestMessage(g, target).Body), " "))
		if len(quote) > 200 {
			quote = append(quote[:199], '…')
		}
		_, err = ses.SendGroupReply(r.Context(), room, req.Body, req.Reply.ID, target.Nick, string(quote), req.Files...)
	} else {
		_, err = ses.SendGroup(r.Context(), room, req.Body, req.Files...)
	}
	if err != nil {
		log.Printf("guests: send %s: %v", g.ID, err)
		fail(w, http.StatusBadGateway, "not sent")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// guestReact: POST /guest/react {"target", "emojis"}: the guest's whole set on one message; empty takes it back.
func (s *Server) guestReact(w http.ResponseWriter, r *http.Request) {
	g, ok := s.guestFrom(w, r)
	if !ok {
		return
	}
	var req struct {
		Target string   `json:"target"`
		Emojis []string `json:"emojis"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Target == "" || len(req.Target) > 64 || len(req.Emojis) > 5 {
		fail(w, http.StatusBadRequest, "bad reaction")
		return
	}
	for _, e := range req.Emojis {
		if e == "" || utf8.RuneCountInString(e) > 16 {
			fail(w, http.StatusBadRequest, "bad reaction")
			return
		}
	}
	if s.sends.over(g.ID, 20) {
		fail(w, http.StatusTooManyRequests, "slow down")
		return
	}
	ses, err := s.guestSession(r.Context(), g.ID)
	if err == nil {
		err = ses.ReactGroup(r.Context(), g.Room+"@"+address.MUC(s.Host), req.Target, req.Emojis)
		ses.Close()
	}
	if err != nil {
		log.Printf("guests: react %s: %v", g.ID, err)
		fail(w, http.StatusBadGateway, "not sent")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// guestRetract: POST /guest/retract {"sid"}: takes back one of the guest's own messages, for everyone.
func (s *Server) guestRetract(w http.ResponseWriter, r *http.Request) {
	g, ok := s.guestFrom(w, r)
	if !ok {
		return
	}
	var req struct {
		SID string `json:"sid"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.SID == "" || len(req.SID) > 64 {
		fail(w, http.StatusBadRequest, "bad message")
		return
	}
	if s.sends.over(g.ID, 20) {
		fail(w, http.StatusTooManyRequests, "slow down")
		return
	}
	// Only the guest's own messages: the room relays a retraction from anyone.
	room := g.Room + "@" + address.MUC(s.Host)
	ses, err := s.guestSession(r.Context(), g.ID)
	if err == nil {
		m, found := roomMessage(r.Context(), ses, room, req.SID)
		if !found || m.Nick != g.Nick {
			ses.Close()
			fail(w, http.StatusForbidden, "not your message")
			return
		}
		err = ses.Retract(r.Context(), room, req.SID, true)
		ses.Close()
	}
	if err != nil {
		log.Printf("guests: retract %s: %v", g.ID, err)
		fail(w, http.StatusBadGateway, "not sent")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// guestUpload: POST /guest/upload {"name", "size", "type"}: a slot on ejabberd's upload service, as
// the guest; the page puts the file there and sends its link.
func (s *Server) guestUpload(w http.ResponseWriter, r *http.Request) {
	g, ok := s.guestFrom(w, r)
	if !ok {
		return
	}
	var req struct {
		Name string `json:"name"`
		Size int64  `json:"size"`
		Type string `json:"type"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" || req.Size <= 0 {
		fail(w, http.StatusBadRequest, "bad request")
		return
	}
	// The file is served from the CTI's own address: nothing a browser renders as a page.
	if !guestFileOK(req.Name, req.Type) {
		fail(w, http.StatusUnsupportedMediaType, "file type not accepted")
		return
	}
	if s.files.over(g.ID, 10) {
		fail(w, http.StatusTooManyRequests, "slow down")
		return
	}
	ses, err := s.guestSession(r.Context(), g.ID)
	if err != nil {
		fail(w, http.StatusBadGateway, "no slot")
		return
	}
	defer ses.Close()
	put, get, headers, err := ses.Slot(r.Context(), req.Name, req.Size, req.Type)
	if err != nil {
		// Too big, or over the quota: the detail stays in the log.
		logx.Debugf("guests: upload slot for %s: %v", g.ID, err)
		fail(w, http.StatusRequestEntityTooLarge, "file not accepted")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"put": s.publicURL(put), "get": s.publicURL(get), "headers": headers})
}

// roomMessage finds one of the room's recent messages by the room's id or the sender's.
func roomMessage(ctx context.Context, ses *xmppc.Session, room, ref string) (xmppc.Message, bool) {
	before := ""
	for range 4 {
		page, complete, err := ses.RoomPage(ctx, room, "", before, 50)
		if err != nil || len(page) == 0 {
			break
		}
		for _, m := range page {
			if m.Retract == "" && m.ReactTo == "" && (m.RoomSID == ref || m.ID == ref || m.OriginID == ref) {
				return m, true
			}
		}
		if complete {
			break
		}
		before = page[0].ID
	}
	return xmppc.Message{}, false
}

// guestFileOK: a guest's upload by name and type; pages, vector images and scripts stay out.
func guestFileOK(name, typ string) bool {
	ext := strings.ToLower(path.Ext(name))
	t := strings.ToLower(strings.TrimSpace(strings.Split(typ, ";")[0]))
	switch ext {
	case ".htm", ".html", ".xhtml", ".shtml", ".svg", ".svgz", ".xml", ".xsl", ".js", ".mjs", ".css", ".swf":
		return false
	}
	return !strings.Contains(t, "html") && !strings.Contains(t, "svg") && !strings.Contains(t, "xml") &&
		!strings.Contains(t, "javascript") && t != "text/css"
}
