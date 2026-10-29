package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

func ctiConfig(t *testing.T, users map[string]string) string {
	dir := t.TempDir()
	u := map[string]map[string]string{}
	for name, profile := range users {
		u[name] = map[string]string{"profile_id": profile}
	}
	b, _ := json.Marshal(u)
	os.WriteFile(filepath.Join(dir, "users.json"), b, 0o644)
	os.WriteFile(filepath.Join(dir, "profiles.json"), []byte(`{
		"1": {"macro_permissions": {"nethvoice_cti": {"value": true, "permissions": [{"id": "8", "name": "chat", "value": false}]}}},
		"3": {"macro_permissions": {"nethvoice_cti": {"value": true, "permissions": [{"id": "8", "name": "chat", "value": true}]}}}}`), 0o644)
	return dir
}

func kicks(t *testing.T, cfg string, online []string) []string {
	var mu sync.Mutex
	var kicked []string
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch strings.TrimPrefix(r.URL.Path, "/") {
		case "connected_users":
			json.NewEncoder(w).Encode(online)
		case "kick_user":
			var a map[string]string
			json.NewDecoder(r.Body).Decode(&a)
			mu.Lock()
			kicked = append(kicked, a["user"])
			mu.Unlock()
			w.Write([]byte("1"))
		}
	}))
	defer api.Close()
	(&Server{Host: "chat.internal", EjabberdAPI: api.URL, CTIConfig: cfg}).KickRevoked(context.Background())
	return kicked
}

func TestKickRevoked(t *testing.T) {
	cfg := ctiConfig(t, map[string]string{"mario": "3", "luigi": "1", "anna": "3", "pia": "3", "ugo": "3"})
	online := []string{"mario@chat.internal/a", "luigi@chat.internal/b", "gone@chat.internal/c", "anna@chat.internal/d", "pia@chat.internal/e", "ugo@chat.internal/f", "g~0123456789ab@chat.internal/g"}
	got := strings.Join(kicks(t, cfg, online), ",")
	if got != "luigi,gone" && got != "gone,luigi" {
		t.Errorf("kicked %q, want luigi (no chat) and gone (not in the CTI); never a guest", got)
	}
	// Most of who is online at once: a configuration being rewritten, nobody is kicked.
	if k := kicks(t, ctiConfig(t, map[string]string{"x": "1", "y": "1", "z": "1"}), []string{"x@chat.internal/1", "y@chat.internal/1", "z@chat.internal/1"}); len(k) != 0 {
		t.Errorf("kicked %v with every profile changed at once", k)
	}
	// Unreadable configuration: nothing.
	if k := kicks(t, t.TempDir(), online); len(k) != 0 {
		t.Errorf("kicked %v without a configuration", k)
	}
}
