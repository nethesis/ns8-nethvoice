/*
 * Copyright (C) 2026 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package methods

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"

	"github.com/nethesis/nethcti-middleware/configuration"
	"github.com/nethesis/nethcti-middleware/models"
	"github.com/nethesis/nethcti-middleware/store"
)

const testInternalSecret = "test-super-admin-token"

// mockInternalV1 simulates the nethcti-server internal login: only the
// "room101" user is minted, and only with the right secret and token key.
func mockInternalV1(t *testing.T) {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/webrest/authentication/login":
			var body map[string]string
			json.NewDecoder(r.Body).Decode(&body)
			if r.Header.Get("X-Internal-User") == "room101" && r.Header.Get("X-Internal-Secret") == testInternalSecret &&
				body["password"] == internalTokenKey(testInternalSecret) {
				w.Header().Set("Www-Authenticate", "Digest nonce123")
			}
			w.WriteHeader(http.StatusUnauthorized)
		case "/webrest/user/me":
			if strings.HasPrefix(r.Header.Get("Authorization"), "room101:") {
				w.Write([]byte(`{"username":"room101"}`))
				return
			}
			w.WriteHeader(http.StatusUnauthorized)
		case "/webrest/authentication/phone_island_token_login":
			w.Write([]byte(`{"token":"v1-persistent"}`))
		case "/webrest/authentication/persistent_token_remove":
			w.WriteHeader(http.StatusOK)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)

	configuration.Config.V1Protocol = "http"
	configuration.Config.V1ApiEndpoint = strings.TrimPrefix(srv.URL, "http://")
	configuration.Config.V1ApiPath = "/webrest"
}

func setupAdminTest(t *testing.T) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	configuration.Config.Secret_jwt = "test-secret-jwt"
	configuration.Config.SecretsDir = t.TempDir()
	configuration.Config.SuperAdminToken = ""
	configuration.Config.SuperAdminTokenGenerated = false
	store.UserSessions = map[string]*models.UserSession{}
	mockInternalV1(t)

	// configured users: the admin POST accepts only these exact usernames
	profiles := writeTempFile(t, "profiles.json", `{"p":{"id":"p","name":"P","macro_permissions":{}}}`)
	users := writeTempFile(t, "users.json", `{"alice":{"profile_id":"p"},"room101":{"profile_id":"p"},"someone":{"profile_id":"p"}}`)
	require.NoError(t, store.InitProfiles(profiles, users))
}

func adminRequest(t *testing.T, method, path string) *httptest.ResponseRecorder {
	t.Helper()
	router := gin.New()
	router.GET("/admin/tokens/persistent/:username/:audience", AdminCheckPersistentToken)
	router.POST("/admin/tokens/persistent/:username/:audience", AdminCreatePersistentToken)
	router.DELETE("/admin/tokens/persistent/:username/:audience", AdminRemovePersistentToken)
	router.GET("/admin/2fa/:username", AdminGet2FAStatus)
	router.DELETE("/admin/2fa/:username", AdminDisable2FA)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(method, path, nil))
	return w
}

func decodeBody(t *testing.T, w *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var body map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	return body
}

func TestAdminPersistentTokenLifecycle(t *testing.T) {
	setupAdminTest(t)
	store.UserSessions["alice"] = &models.UserSession{
		Username:     "alice",
		NethCTIToken: "alice:legacy",
		JWTTokens: []string{
			"web-session-token",
			mustIssueTestToken(t, "alice", "mobile-app"),
			mustIssueTestToken(t, "alice", "nethlink"),
		},
	}

	w := adminRequest(t, http.MethodGet, "/admin/tokens/persistent/alice/mobile-app")
	require.Equal(t, http.StatusOK, w.Code)
	require.Equal(t, true, decodeBody(t, w)["exists"])

	// Create rotates the existing mobile-app token and keeps the others
	w = adminRequest(t, http.MethodPost, "/admin/tokens/persistent/alice/mobile-app")
	require.Equal(t, http.StatusOK, w.Code)
	token, _ := decodeBody(t, w)["token"].(string)
	require.True(t, isIntegrationTokenForAudience(token, "alice", "mobile-app"))
	require.Len(t, store.UserSessions["alice"].JWTTokens, 3)
	require.Contains(t, store.UserSessions["alice"].JWTTokens, token)

	// Remove only the mobile-app token
	w = adminRequest(t, http.MethodDelete, "/admin/tokens/persistent/alice/mobile-app")
	require.Equal(t, http.StatusNoContent, w.Code)
	require.NotContains(t, store.UserSessions["alice"].JWTTokens, token)
	require.Len(t, store.UserSessions["alice"].JWTTokens, 2)

	w = adminRequest(t, http.MethodGet, "/admin/tokens/persistent/alice/mobile-app")
	require.Equal(t, false, decodeBody(t, w)["exists"])
	w = adminRequest(t, http.MethodGet, "/admin/tokens/persistent/alice/nethlink")
	require.Equal(t, true, decodeBody(t, w)["exists"])
}

func TestAdminRemoveAllTokens(t *testing.T) {
	setupAdminTest(t)
	store.UserSessions["alice"] = &models.UserSession{
		Username:     "alice",
		NethCTIToken: "alice:legacy",
		JWTTokens:    []string{"web-session-token", mustIssueTestToken(t, "alice", "phone-island")},
	}

	w := adminRequest(t, http.MethodDelete, "/admin/tokens/persistent/alice/all")
	require.Equal(t, http.StatusNoContent, w.Code)
	_, exists := store.UserSessions["alice"]
	require.False(t, exists, "the whole session must be removed")
}

func TestAdminRemoveWithoutSessionIsNoop(t *testing.T) {
	setupAdminTest(t)

	for _, audience := range []string{"mobile-app", "all"} {
		w := adminRequest(t, http.MethodDelete, "/admin/tokens/persistent/nobody/"+audience)
		require.Equal(t, http.StatusNoContent, w.Code, audience)
	}
}

func TestAdminTokenValidation(t *testing.T) {
	setupAdminTest(t)

	cases := []struct {
		method, path, message string
	}{
		{http.MethodGet, "/admin/tokens/persistent/alice/unknown", "invalid audience"},
		{http.MethodGet, "/admin/tokens/persistent/alice/all", "invalid audience"},
		{http.MethodPost, "/admin/tokens/persistent/alice/all", "invalid audience"},
		{http.MethodDelete, "/admin/tokens/persistent/alice/unknown", "invalid audience"},
		{http.MethodDelete, "/admin/tokens/persistent/..alice/all", "invalid username"},
		{http.MethodPost, "/admin/tokens/persistent/a..b/mobile-app", "invalid username"},
		{http.MethodPost, "/admin/tokens/persistent/alice@domain/mobile-app", "invalid username"},
		{http.MethodGet, "/admin/2fa/-alice", "invalid username"},
		{http.MethodDelete, "/admin/2fa/..", "invalid username"},
	}
	for _, tc := range cases {
		w := adminRequest(t, tc.method, tc.path)
		require.Equal(t, http.StatusBadRequest, w.Code, tc.method+" "+tc.path)
		require.Equal(t, tc.message, decodeBody(t, w)["message"], tc.method+" "+tc.path)
	}
}

func TestAdminCreateTokenWithoutSession(t *testing.T) {
	setupAdminTest(t)

	// Internal login not configured: the session cannot be created
	w := adminRequest(t, http.MethodPost, "/admin/tokens/persistent/room101/mobile-app")
	require.Equal(t, http.StatusServiceUnavailable, w.Code)

	// Token generated at startup: the V1 server does not know it
	configuration.Config.SuperAdminToken = testInternalSecret
	configuration.Config.SuperAdminTokenGenerated = true
	w = adminRequest(t, http.MethodPost, "/admin/tokens/persistent/room101/mobile-app")
	require.Equal(t, http.StatusServiceUnavailable, w.Code)
	configuration.Config.SuperAdminTokenGenerated = false

	// Not a configured user (e.g. an extension number used as alias)
	w = adminRequest(t, http.MethodPost, "/admin/tokens/persistent/201/mobile-app")
	require.Equal(t, http.StatusNotFound, w.Code)
	require.Nil(t, store.UserSessions["201"])

	// Unknown user: the V1 server refuses the internal login
	w = adminRequest(t, http.MethodPost, "/admin/tokens/persistent/someone/mobile-app")
	require.Equal(t, http.StatusNotFound, w.Code)
	require.Nil(t, store.UserSessions["someone"])

	// Known user: the session is created with an internal login (no SSO needed)
	w = adminRequest(t, http.MethodPost, "/admin/tokens/persistent/ROOM101/mobile-app")
	require.Equal(t, http.StatusOK, w.Code)
	token, _ := decodeBody(t, w)["token"].(string)
	require.True(t, isIntegrationTokenForAudience(token, "room101", "mobile-app"))

	session := store.UserSessions["room101"]
	require.NotNil(t, session)
	require.Equal(t, "room101:v1-persistent", session.NethCTIToken)
	require.Equal(t, []string{token}, session.JWTTokens)
}

func TestAdminCreateTokenRefusedWith2FA(t *testing.T) {
	setupAdminTest(t)
	store.UserSessions["alice"] = &models.UserSession{Username: "alice", NethCTIToken: "alice:legacy"}
	require.True(t, enable2FA("alice"))

	w := adminRequest(t, http.MethodPost, "/admin/tokens/persistent/alice/mobile-app")
	require.Equal(t, http.StatusConflict, w.Code)
	require.Empty(t, store.UserSessions["alice"].JWTTokens)
}

func TestAdminDisable2FA(t *testing.T) {
	setupAdminTest(t)
	userDir := filepath.Join(configuration.Config.SecretsDir, "alice")
	require.True(t, enable2FA("alice"))
	require.NoError(t, os.WriteFile(filepath.Join(userDir, "secret"), []byte("SECRET"), 0600))
	require.NoError(t, os.WriteFile(filepath.Join(userDir, "codes"), []byte("123456"), 0600))
	store.UserSessions["alice"] = &models.UserSession{
		Username:     "alice",
		NethCTIToken: "alice:legacy",
		JWTTokens:    []string{"web-session-token"},
		OTP_Verified: true,
	}

	w := adminRequest(t, http.MethodGet, "/admin/2fa/alice")
	require.Equal(t, http.StatusOK, w.Code)
	require.Equal(t, true, decodeBody(t, w)["status"])

	w = adminRequest(t, http.MethodDelete, "/admin/2fa/alice")
	require.Equal(t, http.StatusNoContent, w.Code)

	w = adminRequest(t, http.MethodGet, "/admin/2fa/alice")
	require.Equal(t, false, decodeBody(t, w)["status"])
	require.NoFileExists(t, filepath.Join(userDir, "secret"))
	require.NoFileExists(t, filepath.Join(userDir, "codes"))
	_, exists := store.UserSessions["alice"]
	require.False(t, exists, "all the user sessions must be invalidated")

	// A user that never enabled 2FA: nothing to do
	w = adminRequest(t, http.MethodDelete, "/admin/2fa/bob")
	require.Equal(t, http.StatusNoContent, w.Code)
}

func TestAdminCreateTokenFailsClosedOn2FAReadError(t *testing.T) {
	setupAdminTest(t)
	store.UserSessions["alice"] = &models.UserSession{Username: "alice", NethCTIToken: "alice:legacy"}

	// the status cannot be read (a directory instead of a file)
	require.NoError(t, os.MkdirAll(filepath.Join(configuration.Config.SecretsDir, "alice", "status"), 0700))

	w := adminRequest(t, http.MethodPost, "/admin/tokens/persistent/alice/mobile-app")
	require.Equal(t, http.StatusInternalServerError, w.Code)
	require.Empty(t, store.UserSessions["alice"].JWTTokens)

	w = adminRequest(t, http.MethodGet, "/admin/2fa/alice")
	require.Equal(t, http.StatusInternalServerError, w.Code)
}

// TestAdminConcurrentSessionChanges runs admin and login session changes
// together: run with -race to check the sessions lock.
func TestAdminConcurrentSessionChanges(t *testing.T) {
	setupAdminTest(t)
	configuration.Config.SuperAdminToken = testInternalSecret

	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(4)
		go func() {
			defer wg.Done()
			adminRequest(t, http.MethodPost, "/admin/tokens/persistent/room101/mobile-app")
		}()
		go func() {
			defer wg.Done()
			adminRequest(t, http.MethodDelete, "/admin/tokens/persistent/room101/all")
		}()
		go func() {
			defer wg.Done()
			UpsertUserSession("alice", "alice:legacy")
			store.SessionHasToken("alice", "x")
		}()
		go func() {
			defer wg.Done()
			adminRequest(t, http.MethodGet, "/admin/tokens/persistent/room101/mobile-app")
			store.SessionsSnapshot()
		}()
	}
	wg.Wait()
}
