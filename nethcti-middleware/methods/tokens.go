/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package methods

import (
	"errors"
	"net/http"
	"strings"
	"time"

	jwt "github.com/appleboy/gin-jwt/v3"
	"github.com/gin-gonic/gin"
	jwtv5 "github.com/golang-jwt/jwt/v5"

	"github.com/nethesis/nethcti-middleware/models"
	"github.com/nethesis/nethcti-middleware/store"
)

// errSessionNotFound is returned when the user session disappeared (e.g. it
// has been revoked) while issuing a token.
var errSessionNotFound = errors.New("user session not found")

var allowedIntegrationAudiences = map[string]struct{}{
	"phone-island": {},
	"mobile-app":   {},
	"nethlink":     {},
	"chat-island":  {},
}

// -----------------------------------------------------------------------------
// LEGACY COMPATIBILITY SECTION
//
// These handlers are kept only for backward compatibility with old clients
// (e.g. old NethLink versions). They should be removed when legacy clients are
// no longer supported.
// -----------------------------------------------------------------------------

type phoneIslandLegacyRequest struct {
	Type    string `json:"type"`
	Subtype string `json:"subtype"`
}

// PhoneIslandTokenLogin is a legacy compatibility endpoint.
// It maps legacy subtype values to the new persistent token audiences.
func PhoneIslandTokenLogin(c *gin.Context) {
	var req phoneIslandLegacyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// Keep backward compatibility: empty body means default phone-island audience.
		req = phoneIslandLegacyRequest{}
	}
	issueIntegrationToken(c, mapLegacySubtypeToAudience(req.Subtype))
}

// PhoneIslandTokenCheck is a legacy compatibility endpoint.
// Historically this endpoint checked the phone-island integration token existence.
func PhoneIslandTokenCheck(c *gin.Context) {
	subtype := c.Param("subtype")
	checkIntegrationToken(c, mapLegacySubtypeToAudience(subtype))
}

// PhoneIslandTokenRemove is a legacy compatibility endpoint.
// It maps legacy subtype values to the new persistent token audiences.
func PhoneIslandTokenRemove(c *gin.Context) {
	var req phoneIslandLegacyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// Keep backward compatibility: empty body means default phone-island audience.
		req = phoneIslandLegacyRequest{}
	}
	revokeIntegrationTokens(c, mapLegacySubtypeToAudience(req.Subtype))
}

// mapLegacySubtypeToAudience maps legacy subtype values to the new persistent token audiences.
func mapLegacySubtypeToAudience(subtype string) string {
	normalizedSubtype := strings.TrimSpace(strings.ToLower(subtype))
	if normalizedSubtype == "nethlink" {
		return "nethlink"
	}
	return "phone-island"
}

// -----------------------------------------------------------------------------
// CURRENT TOKEN API SECTION
// -----------------------------------------------------------------------------

// CreatePersistentToken creates a JWT integration token for the requested audience.
func CreatePersistentToken(c *gin.Context) {
	audience, ok := getAudienceFromRequest(c)
	if !ok {
		return
	}
	issueIntegrationToken(c, audience)
}

// CheckPersistentToken checks if at least one valid integration token exists for the requested audience.
func CheckPersistentToken(c *gin.Context) {
	audience, ok := getAudienceFromRequest(c)
	if !ok {
		return
	}
	checkIntegrationToken(c, audience)
}

// RemovePersistentToken revokes all integration JWTs for the requested audience.
func RemovePersistentToken(c *gin.Context) {
	audience, ok := getAudienceFromRequest(c)
	if !ok {
		return
	}
	revokeIntegrationTokens(c, audience)
}

func issueIntegrationToken(c *gin.Context, audience string) {
	claims := jwt.ExtractClaims(c)
	username, ok := claims["id"].(string)
	if !ok || username == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "invalid user"})
		return
	}

	userSession, hasSession := store.GetSession(username)
	if !hasSession || userSession.NethCTIToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "user session not found"})
		return
	}

	otpVerified, _ := claims["otp_verified"].(bool)
	tokenString, err := issueSessionIntegrationToken(username, audience, otpVerified)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": tokenString,
	})
}

