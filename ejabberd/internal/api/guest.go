package api

// Rooms with people outside the PBX. An operator makes a room and gets an invite link; whoever
// opens the link and gives a name joins as a guest of their own, g~<id>@<host>, with a token of
// their own kept by their browser. Guests never get an XMPP session: the gateway speaks for them
// with the service password, so they reach their room and nothing else. Their account's push node
// wakes their page. The link's token travels in the URL fragment (no server log sees it) and only
// hashes are stored. The link lasts guestTTL and only lets people in; who joined stays until removed.

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/address"
	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/store"
	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/svcauth"
	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/xmppc"
)

const (
	GuestPrefix   = "g~"   // guest accounts: no chat username has a ~ (chat-extauth refuses it)
	ExtRoomPrefix = "ext-" // rooms with guests: clients badge them
	GuestNodePfx  = "guest:"
	guestTTL      = 30 * 24 * time.Hour
	guestWait     = 25 * time.Second // a long poll with nothing new returns after this
	guestPolls    = 3                // long polls open at once per guest
	guestCalls    = 120              // page calls per guest per minute: a long poll is ~2
	maxGuests     = 10               // guests in a room at once
	joinsPerMin   = 10               // joins per client address per minute
)

// IsGuest tells a guest account (local part or bare JID) from an operator.
func IsGuest(j string) bool { return strings.HasPrefix(address.Local(j), GuestPrefix) }

// guestWaiters: the guest pages waiting for a message, by guest id.
type guestWaiters struct {
	mu sync.Mutex
	m  map[string][]chan struct{}
}

// wait registers a waiter, nil when the guest already has guestPolls of them.
func (g *guestWaiters) wait(id string) chan struct{} {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.m == nil {
		g.m = map[string][]chan struct{}{}
	}
	if len(g.m[id]) >= guestPolls {
		return nil
	}
	c := make(chan struct{})
	g.m[id] = append(g.m[id], c)
	return c
}

func (g *guestWaiters) drop(id string, c chan struct{}) {
	g.mu.Lock()
	defer g.mu.Unlock()
	list := g.m[id]
	for i, x := range list {
		if x == c {
			g.m[id] = append(list[:i], list[i+1:]...)
			break
		}
	}
	if len(g.m[id]) == 0 {
		delete(g.m, id)
	}
}

// WakeGuest is called for a push to a guest node: the waiting pages fetch again.
func (s *Server) WakeGuest(node string) {
	id := strings.TrimPrefix(node, GuestNodePfx)
	s.guestWait.mu.Lock()
	defer s.guestWait.mu.Unlock()
	for _, c := range s.guestWait.m[id] {
		close(c)
	}
	delete(s.guestWait.m, id)
}

var usernameRe = regexp.MustCompile(`^[a-z0-9][a-z0-9._-]*$`)

// guestNick is the name others see on a guest's messages: never an operator's username (those get
// a mark no username has) nor another guest's nick in the room (those get a number).
func guestNick(name string, taken map[string]bool) string {
	nick := name
	if usernameRe.MatchString(nick) {
		nick += " ·"
	}
	for i := 2; taken[nick]; i++ {
		nick = fmt.Sprintf("%s %d", name, i)
	}
	return nick
}

// guestName: a display name, without control characters; spaces collapsed.
func guestName(raw string) (string, bool) {
	name := strings.Join(strings.Fields(raw), " ")
	for _, r := range name {
		if unicode.IsControl(r) || unicode.Is(unicode.Cf, r) {
			return "", false
		}
	}
	return name, name != "" && utf8.RuneCountInString(name) <= 64
}

func (s *Server) guestSession(ctx context.Context, id string) (*xmppc.Session, error) {
	return xmppc.Dial(ctx, s.C2SAddr, s.Host, id, svcauth.Password(s.Secret, id, s.Host, time.Now()))
}

func (s *Server) inviteLink(token string) string {
	return "https://" + s.PublicHost + "/chat-gw/g/#" + token
}

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

