/*
 * Copyright (C) 2026 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package methods

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
	"unicode"

	jwt "github.com/appleboy/gin-jwt/v3"
	"github.com/fatih/structs"
	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"

	"github.com/nethesis/nethcti-middleware/configuration"
	"github.com/nethesis/nethcti-middleware/logs"
	"github.com/nethesis/nethcti-middleware/models"
	"github.com/nethesis/nethcti-middleware/socket"
	"github.com/nethesis/nethcti-middleware/store"
	"github.com/nethesis/nethcti-middleware/userportal"
)

// passwordInfo is the last password expiration info read from the user
// portal. It is cached on disk because the portal can be queried only with
// the user's password, that is available just at login and password change.
type passwordInfo struct {
	Expiration *string            `json:"expiration"`
	MustChange bool               `json:"must_change"`
	Policy     *userportal.Policy `json:"policy"`
	UpdatedAt  time.Time          `json:"updated_at"`
	// the info belongs to this provider: it is stale after a provider change
	PortalURL string `json:"portal_url"`
}

// Background refresh deadline, the request context is gone by then
const refreshTimeout = time.Minute

// Background refreshes in progress per user: until done, the cached info may
// be stale (e.g. the password was changed or expired since the last login)
var (
	refreshes      = map[string]int{}
	refreshesMutex sync.Mutex
)

// Expiration checks run on every login rejected by the V1 server, wrong
// passwords included: never queue them, when the slots are taken the login
// fails as usual
var expiryChecks = make(chan struct{}, 2)

// -------------------------------- exported methods --------------------------------

// IsPasswordExpired asks the user portal whether the credentials rejected by
// the V1 server belong to a user that must change the password. When so, it
// returns also the password policy (nil if not available) for the new password.
func IsPasswordExpired(ctx context.Context, username, password string) (bool, *userportal.Policy) {
	if !userportal.Enabled() || !validUsername(username) {
		return false, nil
	}

	select {
	case expiryChecks <- struct{}{}:
		defer func() { <-expiryChecks }()
	default:
		logs.Log("[WARNING][PASSWORD] too many concurrent checks, password expiration not checked for user " + username)
		return false, nil
	}

	token, err := userportal.Login(ctx, username, password)
	if err != nil {
		if !errors.Is(err, userportal.ErrInvalidCredentials) {
			logs.Log("[WARNING][PASSWORD] user portal login failed for user " + username + ": " + err.Error())
		}
		return false, nil
	}

	expiration, policy, err := readExpirationAndPolicy(ctx, username, token)
	if err != nil {
		logs.Log("[WARNING][PASSWORD] cannot read password expiration for user " + username + ": " + err.Error())
		return false, nil
	}
	if !expiration.Expired && !expiration.MustChange {
		return false, nil
	}
	return true, policy
}

// RefreshPasswordInfo reads in background the password expiration info of the
// user from the user portal and caches it. It runs at every login, as the
// password can be changed elsewhere too (e.g. the NS8 user portal). Errors are
// logged only: the info is optional.
func RefreshPasswordInfo(username, password string) {
	if !userportal.Enabled() || !validUsername(username) {
		return
	}

	// marked before returning: the info is reported as refreshing as soon as
	// the login completes
	setRefreshing(username, 1)
	go func() {
		defer setRefreshing(username, -1)

		ctx, cancel := context.WithTimeout(context.Background(), refreshTimeout)
		defer cancel()

		token, err := userportal.Login(ctx, username, password)
		if err != nil {
			logs.Log("[WARNING][PASSWORD] user portal login failed for user " + username + ": " + err.Error())
			return
		}

		refreshPasswordInfo(ctx, username, token)
	}()
}

// GetPasswordInfo returns the cached password expiration info of the user
func GetPasswordInfo(c *gin.Context) {
	claims := jwt.ExtractClaims(c)
	username := claims["id"].(string)

	// updated_at is null until the info is read from the user portal;
	// refreshing is true while it is read again after a login
	info := gin.H{
		"enabled":    userportal.Enabled(),
		"expiration": nil,
		"expired":    false,
		"policy":     nil,
		"updated_at": nil,
		"refreshing": isRefreshing(username),
	}

	if userportal.Enabled() {
		if cached, err := readPasswordInfo(username); err == nil {
			info["expiration"] = cached.Expiration
			info["expired"] = cached.MustChange || isExpired(cached.Expiration)
			info["policy"] = cached.Policy
			info["updated_at"] = cached.UpdatedAt
		}
	}

	c.JSON(http.StatusOK, structs.Map(models.StatusOK{
		Code:    200,
		Message: "password info",
		Data:    info,
	}))
}

// ChangePassword changes the password of a user that cannot log in because
// the password is expired. The current password authenticates the request.
func ChangePassword(c *gin.Context) {
	var request models.PasswordChangeJson
	if err := c.ShouldBindBodyWith(&request, binding.JSON); err != nil || request.Username == "" {
		c.JSON(http.StatusBadRequest, structs.Map(models.StatusBadRequest{
			Code:    400,
			Message: "request fields malformed",
			Data:    nil,
		}))
		return
	}

	changePassword(c, request.Username, request.CurrentPassword, request.NewPassword, true)
}

// ChangeUserPassword changes the password of the logged in user
func ChangeUserPassword(c *gin.Context) {
	var request models.PasswordChangeJson
	if err := c.ShouldBindBodyWith(&request, binding.JSON); err != nil {
		c.JSON(http.StatusBadRequest, structs.Map(models.StatusBadRequest{
			Code:    400,
			Message: "request fields malformed",
			Data:    nil,
		}))
		return
	}

	claims := jwt.ExtractClaims(c)
	changePassword(c, claims["id"].(string), request.CurrentPassword, request.NewPassword, false)
}

// -------------------------------- private methods --------------------------------

// changePassword changes the password through the user portal. With
// onlyExpired the request has no session (no 2FA either), so it is accepted
// only for a password that must be changed to log in.
func changePassword(c *gin.Context, username, currentPassword, newPassword string, onlyExpired bool) {
	if !userportal.Enabled() {
		c.JSON(http.StatusServiceUnavailable, structs.Map(models.StatusServiceUnavailable{
			Code:    503,
			Message: "password_change_unavailable",
			Data:    nil,
		}))
		return
	}

	if currentPassword == "" || newPassword == "" || !validUsername(username) {
		c.JSON(http.StatusBadRequest, structs.Map(models.StatusBadRequest{
			Code:    400,
			Message: "request fields malformed",
			Data:    nil,
		}))
		return
	}

	ctx := c.Request.Context()
	token, err := userportal.Login(ctx, username, currentPassword)
	if errors.Is(err, userportal.ErrInvalidCredentials) {
		// 400, not 401: clients treat a 401 as an expired session
		c.JSON(http.StatusBadRequest, structs.Map(models.StatusBadRequest{
			Code:    400,
			Message: "error_invalid_credentials",
			Data:    nil,
		}))
		return
	}
	if err != nil {
		logs.Log("[ERROR][PASSWORD] user portal login failed for user " + username + ": " + err.Error())
		c.JSON(http.StatusServiceUnavailable, structs.Map(models.StatusServiceUnavailable{
			Code:    503,
			Message: "password_change_unavailable",
			Data:    nil,
		}))
		return
	}

	if onlyExpired {
		expiration, err := userportal.GetPasswordExpiration(ctx, token)
		if err != nil {
			logs.Log("[ERROR][PASSWORD] cannot read password expiration for user " + username + ": " + err.Error())
			c.JSON(http.StatusServiceUnavailable, structs.Map(models.StatusServiceUnavailable{
				Code:    503,
				Message: "password_change_unavailable",
				Data:    nil,
			}))
			return
		}
		if !expiration.Expired && !expiration.MustChange {
			c.JSON(http.StatusForbidden, structs.Map(models.StatusForbidden{
				Code:    403,
				Message: "password_not_expired",
				Data:    nil,
			}))
			return
		}
	}

	changed, message, err := userportal.ChangePassword(ctx, token, currentPassword, newPassword)
	if err != nil {
		logs.Log("[ERROR][PASSWORD] password change failed for user " + username + ": " + err.Error())
		c.JSON(http.StatusServiceUnavailable, structs.Map(models.StatusServiceUnavailable{
			Code:    503,
			Message: "password_change_unavailable",
			Data:    nil,
		}))
		return
	}
	if !changed {
		logs.Log("[INFO][PASSWORD] password change rejected for user " + username + ": " + message)
		c.JSON(http.StatusBadRequest, structs.Map(models.StatusBadRequest{
			Code:    400,
			Message: message,
			Data:    nil,
		}))
		return
	}

	logs.Log("[INFO][PASSWORD] password changed for user " + username)

	// the portal token is still valid: refresh the cached expiration
	refreshPasswordInfo(ctx, username, token)

	// log out the other sessions, so they ask the new password now and not
	// when they expire. The request session and integration tokens stay valid
	keep := ""
	if !onlyExpired {
		keep = strings.TrimPrefix(c.GetHeader("Authorization"), "Bearer ")
	}
	if removed, err := store.RemoveSessionJWTTokens(username, keep); err != nil {
		logs.Log("[ERROR][PASSWORD] cannot log out the sessions of user " + username + ": " + err.Error())
	} else if removed > 0 {
		logs.Log(fmt.Sprintf("[INFO][PASSWORD] logged out %d session(s) of user %s", removed, username))
	}
	if closed := socket.CloseRevokedConnections(username); closed > 0 {
		logs.Log(fmt.Sprintf("[INFO][PASSWORD] closed %d websocket(s) of user %s", closed, username))
	}

	c.JSON(http.StatusOK, structs.Map(models.StatusOK{
		Code:    200,
		Message: "password_changed",
		Data:    nil,
	}))
}

func refreshPasswordInfo(ctx context.Context, username, token string) {
	expiration, policy, err := readExpirationAndPolicy(ctx, username, token)
	if err != nil {
		logs.Log("[WARNING][PASSWORD] cannot read password expiration for user " + username + ": " + err.Error())
		return
	}

	info := passwordInfo{
		Expiration: expiration.Expiration,
		MustChange: expiration.MustChange,
		Policy:     policy,
		UpdatedAt:  time.Now(),
		PortalURL:  configuration.Config.UserPortalURL,
	}

	if err := writePasswordInfo(username, info); err != nil {
		logs.Log("[ERROR][PASSWORD] cannot save password info for user " + username + ": " + err.Error())
	}
}

// readExpirationAndPolicy reads the password expiration and policy of the user
// at the same time, as every user portal call takes a while. The policy is a
// hint for the change password form: it is optional, nil when not available.
func readExpirationAndPolicy(ctx context.Context, username, token string) (*userportal.Expiration, *userportal.Policy, error) {
	policyCh := make(chan *userportal.Policy, 1)
	go func() {
		policy, err := userportal.GetPasswordPolicy(ctx, token)
		if err != nil {
			logs.Log("[WARNING][PASSWORD] cannot read password policy for user " + username + ": " + err.Error())
			policy = nil
		}
		policyCh <- policy
	}()

	expiration, err := userportal.GetPasswordExpiration(ctx, token)
	return expiration, <-policyCh, err
}

func setRefreshing(username string, delta int) {
	refreshesMutex.Lock()
	defer refreshesMutex.Unlock()
	refreshes[username] += delta
	if refreshes[username] <= 0 {
		delete(refreshes, username)
	}
}

func isRefreshing(username string) bool {
	refreshesMutex.Lock()
	defer refreshesMutex.Unlock()
	return refreshes[username] > 0
}

func isExpired(expiration *string) bool {
	if expiration == nil {
		return false
	}
	expiry, err := time.Parse(time.RFC3339, *expiration)
	if err != nil {
		return false
	}
	return time.Now().After(expiry)
}

// validUsername rejects names that would escape the per-user secrets dir or
// forge log lines
func validUsername(username string) bool {
	if username == "" || username == "." || username == ".." || strings.ContainsAny(username, "/\\") {
		return false
	}
	return strings.IndexFunc(username, unicode.IsControl) < 0
}

func passwordInfoPath(username string) string {
	return filepath.Join(configuration.Config.SecretsDir, username, "password_info.json")
}

func readPasswordInfo(username string) (*passwordInfo, error) {
	if !validUsername(username) {
		return nil, errors.New("invalid username")
	}

	data, err := os.ReadFile(passwordInfoPath(username))
	if err != nil {
		return nil, err
	}

	var info passwordInfo
	if err := json.Unmarshal(data, &info); err != nil {
		return nil, err
	}
	if info.PortalURL != configuration.Config.UserPortalURL {
		return nil, errors.New("password info of a different provider")
	}
	return &info, nil
}

func writePasswordInfo(username string, info passwordInfo) error {
	data, err := json.Marshal(info)
	if err != nil {
		return err
	}

	path := passwordInfoPath(username)
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}

	// write atomically: concurrent logins of the same user may race here
	tmp, err := os.CreateTemp(filepath.Dir(path), "password_info-*.tmp")
	if err != nil {
		return err
	}
	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		os.Remove(tmp.Name())
		return err
	}
	if err := tmp.Close(); err != nil {
		os.Remove(tmp.Name())
		return err
	}
	return os.Rename(tmp.Name(), path)
}
