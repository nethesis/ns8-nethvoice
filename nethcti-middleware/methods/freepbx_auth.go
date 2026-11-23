/*
 * Copyright (C) 2026 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package methods

import (
	"context"
	"crypto/sha1"
	"crypto/subtle"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/nethesis/nethcti-middleware/configuration"
	"github.com/nethesis/nethcti-middleware/db"
	"github.com/nethesis/nethcti-middleware/logs"
)

const (
	supportMaxFailures   = 5
	supportFailureWindow = 5 * time.Minute
	// Bounds the memory unauthenticated requests can pin in supportFailures.
	supportMaxTracked = 10000
)

// Matches the ephemeral user created by the support tunnel-client.
var supportUsernameRe = regexp.MustCompile(`^support-[a-z0-9-]{1,64}$`)

// A real FreePBX SHA1 hash: an empty one would make the key derivable from the secret alone.
var sha1HexRe = regexp.MustCompile(`^[0-9a-fA-F]{40}$`)

var errUserNotFound = errors.New("user not found")

// Replaced in tests.
var (
	lookupSupportUserSHA1 = getSupportUserSHA1Password
	lookupAdminSHA1       = func() (string, error) { return getFreePBXUserSHA1Password("admin") }
)

type supportFailure struct {
	count int
	first time.Time
}

var (
	supportFailuresMu sync.Mutex
	supportFailures   = make(map[string]*supportFailure)
)

func queryAmpusersSHA1(query, username string) (string, error) {
	database := db.GetDB()
	if database == nil {
		return "", fmt.Errorf("database connection not available")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var sha1Pwd string
	err := database.QueryRowContext(ctx, query, username).Scan(&sha1Pwd)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", errUserNotFound
		}
		return "", fmt.Errorf("query ampusers: %w", err)
	}

	return sha1Pwd, nil
}

// getFreePBXUserSHA1Password queries the asterisk.ampusers table for a user's SHA1 password hash.
func getFreePBXUserSHA1Password(username string) (string, error) {
	return queryAmpusersSHA1("SELECT `password_sha1` FROM `asterisk`.`ampusers` WHERE `username` = ?", username)
}

// getSupportUserSHA1Password only matches rows shaped like the tunnel-client's
// ephemeral user (full-access sections).
func getSupportUserSHA1Password(username string) (string, error) {
	return queryAmpusersSHA1("SELECT `password_sha1` FROM `asterisk`.`ampusers` WHERE `username` = ? AND `sections` = '*'", username)
}

// computeFreePBXSecretKey computes SHA1(username + sha1Password + secretKey).
func computeFreePBXSecretKey(username, sha1Pwd, secret string) string {
	h := sha1.New()
	h.Write([]byte(username + sha1Pwd + secret))
	return hex.EncodeToString(h.Sum(nil))
}

func secretKeyMatches(provided, expected string) bool {
	return expected != "" && subtle.ConstantTimeCompare([]byte(provided), []byte(expected)) == 1
}

// supportFailureKey scopes the failure budget to one support user from one IP:
// every operator request reaches the middleware from the same proxy address.
func supportFailureKey(ip, username string) string {
	return ip + " " + username
}

// SupportAuthThrottled reports whether ip exceeded the failed login budget for username.
func SupportAuthThrottled(ip, username string) bool {
	return supportThrottled(supportFailureKey(ip, username))
}

func supportThrottled(ip string) bool {
	supportFailuresMu.Lock()
	defer supportFailuresMu.Unlock()

	f, ok := supportFailures[ip]
	if !ok {
		return false
	}
	if time.Since(f.first) > supportFailureWindow {
		delete(supportFailures, ip)
		return false
	}
	return f.count >= supportMaxFailures
}

func recordSupportFailure(ip string) {
	supportFailuresMu.Lock()
	defer supportFailuresMu.Unlock()

	now := time.Now()
	f, ok := supportFailures[ip]
	if !ok {
		if len(supportFailures) >= supportMaxTracked {
			for k, f := range supportFailures {
				if now.Sub(f.first) > supportFailureWindow {
					delete(supportFailures, k)
				}
			}
			if len(supportFailures) >= supportMaxTracked {
				return
			}
		}
		f = &supportFailure{first: now}
		supportFailures[ip] = f
	}
	f.count++
}

func clearSupportFailures(ip string) {
	supportFailuresMu.Lock()
	defer supportFailuresMu.Unlock()
	delete(supportFailures, ip)
}

// RewriteSupportToAdmin validates a support user's Secretkey against MariaDB
// and rewrites the request headers to use admin credentials.
// Returns true if the rewrite succeeded, false otherwise (caller should return 401).
func RewriteSupportToAdmin(c *gin.Context) bool {
	username := c.GetHeader("User")
	secretKey := c.GetHeader("Secretkey")
	secret := configuration.Config.NethVoiceSecretKey
	ip := c.ClientIP()
	key := supportFailureKey(ip, username)

	if secret == "" {
		logs.Log("[ERROR][FREEPBX_AUTH] NETHVOICESECRETKEY not configured, cannot validate support user")
		return false
	}

	// Not recorded: no lookup to throttle, and the key would be an arbitrary header.
	if !supportUsernameRe.MatchString(username) {
		logs.Log("[WARNING][FREEPBX_AUTH] malformed support username from " + ip)
		return false
	}

	userSHA1, err := lookupSupportUserSHA1(username)
	if err == nil && !sha1HexRe.MatchString(userSHA1) {
		err = errors.New("ampusers row has no valid password hash")
	}
	if err != nil {
		recordSupportFailure(key)
		logs.Log(fmt.Sprintf("[WARNING][FREEPBX_AUTH] support user %s from %s: %v", username, ip, err))
		return false
	}

	if !secretKeyMatches(secretKey, computeFreePBXSecretKey(username, userSHA1, secret)) {
		recordSupportFailure(key)
		logs.Log(fmt.Sprintf("[WARNING][FREEPBX_AUTH] invalid Secretkey for support user %s from %s", username, ip))
		return false
	}

	adminSHA1, err := lookupAdminSHA1()
	if err != nil {
		logs.Log(fmt.Sprintf("[ERROR][FREEPBX_AUTH] failed to get admin SHA1 password: %v", err))
		return false
	}

	clearSupportFailures(key)

	c.Request.Header.Set("User", "admin")
	c.Request.Header.Set("Secretkey", computeFreePBXSecretKey("admin", adminSHA1, secret))

	logs.Log(fmt.Sprintf("[INFO][FREEPBX_AUTH] rewrote headers for support user %s -> admin", username))
	return true
}

// IsSupportUser returns true if the User header starts with "support-" and Secretkey is present.
func IsSupportUser(c *gin.Context) bool {
	return strings.HasPrefix(c.GetHeader("User"), "support-") && c.GetHeader("Secretkey") != ""
}