func newToken() string { return randomID() + randomID() } // 192 bits

// createExtRoom: POST /guests {"name"}: a room named name, the operator its owner, and its invite link.
func (s *Server) createExtRoom(w http.ResponseWriter, r *http.Request) {
	user, _, err := s.bearerUser(r)
	if err != nil {
		fail(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		fail(w, http.StatusBadRequest, "bad request")
		return
	}
	title, ok := guestName(req.Name)
	if !ok {
		fail(w, http.StatusBadRequest, "name required, 64 characters at most")
		return
	}
	if s.invites.over(user, 20) {
		fail(w, http.StatusTooManyRequests, "too many invitations")
		return
	}
	ctx := r.Context()
	room, token, now := ExtRoomPrefix+randomID()[:12], newToken(), time.Now()
	ext := store.ExtRoom{Room: room, Title: title, Owner: user, Link: hashToken(token), Created: now.Unix(), Expires: now.Add(guestTTL).Unix()}
	opts := []map[string]string{
		{"name": "title", "value": title},
		{"name": "persistent", "value": "true"},
		{"name": "members_only", "value": "true"},
		{"name": "public", "value": "false"},
		{"name": "public_list", "value": "false"},
		{"name": "allow_subscription", "value": "true"},
		{"name": "mam", "value": "true"},
		{"name": "affiliations", "value": "owner=" + user + "@" + s.Host},
	}
	if err := s.ejabberd(ctx, "create_room_with_opts", map[string]any{"room": room, "service": address.MUC(s.Host), "host": s.Host, "options": opts}, nil); err != nil {
		log.Printf("guests: create room for %s: %v", user, err)
		fail(w, http.StatusBadGateway, "room not created")
		return
	}
	s.subscribe(ctx, user, room)
	if err := s.Store.PutExtRoom(ext); err != nil {
		_ = s.ejabberd(ctx, "destroy_room", map[string]string{"name": room, "service": address.MUC(s.Host)}, nil)
		fail(w, http.StatusInternalServerError, "room not saved")
		return
	}
	s.invite(ctx, room, []string{user})
	writeJSON(w, http.StatusOK, s.extInfo(&ext, user, s.inviteLink(token)))
}

type guestEntry struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Nick   string `json:"nick"`
	Joined int64  `json:"joined"`
}

// extInfo: the link only right after it is made; nobody can read it back.
func (s *Server) extInfo(e *store.ExtRoom, user, link string) map[string]any {
	guests := []guestEntry{}
	if list, err := s.Store.Guests(e.Room); err == nil {
		for _, g := range list {
			if !g.Removed {
				guests = append(guests, guestEntry{g.ID, g.Name, g.Nick, g.Joined})
			}
		}
	}
	return map[string]any{"room": e.Room + "@" + address.MUC(s.Host), "title": e.Title, "link": link, "expires": e.Expires,
		"revoked": e.Revoked, "owner": e.Owner == user, "guests": guests}
}

// extRoomFor finds an external room the caller belongs to; owner: only the one who made it.
func (s *Server) extRoomFor(w http.ResponseWriter, r *http.Request, owner bool) (*store.ExtRoom, string, bool) {
	user, _, err := s.bearerUser(r)
	if err != nil {
		fail(w, http.StatusUnauthorized, "unauthorized")
		return nil, "", false
	}
	room := address.Local(r.PathValue("room"))
	e, err := s.Store.ExtRoom(room)
	if err != nil || e == nil {
		fail(w, http.StatusNotFound, "not a room with guests")
		return nil, "", false
	}
	if owner && e.Owner != user {
		fail(w, http.StatusForbidden, "only who made it")
		return nil, "", false
	}
	var affs []struct {
		Affiliation string `json:"affiliation"`
		JID         string `json:"jid"`
	}
	if err := s.ejabberd(r.Context(), "get_room_affiliations", map[string]string{"room": room, "service": address.MUC(s.Host)}, &affs); err != nil {
		fail(w, http.StatusNotFound, "not a room with guests")
		return nil, "", false
	}
	for _, a := range affs {
		if address.Local(a.JID) == user && a.Affiliation != "none" && a.Affiliation != "outcast" {
			return e, user, true
		}
	}
	fail(w, http.StatusForbidden, "not a member")
	return nil, "", false
}

