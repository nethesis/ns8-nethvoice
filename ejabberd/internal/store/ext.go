package store

import "database/sql"

// Rooms with people outside the PBX. An ExtRoom has one invite link at a time (Link is its token's
// SHA-256); everyone who opens it and gives a name becomes a Guest with a token of their own.

type ExtRoom struct {
	Room, Title, Owner, Link string
	Created, Expires         int64
	Revoked                  bool // the link takes nobody new; who joined stays
}

type Guest struct {
	ID, Room, Name, Nick, Token string
	Joined                      int64
	Removed                     bool
}

func (s *Store) initExt() error {
	for _, q := range []string{
		`DROP TABLE IF EXISTS guests`, // the first draft: one guest per link
		`CREATE TABLE IF NOT EXISTS ext_rooms (room TEXT PRIMARY KEY, title TEXT NOT NULL, owner TEXT NOT NULL, link TEXT NOT NULL UNIQUE, created INTEGER NOT NULL, expires INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0)`,
		`CREATE TABLE IF NOT EXISTS ext_guests (id TEXT PRIMARY KEY, room TEXT NOT NULL, name TEXT NOT NULL, nick TEXT NOT NULL, token TEXT NOT NULL UNIQUE, joined INTEGER NOT NULL, removed INTEGER NOT NULL DEFAULT 0)`,
		`CREATE INDEX IF NOT EXISTS ext_guests_room ON ext_guests(room)`,
	} {
		if _, err := s.db.Exec(q); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) PutExtRoom(r ExtRoom) error {
	_, err := s.db.Exec(`INSERT INTO ext_rooms (room, title, owner, link, created, expires) VALUES (?, ?, ?, ?, ?, ?)`, r.Room, r.Title, r.Owner, r.Link, r.Created, r.Expires)
	return err
}

func (s *Store) extRoom(where string, arg any) (*ExtRoom, error) {
	var r ExtRoom
	err := s.db.QueryRow(`SELECT room, title, owner, link, created, expires, revoked FROM ext_rooms WHERE `+where+` = ?`, arg).
		Scan(&r.Room, &r.Title, &r.Owner, &r.Link, &r.Created, &r.Expires, &r.Revoked)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &r, err
}

// ExtRoomIDs: every room open to people outside, so clients can mark them.
func (s *Store) ExtRoomIDs() ([]string, error) {
	rows, err := s.db.Query(`SELECT room FROM ext_rooms`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var r string
		if err := rows.Scan(&r); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *Store) ExtRoom(room string) (*ExtRoom, error)       { return s.extRoom("room", room) }
func (s *Store) ExtRoomByLink(link string) (*ExtRoom, error) { return s.extRoom("link", link) }

// SetExtLink: a new link and expiry, open again; the old link stops working.
func (s *Store) SetExtLink(room, link string, expires int64) error {
	_, err := s.db.Exec(`UPDATE ext_rooms SET link = ?, expires = ?, revoked = 0 WHERE room = ?`, link, expires, room)
	return err
}

func (s *Store) RevokeExtLink(room string) error {
	_, err := s.db.Exec(`UPDATE ext_rooms SET revoked = 1 WHERE room = ?`, room)
	return err
}

func (s *Store) PutGuest(g Guest) error {
	_, err := s.db.Exec(`INSERT INTO ext_guests (id, room, name, nick, token, joined) VALUES (?, ?, ?, ?, ?, ?)`, g.ID, g.Room, g.Name, g.Nick, g.Token, g.Joined)
	return err
}

const guestCols = `id, room, name, nick, token, joined, removed`

func scanGuest(row interface{ Scan(...any) error }) (*Guest, error) {
	var g Guest
	err := row.Scan(&g.ID, &g.Room, &g.Name, &g.Nick, &g.Token, &g.Joined, &g.Removed)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &g, err
}

func (s *Store) GuestByToken(token string) (*Guest, error) {
	return scanGuest(s.db.QueryRow(`SELECT `+guestCols+` FROM ext_guests WHERE token = ?`, token))
}

func (s *Store) Guest(id string) (*Guest, error) {
	return scanGuest(s.db.QueryRow(`SELECT `+guestCols+` FROM ext_guests WHERE id = ?`, id))
}

// Guests of a room, the removed ones too, in the order they joined.
func (s *Store) Guests(room string) ([]Guest, error) {
	rows, err := s.db.Query(`SELECT `+guestCols+` FROM ext_guests WHERE room = ? ORDER BY joined`, room)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Guest
	for rows.Next() {
		g, err := scanGuest(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *g)
	}
	return out, rows.Err()
}

func (s *Store) RemoveGuest(id string) error {
	_, err := s.db.Exec(`UPDATE ext_guests SET removed = 1 WHERE id = ?`, id)
	return err
}
