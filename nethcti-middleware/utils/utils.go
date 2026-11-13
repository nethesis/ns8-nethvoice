/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package utils

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/hex"
	"net/http"
	"strconv"
	"strings"
	"time"
)

func GenerateLegacyToken(res *http.Response, username, password string) string {
	wwwAuth := res.Header.Get("Www-Authenticate")
	parts := strings.Split(wwwAuth, " ")
	if len(parts) < 2 {
		return ""
	}

	nonce := parts[1]
	message := username + ":" + password + ":" + nonce

	mac := hmac.New(sha1.New, []byte(password))
	mac.Write([]byte(message))
	token := hex.EncodeToString(mac.Sum(nil))

	token = username + ":" + token

	return token
}

func Contains(a string, values []string) bool {
	for _, b := range values {
		if b == a {
			return true
		}
	}
	return false
}

func Remove(a string, values []string) []string {
	for i, v := range values {
		if v == a {
			return append(values[:i], values[i+1:]...)
		}
	}
	return values
}

func EpochToHumanDate(epochTime int) string {
	i, err := strconv.ParseInt(strconv.Itoa(epochTime), 10, 64)
	if err != nil {
		return "-"
	}
	tm := time.Unix(i, 0)
	return tm.Format("2006-01-02 15:04:05")
}
