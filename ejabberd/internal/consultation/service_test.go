package consultation

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/store"
	"github.com/nethesis/ns8-nethvoice/ejabberd/internal/xmppc"
)

func TestPrivateAuthCorrelationExpiryAndIdempotency(t *testing.T) {
	st, err := store.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC()
	sent := 0
	chat := true
	fail := false
	messages := []xmppc.Message{}
	service := &Service{Store: st, Host: "chat.internal", Token: strings.Repeat("t", 32),
		Read: func(context.Context, string) (Recipient, error) {
			return Recipient{Version: 1, ID: "alice", Extension: "203", Chat: chat, Presence: "dnd", At: time.Now()}, nil
		},
		Send: func(_ context.Context, id, to, body string) error {
			sent++
			if fail {
				return errors.New("uncertain")
			}
			return nil
		},
		History: func(context.Context) ([]xmppc.Message, error) { return messages, nil }}
	handler := service.Handler()
	request := func(method, path string, body interface{}, auth bool) *httptest.ResponseRecorder {
		encoded, _ := json.Marshal(body)
		req := httptest.NewRequest(method, path, bytes.NewReader(encoded))
		if auth {
			req.Header.Set("Authorization", "Bearer "+service.Token)
		}
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, req)
		return response
	}
	payload := map[string]interface{}{"id": strings.Repeat("a", 32), "recipient": "alice", "mainextension": "203", "reference": "ABCDEF12", "body": "Synthetic call reason", "expires_at": now.Add(time.Minute)}
	if r := request("POST", "/v1/consultations/messages", payload, false); r.Code != 401 {
		t.Fatal(r.Code)
	}
	if r := request("GET", "/healthz", nil, true); r.Code != 404 {
		t.Fatal("private mux includes public routes")
	}
	if r := request("POST", "/v1/consultations/messages", payload, true); r.Code != 204 {
		t.Fatal(r.Code, r.Body.String())
	}
	if r := request("POST", "/v1/consultations/messages", payload, true); r.Code != 204 || sent != 1 {
		t.Fatal("duplicate resend", r.Code, sent)
	}
	payload["body"] = "Changed reason"
	if r := request("POST", "/v1/consultations/messages", payload, true); r.Code != 409 {
		t.Fatal("same id changed body", r.Code)
	}
	payload["body"] = "Synthetic call reason"
	handler = service.Handler() // A gateway reconnect retains idempotency, never acceptance.
	if r := request("POST", "/v1/consultations/messages", payload, true); r.Code != 204 || sent != 1 {
		t.Fatal("restart resent message", r.Code, sent)
	}
	raw, _ := st.Meta("consultation:" + strings.Repeat("a", 32))
	if strings.Contains(raw, "Synthetic call reason") {
		t.Fatal("message body persisted in receipt")
	}
	payload["recipient"] = "bob"
	if r := request("POST", "/v1/consultations/messages", payload, true); r.Code != 403 {
		t.Fatal("recipient impersonation", r.Code)
	}
	payload["recipient"] = "alice"
	payload["expires_at"] = now.Add(-time.Second)
	if r := request("POST", "/v1/consultations/messages", payload, true); r.Code != 400 {
		t.Fatal("expired send", r.Code)
	}
	payload["expires_at"] = now.Add(time.Minute)
	at := time.Now().UTC().Add(time.Millisecond)
	good := xmppc.Message{ID: "reply-1", From: "alice@chat.internal", To: Identity + "@chat.internal", Body: "#ABCDEF12 Yes, connect.", At: at}
	messages = append(messages, good)
	for _, bad := range []xmppc.Message{
		{ID: "forged", From: "bob@chat.internal", To: good.To, Body: good.Body, At: at},
		{ID: "bare", From: good.From, To: good.To, Body: "yes", At: at},
		{ID: "quoted", From: good.From, To: good.To, Body: "> #ABCDEF12\nyes", At: at},
		{ID: "expired", From: good.From, To: good.To, Body: good.Body, At: now.Add(time.Hour)},
		{ID: "old", From: good.From, To: good.To, Body: good.Body, At: now.Add(-time.Minute)},
		{ID: "wrong-ref", From: good.From, To: good.To, Body: "#00000000 yes", At: at},
		{ID: "wrong-target", From: good.From, To: "bob@chat.internal", Body: good.Body, At: at},
	} {
		messages = append(messages, bad)
	}
	result := request("GET", "/v1/consultations/replies?id="+strings.Repeat("a", 32), nil, true)
	var replies struct {
		Replies []struct{ ID, Sender, Reference, Text string }
	}
	if result.Code != 200 || json.Unmarshal(result.Body.Bytes(), &replies) != nil || len(replies.Replies) != 1 || replies.Replies[0].ID != "reply-1" {
		t.Fatal("correlation", result.Code, result.Body.String())
	}
	chat = false
	if r := request("GET", "/v1/consultations/replies?id="+strings.Repeat("a", 32), nil, true); r.Code != 403 {
		t.Fatal("permission revoked", r.Code)
	}
	chat = true
	fail = true
	payload["id"] = strings.Repeat("b", 32)
	if r := request("POST", "/v1/consultations/messages", payload, true); r.Code != 503 {
		t.Fatal("uncertain send", r.Code)
	}
	count := sent
	if r := request("POST", "/v1/consultations/messages", payload, true); r.Code != 503 || sent != count {
		t.Fatal("uncertain send replayed", r.Code)
	}
	if !service.DND(context.Background(), "alice") {
		t.Fatal("DND must use native state without human login")
	}
}

func TestRecipientReaderIsPrivateAndRejectsStaleState(t *testing.T) {
	if _, err := Reader("http://example.org:80", strings.Repeat("t", 32)); err == nil {
		t.Fatal("external service")
	}
	if _, err := Reader("http://user@127.0.0.1:80", strings.Repeat("t", 32)); err == nil {
		t.Fatal("URL credentials")
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer "+strings.Repeat("t", 32) {
			t.Error("scoped auth missing")
		}
		json.NewEncoder(w).Encode(Recipient{Version: 1, ID: "alice", Extension: "203", Chat: true, Presence: "online", Device: "online", At: time.Now().Add(-time.Minute)})
	}))
	defer server.Close()
	read, err := Reader(server.URL, strings.Repeat("t", 32))
	if err != nil {
		t.Fatal(err)
	}
	if _, err = read(context.Background(), "203"); err == nil {
		t.Fatal("stale state accepted")
	}
	for _, address := range []string{"0.0.0.0:8000", "[::]:8000", "example.org:8000"} {
		if Loopback(address) {
			t.Fatal(address)
		}
	}
}
