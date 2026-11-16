/*
 * Copyright (C) 2026 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package methods

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	jwtv5 "github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/require"

	"github.com/nethesis/nethcti-middleware/configuration"
	"github.com/nethesis/nethcti-middleware/utils"
)

const testOTPSecret = "JBSWY3DPEHPK3PXP"

func verifyOTPRequest(t *testing.T, username, otp string) *httptest.ResponseRecorder {
	t.Helper()
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/2fa/verify-otp",
		strings.NewReader(`{"username":"`+username+`","otp":"`+otp+`"}`))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("JWT_PAYLOAD", jwtv5.MapClaims{"id": username, "2fa": true, "otp_verified": false})
	VerifyOTP(c)
	return w
}

func TestVerifyOTPLocksAfterRepeatedFailures(t *testing.T) {
	gin.SetMode(gin.TestMode)
	origSecretsDir := configuration.Config.SecretsDir
	t.Cleanup(func() { configuration.Config.SecretsDir = origSecretsDir })
	configuration.Config.SecretsDir = t.TempDir()

	userDir := filepath.Join(configuration.Config.SecretsDir, "otpuser")
	require.NoError(t, os.MkdirAll(userDir, 0700))
	require.NoError(t, os.WriteFile(filepath.Join(userDir, "secret"), []byte(testOTPSecret), 0600))
	require.NoError(t, os.WriteFile(filepath.Join(userDir, "codes"), []byte("11111111\n"), 0600))
	t.Cleanup(func() { otpSucceeded("otpuser") })

	for i := 0; i < otpMaxFailures; i++ {
		require.Equal(t, http.StatusBadRequest, verifyOTPRequest(t, "otpuser", "000000").Code)
	}

	// locked: even the right code is refused
	w := verifyOTPRequest(t, "otpuser", utils.GenerateOTP(testOTPSecret))
	require.Equal(t, http.StatusTooManyRequests, w.Code)
	require.NotEmpty(t, w.Header().Get("Retry-After"))

	// the lock is per user
	require.Zero(t, otpLockedFor("otheruser"))
}

func TestOTPAttemptsReset(t *testing.T) {
	t.Cleanup(func() { otpSucceeded("resetuser") })

	for i := 0; i < otpMaxFailures-1; i++ {
		otpFailed("resetuser")
	}
	otpSucceeded("resetuser")
	otpFailed("resetuser")
	require.Zero(t, otpLockedFor("resetuser"), "a success resets the failures")

	for i := 0; i < otpMaxFailures; i++ {
		otpFailed("resetuser")
	}
	require.Greater(t, otpLockedFor("resetuser"), otpLockout-time.Minute)
}

func TestBuildUserJWTClaimsRequiresOTPWhenTheStatusIsUnreadable(t *testing.T) {
	origSecretsDir := configuration.Config.SecretsDir
	t.Cleanup(func() { configuration.Config.SecretsDir = origSecretsDir })
	configuration.Config.SecretsDir = t.TempDir()

	// no status file: 2FA disabled
	require.Equal(t, false, buildBaseUserJWTClaims("nostatus", false)["2fa"])

	// unreadable status (a directory): 2FA required
	require.NoError(t, os.MkdirAll(filepath.Join(configuration.Config.SecretsDir, "broken", "status"), 0700))
	require.Equal(t, true, buildBaseUserJWTClaims("broken", false)["2fa"])
}

func TestParseUserJWTAndOTPPending(t *testing.T) {
	origSecret := configuration.Config.Secret_jwt
	t.Cleanup(func() { configuration.Config.Secret_jwt = origSecret })
	configuration.Config.Secret_jwt = "test-jwt-secret"

	sign := func(claims jwtv5.MapClaims, key string) string {
		s, err := jwtv5.NewWithClaims(jwtv5.SigningMethodHS256, claims).SignedString([]byte(key))
		require.NoError(t, err)
		return s
	}

	claims, err := ParseUserJWT(sign(jwtv5.MapClaims{"id": "alice", "2fa": true, "otp_verified": false}, "test-jwt-secret"))
	require.NoError(t, err)
	require.Equal(t, "alice", claims["id"])
	require.True(t, OTPPending(claims))

	claims, err = ParseUserJWT(sign(jwtv5.MapClaims{"id": "alice", "2fa": true, "otp_verified": true}, "test-jwt-secret"))
	require.NoError(t, err)
	require.False(t, OTPPending(claims))
	require.False(t, OTPPending(map[string]interface{}{"id": "alice", "2fa": false}))

	_, err = ParseUserJWT(sign(jwtv5.MapClaims{"id": "alice"}, "another-secret"))
	require.Error(t, err)
	_, err = ParseUserJWT(sign(jwtv5.MapClaims{"id": "alice", "exp": time.Now().Add(-time.Hour).Unix()}, "test-jwt-secret"))
	require.Error(t, err)
}
