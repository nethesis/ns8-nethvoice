/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package utils

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/pquerna/otp/totp"
	"github.com/stretchr/testify/assert"
)

func PerformLogin(testServerURL string) string {
	loginData := map[string]string{
		"username": "testuser",
		"password": "testpass",
	}
	jsonData, _ := json.Marshal(loginData)

	resp, err := http.Post(testServerURL+"/login", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return ""
	}
	defer resp.Body.Close()

	var response map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&response)
	return response["token"].(string)
}

func Setup2FA(testServerURL string, token string, t *testing.T) string {
	client := &http.Client{}

	reqQRCode, _ := http.NewRequest("GET", testServerURL+"/2fa/qr-code", nil)
	reqQRCode.Header.Set("Authorization", "Bearer "+token)
	respQRCode, err := client.Do(reqQRCode)
	assert.NoError(t, err)
	defer respQRCode.Body.Close()
	assert.Equal(t, http.StatusOK, respQRCode.StatusCode)

	var qrResp map[string]interface{}
	err = json.NewDecoder(respQRCode.Body).Decode(&qrResp)
	assert.NoError(t, err)
	data := qrResp["data"].(map[string]interface{})
	otpSecret := data["key"].(string)
	assert.NotEmpty(t, otpSecret)

	return otpSecret
}

func Verify2FA(testServerURL string, otp string, token string, t *testing.T) string {
	client := &http.Client{}

	otpData := map[string]string{
		"username": "testuser",
		"otp":      otp,
	}

	jsonData, _ := json.Marshal(otpData)
	reqVerify, _ := http.NewRequest("POST", testServerURL+"/2fa/verify-otp", bytes.NewBuffer(jsonData))
	reqVerify.Header.Set("Content-Type", "application/json")
	reqVerify.Header.Set("Authorization", "Bearer "+token)
	respVerify, err := client.Do(reqVerify)
	assert.NoError(t, err)
	defer respVerify.Body.Close()
	assert.Equal(t, http.StatusOK, respVerify.StatusCode)

	var response map[string]interface{}
	err = json.NewDecoder(respVerify.Body).Decode(&response)
	assert.NoError(t, err)
	data, _ := response["data"].(map[string]interface{})
	newToken, _ := data["token"].(string)

	return newToken
}

// decodeJWTPart decodes a JWT base64url part
func DecodeJWTPart(part string) ([]byte, error) {
	decoded, err := base64.RawURLEncoding.DecodeString(part)
	if err != nil {
		decoded, err = base64.URLEncoding.DecodeString(part)
	}
	return decoded, err
}

// GenerateOTP generates a TOTP code for the given secret.
func GenerateOTP(secret string) string {
	code, err := totp.GenerateCode(secret, time.Now())
	if err != nil {
		return ""
	}

	return code
}
