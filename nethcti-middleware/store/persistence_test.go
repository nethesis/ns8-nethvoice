/*
 * Copyright (C) 2026 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package store

import (
	"testing"

	jwtv5 "github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"

	"github.com/nethesis/nethcti-middleware/models"
)

func signedToken(t *testing.T, claims jwtv5.MapClaims) string {
	token, err := jwtv5.NewWithClaims(jwtv5.SigningMethodHS256, claims).SignedString([]byte("secret"))
	assert.NoError(t, err)
	return token
}

func TestRemoveSessionJWTTokens(t *testing.T) {
	session1 := signedToken(t, jwtv5.MapClaims{"id": "mario", "iat": 1})
	session2 := signedToken(t, jwtv5.MapClaims{"id": "mario", "iat": 2})
	integration := signedToken(t, jwtv5.MapClaims{"id": "mario", "aud": "mobile-app"})

	UserSessions = map[string]*models.UserSession{
		"mario": {Username: "mario", JWTTokens: []string{session1, session2, integration}},
	}

	removed, err := RemoveSessionJWTTokens("mario", session1)
	assert.NoError(t, err)
	assert.Equal(t, 1, removed)
	assert.Equal(t, []string{session1, integration}, UserSessions["mario"].JWTTokens)

	// without a token to keep only the integration tokens stay
	removed, err = RemoveSessionJWTTokens("mario", "")
	assert.NoError(t, err)
	assert.Equal(t, 1, removed)
	assert.Equal(t, []string{integration}, UserSessions["mario"].JWTTokens)

	removed, err = RemoveSessionJWTTokens("unknown", "")
	assert.NoError(t, err)
	assert.Equal(t, 0, removed)
}
