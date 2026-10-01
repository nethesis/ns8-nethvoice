// Package svcauth: short-lived password signed with the module secret, accepted by
// chat-extauth; the gateway uses it to read archive ids for phone pushes.
package svcauth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"strconv"
	"strings"
	"time"
)

const (
	prefix = "svc1:"
	maxAge = 60 * time.Second
)

// Password returns the service password for user@host, valid for a minute.
func Password(secret, user, host string, now time.Time) string {
	ts := strconv.FormatInt(now.Unix(), 10)
	return prefix + ts + ":" + sign(secret, user, host, ts)
}

// IsService tells a service password apart from a CTI token.
func IsService(password string) bool { return strings.HasPrefix(password, prefix) }

// Valid checks a service password for user@host.
func Valid(secret, user, host, password string, now time.Time) bool {
	if secret == "" || !IsService(password) {
		return false
	}
	ts, mac, ok := strings.Cut(strings.TrimPrefix(password, prefix), ":")
	if !ok {
		return false
	}
	sec, err := strconv.ParseInt(ts, 10, 64)
	if err != nil {
		return false
	}
	if age := now.Sub(time.Unix(sec, 0)); age > maxAge || age < -maxAge {
		return false
	}
	return hmac.Equal([]byte(mac), []byte(sign(secret, user, host, ts)))
}

func sign(secret, user, host, ts string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(user + "@" + host + "|" + ts))
	return hex.EncodeToString(h.Sum(nil))
}
