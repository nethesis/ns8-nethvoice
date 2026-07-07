/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package store

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
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

func TestInitProfilesAndGetters(t *testing.T) {
	profilesJSON := `{
        "1": {"id":"1","name":"Base","macro_permissions": {"phonebook": {"value": true, "permissions": [{"id":"12","name":"ad_phonebook","value":false}]}}},
        "3": {"id":"3","name":"Advanced","macro_permissions": {"phonebook": {"value": true, "permissions": [{"id":"12","name":"ad_phonebook","value":true}]}}}
    }`

	usersJSON := `{
        "giacomo": {"name":"Giacomo","endpoints":{"mainextension":{"201":{}},"extension":{"201":{"type":"webrtc","user":"201","password":"x"},"91201":{"type":"mobile","user":"91201","password":"y"}}},"profile_id":"3"},
        "sample": {"profile_id":"1"}
    }`

	profFile := writeTempFile(t, "profiles.json", profilesJSON)
	usersFile := writeTempFile(t, "users.json", usersJSON)

	if err := InitProfiles(profFile, usersFile); err != nil {
		t.Fatalf("InitProfiles failed: %v", err)
	}

	caps, err := GetUserCapabilities("giacomo")
	if err != nil {
		t.Fatalf("GetUserCapabilities failed: %v", err)
	}
	if got, want := caps["phonebook.ad_phonebook"], true; got != want {
		t.Fatalf("unexpected capability value: got %v want %v", got, want)
	}

	prof, err := GetUserProfile("sample")
	if err != nil {
		t.Fatalf("GetUserProfile failed: %v", err)
	}
	if prof.ID != "1" {
		t.Fatalf("unexpected profile id: got %s want %s", prof.ID, "1")
	}

	displayName, phoneNumbers, err := GetUserDisplayInfo("giacomo")
	if err != nil {
		t.Fatalf("GetUserDisplayInfo failed: %v", err)
	}
	if displayName != "Giacomo" {
		t.Fatalf("unexpected display name: got %s want %s", displayName, "Giacomo")
	}
	if len(phoneNumbers) != 2 {
		t.Fatalf("unexpected phone numbers count: got %d want %d", len(phoneNumbers), 2)
	}
}

func TestMissingProfileReference(t *testing.T) {
	profilesJSON := `{ "1": {"id":"1","name":"Base","macro_permissions": {}} }`
	usersJSON := `{ "baduser": {"profile_id":"999"} }`

	profFile := writeTempFile(t, "profiles.json", profilesJSON)
	usersFile := writeTempFile(t, "users.json", usersJSON)

	// InitProfiles should return an error since user references unknown profile
	if err := InitProfiles(profFile, usersFile); err == nil {
		t.Fatalf("expected InitProfiles to fail for unknown profile reference")
	}
}

func TestReloadProfiles_PartialFailures(t *testing.T) {
	// Start with valid profiles and users
	profilesJSON := `{
        "1": {"id":"1","name":"Base","macro_permissions": {}},
        "2": {"id":"2","name":"Standard","macro_permissions": {}}
    }`
	usersJSON := `{
        "alice": {"profile_id":"1"},
        "bob": {"profile_id":"2"}
    }`

	profFile := writeTempFile(t, "profiles.json", profilesJSON)
	usersFile := writeTempFile(t, "users.json", usersJSON)

	if err := InitProfiles(profFile, usersFile); err != nil {
		t.Fatalf("InitProfiles failed: %v", err)
	}

	// Now replace profiles with an invalid JSON to simulate profiles reload failure
	if err := os.WriteFile(profFile, []byte(`{ invalid json `), 0o644); err != nil {
		t.Fatalf("failed to corrupt profiles file: %v", err)
	}

	// Users file remains valid; reload should NOT return an error
	// (current behavior: it logs the profiles error but keeps previous data)
	if _, err := ReloadProfiles(); err != nil {
		t.Fatalf("unexpected error from ReloadProfiles when only profiles reload fails: %v", err)
	}

	// Verify that previous users are still accessible
	if _, err := GetUserProfile("alice"); err != nil {
		t.Fatalf("expected existing user profile to remain after partial reload failure: %v", err)
	}

	// Now restore profiles to valid content but corrupt users to simulate users reload failure
	if err := os.WriteFile(profFile, []byte(profilesJSON), 0o644); err != nil {
		t.Fatalf("failed to restore profiles file: %v", err)
	}
	if err := os.WriteFile(usersFile, []byte(`{ bad json `), 0o644); err != nil {
		t.Fatalf("failed to corrupt users file: %v", err)
	}

	// Reload should NOT return an error when only users reload fails
	if _, err := ReloadProfiles(); err != nil {
		t.Fatalf("unexpected error from ReloadProfiles when only users reload fails: %v", err)
	}

	// Ensure profile data still available
	if _, err := GetUserCapabilities("bob"); err != nil {
		t.Fatalf("expected existing capabilities to remain after users reload failure: %v", err)
	}
}

