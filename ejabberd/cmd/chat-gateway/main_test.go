package main

import (
	"context"
	"net"
	"strings"
	"testing"
)

func TestOptionalConsultationCannotBlockChatStartup(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	t.Setenv("VOICE_AGENT_RECIPIENT_URL", "http://127.0.0.1:12345")
	t.Setenv("VOICE_AGENT_RECIPIENT_TOKEN", strings.Repeat("r", 32))
	t.Setenv("VOICE_AGENT_CHAT_TOKEN", strings.Repeat("c", 32))
	for _, addr := range []string{"", "127.0.0.1:", listener.Addr().String()} {
		t.Setenv("CHAT_CONSULTATION_LISTEN", addr)
		if srv := startConsultation(context.Background(), nil, nil, nil, "", "", ""); srv != nil {
			t.Fatalf("unexpected consultation listener at %q", addr)
		}
	}
}
