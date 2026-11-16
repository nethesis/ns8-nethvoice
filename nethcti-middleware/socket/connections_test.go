package socket

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

// newWSTestServer starts a server that upgrades every request and hands the
// server side of each connection over the returned channel.
func newWSTestServer(t *testing.T) (*httptest.Server, <-chan *websocket.Conn) {
	t.Helper()

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
	t.Cleanup(server.Close)

	return server, serverConnCh
}

// dialWS opens one client connection and returns it paired with the server
// side of that same connection.
//
// The pairing is done one connection at a time on purpose. Dialing both
// clients first and only then reading two values off the channel assumes the
// server handles the two upgrades in the order they were dialed, which it
// does not guarantee: when the second upgrade completes first the two server
// connections are swapped, every user is registered under the other user's
// name, and the test fails on a read deadline.
func dialWS(t *testing.T, server *httptest.Server, serverConnCh <-chan *websocket.Conn) (client, serverSide *websocket.Conn) {
	t.Helper()

	client, _, err := websocket.DefaultDialer.Dial("ws"+server.URL[len("http"):], nil)
	if err != nil {
		t.Fatalf("failed to dial websocket: %v", err)
	}
	t.Cleanup(func() { client.Close() })

	select {
	case serverSide = <-serverConnCh:
		t.Cleanup(func() { serverSide.Close() })
		return client, serverSide
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for the server side of the websocket")
		return nil, nil
	}
}

// useTestConnManager swaps the package level manager for an empty one.
func useTestConnManager(t *testing.T) {
	t.Helper()

	originalManager := connManager
	connManager = &ConnectionManager{
		connections: make(map[*websocket.Conn]*UserConnection),
	}
	t.Cleanup(func() { connManager = originalManager })
}

func TestBroadcastSummaryMessageSendsSatelliteSummaryEvent(t *testing.T) {
	server, serverConnCh := newWSTestServer(t)
	clientConn, serverConn := dialWS(t, server, serverConnCh)

	useTestConnManager(t)
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
	server, serverConnCh := newWSTestServer(t)
	clientConnAlice, serverConnAlice := dialWS(t, server, serverConnCh)
	clientConnBob, serverConnBob := dialWS(t, server, serverConnCh)

	useTestConnManager(t)
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
