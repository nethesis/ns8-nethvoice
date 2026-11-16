/*
 * Copyright (C) 2026 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/nethesis/nethcti-middleware/utils"
)

// mockPortalPasswords holds the user portal accounts: the V1 mock accepts
// only testuser/testpass, so expireduser can log in only on the portal
var mockPortalPasswords = map[string]string{}
var mockPortalMutex sync.Mutex

func resetMockPortal() {
	mockPortalMutex.Lock()
	defer mockPortalMutex.Unlock()
	mockPortalPasswords = map[string]string{
		"testuser":    "testpass",
		"expireduser": "oldpass",
	}
}

// Mock users-admin API (api-moduled) of the account provider
func mockUserPortalServer() *httptest.Server {
	resetMockPortal()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mockPortalMutex.Lock()
		defer mockPortalMutex.Unlock()

		var body map[string]string
		json.NewDecoder(r.Body).Decode(&body)
		user := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer tok-")
		if r.URL.Path != "/api/login" {
			if _, ok := mockPortalPasswords[user]; !ok {
				w.WriteHeader(http.StatusUnauthorized)
				w.Write([]byte(`{"code":401,"message":"auth header is empty"}`))
				return
			}
		}

		switch r.URL.Path {
		case "/api/login":
			if pass, ok := mockPortalPasswords[body["username"]]; ok && pass == body["password"] {
				json.NewEncoder(w).Encode(map[string]string{"token": "tok-" + body["username"]})
				return
			}
			w.WriteHeader(http.StatusUnauthorized)
			w.Write([]byte(`{"code":401,"message":"incorrect Username or Password"}`))
		case "/api/get-password-expiration":
			if user == "expireduser" {
				w.Write([]byte(`{"status":"success","message":"password_expiration","expired":true,"expiration":"2020-01-01T00:00:00Z","must_change":false}`))
				return
			}
			expiration := time.Now().Add(5 * 24 * time.Hour).UTC().Format(time.RFC3339)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"status": "success", "message": "password_expiration",
				"expired": false, "expiration": expiration, "must_change": false,
			})
		case "/api/get-password-policy":
			w.Write([]byte(`{"status":"success","message":"password_policy","policy":{"expiration":{"enforced":true,"max_age":180,"min_age":0},"strength":{"enforced":true,"history_length":12,"password_min_length":8,"complexity_check":true}}}`))
		case "/api/change-password":
			switch {
			case body["current_password"] != mockPortalPasswords[user]:
				w.Write([]byte(`{"status":"failure","message":"error_invalid_credentials"}`))
			case len(body["new_password"]) < 8:
				w.Write([]byte(`{"status":"failure","message":"error_password_length"}`))
			default:
				mockPortalPasswords[user] = body["new_password"]
				w.Write([]byte(`{"status":"success","message":"password_changed"}`))
			}
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
}

func postJSON(t *testing.T, path, token string, body interface{}) (int, map[string]interface{}) {
	payload, _ := json.Marshal(body)
	req, _ := http.NewRequest("POST", testServerURL+path, bytes.NewBuffer(payload))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	assert.NoError(t, err)
	defer resp.Body.Close()

	var response map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&response)
	return resp.StatusCode, response
}

func getPasswordInfo(t *testing.T, token string) (int, map[string]interface{}) {
	req, _ := http.NewRequest("GET", testServerURL+"/password/info", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	assert.NoError(t, err)
	defer resp.Body.Close()

	var response map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&response)
	data, _ := response["data"].(map[string]interface{})
	return resp.StatusCode, data
}

func TestLoginPasswordExpired(t *testing.T) {
	resetTestState()
	resetMockPortal()

	t.Run("expired password", func(t *testing.T) {
		status, response := postJSON(t, "/login", "", map[string]string{"username": "expireduser", "password": "oldpass"})
		assert.Equal(t, http.StatusUnauthorized, status)
		assert.Equal(t, "password_expired", response["message"])
		// the policy of the new password comes along
		data := response["data"].(map[string]interface{})
		strength := data["policy"].(map[string]interface{})["strength"].(map[string]interface{})
		assert.Equal(t, float64(8), strength["password_min_length"])
	})

	t.Run("wrong password is not reported as expired", func(t *testing.T) {
		status, response := postJSON(t, "/login", "", map[string]string{"username": "expireduser", "password": "wrong"})
		assert.Equal(t, http.StatusUnauthorized, status)
		assert.NotEqual(t, "password_expired", response["message"])
	})

	t.Run("unknown user", func(t *testing.T) {
		status, response := postJSON(t, "/login", "", map[string]string{"username": "nobody", "password": "x"})
		assert.Equal(t, http.StatusUnauthorized, status)
		assert.NotEqual(t, "password_expired", response["message"])
	})
}

func TestChangeExpiredPassword(t *testing.T) {
	resetTestState()
	resetMockPortal()

	t.Run("wrong current password", func(t *testing.T) {
		status, response := postJSON(t, "/password/change", "", map[string]string{
			"username": "expireduser", "current_password": "wrong", "new_password": "NewPass,1234",
		})
		assert.Equal(t, http.StatusBadRequest, status)
		assert.Equal(t, "error_invalid_credentials", response["message"])
	})

	t.Run("policy violation", func(t *testing.T) {
		status, response := postJSON(t, "/password/change", "", map[string]string{
			"username": "expireduser", "current_password": "oldpass", "new_password": "short",
		})
		assert.Equal(t, http.StatusBadRequest, status)
		assert.Equal(t, "error_password_length", response["message"])
	})

	t.Run("missing fields", func(t *testing.T) {
		status, _ := postJSON(t, "/password/change", "", map[string]string{"username": "expireduser"})
		assert.Equal(t, http.StatusBadRequest, status)
	})

	t.Run("password not expired", func(t *testing.T) {
		// without a session there is no 2FA: only expired passwords can be changed
		status, response := postJSON(t, "/password/change", "", map[string]string{
			"username": "testuser", "current_password": "testpass", "new_password": "NewPass,1234",
		})
		assert.Equal(t, http.StatusForbidden, status)
		assert.Equal(t, "password_not_expired", response["message"])
		assert.Equal(t, "testpass", mockPortalPasswords["testuser"])
	})

	t.Run("path traversal username", func(t *testing.T) {
		status, _ := postJSON(t, "/password/change", "", map[string]string{
			"username": "../expireduser", "current_password": "oldpass", "new_password": "NewPass,1234",
		})
		assert.Equal(t, http.StatusBadRequest, status)
	})

	t.Run("password changed", func(t *testing.T) {
		status, response := postJSON(t, "/password/change", "", map[string]string{
			"username": "expireduser", "current_password": "oldpass", "new_password": "NewPass,1234",
		})
		assert.Equal(t, http.StatusOK, status)
		assert.Equal(t, "password_changed", response["message"])
		assert.Equal(t, "NewPass,1234", mockPortalPasswords["expireduser"])
	})
}

func TestPasswordInfoAndUserPasswordChange(t *testing.T) {
	resetTestState()
	resetMockPortal()

	token := utils.PerformLogin(testServerURL)

	t.Run("info cached at login", func(t *testing.T) {
		// the info is fetched in background after the login
		var data map[string]interface{}
		assert.Eventually(t, func() bool {
			_, data = getPasswordInfo(t, token)
			return data["refreshing"] == false && data["expiration"] != nil
		}, 5*time.Second, 100*time.Millisecond)

		assert.Equal(t, true, data["enabled"])
		assert.NotNil(t, data["updated_at"])
		assert.Equal(t, false, data["expired"])
		policy := data["policy"].(map[string]interface{})
		strength := policy["strength"].(map[string]interface{})
		assert.Equal(t, float64(8), strength["password_min_length"])
	})

	t.Run("requires authentication", func(t *testing.T) {
		status, _ := postJSON(t, "/user/password", "", map[string]string{"current_password": "testpass", "new_password": "NewPass,1234"})
		assert.Equal(t, http.StatusUnauthorized, status)
	})

	t.Run("wrong current password", func(t *testing.T) {
		status, response := postJSON(t, "/user/password", token, map[string]string{"current_password": "wrong", "new_password": "NewPass,1234"})
		assert.Equal(t, http.StatusBadRequest, status)
		assert.Equal(t, "error_invalid_credentials", response["message"])
	})

	t.Run("username in body is ignored", func(t *testing.T) {
		status, _ := postJSON(t, "/user/password", token, map[string]string{
			"username": "expireduser", "current_password": "oldpass", "new_password": "NewPass,1234",
		})
		assert.Equal(t, http.StatusBadRequest, status)
		assert.Equal(t, "oldpass", mockPortalPasswords["expireduser"])
	})

	t.Run("password changed", func(t *testing.T) {
		// tokens issued in the same second are equal
		time.Sleep(time.Second)
		otherSession := utils.PerformLogin(testServerURL)
		assert.NotEqual(t, token, otherSession)
		status, response := postJSON(t, "/tokens/persistent/mobile-app", token, map[string]string{})
		assert.Equal(t, http.StatusOK, status)
		integrationToken := response["token"].(string)

		status, response = postJSON(t, "/user/password", token, map[string]string{"current_password": "testpass", "new_password": "NewPass,1234"})
		assert.Equal(t, http.StatusOK, status)
		assert.Equal(t, "password_changed", response["message"])
		assert.Equal(t, "NewPass,1234", mockPortalPasswords["testuser"])

		// the other sessions are logged out, the request one and the
		// integration tokens stay valid
		status, _ = getPasswordInfo(t, otherSession)
		assert.Equal(t, http.StatusForbidden, status)
		status, _ = getPasswordInfo(t, token)
		assert.Equal(t, http.StatusOK, status)
		status, _ = getPasswordInfo(t, integrationToken)
		assert.Equal(t, http.StatusOK, status)
	})
}