func TestReloadProfiles_Concurrent(t *testing.T) {
	// Prepare valid profiles and users
	profilesJSON := `{
        "1": {"id":"1","name":"Base","macro_permissions": {"phonebook": {"value": true, "permissions": [{"id":"12","name":"ad_phonebook","value":true}]}}},
        "2": {"id":"2","name":"Standard","macro_permissions": {"phonebook": {"value": true, "permissions": [{"id":"12","name":"ad_phonebook","value":false}]}}}
    }`
	usersJSON := `{
        "alice": {"profile_id":"1"},
        "bob": {"profile_id":"2"}
    }`

	profFile := writeTempFile(t, "profiles.json", profilesJSON)
	usersFile := writeTempFile(t, "users.json", usersJSON)

	if err := InitProfiles(profFile, usersFile); err != nil {
		t.Fatalf("InitProfiles failed: %v", err)
	}

	// Run many concurrent reloads and lookups
	done := make(chan struct{})

	// Start a goroutine that continuously reloads profiles
	go func() {
		for i := 0; i < 200; i++ {
			if _, err := ReloadProfiles(); err != nil {
				// test should not fail just because one reload had parse errors; continue
			}
		}
		close(done)
	}()

	// Concurrently perform lookups while reloads happen
	for i := 0; i < 200; i++ {
		if _, err := GetUserCapabilities("alice"); err != nil {
			t.Fatalf("GetUserCapabilities failed during concurrent reloads: %v", err)
		}
		if _, err := GetUserProfile("bob"); err != nil {
			t.Fatalf("GetUserProfile failed during concurrent reloads: %v", err)
		}
	}

	<-done
}

func TestInitProfiles_UsesEmbeddedDefaults(t *testing.T) {
	// Parse the embedded default profiles to pick a valid profile id
	var raw map[string]*rawProfile
	if err := json.Unmarshal([]byte(defaultProfilesJSON), &raw); err != nil {
		t.Fatalf("failed to unmarshal embedded profiles: %v", err)
	}

	var anyKey string
	var anyProfileID string
	for k, rp := range raw {
		anyKey = k
		if rp.ID != "" {
			anyProfileID = rp.ID
		} else {
			anyProfileID = k
		}
		break
	}

	if anyKey == "" {
		t.Fatalf("embedded profiles appear empty")
	}

	// Create a users file that references the embedded profile id
	usersJSON := `{"embedded_user": {"profile_id":"` + anyProfileID + `"}}`
	usersFile := writeTempFile(t, "users.json", usersJSON)

	// Provide a non-existent profiles path so loadProfiles falls back to embedded JSON
	profFile := filepath.Join(t.TempDir(), "does-not-exist.json")

	if err := InitProfiles(profFile, usersFile); err != nil {
		t.Fatalf("InitProfiles with embedded defaults failed: %v", err)
	}

	prof, err := GetUserProfile("embedded_user")
	if err != nil {
		t.Fatalf("GetUserProfile failed for embedded_user: %v", err)
	}
	if prof.ID != anyProfileID {
		t.Fatalf("unexpected profile id from embedded defaults: got %s want %s", prof.ID, anyProfileID)
	}
}

func TestLoadProfiles_FallbackPopulatesProfiles(t *testing.T) {
	// Call loadProfiles with a missing file path and verify profiles are populated
	missing := filepath.Join(t.TempDir(), "no-such-file.json")
	if _, err := loadProfiles(missing); err != nil {
		t.Fatalf("loadProfiles failed when falling back to embedded defaults: %v", err)
	}

	profileMutex.RLock()
	got := len(profiles)
	profileMutex.RUnlock()

	if got == 0 {
		t.Fatalf("expected embedded defaults to populate profiles, found %d", got)
	}
}
