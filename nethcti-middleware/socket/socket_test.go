package socket

import (
	"testing"
	"time"

	"github.com/nethesis/nethcti-middleware/models"
	"github.com/nethesis/nethcti-middleware/store"
)

func TestCloseRevokedConnections(t *testing.T) {
	server, serverConnCh := newWSTestServer(t)
	clientRevoked, serverRevoked := dialWS(t, server, serverConnCh)
	clientValid, serverValid := dialWS(t, server, serverConnCh)

	useTestConnManager(t)
	connManager.AddConnection(serverRevoked, &UserConnection{Username: "alice", AccessKeyId: "alice", JWTToken: "revoked"})
	connManager.AddConnection(serverValid, &UserConnection{Username: "alice", AccessKeyId: "alice", JWTToken: "valid"})

	originalSessions := store.UserSessions
	store.UserSessions = map[string]*models.UserSession{
		"alice": {Username: "alice", JWTTokens: []string{"valid"}},
	}
	t.Cleanup(func() { store.UserSessions = originalSessions })

	if closed := CloseRevokedConnections("alice"); closed != 1 {
		t.Fatalf("expected 1 closed connection, got %d", closed)
	}

	// the revoked client gets the socket.io disconnect packet, then the close
	clientRevoked.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, msg, err := clientRevoked.ReadMessage()
	if err != nil || string(msg) != "41" {
		t.Fatalf("expected socket.io disconnect packet, got %q (%v)", msg, err)
	}
	if _, _, err := clientRevoked.ReadMessage(); err == nil {
		t.Fatalf("expected the revoked connection to be closed")
	}

	clientValid.SetReadDeadline(time.Now().Add(200 * time.Millisecond))
	if _, _, err := clientValid.ReadMessage(); err == nil {
		t.Fatalf("did not expect messages on the valid connection")
	}
}
