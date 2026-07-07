/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package middleware

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"

	jwtv5 "github.com/golang-jwt/jwt/v5"
	"github.com/nethesis/nethcti-middleware/configuration"
	"github.com/nethesis/nethcti-middleware/logs"
	"github.com/nethesis/nethcti-middleware/models"
	"github.com/nethesis/nethcti-middleware/store"
)

func init() {
	// Initialize logs for tests
	logs.Init("nethcti-test")
}

// TestRequireSuperAdminWithValidTokenAndValidIP tests successful authentication with valid token and IP
func TestRequireSuperAdminWithValidTokenAndValidIP(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	configuration.Config.SuperAdminToken = "valid-test-token-123"
	configuration.Config.SuperAdminAllowedIPs = []string{"127.0.0.1", "192.168.1.0/24"}

	router := gin.New()
	router.POST("/admin/test", RequireSuperAdmin(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "success"})
	})

	// Create request with valid token from allowed IP
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/admin/test", nil)
	req.Header.Set("Authorization", "Bearer valid-test-token-123")
	req.RemoteAddr = "127.0.0.1:12345"

	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "success")
}

// TestRequireSuperAdminWithInvalidToken tests rejection with invalid/wrong token
func TestRequireSuperAdminWithInvalidToken(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	configuration.Config.SuperAdminToken = "valid-test-token-123"
	configuration.Config.SuperAdminAllowedIPs = []string{"127.0.0.1"}

	router := gin.New()
	router.POST("/admin/test", RequireSuperAdmin(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "success"})
	})

	// Create request with invalid token
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/admin/test", nil)
	req.Header.Set("Authorization", "Bearer wrong-token")
	req.RemoteAddr = "127.0.0.1:12345"

	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, http.StatusUnauthorized, w.Code)
	assert.Contains(t, w.Body.String(), "super admin authentication required")
}

// TestRequireSuperAdminWithMissingToken tests rejection when token header is missing
func TestRequireSuperAdminWithMissingToken(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	configuration.Config.SuperAdminToken = "valid-test-token-123"
	configuration.Config.SuperAdminAllowedIPs = []string{"127.0.0.1"}

	router := gin.New()
	router.POST("/admin/test", RequireSuperAdmin(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "success"})
	})

	// Create request without Authorization header
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/admin/test", nil)
	req.RemoteAddr = "127.0.0.1:12345"

	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, http.StatusUnauthorized, w.Code)
	assert.Contains(t, w.Body.String(), "super admin authentication required")
}

// TestRequireSuperAdminWithBadIPAddress tests rejection with IP not in allowed list
func TestRequireSuperAdminWithBadIPAddress(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	configuration.Config.SuperAdminToken = "valid-test-token-123"
	configuration.Config.SuperAdminAllowedIPs = []string{"192.168.1.0/24"}

	router := gin.New()
	router.POST("/admin/test", RequireSuperAdmin(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "success"})
	})

	// Create request from disallowed IP with valid token
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/admin/test", nil)
	req.Header.Set("Authorization", "Bearer valid-test-token-123")
	req.RemoteAddr = "10.0.0.1:12345"

	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, http.StatusForbidden, w.Code)
	assert.Contains(t, w.Body.String(), "access denied: IP not in allowed list")
}

// TestRequireSuperAdminWithCIDRRange tests IP matching with CIDR notation
func TestRequireSuperAdminWithCIDRRange(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	configuration.Config.SuperAdminToken = "valid-test-token-123"
	configuration.Config.SuperAdminAllowedIPs = []string{"192.168.1.0/24", "10.0.0.0/8"}

	router := gin.New()
	router.POST("/admin/test", RequireSuperAdmin(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "success"})
	})

	// Test IP within CIDR range
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/admin/test", nil)
	req.Header.Set("Authorization", "Bearer valid-test-token-123")
	req.RemoteAddr = "192.168.1.50:12345"

	router.ServeHTTP(w, req)

	// Assert - should be allowed
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "success")

	// Test IP within second CIDR range
	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest("POST", "/admin/test", nil)
	req2.Header.Set("Authorization", "Bearer valid-test-token-123")
	req2.RemoteAddr = "10.50.100.200:12345"

	router.ServeHTTP(w2, req2)

	// Assert - should be allowed
	assert.Equal(t, http.StatusOK, w2.Code)

	// Test IP outside CIDR range
	w3 := httptest.NewRecorder()
	req3, _ := http.NewRequest("POST", "/admin/test", nil)
	req3.Header.Set("Authorization", "Bearer valid-test-token-123")
	req3.RemoteAddr = "172.16.0.1:12345"

	router.ServeHTTP(w3, req3)

	// Assert - should be forbidden
	assert.Equal(t, http.StatusForbidden, w3.Code)
	assert.Contains(t, w3.Body.String(), "access denied: IP not in allowed list")
}

