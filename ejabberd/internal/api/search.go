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
	query := `SELECT timestamp, bare_peer, COALESCE(origin_id, ''), COALESCE(nick, ''), txt FROM archive WHERE username = ? AND txt LIKE ? ESCAPE '\'`
	args := []any{user, like}
	if peer := r.URL.Query().Get("peer"); peer != "" {
		if !strings.Contains(peer, "@") {
			peer += "@" + s.Host
		}
		query += ` AND bare_peer = ?`
		args = append(args, peer)
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
