/*
 * Copyright (C) 2026 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Package userportal is a client for the users-admin API (api-moduled) of
// the NS8 account provider (OpenLDAP or Samba) bound to NethVoice.
// Every call runs with the token of the user itself: the portal derives the
// target user from it, so the user's password is always required.
package userportal

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/nethesis/nethcti-middleware/configuration"
)

var (
	// ErrDisabled is returned when no user portal is configured
	ErrDisabled = errors.New("user portal is not configured")
	// ErrInvalidCredentials is returned when the portal rejects the credentials
	ErrInvalidCredentials = errors.New("invalid credentials")
	// ErrBusy is returned when too many requests are already running
	ErrBusy = errors.New("user portal is busy")
)

// The portal runs the provider tools (ldapwhoami, kinit...) in the
// provider container: keep a generous timeout
var client = &http.Client{Timeout: 20 * time.Second}

// The portal serializes the provider tools: bound the concurrent requests,
// so that a burst of failed logins does not queue up on the provider
var slots = make(chan struct{}, 4)

const slotWait = 10 * time.Second

// Expiration is the password expiration info of a user
type Expiration struct {
	Expired    bool    `json:"expired"`
	Expiration *string `json:"expiration"`
	MustChange bool    `json:"must_change"`
}

// Policy is the password policy of the account provider
type Policy struct {
	Expiration struct {
		Enforced bool `json:"enforced"`
		MaxAge   int  `json:"max_age"`
		MinAge   int  `json:"min_age"`
	} `json:"expiration"`
	Strength struct {
		Enforced          bool `json:"enforced"`
		HistoryLength     int  `json:"history_length"`
		PasswordMinLength int  `json:"password_min_length"`
		ComplexityCheck   bool `json:"complexity_check"`
	} `json:"strength"`
}

// Enabled reports whether a user portal is configured
func Enabled() bool {
	return configuration.Config.UserPortalURL != ""
}

func call(ctx context.Context, handler string, token string, body interface{}, out interface{}) (int, error) {
	if !Enabled() {
		return 0, ErrDisabled
	}

	select {
	case slots <- struct{}{}:
		defer func() { <-slots }()
	case <-time.After(slotWait):
		return 0, ErrBusy
	case <-ctx.Done():
		return 0, ctx.Err()
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return 0, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", configuration.Config.UserPortalURL+"/api/"+handler, bytes.NewBuffer(payload))
	if err != nil {
		return 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return resp.StatusCode, fmt.Errorf("user portal %s: unexpected status %d", handler, resp.StatusCode)
	}

	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return resp.StatusCode, fmt.Errorf("user portal %s: %w", handler, err)
	}

	return resp.StatusCode, nil
}

// Login returns a portal token for the user. A user with an expired password
// still gets a token, restricted to the password handlers.
func Login(ctx context.Context, username, password string) (string, error) {
	var resp struct {
		Token string `json:"token"`
	}
	status, err := call(ctx, "login", "", map[string]string{"username": username, "password": password}, &resp)
	if status == http.StatusUnauthorized {
		return "", ErrInvalidCredentials
	}
	if err != nil {
		return "", err
	}
	if resp.Token == "" {
		return "", errors.New("user portal login: empty token")
	}
	return resp.Token, nil
}

// GetPasswordExpiration returns the password expiration info of the token owner
func GetPasswordExpiration(ctx context.Context, token string) (*Expiration, error) {
	var resp struct {
		Status  string `json:"status"`
		Message string `json:"message"`
		Expiration
	}
	if _, err := call(ctx, "get-password-expiration", token, map[string]string{}, &resp); err != nil {
		return nil, err
	}
	if resp.Status != "success" {
		return nil, errors.New("user portal get-password-expiration: " + resp.Message)
	}
	return &resp.Expiration, nil
}

// GetPasswordPolicy returns the password policy of the account provider
func GetPasswordPolicy(ctx context.Context, token string) (*Policy, error) {
	var resp struct {
		Status string `json:"status"`
		Policy Policy `json:"policy"`
	}
	if _, err := call(ctx, "get-password-policy", token, map[string]string{}, &resp); err != nil {
		return nil, err
	}
	if resp.Status != "success" {
		return nil, errors.New("user portal get-password-policy: unexpected status " + resp.Status)
	}
	return &resp.Policy, nil
}

// ChangePassword changes the password of the token owner. It returns the
// portal result message, e.g. "password_changed" or "error_password_length".
func ChangePassword(ctx context.Context, token, currentPassword, newPassword string) (bool, string, error) {
	var resp struct {
		Status  string `json:"status"`
		Message string `json:"message"`
	}
	body := map[string]string{"current_password": currentPassword, "new_password": newPassword}
	if _, err := call(ctx, "change-password", token, body, &resp); err != nil {
		return false, "", err
	}
	return resp.Status == "success", resp.Message, nil
}
