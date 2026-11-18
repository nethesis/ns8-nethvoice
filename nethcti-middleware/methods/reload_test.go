/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package methods

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/nethesis/nethcti-middleware/logs"
	"github.com/nethesis/nethcti-middleware/store"
)

func writeTempFile(t *testing.T, name, content string) string {
	t.Helper()
	tmp := t.TempDir()
	p := filepath.Join(tmp, name)
	if err := os.WriteFile(p, []byte(content), 0o644); err != nil {
		t.Fatalf("failed to write temp file: %v", err)
	}
	return p
}

func TestAdminReloadProfilesEndpoint(t *testing.T) {
	logs.Init("nethcti-test")

	gin.SetMode(gin.TestMode)

	// initial profiles/users
	profiles1 := `{
        "a": {"id":"a","name":"Alpha","macro_permissions": {"phonebook": {"value": true, "permissions": [{"id":"p","name":"ad_phonebook","value":false}]}}}
    }`
	users1 := `{
        "u1": {"profile_id":"a"}
    }`

	profFile := writeTempFile(t, "profiles.json", profiles1)
	usersFile := writeTempFile(t, "users.json", users1)

	if err := store.InitProfiles(profFile, usersFile); err != nil {
		t.Fatalf("InitProfiles failed: %v", err)
	}

	// verify initial capability is false
	caps, err := store.GetUserCapabilities("u1")
	if err != nil {
		t.Fatalf("GetUserCapabilities failed: %v", err)
	}
	if val, ok := caps["phonebook.ad_phonebook"]; !ok || val {
		t.Fatalf("unexpected initial capability value: %v", caps)
	}

	// overwrite files with new profile where capability toggles to true
	profiles2 := `{
        "a": {"id":"a","name":"Alpha","macro_permissions": {"phonebook": {"value": true, "permissions": [{"id":"p","name":"ad_phonebook","value":true}]}}}
    }`
	users2 := users1

	if err := os.WriteFile(profFile, []byte(profiles2), 0o644); err != nil {
		t.Fatalf("failed to write updated profiles: %v", err)
	}
	if err := os.WriteFile(usersFile, []byte(users2), 0o644); err != nil {
		t.Fatalf("failed to write users file: %v", err)
	}

	// create router and register endpoint
	router := gin.New()
	router.POST("/admin/reload/profiles", AdminReloadProfiles)

	// call endpoint
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/admin/reload/profiles", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 from AdminReloadProfiles, got %d: %s", w.Code, w.Body.String())
	}

	// verify capability updated after reload
	caps2, err := store.GetUserCapabilities("u1")
	if err != nil {
		t.Fatalf("GetUserCapabilities after reload failed: %v", err)
	}
	if val, ok := caps2["phonebook.ad_phonebook"]; !ok || !val {
		t.Fatalf("expected capability phonebook.ad_phonebook=true after reload, got %v", caps2)
	}
}
