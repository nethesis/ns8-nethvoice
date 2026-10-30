package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

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

func TestIPKey(t *testing.T) {
	cases := map[string]string{
		"198.51.100.2":         "198.51.100.2",
		"2001:db8:1:2:3:4:5:6": "2001:db8:1:2::/64",
		"2001:db8:1:2:ffff::1": "2001:db8:1:2::/64",
		"not an address":       "not an address",
	}
	for in, want := range cases {
		if got := ipKey(in); got != want {
			t.Errorf("ipKey(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestWindowSweep(t *testing.T) {
	w := &window{}
	w.add("a")
	w.m["old"] = []time.Time{time.Now().Add(-2 * time.Minute)}
	w.swept = time.Now().Add(-2 * time.Minute)
	w.add("b")
	if _, ok := w.m["old"]; ok {
		t.Error("a key past its minute stayed")
	}
	if w.count("a") != 1 || w.count("b") != 1 {
		t.Error("recent keys lost")
	}
}

func TestGuestFileOK(t *testing.T) {
	ok := [][2]string{{"photo.jpg", "image/jpeg"}, {"note.m4a", "audio/mp4"}, {"doc.pdf", "application/pdf"}, {"a.txt", "text/plain"}}
	bad := [][2]string{{"x.html", "text/plain"}, {"x.png", "text/html"}, {"x.svg", "image/svg+xml"}, {"x.SVG", ""}, {"x.js", "application/octet-stream"}, {"x", "application/xhtml+xml"}}
	for _, c := range ok {
		if !guestFileOK(c[0], c[1]) {
			t.Errorf("%v refused", c)
		}
	}
	for _, c := range bad {
		if guestFileOK(c[0], c[1]) {
			t.Errorf("%v accepted", c)
		}
	}
}