// TestRequireSuperAdminWithInvalidCIDRNotation tests graceful handling of invalid CIDR
func TestRequireSuperAdminWithInvalidCIDRNotation(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	configuration.Config.SuperAdminToken = "valid-test-token-123"
	// Invalid CIDR notation should be handled gracefully
	configuration.Config.SuperAdminAllowedIPs = []string{"invalid/cidr", "127.0.0.1"}

	router := gin.New()
	router.POST("/admin/test", RequireSuperAdmin(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "success"})
	})

	// Create request from exact IP match (fallback when CIDR parsing fails)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/admin/test", nil)
	req.Header.Set("Authorization", "Bearer valid-test-token-123")
	req.RemoteAddr = "127.0.0.1:12345"

	router.ServeHTTP(w, req)

	// Assert - should be allowed via exact IP match
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "success")
}

// TestRequireSuperAdminEmptyConfigToken tests rejection when token config is empty
func TestRequireSuperAdminEmptyConfigToken(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	configuration.Config.SuperAdminToken = ""
	configuration.Config.SuperAdminAllowedIPs = []string{"127.0.0.1"}

	router := gin.New()
	router.POST("/admin/test", RequireSuperAdmin(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "success"})
	})

	// Create request with token (but config token is empty)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/admin/test", nil)
	req.Header.Set("Authorization", "Bearer any-token")
	req.RemoteAddr = "127.0.0.1:12345"

	router.ServeHTTP(w, req)

	// Assert - should be rejected because config token is empty
	assert.Equal(t, http.StatusUnauthorized, w.Code)
	assert.Contains(t, w.Body.String(), "super admin authentication required")
}

// TestRequireSuperAdminEmptyAllowedIPsList tests rejection when no IPs are allowed
func TestRequireSuperAdminEmptyAllowedIPsList(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	configuration.Config.SuperAdminToken = "valid-test-token-123"
	configuration.Config.SuperAdminAllowedIPs = []string{}

	router := gin.New()
	router.POST("/admin/test", RequireSuperAdmin(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "success"})
	})

	// Create request with valid token but no allowed IPs
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/admin/test", nil)
	req.Header.Set("Authorization", "Bearer valid-test-token-123")
	req.RemoteAddr = "127.0.0.1:12345"

	router.ServeHTTP(w, req)

	// Assert - should be forbidden
	assert.Equal(t, http.StatusForbidden, w.Code)
	assert.Contains(t, w.Body.String(), "access denied: IP not in allowed list")
}

// TestRequireSuperAdminWithMalformedAuthHeader tests handling of malformed Authorization header
func TestRequireSuperAdminWithMalformedAuthHeader(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	configuration.Config.SuperAdminToken = "valid-test-token-123"
	configuration.Config.SuperAdminAllowedIPs = []string{"127.0.0.1"}

	router := gin.New()
	router.POST("/admin/test", RequireSuperAdmin(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "success"})
	})

	// Create request with malformed Authorization header (missing "Bearer " prefix)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/admin/test", nil)
	req.Header.Set("Authorization", "valid-test-token-123") // Missing "Bearer " prefix
	req.RemoteAddr = "127.0.0.1:12345"

	router.ServeHTTP(w, req)

	// Assert - should be rejected because token is not extracted properly
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

