/*
 * Copyright (C) 2026 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package methods

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/nethesis/nethcti-middleware/configuration"
	"github.com/nethesis/nethcti-middleware/logs"
	"github.com/nethesis/nethcti-middleware/store"
	"github.com/nethesis/nethcti-middleware/summary"
)

const (
	historyArtifactAll           = "all"
	historyArtifactSummary       = "summary"
	historyArtifactTranscription = "transcription"
	historyArtifactVoicemail     = "voicemail"
	defaultHistoryPageSize       = 10
)

type historyFilterResponse struct {
	Count int                      `json:"count"`
	Rows  []map[string]interface{} `json:"rows"`
}

type historyFilterRequest struct {
	CallType    string
	Username    string
	From        string
	To          string
	TextSearch  string
	Sort        string
	Direction   string
	PageNum     int
	PageSize    int
	Artifact    string
	AudioTest   string
	Queue       string
	LegacyToken string
}

// GetFilteredHistory returns history rows filtered server-side by voicemail,
// summary or transcription and keeps count/pagination consistent.
func GetFilteredHistory(c *gin.Context) {
	req, err := parseHistoryFilterRequest(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    http.StatusBadRequest,
			"message": err.Error(),
		})
		return
	}

	baseResponse, err := fetchLegacyHistoryFromV1(c.Request.Context(), req)
	if err != nil {
		logs.Log("[ERROR][HISTORY] Failed to fetch legacy history: " + err.Error())
		statusCode := http.StatusBadGateway
		if errors.Is(err, context.DeadlineExceeded) {
			statusCode = http.StatusGatewayTimeout
		}
		c.JSON(statusCode, gin.H{
			"code":    statusCode,
			"message": err.Error(),
		})
		return
	}

	enrichedRows := enrichLocalChannelArtifactRows(baseResponse.Rows)
	filteredRows, err := filterHistoryRowsByArtifact(c, req.Artifact, req.CallType == "switchboard", enrichedRows)
	if err != nil {
		if isSatelliteSchemaMissingError(err) {
			logs.Log("[WARNING][HISTORY] Satellite schema is not initialized while filtering history rows: " + err.Error())
			writeSatelliteSchemaMissingResponse(c)
			return
		}
		if isSatelliteDBUnavailableError(err) {
			// sql.ErrConnDone: GetSatelliteDB already logged the outage.
			if !errors.Is(err, sql.ErrConnDone) {
				logs.Log("[WARNING][HISTORY] Satellite database is unavailable while filtering history rows: " + err.Error())
			}
			writeSatelliteDBUnavailableResponse(c)
			return
		}

		statusCode := http.StatusInternalServerError
		if strings.Contains(err.Error(), "satellite database not configured") {
			statusCode = http.StatusServiceUnavailable
		}

		logs.Log("[ERROR][HISTORY] Failed to filter history rows: " + err.Error())
		c.JSON(statusCode, gin.H{
			"code":    statusCode,
			"message": err.Error(),
		})
		return
	}

	// Drop audio-test (echo) calls server-side BEFORE collapse + pagination, so
	// each page is filled to pageSize. The frontend used to hide these client-side
	// after pagination, which left pages short (count included hidden rows).
	visibleRows := filterAudioTestRows(filteredRows, req.AudioTest)
	// Ring-group calls are a single CDR row whose dst is the group number; rewrite
	// their destination (group name when unanswered, who-answered when answered)
	// before collapsing, since cti-server does not expose the ring-group directory.
	enrichRingGroupRows(visibleRows, getRingGroupNames())
	// Queue-entry legs carry the queue number as dst; inject the queue NAME so an
	// unanswered queue call shows it without relying on the frontend queue store.
	enrichQueueRows(visibleRows, getQueueNames())
	// After the enrichment, because it is what tells one ring-group member from
	// another: their rows all arrive with the group as destination.
	visibleRows = mergeDuplicateLegs(visibleRows)
	collapsedRows := collapseHistoryRowsByLinkedid(visibleRows)
	// Ring-group rows name their member leg; put the GROUP back on a parent that
	// nobody answered, now that collapsing has decided which leg represents the call.
	applyRingGroupParentNames(collapsedRows)
	if pagesCallsUpstream(req) {
		// cti-server already returned the calls of this page only, and their total.
		c.JSON(http.StatusOK, gin.H{
			"count": baseResponse.Count,
			"rows":  collapsedRows,
		})
		return
	}
	c.JSON(http.StatusOK, paginateHistoryRows(collapsedRows, req.PageNum, req.PageSize))
}

// pagesCallsUpstream reports whether cti-server is asked for a page of calls
// (groupByCall) instead of every leg of the interval. The artifact filters are
// applied here, on the rows received, so they still need the whole interval
// to fill a page.
func pagesCallsUpstream(req *historyFilterRequest) bool {
	return req.Artifact == historyArtifactAll
}

func parseHistoryFilterRequest(c *gin.Context) (*historyFilterRequest, error) {
	callType := strings.TrimSpace(c.Query("callType"))
	username := strings.TrimSpace(c.Query("username"))
	from := strings.TrimSpace(c.Query("from"))
	to := strings.TrimSpace(c.Query("to"))
	artifact := strings.TrimSpace(c.DefaultQuery("artifact", historyArtifactAll))
	textSearch := strings.TrimSpace(c.Query("textSearch"))
	sortBy := strings.TrimSpace(c.DefaultQuery("sort", "time%20desc"))
	direction := strings.TrimSpace(c.DefaultQuery("direction", "all"))

	if callType == "" || username == "" || from == "" || to == "" {
		return nil, fmt.Errorf("callType, username, from and to are required")
	}

	if artifact != historyArtifactSummary &&
		artifact != historyArtifactTranscription &&
		artifact != historyArtifactVoicemail &&
		artifact != historyArtifactAll {
		return nil, fmt.Errorf("invalid artifact filter")
	}

	usernameFromClaims, err := getUsernameFromContext(c)
	if err != nil {
		return nil, fmt.Errorf("unauthorized")
	}

	userSession := store.UserSessions[usernameFromClaims]
	if userSession == nil || strings.TrimSpace(userSession.NethCTIToken) == "" {
		return nil, fmt.Errorf("user session not found")
	}

	pageNum, err := parsePositiveInt(c.DefaultQuery("pageNum", "1"), 1)
	if err != nil {
		return nil, fmt.Errorf("invalid pageNum")
	}

	pageSize, err := parsePositiveInt(c.DefaultQuery("pageSize", strconv.Itoa(defaultHistoryPageSize)), defaultHistoryPageSize)
	if err != nil {
		return nil, fmt.Errorf("invalid pageSize")
	}

	return &historyFilterRequest{
		CallType:    callType,
		Username:    username,
		From:        from,
		To:          to,
		TextSearch:  textSearch,
		Sort:        sortBy,
		Direction:   direction,
		PageNum:     pageNum,
		PageSize:    pageSize,
		Artifact:    artifact,
		AudioTest:   strings.TrimSpace(c.Query("audioTest")),
		Queue:       strings.TrimSpace(c.Query("queue")),
		LegacyToken: userSession.NethCTIToken,
	}, nil
}

func parsePositiveInt(raw string, fallback int) (int, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return fallback, nil
	}

	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return 0, fmt.Errorf("invalid positive integer")
	}

	return parsed, nil
}

func fetchLegacyHistoryFromV1(ctx context.Context, req *historyFilterRequest) (*historyFilterResponse, error) {
	if configuration.Config.V1ApiEndpoint == "" {
		return nil, fmt.Errorf("V1 API endpoint not configured")
	}

	path, queryValues, err := buildLegacyHistoryPath(req)
	if err != nil {
		return nil, err
	}

	requestURL := configuration.Config.V1Protocol + "://" + configuration.Config.V1ApiEndpoint + configuration.Config.V1ApiPath + path
	if encoded := queryValues.Encode(); encoded != "" {
		requestURL += "?" + encoded
	}

	// Bound to the client request too: when the CTI moves to another page or
	// filter, the request it leaves is not waited for.
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Authorization", req.LegacyToken)

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		bodyText := strings.TrimSpace(string(bodyBytes))
		if bodyText == "" {
			return nil, fmt.Errorf("legacy history upstream returned status %d", resp.StatusCode)
		}
		return nil, fmt.Errorf("legacy history upstream returned status %d: %s", resp.StatusCode, bodyText)
	}

	var payload historyFilterResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}

	if payload.Rows == nil {
		payload.Rows = []map[string]interface{}{}
	}

	return &payload, nil
}

func buildLegacyHistoryPath(req *historyFilterRequest) (string, url.Values, error) {
	queryValues := url.Values{}
	sortValue := req.Sort
	if decodedSort, err := url.QueryUnescape(req.Sort); err == nil && strings.TrimSpace(decodedSort) != "" {
		sortValue = decodedSort
	}
	queryValues.Set("sort", sortValue)

	// Never ask cti-server to drop "lost" (unanswered) legs, even on the incoming
	// filter. With call grouping the unanswered legs of a call ARE its interactions
	// (e.g. the members a queue/ring-group call rang before someone answered);
	// removing them collapses a groupable call down to a single leg, which then
	// shows as non-expandable. Keep every leg so grouping stays correct.
	// The parameter is left out rather than set to "false": cti-server only checks
	// whether it is there, so "false" turned the removal on.
	// Ask cti-server for every leg of a call rather than one row per call: this is
	// the only caller that groups them back together (by linkedid), and every other
	// consumer of that API — NethLink, the mobile app, the CTI drawers — keeps
	// receiving the deduplicated rows it expects.
	queryValues.Set("expandLegs", "true")
	// Only calls that went through this queue; empty means every call.
	if req.Queue != "" {
		queryValues.Set("queue", req.Queue)
	}
	// A page of calls: cti-server reads only the calls of this page and returns
	// every leg of them with the total of calls, instead of every leg of the
	// interval for this side to group and cut.
	if pagesCallsUpstream(req) {
		queryValues.Set("groupByCall", "true")
		queryValues.Set("limit", strconv.Itoa(req.PageSize))
		queryValues.Set("offset", strconv.Itoa((req.PageNum-1)*req.PageSize))
		// The audio test legs are left out by the same query, so that they do not
		// take a place in the page.
		if code := strings.TrimSpace(req.AudioTest); code != "" {
			queryValues.Set("audioTest", code)
		}
	}

	var path string
	switch req.CallType {
	case "switchboard":
		path = "/histcallswitch/interval/" + req.From + "/" + req.To
		if req.TextSearch != "" {
			path += "/" + url.PathEscape(req.TextSearch)
		}
		if req.Direction != "" && req.Direction != "all" {
			queryValues.Set("type", req.Direction)
		}
	case "group", "groups":
		path = "/histcallsgroups/interval/" + req.From + "/" + req.To
		if req.TextSearch != "" {
			path += "/" + url.PathEscape(req.TextSearch)
		}
		if req.Direction != "" && req.Direction != "all" {
			queryValues.Set("type", req.Direction)
		}
	default:
		path = "/historycall/interval/" + req.CallType + "/" + url.PathEscape(req.Username) + "/" + req.From + "/" + req.To
		if req.TextSearch != "" {
			path += "/" + url.PathEscape(req.TextSearch)
		}
		if req.Direction != "" && req.Direction != "all" {
			queryValues.Set("direction", req.Direction)
		}
	}

	return path, queryValues, nil
}

func filterHistoryRowsByArtifact(c *gin.Context, artifact string, switchboard bool, rows []map[string]interface{}) ([]map[string]interface{}, error) {
	switch artifact {
	case historyArtifactAll:
		return rows, nil
	case historyArtifactVoicemail:
		filtered := make([]map[string]interface{}, 0, len(rows))
		for _, row := range rows {
			if hasHistoryVoicemail(row) {
				filtered = append(filtered, row)
			}
		}
		return filtered, nil
	case historyArtifactSummary, historyArtifactTranscription:
		if !summary.IsSatelliteDBConfigured() {
			return nil, fmt.Errorf("satellite database not configured")
		}
		if !satelliteDBAvailableFunc() {
			return nil, sql.ErrConnDone
		}

		lookups := collectHistorySummaryLookups(rows)
		if len(lookups) == 0 {
			return []map[string]interface{}{}, nil
		}

		resolvedLookups, err := resolveSummaryStatusLookups(c, lookups)
		if err != nil {
			return nil, err
		}

		// Same choice as the status list: in the personal view the row's
		// transcript is the one the user took part in.
		var preferredNumbers []string
		if !switchboard {
			preferredNumbers, _ = getUserPhoneNumbersFromContext(c)
		}

		statusItems, err := fetchSummaryListFunc(collectResolvedUniqueIDs(resolvedLookups), preferredNumbers)
		if err != nil {
			if isSatelliteSchemaMissingError(err) {
				// No schema yet means none of the rows have a summary/transcription
				// artifact; fall through with an empty set instead of an outage.
				statusItems = nil
			} else {
				return nil, err
			}
		}

		itemByUniqueID := make(map[string]SummaryListItem, len(statusItems))
		for _, item := range statusItems {
			itemByUniqueID[item.UniqueID] = item
		}

		statusMap := make(map[string]SummaryListItem, len(resolvedLookups))
		for _, lookup := range resolvedLookups {
			if lookup.ResolvedUniqueID == "" {
				continue
			}
			item, ok := itemByUniqueID[lookup.ResolvedUniqueID]
			if !ok {
				continue
			}
			statusMap[historySummaryLookupKey(lookup.LinkedID, lookup.UniqueID)] = item
		}

		filtered := make([]map[string]interface{}, 0, len(rows))
		for _, row := range rows {
			lookupKey := historySummaryLookupKey(
				strings.TrimSpace(getHistoryRowString(row, "linkedid")),
				strings.TrimSpace(getHistoryRowString(row, "uniqueid")),
			)
			if lookupKey == "" {
				continue
			}

			item, ok := statusMap[lookupKey]
			if !ok {
				continue
			}

			if historyArtifactRowMatches(artifact, item) {
				filtered = append(filtered, row)
			}
		}

		return filtered, nil
	default:
		return rows, nil
	}
}

// historyArtifactRowMatches reports whether a history row carrying the given
// summary/transcription status should be kept for the requested artifact filter.
// The Summary and Transcription filters are allowed to overlap: a call that has
// both a summary and a transcription matches both filters, consistent with the
// UI where the "View transcription" action is available whenever the call has a
// transcription regardless of an accompanying summary.
func historyArtifactRowMatches(artifact string, item SummaryListItem) bool {
	if strings.TrimSpace(item.State) != "done" {
		return false
	}

	switch artifact {
	case historyArtifactSummary:
		return item.HasSummary
	case historyArtifactTranscription:
		return item.HasTranscription
	default:
		return false
	}
}

// historySummaryLookupKey identifies a history row for transcript/summary
// status correlation. It prefers the per-leg uniqueid so that each leg of a
// transfer (several rows share one linkedid, one row per uniqueid) is correlated
// to its own transcript, instead of collapsing the whole call onto a single
// linkedid-keyed status. Falls back to linkedid when the uniqueid is absent.
func historySummaryLookupKey(linkedID string, uniqueID string) string {
	if uniqueID != "" {
		return uniqueID
	}
	return linkedID
}

func collectHistorySummaryLookups(rows []map[string]interface{}) []SummaryStatusLookup {
	collected := make([]SummaryStatusLookup, 0, len(rows))
	seen := make(map[string]struct{})

	for _, row := range rows {
		linkedID := strings.TrimSpace(getHistoryRowString(row, "linkedid"))
		uniqueID := strings.TrimSpace(getHistoryRowString(row, "uniqueid"))
		lookupKey := historySummaryLookupKey(linkedID, uniqueID)
		if lookupKey == "" {
			continue
		}
		if _, ok := seen[lookupKey]; ok {
			continue
		}
		seen[lookupKey] = struct{}{}
		collected = append(collected, SummaryStatusLookup{
			UniqueID: uniqueID,
			LinkedID: linkedID,
		})
	}

	return collected
}

func hasHistoryVoicemail(row map[string]interface{}) bool {
	if value, ok := row["has_voicemail_message"].(bool); ok && value {
		return true
	}

	return strings.TrimSpace(getHistoryRowString(row, "voicemail_message_id")) != ""
}

func getHistoryRowString(row map[string]interface{}, key string) string {
	value, ok := row[key]
	if !ok || value == nil {
		return ""
	}

	switch typed := value.(type) {
	case string:
		return typed
	case fmt.Stringer:
		return typed.String()
	default:
		return fmt.Sprintf("%v", typed)
	}
}

// enrichLocalChannelArtifactRows fixes Local-channel ;1 routing-artifact rows that
// Asterisk creates for attended transfers. Those rows have src == dst (the extension
// number) because they carry no real party information.  We replace their caller
// fields with the cnum/cnam from the paired ;2 row that shares the same linkedid and
// destination, so the history table shows "201 → You" instead of "You → You".
func enrichLocalChannelArtifactRows(rows []map[string]interface{}) []map[string]interface{} {
	// Group row indices by linkedid.
	byLinkedID := make(map[string][]int, len(rows))
	for i, row := range rows {
		linkedID := getHistoryRowString(row, "linkedid")
		if linkedID == "" {
			continue
		}
		byLinkedID[linkedID] = append(byLinkedID[linkedID], i)
	}

	for _, indices := range byLinkedID {
		if len(indices) < 2 {
			continue
		}
		for _, artifactIdx := range indices {
			artifact := rows[artifactIdx]
			src := getHistoryRowString(artifact, "src")
			dst := getHistoryRowString(artifact, "dst")
			// A ;1 routing artifact always has src == dst (the extension dialled
			// into the Local channel).
			if src == "" || src != dst {
				continue
			}
			// Find the paired ;2 row: same linkedid, same dst, src ≠ dst.
			for _, pairedIdx := range indices {
				if pairedIdx == artifactIdx {
					continue
				}
				paired := rows[pairedIdx]
				if getHistoryRowString(paired, "dst") != dst {
					continue
				}
				pairedSrc := getHistoryRowString(paired, "src")
				if pairedSrc == getHistoryRowString(paired, "dst") {
					continue // skip another artifact
				}
				// Use the paired row's cnum (transfer initiator) as the
				// artifact row's displayed caller.
				pairedCnum := getHistoryRowString(paired, "cnum")
				if pairedCnum == "" {
					break
				}
				artifact["src"] = pairedCnum
				artifact["cnum"] = pairedCnum
				artifact["cnam"] = paired["cnam"]
				artifact["ccompany"] = paired["ccompany"]
				break
			}
		}
	}

	return rows
}

// filterAudioTestRows drops audio-test / echo calls whose src or dst contains the
// audio-test feature code (e.g. "*41"). Mirrors the CTI client-side filter, but
// done here before pagination so pages are not left short. An empty code is a
// no-op (nothing is filtered).
func filterAudioTestRows(rows []map[string]interface{}, audioTestCode string) []map[string]interface{} {
	code := strings.TrimSpace(audioTestCode)
	if code == "" {
		return rows
	}
	out := make([]map[string]interface{}, 0, len(rows))
	for _, row := range rows {
		if strings.Contains(getHistoryRowString(row, "src"), code) ||
			strings.Contains(getHistoryRowString(row, "dst"), code) {
			continue
		}
		out = append(out, row)
	}
	return out
}

func paginateHistoryRows(rows []map[string]interface{}, pageNum int, pageSize int) gin.H {
	count := len(rows)
	start := (pageNum - 1) * pageSize
	if start > count {
		start = count
	}

	end := start + pageSize
	if end > count {
		end = count
	}

	return gin.H{
		"count": count,
		"rows":  rows[start:end],
	}
}

// collapseHistoryRowsByLinkedid groups the (already filtered) history rows by
// linkedid into one parent row per logical call. The parent is the first leg with
// disposition "ANSWERED", or the first leg if none answered. The parent keeps its
// group's first-occurrence position and gains an "interactions" slice (the group's
// other legs, ordered by ascending time) plus an "interactionsCount" (total legs).
// Rows with an empty linkedid are each their own group and are never merged.
func collapseHistoryRowsByLinkedid(rows []map[string]interface{}) []map[string]interface{} {
	type slot struct {
		key        string                 // linkedid group key; "" for a standalone row
		standalone map[string]interface{} // set when the row has no linkedid
	}
	legsByID := make(map[string][]map[string]interface{})
	slots := make([]slot, 0, len(rows))

	for _, row := range rows {
		linkedID := getHistoryRowString(row, "linkedid")
		if linkedID == "" {
			slots = append(slots, slot{standalone: row})
			continue
		}
		if _, seen := legsByID[linkedID]; !seen {
			slots = append(slots, slot{key: linkedID})
		}
		legsByID[linkedID] = append(legsByID[linkedID], row)
	}

	result := make([]map[string]interface{}, 0, len(slots))
	for _, s := range slots {
		if s.standalone != nil {
			s.standalone["interactionsCount"] = 1
			result = append(result, s.standalone)
			continue
		}
		allLegs := legsByID[s.key]
		queueName, queueNum := queueIdentityFromLegs(allLegs)
		legs := dropContextEntryLegs(pruneQueueLegs(allLegs))
		parentIdx := selectParentLegIndex(legs)
		parent := legs[parentIdx]
		// Keep the queue identity on the row even when its legs were pruned, so the
		// frontend can still tell (and name) the queue the call went through.
		if queueName != "" {
			parent["queueName"] = queueName
		}
		if queueNum != "" {
			parent["queueNum"] = queueNum
		}
		// Every leg is listed, the one behind the summary included: it is a step of
		// the call like the others (on a transferred call it IS the handover), and
		// leaving it out hid the very step that decided where the call ended up.
		// It is snapshotted first, so the summary's rewrites do not reach it and it
		// keeps naming the parties as that leg recorded them.
		children := make([]map[string]interface{}, 0, len(legs))
		for i, leg := range legs {
			if i == parentIdx {
				children = append(children, copyHistoryRow(leg))
				continue
			}
			children = append(children, leg)
		}
		// Every leg is passed, the queue and plumbing ones dropped above included: on
		// a transferred or queue call they are the only ones still carrying the trunk,
		// and so the only evidence of where the outside party is.
		applyFinalPartiesToParent(parent, legs, allLegs, parentIdx, getTrunks())
		applyPersonalDirectionToParent(parent, allLegs)
		if len(legs) > 1 {
			sortLegsByCreation(children)
			parent["interactions"] = children
		}
		parent["interactionsCount"] = len(legs)
		result = append(result, parent)
	}
	return result
}

// selectParentLegIndex returns the index of the leg to use as the group parent,
// chosen deterministically so the same call yields the same parent regardless of
// the request sort order. Preference tiers:
//  1. the LAST ANSWERED leg that is a real answered conversation (a Dial leg, so
//     its dst is WHO answered) rather than the queue-entry leg (lastapp="Queue").
//     "Last" so a transferred call shows the party it ended up with — the final
//     recipient — with that party's talk time;
//  2. the last ANSWERED leg overall;
//  3. nothing answered: the queue-entry leg (lastapp="Queue"), so an unanswered
//     queue call shows the QUEUE as the destination (its dst is the queue number,
//     which the frontend resolves to the queue name) with a "no answer" outcome,
//     rather than a random member extension or the "s" context leg;
//  4. the earliest leg overall (nothing answered, no queue leg — e.g. a ring group,
//     whose group-entry leg has no reliable CDR marker; handled separately).
//
// Within the answered/queue tiers the latest leg wins (ties broken by uniqueid); in
// the final fallback the earliest wins. Either way the choice never depends on the
// order the rows arrived in.
func selectParentLegIndex(legs []map[string]interface{}) int {
	if i := lastLegMatching(legs, func(leg map[string]interface{}) bool {
		return getHistoryRowString(leg, "disposition") == "ANSWERED" &&
			getHistoryRowString(leg, "lastapp") != "Queue"
	}); i != -1 {
		return i
	}
	if i := lastLegMatching(legs, func(leg map[string]interface{}) bool {
		return getHistoryRowString(leg, "disposition") == "ANSWERED"
	}); i != -1 {
		return i
	}
	if i := lastLegMatching(legs, func(leg map[string]interface{}) bool {
		return getHistoryRowString(leg, "lastapp") == "Queue"
	}); i != -1 {
		return i
	}
	return earliestLegMatching(legs, func(map[string]interface{}) bool { return true })
}

// lastLegMatching returns the index of the latest leg (by legAfter) that
// satisfies pred, or -1 if none match.
func lastLegMatching(legs []map[string]interface{}, pred func(map[string]interface{}) bool) int {
	best := -1
	for i := range legs {
		if !pred(legs[i]) {
			continue
		}
		if best == -1 || legAfter(legs[i], legs[best]) {
			best = i
		}
	}
	return best
}

// legAfter reports whether leg a comes after leg b, so the "final recipient"
// choice does not depend on the order the rows arrived in.
//
// The ordering key is the uniqueid, not the "time" field: cti-server groups the
// CDR by (uniqueid, linkedid, disposition) and reports a non-aggregated calldate,
// so "time" can carry the timestamp of any row of the group — legs of one call
// routinely come back with the same or a shuffled time. An Asterisk uniqueid is
// "<epoch>.<sequence>", which orders the legs as they were created.
func legAfter(a, b map[string]interface{}) bool {
	ua, ub := legSequence(a), legSequence(b)
	if ua != ub {
		return ua > ub
	}
	return getHistoryRowString(a, "uniqueid") > getHistoryRowString(b, "uniqueid")
}

// legSequence returns the leg's uniqueid as a number, so legs sort in creation
// order. Falls back to the row time when the uniqueid is not in the expected form.
func legSequence(leg map[string]interface{}) float64 {
	if value, err := strconv.ParseFloat(getHistoryRowString(leg, "uniqueid"), 64); err == nil {
		return value
	}
	return historyRowTime(leg)
}

// earliestLegMatching returns the index of the earliest leg (by legLess) that
// satisfies pred, or -1 if none match.
func earliestLegMatching(legs []map[string]interface{}, pred func(map[string]interface{}) bool) int {
	best := -1
	for i := range legs {
		if !pred(legs[i]) {
			continue
		}
		if best == -1 || legLess(legs[i], legs[best]) {
			best = i
		}
	}
	return best
}

// legLess is legAfter reversed: it reports whether leg a comes before leg b.
func legLess(a, b map[string]interface{}) bool {
	ua, ub := legSequence(a), legSequence(b)
	if ua != ub {
		return ua < ub
	}
	return getHistoryRowString(a, "uniqueid") < getHistoryRowString(b, "uniqueid")
}

// sortLegsByCreation sorts legs in the order Asterisk created them (see legAfter
// for why the "time" field cannot be used).
func sortLegsByCreation(legs []map[string]interface{}) {
	sort.SliceStable(legs, func(i, j int) bool {
		return legLess(legs[i], legs[j])
	})
}

// copyHistoryRow returns a shallow copy of a row, so mutating one does not change
// the other.
func copyHistoryRow(row map[string]interface{}) map[string]interface{} {
	copied := make(map[string]interface{}, len(row))
	for key, value := range row {
		copied[key] = value
	}
	return copied
}

// historyRowTime reads the numeric "time" field regardless of its JSON type.
func historyRowTime(row map[string]interface{}) float64 {
	switch v := row["time"].(type) {
	case float64:
		return v
	case int:
		return float64(v)
	case json.Number:
		f, _ := v.Float64()
		return f
	case string:
		f, _ := strconv.ParseFloat(v, 64)
		return f
	default:
		return 0
	}
}

// queueIdentityFromLegs returns the queue name and number of a call that went
// through a queue, taken from any of its queue legs, or empty strings when the
// call never entered one.
func queueIdentityFromLegs(legs []map[string]interface{}) (name string, num string) {
	for _, leg := range legs {
		if getHistoryRowString(leg, "lastapp") != "Queue" {
			continue
		}
		if n := getHistoryRowString(leg, "queueName"); n != "" {
			name = n
		}
		if d := getHistoryRowString(leg, "dst"); d != "" {
			num = d
		}
		if name != "" && num != "" {
			return name, num
		}
	}
	return name, num
}

// pruneQueueLegs removes the queue's own bookkeeping legs from a call's legs.
// A queue writes one lastapp="Queue" row per member it rings, all sharing the
// queue-entry uniqueid: they duplicate the members' Dial legs (which are shown as
// interactions and name the member, while the queue rows all name the queue).
//
//   - An agent answered: the call is already described by that agent and by each
//     member's own leg, so ALL queue legs are dropped. The queue identity is not
//     lost — it is carried on the collapsed row as queueName/queueNum.
//   - Nobody answered: exactly one queue leg is kept (the earliest), so the call
//     still shows the queue it went to, with the members it rang underneath.
func pruneQueueLegs(legs []map[string]interface{}) []map[string]interface{} {
	answeredByAgent := false
	queueLegs := 0
	keep := -1
	for i := range legs {
		isQueueLeg := getHistoryRowString(legs[i], "lastapp") == "Queue"
		answered := getHistoryRowString(legs[i], "disposition") == "ANSWERED"
		if !isQueueLeg {
			if answered {
				answeredByAgent = true
			}
			continue
		}
		queueLegs++
		if keep == -1 || legLess(legs[i], legs[keep]) {
			keep = i
		}
	}
	if queueLegs == 0 || (queueLegs == 1 && !answeredByAgent) {
		return legs
	}
	if answeredByAgent {
		keep = -1
	}

	result := make([]map[string]interface{}, 0, len(legs))
	for i := range legs {
		if getHistoryRowString(legs[i], "lastapp") == "Queue" && i != keep {
			continue
		}
		result = append(result, legs[i])
	}
	return result
}

// Leg roles: which side of a leg, if any, faces the outside.
const (
	legInternal = iota
	legInbound
	legOutbound
)

// legRole tells whether a leg came in from a trunk, went out to one, or stayed
// inside the PBX. It is read from the leg's channels, never from its numbers: a
// queue, a ring group or the caller id a trunk presents are not extensions, yet
// none of them is an outside party. Without a trunk list it falls back to the
// classification cti-server attached to the row, when there is one.
func legRole(leg map[string]interface{}, trunks []string) int {
	if len(trunks) > 0 {
		if isTrunkChannel(getHistoryRowString(leg, "dstchannel"), trunks) {
			return legOutbound
		}
		if isTrunkChannel(getHistoryRowString(leg, "channel"), trunks) {
			return legInbound
		}
		return legInternal
	}
	switch getHistoryRowString(leg, "type") {
	case "out":
		return legOutbound
	case "in":
		return legInbound
	}
	return legInternal
}

// callDirection tells which way a call went from all its legs: in when any leg
// came in from a trunk, out when any went out to one, internal otherwise.
func callDirection(legs []map[string]interface{}, trunks []string) string {
	direction := "internal"
	for _, leg := range legs {
		switch legRole(leg, trunks) {
		case legInbound:
			return "in"
		case legOutbound:
			direction = "out"
		}
	}
	return direction
}

// applyFinalPartiesToParent makes the collapsed row name the two parties that
// ended up talking, keeping the direction the call had: an incoming call reads
// "outside caller -> colleague who took it", an outgoing one "colleague on the
// line -> number dialled", an internal one as its last conversation. A transfer
// changes who is on the line, never the side the call came from.
//
// The outside party is taken from the legs that touch a trunk (legRole), which
// are often the queue or plumbing legs not shown as interactions, hence allLegs.
// cnum/cnam are not trusted on their own: they name the party that STARTED a
// transfer, or the caller id a trunk presents on a call placed outside.
func applyFinalPartiesToParent(parent map[string]interface{}, legs, allLegs []map[string]interface{}, parentIdx int, trunks []string) {
	// The parent is one of the legs: nothing may be written to it before every leg
	// has been read.
	direction := callDirection(allLegs, trunks)
	// A single leg is its own summary: its parties stay as it recorded them.
	if len(legs) < 2 {
		parent["type"] = direction
		return
	}

	// The last real conversation of the call.
	idx := lastLegMatching(legs, func(leg map[string]interface{}) bool {
		return getHistoryRowString(leg, "disposition") == "ANSWERED" &&
			getHistoryRowString(leg, "lastapp") != ""
	})
	if idx == -1 {
		idx = parentIdx
	}
	conv := legs[idx]

	// Colleagues: the configured extensions, plus the devices this call rang
	// (a channel that is not a trunk names one, e.g. "PJSIP/203-...").
	colleague := func(number string) bool {
		if number == "" {
			return false
		}
		if _, ok := getExtensions()[number]; ok {
			return true
		}
		for _, leg := range allLegs {
			for _, field := range []string{"channel", "dstchannel"} {
				channel := getHistoryRowString(leg, field)
				if !strings.HasPrefix(channel, "Local/") && !isTrunkChannel(channel, trunks) &&
					strings.Contains(channel, "/"+number+"-") {
					return true
				}
			}
		}
		return false
	}

	// The caller ids a trunk presents on the calls placed through it. On the leg
	// that dialled out src carries one of them, while the extension stays in cnum
	// — unless src is itself a colleague: then it is the party a transfer put on
	// the line, and cnum is whoever transferred it.
	presented := map[string]bool{}
	markPresented := func(leg map[string]interface{}) {
		if src := getHistoryRowString(leg, "src"); src != "" && !colleague(src) {
			presented[src] = true
		}
	}
	for _, leg := range allLegs {
		if legRole(leg, trunks) == legOutbound && getHistoryRowString(leg, "lastapp") != "" {
			markPresented(leg)
		}
	}

	type party struct{ number, name, company string }
	fromSrc := func(leg map[string]interface{}) party {
		p := party{number: getHistoryRowString(leg, "src")}
		if p.number != "" && p.number == getHistoryRowString(leg, "cnum") {
			p.name, p.company = getHistoryRowString(leg, "cnam"), getHistoryRowString(leg, "ccompany")
		}
		return p
	}
	fromCnum := func(leg map[string]interface{}) party {
		return party{getHistoryRowString(leg, "cnum"), getHistoryRowString(leg, "cnam"), getHistoryRowString(leg, "ccompany")}
	}
	fromDst := func(leg map[string]interface{}) party {
		return party{getHistoryRowString(leg, "dst"), getHistoryRowString(leg, "dst_cnam"), getHistoryRowString(leg, "dst_ccompany")}
	}
	earliest := func(pred func(map[string]interface{}) bool) map[string]interface{} {
		if i := earliestLegMatching(allLegs, pred); i != -1 {
			return allLegs[i]
		}
		return nil
	}
	withApp := func(leg map[string]interface{}) bool { return getHistoryRowString(leg, "lastapp") != "" }

	var from, to party
	switch direction {
	case "in":
		// The caller, as the first leg in from the trunk recorded it.
		entry := earliest(func(l map[string]interface{}) bool { return legRole(l, trunks) == legInbound && withApp(l) })
		if entry == nil {
			entry = earliest(func(l map[string]interface{}) bool { return legRole(l, trunks) == legInbound })
		}
		from = fromSrc(entry)
		to = fromDst(conv)
	case "out":
		// The number dialled: the destination of the leg that went out, or of the
		// call's first leg when a transfer moved the trunk onto a plumbing leg.
		dial := earliest(func(l map[string]interface{}) bool { return legRole(l, trunks) == legOutbound && withApp(l) })
		if dial == nil {
			// The leg that placed the call: Asterisk gives the call's first channel
			// the linkedid as its own uniqueid.
			dial = earliest(func(l map[string]interface{}) bool {
				return withApp(l) && getHistoryRowString(l, "uniqueid") == getHistoryRowString(l, "linkedid")
			})
			if dial == nil {
				// Not among these legs (a personal view sees only the user's own):
				// the dialled number is unknown here, so the call reads as recorded.
				from, to = fromSrc(conv), fromDst(conv)
				break
			}
			markPresented(dial)
		}
		to = fromDst(dial)
		// Whoever is on the inside of the last conversation: the side that is
		// neither the number dialled nor a caller id the trunk presented. On the
		// leg that went out that is src when a transfer put a colleague there,
		// the extension in cnum otherwise.
		candidates := []party{fromDst(conv), fromSrc(conv), fromCnum(conv)}
		if legRole(conv, trunks) == legOutbound {
			candidates = []party{fromSrc(conv), fromCnum(conv)}
		}
		for _, c := range candidates {
			if c.number != "" && c.number != to.number && !presented[c.number] {
				from = c
				break
			}
		}
	default:
		from = fromSrc(conv)
		if from.number == "" {
			from = fromCnum(conv)
		}
		to = fromDst(conv)
	}

	if from.number != "" {
		parent["src"] = from.number
		parent["cnum"] = from.number
		parent["cnam"] = from.name
		parent["ccompany"] = from.company
	}
	if to.number != "" {
		parent["dst"] = to.number
		parent["dst_cnam"] = to.name
		parent["dst_ccompany"] = to.company
	}
	parent["type"] = direction
	for _, field := range []string{"duration", "billsec"} {
		if value, ok := conv[field]; ok {
			parent[field] = value
		}
	}
}

// dropContextEntryLegs removes the legs Asterisk writes for its own bookkeeping
// rather than for a conversation: they name no party, so as interactions they read
// as a meaningless "s" or "-" among the real steps of the call.
//
//   - dst "s" is the context-entry extension, written for instance by the MacroExit
//     that completes an attended transfer;
//   - an empty dst comes from control legs such as Return.
//
// A call made ONLY of such legs keeps them, so no call ever disappears.
func dropContextEntryLegs(legs []map[string]interface{}) []map[string]interface{} {
	kept := make([]map[string]interface{}, 0, len(legs))
	for _, leg := range legs {
		if isBookkeepingLeg(leg) {
			continue
		}
		kept = append(kept, leg)
	}
	if len(kept) == 0 {
		return legs
	}
	return kept
}

// isBookkeepingLeg reports whether a leg records Asterisk's own plumbing rather
// than a conversation:
//
//   - no destination at all, or the context-entry extension "s";
//   - no application: every real leg ran one (Dial, Queue, ...), while the leg
//     written once a transferred channel is re-bridged has none. That one is the
//     most misleading of all, because cti-server reports it with the transferring
//     party as its source, so it looks like a genuine call between the colleague
//     who passed the call on and the one who took it;
//   - a "Terminate Call" destination (context app-blackhole: hangup, busy,
//     congestion, ...), such as a ring group's failover once nobody answered. On
//     a call already answered by the trunk it is ANSWERED, so it would otherwise
//     become the summary and show an unanswered call as answered by "hangup".
func isBookkeepingLeg(leg map[string]interface{}) bool {
	dst := getHistoryRowString(leg, "dst")
	return dst == "" || dst == "s" || getHistoryRowString(leg, "lastapp") == "" ||
		getHistoryRowString(leg, "dcontext") == "app-blackhole"
}

// applyPersonalDirectionToParent keeps the personal history's own notion of
// direction on the collapsed row. cti-server computes "direction" per leg from
// the requesting user's extensions ("out" when they placed the call, "in" when
// they received it), and the personal view draws its arrow from that field alone.
// The leg promoted to summary is not always the one that carries it — on a call
// the user placed and then transferred away, only the first leg does — so the
// row would otherwise report no direction at all and be drawn as incoming.
func applyPersonalDirectionToParent(parent map[string]interface{}, legs []map[string]interface{}) {
	ordered := make([]map[string]interface{}, len(legs))
	copy(ordered, legs)
	sortLegsByCreation(ordered)
	for _, leg := range ordered {
		if direction := getHistoryRowString(leg, "direction"); direction != "" {
			parent["direction"] = direction
			return
		}
	}
}

// mergeDuplicateLegs collapses the rows that describe the SAME leg into one.
//
// cti-server is asked to keep the destination channel apart when the caller wants
// a call's legs (see historyGroupBy there), because a ring group dials all its
// members from one channel and its legs would otherwise be aggregated into a
// single row, losing every member but one. The cost is that a leg Asterisk
// recorded on two channels — typically once on the Local channel and once on the
// device's own — arrives as two rows naming the same destination.
//
// Rows are keyed by the leg (uniqueid), its outcome and the party it reached, so
// the members of a ring group stay apart while those pairs merge back. The
// longest row wins, which is the duration cti-server used to report for the
// merged group.
func mergeDuplicateLegs(rows []map[string]interface{}) []map[string]interface{} {
	merged := make([]map[string]interface{}, 0, len(rows))
	indexByKey := make(map[string]int, len(rows))
	for _, row := range rows {
		key := getHistoryRowString(row, "uniqueid") + "\x00" +
			getHistoryRowString(row, "linkedid") + "\x00" +
			getHistoryRowString(row, "disposition") + "\x00" +
			getHistoryRowString(row, "dst")
		existing, seen := indexByKey[key]
		if !seen {
			indexByKey[key] = len(merged)
			merged = append(merged, row)
			continue
		}
		if historyRowNumber(row, "duration") > historyRowNumber(merged[existing], "duration") {
			// Keep the longer row, but never lose a billsec or an application name
			// the shorter one carried.
			row = keepRicherLeg(row, merged[existing])
			merged[existing] = row
			continue
		}
		merged[existing] = keepRicherLeg(merged[existing], row)
	}
	return merged
}

// keepRicherLeg fills the gaps of the winning row from the one being dropped.
func keepRicherLeg(winner, loser map[string]interface{}) map[string]interface{} {
	if historyRowNumber(loser, "billsec") > historyRowNumber(winner, "billsec") {
		winner["billsec"] = loser["billsec"]
	}
	for _, field := range []string{"lastapp", "dstchannel", "channel", "dst_cnam", "dst_ccompany", "cnam"} {
		if getHistoryRowString(winner, field) == "" && getHistoryRowString(loser, field) != "" {
			winner[field] = loser[field]
		}
	}
	return winner
}

// historyRowNumber reads a numeric field regardless of the JSON type it arrived as.
func historyRowNumber(row map[string]interface{}, field string) float64 {
	switch value := row[field].(type) {
	case float64:
		return value
	case int:
		return float64(value)
	case int64:
		return float64(value)
	case json.Number:
		if parsed, err := value.Float64(); err == nil {
			return parsed
		}
	}
	return 0
}
