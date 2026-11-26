/*
 * Copyright (C) 2026 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package methods

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"math/big"
	"net"
	"net/http"
	"strconv"
	"time"

	jwt "github.com/appleboy/gin-jwt/v3"
	"github.com/gin-gonic/gin"
	"github.com/nethesis/nethcti-middleware/configuration"
	"github.com/nethesis/nethcti-middleware/logs"
	"github.com/nethesis/nethcti-middleware/store"
)

const ScreenShareRoomsPath = "/screen-sharing/rooms"

const maxScreenShareRoomID = 1<<53 - 1

var screenShareHTTP = &http.Client{
	Timeout: 4 * time.Second,
	CheckRedirect: func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	},
}

type ScreenShareRooms struct {
	db    *sql.DB
	janus screenShareJanus
}

func NewScreenShareRooms(db *sql.DB, port, adminKey string) *ScreenShareRooms {
	rooms := &ScreenShareRooms{db: db}
	if portNumber, err := strconv.Atoi(port); err == nil && portNumber > 0 && portNumber <= 65535 && adminKey != "" {
		rooms.janus = screenShareJanus{
			url:      "http://" + net.JoinHostPort("127.0.0.1", strconv.Itoa(portNumber)) + "/janus",
			adminKey: adminKey,
		}
	}
	return rooms
}

func (rooms *ScreenShareRooms) Create(c *gin.Context) {
	var input struct {
		ConversationID string `json:"conversationId"`
	}
	decoder := json.NewDecoder(c.Request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil || input.ConversationID == "" || decoder.Decode(new(any)) != io.EOF {
		c.JSON(http.StatusBadRequest, gin.H{"message": "A conversationId string is required"})
		return
	}

	username, _ := jwt.ExtractClaims(c)["id"].(string)
	caps, extensions := store.GetUserExtensionAccess(username)
	if !caps["nethvoice_cti"] || !caps["nethvoice_cti.screen_sharing"] {
		c.JSON(http.StatusForbidden, gin.H{"message": "Screen sharing permission is required"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
	defer cancel()
	connected, err := screenShareCallConnected(ctx, username, extensions, input.ConversationID)
	if err != nil {
		screenShareUnavailable(c, "could not verify call state")
		return
	}
	if !connected {
		c.JSON(http.StatusNotFound, gin.H{"message": "Connected conversation not found"})
		return
	}
	if rooms.db == nil || rooms.janus.url == "" {
		screenShareUnavailable(c, "configuration unavailable")
		return
	}

	number, err := rand.Int(rand.Reader, big.NewInt(maxScreenShareRoomID))
	if err != nil {
		screenShareUnavailable(c, "could not generate room ID")
		return
	}
	room := number.Int64() + 1
	var markerBytes [16]byte
	rand.Read(markerBytes[:])
	marker := hex.EncodeToString(markerBytes[:])
	// Keep the reservation even if the response from Janus or to the client is lost.
	_, err = rooms.db.ExecContext(ctx, `INSERT INTO screen_share_pending_rooms (room_id, marker, cleanup_at)
		VALUES (?, ?, UTC_TIMESTAMP(6) + INTERVAL 2 MINUTE)`, room, marker)
	if err != nil {
		screenShareUnavailable(c, "could not reserve room")
		return
	}

	session, err := rooms.janus.open(ctx)
	if err == nil {
		defer session.close()
		err = rooms.janus.createRoom(ctx, session, room, marker)
	}
	if err != nil {
		screenShareUnavailable(c, "could not confirm room creation")
		return
	}
	c.JSON(http.StatusCreated, gin.H{"room": room})
}

func screenShareUnavailable(c *gin.Context, reason string) {
	logs.Log("[WARNING][SCREEN SHARING] " + reason)
	c.JSON(http.StatusServiceUnavailable, gin.H{"message": "Screen sharing is temporarily unavailable"})
}

func screenShareCallConnected(ctx context.Context, username string, extensions []string, conversationID string) (bool, error) {
	if len(extensions) == 0 {
		return false, nil
	}
	session, ok := store.GetSession(username)
	if !ok || session.NethCTIToken == "" || configuration.Config.V1ApiEndpoint == "" {
		return false, errors.New("NethCTI session unavailable")
	}

	cfg := &configuration.Config
	url := cfg.V1Protocol + "://" + cfg.V1ApiEndpoint + cfg.V1ApiPath + "/astproxy/extensions"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return false, err
	}
	req.Header.Set("Authorization", session.NethCTIToken)
	var states map[string]struct {
		Conversations map[string]struct {
			Connected *bool `json:"connected"`
		} `json:"conversations"`
	}
	if err := readScreenShareResponse(req, &states); err != nil {
		return false, err
	}
	if states == nil {
		return false, errors.New("missing extension state")
	}
	var incomplete bool
	for _, extension := range extensions {
		state, exists := states[extension]
		if !exists || state.Conversations == nil {
			incomplete = true
			continue
		}
		if conversation, exists := state.Conversations[conversationID]; exists {
			if conversation.Connected == nil {
				incomplete = true
			} else if *conversation.Connected {
				return true, nil
			}
		}
	}
	if incomplete {
		return false, errors.New("incomplete extension state")
	}
	return false, nil
}

func readScreenShareResponse(req *http.Request, dest any) error {
	resp, err := screenShareHTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return errors.New("upstream HTTP failure")
	}
	const maxResponseSize = 16 << 20
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseSize+1))
	if err != nil {
		return err
	}
	if len(body) > maxResponseSize {
		return errors.New("upstream response too large")
	}
	return json.Unmarshal(body, dest)
}
