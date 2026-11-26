/*
 * Copyright (C) 2026 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package methods

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/binary"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/nethesis/nethcti-middleware/logs"
)

const (
	videoRoomPlugin      = "janus.plugin.videoroom"
	janusSessionNotFound = 458
)

var errJanusRejected = errors.New("Janus rejected the request")

type screenShareJanus struct {
	url      string
	adminKey string
}

type screenShareJanusSession struct {
	url       string
	handleURL string
}

type videoRoomState struct {
	Room            uint64 `json:"room"`
	Description     string `json:"description"`
	NumParticipants *int   `json:"num_participants"`
}

type videoRoomResult struct {
	Event     string           `json:"videoroom"`
	ErrorCode int              `json:"error_code"`
	Error     string           `json:"error"`
	Room      uint64           `json:"room"`
	List      []videoRoomState `json:"list"`
	Exists    *bool            `json:"exists"`
}

type janusResponse struct {
	Janus       string `json:"janus"`
	Transaction string `json:"transaction"`
	Error       struct {
		Code int `json:"code"`
	} `json:"error"`
	Data struct {
		ID uint64 `json:"id"`
	} `json:"data"`
	PluginData struct {
		Plugin string          `json:"plugin"`
		Data   videoRoomResult `json:"data"`
	} `json:"plugindata"`
}

func janusRequest(ctx context.Context, url, command string, fields map[string]any) (janusResponse, error) {
	var result janusResponse
	if fields == nil {
		fields = make(map[string]any)
	}
	transaction := rand.Text()
	fields["janus"] = command
	fields["transaction"] = transaction
	body, err := json.Marshal(fields)
	if err != nil {
		return result, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return result, err
	}
	req.Header.Set("Content-Type", "application/json")
	if err := readScreenShareResponse(req, &result); err != nil {
		return result, err
	}
	if result.Transaction == transaction && result.Janus == "error" {
		return result, errJanusRejected
	}
	if result.Janus != "success" || result.Transaction != transaction {
		return result, errors.New("unexpected Janus response")
	}
	return result, nil
}

func (j screenShareJanus) open(ctx context.Context) (screenShareJanusSession, error) {
	// Choose the ID so we can close the session if Janus's create response is lost.
	// Use a range above Janus's auto-generated JavaScript-safe session IDs.
	var random [8]byte
	rand.Read(random[:])
	id := (binary.BigEndian.Uint64(random[:]) >> 2) | (1 << 62)
	session := screenShareJanusSession{url: j.url + "/" + strconv.FormatUint(id, 10)}
	result, err := janusRequest(ctx, j.url, "create", map[string]any{"id": id})
	if err != nil || result.Data.ID != id {
		if !errors.Is(err, errJanusRejected) {
			session.close()
		}
		return screenShareJanusSession{}, errors.New("could not open Janus session")
	}

	result, err = janusRequest(ctx, session.url, "attach", map[string]any{"plugin": videoRoomPlugin})
	if err != nil || result.Data.ID == 0 {
		session.close()
		return session, errors.New("could not attach VideoRoom")
	}
	session.handleURL = session.url + "/" + strconv.FormatUint(result.Data.ID, 10)
	return session, nil
}

func (s screenShareJanusSession) close() {
	// The caller may have disconnected or timed out while Janus was processing a request.
	result, err := janusRequest(context.Background(), s.url, "destroy", nil)
	if err != nil && !(errors.Is(err, errJanusRejected) && result.Error.Code == janusSessionNotFound) {
		logs.Log("[WARNING][SCREEN SHARING] could not confirm Janus session closure")
	}
}

func (s screenShareJanusSession) message(ctx context.Context, event string, body map[string]any) (videoRoomResult, error) {
	response, err := janusRequest(ctx, s.handleURL, "message", map[string]any{"body": body})
	if err != nil {
		return videoRoomResult{}, err
	}
	result := response.PluginData.Data
	if response.PluginData.Plugin != videoRoomPlugin || result.Event != event || result.ErrorCode != 0 || result.Error != "" {
		return videoRoomResult{}, errors.New("unexpected VideoRoom response")
	}
	return result, nil
}

func (j screenShareJanus) createRoom(ctx context.Context, session screenShareJanusSession, room int64, marker string) error {
	result, err := session.message(ctx, "created", map[string]any{
		"request":     "create",
		"room":        room,
		"description": marker,
		"admin_key":   j.adminKey,
		"permanent":   false,
		"bitrate":     500000,
		"publishers":  1,
	})
	if err != nil || result.Room != uint64(room) {
		return errors.New("could not confirm VideoRoom creation")
	}
	return nil
}

func (s screenShareJanusSession) listRooms(ctx context.Context) (map[uint64]videoRoomState, error) {
	result, err := s.message(ctx, "success", map[string]any{"request": "list"})
	if err != nil || result.List == nil {
		return nil, errors.New("could not list VideoRooms")
	}
	rooms := make(map[uint64]videoRoomState, len(result.List))
	for _, room := range result.List {
		rooms[room.Room] = room
	}
	return rooms, nil
}

func (s screenShareJanusSession) roomExists(ctx context.Context, room uint64) (bool, error) {
	result, err := s.message(ctx, "success", map[string]any{"request": "exists", "room": room})
	if err != nil || result.Room != room || result.Exists == nil {
		return false, errors.New("could not verify VideoRoom existence")
	}
	return *result.Exists, nil
}

func (s screenShareJanusSession) destroyRoom(ctx context.Context, room uint64) error {
	result, err := s.message(ctx, "destroyed", map[string]any{"request": "destroy", "room": room, "permanent": false})
	if err != nil || result.Room != room {
		return errors.New("could not confirm VideoRoom destruction")
	}
	return nil
}

// Reconcile runs a sweep at startup and then every 30 seconds.
func (rooms *ScreenShareRooms) Reconcile(ctx context.Context) {
	if rooms.janus.url == "" || rooms.db == nil {
		return
	}
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		sweep, cancel := context.WithTimeout(ctx, 25*time.Second)
		if err := rooms.reconcileExpired(sweep); err != nil && ctx.Err() == nil {
			logs.Log("[WARNING][SCREEN SHARING] pending room cleanup will retry")
		}
		cancel()
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (rooms *ScreenShareRooms) reconcileExpired(ctx context.Context) error {
	rows, err := rooms.db.QueryContext(ctx, `SELECT room_id, marker FROM screen_share_pending_rooms
		WHERE cleanup_at <= UTC_TIMESTAMP(6) ORDER BY cleanup_at`)
	if err != nil {
		return err
	}
	type reservation struct {
		id     uint64
		marker string
	}
	var expired []reservation
	for rows.Next() {
		var pending reservation
		if err := rows.Scan(&pending.id, &pending.marker); err != nil {
			rows.Close()
			return err
		}
		expired = append(expired, pending)
	}
	rows.Close()
	if err := rows.Err(); err != nil || len(expired) == 0 {
		return err
	}

	session, err := rooms.janus.open(ctx)
	if err != nil {
		return err
	}
	defer session.close()
	list, err := session.listRooms(ctx)
	if err != nil {
		return err
	}

	var firstError error
	for _, pending := range expired {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		gone, err := session.cleanupRoom(ctx, pending.id, pending.marker, list)
		if gone {
			_, err = rooms.db.ExecContext(ctx, "DELETE FROM screen_share_pending_rooms WHERE room_id = ? AND marker = ?", pending.id, pending.marker)
		}
		if firstError == nil {
			firstError = err
		}
	}
	return firstError
}

func (s screenShareJanusSession) cleanupRoom(ctx context.Context, room uint64, marker string, list map[uint64]videoRoomState) (bool, error) {
	state, listed := list[room]
	if !listed {
		// A private room can be absent from the list and still exist.
		exists, err := s.roomExists(ctx, room)
		return err == nil && !exists, err
	}
	if !state.matchesEmpty(marker) {
		return false, nil
	}
	// Recheck the marker and joined publishers as close to destruction as possible.
	current, err := s.listRooms(ctx)
	if err != nil || !current[room].matchesEmpty(marker) {
		return false, err
	}
	err = s.destroyRoom(ctx, room)
	return err == nil, err
}

func (s videoRoomState) matchesEmpty(marker string) bool {
	return s.Description == marker && s.NumParticipants != nil && *s.NumParticipants == 0
}
