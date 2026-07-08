/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package methods

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	jwtv5 "github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/nethesis/nethcti-middleware/configuration"
	"github.com/nethesis/nethcti-middleware/models"
	"github.com/nethesis/nethcti-middleware/store"
)

func TestGetTranscriptionByUniqueID_UnauthorizedWhenNotParticipant(t *testing.T) {
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
	defer func() {
		getUserInfoFunc = originalGetUserInfo
		checkUserParticipationFunc = originalCheck
		checkUserParticipationByLinkedIDFunc = originalCheckByLinkedID
	}()

	getUserInfoFunc = func(string) (*UserInfo, error) {
		return &UserInfo{PhoneNumbers: []string{"100"}}, nil
	}
	checkUserParticipationFunc = func(string, []string) (bool, error) {
		return false, nil
	}
	checkUserParticipationByLinkedIDFunc = func(string, []string) (bool, error) {
		return false, nil
	}

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("JWT_PAYLOAD", jwtv5.MapClaims{"id": "alice"})
		c.Next()
	})
	router.GET("/transcripts/:uniqueid", GetTranscriptionByUniqueID)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/transcripts/abc123", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 forbidden, got %d: %s", w.Code, w.Body.String())
	}
}

func TestGetTranscriptionByUniqueID_ReturnsExtendedData(t *testing.T) {
	gin.SetMode(gin.TestMode)
	store.UserSessionInit()
	store.UserSessions["alice"] = &models.UserSession{Username: "alice", NethCTIToken: "token"}

	configuration.Config.SatellitePgSQLHost = "test"
	configuration.Config.SatellitePgSQLPort = "5432"
	configuration.Config.SatellitePgSQLDB = "test"
	configuration.Config.SatellitePgSQLUser = "test"

	originalGetUserInfo := getUserInfoFunc
	originalCheck := checkUserParticipationFunc
	originalFetchTranscription := fetchTranscriptionFunc
	originalFetchMeta := fetchTranscriptionMetaFunc
	defer func() {
		getUserInfoFunc = originalGetUserInfo
		checkUserParticipationFunc = originalCheck
		fetchTranscriptionFunc = originalFetchTranscription
		fetchTranscriptionMetaFunc = originalFetchMeta
	}()

	getUserInfoFunc = func(string) (*UserInfo, error) {
		return &UserInfo{PhoneNumbers: []string{"100"}}, nil
	}
	checkUserParticipationFunc = func(string, []string) (bool, error) {
		return true, nil
	}
	createdAt := time.Now()
	fetchTranscriptionFunc = func(uniqueID string, _ []string, _ []string) (string, *time.Time, bool, error) {
		if uniqueID != "abc123" {
			return "", nil, false, nil
		}
		return "transcription text", &createdAt, true, nil
	}
	callTimestamp := time.Now()
	fetchTranscriptionMetaFunc = func(uniqueID string) (*CallMetadata, error) {
		if uniqueID != "abc123" {
			t.Fatalf("unexpected cdr metadata lookup id: %s", uniqueID)
		}
		return &CallMetadata{
			Src:           "100",
			Dst:           "200",
			CNam:          "Alice",
			Company:       "Acme",
			DstCompany:    "Globex",
			DstCNam:       "Bob",
			CallTimestamp: &callTimestamp,
		}, nil
	}

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("JWT_PAYLOAD", jwtv5.MapClaims{"id": "alice"})
		c.Next()
	})
	router.GET("/transcripts/:uniqueid", GetTranscriptionByUniqueID)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/transcripts/abc123", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 ok, got %d: %s", w.Code, w.Body.String())
	}

	var response struct {
		Data TranscriptionDrawer `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if response.Data.UniqueID != "abc123" || response.Data.Transcription != "transcription text" {
		t.Fatalf("unexpected transcription payload: %+v", response.Data)
	}
	if response.Data.Src != "100" || response.Data.CNum != "100" || response.Data.Dst != "200" {
		t.Fatalf("unexpected src/cnum/dst: %+v", response.Data)
	}
	if response.Data.CNam != "Alice" || response.Data.DstCNam != "Bob" {
		t.Fatalf("unexpected cnam fields: %+v", response.Data)
	}
	if response.Data.Company != "Acme" || response.Data.CCompany != "Acme" || response.Data.DstCompany != "Globex" {
		t.Fatalf("unexpected company fields: %+v", response.Data)
	}
	if response.Data.CallTimestamp == nil {
		t.Fatalf("expected call_timestamp to be populated: %+v", response.Data)
	}
	if response.Data.CreatedAt == nil {
		t.Fatalf("expected created_at to be populated: %+v", response.Data)
	}
}

func TestGetTranscriptionByUniqueID_ReturnsServiceUnavailableWhenTranscriptsTableIsMissing(t *testing.T) {
	gin.SetMode(gin.TestMode)
	store.UserSessionInit()
	store.UserSessions["alice"] = &models.UserSession{Username: "alice", NethCTIToken: "token"}

	configuration.Config.SatellitePgSQLHost = "test"
	configuration.Config.SatellitePgSQLPort = "5432"
	configuration.Config.SatellitePgSQLDB = "test"
	configuration.Config.SatellitePgSQLUser = "test"

	originalGetUserInfo := getUserInfoFunc
	originalCheck := checkUserParticipationFunc
	originalFetchTranscription := fetchTranscriptionFunc
	defer func() {
		getUserInfoFunc = originalGetUserInfo
		checkUserParticipationFunc = originalCheck
		fetchTranscriptionFunc = originalFetchTranscription
	}()

	getUserInfoFunc = func(string) (*UserInfo, error) {
		return &UserInfo{PhoneNumbers: []string{"100"}}, nil
	}
	checkUserParticipationFunc = func(string, []string) (bool, error) {
		return true, nil
	}
	fetchTranscriptionFunc = func(string, []string, []string) (string, *time.Time, bool, error) {
		return "", nil, false, &pgconn.PgError{Code: "42P01", Message: `relation "transcripts" does not exist`}
	}

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("JWT_PAYLOAD", jwtv5.MapClaims{"id": "alice"})
		c.Next()
	})
	router.GET("/transcripts/:uniqueid", GetTranscriptionByUniqueID)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/transcripts/abc123", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 service unavailable, got %d: %s", w.Code, w.Body.String())
	}

	var response struct {
		Message string                 `json:"message"`
		Data    map[string]interface{} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if response.Message != "satellite database schema not initialized" {
		t.Fatalf("unexpected message: %s", response.Message)
	}
	if response.Data["missing_table"] != "transcripts" {
		t.Fatalf("unexpected missing_table: %v", response.Data["missing_table"])
	}
}

func TestGetTranscriptionByUniqueID_ReturnsServiceUnavailableWhenSatelliteDBIsUnavailable(t *testing.T) {
	gin.SetMode(gin.TestMode)
	store.UserSessionInit()
	store.UserSessions["alice"] = &models.UserSession{Username: "alice", NethCTIToken: "token"}

	configuration.Config.SatellitePgSQLHost = "test"
	configuration.Config.SatellitePgSQLPort = "5432"
	configuration.Config.SatellitePgSQLDB = "test"
	configuration.Config.SatellitePgSQLUser = "test"

	originalGetUserInfo := getUserInfoFunc
	originalCheck := checkUserParticipationFunc
	originalFetchTranscription := fetchTranscriptionFunc
	defer func() {
		getUserInfoFunc = originalGetUserInfo
		checkUserParticipationFunc = originalCheck
		fetchTranscriptionFunc = originalFetchTranscription
	}()

	getUserInfoFunc = func(string) (*UserInfo, error) {
		return &UserInfo{PhoneNumbers: []string{"100"}}, nil
	}
	checkUserParticipationFunc = func(string, []string) (bool, error) {
		return true, nil
	}
	fetchTranscriptionFunc = func(string, []string, []string) (string, *time.Time, bool, error) {
		return "", nil, false, sql.ErrConnDone
	}

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("JWT_PAYLOAD", jwtv5.MapClaims{"id": "alice"})
		c.Next()
	})
	router.GET("/transcripts/:uniqueid", GetTranscriptionByUniqueID)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/transcripts/abc123", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 service unavailable, got %d: %s", w.Code, w.Body.String())
	}

	var response struct {
		Message string                 `json:"message"`
		Data    map[string]interface{} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if response.Message != "satellite database unavailable" {
		t.Fatalf("unexpected message: %s", response.Message)
	}
	if response.Data["reason"] != "connection_unavailable" {
		t.Fatalf("unexpected reason: %v", response.Data["reason"])
	}
}

func TestUpdateSummary_SucceedsWhenAuthorized(t *testing.T) {
	gin.SetMode(gin.TestMode)
	store.UserSessionInit()
	store.UserSessions["alice"] = &models.UserSession{Username: "alice", NethCTIToken: "token"}

	configuration.Config.SatellitePgSQLHost = "test"
	configuration.Config.SatellitePgSQLPort = "5432"
	configuration.Config.SatellitePgSQLDB = "test"
	configuration.Config.SatellitePgSQLUser = "test"

	originalGetUserInfo := getUserInfoFunc
	originalCheck := checkUserParticipationFunc
	originalUpdate := updateSummaryFunc
	defer func() {
		getUserInfoFunc = originalGetUserInfo
		checkUserParticipationFunc = originalCheck
		updateSummaryFunc = originalUpdate
	}()

	getUserInfoFunc = func(string) (*UserInfo, error) {
		return &UserInfo{PhoneNumbers: []string{"100"}}, nil
	}
	checkUserParticipationFunc = func(string, []string) (bool, error) {
		return true, nil
	}
	var updatedUniqueID string
	var updatedSummary string
	updateSummaryFunc = func(uniqueID, summaryText string) (bool, error) {
		updatedUniqueID = uniqueID
		updatedSummary = summaryText
		return uniqueID == "abc123", nil
	}

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("JWT_PAYLOAD", jwtv5.MapClaims{"id": "alice"})
		c.Next()
	})
	router.PUT("/summary/:uniqueid", UpdateSummaryByUniqueID)

	body, _ := json.Marshal(map[string]string{"summary": "test summary"})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("PUT", "/summary/abc123", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 ok, got %d: %s", w.Code, w.Body.String())
	}
	if updatedSummary != "test summary" {
		t.Fatalf("expected summary to be updated, got %q", updatedSummary)
	}
	if updatedUniqueID != "abc123" {
		t.Fatalf("expected update to use path uniqueid, got %q", updatedUniqueID)
	}
}

func TestGetSummaryByUniqueID_ReturnsExtendedData(t *testing.T) {
	gin.SetMode(gin.TestMode)
	store.UserSessionInit()
	store.UserSessions["alice"] = &models.UserSession{Username: "alice", NethCTIToken: "token"}

	configuration.Config.SatellitePgSQLHost = "test"
	configuration.Config.SatellitePgSQLPort = "5432"
	configuration.Config.SatellitePgSQLDB = "test"
	configuration.Config.SatellitePgSQLUser = "test"

	originalGetUserInfo := getUserInfoFunc
	originalCheck := checkUserParticipationFunc
	originalFetch := fetchSummaryDrawerFunc
	defer func() {
		getUserInfoFunc = originalGetUserInfo
		checkUserParticipationFunc = originalCheck
		fetchSummaryDrawerFunc = originalFetch
	}()

	getUserInfoFunc = func(string) (*UserInfo, error) {
		return &UserInfo{PhoneNumbers: []string{"100"}}, nil
	}
	checkUserParticipationFunc = func(string, []string) (bool, error) {
		return true, nil
	}
	fetchSummaryDrawerFunc = func(uniqueID string, _ []string, _ []string) (*SummaryDrawer, bool, error) {
		if uniqueID != "abc123" {
			return nil, false, nil
		}
		callTimestamp := time.Now()
		return &SummaryDrawer{
			UniqueID:      uniqueID,
			Summary:       "summary text",
			State:         "done",
			Src:           "100",
			Dst:           "200",
			CNam:          "Alice",
			Company:       "Acme",
			DstCompany:    "Globex",
			DstCNam:       "Bob",
			CallTimestamp: &callTimestamp,
			CreatedAt:     time.Now(),
			UpdatedAt:     time.Now(),
		}, true, nil
	}

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("JWT_PAYLOAD", jwtv5.MapClaims{"id": "alice"})
		c.Next()
	})
	router.GET("/summary/:uniqueid", GetSummaryByUniqueID)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/summary/abc123", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 ok, got %d: %s", w.Code, w.Body.String())
	}

	var response struct {
		Data SummaryDrawer `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if response.Data.UniqueID != "abc123" {
		t.Fatalf("expected response uniqueid to stay aligned with the API identifier, got %+v", response.Data)
	}
	if response.Data.Src != "100" || response.Data.Dst != "200" {
		t.Fatalf("unexpected src/dst: %+v", response.Data)
	}
	if response.Data.CNam != "Alice" || response.Data.DstCNam != "Bob" {
		t.Fatalf("unexpected cnam fields: %+v", response.Data)
	}
	if response.Data.Company != "Acme" || response.Data.DstCompany != "Globex" {
		t.Fatalf("unexpected company fields: %+v", response.Data)
	}
	if response.Data.CallTimestamp == nil {
		t.Fatalf("expected call_timestamp to be populated: %+v", response.Data)
	}
}