// getExtRoom: GET /guests/{room}: the link's state and who joined, for the room's members; never the link.
func (s *Server) getExtRoom(w http.ResponseWriter, r *http.Request) {
	if e, user, ok := s.extRoomFor(w, r, false); ok {
		writeJSON(w, http.StatusOK, s.extInfo(e, user, ""))
	}
}

// newExtLink: POST /guests/{room}/link: a new link for 30 days, open again; the old one stops working.
func (s *Server) newExtLink(w http.ResponseWriter, r *http.Request) {
	e, user, ok := s.extRoomFor(w, r, true)
	if !ok {
		return
	}
	token := newToken()
	e.Expires, e.Revoked = time.Now().Add(guestTTL).Unix(), false
	if err := s.Store.SetExtLink(e.Room, hashToken(token), e.Expires); err != nil {
		fail(w, http.StatusInternalServerError, "not saved")
		return
	}
	writeJSON(w, http.StatusOK, s.extInfo(e, user, s.inviteLink(token)))
}

// revokeExtLink: DELETE /guests/{room}: the link lets nobody new in; who joined stays.
func (s *Server) revokeExtLink(w http.ResponseWriter, r *http.Request) {
	e, user, ok := s.extRoomFor(w, r, true)
	if !ok {
		return
	}
	if err := s.Store.RevokeExtLink(e.Room); err != nil {
		fail(w, http.StatusInternalServerError, "not revoked")
		return
	}
	e.Revoked = true
	writeJSON(w, http.StatusOK, s.extInfo(e, user, ""))
}

// removeGuest: DELETE /guests/{room}/{guest}: that guest leaves the room and their page stops working.
func (s *Server) removeGuest(w http.ResponseWriter, r *http.Request) {
	e, user, ok := s.extRoomFor(w, r, true)
	if !ok {
		return
	}
	g, err := s.Store.Guest(r.PathValue("guest"))
	if err != nil || g == nil || g.Room != e.Room {
		fail(w, http.StatusNotFound, "no such guest")
		return
	}
	if err := s.Store.RemoveGuest(g.ID); err != nil {
		fail(w, http.StatusInternalServerError, "not removed")
		return
	}
	// No affiliation in a members-only room: ejabberd drops the subscription too.
	_ = s.ejabberd(r.Context(), "set_room_affiliation", map[string]string{"room": e.Room, "service": address.MUC(s.Host), "user": g.ID, "host": s.Host, "affiliation": "none"}, nil)
	s.WakeGuest(g.ID)
	s.tellMembers(r.Context(), e.Room)
	writeJSON(w, http.StatusOK, s.extInfo(e, user, ""))
}

// tellMembers: an invitation makes the operators' clients read the room's members again.
func (s *Server) tellMembers(ctx context.Context, room string) {
	var affs []struct {
		Affiliation string `json:"affiliation"`
		JID         string `json:"jid"`
	}
	if err := s.ejabberd(ctx, "get_room_affiliations", map[string]string{"room": room, "service": address.MUC(s.Host)}, &affs); err != nil {
		return
	}
	var users []string
	for _, a := range affs {
		if (a.Affiliation == "member" || a.Affiliation == "owner") && !IsGuest(a.JID) {
			users = append(users, address.Local(a.JID))
		}
	}
	s.invite(ctx, room, users)
}

// openLink is the room a link token lets people into, while it does.
func (s *Server) openLink(token string) (*store.ExtRoom, int) {
	if len(token) != 48 {
		return nil, http.StatusUnauthorized
	}
	e, err := s.Store.ExtRoomByLink(hashToken(token))
	if err != nil || e == nil {
		return nil, http.StatusUnauthorized
	}
	if e.Revoked || time.Now().Unix() > e.Expires {
		return e, http.StatusGone
	}
	return e, 0
}