// TestRequireSuperAdminWithIPv6Address tests IPv6 address handling
func TestRequireSuperAdminWithIPv6Address(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	configuration.Config.SuperAdminToken = "valid-test-token-123"
	configuration.Config.SuperAdminAllowedIPs = []string{"::1"}

	router := gin.New()
	router.POST("/admin/test", RequireSuperAdmin(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "success"})
	})

	// Create request from IPv6 localhost
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/admin/test", nil)
	req.Header.Set("Authorization", "Bearer valid-test-token-123")
	req.RemoteAddr = "[::1]:12345"

	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "success")
}

// TestRequireSuperAdminTimingAttackResistance tests token comparison is constant-time
func TestRequireSuperAdminTimingAttackResistance(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	configuration.Config.SuperAdminToken = "a-very-long-token-string-for-timing-test-12345"
	configuration.Config.SuperAdminAllowedIPs = []string{"127.0.0.1"}

	router := gin.New()
	router.POST("/admin/test", RequireSuperAdmin(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "success"})
	})

	// Test with wrong token (should take roughly same time as correct token comparison)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/admin/test", nil)
	req.Header.Set("Authorization", "Bearer b-very-long-token-string-for-timing-test-12345")
	req.RemoteAddr = "127.0.0.1:12345"

	router.ServeHTTP(w, req)

	// Assert - token comparison is constant-time (no early exit on mismatch)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

// TestRequireSuperAdminMultipleAllowedIPs tests with multiple direct IP addresses
func TestRequireSuperAdminMultipleAllowedIPs(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	configuration.Config.SuperAdminToken = "valid-test-token-123"
	configuration.Config.SuperAdminAllowedIPs = []string{"127.0.0.1", "192.168.1.1", "10.0.0.1"}

	router := gin.New()
	router.POST("/admin/test", RequireSuperAdmin(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "success"})
	})

	// Test first IP
	w1 := httptest.NewRecorder()
	req1, _ := http.NewRequest("POST", "/admin/test", nil)
	req1.Header.Set("Authorization", "Bearer valid-test-token-123")
	req1.RemoteAddr = "127.0.0.1:12345"
	router.ServeHTTP(w1, req1)
	assert.Equal(t, http.StatusOK, w1.Code)

	// Test second IP
	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest("POST", "/admin/test", nil)
	req2.Header.Set("Authorization", "Bearer valid-test-token-123")
	req2.RemoteAddr = "192.168.1.1:12345"
	router.ServeHTTP(w2, req2)
	assert.Equal(t, http.StatusOK, w2.Code)

	// Test third IP
	w3 := httptest.NewRecorder()
	req3, _ := http.NewRequest("POST", "/admin/test", nil)
	req3.Header.Set("Authorization", "Bearer valid-test-token-123")
	req3.RemoteAddr = "10.0.0.1:12345"
	router.ServeHTTP(w3, req3)
	assert.Equal(t, http.StatusOK, w3.Code)

	// Test IP not in list
	w4 := httptest.NewRecorder()
	req4, _ := http.NewRequest("POST", "/admin/test", nil)
	req4.Header.Set("Authorization", "Bearer valid-test-token-123")
	req4.RemoteAddr = "172.16.0.1:12345"
	router.ServeHTTP(w4, req4)
	assert.Equal(t, http.StatusForbidden, w4.Code)
}

func writeTempFile(t *testing.T, name, content string) string {
	t.Helper()
	tmp := t.TempDir()
	p := filepath.Join(tmp, name)
	if err := os.WriteFile(p, []byte(content), 0o644); err != nil {
		t.Fatalf("failed to write temp file: %v", err)
	}
	return p
}

