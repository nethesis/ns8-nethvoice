package socket

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestBroadcastSummaryMessageSendsSatelliteSummaryEvent(t *testing.T) {
	serverConnCh := make(chan *websocket.Conn, 1)
	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("failed to upgrade websocket: %v", err)
			return
		}
		serverConnCh <- conn
	}))
	defer server.Close()

	clientConn, _, err := websocket.DefaultDialer.Dial("ws"+server.URL[len("http"):], nil)
	if err != nil {
		t.Fatalf("failed to dial websocket: %v", err)
	}
	defer clientConn.Close()

	serverConn := <-serverConnCh
	defer serverConn.Close()

	originalManager := connManager
	connManager = &ConnectionManager{
		connections: make(map[*websocket.Conn]*UserConnection),
	}
	defer func() {
		connManager = originalManager
	}()

	connManager.AddConnection(serverConn, &UserConnection{})

	BroadcastSummaryMessage(map[string]string{
		"uniqueid": "abc123",
	})

	clientConn.SetReadDeadline(time.Now().Add(2 * time.Second))

	eventName, payload := readSocketIOEvent(t, clientConn)

	if eventName != "satellite/summary" {
		t.Fatalf("expected satellite/summary event, got %q", eventName)
	}
	if payload["uniqueid"] != "abc123" {
		t.Fatalf("unexpected summary payload: %#v", payload)
	}
}

func TestBroadcastSummaryMessageTargetsOnlyMatchingUser(t *testing.T) {
	serverConnCh := make(chan *websocket.Conn, 2)
	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("failed to upgrade websocket: %v", err)
			return
		}
		serverConnCh <- conn
	}))
	defer server.Close()

	clientConnAlice, _, err := websocket.DefaultDialer.Dial("ws"+server.URL[len("http"):], nil)
	if err != nil {
		t.Fatalf("failed to dial alice websocket: %v", err)
	}
	defer clientConnAlice.Close()

	clientConnBob, _, err := websocket.DefaultDialer.Dial("ws"+server.URL[len("http"):], nil)
	if err != nil {
		t.Fatalf("failed to dial bob websocket: %v", err)
	}
	defer clientConnBob.Close()

	serverConnAlice := <-serverConnCh
	defer serverConnAlice.Close()
	serverConnBob := <-serverConnCh
	defer serverConnBob.Close()

	originalManager := connManager
	connManager = &ConnectionManager{
		connections: make(map[*websocket.Conn]*UserConnection),
	}
	defer func() {
		connManager = originalManager
	}()

	connManager.AddConnection(serverConnAlice, &UserConnection{Username: "alice"})
	connManager.AddConnection(serverConnBob, &UserConnection{Username: "bob"})

	BroadcastSummaryMessage(map[string]interface{}{
		"uniqueid": "abc123",
		"username": "alice",
	})

	clientConnAlice.SetReadDeadline(time.Now().Add(2 * time.Second))
	eventName, payload := readSocketIOEvent(t, clientConnAlice)

	if eventName != "satellite/summary" {
		t.Fatalf("expected satellite/summary event, got %q", eventName)
	}
	if payload["uniqueid"] != "abc123" {
		t.Fatalf("unexpected summary payload: %#v", payload)
	}

	clientConnBob.SetReadDeadline(time.Now().Add(200 * time.Millisecond))
	if _, _, err := clientConnBob.ReadMessage(); err == nil {
		t.Fatalf("did not expect summary event for non-target user")
	}
}

func readSocketIOEvent(t *testing.T, conn *websocket.Conn) (string, map[string]string) {
	t.Helper()

	_, msg, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("failed to read websocket message: %v", err)
	}

	if len(msg) < 3 || string(msg[:2]) != "42" {
		t.Fatalf("unexpected socket.io frame: %q", string(msg))
	}

	var payload []json.RawMessage
	if err := json.Unmarshal(msg[2:], &payload); err != nil {
		t.Fatalf("failed to decode socket.io payload: %v", err)
	}
	if len(payload) != 2 {
		t.Fatalf("unexpected socket.io payload length: %d", len(payload))
	}

	var eventName string
	if err := json.Unmarshal(payload[0], &eventName); err != nil {
		t.Fatalf("failed to decode event name: %v", err)
	}

	var body map[string]string
	if err := json.Unmarshal(payload[1], &body); err != nil {
		t.Fatalf("failed to decode event body: %v", err)
	}

	return eventName, body
}