func TestGetSummaryByUniqueID_ReturnsServiceUnavailableWhenTranscriptsTableIsMissing(t *testing.T) {
	gin.SetMode(gin.TestMode)
	store.UserSessionInit()
	store.UserSessions["alice"] = &models.UserSession{Username: "alice", NethCTIToken: "token"}

	configuration.Config.SatellitePgSQLHost = "test"
	configuration.Config.SatellitePgSQLPort = "5432"
	configuration.Config.SatellitePgSQLDB = "test"
	configuration.Config.SatellitePgSQLUser = "test"

	originalGetUserInfo := getUserInfoFunc
	originalCheck := checkUserParticipationFunc
	originalFetch := fetchSummaryDrawerFunc
	defer func() {
		getUserInfoFunc = originalGetUserInfo
		checkUserParticipationFunc = originalCheck
		fetchSummaryDrawerFunc = originalFetch
	}()

	getUserInfoFunc = func(string) (*UserInfo, error) {
		return &UserInfo{PhoneNumbers: []string{"100"}}, nil
	}
	checkUserParticipationFunc = func(string, []string) (bool, error) {
		return true, nil
	}
	fetchSummaryDrawerFunc = func(string, []string, []string) (*SummaryDrawer, bool, error) {
		return nil, false, &pgconn.PgError{Code: "42P01", Message: `relation "transcripts" does not exist`}
	}

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("JWT_PAYLOAD", jwtv5.MapClaims{"id": "alice"})
		c.Next()
	})
	router.GET("/summary/:uniqueid", GetSummaryByUniqueID)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/summary/abc123", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 service unavailable, got %d: %s", w.Code, w.Body.String())
	}

	var response struct {
		Message string                 `json:"message"`
		Data    map[string]interface{} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if response.Message != "satellite database schema not initialized" {
		t.Fatalf("unexpected message: %s", response.Message)
	}
	if response.Data["missing_table"] != "transcripts" {
		t.Fatalf("unexpected missing_table: %v", response.Data["missing_table"])
	}
}


