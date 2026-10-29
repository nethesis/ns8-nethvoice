package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/cti"
)

// A token's check is asked once a minute, refused or not, with the client's address.
func TestWhoAmICacheAndClient(t *testing.T) {
	var calls atomic.Int32
	var seen atomic.Value
	mw := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		seen.Store(r.Header.Get("X-Forwarded-For"))
		if r.Header.Get("Authorization") != "Bearer good" {
			w.WriteHeader(401)
			return
		}
		w.Write([]byte(`{"username":"mario","profile":{"macro_permissions":{"nethvoice_cti":{"permissions":{"chat":{"value":true}}}}}}`))
	}))
	defer mw.Close()
	m := NewMiddleware(mw.URL)
	ctx := cti.WithClient(context.Background(), "203.0.113.7")
	for i := 0; i < 3; i++ {
		if u, err := m.WhoAmI(ctx, "good"); u != "mario" || err != nil {
			t.Fatalf("good token: %q %v", u, err)
		}
		if _, err := m.WhoAmI(ctx, "bad"); err == nil {
			t.Fatal("bad token accepted")
		}
	}
	if calls.Load() != 2 {
		t.Errorf("middleware asked %d times, want 2", calls.Load())
	}
	if seen.Load() != "203.0.113.7" {
		t.Errorf("X-Forwarded-For = %v", seen.Load())
	}
}

func TestClientIP(t *testing.T) {
	r := httptest.NewRequest("GET", "/", nil)
	r.RemoteAddr = "127.0.0.1:5000"
	if ip := clientIP(r); ip != "127.0.0.1" {
		t.Errorf("no header: %q", ip)
	}
	r.Header.Set("X-Forwarded-For", "10.0.0.1, 198.51.100.2")
	if ip := clientIP(r); ip != "198.51.100.2" {
		t.Errorf("forwarded: %q", ip)
	}
}