// linkInfo: POST /guest/link {"link"}: the room's name, before joining (in a body: no log sees the token).
func (s *Server) linkInfo(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Link string `json:"link"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	if s.linkReads.over(clientIP(r), joinsPerMin*6) {
		fail(w, http.StatusTooManyRequests, "slow down")
		return
	}
	e, code := s.openLink(req.Link)
	if code == http.StatusUnauthorized {
		fail(w, code, "invalid link")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"title": e.Title, "room": e.Room, "open": code == 0})
}

// joinGuest: POST /guest/join {"link", "name"}: a guest of their own in the link's room; their token back.
func (s *Server) joinGuest(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Link string `json:"link"`
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		fail(w, http.StatusBadRequest, "bad request")
		return
	}
	if s.joins.over(clientIP(r), joinsPerMin) {
		fail(w, http.StatusTooManyRequests, "slow down")
		return
	}
	e, code := s.openLink(req.Link)
	if code != 0 {
		fail(w, code, "link not valid")
		return
	}
	name, ok := guestName(req.Name)
	if !ok {
		fail(w, http.StatusBadRequest, "name required, 64 characters at most")
		return
	}
	list, err := s.Store.Guests(e.Room)
	if err != nil {
		fail(w, http.StatusInternalServerError, "not joined")
		return
	}
	taken, active := map[string]bool{}, 0
	for _, g := range list {
		taken[g.Nick] = true
		if !g.Removed {
			active++
		}
		// One name, one person: whoever joins with a name already there picks another.
		if strings.EqualFold(g.Name, name) || strings.EqualFold(g.Nick, name) {
			writeJSON(w, http.StatusConflict, map[string]string{"message": "name taken", "code": "name_taken"})
			return
		}
	}
	if active >= maxGuests {
		writeJSON(w, http.StatusConflict, map[string]string{"message": "the chat is full", "code": "full"})
		return
	}
	ctx := r.Context()
	id, token := GuestPrefix+randomID()[:12], newToken()
	g := store.Guest{ID: id, Room: e.Room, Name: name, Nick: guestNick(name, taken), Token: hashToken(token), Joined: time.Now().Unix()}
	err = s.ejabberd(ctx, "set_room_affiliation", map[string]string{"room": e.Room, "service": address.MUC(s.Host), "user": id, "host": s.Host, "affiliation": "member"}, nil)
	if err == nil {
		err = s.ejabberd(ctx, "subscribe_room", map[string]any{"user": id, "host": s.Host, "nick": g.Nick, "room": e.Room, "service": address.MUC(s.Host),
			"nodes": []string{"urn:xmpp:mucsub:nodes:messages", "urn:xmpp:mucsub:nodes:config"}}, nil)
	}
	// The guest's own push node: ejabberd tells the gateway when something reaches them.
	// Right after the room changes, ejabberd's SQLite may still be busy ("database is locked"): try again.
	for try := 1; err == nil; try++ {
		var ses *xmppc.Session
		if ses, err = s.guestSession(ctx, id); err == nil {
			err = ses.EnablePush(ctx, s.PushService, GuestNodePfx+id)
			ses.Close()
		}
		if err == nil || try == 3 {
			break
		}
		time.Sleep(time.Duration(try) * 400 * time.Millisecond)
		err = nil
	}
	if err == nil {
		err = s.Store.PutGuest(g)
	}
	if err != nil {
		log.Printf("guests: join %s: %v", e.Room, err)
		_ = s.ejabberd(ctx, "set_room_affiliation", map[string]string{"room": e.Room, "service": address.MUC(s.Host), "user": id, "host": s.Host, "affiliation": "none"}, nil)
		fail(w, http.StatusBadGateway, "not joined")
		return
	}
	s.tellMembers(ctx, e.Room)
	writeJSON(w, http.StatusOK, map[string]any{"token": token, "room": e.Room})
}
