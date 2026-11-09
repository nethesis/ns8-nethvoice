package main

import (
	"testing"
	"time"

	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/svcauth"
)

func TestHandle(t *testing.T) {
	secret = "s3cret"
	now := time.Now()
	who := func(token string) string {
		if token == "jwt-of-mario" {
			return "mario"
		}
		return ""
	}
	svc := func(user string) string { return svcauth.Password(secret, user, "chat.internal", now) }
	cases := map[string]bool{
		"auth:mario:chat.internal:jwt-of-mario":                      true,
		"auth:luigi:chat.internal:jwt-of-mario":                      false,
		"auth:mario:chat.internal:" + svc("mario"):                   true,
		"auth:g~0123456789ab:chat.internal:" + svc("g~0123456789ab"): true,
		"auth:g~0123456789ab:chat.internal:jwt-of-mario":             false, // a guest only through the gateway
		"auth:g~0123456789ab:chat.internal:" + svc("mario"):          false,
		"auth:g~nothex000000:chat.internal:" + svc("g~nothex000000"): false,
		"auth:Mario:chat.internal:" + svc("Mario"):                   false,
		"isuser:mario:chat.internal":                                 true,
		"isuser:g~0123456789ab:chat.internal":                        true,
		"isuser:g~x:chat.internal":                                   false,
		"setpass:mario:chat.internal:x":                              false,
	}
	for req, want := range cases {
		if got := handle(req, who, now); got != want {
			t.Errorf("handle(%q) = %v, want %v", req, got, want)
		}
	}
	if svcauth.Secret(func(k string) string { return map[string]string{"CHAT_COMPONENT_SECRET": "c"}[k] }) != "" {
		t.Error("service key derived from the component secret")
	}
}
