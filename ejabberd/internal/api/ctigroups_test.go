package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/store"
)

// A cti- room someone made first (it has an owner) is destroyed and made again with the group's members.
func TestSyncRoomTakesBackSquattedRoom(t *testing.T) {
	var mu sync.Mutex
	var calls []string
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cmd := strings.TrimPrefix(r.URL.Path, "/")
		mu.Lock()
		calls = append(calls, cmd)
		mu.Unlock()
		if cmd == "get_room_affiliations" {
			w.Write([]byte(`[{"jid":"mallory@chat.internal","affiliation":"owner"},{"jid":"mario@chat.internal","affiliation":"member"}]`))
			return
		}
		w.Write([]byte(`0`))
	}))
	defer api.Close()
	st, err := store.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	s := &Server{Host: "chat.internal", EjabberdAPI: api.URL, Store: st}
	if !s.syncRoom(context.Background(), "sales", "Sales", map[string]bool{"mario": true}, map[string]string{}) {
		t.Fatal("sync failed")
	}
	got := strings.Join(calls, ",")
	if !strings.HasPrefix(got, "get_room_affiliations,destroy_room,create_room_with_opts") {
		t.Errorf("calls = %s", got)
	}
}