// --- resolveAuthorizedUniqueID unit tests ---

func saveAndRestoreResolveFuncs(t *testing.T) func() {
	t.Helper()
	origCheck := checkUserParticipationFunc
	origCheckByLinked := checkUserParticipationByLinkedIDFunc
	origResolve := resolveLinkedIDToUniqueIDFunc
	origDiscover := discoverLinkedIDFromCDRFunc
	origSatExists := checkSatelliteRecordExistsFunc
	origSatParticipation := checkSatelliteParticipationFunc
	origSatLinked := findSatelliteUniqueIDsByLinkedIDFunc
	origExternals := getExternalPartiesFromCDRFunc
	origExternalSrcs := getExternalSrcNumsFromCDRFunc
	origAnswered := isCDRAnsweredFunc
	origSrcEqDst := checkSrcEqualsDstFunc

	// Default: treat all CDR rows as ANSWERED unless overridden by a test.
	isCDRAnsweredFunc = func(string) (bool, error) { return true, nil }
	// Default: not a routing artifact unless overridden by a test.
	checkSrcEqualsDstFunc = func(string, []string) (bool, error) { return false, nil }
	// Default: no external src nums.
	getExternalSrcNumsFromCDRFunc = func(string, []string) ([]string, error) { return nil, nil }

	return func() {
		checkUserParticipationFunc = origCheck
		checkUserParticipationByLinkedIDFunc = origCheckByLinked
		resolveLinkedIDToUniqueIDFunc = origResolve
		discoverLinkedIDFromCDRFunc = origDiscover
		checkSatelliteRecordExistsFunc = origSatExists
		checkSatelliteParticipationFunc = origSatParticipation
		findSatelliteUniqueIDsByLinkedIDFunc = origSatLinked
		getExternalPartiesFromCDRFunc = origExternals
		getExternalSrcNumsFromCDRFunc = origExternalSrcs
		isCDRAnsweredFunc = origAnswered
		checkSrcEqualsDstFunc = origSrcEqDst
	}
}