// issueSessionIntegrationToken issues a long-lived integration JWT for the
// audience and stores it in the user session, replacing the previous token of
// the same audience.
func issueSessionIntegrationToken(username string, audience string, otpVerified bool) (string, error) {
	now := time.Now()
	expire := now.Add(100 * 365 * 24 * time.Hour) // Legacy-compatible behavior: very long-lived integration token (100 years).

	_, tokenString, err := IssueUserJWT(UserJWTOptions{
		Username:    username,
		OTPVerified: otpVerified,
		IssuedAt:    now,
		ExpiresAt:   &expire,
		Audience:    audience,
	})
	if err != nil {
		return "", errors.New("failed to generate token")
	}

	// Keep exactly one integration token per audience: remove previous ones before adding a new one.
	found := false
	store.ModifySessions(func(userSessions map[string]*models.UserSession) {
		userSession := userSessions[username]
		if userSession == nil {
			return
		}
		found = true
		filtered := make([]string, 0, len(userSession.JWTTokens)+1)
		for _, existing := range userSession.JWTTokens {
			if isIntegrationTokenForAudience(existing, username, audience) {
				continue
			}
			filtered = append(filtered, existing)
		}
		userSession.JWTTokens = append(filtered, tokenString)
	})
	if !found {
		return "", errSessionNotFound
	}

	if err := store.SaveSessions(); err != nil {
		return "", errors.New("failed to persist token")
	}

	return tokenString, nil
}

func checkIntegrationToken(c *gin.Context, audience string) {
	username, userSession, ok := getCurrentSession(c)
	if !ok {
		return
	}

	c.JSON(http.StatusOK, gin.H{"exists": hasSessionIntegrationToken(username, &userSession, audience)})
}

// hasSessionIntegrationToken reports whether the session holds an integration
// token for the audience.
func hasSessionIntegrationToken(username string, userSession *models.UserSession, audience string) bool {
	if userSession == nil {
		return false
	}
	for _, token := range userSession.JWTTokens {
		if isIntegrationTokenForAudience(token, username, audience) {
			return true
		}
	}
	return false
}

func revokeIntegrationTokens(c *gin.Context, audience string) {
	username, _, ok := getCurrentSession(c)
	if !ok {
		return
	}

	if err := revokeSessionIntegrationTokens(username, audience); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to persist token removal"})
		return
	}

	c.Status(http.StatusNoContent)
}

// revokeSessionIntegrationTokens removes every integration token of the
// audience from the user session, if any.
func revokeSessionIntegrationTokens(username string, audience string) error {
	store.ModifySessions(func(userSessions map[string]*models.UserSession) {
		userSession := userSessions[username]
		if userSession == nil {
			return
		}
		filtered := make([]string, 0, len(userSession.JWTTokens))
		for _, token := range userSession.JWTTokens {
			if isIntegrationTokenForAudience(token, username, audience) {
				continue
			}
			filtered = append(filtered, token)
		}
		userSession.JWTTokens = filtered
	})
	return store.SaveSessions()
}

func getCurrentSession(c *gin.Context) (string, models.UserSession, bool) {
	claims := jwt.ExtractClaims(c)
	username, ok := claims["id"].(string)
	if !ok || username == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "invalid user"})
		return "", models.UserSession{}, false
	}

	userSession, hasSession := store.GetSession(username)
	if !hasSession {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "user session not found"})
		return "", models.UserSession{}, false
	}

	return username, userSession, true
}

func isIntegrationTokenForAudience(tokenString string, username string, audience string) bool {
	claims := jwtv5.MapClaims{}
	parser := jwtv5.NewParser(jwtv5.WithoutClaimsValidation())

	_, _, err := parser.ParseUnverified(tokenString, claims)
	if err != nil {
		return false
	}

	id, ok := claims["id"].(string)
	if !ok || id != username {
		return false
	}
	tokenType, ok := claims["aud"].(string)
	if !ok {
		return false
	}
	if tokenType != audience {
		return false
	}
	return true
}

func getAudienceFromRequest(c *gin.Context) (string, bool) {
	audience := strings.TrimSpace(strings.ToLower(c.Param("audience")))
	if audience == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "missing audience"})
		return "", false
	}

	if _, ok := allowedIntegrationAudiences[audience]; !ok {
		c.JSON(http.StatusBadRequest, gin.H{"message": "invalid audience"})
		return "", false
	}
	return audience, true
}
