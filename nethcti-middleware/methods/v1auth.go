/*
 * Copyright (C) 2026 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package methods

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/nethesis/nethcti-middleware/configuration"
	"github.com/nethesis/nethcti-middleware/logs"
	"github.com/nethesis/nethcti-middleware/models"
	"github.com/nethesis/nethcti-middleware/store"
	"github.com/nethesis/nethcti-middleware/utils"
)

// ErrV1AuthFailed is returned when the V1 server (nethcti-server) does not
// authenticate the user.
var ErrV1AuthFailed = errors.New("V1 authentication failed")

// ErrV1LoginRefused is returned when the V1 server refuses the login without
// a challenge, as it does for an expired password. It wraps ErrV1AuthFailed.
var ErrV1LoginRefused = fmt.Errorf("%w: login refused", ErrV1AuthFailed)

// ErrTrustedLoginDisabled is returned when a password-less login is requested
// but its secret is not configured.
var ErrTrustedLoginDisabled = errors.New("trusted login is not configured")

// LoginMode selects how LoginV1 authenticates the user on the V1 server.
type LoginMode int

const (
	// LoginPassword uses the user password.
	LoginPassword LoginMode = iota
	// LoginSSO uses the trusted SSO secret (the user has been authenticated
	// by the SSO front-end).
	LoginSSO
	// LoginInternal uses the super admin token, shared with the V1 server
	// through the module environment (admin endpoints).
	LoginInternal
)

// internalTokenKey derives the key of the legacy token of an internal login;
// the V1 server derives the same key (see authentication.internalLogin).
func internalTokenKey(secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte("nethcti-internal-login"))
	return hex.EncodeToString(mac.Sum(nil))
}

func v1URL(path string) string {
	return configuration.Config.V1Protocol + "://" + configuration.Config.V1ApiEndpoint + configuration.Config.V1ApiPath + path
}

// LoginV1 authenticates the user on the V1 server and returns the username
// of the account, as the V1 server names it, with the persistent NethCTIToken
// ("username:token") the middleware uses to call it.
//
// The V1 server also accepts other names for the same account (the main
// extension number, a different case): the session must always be keyed by
// the account username, so the login is repeated once with that username.
//
// With LoginPassword, password is the user password and it is also the key of
// the legacy token. The other modes need no user password: the request
// carries the username and a shared secret in dedicated headers, and the
// legacy token key is derived from that secret.
func LoginV1(username, password string, mode LoginMode) (string, string, error) {
	client := &http.Client{Timeout: 30 * time.Second}

	for attempt := 0; attempt < 2; attempt++ {
		NethCTIToken, accountUsername, err := loginV1Challenge(client, username, password, mode)
		if err != nil {
			return "", "", err
		}
		if accountUsername != username {
			if attempt == 0 && accountUsername != "" {
				logs.Log("[INFO][AUTH] login name " + username + " belongs to user " + accountUsername)
				username = accountUsername
				continue
			}
			logs.Log("[ERROR][AUTH] V1 server returned an unexpected username for user " + username)
			return "", "", ErrV1AuthFailed
		}

		token, err := persistentV1Token(client, username, NethCTIToken)
		if err != nil {
			return "", "", err
		}
		return username, username + ":" + token, nil
	}
	return "", "", ErrV1AuthFailed
}

// loginV1Challenge performs the V1 login challenge and returns the login token
// with the username reported by /user/me for it.
func loginV1Challenge(client *http.Client, username, password string, mode LoginMode) (string, string, error) {
	tokenPassword := password
	headers := map[string]string{}
	switch mode {
	case LoginSSO:
		if configuration.Config.SsoTrustedSecret == "" {
			return "", "", ErrTrustedLoginDisabled
		}
		password = configuration.Config.SsoTrustedSecret
		tokenPassword = configuration.Config.SsoTokenKey
		headers["X-SSO-User"] = username
		headers["X-SSO-Secret"] = configuration.Config.SsoTrustedSecret
	case LoginInternal:
		secret := configuration.Config.SuperAdminToken
		if secret == "" || configuration.Config.SuperAdminTokenGenerated {
			return "", "", ErrTrustedLoginDisabled
		}
		tokenPassword = internalTokenKey(secret)
		password = tokenPassword
		headers["X-Internal-User"] = username
		headers["X-Internal-Secret"] = secret
	}

	payloadBytes, _ := json.Marshal(map[string]string{"username": username, "password": password})
	req, err := http.NewRequest("POST", v1URL("/authentication/login"), bytes.NewBuffer(payloadBytes))
	if err != nil {
		logs.Log("[ERROR][AUTH] Failed to create HTTP request")
		return "", "", err
	}
	req.Header.Set("Content-Type", "application/json")
	for name, value := range headers {
		req.Header.Set(name, value)
	}

	// The client timeout avoids hanging indefinitely if the backend
	// leaves the response unfinished (e.g. an unhandled exception
	// that never calls resp.end() on the restify side).
	resp, err := client.Do(req)
	if err != nil {
		logs.Log("[ERROR][AUTH] Failed to send request to NetCTI")
		return "", "", ErrV1AuthFailed
	}
	resp.Body.Close()

	if resp.StatusCode != http.StatusUnauthorized || resp.Header.Get("Www-Authenticate") == "" {
		logs.Log("[ERROR][AUTH] Authentication failed for user " + username + " with status: " + resp.Status)
		if resp.StatusCode == http.StatusUnauthorized {
			return "", "", ErrV1LoginRefused
		}
		return "", "", ErrV1AuthFailed
	}

	// Generate NethCTIToken using the www-authenticate header
	NethCTIToken := utils.GenerateLegacyToken(resp, username, tokenPassword)
	if NethCTIToken == "" {
		logs.Log("[ERROR][AUTH] Failed to generate NethCTIToken")
		return "", "", ErrV1AuthFailed
	}

	meReq, _ := http.NewRequest("GET", v1URL("/user/me"), nil)
	meReq.Header.Set("Authorization", NethCTIToken)
	meResp, err := client.Do(meReq)
	if err != nil {
		logs.Log("[ERROR][AUTH] Failed to retry request to NetCTI")
		return "", "", ErrV1AuthFailed
	}
	defer meResp.Body.Close()

	if meResp.StatusCode != http.StatusOK {
		logs.Log("[ERROR][AUTH] Authentication failed for user " + username + " with status: " + meResp.Status)
		return "", "", ErrV1AuthFailed
	}

	var me struct {
		Username string `json:"username"`
	}
	if err := json.NewDecoder(meResp.Body).Decode(&me); err != nil {
		logs.Log("[ERROR][AUTH] Failed to parse the V1 user of " + username)
		return "", "", ErrV1AuthFailed
	}
	return NethCTIToken, me.Username, nil
}

// persistentV1Token exchanges the login token for a persistent one, used for
// the session.
func persistentV1Token(client *http.Client, username, NethCTIToken string) (string, error) {
	piPayloadBytes, _ := json.Marshal(map[string]string{"subtype": "user"})
	piReq, err := http.NewRequest("POST", v1URL("/authentication/phone_island_token_login"), bytes.NewBuffer(piPayloadBytes))
	if err != nil {
		return "", ErrV1AuthFailed
	}
	piReq.Header.Set("Authorization", NethCTIToken)
	piReq.Header.Set("Content-Type", "application/json")

	piResp, err := client.Do(piReq)
	if err != nil {
		logs.Log("[ERROR][AUTH] Failed to get persistent token from NetCTI for user " + username)
		return "", ErrV1AuthFailed
	}
	defer piResp.Body.Close()

	if piResp.StatusCode != http.StatusOK {
		logs.Log("[ERROR][AUTH] Failed to get persistent token from NetCTI for user " + username + " with status: " + piResp.Status)
		return "", ErrV1AuthFailed
	}

	var v1Resp struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(piResp.Body).Decode(&v1Resp); err != nil || v1Resp.Token == "" {
		logs.Log("[ERROR][AUTH] Failed to parse server v1 response for user " + username)
		return "", ErrV1AuthFailed
	}
	return v1Resp.Token, nil
}

// UpsertUserSession stores the NethCTIToken of a successful login, reusing the
// existing session (and its tokens) when the user already has one. It returns
// a copy of the session.
func UpsertUserSession(username, NethCTIToken string) *models.UserSession {
	var session models.UserSession
	reused := false
	tokens := 0
	store.ModifySessions(func(userSessions map[string]*models.UserSession) {
		if existingSession := userSessions[username]; existingSession != nil {
			// Note: a new login does NOT inherit OTP_Verified status - each JWT token is verified independently
			existingSession.NethCTIToken = NethCTIToken
			reused = true
			tokens = len(existingSession.JWTTokens)
			session = *existingSession
			return
		}

		userSessions[username] = &models.UserSession{
			Username:     username,
			JWTTokens:    nil,
			NethCTIToken: NethCTIToken,
			OTP_Verified: false,
		}
		session = *userSessions[username]
	})

	if reused {
		logs.Log("[INFO][AUTH] authentication success for user " + username + " (reusing existing session with " + strconv.Itoa(tokens) + " existing tokens)")
	} else {
		logs.Log("[INFO][AUTH] authentication success for user " + username + " (new session created)")
	}
	session.JWTTokens = nil
	return &session
}
