/*
 * Copyright (C) 2026 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package methods

import (
	"errors"
	"net/http"
	"os"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/nethesis/nethcti-middleware/logs"
	"github.com/nethesis/nethcti-middleware/store"
)

// adminAllAudiences is the DELETE-only audience that revokes every token and
// the session of the user (web, desktop and integrations).
const adminAllAudiences = "all"

// usernamePattern restricts the usernames accepted by the admin endpoints: the
// username is also used as a directory name under the 2FA secrets dir. "@" is
// not accepted, so "user@domain" aliases cannot be used.
var usernamePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9._-]*$`)

// getAdminUsername reads and validates the :username path parameter.
func getAdminUsername(c *gin.Context) (string, bool) {
	username := strings.TrimSpace(strings.ToLower(c.Param("username")))
	if !usernamePattern.MatchString(username) || strings.Contains(username, "..") {
		c.JSON(http.StatusBadRequest, gin.H{"message": "invalid username"})
		return "", false
	}
	return username, true
}

// getAdminAudience reads the :audience path parameter; "all" is accepted only
// when allowAll is set.
func getAdminAudience(c *gin.Context, allowAll bool) (string, bool) {
	audience := strings.TrimSpace(strings.ToLower(c.Param("audience")))
	if allowAll && audience == adminAllAudiences {
		return audience, true
	}
	return getAudienceFromRequest(c)
}

// get2FAEnabled reads the user 2FA status: a missing status file means 2FA
// is not enabled, any other read error is returned (fail closed).
func get2FAEnabled(username string) (bool, error) {
	status, err := GetUserStatus(username)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return false, nil
		}
		return false, err
	}
	return status == "1", nil
}

// AdminCheckPersistentToken reports whether the user holds an integration
// token for the audience.
func AdminCheckPersistentToken(c *gin.Context) {
	username, ok := getAdminUsername(c)
	if !ok {
		return
	}
	audience, ok := getAdminAudience(c, false)
	if !ok {
		return
	}

	session, hasSession := store.GetSession(username)
	exists := hasSession && hasSessionIntegrationToken(username, &session, audience)
	c.JSON(http.StatusOK, gin.H{"exists": exists})
}

// AdminCreatePersistentToken issues an integration token for the user, without
// the user password. When the user has no session yet (e.g. never logged in),
// it is created with an internal login on the V1 server, authorized by the
// super admin token that the V1 server shares through the module environment.
func AdminCreatePersistentToken(c *gin.Context) {
	username, ok := getAdminUsername(c)
	if !ok {
		return
	}
	audience, ok := getAdminAudience(c, false)
	if !ok {
		return
	}

	// Only the exact username of a configured user: an alias (extension
	// number) would get a session and a token under another name, out of
	// reach of the 2FA check and of the revocation of the real user.
	if !store.UserExists(username) {
		c.JSON(http.StatusNotFound, gin.H{"message": "user not found or not allowed"})
		return
	}

	// The token is issued without OTP verification: refuse it instead of
	// returning a token that the 2FA check would reject anyway.
	enabled2FA, err := get2FAEnabled(username)
	if err != nil {
		logs.Log("[ERROR][ADMIN] failed to read the 2FA status of user " + username + ": " + err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to read the 2FA status"})
		return
	}
	if enabled2FA {
		c.JSON(http.StatusConflict, gin.H{"message": "user has 2FA enabled"})
		return
	}

	if session, hasSession := store.GetSession(username); !hasSession || session.NethCTIToken == "" {
		accountUsername, NethCTIToken, err := LoginV1(username, "", LoginInternal)
		if errors.Is(err, ErrTrustedLoginDisabled) {
			c.JSON(http.StatusServiceUnavailable, gin.H{"message": "internal login is not configured"})
			return
		}
		if err != nil || accountUsername != username {
			c.JSON(http.StatusNotFound, gin.H{"message": "user not found or not allowed"})
			return
		}
		UpsertUserSession(username, NethCTIToken)
	}

	tokenString, err := issueSessionIntegrationToken(username, audience, false)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	logs.Log("[INFO][ADMIN] issued " + audience + " persistent token for user " + username)
	c.JSON(http.StatusOK, gin.H{"token": tokenString})
}

// AdminRemovePersistentToken revokes the user tokens of the audience; "all"
// revokes every token and the session. It succeeds also when there is nothing
// to revoke.
func AdminRemovePersistentToken(c *gin.Context) {
	username, ok := getAdminUsername(c)
	if !ok {
		return
	}
	audience, ok := getAdminAudience(c, true)
	if !ok {
		return
	}

	if _, hasSession := store.GetSession(username); !hasSession {
		c.Status(http.StatusNoContent)
		return
	}

	var err error
	if audience == adminAllAudiences {
		// it fails only when the session has been removed meanwhile
		if errAll := store.RemoveAllJWTTokens(username); errAll != nil {
			if _, hasSession := store.GetSession(username); hasSession {
				err = errAll
			}
		}
	} else {
		err = revokeSessionIntegrationTokens(username, audience)
	}
	if err != nil {
		logs.Log("[ERROR][ADMIN] failed to revoke " + audience + " tokens for user " + username + ": " + err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to persist token removal"})
		return
	}

	logs.Log("[INFO][ADMIN] revoked " + audience + " tokens for user " + username)
	c.Status(http.StatusNoContent)
}

// AdminGet2FAStatus reports whether the user has 2FA enabled.
func AdminGet2FAStatus(c *gin.Context) {
	username, ok := getAdminUsername(c)
	if !ok {
		return
	}

	enabled2FA, err := get2FAEnabled(username)
	if err != nil {
		logs.Log("[ERROR][ADMIN] failed to read the 2FA status of user " + username + ": " + err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to read the 2FA status"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": enabled2FA})
}

// AdminDisable2FA disables 2FA for the user (e.g. lost device) and revokes all
// the user tokens, so every client has to log in again.
func AdminDisable2FA(c *gin.Context) {
	username, ok := getAdminUsername(c)
	if !ok {
		return
	}

	if err := disable2FA(username); err != nil {
		logs.Log("[ERROR][ADMIN] failed to disable 2FA for user " + username + ": " + err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to disable 2FA"})
		return
	}

	// it fails only when the user has no session: nothing to revoke
	_ = store.RemoveAllJWTTokens(username)

	logs.Log("[INFO][ADMIN] 2FA disabled for user " + username + ", all sessions invalidated")
	c.Status(http.StatusNoContent)
}
