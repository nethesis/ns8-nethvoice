/*
 * Copyright (C) 2026 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package methods

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	jwtv5 "github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/nethesis/nethcti-middleware/configuration"
	"github.com/nethesis/nethcti-middleware/models"
	"github.com/nethesis/nethcti-middleware/store"
)

func TestHistorySummaryLookupKey_PrefersUniqueID(t *testing.T) {
	cases := []struct {
		name     string
		linkedID string
		uniqueID string
		want     string
	}{
		{name: "both present prefers uniqueid (per-leg)", linkedID: "L-1", uniqueID: "U-2", want: "U-2"},
		{name: "uniqueid only", linkedID: "", uniqueID: "U-2", want: "U-2"},
		{name: "linkedid fallback when uniqueid missing", linkedID: "L-1", uniqueID: "", want: "L-1"},
		{name: "both empty", linkedID: "", uniqueID: "", want: ""},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := historySummaryLookupKey(tc.linkedID, tc.uniqueID); got != tc.want {
				t.Fatalf("historySummaryLookupKey(%q, %q) = %q, want %q", tc.linkedID, tc.uniqueID, got, tc.want)
			}
		})
	}
}

func TestGetFilteredHistory_ReturnsEmptyRowsWhenTranscriptsTableIsMissing(t *testing.T) {
	router, cleanup := setupHistoryArtifactTest(t, func([]string, []string) ([]SummaryListItem, error) {
		return nil, &pgconn.PgError{Code: "42P01", Message: `relation "transcripts" does not exist`}
	})
	defer cleanup()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/history/calls?callType=user&username=alice&from=20260430&to=20260507&artifact=summary", nil)
	router.ServeHTTP(w, req)

	// A missing schema means no row has a summary yet, which is the same
	// outcome as a normal empty filter result, not an outage.
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 ok, got %d: %s", w.Code, w.Body.String())
	}

	var response struct {
		Count int                      `json:"count"`
		Rows  []map[string]interface{} `json:"rows"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if response.Count != 0 || len(response.Rows) != 0 {
		t.Fatalf("expected no rows, got %+v", response)
	}
}

func TestGetFilteredHistory_ReturnsServiceUnavailableWhenSatelliteDBIsUnavailable(t *testing.T) {
	router, cleanup := setupHistoryArtifactTest(t, func([]string, []string) ([]SummaryListItem, error) {
		return nil, sql.ErrConnDone
	})
	defer cleanup()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/history/calls?callType=user&username=alice&from=20260430&to=20260507&artifact=transcription", nil)
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

func setupHistoryArtifactTest(t *testing.T, fetchList func([]string, []string) ([]SummaryListItem, error)) (*gin.Engine, func()) {
	t.Helper()

	gin.SetMode(gin.TestMode)
	store.UserSessionInit()
	store.UserSessions["alice"] = &models.UserSession{Username: "alice", NethCTIToken: "legacy-token"}

	legacyServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"count":1,"rows":[{"linkedid":"abc123"}]}`))
	}))

	originalConfig := configuration.Config
	configuration.Config.V1Protocol = "http"
	configuration.Config.V1ApiEndpoint = strings.TrimPrefix(legacyServer.URL, "http://")
	configuration.Config.V1ApiPath = ""
	configuration.Config.SatellitePgSQLHost = "test"
	configuration.Config.SatellitePgSQLPort = "5432"
	configuration.Config.SatellitePgSQLDB = "test"
	configuration.Config.SatellitePgSQLUser = "test"

	originalGetUserInfo := getUserInfoFunc
	originalCheck := checkUserParticipationFunc
	originalFetchList := fetchSummaryListFunc
	originalResolveLinkedID := resolveLinkedIDToUniqueIDFunc
	originalFindSatelliteUIDs := findSatelliteUniqueIDsByLinkedIDFunc

	getUserInfoFunc = func(string) (*UserInfo, error) {
		return &UserInfo{PhoneNumbers: []string{"100"}}, nil
	}
	checkUserParticipationFunc = func(string, []string) (bool, error) {
		return true, nil
	}
	// Resolve the requested leg to a known uniqueid without touching the DB so
	// the artifact lookup reaches fetchSummaryListFunc (the seam under test).
	resolveLinkedIDToUniqueIDFunc = func(string, []string) (string, error) {
		return "uid-1", nil
	}
	findSatelliteUniqueIDsByLinkedIDFunc = func(string) ([]string, error) {
		return nil, nil
	}
	fetchSummaryListFunc = fetchList

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("JWT_PAYLOAD", jwtv5.MapClaims{"id": "alice"})
		c.Next()
	})
	router.GET("/history/calls", GetFilteredHistory)

	cleanup := func() {
		legacyServer.Close()
		configuration.Config = originalConfig
		getUserInfoFunc = originalGetUserInfo
		checkUserParticipationFunc = originalCheck
		fetchSummaryListFunc = originalFetchList
		resolveLinkedIDToUniqueIDFunc = originalResolveLinkedID
		findSatelliteUniqueIDsByLinkedIDFunc = originalFindSatelliteUIDs
	}

	return router, cleanup
}

func TestHistoryArtifactRowMatches(t *testing.T) {
	cases := []struct {
		name     string
		artifact string
		item     SummaryListItem
		want     bool
	}{
		{
			name:     "transcription filter keeps transcription-only call",
			artifact: historyArtifactTranscription,
			item:     SummaryListItem{State: "done", HasTranscription: true},
			want:     true,
		},
		{
			name:     "transcription filter keeps call that also has a summary",
			artifact: historyArtifactTranscription,
			item:     SummaryListItem{State: "done", HasTranscription: true, HasSummary: true},
			want:     true,
		},
		{
			name:     "transcription filter drops call without transcription",
			artifact: historyArtifactTranscription,
			item:     SummaryListItem{State: "done", HasSummary: true},
			want:     false,
		},
		{
			name:     "summary filter keeps call with summary and transcription",
			artifact: historyArtifactSummary,
			item:     SummaryListItem{State: "done", HasTranscription: true, HasSummary: true},
			want:     true,
		},
		{
			name:     "summary filter drops transcription-only call",
			artifact: historyArtifactSummary,
			item:     SummaryListItem{State: "done", HasTranscription: true},
			want:     false,
		},
		{
			name:     "non-done state is never matched",
			artifact: historyArtifactTranscription,
			item:     SummaryListItem{State: "processing", HasTranscription: true},
			want:     false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := historyArtifactRowMatches(tc.artifact, tc.item); got != tc.want {
				t.Fatalf("historyArtifactRowMatches(%q, %+v) = %v, want %v", tc.artifact, tc.item, got, tc.want)
			}
		})
	}
}

func TestCollapseHistoryRowsByLinkedid(t *testing.T) {
	rows := []map[string]interface{}{
		{"linkedid": "L1", "uniqueid": "u1a", "time": float64(300), "disposition": "NO ANSWER", "dst": "121"},
		{"linkedid": "L1", "uniqueid": "u1b", "time": float64(310), "disposition": "ANSWERED", "dst": "120"},
		{"linkedid": "L1", "uniqueid": "u1c", "time": float64(305), "disposition": "NO ANSWER", "dst": "122"},
		{"linkedid": "", "uniqueid": "u2", "time": float64(200), "disposition": "ANSWERED", "dst": "450"},
		{"linkedid": "L3", "uniqueid": "u3", "time": float64(100), "disposition": "NO ANSWER", "dst": "453"},
	}

	got := collapseHistoryRowsByLinkedid(rows)

	if len(got) != 3 {
		t.Fatalf("expected 3 parent rows, got %d", len(got))
	}
	// Order preserved: L1 group first (first-occurrence index 0), then standalone, then L3.
	if got[0]["linkedid"] != "L1" || got[1]["uniqueid"] != "u2" || got[2]["linkedid"] != "L3" {
		t.Fatalf("order not preserved: %+v", got)
	}
	// Parent of L1 is the ANSWERED leg.
	if got[0]["uniqueid"] != "u1b" {
		t.Fatalf("expected ANSWERED leg u1b as parent, got %v", got[0]["uniqueid"])
	}
	if got[0]["interactionsCount"] != 3 {
		t.Fatalf("expected interactionsCount 3, got %v", got[0]["interactionsCount"])
	}
	children, ok := got[0]["interactions"].([]map[string]interface{})
	if !ok || len(children) != 3 {
		t.Fatalf("expected all 3 legs listed as interactions, got %v", got[0]["interactions"])
	}
	// Every leg is listed, the parent's included, in creation order (u1a@300,
	// u1c@305, u1b@310 — these ids are not Asterisk-shaped, so time is the key).
	if children[0]["uniqueid"] != "u1a" || children[1]["uniqueid"] != "u1c" || children[2]["uniqueid"] != "u1b" {
		t.Fatalf("children wrong/unsorted: %+v", children)
	}
	// Standalone (empty linkedid) and single-leg group have count 1 and no interactions.
	if got[1]["interactionsCount"] != 1 {
		t.Fatalf("standalone count should be 1, got %v", got[1]["interactionsCount"])
	}
	if _, has := got[2]["interactions"]; has {
		t.Fatalf("single-leg group must not have interactions")
	}
	if got[2]["interactionsCount"] != 1 {
		t.Fatalf("single-leg count should be 1, got %v", got[2]["interactionsCount"])
	}
}

// TestCollapseHistoryRowsByLinkedid_NoAnsweredLeg proves that when a linkedid
// group has no ANSWERED leg, selectParentLegIndex falls back to 0 (the first
// leg) and the parent's interactions are the remaining legs ordered by
// ascending time.
func TestCollapseHistoryRowsByLinkedid_NoAnsweredLeg(t *testing.T) {
	rows := []map[string]interface{}{
		{"linkedid": "L1", "uniqueid": "u1a", "time": float64(300), "disposition": "NO ANSWER", "dst": "121"},
		{"linkedid": "L1", "uniqueid": "u1b", "time": float64(100), "disposition": "BUSY", "dst": "120"},
		{"linkedid": "L1", "uniqueid": "u1c", "time": float64(200), "disposition": "NO ANSWER", "dst": "122"},
	}

	got := collapseHistoryRowsByLinkedid(rows)

	if len(got) != 1 {
		t.Fatalf("expected 1 parent row, got %d", len(got))
	}
	// No ANSWERED leg in the group: parent falls back to the EARLIEST leg
	// deterministically (u1b@100), independent of input order.
	if got[0]["uniqueid"] != "u1b" {
		t.Fatalf("expected earliest leg u1b as fallback parent, got %v", got[0]["uniqueid"])
	}
	if got[0]["interactionsCount"] != 3 {
		t.Fatalf("expected interactionsCount 3, got %v", got[0]["interactionsCount"])
	}
	children, ok := got[0]["interactions"].([]map[string]interface{})
	if !ok || len(children) != 3 {
		t.Fatalf("expected all 3 legs listed as interactions, got %v", got[0]["interactions"])
	}
	// Every leg is listed, the parent's included, in creation order.
	if children[0]["uniqueid"] != "u1b" || children[1]["uniqueid"] != "u1c" || children[2]["uniqueid"] != "u1a" {
		t.Fatalf("children wrong/unsorted: %+v", children)
	}
}

func TestFilterAudioTestRows(t *testing.T) {
	rows := []map[string]interface{}{
		{"src": "91234", "dst": "*41"},
		{"src": "0541759779", "dst": "402"},
		{"src": "*41", "dst": "201"},
	}

	got := filterAudioTestRows(rows, "*41")
	if len(got) != 1 || got[0]["dst"] != "402" {
		t.Fatalf("expected only the 402 row to survive, got %+v", got)
	}

	// Empty code is a no-op.
	if n := len(filterAudioTestRows(rows, "")); n != 3 {
		t.Fatalf("empty code should keep all rows, got %d", n)
	}
}

func TestCollapseHistoryRowsByLinkedid_ParentIsAgentNotQueue(t *testing.T) {
	// A queue call: caller 202 → queue 401, answered by agent 203. Both the
	// queue-entry leg (lastapp=Queue, dst=401) and the agent Dial leg
	// (dst=203) are ANSWERED. The parent must be the agent leg so the row's
	// destination is WHO answered, not the queue number.
	rows := []map[string]interface{}{
		{"linkedid": "L1", "uniqueid": "uQueue", "time": float64(100), "disposition": "ANSWERED", "lastapp": "Queue", "src": "202", "dst": "401"},
		{"linkedid": "L1", "uniqueid": "uRing201", "time": float64(101), "disposition": "ANSWERED_ELSEWHERE", "lastapp": "Dial", "src": "202", "dst": "201"},
		{"linkedid": "L1", "uniqueid": "uAgent203", "time": float64(102), "disposition": "ANSWERED", "lastapp": "Dial", "src": "202", "dst": "203"},
	}

	got := collapseHistoryRowsByLinkedid(rows)

	if len(got) != 1 {
		t.Fatalf("expected 1 parent row, got %d", len(got))
	}
	if got[0]["uniqueid"] != "uAgent203" {
		t.Fatalf("expected agent Dial leg uAgent203 as parent, got %v", got[0]["uniqueid"])
	}
	if got[0]["dst"] != "203" {
		t.Fatalf("expected parent dst 203 (who answered), got %v", got[0]["dst"])
	}
	// The queue leg is dropped once an agent answered (every member already has its
	// own leg), leaving the two agent legs.
	if got[0]["interactionsCount"] != 2 {
		t.Fatalf("expected interactionsCount 2, got %v", got[0]["interactionsCount"])
	}
}

func TestCollapseHistoryRowsByLinkedid_FinalRecipientAcrossSortOrder(t *testing.T) {
	// A transferred call has multiple ANSWERED legs. The parent must be the LAST
	// answered leg (the final recipient the call ended up with), and that choice
	// must be stable regardless of the order rows arrive in (which varies with the
	// request sort).
	asc := []map[string]interface{}{
		{"linkedid": "L1", "uniqueid": "uEarly", "time": float64(100), "disposition": "ANSWERED", "lastapp": "Dial", "dst": "120"},
		{"linkedid": "L1", "uniqueid": "uLate", "time": float64(200), "disposition": "ANSWERED", "lastapp": "Dial", "dst": "121"},
	}
	desc := []map[string]interface{}{
		{"linkedid": "L1", "uniqueid": "uLate", "time": float64(200), "disposition": "ANSWERED", "lastapp": "Dial", "dst": "121"},
		{"linkedid": "L1", "uniqueid": "uEarly", "time": float64(100), "disposition": "ANSWERED", "lastapp": "Dial", "dst": "120"},
	}

	gotAsc := collapseHistoryRowsByLinkedid(asc)
	gotDesc := collapseHistoryRowsByLinkedid(desc)

	if gotAsc[0]["uniqueid"] != "uLate" || gotDesc[0]["uniqueid"] != "uLate" {
		t.Fatalf("parent not the stable final recipient across order: asc=%v desc=%v",
			gotAsc[0]["uniqueid"], gotDesc[0]["uniqueid"])
	}
	// The parent's destination is the final recipient (121), with that leg's data.
	if gotAsc[0]["dst"] != "121" {
		t.Fatalf("expected final recipient dst 121, got %v", gotAsc[0]["dst"])
	}
}

func TestCollapseHistoryRowsByLinkedid_TransferShowsFinalRecipient(t *testing.T) {
	// Caller answered by B, then transferred to C (both ANSWERED Dial legs).
	// The parent must be C (the final recipient), not B.
	rows := []map[string]interface{}{
		{"linkedid": "L1", "uniqueid": "uB", "time": float64(100), "disposition": "ANSWERED", "lastapp": "Dial", "dst": "201", "billsec": float64(30)},
		{"linkedid": "L1", "uniqueid": "uC", "time": float64(140), "disposition": "ANSWERED", "lastapp": "Dial", "dst": "202", "billsec": float64(75)},
	}

	got := collapseHistoryRowsByLinkedid(rows)

	if got[0]["uniqueid"] != "uC" {
		t.Fatalf("expected final recipient uC as parent, got %v", got[0]["uniqueid"])
	}
	if got[0]["dst"] != "202" || got[0]["billsec"] != float64(75) {
		t.Fatalf("expected dst 202 with its talk time 75, got dst=%v billsec=%v", got[0]["dst"], got[0]["billsec"])
	}
}

func TestCollapseHistoryRowsByLinkedid_UnansweredQueueShowsQueue(t *testing.T) {
	// Caller 202 → queue 401, NOBODY answers: the queue-entry leg and the member
	// Dial attempts are all unanswered. The parent must be the queue-entry leg so
	// the row's destination is the QUEUE (dst=401 → resolved to the queue name)
	// with a "no answer" outcome, not a random member extension or the "s" leg.
	rows := []map[string]interface{}{
		{"linkedid": "L1", "uniqueid": "uQueue", "time": float64(100), "disposition": "NO ANSWER", "lastapp": "Queue", "src": "202", "dst": "401"},
		{"linkedid": "L1", "uniqueid": "uMember203", "time": float64(101), "disposition": "NO ANSWER", "lastapp": "Dial", "src": "202", "dst": "203"},
		{"linkedid": "L1", "uniqueid": "uMemberS", "time": float64(102), "disposition": "NO ANSWER", "lastapp": "Dial", "src": "202", "dst": "s"},
	}

	got := collapseHistoryRowsByLinkedid(rows)

	if len(got) != 1 {
		t.Fatalf("expected 1 parent row, got %d", len(got))
	}
	if got[0]["uniqueid"] != "uQueue" {
		t.Fatalf("expected queue-entry leg uQueue as parent, got %v", got[0]["uniqueid"])
	}
	if got[0]["dst"] != "401" {
		t.Fatalf("expected parent dst 401 (the queue), got %v", got[0]["dst"])
	}
	if got[0]["disposition"] != "NO ANSWER" {
		t.Fatalf("expected parent disposition NO ANSWER, got %v", got[0]["disposition"])
	}
	// The "s" leg is bookkeeping and is dropped, leaving the queue leg and the
	// member that was rung.
	if got[0]["interactionsCount"] != 2 {
		t.Fatalf("expected interactionsCount 2, got %v", got[0]["interactionsCount"])
	}
}

func TestCollapseHistoryRowsByLinkedid_AnsweredQueueDropsQueueLegs(t *testing.T) {
	// A queue call an agent answered. The queue's own legs (one per member it rang,
	// all sharing the queue-entry uniqueid) add nothing once every member has its
	// own leg, so they are all dropped; the queue identity survives on the row.
	rows := []map[string]interface{}{
		{"linkedid": "L1", "uniqueid": "q", "time": float64(100), "dst": "401", "queueName": "Test", "lastapp": "Queue", "disposition": "ANSWERED", "dstchannel": "Local/201@from-queue-0;1"},
		{"linkedid": "L1", "uniqueid": "m201", "time": float64(101), "dst": "201", "lastapp": "Dial", "disposition": "ANSWERED", "dstchannel": "PJSIP/201-1"},
		{"linkedid": "L1", "uniqueid": "m202", "time": float64(101), "dst": "202", "lastapp": "Dial", "disposition": "NO ANSWER", "dstchannel": "PJSIP/202-1"},
		{"linkedid": "L1", "uniqueid": "m203", "time": float64(101), "dst": "203", "lastapp": "Dial", "disposition": "NO ANSWER", "dstchannel": "PJSIP/203-1"},
		{"linkedid": "L1", "uniqueid": "q", "time": float64(101), "dst": "401", "queueName": "Test", "lastapp": "Queue", "disposition": "NO ANSWER", "dstchannel": "Local/202@from-queue-1;1"},
		{"linkedid": "L1", "uniqueid": "q", "time": float64(101), "dst": "401", "queueName": "Test", "lastapp": "Queue", "disposition": "NO ANSWER", "dstchannel": "Local/203@from-queue-2;1"},
	}

	got := collapseHistoryRowsByLinkedid(rows)

	if len(got) != 1 {
		t.Fatalf("expected 1 parent row, got %d", len(got))
	}
	parent := got[0]
	if parent["dst"] != "201" {
		t.Fatalf("expected parent to be the agent who answered (201), got %v", parent["dst"])
	}
	if parent["queueName"] != "Test" || parent["queueNum"] != "401" {
		t.Fatalf("expected the queue identity kept on the row, got %v/%v", parent["queueName"], parent["queueNum"])
	}
	// Only the three member legs remain (agent + 2 unanswered), no queue leg.
	if parent["interactionsCount"] != 3 {
		t.Fatalf("expected interactionsCount 3, got %v", parent["interactionsCount"])
	}
	children, _ := parent["interactions"].([]map[string]interface{})
	for _, c := range children {
		if c["lastapp"] == "Queue" {
			t.Fatalf("an answered queue call must not keep queue legs, got %v", c)
		}
	}
}

func TestCollapseHistoryRowsByLinkedid_UnansweredQueueKeepsOneQueueLeg(t *testing.T) {
	// Nobody answered: the row must still show the queue, with the members it rang
	// underneath, so exactly one queue leg survives and becomes the parent.
	rows := []map[string]interface{}{
		{"linkedid": "L1", "uniqueid": "q", "time": float64(100), "dst": "401", "queueName": "Test", "lastapp": "Queue", "disposition": "NO ANSWER", "dstchannel": "Local/202@from-queue-0;1"},
		{"linkedid": "L1", "uniqueid": "q", "time": float64(101), "dst": "401", "queueName": "Test", "lastapp": "Queue", "disposition": "NO ANSWER", "dstchannel": "Local/203@from-queue-1;1"},
		{"linkedid": "L1", "uniqueid": "m202", "time": float64(101), "dst": "202", "lastapp": "Dial", "disposition": "NO ANSWER", "dstchannel": "PJSIP/202-1"},
		{"linkedid": "L1", "uniqueid": "m203", "time": float64(101), "dst": "203", "lastapp": "Dial", "disposition": "NO ANSWER", "dstchannel": "PJSIP/203-1"},
	}

	got := collapseHistoryRowsByLinkedid(rows)
	parent := got[0]

	if parent["dst"] != "401" || parent["lastapp"] != "Queue" {
		t.Fatalf("expected the queue leg as parent, got dst=%v app=%v", parent["dst"], parent["lastapp"])
	}
	// 1 queue leg + the 2 member legs.
	if parent["interactionsCount"] != 3 {
		t.Fatalf("expected interactionsCount 3, got %v", parent["interactionsCount"])
	}
}

func TestPruneQueueLegs_SingleQueueLegUntouched(t *testing.T) {
	// Nothing to deduplicate: the legs must come back unchanged.
	legs := []map[string]interface{}{
		{"dst": "401", "lastapp": "Queue", "disposition": "NO ANSWER"},
		{"dst": "201", "lastapp": "Dial", "disposition": "NO ANSWER"},
	}
	if got := pruneQueueLegs(legs); len(got) != 2 {
		t.Fatalf("expected the 2 legs untouched, got %d", len(got))
	}
}

func TestCollapseHistoryRowsByLinkedid_TransferKeepsTheOriginalCaller(t *testing.T) {
	// A queue call from outside, answered by agent 201, then transferred to 203.
	// Asterisk keeps the original caller in "src" on the transfer leg but moves the
	// transferring agent into cnum/cnam — so taking the source from that leg would
	// show the agent as the caller. The row must keep the ORIGINAL caller as its
	// source while showing the final recipient as its destination.
	rows := []map[string]interface{}{
		{"linkedid": "L1", "uniqueid": "u1", "time": float64(100), "src": "3391818709", "cnum": "3391818709", "cnam": "3391818709", "dst": "401", "lastapp": "Queue", "disposition": "ANSWERED"},
		{"linkedid": "L1", "uniqueid": "u2", "time": float64(102), "src": "3391818709", "cnum": "3391818709", "cnam": "3391818709", "dst": "201", "lastapp": "Dial", "disposition": "ANSWERED", "dstchannel": "PJSIP/201-1"},
		{"linkedid": "L1", "uniqueid": "u3", "time": float64(126), "src": "3391818709", "cnum": "201", "cnam": "Andrea Marchionni", "dst": "203", "lastapp": "Dial", "disposition": "ANSWERED", "dstchannel": "PJSIP/203-1"},
	}

	got := collapseHistoryRowsByLinkedid(rows)

	if len(got) != 1 {
		t.Fatalf("expected 1 parent row, got %d", len(got))
	}
	parent := got[0]
	if parent["dst"] != "203" {
		t.Fatalf("expected the final recipient (203) as destination, got %v", parent["dst"])
	}
	// The caller must be the outside number, not the agent who transferred. The name
	// is left empty on purpose: it described the transferring party, and the frontend
	// resolves internal extensions itself (an outside number shows as Unknown).
	if parent["cnum"] != "3391818709" || parent["cnam"] != "" {
		t.Fatalf("expected the original caller kept as source, got cnum=%v cnam=%v",
			parent["cnum"], parent["cnam"])
	}
	if parent["src"] != "3391818709" {
		t.Fatalf("expected src to stay the original caller, got %v", parent["src"])
	}
}

func TestCollapseHistoryRowsByLinkedid_DropsContextEntryLegs(t *testing.T) {
	// The "s" leg is Asterisk bookkeeping (MacroExit on transfer completion): it
	// names no party, so it must not be listed among a call's interactions.
	rows := []map[string]interface{}{
		{"linkedid": "L1", "uniqueid": "u1", "time": float64(100), "src": "202", "dst": "201", "lastapp": "Dial", "disposition": "ANSWERED", "dstchannel": "PJSIP/201-1"},
		{"linkedid": "L1", "uniqueid": "u2", "time": float64(120), "src": "201", "dst": "s", "lastapp": "MacroExit", "disposition": "ANSWERED"},
		{"linkedid": "L1", "uniqueid": "u3", "time": float64(126), "src": "202", "dst": "203", "lastapp": "Dial", "disposition": "ANSWERED", "dstchannel": "PJSIP/203-1"},
	}

	parent := collapseHistoryRowsByLinkedid(rows)[0]

	if parent["interactionsCount"] != 2 {
		t.Fatalf("expected the 's' leg dropped (2 legs left), got %v", parent["interactionsCount"])
	}
	children, _ := parent["interactions"].([]map[string]interface{})
	for _, c := range children {
		if c["dst"] == "s" {
			t.Fatalf("a context-entry leg must not be listed as an interaction: %v", c)
		}
	}
}

func TestDropContextEntryLegs_KeepsACallMadeOnlyOfThem(t *testing.T) {
	// Nothing else to show: the call must not disappear.
	legs := []map[string]interface{}{{"dst": "s", "lastapp": "MacroExit"}}
	if got := dropContextEntryLegs(legs); len(got) != 1 {
		t.Fatalf("expected the only leg kept, got %d", len(got))
	}
}

func TestCollapseHistoryRowsByLinkedid_DropsLegsWithNoDestination(t *testing.T) {
	// The Return leg an attended transfer writes has an empty destination and shows
	// up as a "-" row among the call's steps.
	rows := []map[string]interface{}{
		{"linkedid": "L1", "uniqueid": "u1", "time": float64(100), "src": "203", "cnum": "203", "dst": "202", "lastapp": "Dial", "disposition": "ANSWERED"},
		{"linkedid": "L1", "uniqueid": "u2", "time": float64(117), "src": "202", "dst": "", "lastapp": "Return", "disposition": "ANSWERED"},
		{"linkedid": "L1", "uniqueid": "u3", "time": float64(117), "src": "203", "cnum": "202", "dst": "3400069069", "lastapp": "Dial", "disposition": "ANSWERED"},
	}

	parent := collapseHistoryRowsByLinkedid(rows)[0]

	if parent["interactionsCount"] != 2 {
		t.Fatalf("expected the destination-less leg dropped (2 left), got %v", parent["interactionsCount"])
	}
	children, _ := parent["interactions"].([]map[string]interface{})
	for _, c := range children {
		if getHistoryRowString(c, "dst") == "" {
			t.Fatalf("a leg with no destination must not be listed: %v", c)
		}
	}
}
func TestCollapseHistoryRowsByLinkedid_OutgoingTransferShowsTheColleagueOnTheLine(t *testing.T) {
	// Agent 201 calls an outside number and hands it to colleague 203. The summary
	// must read the same way as an incoming transferred call: the party still on the
	// line (the outside number) on the left, the colleague who took it on the right.
	// Asterisk puts the trunk's caller id in cnum on the leg that connected them, so
	// copying that leg's caller fields verbatim would show the trunk number instead.
	rows := []map[string]interface{}{
		{"linkedid": "L1", "uniqueid": "u1", "time": float64(100), "type": "out", "src": "07211748905", "cnum": "201", "cnam": "Andrea Marchionni", "dst": "3391818709", "lastapp": "Dial", "disposition": "ANSWERED"},
		{"linkedid": "L1", "uniqueid": "u2", "time": float64(111), "type": "internal", "src": "3391818709", "cnum": "07211748905", "cnam": "", "dst": "203", "dst_cnam": "Cristian Manoni", "lastapp": "Dial", "disposition": "ANSWERED", "duration": float64(16)},
		{"linkedid": "L1", "uniqueid": "u3", "time": float64(115), "type": "internal", "src": "203", "cnum": "", "dst": "203", "disposition": "ANSWERED", "duration": float64(8)},
	}

	parent := collapseHistoryRowsByLinkedid(rows)[0]

	// An outgoing call keeps its direction: the number dialled stays the destination
	// and the colleague who took the call becomes the caller.
	if parent["dst"] != "3391818709" {
		t.Fatalf("expected the number dialled as destination, got %v", parent["dst"])
	}
	if parent["cnum"] != "203" || parent["src"] != "203" {
		t.Fatalf("expected the colleague on the line (203) as caller, got cnum=%v src=%v",
			parent["cnum"], parent["src"])
	}
	// The colleague brings his own name along, so the row needs no lookup to show it.
	if parent["cnam"] != "Cristian Manoni" {
		t.Fatalf("expected the colleague's name as caller, got %v", parent["cnam"])
	}
	// The talk time must be the conversation's, not the few seconds of the leg
	// Asterisk writes once the two parties are bridged.
	if parent["duration"] != float64(16) {
		t.Fatalf("expected the conversation's duration (16), got %v", parent["duration"])
	}
}

func TestCollapseHistoryRowsByLinkedid_PlainOutgoingCallNamesTheAgent(t *testing.T) {
	// No transfer: the row must keep naming the agent who placed the call, not the
	// trunk caller id that Asterisk writes into "src".
	rows := []map[string]interface{}{
		{"linkedid": "L1", "uniqueid": "u1", "time": float64(100), "type": "out", "src": "07211748905", "cnum": "201", "cnam": "Andrea Marchionni", "dst": "3391818709", "lastapp": "Dial", "disposition": "ANSWERED"},
	}

	parent := collapseHistoryRowsByLinkedid(rows)[0]

	if parent["dst"] != "3391818709" {
		t.Fatalf("expected the number called, got %v", parent["dst"])
	}
	if parent["cnum"] != "201" || parent["cnam"] != "Andrea Marchionni" {
		t.Fatalf("expected the calling agent, got cnum=%v cnam=%v", parent["cnum"], parent["cnam"])
	}
}

func TestCollapseHistoryRowsByLinkedid_InternalCallTransferredOutside(t *testing.T) {
	// 203 calls colleague 202, who hands the call to a mobile. The pair that ends up
	// talking is 203 and the mobile, with the mobile as the party it was handed to.
	rows := []map[string]interface{}{
		{"linkedid": "L1", "uniqueid": "u1", "time": float64(100), "type": "internal", "src": "203", "cnum": "203", "cnam": "Cristian Manoni", "dst": "202", "lastapp": "Dial", "disposition": "ANSWERED"},
		{"linkedid": "L1", "uniqueid": "u2", "time": float64(117), "type": "internal", "src": "203", "cnum": "202", "cnam": "Antonio Colapietro", "dst": "3400069069", "lastapp": "Dial", "disposition": "ANSWERED"},
		{"linkedid": "L1", "uniqueid": "u3", "time": float64(127), "type": "internal", "src": "3400069069", "cnum": "", "dst": "3400069069", "disposition": "ANSWERED"},
	}

	parent := collapseHistoryRowsByLinkedid(rows)[0]

	if parent["dst"] != "3400069069" {
		t.Fatalf("expected the mobile it was handed to, got %v", parent["dst"])
	}
	if parent["cnum"] != "203" {
		t.Fatalf("expected the colleague still on the call (203), got %v", parent["cnum"])
	}
	if parent["cnam"] != "" {
		t.Fatalf("expected no name carried over from the transferring party, got %v", parent["cnam"])
	}
}

// historyLeg builds a leg shaped like the ones cti-server actually returns.
func historyLeg(uniqueID, src, cnum, cnam, dst, dstCnam, disposition, lastapp, callType string, duration float64) map[string]interface{} {
	return map[string]interface{}{
		"linkedid": "L1", "uniqueid": uniqueID, "src": src, "cnum": cnum, "cnam": cnam,
		"dst": dst, "dst_cnam": dstCnam, "disposition": disposition, "lastapp": lastapp,
		"type": callType, "duration": duration,
		// cti-server groups the CDR and reports a non-aggregated calldate, so the
		// legs of one call routinely come back with the same time.
		"time": float64(0),
	}
}

func TestCollapseHistoryRowsByLinkedid_SummarisesTheCallWhicheverWayItWent(t *testing.T) {
	withExtensions(t, "201", "202", "203")
	cases := []struct {
		name     string
		legs     []map[string]interface{}
		wantFrom string
		wantTo   string
		wantDur  float64
		wantType string
	}{
		{
			name: "queue call answered by an agent who transferred it to a colleague",
			legs: []map[string]interface{}{
				historyLeg("1788337976.1920", "3400069069", "3400069069", "3400069069", "202", "Antonio Colapietro", "ANSWERED", "Dial", "internal", 18),
				// Re-bridge leg: no application ran, and cti-server reports the
				// transferring party as its source, so it looks like a 202 -> 203 call.
				historyLeg("1788337989.1972", "202", "202", "", "203", "", "ANSWERED", "", "internal", 18),
				historyLeg("1788337976.1936", "202", "", "", "s", "", "ANSWERED", "MacroExit", "internal", 5),
				historyLeg("1788337989.1974", "3400069069", "202", "Antonio Colapietro", "203", "Cristian Manoni", "ANSWERED", "Dial", "internal", 24),
				historyLeg("1788337974.1910", "3400069069", "3400069069", "3400069069", "401", "Test", "ANSWERED", "Queue", "in", 38),
				historyLeg("1788337976.1922", "3400069069", "3400069069", "3400069069", "203", "Cristian Manoni", "NO ANSWER", "Dial", "internal", 7),
			},
			wantFrom: "3400069069", wantTo: "203", wantDur: 24, wantType: "in",
		},
		{
			name: "internal call the callee transferred to a mobile",
			legs: []map[string]interface{}{
				historyLeg("1788164039.1818", "202", "202", "", "3400069069", "", "ANSWERED", "", "internal", 7),
				historyLeg("1788164039.1820", "203", "202", "Antonio Colapietro", "3400069069", "", "ANSWERED", "Dial", "out", 18),
				historyLeg("1788164022.1796", "202", "", "", "", "", "ANSWERED", "Return", "internal", 10),
				historyLeg("1788164022.1792", "203", "203", "Cristian Manoni", "202", "Antonio Colapietro", "ANSWERED", "Dial", "internal", 18),
			},
			wantFrom: "203", wantTo: "3400069069", wantDur: 18, wantType: "out",
		},
		{
			// Shapes taken from a real call: after the transfer Asterisk rewrites the
			// channels, so the leg that actually dialled out comes back as "internal"
			// and the trunk survives only on the leg with no application — the one
			// dropped as plumbing. The direction must still come out as outgoing.
			name: "outgoing call transferred to a colleague keeps its direction",
			legs: []map[string]interface{}{
				historyLeg("1787914667.1511", "07211748905", "201", "Andrea Marchionni", "3391818709", "", "ANSWERED", "Dial", "internal", 8),
				historyLeg("1787914675.1537", "07211748905", "07211748905", "", "203", "", "ANSWERED", "", "out", 8),
				historyLeg("1787914675.1539", "3391818709", "07211748905", "", "203", "Cristian Manoni", "ANSWERED", "Dial", "internal", 16),
			},
			wantFrom: "203", wantTo: "3391818709", wantDur: 16, wantType: "out",
		},
		{
			name: "internal call with no outside party",
			legs: []map[string]interface{}{
				historyLeg("1788000000.1", "203", "203", "Cristian Manoni", "202", "Antonio Colapietro", "ANSWERED", "Dial", "internal", 12),
			},
			wantFrom: "203", wantTo: "202", wantDur: 12, wantType: "internal",
		},
		{
			name: "queue call answered with no transfer",
			legs: []map[string]interface{}{
				historyLeg("1787914541.1158", "3391818709", "3391818709", "3391818709", "401", "Test", "ANSWERED", "Queue", "in", 5),
				historyLeg("1787914541.1170", "3391818709", "3391818709", "3391818709", "201", "Andrea Marchionni", "ANSWERED", "Dial", "internal", 5),
				historyLeg("1787914541.1172", "3391818709", "3391818709", "3391818709", "202", "Antonio Colapietro", "NO ANSWER", "Dial", "internal", 3),
			},
			wantFrom: "3391818709", wantTo: "201", wantDur: 5, wantType: "in",
		},
		{
			name: "plain outgoing call",
			legs: []map[string]interface{}{
				historyLeg("1787914667.9999", "07211748905", "201", "Andrea Marchionni", "3391818709", "", "ANSWERED", "Dial", "out", 9),
			},
			wantFrom: "201", wantTo: "3391818709", wantDur: 9, wantType: "out",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			// As in the CDR, a call's linkedid is the uniqueid of its first leg.
			first := tc.legs[0]["uniqueid"].(string)
			for _, leg := range tc.legs {
				if id := leg["uniqueid"].(string); id < first {
					first = id
				}
			}
			for _, leg := range tc.legs {
				leg["linkedid"] = first
			}
			got := collapseHistoryRowsByLinkedid(tc.legs)
			if len(got) != 1 {
				t.Fatalf("expected 1 row, got %d", len(got))
			}
			row := got[0]
			// The caller as the switchboard shows it: cnum, falling back to src.
			shown := row["cnum"]
			if shown == "" || shown == nil {
				shown = row["src"]
			}
			if shown != tc.wantFrom {
				t.Fatalf("caller: got cnum=%v src=%v, want %v", row["cnum"], row["src"], tc.wantFrom)
			}
			// A summary composed from several legs names the caller in both fields.
			if row["interactionsCount"] != 1 && row["src"] != row["cnum"] {
				t.Fatalf("summary: src=%v and cnum=%v differ", row["src"], row["cnum"])
			}
			if row["dst"] != tc.wantTo {
				t.Fatalf("destination: got %v, want %v", row["dst"], tc.wantTo)
			}
			if row["duration"] != tc.wantDur {
				t.Fatalf("duration: got %v, want %v", row["duration"], tc.wantDur)
			}
			// The direction decides which way the arrow points in the outcome column.
			if tc.wantType != "" && row["type"] != tc.wantType {
				t.Fatalf("direction: got %v, want %v", row["type"], tc.wantType)
			}
		})
	}
}

func TestCollapseHistoryRowsByLinkedid_KeepsThePersonalViewDirection(t *testing.T) {
	// Personal history of extension 201, which placed a call outside and then
	// transferred it to a colleague. cti-server computes "direction" per leg from
	// the user's own extensions, and only the first leg carries it: the leg that
	// becomes the summary has none, so the row used to report no direction and the
	// personal view drew an outgoing call as incoming.
	legs := []map[string]interface{}{
		withDirection(historyLeg("1787914667.1511", "07211748905", "201", "Andrea Marchionni", "3391818709", "", "ANSWERED", "Dial", "internal", 8), "out"),
		historyLeg("1787914675.1537", "203", "", "", "203", "", "ANSWERED", "", "out", 8),
		historyLeg("1787914675.1539", "3391818709", "07211748905", "", "203", "Cristian Manoni", "ANSWERED", "Dial", "internal", 16),
	}
	got := collapseHistoryRowsByLinkedid(legs)
	if len(got) != 1 {
		t.Fatalf("expected 1 row, got %d", len(got))
	}
	if got[0]["direction"] != "out" {
		t.Fatalf("expected direction out, got %v", got[0]["direction"])
	}

	// The colleague's own history of the same call: their leg is the one carrying
	// the direction, and it must survive too.
	received := []map[string]interface{}{
		historyLeg("1787914667.1511", "07211748905", "201", "Andrea Marchionni", "3391818709", "", "ANSWERED", "Dial", "internal", 8),
		withDirection(historyLeg("1787914675.1539", "3391818709", "07211748905", "", "203", "Cristian Manoni", "ANSWERED", "Dial", "internal", 16), "in"),
	}
	if row := collapseHistoryRowsByLinkedid(received)[0]; row["direction"] != "in" {
		t.Fatalf("expected direction in, got %v", row["direction"])
	}
}

// withDirection adds the per-user direction cti-server computes for the personal
// history view.
func withDirection(leg map[string]interface{}, direction string) map[string]interface{} {
	leg["direction"] = direction
	return leg
}

func TestMergeDuplicateLegs(t *testing.T) {
	// cti-server keeps the destination channel apart so a ring group's members
	// survive, which also splits a leg Asterisk recorded on two channels.
	rows := []map[string]interface{}{
		// One leg, two rows: the Local channel and the device's own.
		{"uniqueid": "u1", "linkedid": "L1", "dst": "202", "disposition": "ANSWERED", "duration": float64(18), "billsec": float64(0), "lastapp": "", "dstchannel": "Local/203@from-internal-1;1"},
		{"uniqueid": "u1", "linkedid": "L1", "dst": "202", "disposition": "ANSWERED", "duration": float64(13), "billsec": float64(11), "lastapp": "Dial", "dstchannel": "PJSIP/202-1"},
		// Two ring-group members: same leg, same outcome, different member.
		{"uniqueid": "u2", "linkedid": "L1", "dst": "201", "disposition": "NO ANSWER", "duration": float64(4), "dstchannel": "PJSIP/201-1"},
		{"uniqueid": "u2", "linkedid": "L1", "dst": "203", "disposition": "NO ANSWER", "duration": float64(4), "dstchannel": "PJSIP/203-1"},
	}
	got := mergeDuplicateLegs(rows)
	if len(got) != 3 {
		t.Fatalf("expected the duplicate pair to merge and both members to survive, got %d rows", len(got))
	}
	if got[0]["duration"] != float64(18) {
		t.Fatalf("expected the longer row to win, got %v", got[0]["duration"])
	}
	// Nothing the dropped row carried may be lost.
	if got[0]["billsec"] != float64(11) || got[0]["lastapp"] != "Dial" {
		t.Fatalf("expected billsec and lastapp to be kept, got billsec=%v lastapp=%v", got[0]["billsec"], got[0]["lastapp"])
	}
	if got[1]["dst"] != "201" || got[2]["dst"] != "203" {
		t.Fatalf("expected both ring-group members, got %v and %v", got[1]["dst"], got[2]["dst"])
	}
}

// withExtensions loads the configured extensions for the duration of a test, as
// the PBX would provide them.
func withExtensions(t *testing.T, extensions ...string) {
	t.Helper()
	extensionCacheMu.Lock()
	previous, previousAt := extensionCache, extensionCacheAt
	extensionCache = map[string]struct{}{}
	for _, e := range extensions {
		extensionCache[e] = struct{}{}
	}
	extensionCacheAt = time.Now()
	extensionCacheMu.Unlock()
	t.Cleanup(func() {
		extensionCacheMu.Lock()
		extensionCache, extensionCacheAt = previous, previousAt
		extensionCacheMu.Unlock()
	})
}

func TestCollapseHistoryRowsByLinkedid_ReadsPartiesFromTheLegsChannels(t *testing.T) {
	// Rows exactly as cti-server returned them on a test PBX. Every case runs with
	// and without the extension list: without it, colleagues must be told by their
	// device channels.
	withTrunks(t, "OpenSolution Sip")
	cases := []struct {
		name, from, to, callType string
		legs                     []map[string]interface{}
	}{
		{
			name: "unanswered queue call reads caller -> queue",
			from: "3400069069", to: "401", callType: "in",
			legs: []map[string]interface{}{
				{"uniqueid": "1790603366.564", "linkedid": "1790603366.564", "channel": "PJSIP/OpenSolution Sip-00000012", "dstchannel": "Local/203@from-queue-0000000e;1", "src": "3400069069", "cnum": "3400069069", "cnam": "3400069069", "dst": "401", "dst_cnam": "", "disposition": "NO ANSWER", "lastapp": "Queue", "duration": float64(0), "billsec": float64(0), "type": "in"},
				{"uniqueid": "1790603366.564", "linkedid": "1790603366.564", "channel": "PJSIP/OpenSolution Sip-00000012", "dstchannel": "Local/202@from-queue-0000000d;1", "src": "3400069069", "cnum": "3400069069", "cnam": "3400069069", "dst": "401", "dst_cnam": "", "disposition": "NO ANSWER", "lastapp": "Queue", "duration": float64(0), "billsec": float64(0), "type": "in"},
				{"uniqueid": "1790603366.564", "linkedid": "1790603366.564", "channel": "PJSIP/OpenSolution Sip-00000012", "dstchannel": "Local/201@from-queue-0000000c;1", "src": "3400069069", "cnum": "3400069069", "cnam": "3400069069", "dst": "401", "dst_cnam": "", "disposition": "NO ANSWER", "lastapp": "Queue", "duration": float64(0), "billsec": float64(0), "type": "in"},
				{"uniqueid": "1790603366.564", "linkedid": "1790603366.564", "channel": "PJSIP/OpenSolution Sip-00000012", "dstchannel": "Local/203@from-queue-0000000b;1", "src": "3400069069", "cnum": "3400069069", "cnam": "3400069069", "dst": "401", "dst_cnam": "", "disposition": "NO ANSWER", "lastapp": "Queue", "duration": float64(15), "billsec": float64(15), "type": "in"},
				{"uniqueid": "1790603366.564", "linkedid": "1790603366.564", "channel": "PJSIP/OpenSolution Sip-00000012", "dstchannel": "Local/202@from-queue-0000000a;1", "src": "3400069069", "cnum": "3400069069", "cnam": "3400069069", "dst": "401", "dst_cnam": "", "disposition": "NO ANSWER", "lastapp": "Queue", "duration": float64(15), "billsec": float64(15), "type": "in"},
				{"uniqueid": "1790603367.577", "linkedid": "1790603366.564", "channel": "Local/203@from-queue-0000000b;2", "dstchannel": "PJSIP/203-00000015", "src": "3400069069", "cnum": "3400069069", "cnam": "3400069069", "dst": "203", "dst_cnam": "Cristian Manoni", "disposition": "NO ANSWER", "lastapp": "Dial", "duration": float64(15), "billsec": float64(0), "type": "internal"},
				{"uniqueid": "1790603367.571", "linkedid": "1790603366.564", "channel": "Local/201@from-queue-00000009;2", "dstchannel": "PJSIP/201-00000013", "src": "3400069069", "cnum": "3400069069", "cnam": "3400069069", "dst": "201", "dst_cnam": "Andrea Marchionni", "disposition": "NO ANSWER", "lastapp": "Dial", "duration": float64(15), "billsec": float64(0), "type": "internal"},
				{"uniqueid": "1790603367.575", "linkedid": "1790603366.564", "channel": "Local/202@from-queue-0000000a;2", "dstchannel": "PJSIP/202-00000014", "src": "3400069069", "cnum": "3400069069", "cnam": "3400069069", "dst": "202", "dst_cnam": "Antonio Colapietro", "disposition": "NO ANSWER", "lastapp": "Dial", "duration": float64(15), "billsec": float64(0), "type": "internal"},
				{"uniqueid": "1790603366.564", "linkedid": "1790603366.564", "channel": "PJSIP/OpenSolution Sip-00000012", "dstchannel": "Local/201@from-queue-00000009;1", "src": "3400069069", "cnum": "3400069069", "cnam": "3400069069", "dst": "401", "dst_cnam": "", "disposition": "NO ANSWER", "lastapp": "Queue", "duration": float64(16), "billsec": float64(16), "type": "in"},
			},
		},
		{
			name: "outgoing call whose trunk moved onto a plumbing leg",
			from: "203", to: "3391818709", callType: "out",
			legs: []map[string]interface{}{
				{"uniqueid": "1787914675.1537", "linkedid": "1787914667.1511", "channel": "Local/203@from-internal-00000022;1", "dstchannel": "PJSIP/OpenSolution Sip-0000002f", "src": "203", "cnum": "", "cnam": "", "dst": "203", "dst_cnam": "", "disposition": "ANSWERED", "lastapp": "", "duration": float64(8), "billsec": float64(8), "type": "out"},
				{"uniqueid": "1787914675.1539", "linkedid": "1787914667.1511", "channel": "Local/203@from-internal-00000022;2", "dstchannel": "PJSIP/203-00000030", "src": "3391818709", "cnum": "07211748905", "cnam": "", "dst": "203", "dst_cnam": "Cristian Manoni", "disposition": "ANSWERED", "lastapp": "Dial", "duration": float64(16), "billsec": float64(11), "type": "internal"},
				{"uniqueid": "1787914667.1511", "linkedid": "1787914667.1511", "channel": "PJSIP/201-0000002e", "dstchannel": "Local/203@from-internal-00000022;1", "src": "07211748905", "cnum": "201", "cnam": "Andrea Marchionni", "dst": "3391818709", "dst_cnam": "", "disposition": "ANSWERED", "lastapp": "Dial", "duration": float64(7), "billsec": float64(7), "type": "internal"},
				{"uniqueid": "1787914667.1511", "linkedid": "1787914667.1511", "channel": "PJSIP/201-0000002e", "dstchannel": "PJSIP/OpenSolution Sip-0000002f", "src": "07211748905", "cnum": "201", "cnam": "Andrea Marchionni", "dst": "3391818709", "dst_cnam": "", "disposition": "ANSWERED", "lastapp": "Dial", "duration": float64(8), "billsec": float64(3), "type": "out"},
			},
		},
		{
			name: "internal call transferred to a mobile, colleague told by its channel",
			from: "203", to: "3400069069", callType: "out",
			legs: []map[string]interface{}{
				{"uniqueid": "1788164039.1818", "linkedid": "1788164022.1792", "channel": "Local/3400069069@from-internal-00000027;1", "dstchannel": "", "src": "3400069069", "cnum": "", "cnam": "", "dst": "3400069069", "dst_cnam": "", "disposition": "ANSWERED", "lastapp": "", "duration": float64(7), "billsec": float64(7), "type": "internal"},
				{"uniqueid": "1788164039.1820", "linkedid": "1788164022.1792", "channel": "Local/3400069069@from-internal-00000027;2", "dstchannel": "PJSIP/OpenSolution Sip-00000037", "src": "203", "cnum": "202", "cnam": "Antonio Colapietro", "dst": "3400069069", "dst_cnam": "", "disposition": "ANSWERED", "lastapp": "Dial", "duration": float64(18), "billsec": float64(11), "type": "out"},
				{"uniqueid": "1788164022.1792", "linkedid": "1788164022.1792", "channel": "PJSIP/203-00000035", "dstchannel": "Local/3400069069@from-internal-00000027;1", "src": "203", "cnum": "203", "cnam": "Cristian Manoni", "dst": "202", "dst_cnam": "Antonio Colapietro", "disposition": "ANSWERED", "lastapp": "Dial", "duration": float64(18), "billsec": float64(18), "type": "internal"},
				{"uniqueid": "1788164022.1796", "linkedid": "1788164022.1792", "channel": "PJSIP/202-00000036", "dstchannel": "Local/3400069069@from-internal-00000027;1", "src": "202", "cnum": "", "cnam": "", "dst": "", "dst_cnam": "", "disposition": "ANSWERED", "lastapp": "Return", "duration": float64(10), "billsec": float64(10), "type": "internal"},
				{"uniqueid": "1788164022.1792", "linkedid": "1788164022.1792", "channel": "PJSIP/203-00000035", "dstchannel": "PJSIP/202-00000036", "src": "203", "cnum": "203", "cnam": "Cristian Manoni", "dst": "202", "dst_cnam": "Antonio Colapietro", "disposition": "ANSWERED", "lastapp": "Dial", "duration": float64(17), "billsec": float64(14), "type": "internal"},
			},
		},
		{
			name: "call forwarded outside keeps the parties it recorded",
			from: "201", to: "203", callType: "out",
			legs: []map[string]interface{}{
				{"uniqueid": "1790603322.512", "linkedid": "1790603322.512", "channel": "PJSIP/201-00000010", "dstchannel": "PJSIP/OpenSolution Sip-00000011", "src": "07211748905", "cnum": "201", "cnam": "Andrea Marchionni", "dst": "203", "dst_cnam": "Cristian Manoni", "disposition": "ANSWERED", "lastapp": "Dial", "duration": float64(28), "billsec": float64(28), "type": "out"},
			},
		},
		{
			name: "internal call received, personal view",
			from: "203", to: "202", callType: "",
			legs: []map[string]interface{}{
				{"uniqueid": "1775664439.329", "linkedid": "1775664438.320", "channel": "Local/202@from-queue-0000000f;2", "dstchannel": "PJSIP/202-00000017", "src": "203", "cnum": "203", "cnam": "Cristian Manoni", "dst": "202", "dst_cnam": "Antonio Colapietro", "disposition": "ANSWERED", "lastapp": "Dial", "duration": float64(15), "billsec": float64(9), "direction": "in"},
			},
		},
	}

	for _, extensions := range [][]string{nil, {"201", "202", "203"}} {
		for _, tc := range cases {
			t.Run(tc.name, func(t *testing.T) {
				if extensions != nil {
					withExtensions(t, extensions...)
				}
				legs := make([]map[string]interface{}, 0, len(tc.legs))
				for _, leg := range tc.legs {
					legs = append(legs, copyHistoryRow(leg))
				}
				got := collapseHistoryRowsByLinkedid(mergeDuplicateLegs(legs))
				if len(got) != 1 {
					t.Fatalf("expected 1 row, got %d", len(got))
				}
				row := got[0]
				// The caller as each view shows it.
				shown := getHistoryRowString(row, "cnum")
				if getHistoryRowString(row, "direction") == "in" || shown == "" {
					shown = getHistoryRowString(row, "src")
				}
				if shown != tc.from || row["dst"] != tc.to {
					t.Fatalf("got %s -> %v, want %s -> %s", shown, row["dst"], tc.from, tc.to)
				}
				if tc.callType != "" && row["type"] != tc.callType {
					t.Fatalf("direction: got %v, want %s", row["type"], tc.callType)
				}
			})
		}
	}
}

// withTrunks loads the configured trunks for the duration of a test, as the PBX
// would provide them.
func withTrunks(t *testing.T, trunks ...string) {
	t.Helper()
	trunkCacheMu.Lock()
	previous, previousAt := trunkCache, trunkCacheAt
	trunkCache, trunkCacheAt = trunks, time.Now()
	trunkCacheMu.Unlock()
	t.Cleanup(func() {
		trunkCacheMu.Lock()
		trunkCache, trunkCacheAt = previous, previousAt
		trunkCacheMu.Unlock()
	})
}

func TestBuildLegacyHistoryPath_AsksForAPageOfCalls(t *testing.T) {
	for _, callType := range []string{"switchboard", "group", "user"} {
		req := &historyFilterRequest{CallType: callType, Username: "u", From: "20260901", To: "20260930", Sort: "time desc",
			PageNum: 3, PageSize: 10, Artifact: historyArtifactAll, AudioTest: "*41"}
		_, values, err := buildLegacyHistoryPath(req)
		if err != nil {
			t.Fatal(err)
		}
		if values.Get("groupByCall") != "true" || values.Get("limit") != "10" || values.Get("offset") != "20" {
			t.Fatalf("%s: expected a page of 10 calls from 20, got %v", callType, values)
		}
		if values.Get("audioTest") != "*41" {
			t.Fatalf("%s: expected audioTest=*41, got %q", callType, values.Get("audioTest"))
		}
		// cti-server drops the lost legs whenever the parameter is there, "false" included.
		if values.Has("removeLostCalls") {
			t.Fatalf("%s: expected no removeLostCalls parameter, got %q", callType, values.Get("removeLostCalls"))
		}
		// An artifact filter is applied here on the rows received: it needs them all.
		req.Artifact = historyArtifactVoicemail
		if _, values, _ = buildLegacyHistoryPath(req); values.Has("groupByCall") || values.Has("limit") || values.Has("offset") {
			t.Fatalf("%s: expected the whole interval with an artifact filter, got %v", callType, values)
		}
	}
}

func TestBuildLegacyHistoryPath_ForwardsTheQueueFilter(t *testing.T) {
	for _, callType := range []string{"switchboard", "group", "user"} {
		req := &historyFilterRequest{CallType: callType, Username: "u", From: "20260901", To: "20260930", Sort: "time desc", Queue: "401"}
		_, values, err := buildLegacyHistoryPath(req)
		if err != nil {
			t.Fatal(err)
		}
		if values.Get("queue") != "401" {
			t.Fatalf("%s: expected queue=401, got %q", callType, values.Get("queue"))
		}
		// No queue selected: every call, so nothing is sent.
		req.Queue = ""
		if _, values, _ = buildLegacyHistoryPath(req); values.Has("queue") {
			t.Fatalf("%s: expected no queue parameter, got %q", callType, values.Get("queue"))
		}
	}
}
