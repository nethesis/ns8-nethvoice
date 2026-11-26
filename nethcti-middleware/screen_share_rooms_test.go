/*
 * Copyright (C) 2026 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/http/httputil"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	jwtv5 "github.com/golang-jwt/jwt/v5"
	"github.com/nethesis/nethcti-middleware/configuration"
	"github.com/nethesis/nethcti-middleware/db"
	"github.com/nethesis/nethcti-middleware/methods"
	"github.com/nethesis/nethcti-middleware/models"
	"github.com/nethesis/nethcti-middleware/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestScreenShareRoomsRoute(t *testing.T) {
	const key = "testScreenShareJanusKey"
	const conversation = "call/secondary.5"
	const authToken = "testNethCTISession"
	require.NotNil(t, db.DB, "MariaDB is required")
	t.Cleanup(func() {
		_, err := db.DB.Exec("DELETE FROM screen_share_pending_rooms")
		assert.NoError(t, err)
	})

	profiles := writeTempFileForTest(t, "profiles.json", `{
		"full":{"macro_permissions":{"nethvoice_cti":{"value":true,"permissions":[{"name":"screen_sharing","value":true}]}}},
		"no-macro":{"macro_permissions":{"nethvoice_cti":{"value":false,"permissions":[{"name":"screen_sharing","value":true}]}}},
		"no-share":{"macro_permissions":{"nethvoice_cti":{"value":true,"permissions":[{"name":"screen_sharing","value":false}]}}}
	}`)
	users := writeTempFileForTest(t, "users.json", `{
		"share-full":{"profile_id":"full","endpoints":{"mainextension":{"100":{}},"extension":{"100":{},"101":{}}}},
		"share-no-macro":{"profile_id":"no-macro","endpoints":{"extension":{"101":{}}}},
		"share-no-share":{"profile_id":"no-share","endpoints":{"extension":{"101":{}}}}
	}`)
	require.NoError(t, store.InitProfiles(profiles, users))
	tokens := make(map[string]string)
	for _, user := range []string{"share-full", "share-no-macro", "share-no-share"} {
		store.ModifySessions(func(sessions map[string]*models.UserSession) {
			sessions[user] = &models.UserSession{Username: user, NethCTIToken: authToken}
		})
		token, err := generateTestJWTWithCapabilities(user)
		require.NoError(t, err)
		tokens[user] = token
		store.ModifySessions(func(sessions map[string]*models.UserSession) {
			sessions[user].JWTTokens = []string{token}
		})
	}
	t.Cleanup(func() {
		store.ModifySessions(func(sessions map[string]*models.UserSession) {
			for user := range tokens {
				delete(sessions, user)
			}
		})
	})
	revoked, err := generateTestJWTWithCapabilities("share-revoked")
	require.NoError(t, err)

	var callStateUnavailable atomic.Bool
	var emptyCallState atomic.Bool
	reloadUsersDuringLookup := make(chan string, 1)
	v1 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/webrest/astproxy/extensions", r.URL.Path)
		assert.Equal(t, http.MethodGet, r.Method)
		assert.Equal(t, authToken, r.Header.Get("Authorization"))
		select {
		case contents := <-reloadUsersDuringLookup:
			assert.NoError(t, os.WriteFile(users, []byte(contents), 0600))
			_, err := store.ReloadProfiles()
			assert.NoError(t, err)
		default:
		}
		if callStateUnavailable.Load() {
			http.Error(w, "private upstream failure", http.StatusBadGateway)
			return
		}
		if emptyCallState.Load() {
			w.Write([]byte("{}"))
			return
		}
		w.Write([]byte(`{
			"100":{"conversations":{"ringing":{"connected":false}}},
			"101":{"conversations":{"call/secondary.5":{"connected":true}}},
			"999":{"conversations":{"foreign":{"connected":true}}}
		}`))
	}))
	defer v1.Close()
	endpoint := configuration.Config.V1ApiEndpoint
	configuration.Config.V1ApiEndpoint = strings.TrimPrefix(v1.URL, "http://")
	t.Cleanup(func() { configuration.Config.V1ApiEndpoint = endpoint })

	var janusCalls atomic.Int32
	var pluginFailure atomic.Bool
	var dropSessionCreate atomic.Bool
	var sessionID atomic.Uint64
	janus := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		janusCalls.Add(1)
		var input struct {
			Command     string         `json:"janus"`
			Transaction string         `json:"transaction"`
			ID          uint64         `json:"id"`
			Plugin      string         `json:"plugin"`
			Body        map[string]any `json:"body"`
		}
		if !assert.NoError(t, json.NewDecoder(r.Body).Decode(&input)) {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		response := map[string]any{"janus": "success", "transaction": input.Transaction}
		switch input.Command {
		case "create":
			assert.Equal(t, "/janus", r.URL.Path)
			assert.Positive(t, input.ID)
			sessionID.Store(input.ID)
			if dropSessionCreate.Load() {
				dropScreenShareResponse(t, w)
				return
			}
			response["data"] = map[string]any{"id": input.ID}
		case "attach":
			assert.Equal(t, "/janus/"+strconv.FormatUint(sessionID.Load(), 10), r.URL.Path)
			assert.Equal(t, "janus.plugin.videoroom", input.Plugin)
			response["data"] = map[string]any{"id": 8}
		case "message":
			assert.Equal(t, "/janus/"+strconv.FormatUint(sessionID.Load(), 10)+"/8", r.URL.Path)
			assert.Equal(t, "create", input.Body["request"])
			assert.Equal(t, key, input.Body["admin_key"])
			assert.Equal(t, float64(1), input.Body["publishers"])
			assert.Equal(t, float64(500000), input.Body["bitrate"])
			assert.Equal(t, false, input.Body["permanent"])
			room, _ := input.Body["room"].(float64)
			assert.Greater(t, room, float64(0))
			assert.LessOrEqual(t, room, float64(1<<53-1))
			var marker string
			err := db.DB.QueryRow("SELECT marker FROM screen_share_pending_rooms WHERE room_id = ? AND cleanup_at > UTC_TIMESTAMP(6)", int64(room)).Scan(&marker)
			assert.NoError(t, err, "reserve before requesting Janus")
			assert.Equal(t, marker, input.Body["description"])

			pluginData := map[string]any{"videoroom": "created", "room": room}
			if pluginFailure.Load() {
				pluginData = map[string]any{"videoroom": "event", "error_code": 499, "error": key}
			}
			response["plugindata"] = map[string]any{"plugin": "janus.plugin.videoroom", "data": pluginData}
		case "destroy":
			assert.Equal(t, "/janus/"+strconv.FormatUint(sessionID.Load(), 10), r.URL.Path)
		default:
			t.Errorf("unexpected Janus command %q", input.Command)
		}
		json.NewEncoder(w).Encode(response)
	}))
	defer janus.Close()
	port := janus.Listener.Addr().String()[len("127.0.0.1:"):]
	var roomDatabase *sql.DB
	router := createRouter(methods.NewScreenShareRooms(func(context.Context) *sql.DB { return roomDatabase }, port, key))
	post := func(token, body string) *httptest.ResponseRecorder {
		response := httptest.NewRecorder()
		router.ServeHTTP(response, screenShareTestRequest(token, body, ""))
		return response
	}
	validBody := `{"conversationId":"` + conversation + `"}`
	for _, tc := range []struct {
		name, token, body string
		status            int
	}{
		{"missing credentials", "", validBody, http.StatusUnauthorized},
		{"invalid credentials", "invalid", validBody, http.StatusUnauthorized},
		{"revoked credentials", revoked, validBody, http.StatusUnauthorized},
		{"missing macro", tokens["share-no-macro"], validBody, http.StatusForbidden},
		{"missing permission", tokens["share-no-share"], validBody, http.StatusForbidden},
		{"ringing", tokens["share-full"], `{"conversationId":"ringing"}`, http.StatusNotFound},
		{"ended", tokens["share-full"], `{"conversationId":"ended"}`, http.StatusNotFound},
		{"foreign", tokens["share-full"], `{"conversationId":"foreign"}`, http.StatusNotFound},
		{"non-string ID", tokens["share-full"], `{"conversationId":77}`, http.StatusBadRequest},
		{"extra JSON", tokens["share-full"], validBody + "{}", http.StatusBadRequest},
		{"oversized body", tokens["share-full"], `{"conversationId":"` + strings.Repeat("x", 4096) + `"}`, http.StatusBadRequest},
	} {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.status, post(tc.token, tc.body).Code)
			assert.Zero(t, janusCalls.Load(), "rejected requests must make zero Janus calls")
		})
	}
	// A query JWT must not authenticate the route, even if the header separately
	// carries a token in the same user's session.
	queryToken, err := jwtv5.NewWithClaims(jwtv5.SigningMethodHS256, jwtv5.MapClaims{
		"id": "share-full", "exp": time.Now().Add(time.Hour).Unix(),
	}).SignedString([]byte(configuration.Config.Secret_jwt))
	require.NoError(t, err)
	queryRequest := screenShareTestRequest("", validBody, "")
	queryRequest.URL.RawQuery = url.Values{"jwt": {queryToken}}.Encode()
	queryRequest.Header.Set("Authorization", tokens["share-full"])
	queryResponse := httptest.NewRecorder()
	router.ServeHTTP(queryResponse, queryRequest)
	assert.Equal(t, http.StatusUnauthorized, queryResponse.Code)
	assert.Zero(t, janusCalls.Load())

	callStateUnavailable.Store(true)
	unavailable := post(tokens["share-full"], validBody)
	assert.Equal(t, http.StatusServiceUnavailable, unavailable.Code)
	assert.NotContains(t, unavailable.Body.String(), "private upstream failure")
	assert.Zero(t, janusCalls.Load())
	callStateUnavailable.Store(false)
	emptyCallState.Store(true)
	assert.Equal(t, http.StatusServiceUnavailable, post(tokens["share-full"], validBody).Code)
	assert.Zero(t, janusCalls.Load())
	emptyCallState.Store(false)
	closedDB, err := sql.Open("mysql", "unused@tcp(127.0.0.1:1)/unused")
	require.NoError(t, err)
	require.NoError(t, closedDB.Close())
	reservationFailure := httptest.NewRecorder()
	createRouter(methods.NewScreenShareRooms(func(context.Context) *sql.DB { return closedDB }, port, key)).ServeHTTP(
		reservationFailure, screenShareTestRequest(tokens["share-full"], validBody, ""),
	)
	assert.Equal(t, http.StatusServiceUnavailable, reservationFailure.Code)
	assert.Zero(t, janusCalls.Load())
	assert.Equal(t, post(tokens["share-full"], `{"conversationId":"foreign"}`).Body.String(),
		post(tokens["share-full"], `{"conversationId":"ended"}`).Body.String())

	// The same router recovers when MariaDB becomes available after startup.
	require.Equal(t, http.StatusServiceUnavailable, post(tokens["share-full"], validBody).Code)
	require.Zero(t, janusCalls.Load())
	roomDatabase = db.GetDB()
	require.NotNil(t, roomDatabase)

	// Partial reloads still serve cached profiles elsewhere. Room creation
	// stays unavailable until the configured users and permissions reload.
	for _, file := range []string{users, profiles} {
		contents, err := os.ReadFile(file)
		require.NoError(t, err)
		require.NoError(t, os.Remove(file))
		_, err = store.ReloadProfiles()
		require.NoError(t, err)
		require.Equal(t, http.StatusServiceUnavailable, post(tokens["share-full"], validBody).Code)
		require.Zero(t, janusCalls.Load())
		require.NoError(t, os.WriteFile(file, contents, 0600))
		_, err = store.ReloadProfiles()
		require.NoError(t, err)
	}

	// Reassigning the connected extension, revoking permission, or a failed
	// reload during the CTI lookup must invalidate the in-flight authorization.
	userConfig, err := os.ReadFile(users)
	require.NoError(t, err)
	for _, change := range []struct {
		users  string
		status int
	}{
		{`{"share-full":{"profile_id":"full","endpoints":{"extension":{"100":{}}}}}`, http.StatusNotFound},
		{`{"share-full":{"profile_id":"no-share","endpoints":{"extension":{"101":{}}}}}`, http.StatusForbidden},
		{"{", http.StatusServiceUnavailable},
	} {
		reloadUsersDuringLookup <- change.users
		require.Equal(t, change.status, post(tokens["share-full"], validBody).Code)
		require.Zero(t, janusCalls.Load())
		require.NoError(t, os.WriteFile(users, userConfig, 0600))
		_, err := store.ReloadProfiles()
		require.NoError(t, err)
	}

	created := post(tokens["share-full"], validBody)
	require.Equal(t, http.StatusCreated, created.Code, created.Body.String())
	var fields map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(created.Body.Bytes(), &fields))
	require.Len(t, fields, 1)
	require.Contains(t, fields, "room")
	assert.EqualValues(t, 4, janusCalls.Load(), "temporary session is destroyed")

	pluginFailure.Store(true)
	failed := post(tokens["share-full"], validBody)
	assert.Equal(t, http.StatusServiceUnavailable, failed.Code)
	assert.NotContains(t, failed.Body.String(), key)
	assert.EqualValues(t, 8, janusCalls.Load(), "session is destroyed after plugin error")
	dropSessionCreate.Store(true)
	assert.Equal(t, http.StatusServiceUnavailable, post(tokens["share-full"], validBody).Code)
	assert.EqualValues(t, 10, janusCalls.Load(), "session is destroyed after its create response is dropped")
	var reservations int
	require.NoError(t, db.DB.QueryRow("SELECT COUNT(*) FROM screen_share_pending_rooms").Scan(&reservations))
	assert.Equal(t, 3, reservations, "keep reservations after ambiguous failures")

	t.Run("pinned Janus lifecycle", func(t *testing.T) {
		verifyScreenShareLifecycle(t, tokens["share-full"], validBody, key)
	})
}

func TestScreenShareCleanupRetriesUnavailableDatabase(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		attempts := 0
		rooms := methods.NewScreenShareRooms(func(context.Context) *sql.DB {
			attempts++
			return nil
		}, "8089", "testKey")
		ctx, cancel := context.WithTimeout(context.Background(), 31*time.Second)
		defer cancel()
		rooms.Reconcile(ctx)
		require.Equal(t, 2, attempts, "sweep at startup and again after 30 seconds")
	})
}

func screenShareTestRequest(token, body, origin string) *http.Request {
	var request *http.Request
	if origin == "" {
		request = httptest.NewRequest(http.MethodPost, methods.ScreenShareRoomsPath, strings.NewReader(body))
	} else {
		request, _ = http.NewRequest(http.MethodPost, origin+methods.ScreenShareRoomsPath, strings.NewReader(body))
	}
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	request.Header.Set("Content-Type", "application/json")
	return request
}

// Enable this test with a loopback Janus 1.4.4 started with the test screen-share key.
func verifyScreenShareLifecycle(t *testing.T, token, body, key string) {
	port := os.Getenv("NETHVOICE_TEST_JANUS_PORT")
	if port == "" {
		t.Skip("set NETHVOICE_TEST_JANUS_PORT to exercise the pinned Janus image")
	}
	origin := "http://127.0.0.1:" + port
	janusURL, err := url.Parse(origin)
	require.NoError(t, err)
	client := &http.Client{Timeout: 5 * time.Second}
	info, err := client.Get(origin + "/janus/info")
	require.NoError(t, err)
	defer info.Body.Close()
	var version struct {
		Version string `json:"version_string"`
	}
	require.NoError(t, json.NewDecoder(info.Body).Decode(&version))
	require.Equal(t, "1.4.4", version.Version)

	janusCall := func(path, command string, fields map[string]any) map[string]any {
		t.Helper()
		if fields == nil {
			fields = map[string]any{}
		}
		fields["janus"] = command
		fields["transaction"] = "screen-share-test"
		raw, err := json.Marshal(fields)
		require.NoError(t, err)
		resp, err := client.Post(origin+path, "application/json", bytes.NewReader(raw))
		require.NoError(t, err)
		defer resp.Body.Close()
		var result map[string]any
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&result))
		return result
	}
	sessionID := func(result map[string]any) string {
		t.Helper()
		require.Equal(t, "success", result["janus"], result)
		return strconv.FormatUint(uint64(result["data"].(map[string]any)["id"].(float64)), 10)
	}
	session := "/janus/" + sessionID(janusCall("/janus", "create", nil))
	t.Cleanup(func() { janusCall(session, "destroy", nil) })
	handle := session + "/" + sessionID(janusCall(session, "attach", map[string]any{"plugin": "janus.plugin.videoroom"}))
	pluginCall := func(fields map[string]any) map[string]any {
		result := janusCall(handle, "message", map[string]any{"body": fields})
		require.Equal(t, "success", result["janus"], result)
		return result["plugindata"].(map[string]any)["data"].(map[string]any)
	}
	roomExists := func(room uint64) bool {
		return pluginCall(map[string]any{"request": "exists", "room": room})["exists"] == true
	}
	destroy := func(room uint64) {
		result := pluginCall(map[string]any{"request": "destroy", "room": room})
		assert.Equal(t, "destroyed", result["videoroom"], result)
	}

	rooms := methods.NewScreenShareRooms(db.GetDBContext, port, key)
	router := createRouter(rooms)
	created := httptest.NewRecorder()
	router.ServeHTTP(created, screenShareTestRequest(token, body, ""))
	require.Equal(t, http.StatusCreated, created.Code, created.Body.String())
	var active struct{ Room uint64 }
	require.NoError(t, json.Unmarshal(created.Body.Bytes(), &active))
	require.Positive(t, active.Room)
	t.Cleanup(func() {
		if roomExists(active.Room) {
			destroy(active.Room)
		}
	})
	joined := janusCall(handle, "message", map[string]any{"body": map[string]any{
		"request": "join", "ptype": "publisher", "room": active.Room,
	}})
	require.Equal(t, "ack", joined["janus"], joined)
	joinDeadline := time.Now().Add(3 * time.Second)
	for {
		list := pluginCall(map[string]any{"request": "list"})["list"].([]any)
		var occupied bool
		for _, entry := range list {
			room := entry.(map[string]any)
			occupied = occupied || uint64(room["room"].(float64)) == active.Room && room["num_participants"] == float64(1)
		}
		if occupied {
			break
		}
		require.True(t, time.Now().Before(joinDeadline), "publisher failed to join after middleware session closed")
		time.Sleep(20 * time.Millisecond)
	}

	// Let Janus create the room, then drop its response before middleware sees it.
	proxy := httputil.NewSingleHostReverseProxy(janusURL)
	proxy.ModifyResponse = func(resp *http.Response) error {
		raw, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			return err
		}
		var result struct {
			PluginData struct {
				Data struct {
					Event string `json:"videoroom"`
				}
			} `json:"plugindata"`
		}
		if err := json.Unmarshal(raw, &result); err != nil {
			return err
		}
		if result.PluginData.Data.Event == "created" {
			return errors.New("drop room creation response")
		}
		resp.Body = io.NopCloser(bytes.NewReader(raw))
		return nil
	}
	proxy.ErrorHandler = func(w http.ResponseWriter, _ *http.Request, _ error) { dropScreenShareResponse(t, w) }
	dropJanusResponse := httptest.NewServer(proxy)
	defer dropJanusResponse.Close()
	proxyURL, err := url.Parse(dropJanusResponse.URL)
	require.NoError(t, err)
	lostInJanus := httptest.NewRecorder()
	createRouter(methods.NewScreenShareRooms(db.GetDBContext, proxyURL.Port(), key)).ServeHTTP(
		lostInJanus, screenShareTestRequest(token, body, ""),
	)
	require.Equal(t, http.StatusServiceUnavailable, lostInJanus.Code)
	latestReservation := func() uint64 {
		var room uint64
		require.NoError(t, db.DB.QueryRow("SELECT room_id FROM screen_share_pending_rooms ORDER BY cleanup_at DESC LIMIT 1").Scan(&room))
		require.True(t, roomExists(room))
		return room
	}
	firstOrphan := latestReservation()

	// Drop the middleware response after it has confirmed successful creation.
	dropClientResponse := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		record := httptest.NewRecorder()
		router.ServeHTTP(record, r)
		assert.Equal(t, http.StatusCreated, record.Code)
		dropScreenShareResponse(t, w)
	}))
	defer dropClientResponse.Close()
	resp, err := client.Do(screenShareTestRequest(token, body, dropClientResponse.URL))
	require.Error(t, err)
	if resp != nil {
		resp.Body.Close()
	}
	secondOrphan := latestReservation()
	require.NotEqual(t, firstOrphan, secondOrphan)

	const unrelated uint64 = 80251
	result := pluginCall(map[string]any{"request": "create", "room": unrelated, "description": "Legacy room"})
	require.Equal(t, "created", result["videoroom"], "direct creation still works with VideoRoom unkeyed")
	t.Cleanup(func() { destroy(unrelated) })
	_, err = db.DB.Exec("INSERT INTO screen_share_pending_rooms (room_id, marker, cleanup_at) VALUES (?, 'different-marker', UTC_TIMESTAMP(6))", unrelated)
	require.NoError(t, err)
	_, err = db.DB.Exec("UPDATE screen_share_pending_rooms SET cleanup_at = UTC_TIMESTAMP(6) WHERE room_id IN (?, ?, ?)",
		active.Room, firstOrphan, secondOrphan)
	require.NoError(t, err)

	sweepStartup := func(gone ...uint64) {
		t.Helper()
		ctx, cancel := context.WithCancel(context.Background())
		done := make(chan struct{})
		go func() {
			defer close(done)
			methods.NewScreenShareRooms(db.GetDBContext, port, key).Reconcile(ctx)
		}()
		defer func() {
			cancel()
			<-done
		}()
		require.Eventually(t, func() bool {
			for _, room := range gone {
				var count int
				err := db.DB.QueryRow("SELECT COUNT(*) FROM screen_share_pending_rooms WHERE room_id = ?", room).Scan(&count)
				if err != nil || count != 0 {
					return false
				}
			}
			return true
		}, 5*time.Second, 20*time.Millisecond)
	}
	sweepStartup(firstOrphan, secondOrphan)
	assert.False(t, roomExists(firstOrphan))
	assert.False(t, roomExists(secondOrphan))
	assert.True(t, roomExists(active.Room), "joined publisher keeps the room alive")
	assert.True(t, roomExists(unrelated), "different marker keeps the room alive")
	destroy(active.Room)
	sweepStartup(active.Room)
}

func dropScreenShareResponse(t *testing.T, w http.ResponseWriter) {
	t.Helper()
	conn, _, err := w.(http.Hijacker).Hijack()
	if assert.NoError(t, err) {
		conn.Close()
	}
}
