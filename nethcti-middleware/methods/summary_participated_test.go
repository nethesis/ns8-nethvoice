/*
 * Copyright (C) 2026 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package methods

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	jwtv5 "github.com/golang-jwt/jwt/v5"

	"github.com/nethesis/nethcti-middleware/configuration"
	"github.com/nethesis/nethcti-middleware/models"
	"github.com/nethesis/nethcti-middleware/store"
)

// On an attended transfer the transfer leg carries two conversations under one
// linkedid (consultation A<->B and post-transfer C<->B). ListSummaryStatus must
// return the requested row's transcript AND the extra conversation the user took
// part in (the consultation), while de-duplicating the requested one and
// skipping silent legs.
func TestListSummaryStatus_AppendsParticipatedConversations(t *testing.T) {
	gin.SetMode(gin.TestMode)
	store.UserSessionInit()
	store.UserSessions["alice"] = &models.UserSession{Username: "alice", NethCTIToken: "token"}

	configuration.Config.SatellitePgSQLHost = "test"
	configuration.Config.SatellitePgSQLPort = "5432"
	configuration.Config.SatellitePgSQLDB = "test"
	configuration.Config.SatellitePgSQLUser = "test"

	originalGetUserInfo := getUserInfoFunc
	originalCheck := checkUserParticipationFunc
	originalCheckByLinkedID := checkUserParticipationByLinkedIDFunc
	originalFetchList := fetchSummaryListFunc
	originalResolve := resolveLinkedIDToUniqueIDFunc
	originalParticipated := fetchParticipatedConversationsFunc
	defer func() {
		getUserInfoFunc = originalGetUserInfo
		checkUserParticipationFunc = originalCheck
		checkUserParticipationByLinkedIDFunc = originalCheckByLinkedID
		fetchSummaryListFunc = originalFetchList
		resolveLinkedIDToUniqueIDFunc = originalResolve
		fetchParticipatedConversationsFunc = originalParticipated
	}()

	getUserInfoFunc = func(string) (*UserInfo, error) {
		return &UserInfo{PhoneNumbers: []string{"202"}}, nil
	}
	checkUserParticipationFunc = func(string, []string) (bool, error) { return true, nil }
	checkUserParticipationByLinkedIDFunc = func(string, []string) (bool, error) { return true, nil }
	resolveLinkedIDToUniqueIDFunc = func(string, []string) (string, error) { return "", nil }

	updatedAt := time.Now()
	fetchSummaryListFunc = func([]string) ([]SummaryListItem, error) {
		return []SummaryListItem{
			{UniqueID: "main1", State: "done", HasTranscription: true, HasSummary: true, SrcNumber: "202", DstNumber: "3401234567", UpdatedAt: &updatedAt},
		}, nil
	}
	fetchParticipatedConversationsFunc = func(linkedIDs []string, phones []string) ([]SummaryListItem, error) {
		return []SummaryListItem{
			// same conversation as the requested row -> must be de-duplicated
			{ID: 8, LinkedID: "L1", UniqueID: "main1", State: "done", HasTranscription: true, SrcNumber: "202", DstNumber: "3401234567", UpdatedAt: &updatedAt},
			// consultation leg the user took part in -> must be appended
			{ID: 9, LinkedID: "L1", UniqueID: "cons1", State: "done", HasTranscription: true, SrcNumber: "202", DstNumber: "201", UpdatedAt: &updatedAt},
			// silent leg (no transcript) -> must be skipped
			{ID: 10, LinkedID: "L1", UniqueID: "silent1", State: "done", HasTranscription: false, SrcNumber: "202", DstNumber: "999", UpdatedAt: &updatedAt},
		}, nil
	}

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("JWT_PAYLOAD", jwtv5.MapClaims{"id": "alice"})
		c.Next()
	})
	router.POST("/history/statuses", ListSummaryStatus)

	w := httptest.NewRecorder()
	body, _ := json.Marshal(map[string]interface{}{
		"lookups": []map[string]string{{"uniqueid": "main1", "linkedid": "L1"}},
	})
	req, _ := http.NewRequest("POST", "/history/statuses", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var response struct {
		Data []SummaryListItem `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode: %v", err)
	}

	if len(response.Data) != 2 {
		t.Fatalf("expected 2 items (requested + consultation), got %d: %s", len(response.Data), w.Body.String())
	}

	var sawMain, sawCons bool
	for _, it := range response.Data {
		switch it.UniqueID {
		case "main1":
			sawMain = true
		case "cons1":
			sawCons = true
			if it.DstNumber != "201" || it.SrcNumber != "202" {
				t.Fatalf("consultation parties expected 202->201, got %s->%s", it.SrcNumber, it.DstNumber)
			}
			if !it.Extra {
				t.Fatalf("consultation must be marked extra so the frontend renders it as its own row")
			}
			if it.ID != 9 {
				t.Fatalf("consultation must carry its transcript id, got %d", it.ID)
			}
		case "silent1":
			t.Fatalf("silent leg (no transcript) must not be surfaced")
		}
	}
	if !sawMain || !sawCons {
		t.Fatalf("expected both requested and consultation rows, sawMain=%v sawCons=%v", sawMain, sawCons)
	}
}