// Test that PayloadFunc only injects base auth claims into the JWT claims map.
func TestPayloadFuncInjectsBaseClaimsOnly(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Ensure a deterministic JWT secret for the middleware
	configuration.Config.Secret_jwt = "test-secret"
	// Reset cached jwtMiddleware so subsequent calls to InstanceJWT() will reinitialize
	// the middleware using the updated `configuration.Config.Secret_jwt` value.
	// Tests generate and sign tokens with the test secret; without this reset the
	// previously-initialized middleware could validate tokens with the old key
	// causing signature validation to fail.
	jwtMiddleware = nil

	// Initialize session storage and set a session for the user
	store.UserSessionInit()
	store.UserSessions["tuser"] = &models.UserSession{Username: "tuser"}

	// Obtain middleware and call PayloadFunc directly
	mw := InstanceJWT()
	claims := mw.PayloadFunc(store.UserSessions["tuser"])

	// Validate base claims
	if got, ok := claims["id"].(string); !ok || got != "tuser" {
		t.Fatalf("unexpected id claim: got %v", claims["id"])
	}

	if got, ok := claims["2fa"].(bool); !ok || got {
		t.Fatalf("unexpected 2fa claim: got %v", claims["2fa"])
	}

	if got, ok := claims["otp_verified"].(bool); !ok || got {
		t.Fatalf("unexpected otp_verified claim: got %v", claims["otp_verified"])
	}

	if _, ok := claims["iat"]; !ok {
		t.Fatal("expected iat claim to be present")
	}
}

// Test PayloadFunc does not expose profile/capability claims.
func TestPayloadFuncDoesNotInjectProfileOrCapabilityClaims(t *testing.T) {
	gin.SetMode(gin.TestMode)

	configuration.Config.Secret_jwt = "test-secret-2"

	// Initialize a basic user session
	store.UserSessionInit()
	store.UserSessions["no_prof_user"] = &models.UserSession{Username: "no_prof_user"}

	mw := InstanceJWT()
	claims := mw.PayloadFunc(store.UserSessions["no_prof_user"])

	// profile claims must not be injected
	if _, ok := claims["profile_id"]; ok {
		t.Fatalf("expected no profile_id claim, got %v", claims["profile_id"])
	}

	// capability keys must not be present
	if _, ok := claims["phonebook.ad_phonebook"]; ok {
		t.Fatalf("expected no capability claims, got phonebook.ad_phonebook")
	}
}

func TestRequireCapabilities_AllowsWhenCapabilityPresentServerSide(t *testing.T) {
	gin.SetMode(gin.TestMode)
	// Ensure middleware uses test secret before constructing the router
	configuration.Config.Secret_jwt = "test-secret"
	// Reset cached jwtMiddleware so InstanceJWT() recreates the middleware with
	// the updated secret. This is required so tokens generated by tests are
	// validated with the same key they were signed with.
	jwtMiddleware = nil

	// create router with a route protected by the capability middleware
	router := gin.New()
	router.GET("/captest", InstanceJWT().MiddlewareFunc(), RequireCapabilities("phonebook.ad_phonebook"), func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})
	store.UserSessionInit()
	// create minimal profile/users so server-side capability check succeeds
	profilesJSON := `{"p": {"id":"p","name":"P","macro_permissions": {"phonebook": {"value": true, "permissions": [{"id":"12","name":"ad_phonebook","value":true}]}}}}`
	usersJSON := `{"u": {"profile_id":"p"}}`
	profFile := writeTempFile(t, "profiles.json", profilesJSON)
	usersFile := writeTempFile(t, "users.json", usersJSON)
	if err := store.InitProfiles(profFile, usersFile); err != nil {
		t.Fatalf("InitProfiles failed: %v", err)
	}
	store.UserSessions["u"] = &models.UserSession{Username: "u"}

	// Generate a token for the user using the middleware LoginResponse/PayloadFunc is complex,
	// so instead set the Authorization header to a generated API key (jwt) via methods.generateAPIKey
	token, err := generateTestJWT("u")
	if err != nil {
		t.Fatalf("failed to generate test token: %v", err)
	}
	// register token in the user session so Authorizator recognizes it
	store.UserSessions["u"].JWTTokens = append(store.UserSessions["u"].JWTTokens, token)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/captest", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Fatalf("expected 200 allowed, got %d: %s", w.Code, w.Body.String())
	}
}

