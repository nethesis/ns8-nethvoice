/*
 * Copyright (C) 2026 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package methods

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	jwtv5 "github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/require"

	"github.com/nethesis/nethcti-middleware/configuration"
	"github.com/nethesis/nethcti-middleware/models"
	"github.com/nethesis/nethcti-middleware/store"
)

func TestPersistentTokenLifecycle(t *testing.T) {
	gin.SetMode(gin.TestMode)
	configuration.Config.Secret_jwt = "test-secret-jwt"
	store.UserSessions = map[string]*models.UserSession{
		"alice": {
			Username:     "alice",
			NethCTIToken: "alice:legacy",
			JWTTokens: []string{
				mustIssueTestToken(t, "alice", "phone-island"),
				mustIssueTestToken(t, "alice", "mobile-app"),
			},
		},
	}

	// Create new phone-island token (must rotate previous one for same audience)
	createCtx, createW := newTokenTestContext(http.MethodPost, "alice", "phone-island")
	CreatePersistentToken(createCtx)
	require.Equal(t, http.StatusOK, createW.Code)

	var createResp map[string]any
	require.NoError(t, json.Unmarshal(createW.Body.Bytes(), &createResp))
	createdToken, ok := createResp["token"].(string)
	require.True(t, ok)
	require.NotEmpty(t, createdToken)
	_, hasUsername := createResp["username"]
	require.False(t, hasUsername, "username must not be returned anymore")

	session := store.UserSessions["alice"]
	require.Len(t, session.JWTTokens, 2, "same audience token must be rotated, others kept")
	require.True(t, isIntegrationTokenForAudience(createdToken, "alice", "phone-island"))

	parsed, err := jwtv5.Parse(createdToken, func(token *jwtv5.Token) (interface{}, error) {
		return []byte(configuration.Config.Secret_jwt), nil
	})
	require.NoError(t, err)
	require.True(t, parsed.Valid)
	claims, ok := parsed.Claims.(jwtv5.MapClaims)
	require.True(t, ok)
	require.Equal(t, "phone-island", claims["aud"])
	require.NotNil(t, claims["iat"])
	require.NotNil(t, claims["exp"])

	// Check token existence
	checkCtx, checkW := newTokenTestContext(http.MethodGet, "alice", "phone-island")
	CheckPersistentToken(checkCtx)
	require.Equal(t, http.StatusOK, checkW.Code)

	var checkResp map[string]any
	require.NoError(t, json.Unmarshal(checkW.Body.Bytes(), &checkResp))
	require.Equal(t, true, checkResp["exists"])

	// Remove token for audience (204, no body)
	removeCtx, removeW := newTokenTestContext(http.MethodDelete, "alice", "phone-island")
	RemovePersistentToken(removeCtx)
	removeCtx.Writer.WriteHeaderNow()
	require.Equal(t, http.StatusNoContent, removeW.Code)

	// Check again: token not present anymore
	checkAfterCtx, checkAfterW := newTokenTestContext(http.MethodGet, "alice", "phone-island")
	CheckPersistentToken(checkAfterCtx)
	require.Equal(t, http.StatusOK, checkAfterW.Code)
	require.NoError(t, json.Unmarshal(checkAfterW.Body.Bytes(), &checkResp))
	require.Equal(t, false, checkResp["exists"])
}

func TestPersistentTokenInvalidAudience(t *testing.T) {
	gin.SetMode(gin.TestMode)
	configuration.Config.Secret_jwt = "test-secret-jwt"
	store.UserSessions = map[string]*models.UserSession{
		"alice": {
			Username:     "alice",
			NethCTIToken: "alice:legacy",
		},
	}

	ctx, w := newTokenTestContext(http.MethodPost, "alice", "unsupported-audience")
	CreatePersistentToken(ctx)
	require.Equal(t, http.StatusBadRequest, w.Code)

	var resp map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	require.Equal(t, "invalid audience", resp["message"])
}

func newTokenTestContext(method, username, audience string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(method, "/tokens/persistent/"+audience, nil)
	c.Params = gin.Params{{Key: "audience", Value: audience}}
	c.Set("JWT_PAYLOAD", jwtv5.MapClaims{"id": username})
	return c, w
}

func mustIssueTestToken(t *testing.T, username, audience string) string {
	t.Helper()
	now := time.Now()
	claims := jwtv5.MapClaims{
		"id":  username,
		"aud": audience,
		"iat": now.Unix(),
		"exp": now.Add(time.Hour).Unix(),
	}
	token := jwtv5.NewWithClaims(jwtv5.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(configuration.Config.Secret_jwt))
	require.NoError(t, err)
	return tokenString
}
