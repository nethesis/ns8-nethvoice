/*
 * Copyright (C) 2026 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package methods

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	jwtv5 "github.com/golang-jwt/jwt/v5"

	"github.com/nethesis/nethcti-middleware/models"
	"github.com/nethesis/nethcti-middleware/store"
)

func TestListVoicemailByID_ReturnsSingleRow(t *testing.T) {
	gin.SetMode(gin.TestMode)
	store.UserSessionInit()
	store.UserSessions["alice"] = &models.UserSession{Username: "alice", NethCTIToken: "token"}

	originalFetch := fetchLegacyVoicemailListFunc
	originalProxy := proxyV1RequestFunc
	defer func() {
		fetchLegacyVoicemailListFunc = originalFetch
		proxyV1RequestFunc = originalProxy
	}()

	fetchLegacyVoicemailListFunc = func(string) (*voicemailListResponse, error) {
		return &voicemailListResponse{
			Count: 2,
			Rows: []map[string]interface{}{
				{"id": json.Number("2"), "callerid": "\"Alice\" <202>", "type": "old"},
				{"id": json.Number("4"), "callerid": "\"Bob\" <203>", "type": "inbox"},
			},
		}, nil
	}
	proxyV1RequestFunc = func(c *gin.Context, path string, allowAnonymous bool) {
		t.Fatalf("did not expect proxy fallback for numeric voicemail id")
	}

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("JWT_PAYLOAD", jwtv5.MapClaims{"id": "alice"})
		c.Next()
	})
	router.GET("/voicemail/list/:id", ListVoicemailByID)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/voicemail/list/4", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var response voicemailListResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if response.Count != 1 {
		t.Fatalf("expected count 1, got %d", response.Count)
	}

	if len(response.Rows) != 1 || getVoicemailRowID(response.Rows[0]) != "4" {
		t.Fatalf("expected voicemail id 4, got %#v", response.Rows)
	}
}

func TestListVoicemailByID_FallsBackToLegacyTypes(t *testing.T) {
	gin.SetMode(gin.TestMode)

	originalFetch := fetchLegacyVoicemailListFunc
	originalProxy := proxyV1RequestFunc
	defer func() {
		fetchLegacyVoicemailListFunc = originalFetch
		proxyV1RequestFunc = originalProxy
	}()

	fetchLegacyVoicemailListFunc = func(string) (*voicemailListResponse, error) {
		t.Fatalf("did not expect filtered fetch for legacy type route")
		return nil, nil
	}

	var gotPath string
	var gotAllowAnonymous bool
	proxyV1RequestFunc = func(c *gin.Context, path string, allowAnonymous bool) {
		gotPath = path
		gotAllowAnonymous = allowAnonymous
		c.JSON(http.StatusOK, gin.H{"count": 0, "rows": []interface{}{}})
	}

	router := gin.New()
	router.GET("/voicemail/list/:id", ListVoicemailByID)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/voicemail/list/all", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	if gotPath != "/voicemail/list/all" {
		t.Fatalf("expected fallback path /voicemail/list/all, got %q", gotPath)
	}

	if gotAllowAnonymous {
		t.Fatalf("expected authenticated proxy fallback")
	}
}