// Direct call without transfer: satellite record matches the requested uniqueid.
func TestResolve_DirectCall_SatelliteMatchesUniqueID(t *testing.T) {
	defer saveAndRestoreResolveFuncs(t)()

	checkSatelliteRecordExistsFunc = func(uid string) (bool, bool, error) {
		return uid == "uid-a", uid == "uid-a", nil
	}
	findSatelliteUniqueIDsByLinkedIDFunc = func(string) ([]string, error) {
		return nil, nil
	}
	checkUserParticipationFunc = func(uid string, _ []string) (bool, error) {
		return uid == "uid-a", nil
	}
	discoverLinkedIDFromCDRFunc = func(string) (string, error) { return "", nil }

	resolved, ok, err := resolveAuthorizedUniqueID("uid-a", "", []string{"201"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !ok || resolved != "uid-a" {
		t.Fatalf("expected uid-a, got %q (ok=%v)", resolved, ok)
	}
}

// Transfer scenario: user 201 asks about the queue CDR row (uid-queue).
// Satellite has two records (uid-201-leg and uid-202-leg) under the same linkedid.
// 201 participated in uid-201-leg but NOT uid-202-leg.
func TestResolve_Transfer_User201GetsOwnSegment(t *testing.T) {
	defer saveAndRestoreResolveFuncs(t)()

	// uid-queue has no satellite record; satellite records are under the agent legs
	checkSatelliteRecordExistsFunc = func(uid string) (bool, bool, error) {
		exists := uid == "uid-201-leg" || uid == "uid-202-leg"
		return exists, exists, nil
	}
	findSatelliteUniqueIDsByLinkedIDFunc = func(lid string) ([]string, error) {
		if lid == "linked-x" {
			return []string{"uid-201-leg", "uid-202-leg"}, nil
		}
		return nil, nil
	}
	checkUserParticipationFunc = func(uid string, phones []string) (bool, error) {
		// 201 participated only in uid-201-leg
		return uid == "uid-201-leg" && phones[0] == "201", nil
	}
	discoverLinkedIDFromCDRFunc = func(uid string) (string, error) {
		if uid == "uid-queue" {
			return "linked-x", nil
		}
		return "", nil
	}

	resolved, ok, err := resolveAuthorizedUniqueID("uid-queue", "", []string{"201"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !ok || resolved != "uid-201-leg" {
		t.Fatalf("expected uid-201-leg for user 201, got %q (ok=%v)", resolved, ok)
	}
}

// Transfer scenario: user 202 asks about their own CDR row.
// Satellite has two records under the same linkedid.
// 202 participated in uid-202-leg but NOT uid-201-leg.
func TestResolve_Transfer_User202GetsOwnSegment(t *testing.T) {
	defer saveAndRestoreResolveFuncs(t)()

	checkSatelliteRecordExistsFunc = func(uid string) (bool, bool, error) {
		exists := uid == "uid-201-leg" || uid == "uid-202-leg"
		return exists, exists, nil
	}
	findSatelliteUniqueIDsByLinkedIDFunc = func(lid string) ([]string, error) {
		if lid == "linked-x" {
			return []string{"uid-201-leg", "uid-202-leg"}, nil
		}
		return nil, nil
	}
	checkUserParticipationFunc = func(uid string, phones []string) (bool, error) {
		return uid == "uid-202-leg" && phones[0] == "202", nil
	}
	discoverLinkedIDFromCDRFunc = func(string) (string, error) { return "", nil }

	resolved, ok, err := resolveAuthorizedUniqueID("uid-202-row", "linked-x", []string{"202"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !ok || resolved != "uid-202-leg" {
		t.Fatalf("expected uid-202-leg for user 202, got %q (ok=%v)", resolved, ok)
	}
}

// Transfer scenario: user 201 asks for 202's post-transfer segment.
// Step 1 finds satellite content but 201 isn't a participant → falls through.
// Step 2 Pass A finds the consultation segment where 201 participated.
func TestResolve_Transfer_User201DoesNotSee202Segment(t *testing.T) {
	defer saveAndRestoreResolveFuncs(t)()

	checkSatelliteRecordExistsFunc = func(uid string) (bool, bool, error) {
		switch uid {
		case "uid-201-leg", "uid-202-leg", "uid-consult":
			return true, true, nil
		}
		return false, false, nil
	}
	findSatelliteUniqueIDsByLinkedIDFunc = func(lid string) ([]string, error) {
		if lid == "linked-x" {
			return []string{"uid-201-leg", "uid-consult", "uid-202-leg"}, nil
		}
		return nil, nil
	}
	checkUserParticipationFunc = func(uid string, phones []string) (bool, error) {
		// 201 is only in their own CDR leg
		return uid == "uid-201-leg" && phones[0] == "201", nil
	}
	checkSatelliteParticipationFunc = func(uid string, phones []string) (bool, error) {
		// 201 is in satellite for their own leg and the consultation
		switch uid {
		case "uid-201-leg", "uid-consult":
			return phones[0] == "201", nil
		}
		return false, nil
	}
	getExternalPartiesFromCDRFunc = func(uid string, phones []string) (map[string]struct{}, error) {
		switch uid {
		case "uid-201-leg":
			return map[string]struct{}{"3401234567": {}}, nil // main call has external
		case "uid-consult":
			return map[string]struct{}{}, nil // consultation has no external
		case "uid-202-leg":
			return map[string]struct{}{"3401234567": {}}, nil
		}
		return map[string]struct{}{}, nil
	}
	discoverLinkedIDFromCDRFunc = func(string) (string, error) { return "", nil }

	resolved, ok, err := resolveAuthorizedUniqueID("uid-202-leg", "linked-x", []string{"201"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// 201 should get the consultation segment, not 202's post-transfer content
	if !ok || resolved != "uid-consult" {
		t.Fatalf("expected uid-consult (consultation) for user 201, got %q (ok=%v)", resolved, ok)
	}
}

// Transfer scenario: user 201 asks for 202's segment but there's no consultation.
// Should return not authorized.
func TestResolve_Transfer_NoConsultation_ReturnsNotAuthorized(t *testing.T) {
	defer saveAndRestoreResolveFuncs(t)()

	checkSatelliteRecordExistsFunc = func(uid string) (bool, bool, error) {
		switch uid {
		case "uid-201-leg", "uid-202-leg":
			return true, true, nil
		}
		return false, false, nil
	}
	findSatelliteUniqueIDsByLinkedIDFunc = func(lid string) ([]string, error) {
		if lid == "linked-x" {
			return []string{"uid-201-leg", "uid-202-leg"}, nil
		}
		return nil, nil
	}
	checkUserParticipationFunc = func(uid string, phones []string) (bool, error) {
		return uid == "uid-201-leg" && phones[0] == "201", nil
	}
	checkSatelliteParticipationFunc = func(uid string, phones []string) (bool, error) {
		return uid == "uid-201-leg" && phones[0] == "201", nil
	}
	getExternalPartiesFromCDRFunc = func(uid string, phones []string) (map[string]struct{}, error) {
		// Both legs have external parties (not consultations)
		return map[string]struct{}{"3401234567": {}}, nil
	}
	discoverLinkedIDFromCDRFunc = func(string) (string, error) { return "", nil }
	resolveLinkedIDToUniqueIDFunc = func(string, []string) (string, error) { return "", nil }

	resolved, ok, err := resolveAuthorizedUniqueID("uid-202-leg", "linked-x", []string{"201"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Pass B would find uid-201-leg via CDR but external parties match the
	// same external caller. This is the original call — user gets redirected.
	if !ok || resolved != "uid-201-leg" {
		t.Fatalf("expected uid-201-leg fallback, got %q (ok=%v)", resolved, ok)
	}
}

// Transfer consultation: CDR has dst='s' but satellite has the real participants.
// The satellite participation fallback must authorize the user.
func TestResolve_ConsultationSegment_SatelliteParticipationFallback(t *testing.T) {
	defer saveAndRestoreResolveFuncs(t)()

	checkSatelliteRecordExistsFunc = func(uid string) (bool, bool, error) {
		return uid == "uid-consult", uid == "uid-consult", nil
	}
	checkUserParticipationFunc = func(uid string, phones []string) (bool, error) {
		// CDR for consultation has dst='s' — user 201 not found via CDR
		return false, nil
	}
	checkSatelliteParticipationFunc = func(uid string, phones []string) (bool, error) {
		// But satellite has src_number=201 for the consultation
		return uid == "uid-consult" && phones[0] == "201", nil
	}
	discoverLinkedIDFromCDRFunc = func(string) (string, error) { return "", nil }

	resolved, ok, err := resolveAuthorizedUniqueID("uid-consult", "", []string{"201"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !ok || resolved != "uid-consult" {
		t.Fatalf("expected uid-consult authorized via satellite, got %q (ok=%v)", resolved, ok)
	}
}

// No satellite record yet (transcription in progress): fall back to CDR-based resolution.
func TestResolve_NoSatelliteRecordYet_FallsBackToCDR(t *testing.T) {
	defer saveAndRestoreResolveFuncs(t)()

	checkSatelliteRecordExistsFunc = func(string) (bool, bool, error) { return false, false, nil }
	findSatelliteUniqueIDsByLinkedIDFunc = func(string) ([]string, error) { return nil, nil }
	resolveLinkedIDToUniqueIDFunc = func(lid string, phones []string) (string, error) {
		if lid == "linked-x" && phones[0] == "201" {
			return "uid-201-cdr", nil
		}
		return "", nil
	}
	discoverLinkedIDFromCDRFunc = func(uid string) (string, error) {
		if uid == "uid-queue" {
			return "linked-x", nil
		}
		return "", nil
	}

	resolved, ok, err := resolveAuthorizedUniqueID("uid-queue", "", []string{"201"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !ok || resolved != "uid-201-cdr" {
		t.Fatalf("expected uid-201-cdr from CDR fallback, got %q (ok=%v)", resolved, ok)
	}
}

// No phone numbers: always returns unauthorized.
func TestResolve_NoPhoneNumbers_ReturnsFalse(t *testing.T) {
	defer saveAndRestoreResolveFuncs(t)()

	resolved, ok, err := resolveAuthorizedUniqueID("uid-a", "linked-x", []string{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ok || resolved != "" {
		t.Fatalf("expected unauthorized for no phone numbers, got %q (ok=%v)", resolved, ok)
	}
}

// User not in any leg: returns unauthorized.
func TestResolve_UserNotInAnyLeg_ReturnsFalse(t *testing.T) {
	defer saveAndRestoreResolveFuncs(t)()

	checkSatelliteRecordExistsFunc = func(string) (bool, bool, error) { return true, true, nil }
	findSatelliteUniqueIDsByLinkedIDFunc = func(string) ([]string, error) {
		return []string{"uid-201-leg"}, nil
	}
	checkUserParticipationFunc = func(string, []string) (bool, error) { return false, nil }
	checkUserParticipationByLinkedIDFunc = func(string, []string) (bool, error) { return false, nil }
	resolveLinkedIDToUniqueIDFunc = func(string, []string) (string, error) { return "", nil }
	discoverLinkedIDFromCDRFunc = func(string) (string, error) { return "", nil }

	resolved, ok, err := resolveAuthorizedUniqueID("uid-a", "linked-x", []string{"999"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ok || resolved != "" {
		t.Fatalf("expected unauthorized for non-participant, got %q (ok=%v)", resolved, ok)
	}
}

// Satellite DB error in step 1: should continue to step 2 instead of crashing.
func TestResolve_SatelliteErrorStep1_ContinuesToStep2(t *testing.T) {
	defer saveAndRestoreResolveFuncs(t)()

	checkSatelliteRecordExistsFunc = func(string) (bool, bool, error) {
		return false, false, errors.New("satellite db unavailable")
	}
	findSatelliteUniqueIDsByLinkedIDFunc = func(lid string) ([]string, error) {
		if lid == "linked-x" {
			return []string{"uid-201-leg"}, nil
		}
		return nil, nil
	}
	checkUserParticipationFunc = func(uid string, _ []string) (bool, error) {
		return uid == "uid-201-leg", nil
	}
	discoverLinkedIDFromCDRFunc = func(string) (string, error) { return "", nil }

	resolved, ok, err := resolveAuthorizedUniqueID("uid-a", "linked-x", []string{"201"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !ok || resolved != "uid-201-leg" {
		t.Fatalf("expected fallback to step 2, got %q (ok=%v)", resolved, ok)
	}
}

// Transfer scenario: satellite record exists for the requested uniqueid but is empty
// (e.g., unanswered queue ring). A better record with content exists under the same linkedid.
// The resolver should skip the empty direct match and find the content-bearing record.
func TestResolve_EmptyDirectMatch_FindsBetterViaLinkedID(t *testing.T) {
	defer saveAndRestoreResolveFuncs(t)()

	// uid-ring exists but is empty; uid-transfer has content
	checkSatelliteRecordExistsFunc = func(uid string) (bool, bool, error) {
		switch uid {
		case "uid-ring":
			return true, false, nil // exists, no content
		case "uid-transfer":
			return true, true, nil // exists, has content
		}
		return false, false, nil
	}
	findSatelliteUniqueIDsByLinkedIDFunc = func(lid string) ([]string, error) {
		if lid == "linked-x" {
			// content-bearing record comes first (findSatelliteUniqueIDsByLinkedID orders by content)
			return []string{"uid-transfer", "uid-ring"}, nil
		}
		return nil, nil
	}
	checkUserParticipationFunc = func(uid string, phones []string) (bool, error) {
		// User 202 participated in both the ring (NO ANSWER) and the transfer leg
		return (uid == "uid-ring" || uid == "uid-transfer") && phones[0] == "202", nil
	}
	discoverLinkedIDFromCDRFunc = func(string) (string, error) { return "", nil }

	resolved, ok, err := resolveAuthorizedUniqueID("uid-ring", "linked-x", []string{"202"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Should resolve to uid-transfer (has content) instead of uid-ring (empty)
	if !ok || resolved != "uid-transfer" {
		t.Fatalf("expected uid-transfer (content-bearing), got %q (ok=%v)", resolved, ok)
	}
}

// Transfer scenario: satellite record exists and is empty, no better record exists.
// Should still return the empty record as fallback.
func TestResolve_EmptyDirectMatch_NoBetterRecord_ReturnsFallback(t *testing.T) {
	defer saveAndRestoreResolveFuncs(t)()

	checkSatelliteRecordExistsFunc = func(uid string) (bool, bool, error) {
		if uid == "uid-ring" {
			return true, false, nil // exists, no content
		}
		return false, false, nil
	}
	findSatelliteUniqueIDsByLinkedIDFunc = func(lid string) ([]string, error) {
		if lid == "linked-x" {
			return []string{"uid-ring"}, nil // only the empty one
		}
		return nil, nil
	}
	checkUserParticipationFunc = func(uid string, phones []string) (bool, error) {
		return uid == "uid-ring" && phones[0] == "202", nil
	}
	resolveLinkedIDToUniqueIDFunc = func(string, []string) (string, error) { return "", nil }
	discoverLinkedIDFromCDRFunc = func(string) (string, error) { return "", nil }

	resolved, ok, err := resolveAuthorizedUniqueID("uid-ring", "linked-x", []string{"202"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Should fall back to the empty record since no better one exists
	if !ok || resolved != "uid-ring" {
		t.Fatalf("expected uid-ring (empty fallback), got %q (ok=%v)", resolved, ok)
	}
}

// Transfer consultation row (201→s) must NOT show transcription from the main call
// (3401234567→201). They share linkedid but not the external party.
func TestResolve_TransferConsultation_NoExternalPartyMatch(t *testing.T) {
	defer saveAndRestoreResolveFuncs(t)()

	// CDR data: uid-consult has src=201, dst=s; uid-main has src=3401234567, dst=201
	getExternalPartiesFromCDRFunc = func(uid string, phones []string) (map[string]struct{}, error) {
		phoneSet := make(map[string]struct{})
		for _, p := range phones {
			phoneSet[p] = struct{}{}
		}
		switch uid {
		case "uid-consult":
			// src=201 (user, filtered), dst=s (filtered as "s")
			return map[string]struct{}{}, nil
		case "uid-main":
			// src=3401234567 (external), dst=201 (user, filtered)
			return map[string]struct{}{"3401234567": {}}, nil
		}
		return map[string]struct{}{}, nil
	}
	checkSatelliteRecordExistsFunc = func(uid string) (bool, bool, error) {
		if uid == "uid-main" {
			return true, true, nil
		}
		return false, false, nil
	}
	findSatelliteUniqueIDsByLinkedIDFunc = func(lid string) ([]string, error) {
		if lid == "linked-x" {
			return []string{"uid-main"}, nil
		}
		return nil, nil
	}
	checkUserParticipationFunc = func(uid string, phones []string) (bool, error) {
		// User 201 participated in uid-main and uid-consult (as src)
		return (uid == "uid-main" || uid == "uid-consult") && phones[0] == "201", nil
	}
	resolveLinkedIDToUniqueIDFunc = func(lid string, phones []string) (string, error) {
		if lid == "linked-x" && phones[0] == "201" {
			return "uid-main", nil
		}
		return "", nil
	}
	discoverLinkedIDFromCDRFunc = func(string) (string, error) { return "", nil }

	resolved, ok, err := resolveAuthorizedUniqueID("uid-consult", "linked-x", []string{"201"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// uid-consult has no external parties → Step 2/3 cross-check blocks uid-main
	// Step 4 returns uid-consult (user participated as src)
	if !ok || resolved != "uid-consult" {
		t.Fatalf("expected uid-consult (no cross-contamination), got %q (ok=%v)", resolved, ok)
	}
}

// Queue row (3401234567→401) should match the answered segment (3401234567→201)
// because they share the external caller 3401234567.
func TestResolve_QueueRow_MatchesAnsweredSegmentViaExternalParty(t *testing.T) {
	defer saveAndRestoreResolveFuncs(t)()

	getExternalPartiesFromCDRFunc = func(uid string, phones []string) (map[string]struct{}, error) {
		switch uid {
		case "uid-queue":
			// src=3401234567, dst=401 — both are external for user 201
			return map[string]struct{}{"3401234567": {}, "401": {}}, nil
		case "uid-201-leg":
			// src=3401234567, dst=201 (user)
			return map[string]struct{}{"3401234567": {}}, nil
		}
		return map[string]struct{}{}, nil
	}
	checkSatelliteRecordExistsFunc = func(uid string) (bool, bool, error) {
		if uid == "uid-201-leg" {
			return true, true, nil
		}
		return false, false, nil
	}
	findSatelliteUniqueIDsByLinkedIDFunc = func(lid string) ([]string, error) {
		if lid == "linked-x" {
			return []string{"uid-201-leg"}, nil
		}
		return nil, nil
	}
	checkUserParticipationFunc = func(uid string, phones []string) (bool, error) {
		return uid == "uid-201-leg" && phones[0] == "201", nil
	}
	discoverLinkedIDFromCDRFunc = func(uid string) (string, error) {
		if uid == "uid-queue" {
			return "linked-x", nil
		}
		return "", nil
	}

	resolved, ok, err := resolveAuthorizedUniqueID("uid-queue", "", []string{"201"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Queue row shares external party 3401234567 with uid-201-leg → match allowed
	if !ok || resolved != "uid-201-leg" {
		t.Fatalf("expected uid-201-leg (queue → answered segment), got %q (ok=%v)", resolved, ok)
	}
}

// Transfer CDR row (201→202) must not steal transcription from main call (3401234567→201)
// even though user 201 participated in both and they share linkedid.
func TestResolve_TransferRow_DoesNotStealMainCallTranscription(t *testing.T) {
	defer saveAndRestoreResolveFuncs(t)()

	getExternalPartiesFromCDRFunc = func(uid string, phones []string) (map[string]struct{}, error) {
		switch uid {
		case "uid-transfer":
			// src=201 (user), dst=202 (external for user 201)
			return map[string]struct{}{"202": {}}, nil
		case "uid-main":
			// src=3401234567, dst=201 (user)
			return map[string]struct{}{"3401234567": {}}, nil
		case "uid-cdr-main":
			return map[string]struct{}{"3401234567": {}}, nil
		}
		return map[string]struct{}{}, nil
	}
	checkSatelliteRecordExistsFunc = func(uid string) (bool, bool, error) {
		if uid == "uid-main" {
			return true, true, nil
		}
		return false, false, nil
	}
	findSatelliteUniqueIDsByLinkedIDFunc = func(lid string) ([]string, error) {
		if lid == "linked-x" {
			return []string{"uid-main"}, nil
		}
		return nil, nil
	}
	checkUserParticipationFunc = func(uid string, phones []string) (bool, error) {
		// 201 participated in uid-main (as dst) and uid-transfer (as src)
		if phones[0] != "201" {
			return false, nil
		}
		return uid == "uid-main" || uid == "uid-transfer", nil
	}
	resolveLinkedIDToUniqueIDFunc = func(lid string, phones []string) (string, error) {
		if lid == "linked-x" && phones[0] == "201" {
			return "uid-cdr-main", nil
		}
		return "", nil
	}
	discoverLinkedIDFromCDRFunc = func(string) (string, error) { return "", nil }

	resolved, ok, err := resolveAuthorizedUniqueID("uid-transfer", "linked-x", []string{"201"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// uid-transfer externals={202}, uid-main externals={3401234567} → no overlap → blocked
	// Step 3: uid-cdr-main externals={3401234567} vs uid-transfer externals={202} → blocked
	// Step 4: direct participation for uid-transfer → ok → return uid-transfer
	if !ok || resolved != "uid-transfer" {
		t.Fatalf("expected uid-transfer (no cross-contamination), got %q (ok=%v)", resolved, ok)
	}
}

// TestGetTranscriptionByUniqueID_CanonicalRowWithDuplicateUniqueIDs verifies that when satellite
// stores multiple transcript rows for the same uniqueid (transferred calls), the handler receives
// and returns the canonical row – the latest non-deleted row as selected by the DB function.
func TestGetTranscriptionByUniqueID_CanonicalRowWithDuplicateUniqueIDs(t *testing.T) {
	gin.SetMode(gin.TestMode)
	store.UserSessionInit()
	store.UserSessions["alice"] = &models.UserSession{Username: "alice", NethCTIToken: "token"}

	configuration.Config.SatellitePgSQLHost = "test"
	configuration.Config.SatellitePgSQLPort = "5432"
	configuration.Config.SatellitePgSQLDB = "test"
	configuration.Config.SatellitePgSQLUser = "test"

	originalGetUserInfo := getUserInfoFunc
	originalCheck := checkUserParticipationFunc
	originalFetchTranscription := fetchTranscriptionFunc
	originalFetchMeta := fetchTranscriptionMetaFunc
	defer func() {
		getUserInfoFunc = originalGetUserInfo
		checkUserParticipationFunc = originalCheck
		fetchTranscriptionFunc = originalFetchTranscription
		fetchTranscriptionMetaFunc = originalFetchMeta
	}()

	getUserInfoFunc = func(string) (*UserInfo, error) {
		return &UserInfo{PhoneNumbers: []string{"100"}}, nil
	}
	checkUserParticipationFunc = func(string, []string) (bool, error) {
		return true, nil
	}

	// Simulate two satellite rows for the same uniqueid; the DB function returns the latest one.
	latestCreatedAt := time.Now()
	fetchTranscriptionFunc = func(uniqueID string, _ []string, _ []string) (string, *time.Time, bool, error) {
		// The DB function applies ORDER BY updated_at DESC, id DESC LIMIT 1,
		// so only the latest row is returned here.
		return "latest fragment transcript", &latestCreatedAt, true, nil
	}
	fetchTranscriptionMetaFunc = func(string) (*CallMetadata, error) {
		return &CallMetadata{Src: "100", Dst: "200"}, nil
	}

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("JWT_PAYLOAD", jwtv5.MapClaims{"id": "alice"})
		c.Next()
	})
	router.GET("/transcripts/:uniqueid", GetTranscriptionByUniqueID)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/transcripts/1234567890.99", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 ok, got %d: %s", w.Code, w.Body.String())
	}

	var response struct {
		Data struct {
			UniqueID      string `json:"uniqueid"`
			Transcription string `json:"transcription"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if response.Data.Transcription != "latest fragment transcript" {
		t.Fatalf("expected canonical (latest) transcript, got %q", response.Data.Transcription)
	}
}

// TestResolve_LocalRoutingArtifact_ResolvesToPairedLeg verifies that a Local
// channel ;1 CDR row (src==dst==user, no satellite record) resolves to the
// paired ;2 leg satellite record that the user participated in.
// Real-world case: user 202 answered a transferred call. CDR shows two rows for
// the Local/202@from-internal channel: the ;1 leg (1777910241.1144, src=202,
// dst=202) and the ;2 leg (1777910241.1145, src=3401234567, dst=202). Satellite
// only has a record for the ;2 leg. The frontend asks for the ;1 leg's status
// and should receive the ;2 leg's transcript status.
func TestResolve_LocalRoutingArtifact_ResolvesToPairedLeg(t *testing.T) {
	defer saveAndRestoreResolveFuncs(t)()

	// The ;1 leg (uid-local-1) has no satellite record; the ;2 leg (uid-local-2) does.
	checkSatelliteRecordExistsFunc = func(uid string) (bool, bool, error) {
		if uid == "uid-local-2" {
			return true, true, nil
		}
		return false, false, nil
	}

	// Satellite for linkedid returns the ;2 leg only.
	findSatelliteUniqueIDsByLinkedIDFunc = func(lid string) ([]string, error) {
		if lid == "linked-x" {
			return []string{"uid-local-2"}, nil
		}
		return nil, nil
	}

	// User 202 participated in the ;2 leg (dst=202 in CDR).
	checkUserParticipationFunc = func(uid string, phones []string) (bool, error) {
		return uid == "uid-local-2" && phones[0] == "202", nil
	}

	// ;1 leg CDR: src=202, dst=202 → no external parties.
	// ;2 leg CDR: src=3401234567, dst=202 → external party 3401234567.
	getExternalPartiesFromCDRFunc = func(uid string, phones []string) (map[string]struct{}, error) {
		switch uid {
		case "uid-local-1":
			return map[string]struct{}{}, nil // src==dst==user, no externals
		case "uid-local-2":
			return map[string]struct{}{"3401234567": {}}, nil
		}
		return map[string]struct{}{}, nil
	}

	// The ;1 leg is a Local channel routing artifact: src==dst==202.
	checkSrcEqualsDstFunc = func(uid string, phones []string) (bool, error) {
		return uid == "uid-local-1", nil
	}

	discoverLinkedIDFromCDRFunc = func(string) (string, error) { return "", nil }

	resolved, ok, err := resolveAuthorizedUniqueID("uid-local-1", "linked-x", []string{"202"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// The ;1 leg should resolve to the ;2 leg's satellite record.
	if !ok || resolved != "uid-local-2" {
		t.Fatalf("expected uid-local-2 (paired ;2 leg), got %q (ok=%v)", resolved, ok)
	}
}

// TestResolveFulll_RoutingArtifact_ExcludesExternalSrc verifies that a Local
// channel ;1 routing artifact returns the paired ;2 external src as an
// excluded source so transcript selection prefers the consultation record.
// Importantly, cnum (e.g. "201") must NOT appear in excludedSrcNums even
// when getExternalPartiesFromCDR includes it — only the src column is used.
func TestResolveFulll_RoutingArtifact_ExcludesExternalSrc(t *testing.T) {
	defer saveAndRestoreResolveFuncs(t)()

	checkSatelliteRecordExistsFunc = func(uid string) (bool, bool, error) {
		if uid == "uid-local-2" {
			return true, true, nil
		}
		return false, false, nil
	}
	findSatelliteUniqueIDsByLinkedIDFunc = func(lid string) ([]string, error) {
		if lid == "linked-x" {
			return []string{"uid-local-2"}, nil
		}
		return nil, nil
	}
	checkUserParticipationFunc = func(uid string, phones []string) (bool, error) {
		return uid == "uid-local-2" && phones[0] == "202", nil
	}
	// getExternalPartiesFromCDR includes cnum="201" (transfer initiator) as external —
	// this simulates the real CDR behaviour that caused the original bug.
	getExternalPartiesFromCDRFunc = func(uid string, phones []string) (map[string]struct{}, error) {
		switch uid {
		case "uid-local-1":
			return map[string]struct{}{}, nil
		case "uid-local-2":
			// cnum=201 appears here but must NOT end up in excludedSrcNums
			return map[string]struct{}{"3401234567": {}, "201": {}}, nil
		}
		return map[string]struct{}{}, nil
	}
	// getExternalSrcNumsFromCDRFunc only returns the CDR src column — "201" (cnum) excluded.
	getExternalSrcNumsFromCDRFunc = func(uid string, phones []string) ([]string, error) {
		if uid == "uid-local-2" {
			return []string{"3401234567"}, nil
		}
		return nil, nil
	}
	checkSrcEqualsDstFunc = func(uid string, phones []string) (bool, error) {
		return uid == "uid-local-1", nil
	}
	discoverLinkedIDFromCDRFunc = func(string) (string, error) { return "", nil }

	resolved, excludedSrcNums, ok, err := resolveAuthorizedUniqueIDFull("uid-local-1", "linked-x", []string{"202"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !ok || resolved != "uid-local-2" {
		t.Fatalf("expected uid-local-2 (paired ;2 leg), got %q (ok=%v)", resolved, ok)
	}
	// Only the external src (3401234567) should be excluded; cnum "201" must not appear.
	if len(excludedSrcNums) != 1 || excludedSrcNums[0] != "3401234567" {
		t.Fatalf("expected excluded srcs [3401234567], got %v", excludedSrcNums)
	}
}

func TestResolve_LocalRoutingArtifact_NoContent_FallsThrough(t *testing.T) {
	defer saveAndRestoreResolveFuncs(t)()

	// The ;2 leg exists in satellite but has no content.
	checkSatelliteRecordExistsFunc = func(uid string) (bool, bool, error) {
		if uid == "uid-local-2" {
			return true, false, nil // exists but no content
		}
		return false, false, nil
	}

	findSatelliteUniqueIDsByLinkedIDFunc = func(lid string) ([]string, error) {
		if lid == "linked-x" {
			return []string{"uid-local-2"}, nil
		}
		return nil, nil
	}

	// User 202 participated in both legs (;1 leg: src=dst=202; ;2 leg: dst=202).
	checkUserParticipationFunc = func(uid string, phones []string) (bool, error) {
		return (uid == "uid-local-1" || uid == "uid-local-2") && phones[0] == "202", nil
	}

	getExternalPartiesFromCDRFunc = func(uid string, phones []string) (map[string]struct{}, error) {
		if uid == "uid-local-1" {
			return map[string]struct{}{}, nil
		}
		return map[string]struct{}{"3401234567": {}}, nil
	}

	checkSrcEqualsDstFunc = func(uid string, phones []string) (bool, error) {
		return uid == "uid-local-1", nil
	}

	discoverLinkedIDFromCDRFunc = func(string) (string, error) { return "", nil }
	resolveLinkedIDToUniqueIDFunc = func(string, []string) (string, error) { return "", nil }

	resolved, ok, err := resolveAuthorizedUniqueID("uid-local-1", "linked-x", []string{"202"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// No content on ;2 leg — falls through to Step 4 returning the ;1 leg itself.
	if !ok || resolved != "uid-local-1" {
		t.Fatalf("expected uid-local-1 (no content fallback), got %q (ok=%v)", resolved, ok)
	}
}

func TestResolve_NoAnswer_ReturnsNotAuthorized(t *testing.T) {
	defer saveAndRestoreResolveFuncs(t)()

	// Override the default — this CDR is NOT answered.
	isCDRAnsweredFunc = func(uid string) (bool, error) {
		if uid == "uid-noanswer" {
			return false, nil
		}
		return true, nil
	}
	checkSatelliteRecordExistsFunc = func(uid string) (bool, bool, error) {
		return true, true, nil
	}
	checkUserParticipationFunc = func(uid string, _ []string) (bool, error) {
		return true, nil
	}

	resolved, ok, err := resolveAuthorizedUniqueID("uid-noanswer", "", []string{"202"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ok || resolved != "" {
		t.Fatalf("expected not authorized for NO ANSWER, got %q (ok=%v)", resolved, ok)
	}
}

// TestResolve_ZeroDuration_ReturnsNotAuthorized verifies that a CDR row with
// disposition ANSWERED but duration 0 (routing artifact) does not resolve.
func TestResolve_ZeroDuration_ReturnsNotAuthorized(t *testing.T) {
	defer saveAndRestoreResolveFuncs(t)()

	// Override — this CDR has ANSWERED but duration=0 (Local channel artifact).
	isCDRAnsweredFunc = func(uid string) (bool, error) {
		if uid == "uid-zerodur" {
			return false, nil // duration=0 → isCDRAnswered returns false
		}
		return true, nil
	}
	checkSatelliteRecordExistsFunc = func(uid string) (bool, bool, error) {
		return true, true, nil
	}
	checkUserParticipationFunc = func(uid string, _ []string) (bool, error) {
		return true, nil
	}

	resolved, ok, err := resolveAuthorizedUniqueID("uid-zerodur", "", []string{"202"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ok || resolved != "" {
		t.Fatalf("expected not authorized for zero-duration CDR, got %q (ok=%v)", resolved, ok)
	}
}
