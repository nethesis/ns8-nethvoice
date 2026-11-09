package api

import (
	"database/sql"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"unicode/utf8"

	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/address"
)

// Hit is one archived message that contains the searched text.
type Hit struct {
	Peer string `json:"peer"` // operator username, or the room address for a group
	ID   string `json:"id"`   // archive id: what the client keys messages by
	OID  string `json:"oid,omitempty"`
	TS   int64  `json:"ts"` // epoch ms
	Body string `json:"body"`
	Nick string `json:"nick,omitempty"` // author inside a group
}

// Archive is ejabberd's database, opened read-only on first use: MAM has no text search on SQLite.
type Archive struct {
	Path string
	once sync.Once
	db   *sql.DB
	err  error
}

func (a *Archive) open() (*sql.DB, error) {
	a.once.Do(func() {
		a.db, a.err = sql.Open("sqlite", "file:"+a.Path+"?mode=ro&_pragma=busy_timeout(5000)")
	})
	return a.db, a.err
}

const searchLimit = 200

// Peers lists who I have chatted with, operators and groups, the latest chat first.
func (a *Archive) Peers(jid, user string) ([]string, error) {
	db, err := a.open()
	if err != nil {
		return nil, err
	}
	// A group's messages reach my archive as its subscriber, under the room's address.
	rows, err := db.Query(`SELECT bare_peer FROM archive WHERE username = ? AND kind = 'chat' AND bare_peer <> ? GROUP BY bare_peer ORDER BY MAX(timestamp) DESC`, user, jid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var peers []string
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err != nil {
			return nil, err
		}
		peers = append(peers, p)
	}
	return peers, rows.Err()
}

// conversations answers GET /conversations: everyone I have a chat with, the latest first,
// so a client lists them all and not only those in its newest page of history.
func (s *Server) conversations(w http.ResponseWriter, r *http.Request) {
	user, _, err := s.bearerUser(r)
	if err != nil {
		fail(w, 401, "unauthorized")
		return
	}
	peers, err := s.Archive.Peers(user+"@"+s.Host, user)
	if err != nil {
		log.Printf("conversations %s: %v", user, err)
		fail(w, 500, "internal error")
		return
	}
	if peers == nil {
		peers = []string{}
	}
	writeJSON(w, 200, map[string]any{"peers": peers})
}

// search answers GET /search?q=text[&peer=user|room]: my archived messages containing q, newest first.
func (s *Server) search(w http.ResponseWriter, r *http.Request) {
	user, _, err := s.bearerUser(r)
	if err != nil {
		fail(w, 401, "unauthorized")
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if utf8.RuneCountInString(q) < 2 || len(q) > 200 {
		fail(w, 400, "q must be 2 to 200 characters")
		return
	}
	db, err := s.Archive.open()
	if err != nil {
		log.Printf("search: %v", err)
		fail(w, 500, "internal error")
		return
	}
	like := "%" + strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(q) + "%"
	// A 1:1 message is in my own archive; a group's is archived once, under the room, for its subscribers.
	query := `SELECT timestamp, CASE WHEN kind = 'groupchat' THEN username ELSE bare_peer END, COALESCE(origin_id, ''), COALESCE(nick, ''), txt FROM archive WHERE txt LIKE ? ESCAPE '\'`
	args := []any{like}
	mine := `(username = ? AND kind = 'chat')`
	rooms := `(kind = 'groupchat' AND username IN (SELECT room || '@' || host FROM muc_room_subscribers WHERE jid = ?))`
	if peer := r.URL.Query().Get("peer"); peer != "" {
		if !strings.Contains(peer, "@") {
			peer += "@" + s.Host
		}
		if address.IsRoom(peer) {
			query += ` AND username = ? AND ` + rooms
			args = append(args, peer, user+"@"+s.Host)
		} else {
			query += ` AND bare_peer = ? AND ` + mine
			args = append(args, peer, user)
		}
	} else {
		query += ` AND (` + mine + ` OR ` + rooms + `)`
		args = append(args, user, user+"@"+s.Host)
	}
	rows, err := db.QueryContext(r.Context(), query+` ORDER BY timestamp DESC LIMIT ?`, append(args, searchLimit)...)
	if err != nil {
		log.Printf("search %s: %v", user, err)
		fail(w, 500, "internal error")
		return
	}
	defer rows.Close()
	hits := []Hit{}
	for rows.Next() {
		var ts int64
		var h Hit
		if err := rows.Scan(&ts, &h.Peer, &h.OID, &h.Nick, &h.Body); err != nil {
			log.Printf("search %s: %v", user, err)
			fail(w, 500, "internal error")
			return
		}
		h.ID, h.TS = strconv.FormatInt(ts, 10), ts/1000
		if !address.IsRoom(h.Peer) {
			h.Peer, h.Nick = address.Local(h.Peer), ""
		}
		hits = append(hits, h)
	}
	writeJSON(w, 200, map[string]any{"results": hits})
}
