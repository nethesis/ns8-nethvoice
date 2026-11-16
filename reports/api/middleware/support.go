/*
 * Copyright (C) 2026 Nethesis S.r.l.
 * http://www.nethesis.it - info@nethesis.it
 *
 * This file is part of NethVoice Report project.
 *
 * NethVoice Report is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License,
 * or any later version.
 *
 * NethVoice Report is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with NethVoice Report.  If not, see COPYING.
 */

package middleware

import (
	"crypto/hmac"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"net/http"
	"regexp"
	"sync"
	"time"

	jwt "github.com/appleboy/gin-jwt/v2"
	"github.com/gin-gonic/gin"

	"github.com/nethesis/nethvoice-report/api/configuration"
	"github.com/nethesis/nethvoice-report/api/methods"
)

const (
	supportUserKey      = "support_user"
	supportExpKey       = "support_exp"
	supportBindKey      = "support_bind"
	supportExpireCtxKey = "support_expire"
	supportTokenTimeout = time.Hour
	supportCheckTTL     = time.Minute

	// Same message as an expired JWT, which makes the UI show the login page.
	supportExpiredMessage = "Token is expired"
)

// Matches the ephemeral ampusers row created by the support tunnel-client.
var supportUsernameRe = regexp.MustCompile(`^support-[a-z0-9-]{1,64}$`)

// supportLogin is the identity of a support session: it is authorized as
// admin, but the token keeps the real user and a short expiration.
type supportLogin struct {
	User    string
	Expire  time.Time
	Binding string
}

// Replaced in tests.
var supportUserHash = methods.GetSupportUserHashPass

var (
	supportSeenMu sync.Mutex
	supportSeen   = make(map[string]time.Time)
)

func sha1Matches(password string, storedHash string) bool {
	hash := fmt.Sprintf("%x", sha1.Sum([]byte(password)))
	return storedHash != "" && subtle.ConstantTimeCompare([]byte(hash), []byte(storedHash)) == 1
}

// supportBinding ties a support token to the ampusers row it was issued for:
// every session regenerates the password, so a token from an earlier session
// stays dead even when the same username is created again.
func supportBinding(storedHash string) string {
	mac := hmac.New(sha256.New, []byte(configuration.Config.Secret))
	mac.Write([]byte(storedHash))
	return hex.EncodeToString(mac.Sum(nil))[:32]
}

func markSupportUserSeen(user, binding string) {
	supportSeenMu.Lock()
	supportSeen[user+"|"+binding] = time.Now()
	supportSeenMu.Unlock()
}

// supportUserStillValid checks that the ampusers row the token was issued for
// still exists, unchanged, caching positive answers for supportCheckTTL.
func supportUserStillValid(user, binding string) bool {
	key := user + "|" + binding
	supportSeenMu.Lock()
	seen, ok := supportSeen[key]
	supportSeenMu.Unlock()
	if ok && time.Since(seen) < supportCheckTTL {
		return true
	}

	hash := supportUserHash(user)
	if hash == "" || subtle.ConstantTimeCompare([]byte(supportBinding(hash)), []byte(binding)) != 1 {
		supportSeenMu.Lock()
		delete(supportSeen, key)
		supportSeenMu.Unlock()
		return false
	}

	markSupportUserSeen(user, binding)
	return true
}

// validSupportClaims reports whether the token carries a support identity
// and, if so, whether it is still valid and until when.
func validSupportClaims(claims map[string]interface{}) (expire time.Time, isSupport bool, valid bool) {
	raw, isSupport := claims[supportUserKey]
	if !isSupport {
		return time.Time{}, false, false
	}

	user, ok := raw.(string)
	if !ok || !supportUsernameRe.MatchString(user) {
		return time.Time{}, true, false
	}
	exp, ok := claims[supportExpKey].(float64)
	if !ok {
		return time.Time{}, true, false
	}
	expire = time.Unix(int64(exp), 0)
	if !time.Now().Before(expire) {
		return expire, true, false
	}
	binding, ok := claims[supportBindKey].(string)
	if !ok || binding == "" {
		return expire, true, false
	}

	return expire, true, supportUserStillValid(user, binding)
}

// SupportSession rejects support tokens once expired or once the support
// user has been removed from ampusers.
func SupportSession() gin.HandlerFunc {
	return func(c *gin.Context) {
		if _, isSupport, valid := validSupportClaims(jwt.ExtractClaims(c)); isSupport && !valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": supportExpiredMessage})
			return
		}
		c.Next()
	}
}

// RefreshHandler never extends a support token: a still valid one is
// returned unchanged, so a page reload keeps working until it expires.
func RefreshHandler(mw *jwt.GinJWTMiddleware) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, err := mw.CheckIfTokenExpire(c)
		if err == nil {
			if expire, isSupport, valid := validSupportClaims(claims); isSupport {
				if !valid {
					c.JSON(http.StatusUnauthorized, gin.H{"message": supportExpiredMessage})
					return
				}
				mw.RefreshResponse(c, http.StatusOK, jwt.GetToken(c), expire)
				return
			}
		}
		mw.RefreshHandler(c)
	}
}
