/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package methods

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/nethesis/nethcti-middleware/configuration"
	"github.com/nethesis/nethcti-middleware/store"
)

func TestBuildUserJWTClaimsInjectsProfileMetadataWithoutCapabilities(t *testing.T) {
	origSecretsDir := configuration.Config.SecretsDir
	t.Cleanup(func() {
		configuration.Config.SecretsDir = origSecretsDir
	})

	secretsDir := t.TempDir()
	configuration.Config.SecretsDir = secretsDir

	username := "claims-user"
	statusPath := filepath.Join(secretsDir, username, "status")
	if err := os.MkdirAll(filepath.Dir(statusPath), 0o700); err != nil {
		t.Fatalf("failed to create user secrets dir: %v", err)
	}
	if err := os.WriteFile(statusPath, []byte("1"), 0o600); err != nil {
		t.Fatalf("failed to write 2fa status file: %v", err)
	}

	profilesJSON := `{
		"p1": {"id":"p1","name":"Power","macro_permissions": {
			"phonebook": {"value": true, "permissions": [{"id":"1","name":"ad_phonebook","value":true}]}
		}}
	}`
	usersJSON := `{
		"claims-user": {"profile_id":"p1"}
	}`

	profFile := writeTempFile(t, "profiles.json", profilesJSON)
	usersFile := writeTempFile(t, "users.json", usersJSON)
	if err := store.InitProfiles(profFile, usersFile); err != nil {
		t.Fatalf("InitProfiles failed: %v", err)
	}

	now := time.Now()
	claims := BuildUserJWTClaims(UserJWTOptions{
		Username:    username,
		OTPVerified: true,
		IssuedAt:    now,
	})

	if got := claims["id"]; got != username {
		t.Fatalf("unexpected id claim: got %v want %s", got, username)
	}
	if got := claims["2fa"]; got != true {
		t.Fatalf("unexpected 2fa claim: got %v want true", got)
	}
	if got := claims["otp_verified"]; got != true {
		t.Fatalf("unexpected otp_verified claim: got %v want true", got)
	}
	if got := claims["profile_id"]; got != "p1" {
		t.Fatalf("unexpected profile_id claim: got %v want p1", got)
	}
	if got := claims["iat"]; got != now.Unix() {
		t.Fatalf("unexpected iat claim: got %v want %d", got, now.Unix())
	}
	if _, ok := claims["phonebook"]; ok {
		t.Fatalf("phonebook macro claim should not be present in JWT")
	}
	if _, ok := claims["phonebook.ad_phonebook"]; ok {
		t.Fatalf("phonebook.ad_phonebook claim should not be present in JWT")
	}
}

func TestBuildUserJWTClaimsWithoutProfileReturnsBaseClaims(t *testing.T) {
	origSecretsDir := configuration.Config.SecretsDir
	t.Cleanup(func() {
		configuration.Config.SecretsDir = origSecretsDir
	})

	configuration.Config.SecretsDir = t.TempDir()
	now := time.Now()
	claims := BuildUserJWTClaims(UserJWTOptions{
		Username:    "missing-user",
		OTPVerified: false,
		IssuedAt:    now,
	})

	if got := claims["id"]; got != "missing-user" {
		t.Fatalf("unexpected id claim: got %v want missing-user", got)
	}
	if got := claims["2fa"]; got != false {
		t.Fatalf("unexpected 2fa claim: got %v want false", got)
	}
	if got := claims["otp_verified"]; got != false {
		t.Fatalf("unexpected otp_verified claim: got %v want false", got)
	}
	if got := claims["iat"]; got != now.Unix() {
		t.Fatalf("unexpected iat claim: got %v want %d", got, now.Unix())
	}

	if _, ok := claims["profile_id"]; ok {
		t.Fatalf("profile_id should not be present for missing profile")
	}
	if _, ok := claims["phonebook.ad_phonebook"]; ok {
		t.Fatalf("capability claims should not be present for missing profile")
	}
}
