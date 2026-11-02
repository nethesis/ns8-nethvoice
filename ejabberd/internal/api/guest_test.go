package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/store"
)

func TestGuestNick(t *testing.T) {
	taken := map[string]bool{"Mario Rossi": true, "Mario Rossi 2": true}
	for in, want := range map[string]string{"Mario Rossi": "Mario Rossi 3", "Anna": "Anna", "mario": "mario ·", "edoardo.s": "edoardo.s ·"} {
		if got := guestNick(in, taken); got != want {
			t.Errorf("guestNick(%q) = %q, want %q", in, got, want)
		}
	}
	if !IsGuest("g~0123456789ab@chat.internal") || IsGuest("edoardo@chat.internal") || IsGuest("gianni") || IsGuest("g.rossi") {
		t.Error("IsGuest")
	}
}

func TestGuestName(t *testing.T) {
	for in, want := range map[string]string{"  Mario   Rossi ": "Mario Rossi", "ACME; srl=x": "ACME; srl=x"} {
		if got, ok := guestName(in); !ok || got != want {
			t.Errorf("guestName(%q) = %q, %v", in, got, ok)
		}
	}
	for _, in := range []string{"", "   ", "a\x00b", "a\u202eb", "a\u200bb", string(make([]rune, 65))} {
		if _, ok := guestName(in); ok {
			t.Errorf("guestName(%q) accepted", in)
		}
	}
}

// A room with guests that ejabberd no longer has loses its link and guests; one still there keeps them.
func TestDropGoneExtRooms(t *testing.T) {
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var args map[string]string
		_ = json.NewDecoder(r.Body).Decode(&args)
		if args["room"] == "g-gone" {
			http.Error(w, `"The room does not exist."`, http.StatusBadRequest)
			return
		}
		w.Write([]byte(`[]`))
	}))
	defer api.Close()
	st, err := store.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	for _, room := range []string{"g-gone", "g-here"} {
		if err := st.PutExtRoom(store.ExtRoom{Room: room, Title: room, Owner: "mario", Link: "link-" + room}); err != nil {
			t.Fatal(err)
		}
		if err := st.PutGuest(store.Guest{ID: "g~" + room, Room: room, Name: "Ada", Nick: "Ada", Token: "token-" + room}); err != nil {
			t.Fatal(err)
		}
	}
	s := &Server{Host: "chat.internal", EjabberdAPI: api.URL, Store: st}
	s.DropGoneExtRooms(context.Background())
	if e, _ := st.ExtRoom("g-gone"); e != nil {
		t.Error("gone room kept")
	}
	if g, _ := st.Guests("g-gone"); len(g) != 0 {
		t.Errorf("gone room's guests kept: %v", g)
	}
	if e, _ := st.ExtRoom("g-here"); e == nil {
		t.Error("live room dropped")
	}
	if g, _ := st.Guests("g-here"); len(g) != 1 {
		t.Errorf("live room's guests = %v", g)
	}
}