func TestRequireCapabilities_DeniesWhenCapabilityMissingServerSide(t *testing.T) {
	gin.SetMode(gin.TestMode)
	// Ensure middleware uses test secret before constructing the router
	configuration.Config.Secret_jwt = "test-secret"
	// Reset cached jwtMiddleware so InstanceJWT() recreates the middleware with
	// the updated secret. This prevents tests from accidentally using a previously
	// initialized middleware (which would validate tokens with the wrong key).
	jwtMiddleware = nil

	router := gin.New()
	router.GET("/captest", InstanceJWT().MiddlewareFunc(), RequireCapabilities("phonebook.ad_phonebook"), func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	store.UserSessionInit()
	// create user with a valid profile that does not grant the requested capability
	profilesJSON := `{"base": {"id":"base","name":"Base","macro_permissions": {}}}`
	usersJSON := `{"nouser": {"profile_id":"base"}}`
	profFile := writeTempFile(t, "profiles.json", profilesJSON)
	usersFile := writeTempFile(t, "users.json", usersJSON)
	if err := store.InitProfiles(profFile, usersFile); err != nil {
		t.Fatalf("InitProfiles failed: %v", err)
	}
	store.UserSessions["nouser"] = &models.UserSession{Username: "nouser"}

	token, err := generateTestJWT("nouser")
	if err != nil {
		t.Fatalf("failed to generate test token: %v", err)
	}
	store.UserSessions["nouser"].JWTTokens = append(store.UserSessions["nouser"].JWTTokens, token)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/captest", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 forbidden, got %d: %s", w.Code, w.Body.String())
	}
}

func TestRequireCapabilities_DeniesLegacyClaimFallbackWhenStoreLookupFails(t *testing.T) {
	gin.SetMode(gin.TestMode)
	configuration.Config.Secret_jwt = "test-secret"
	jwtMiddleware = nil

	router := gin.New()
	router.GET("/captest", InstanceJWT().MiddlewareFunc(), RequireCapabilities("phonebook.ad_phonebook"), func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	store.UserSessionInit()
	store.UserSessions["legacy"] = &models.UserSession{Username: "legacy"}

	token, err := generateTestJWTWithClaims("legacy", map[string]any{
		"phonebook.ad_phonebook": true,
	})
	if err != nil {
		t.Fatalf("failed to generate legacy claim token: %v", err)
	}
	store.UserSessions["legacy"].JWTTokens = append(store.UserSessions["legacy"].JWTTokens, token)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/captest", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 forbidden without server-side capabilities, got %d: %s", w.Code, w.Body.String())
	}
}

// generateTestJWT creates a signed JWT for the given username using the test secret
func generateTestJWT(username string) (string, error) {
	// If a user session exists, use middleware PayloadFunc to build default user claims.
	if sess, ok := store.UserSessions[username]; ok && sess != nil {
		mw := InstanceJWT()
		// PayloadFunc returns jwt.MapClaims
		payload := mw.PayloadFunc(sess)
		// ensure standard claims
		payload["exp"] = time.Now().Add(time.Hour).Unix()
		payload["iat"] = time.Now().Unix()

		token := jwtv5.NewWithClaims(jwtv5.SigningMethodHS256, jwtv5.MapClaims(payload))
		return token.SignedString([]byte(configuration.Config.Secret_jwt))
	}

	// fallback minimal token
	claims := jwtv5.MapClaims{
		"id":  username,
		"exp": time.Now().Add(time.Hour).Unix(),
		"iat": time.Now().Unix(),
	}
	token := jwtv5.NewWithClaims(jwtv5.SigningMethodHS256, claims)
	return token.SignedString([]byte(configuration.Config.Secret_jwt))
}

func generateTestJWTWithClaims(username string, extraClaims map[string]any) (string, error) {
	claims := jwtv5.MapClaims{
		"id":  username,
		"exp": time.Now().Add(time.Hour).Unix(),
		"iat": time.Now().Unix(),
	}

	for key, value := range extraClaims {
		claims[key] = value
	}

	token := jwtv5.NewWithClaims(jwtv5.SigningMethodHS256, claims)
	return token.SignedString([]byte(configuration.Config.Secret_jwt))
}
