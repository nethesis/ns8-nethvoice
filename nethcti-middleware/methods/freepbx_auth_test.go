/*
 * Copyright (C) 2026 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package methods

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/nethesis/nethcti-middleware/configuration"
)

func TestSupportUsernameRegex(t *testing.T) {
	valid := []string{"support-neth-2239-7d37", "support-abcdefgh", "support-1"}
	invalid := []string{
		"support-", "admin", "Support-abc", "support-ABC", "support-a b",
		"support-a'--", "support-a\nb", "xsupport-abc", "support-a_b",
		"support-" + string(make([]byte, 65)),
	}
	for _, u := range valid {
		if !supportUsernameRe.MatchString(u) {
			t.Errorf("expected %q to be valid", u)
		}
	}
	for _, u := range invalid {
		if supportUsernameRe.MatchString(u) {
			t.Errorf("expected %q to be invalid", u)
		}
	}
}

func TestSecretKeyMatches(t *testing.T) {
	key := computeFreePBXSecretKey("support-a", "hash", "secret")
	if !secretKeyMatches(key, key) {
		t.Error("expected matching key to pass")
	}
	if secretKeyMatches(computeFreePBXSecretKey("support-a", "hash", "other"), key) {
		t.Error("expected different key to fail")
	}
	if secretKeyMatches("", "") {
		t.Error("expected empty expected key to fail")
	}
}

func newSupportContext(user, secretKey, ip string) *gin.Context {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/freepbx/extensions", nil)
	c.Request.RemoteAddr = ip + ":1234"
	c.Request.Header.Set("User", user)
	c.Request.Header.Set("Secretkey", secretKey)
	return c
}

func TestRewriteSupportToAdmin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	origSecret := configuration.Config.NethVoiceSecretKey
	origSupport, origAdmin := lookupSupportUserSHA1, lookupAdminSHA1
	defer func() {
		configuration.Config.NethVoiceSecretKey = origSecret
		lookupSupportUserSHA1, lookupAdminSHA1 = origSupport, origAdmin
	}()

	configuration.Config.NethVoiceSecretKey = "secret"
	lookups := 0
	lookupSupportUserSHA1 = func(u string) (string, error) {
		lookups++
		if u == "support-neth-1-2" {
			return "a94a8fe5ccb19ba61c4c0873d391e987982fbbd3", nil
		}
		if u == "support-neth-empty" {
			return "", nil
		}
		return "", errUserNotFound
	}
	lookupAdminSHA1 = func() (string, error) { return "adminhash", nil }

	good := computeFreePBXSecretKey("support-neth-1-2", "a94a8fe5ccb19ba61c4c0873d391e987982fbbd3", "secret")

	c := newSupportContext("support-neth-1-2", good, "192.0.2.1")
	if !RewriteSupportToAdmin(c) {
		t.Fatal("expected valid support user to be rewritten")
	}
	if c.Request.Header.Get("User") != "admin" ||
		c.Request.Header.Get("Secretkey") != computeFreePBXSecretKey("admin", "adminhash", "secret") {
		t.Error("expected admin credentials after rewrite")
	}

	lookups = 0
	if RewriteSupportToAdmin(newSupportContext("support-x' OR 1=1 --", good, "192.0.2.2")) {
		t.Error("expected malformed username to fail")
	}
	if lookups != 0 {
		t.Error("expected no DB lookup for malformed username")
	}

	if RewriteSupportToAdmin(newSupportContext("support-neth-empty", computeFreePBXSecretKey("support-neth-empty", "", "secret"), "192.0.2.5")) {
		t.Error("expected a row without a password hash to fail")
	}

	if RewriteSupportToAdmin(newSupportContext("support-neth-1-2", "bad", "192.0.2.3")) {
		t.Error("expected wrong Secretkey to fail")
	}

	configuration.Config.NethVoiceSecretKey = ""
	if RewriteSupportToAdmin(newSupportContext("support-neth-1-2", good, "192.0.2.4")) {
		t.Error("expected failure without NETHVOICESECRETKEY")
	}
}

func TestSupportAuthThrottled(t *testing.T) {
	ip, user := "198.51.100.7", "support-neth-0001"
	key := supportFailureKey(ip, user)
	defer clearSupportFailures(key)

	for i := 0; i < supportMaxFailures; i++ {
		if SupportAuthThrottled(ip, user) {
			t.Fatalf("throttled too early after %d failures", i)
		}
		recordSupportFailure(key)
	}
	if !SupportAuthThrottled(ip, user) {
		t.Error("expected user to be throttled from ip")
	}
	if SupportAuthThrottled("198.51.100.8", user) {
		t.Error("expected other ip not to be throttled")
	}
	if SupportAuthThrottled(ip, "support-neth-0002") {
		t.Error("expected other support user behind the same proxy not to be throttled")
	}

	supportFailuresMu.Lock()
	supportFailures[key].first = supportFailures[key].first.Add(-supportFailureWindow - 1)
	supportFailuresMu.Unlock()
	if SupportAuthThrottled(ip, user) {
		t.Error("expected throttling to expire after the window")
	}
}

func resetSupportFailures(t *testing.T) {
	t.Helper()
	supportFailuresMu.Lock()
	supportFailures = make(map[string]*supportFailure)
	supportFailuresMu.Unlock()
	t.Cleanup(func() {
		supportFailuresMu.Lock()
		supportFailures = make(map[string]*supportFailure)
		supportFailuresMu.Unlock()
	})
}

func TestMalformedSupportUserNotTracked(t *testing.T) {
	gin.SetMode(gin.TestMode)
	resetSupportFailures(t)
	origSecret := configuration.Config.NethVoiceSecretKey
	defer func() { configuration.Config.NethVoiceSecretKey = origSecret }()
	configuration.Config.NethVoiceSecretKey = "secret"

	for i := 0; i < 100; i++ {
		user := fmt.Sprintf("support-%d-%s", i, strings.Repeat("X", 4096))
		if RewriteSupportToAdmin(newSupportContext(user, "key", "192.0.2.9")) {
			t.Fatal("expected malformed username to fail")
		}
	}
	if n := len(supportFailures); n != 0 {
		t.Errorf("expected no tracked failures for malformed usernames, got %d", n)
	}
}

func TestSupportFailuresBounded(t *testing.T) {
	resetSupportFailures(t)

	for i := 0; i < supportMaxTracked+500; i++ {
		recordSupportFailure(supportFailureKey("192.0.2.10", fmt.Sprintf("support-%d", i)))
	}
	if n := len(supportFailures); n != supportMaxTracked {
		t.Errorf("expected %d tracked failures, got %d", supportMaxTracked, n)
	}

	full := supportFailureKey("192.0.2.10", "support-0")
	for i := 0; i < supportMaxFailures; i++ {
		recordSupportFailure(full)
	}
	if !supportThrottled(full) {
		t.Error("expected an already tracked key to keep counting when full")
	}

	supportFailuresMu.Lock()
	for _, f := range supportFailures {
		f.first = f.first.Add(-supportFailureWindow - time.Second)
	}
	supportFailuresMu.Unlock()
	fresh := supportFailureKey("192.0.2.11", "support-new")
	recordSupportFailure(fresh)
	if _, ok := supportFailures[fresh]; !ok || len(supportFailures) != 1 {
		t.Errorf("expected expired entries pruned to make room, got %d", len(supportFailures))
	}
}
