/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package methods

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/fatih/structs"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/nethesis/nethcti-middleware/db"
	"github.com/nethesis/nethcti-middleware/logs"
	"github.com/nethesis/nethcti-middleware/models"
	"github.com/nethesis/nethcti-middleware/store"
	"github.com/nethesis/nethcti-middleware/summary"
)

type SummaryWatchRequest struct {
	UniqueID string `json:"uniqueid"`
	LinkedID string `json:"linkedid,omitempty"`
}

type SummaryUpdateRequest struct {
	Summary string `json:"summary"`
}

type SummaryDrawer struct {
	UniqueID      string     `json:"uniqueid"`
	Summary       string     `json:"summary"`
	Sentiment     *int       `json:"sentiment,omitempty"`
	State         string     `json:"state"`
	Src           string     `json:"src,omitempty"`
	Dst           string     `json:"dst,omitempty"`
	CNam          string     `json:"cnam,omitempty"`
	Company       string     `json:"company,omitempty"`
	DstCompany    string     `json:"dst_company,omitempty"`
	DstCNam       string     `json:"dst_cnam,omitempty"`
	CallTimestamp *time.Time `json:"call_timestamp,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
	DeletedAt     *time.Time `json:"deleted_at,omitempty"`
}

type CallMetadata struct {
	Src           string
	Dst           string
	CNam          string
	Company       string
	DstCompany    string
	DstCNam       string
	CallTimestamp *time.Time
}

type SummaryListItem struct {
	ID               int64      `json:"id,omitempty"`
	LinkedID         string     `json:"linkedid,omitempty"`
	UniqueID         string     `json:"uniqueid"`
	State            string     `json:"state"`
	HasTranscription bool       `json:"has_transcription"`
	HasSummary       bool       `json:"has_summary"`
	SrcNumber        string     `json:"src_number,omitempty"`
	DstNumber        string     `json:"dst_number,omitempty"`
	// DurationSeconds is the wall-clock length of this conversation segment, set by
	// the satellite for transfer sub-legs (consultation / post-transfer) that have
	// no CDR row of their own for every participant. Lets the UI render a real
	// duration instead of 00:00:00. Nil when unknown.
	DurationSeconds  *int       `json:"duration_seconds,omitempty"`
	// Extra marks a conversation surfaced in addition to the requested history
	// row (e.g. the consultation leg of a transfer). The frontend renders these
	// as their own conversation rows, keyed by id (not uniqueid, which they may
	// share with the main leg).
	Extra     bool       `json:"extra,omitempty"`
	UpdatedAt *time.Time `json:"updated_at"`
}

var (
	fetchSummaryDrawerFunc                     = fetchSummaryDrawerFromDB
	fetchSummaryDrawerByIDFunc                 = fetchSummaryDrawerByID
	fetchSummaryListFunc                       = fetchSummaryListFromDB
	fetchParticipatedConversationsFunc         = fetchParticipatedConversationsFromDB
	fetchAllConversationsByLinkedIDsFunc       = fetchAllConversationsByLinkedIDsFromDB
	fetchSummaryStateFunc                      = fetchSummaryStateFromDB
	fetchSummaryFunc                           = fetchSummaryFromDB
	updateSummaryFunc                          = updateSummaryInDB
	updateSummaryByIDFunc                      = updateSummaryByID
	startSummaryWatchFunc = summary.StartSummaryWatchWithLinkedID
)

// getTranscriptIDFromQuery returns the optional ?id= transcript row id used to
// disambiguate conversations that share an Asterisk uniqueid. 0 means absent.
func getTranscriptIDFromQuery(c *gin.Context) int64 {
	raw := strings.TrimSpace(c.Query("id"))
	if raw == "" {
		return 0
	}
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id < 0 {
		return 0
	}
	return id
}

func getUniqueIDFromPath(c *gin.Context) string {
	return strings.TrimSpace(c.Param("uniqueid"))
}

type SummaryStatusLookup struct {
	UniqueID string `json:"uniqueid,omitempty"`
	LinkedID string `json:"linkedid,omitempty"`
}

type resolvedSummaryStatusLookup struct {
	UniqueID         string
	LinkedID         string
	ResolvedUniqueID string
}

// WatchCallSummary starts watching for a summary in the satellite transcripts table.
func WatchCallSummary(c *gin.Context) {
	var req SummaryWatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, structs.Map(models.StatusBadRequest{
			Code:    http.StatusBadRequest,
			Message: "invalid request payload",
			Data:    err.Error(),
		}))
		return
	}

	uniqueIDHint := strings.TrimSpace(req.UniqueID)
	linkedID := strings.TrimSpace(req.LinkedID)
	if uniqueIDHint == "" {
		c.JSON(http.StatusBadRequest, structs.Map(models.StatusBadRequest{
			Code:    http.StatusBadRequest,
			Message: "uniqueid is required",
			Data:    nil,
		}))
		return
	}

	if !summary.IsSatelliteDBConfigured() {
		c.JSON(http.StatusServiceUnavailable, structs.Map(models.StatusServiceUnavailable{
			Code:    http.StatusServiceUnavailable,
			Message: "satellite database not configured",
			Data:    nil,
		}))
		return
	}

	username, err := getUsernameFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, structs.Map(models.StatusUnauthorized{
			Code:    http.StatusUnauthorized,
			Message: "unauthorized",
			Data:    nil,
		}))
		return
	}

	uniqueID, _, _, ok, err := ensureUserParticipatedInCall(c, uniqueIDHint, linkedID)
	if err != nil {
		if errors.Is(err, errUnauthorized) {
			c.JSON(http.StatusUnauthorized, structs.Map(models.StatusUnauthorized{
				Code:    http.StatusUnauthorized,
				Message: "unauthorized",
				Data:    nil,
			}))
			return
		}
		logs.Log("[ERROR][SUMMARY] Failed to validate CDR participation for watch uniqueid " + uniqueIDHint + ": " + err.Error())
		c.JSON(http.StatusServiceUnavailable, structs.Map(models.StatusServiceUnavailable{
			Code:    http.StatusServiceUnavailable,
			Message: "cdr database unavailable",
			Data:    nil,
		}))
		return
	}
	if !ok {
		logForbiddenParticipation(c, uniqueIDHint)
		c.JSON(http.StatusForbidden, structs.Map(models.StatusForbidden{
			Code:    http.StatusForbidden,
			Message: "forbidden: user not part of call",
			Data:    nil,
		}))
		return
	}

	startResult := startSummaryWatchFunc(uniqueID, linkedID, username)
	if startResult != summary.WatchStarted {
		message := "watch unavailable"
		switch startResult {
		case summary.WatchAlreadyActive:
			logs.Log("[INFO][SUMMARY] Watch already active for user " + username + " uniqueid: " + uniqueID)
			message = "watch already active"
		case summary.WatchMisconfigured:
			logs.Log("[WARNING][SUMMARY] Watch unavailable due to missing configuration for user " + username + " uniqueid: " + uniqueID)
			message = "watch unavailable: missing configuration"
		default:
			logs.Log("[WARNING][SUMMARY] Watch unavailable due to invalid input for user " + username + " uniqueid: " + uniqueID)
			message = "watch unavailable"
		}
		c.JSON(http.StatusOK, structs.Map(models.StatusOK{
			Code:    http.StatusOK,
			Message: message,
			Data:    nil,
		}))
		return
	}

	logs.Log("[INFO][SUMMARY] Watch started for user " + username + " uniqueid: " + uniqueID)
	c.JSON(http.StatusAccepted, structs.Map(models.StatusOK{
		Code:    http.StatusAccepted,
		Message: "watch started",
		Data:    nil,
	}))
}

// CheckSummaryByUniqueID verifies whether a non-deleted summary exists for the given uniqueid.
// It is intended for HEAD endpoints and returns status only (no response body).
func CheckSummaryByUniqueID(c *gin.Context) {
	uniqueIDHint := getUniqueIDFromPath(c)
	linkedID := getLinkedIDFromQuery(c)
	if uniqueIDHint == "" {
		c.Status(http.StatusBadRequest)
		return
	}

	if !summary.IsSatelliteDBConfigured() {
		c.Status(http.StatusServiceUnavailable)
		return
	}

	uniqueID, _, _, ok, err := ensureUserParticipatedInCall(c, uniqueIDHint, linkedID)
	if err != nil {
		if errors.Is(err, errUnauthorized) {
			c.Status(http.StatusUnauthorized)
			return
		}
		logs.Log("[ERROR][SUMMARY] Failed to validate CDR participation for uniqueid " + uniqueIDHint + ": " + err.Error())
		c.Status(http.StatusServiceUnavailable)
		return
	}
	if !ok {
		logForbiddenParticipation(c, uniqueIDHint)
		c.Status(http.StatusForbidden)
		return
	}

	state, hasSummary, _, exists, err := fetchSummaryStateFunc(uniqueID)
	if err != nil {
		if isSatelliteSchemaMissingError(err) {
			logs.Log("[WARNING][SUMMARY] Satellite schema is not initialized while checking summary for uniqueid " + uniqueID + ": " + err.Error())
			c.Status(http.StatusServiceUnavailable)
			return
		}
		if isSatelliteDBUnavailableError(err) {
			logs.Log("[WARNING][SUMMARY] Satellite database is unavailable while checking summary for uniqueid " + uniqueID + ": " + err.Error())
			c.Status(http.StatusServiceUnavailable)
			return
		}

		logs.Log("[ERROR][SUMMARY] Failed to fetch summary for uniqueid " + uniqueID + ": " + err.Error())
		c.Status(http.StatusInternalServerError)
		return
	}

	foundRecord := exists
	keepWaiting := shouldKeepWaitingForSummary(state)

	if hasSummary {
		c.Status(http.StatusOK)
		return
	}

	if keepWaiting {
		c.Status(http.StatusNoContent)
		return
	}

	if !foundRecord {
		if linkedID != "" {
			c.Status(http.StatusNoContent)
			return
		}
		c.Status(http.StatusNotFound)
		return
	}

	c.Status(http.StatusNotFound)
}

func shouldKeepWaitingForSummary(state string) bool {
	switch strings.TrimSpace(state) {
	case "progress", "summarizing":
		return true
	default:
		return false
	}
}

// GetSummaryByUniqueID returns the summary for the given uniqueid.
func GetSummaryByUniqueID(c *gin.Context) {
	uniqueIDHint := getUniqueIDFromPath(c)
	linkedID := getLinkedIDFromQuery(c)
	if uniqueIDHint == "" {
		c.JSON(http.StatusBadRequest, structs.Map(models.StatusBadRequest{
			Code:    http.StatusBadRequest,
			Message: "uniqueid is required",
			Data:    nil,
		}))
		return
	}

	if !summary.IsSatelliteDBConfigured() {
		c.JSON(http.StatusServiceUnavailable, structs.Map(models.StatusServiceUnavailable{
			Code:    http.StatusServiceUnavailable,
			Message: "satellite database not configured",
			Data:    nil,
		}))
		return
	}

	uniqueID, phoneNumbers, excludedSrcNums, ok, err := ensureUserParticipatedInCall(c, uniqueIDHint, linkedID)
	if err != nil {
		if errors.Is(err, errUnauthorized) {
			c.JSON(http.StatusUnauthorized, structs.Map(models.StatusUnauthorized{
				Code:    http.StatusUnauthorized,
				Message: "unauthorized",
				Data:    nil,
			}))
			return
		}
		logs.Log("[ERROR][SUMMARY] Failed to validate CDR participation for uniqueid " + uniqueIDHint + ": " + err.Error())
		c.JSON(http.StatusServiceUnavailable, structs.Map(models.StatusServiceUnavailable{
			Code:    http.StatusServiceUnavailable,
			Message: "cdr database unavailable",
			Data:    nil,
		}))
		return
	}
	// Switchboard supervisors (cdr.ad_cdr) may read any call's transcript via ?id,
	// so they are not blocked by the per-call participation gate.
	sbAllowed := switchboardDrawerAllowed(c)
	if !ok && !sbAllowed {
		logForbiddenParticipation(c, uniqueIDHint)
		c.JSON(http.StatusForbidden, structs.Map(models.StatusForbidden{
			Code:    http.StatusForbidden,
			Message: "forbidden: user not part of call",
			Data:    nil,
		}))
		return
	}

	// When a specific transcript id is requested, fetch that exact conversation
	// (disambiguates the legs of an attended transfer that share a uniqueid);
	// otherwise pick the best transcript for the uniqueid as before.
	var details *SummaryDrawer
	var found bool
	if transcriptID := getTranscriptIDFromQuery(c); transcriptID > 0 {
		details, found, err = fetchSummaryDrawerByIDFunc(transcriptID, phoneNumbers, sbAllowed)
	} else {
		details, found, err = fetchSummaryDrawerFunc(uniqueID, phoneNumbers, excludedSrcNums)
	}
	if err != nil {
		if isSatelliteSchemaMissingError(err) {
			logs.Log("[WARNING][SUMMARY] Satellite schema is not initialized while fetching summary for uniqueid " + uniqueID + ": " + err.Error())
			writeSatelliteSchemaMissingResponse(c)
			return
		}
		if isSatelliteDBUnavailableError(err) {
			logs.Log("[WARNING][SUMMARY] Satellite database is unavailable while fetching summary for uniqueid " + uniqueID + ": " + err.Error())
			writeSatelliteDBUnavailableResponse(c)
			return
		}

		logs.Log("[ERROR][SUMMARY] Failed to fetch summary for uniqueid " + uniqueID + ": " + err.Error())
		c.JSON(http.StatusInternalServerError, structs.Map(models.StatusInternalServerError{
			Code:    http.StatusInternalServerError,
			Message: "failed to fetch summary",
			Data:    nil,
		}))
		return
	}

	if !found {
		c.JSON(http.StatusNotFound, structs.Map(models.StatusNotFound{
			Code:    http.StatusNotFound,
			Message: "summary not found",
			Data:    nil,
		}))
		return
	}

	c.JSON(http.StatusOK, models.StatusOK{
		Code:    http.StatusOK,
		Message: "success",
		Data:    details,
	})
}

// UpdateSummaryByUniqueID updates the summary for the given uniqueid.
func UpdateSummaryByUniqueID(c *gin.Context) {
	uniqueIDHint := getUniqueIDFromPath(c)
	linkedID := getLinkedIDFromQuery(c)
	if uniqueIDHint == "" {
		c.JSON(http.StatusBadRequest, structs.Map(models.StatusBadRequest{
			Code:    http.StatusBadRequest,
			Message: "uniqueid is required",
			Data:    nil,
		}))
		return
	}

	var req SummaryUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, structs.Map(models.StatusBadRequest{
			Code:    http.StatusBadRequest,
			Message: "invalid request payload",
			Data:    err.Error(),
		}))
		return
	}

	summaryText := strings.TrimSpace(req.Summary)
	if summaryText == "" {
		c.JSON(http.StatusBadRequest, structs.Map(models.StatusBadRequest{
			Code:    http.StatusBadRequest,
			Message: "summary is required",
			Data:    nil,
		}))
		return
	}

	if !summary.IsSatelliteDBConfigured() {
		c.JSON(http.StatusServiceUnavailable, structs.Map(models.StatusServiceUnavailable{
			Code:    http.StatusServiceUnavailable,
			Message: "satellite database not configured",
			Data:    nil,
		}))
		return
	}

	uniqueID, _, _, ok, err := ensureUserParticipatedInCall(c, uniqueIDHint, linkedID)
	if err != nil {
		if errors.Is(err, errUnauthorized) {
			c.JSON(http.StatusUnauthorized, structs.Map(models.StatusUnauthorized{
				Code:    http.StatusUnauthorized,
				Message: "unauthorized",
				Data:    nil,
			}))
			return
		}
		logs.Log("[ERROR][SUMMARY] Failed to validate CDR participation for uniqueid " + uniqueIDHint + ": " + err.Error())
		c.JSON(http.StatusServiceUnavailable, structs.Map(models.StatusServiceUnavailable{
			Code:    http.StatusServiceUnavailable,
			Message: "cdr database unavailable",
			Data:    nil,
		}))
		return
	}
	// Switchboard supervisors (cdr.ad_cdr) may edit any call's summary via ?id,
	// so they are not blocked by the per-call participation gate.
	sbAllowed := switchboardDrawerAllowed(c)
	if !ok && !sbAllowed {
		logForbiddenParticipation(c, uniqueIDHint)
		c.JSON(http.StatusForbidden, structs.Map(models.StatusForbidden{
			Code:    http.StatusForbidden,
			Message: "forbidden: user not part of call",
			Data:    nil,
		}))
		return
	}

	// When a specific transcript id is given, update that exact conversation
	// (so editing one transfer leg's summary does not overwrite the other).
	var updated bool
	if transcriptID := getTranscriptIDFromQuery(c); transcriptID > 0 {
		phoneNumbers, _ := getUserPhoneNumbersFromContext(c)
		updated, err = updateSummaryByIDFunc(transcriptID, summaryText, phoneNumbers, sbAllowed)
	} else {
		updated, err = updateSummaryFunc(uniqueID, summaryText)
	}
	if err != nil {
		if isSatelliteSchemaMissingError(err) {
			logs.Log("[WARNING][SUMMARY] Satellite schema is not initialized while updating summary for uniqueid " + uniqueID + ": " + err.Error())
			writeSatelliteSchemaMissingResponse(c)
			return
		}
		if isSatelliteDBUnavailableError(err) {
			logs.Log("[WARNING][SUMMARY] Satellite database is unavailable while updating summary for uniqueid " + uniqueID + ": " + err.Error())
			writeSatelliteDBUnavailableResponse(c)
			return
		}

		logs.Log("[ERROR][SUMMARY] Failed to update summary for uniqueid " + uniqueID + ": " + err.Error())
		c.JSON(http.StatusInternalServerError, structs.Map(models.StatusInternalServerError{
			Code:    http.StatusInternalServerError,
			Message: "failed to update summary",
			Data:    nil,
		}))
		return
	}

	if !updated {
		c.JSON(http.StatusNotFound, structs.Map(models.StatusNotFound{
			Code:    http.StatusNotFound,
			Message: "summary not found",
			Data:    nil,
		}))
		return
	}

	c.JSON(http.StatusOK, structs.Map(models.StatusOK{
		Code:    http.StatusOK,
		Message: "summary updated",
		Data: gin.H{
			"uniqueid": uniqueID,
			"summary":  summaryText,
		},
	}))
}

// ListSummaryStatus returns the list of summary/transcription status for user's calls.
func ListSummaryStatus(c *gin.Context) {
	if !summary.IsSatelliteDBConfigured() {
		c.JSON(http.StatusServiceUnavailable, structs.Map(models.StatusServiceUnavailable{
			Code:    http.StatusServiceUnavailable,
			Message: "satellite database not configured",
			Data:    nil,
		}))
		return
	}

	lookups, err := extractSummaryStatusLookups(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, structs.Map(models.StatusBadRequest{
			Code:    http.StatusBadRequest,
			Message: "invalid request payload",
			Data:    err.Error(),
		}))
		return
	}

	if len(lookups) == 0 {
		c.JSON(http.StatusBadRequest, structs.Map(models.StatusBadRequest{
			Code:    http.StatusBadRequest,
			Message: "uniqueids is required",
			Data:    nil,
		}))
		return
	}

	resolvedLookups, err := resolveSummaryStatusLookups(c, lookups)
	if err != nil {
		if errors.Is(err, errUnauthorized) {
			c.JSON(http.StatusUnauthorized, structs.Map(models.StatusUnauthorized{
				Code:    http.StatusUnauthorized,
				Message: "unauthorized",
				Data:    nil,
			}))
			return
		}

		logs.Log("[ERROR][SUMMARY] Failed to validate CDR participation for statuses: " + err.Error())
		c.JSON(http.StatusServiceUnavailable, structs.Map(models.StatusServiceUnavailable{
			Code:    http.StatusServiceUnavailable,
			Message: "cdr database unavailable",
			Data:    nil,
		}))
		return
	}

	resolvedUniqueIDs := collectResolvedUniqueIDs(resolvedLookups)
	items, err := fetchSummaryListFunc(resolvedUniqueIDs)
	if err != nil {
		if isSatelliteSchemaMissingError(err) {
			logs.Log("[WARNING][SUMMARY] Satellite schema is not initialized while listing summary statuses: " + err.Error())
			writeSatelliteSchemaMissingResponse(c)
			return
		}
		if isSatelliteDBUnavailableError(err) {
			logs.Log("[WARNING][SUMMARY] Satellite database is unavailable while listing summary statuses: " + err.Error())
			writeSatelliteDBUnavailableResponse(c)
			return
		}

		logs.Log("[ERROR][SUMMARY] Failed to list summaries: " + err.Error())
		c.JSON(http.StatusInternalServerError, structs.Map(models.StatusInternalServerError{
			Code:    http.StatusInternalServerError,
			Message: "failed to list summaries",
			Data:    nil,
		}))
		return
	}

	itemByUniqueID := make(map[string]SummaryListItem, len(items))
	for _, item := range items {
		itemByUniqueID[item.UniqueID] = item
	}

	result := make([]interface{}, 0, len(resolvedLookups))
	presentKeys := make(map[string]bool)
	for _, lookup := range resolvedLookups {
		if item, ok := itemByUniqueID[lookup.ResolvedUniqueID]; ok {
			item.LinkedID = lookup.LinkedID
			// Use the requested uniqueid so the frontend can match
			// the response entry to the correct history row.
			if lookup.UniqueID != "" {
				item.UniqueID = lookup.UniqueID
			}
			result = append(result, item)
			presentKeys[conversationKey(lookup.LinkedID, item.SrcNumber, item.DstNumber)] = true
			continue
		}
		reportedUniqueID := lookup.UniqueID
		if reportedUniqueID == "" {
			reportedUniqueID = lookup.ResolvedUniqueID
		}
		result = append(result, gin.H{
			"uniqueid": reportedUniqueID,
			"linkedid": lookup.LinkedID,
			"error":    "not_found",
		})
	}

	// Surface the extra conversations to render as their own rows. Personal view:
	// the legs the user took part in (e.g. a transfer consultation). Switchboard
	// view (only if the user holds the cdr.ad_cdr capability): every conversation
	// of the calls, regardless of participant.
	switchboard := false
	if c.GetBool("summaryStatusSwitchboard") {
		if username, uerr := getUsernameFromContext(c); uerr == nil {
			switchboard = userHasSwitchboardCapability(username)
		}
	}
	result = appendParticipatedConversations(c, resolvedLookups, presentKeys, result, switchboard)

	c.JSON(http.StatusOK, structs.Map(models.StatusOK{
		Code:    http.StatusOK,
		Message: "success",
		Data:    result,
	}))
}

// appendParticipatedConversations adds, to the status result, the conversations
// under the requested linkedids in which the user participated and that are not
// already represented by a requested row. Failures are non-fatal: extra
// discovery never breaks the base response.
func appendParticipatedConversations(c *gin.Context, resolvedLookups []resolvedSummaryStatusLookup, presentKeys map[string]bool, result []interface{}, switchboard bool) []interface{} {
	linkedIDs := distinctLinkedIDs(resolvedLookups)
	if len(linkedIDs) == 0 {
		return result
	}

	var conversations []SummaryListItem
	var err error
	if switchboard {
		// Supervisor view: every conversation of the calls, regardless of who
		// took part. Already authorized by the cdr.ad_cdr capability check.
		conversations, err = fetchAllConversationsByLinkedIDsFunc(linkedIDs)
	} else {
		phoneNumbers, perr := getUserPhoneNumbersFromContext(c)
		if perr != nil || len(phoneNumbers) == 0 {
			return result
		}
		conversations, err = fetchParticipatedConversationsFunc(linkedIDs, phoneNumbers)
	}
	if err != nil {
		logs.Log("[WARNING][SUMMARY] Failed to fetch extra conversations: " + err.Error())
		return result
	}

	for _, conv := range conversations {
		// Only surface legs where an actual conversation happened.
		if !conv.HasTranscription {
			continue
		}
		if !switchboard {
			// Personal view: skip the conversation already represented by the
			// requested history row.
			key := conversationKey(conv.LinkedID, conv.SrcNumber, conv.DstNumber)
			if presentKeys[key] {
				continue
			}
			presentKeys[key] = true
		}
		// Switchboard returns every conversation as its own row (query is
		// DISTINCT per conversation, so no duplicates).
		conv.Extra = true
		result = append(result, conv)
	}

	return result
}

func conversationKey(linkedID, src, dst string) string {
	return strings.TrimSpace(linkedID) + "|" + strings.TrimSpace(src) + "|" + strings.TrimSpace(dst)
}

func distinctLinkedIDs(lookups []resolvedSummaryStatusLookup) []string {
	seen := make(map[string]bool)
	out := make([]string, 0)
	for _, l := range lookups {
		lid := strings.TrimSpace(l.LinkedID)
		if lid == "" || seen[lid] {
			continue
		}
		seen[lid] = true
		out = append(out, lid)
	}
	return out
}

func extractSummaryStatusLookups(c *gin.Context) ([]SummaryStatusLookup, error) {
	var req struct {
		UniqueIDs   []string              `json:"uniqueids"`
		Lookups     []SummaryStatusLookup `json:"lookups"`
		Switchboard bool                  `json:"switchboard"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		return nil, err
	}
	// Remember the requested scope; honoured only if the user is authorized
	// (see ListSummaryStatus).
	c.Set("summaryStatusSwitchboard", req.Switchboard)

	if len(req.Lookups) > 0 {
		return normalizeSummaryStatusLookups(req.Lookups), nil
	}

	if len(req.UniqueIDs) == 0 {
		return []SummaryStatusLookup{}, nil
	}

	normalizedUniqueIDs := normalizeLookupIDs(req.UniqueIDs)
	lookups := make([]SummaryStatusLookup, 0, len(normalizedUniqueIDs))
	for _, uniqueID := range normalizedUniqueIDs {
		lookups = append(lookups, SummaryStatusLookup{UniqueID: uniqueID})
	}
	return lookups, nil
}

func writeSatelliteSchemaMissingResponse(c *gin.Context) {
	c.JSON(http.StatusServiceUnavailable, structs.Map(models.StatusServiceUnavailable{
		Code:    http.StatusServiceUnavailable,
		Message: "satellite database schema not initialized",
		Data: gin.H{
			"missing_table": "transcripts",
		},
	}))
}

func writeSatelliteDBUnavailableResponse(c *gin.Context) {
	c.JSON(http.StatusServiceUnavailable, structs.Map(models.StatusServiceUnavailable{
		Code:    http.StatusServiceUnavailable,
		Message: "satellite database unavailable",
		Data: gin.H{
			"reason": "connection_unavailable",
		},
	}))
}

func isSatelliteSchemaMissingError(err error) bool {
	if err == nil {
		return false
	}

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "42P01"
	}

	return strings.Contains(err.Error(), "SQLSTATE 42P01")
}

func isSatelliteDBUnavailableError(err error) bool {
	if err == nil {
		return false
	}

	if errors.Is(err, sql.ErrConnDone) {
		return true
	}

	errText := err.Error()
	return strings.Contains(errText, "connection refused") ||
		strings.Contains(errText, "connect: connection refused") ||
		strings.Contains(errText, "failed to connect")
}

func normalizeSummaryStatusLookups(lookups []SummaryStatusLookup) []SummaryStatusLookup {
	cleaned := make([]SummaryStatusLookup, 0, len(lookups))
	seen := make(map[string]struct{})

	for _, lookup := range lookups {
		normalized := SummaryStatusLookup{
			UniqueID: strings.TrimSpace(lookup.UniqueID),
			LinkedID: strings.TrimSpace(lookup.LinkedID),
		}
		if normalized.UniqueID == "" && normalized.LinkedID == "" {
			continue
		}

		key := normalized.UniqueID
		if key == "" {
			key = normalized.LinkedID
		}
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		cleaned = append(cleaned, normalized)
	}

	return cleaned
}

func resolveSummaryStatusLookups(c *gin.Context, lookups []SummaryStatusLookup) ([]resolvedSummaryStatusLookup, error) {
	phoneNumbers, err := getUserPhoneNumbersFromContext(c)
	if err != nil {
		return nil, err
	}

	if len(phoneNumbers) == 0 {
		return []resolvedSummaryStatusLookup{}, nil
	}

	resolved := make([]resolvedSummaryStatusLookup, 0, len(lookups))
	for _, lookup := range lookups {
		resolvedUniqueID, ok, err := resolveAuthorizedUniqueID(lookup.UniqueID, lookup.LinkedID, phoneNumbers)
		if err != nil {
			return nil, err
		}

		entry := resolvedSummaryStatusLookup{
			UniqueID:         lookup.UniqueID,
			LinkedID:         lookup.LinkedID,
			ResolvedUniqueID: resolvedUniqueID,
		}
		if !ok {
			entry.ResolvedUniqueID = ""
		}
		resolved = append(resolved, entry)
	}

	return resolved, nil
}

func collectResolvedUniqueIDs(lookups []resolvedSummaryStatusLookup) []string {
	collected := make([]string, 0, len(lookups))
	seen := make(map[string]struct{})

	for _, lookup := range lookups {
		if lookup.ResolvedUniqueID == "" {
			continue
		}
		if _, exists := seen[lookup.ResolvedUniqueID]; exists {
			continue
		}
		seen[lookup.ResolvedUniqueID] = struct{}{}
		collected = append(collected, lookup.ResolvedUniqueID)
	}

	return collected
}

func normalizeLookupIDs(lookupIDs []string) []string {
	cleaned := make([]string, 0, len(lookupIDs))
	seen := make(map[string]struct{})

	for _, id := range lookupIDs {
		for _, candidate := range strings.Split(id, ",") {
			value := strings.TrimSpace(candidate)
			if value == "" {
				continue
			}
			if _, exists := seen[value]; exists {
				continue
			}
			seen[value] = struct{}{}
			cleaned = append(cleaned, value)
		}
	}

	return cleaned
}

func fetchSummaryDrawerFromDB(uniqueID string, phoneNumbers []string, excludedSrcNums []string) (*SummaryDrawer, bool, error) {
	database := db.GetSatelliteDB()
	if database == nil {
		return nil, false, sql.ErrConnDone
	}

	queryCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	args := []interface{}{uniqueID}
	phoneStart := 2
	for _, phoneNumber := range phoneNumbers {
		args = append(args, phoneNumber)
	}

	excludeStart := phoneStart + len(phoneNumbers)
	for _, excludedSrcNum := range excludedSrcNums {
		args = append(args, excludedSrcNum)
	}

	orderBy := "updated_at DESC, id DESC"
	if len(phoneNumbers) > 0 {
		phonePlaceholders := buildPostgresPlaceholders(len(phoneNumbers), phoneStart)
		srcClause := fmt.Sprintf("(src_number IN (%s)) DESC", phonePlaceholders)
		dstClause := fmt.Sprintf("(dst_number IN (%s)) DESC", phonePlaceholders)
		if len(excludedSrcNums) > 0 {
			excludePlaceholders := buildPostgresPlaceholders(len(excludedSrcNums), excludeStart)
			notExcludedClause := fmt.Sprintf("(src_number NOT IN (%s)) DESC", excludePlaceholders)
			orderBy = srcClause + ", " + notExcludedClause + ", " + dstClause + ", " + orderBy
		} else {
			orderBy = srcClause + ", " + dstClause + ", " + orderBy
		}
	}

	query := fmt.Sprintf(`
		SELECT uniqueid, summary, sentiment, state, cleaned_transcription, raw_transcription, created_at, updated_at, deleted_at
		FROM transcripts
		WHERE uniqueid = $1 AND deleted_at IS NULL
		ORDER BY %s
		LIMIT 1`, orderBy)

	var (
		dbUniqueID  string
		dbSummary   sql.NullString
		dbSentiment sql.NullInt16
		dbState     string
		dbCleaned   sql.NullString
		dbRaw       sql.NullString
		dbCreatedAt time.Time
		dbUpdatedAt time.Time
		dbDeletedAt sql.NullTime
	)

	if err := database.QueryRowContext(queryCtx, query, args...).Scan(
		&dbUniqueID,
		&dbSummary,
		&dbSentiment,
		&dbState,
		&dbCleaned,
		&dbRaw,
		&dbCreatedAt,
		&dbUpdatedAt,
		&dbDeletedAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, false, nil
		}
		return nil, false, err
	}

	if !dbSummary.Valid || strings.TrimSpace(dbSummary.String) == "" {
		return nil, false, nil
	}

	if dbDeletedAt.Valid {
		return nil, false, nil
	}

	var sentiment *int
	if dbSentiment.Valid {
		value := int(dbSentiment.Int16)
		sentiment = &value
	}

	var deletedAt *time.Time
	if dbDeletedAt.Valid {
		value := dbDeletedAt.Time
		deletedAt = &value
	}

	callMeta, err := fetchSummaryCDRFields(uniqueID)
	if err != nil {
		return nil, false, err
	}
	callTimestamp := alignCallTimestampLocation(callMeta.CallTimestamp, &dbCreatedAt)

	return &SummaryDrawer{
		UniqueID:      dbUniqueID,
		Summary:       strings.TrimSpace(dbSummary.String),
		Sentiment:     sentiment,
		State:         dbState,
		Src:           callMeta.Src,
		Dst:           callMeta.Dst,
		CNam:          callMeta.CNam,
		Company:       callMeta.Company,
		DstCompany:    callMeta.DstCompany,
		DstCNam:       callMeta.DstCNam,
		CallTimestamp: callTimestamp,
		CreatedAt:     dbCreatedAt,
		UpdatedAt:     dbUpdatedAt,
		DeletedAt:     deletedAt,
	}, true, nil
}

func fetchSummaryListFromDB(uniqueIDs []string) ([]SummaryListItem, error) {
	if len(uniqueIDs) == 0 {
		return []SummaryListItem{}, nil
	}

	database := db.GetSatelliteDB()
	if database == nil {
		return nil, sql.ErrConnDone
	}

	queryCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	placeholders := buildPostgresPlaceholders(len(uniqueIDs), 1)
	query := fmt.Sprintf(`
		SELECT DISTINCT ON (uniqueid) id, uniqueid, cleaned_transcription, raw_transcription, summary, state, src_number, dst_number, updated_at
		FROM transcripts
		WHERE deleted_at IS NULL AND uniqueid IN (%s)
		ORDER BY uniqueid, updated_at DESC, id DESC`, placeholders)

	args := make([]interface{}, 0, len(uniqueIDs))
	for _, id := range uniqueIDs {
		args = append(args, id)
	}

	rows, err := database.QueryContext(queryCtx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]SummaryListItem, 0)
	for rows.Next() {
		var (
			dbID        int64
			dbUniqueID  string
			dbCleaned   sql.NullString
			dbRaw       sql.NullString
			dbSummary   sql.NullString
			dbState     string
			dbSrc       sql.NullString
			dbDst       sql.NullString
			dbUpdatedAt time.Time
		)

		if err := rows.Scan(&dbID, &dbUniqueID, &dbCleaned, &dbRaw, &dbSummary, &dbState, &dbSrc, &dbDst, &dbUpdatedAt); err != nil {
			return nil, err
		}

		hasTranscription := false
		if dbCleaned.Valid && strings.TrimSpace(dbCleaned.String) != "" {
			hasTranscription = true
		} else if dbRaw.Valid && strings.TrimSpace(dbRaw.String) != "" {
			hasTranscription = true
		}

		hasSummary := dbSummary.Valid && strings.TrimSpace(dbSummary.String) != ""

		updatedAt := dbUpdatedAt
		items = append(items, SummaryListItem{
			ID:               dbID,
			UniqueID:         dbUniqueID,
			State:            dbState,
			HasTranscription: hasTranscription,
			HasSummary:       hasSummary,
			SrcNumber:        strings.TrimSpace(dbSrc.String),
			DstNumber:        strings.TrimSpace(dbDst.String),
			UpdatedAt:        &updatedAt,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return items, nil
}

// fetchParticipatedConversationsFromDB returns every non-deleted transcript under
// the given linkedids in which the user (one of phoneNumbers) is a participant
// (matches src_number or dst_number). Attended/blind transfers produce several
// conversations under one linkedid (e.g. consultation A<->B and post-transfer
// C<->B): each is a distinct row here, so a participant sees all the legs they
// actually took part in. Rows are de-duplicated per (uniqueid, src, dst) keeping
// the newest, which collapses retry-duplicates without hiding distinct legs.
func fetchParticipatedConversationsFromDB(linkedIDs []string, phoneNumbers []string) ([]SummaryListItem, error) {
	if len(linkedIDs) == 0 || len(phoneNumbers) == 0 {
		return []SummaryListItem{}, nil
	}

	database := db.GetSatelliteDB()
	if database == nil {
		return nil, sql.ErrConnDone
	}

	queryCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	linkedPlaceholders := buildPostgresPlaceholders(len(linkedIDs), 1)
	srcPlaceholders := buildPostgresPlaceholders(len(phoneNumbers), 1+len(linkedIDs))
	dstPlaceholders := buildPostgresPlaceholders(len(phoneNumbers), 1+len(linkedIDs)+len(phoneNumbers))

	query := fmt.Sprintf(`
		SELECT DISTINCT ON (uniqueid, src_number, dst_number)
			id, uniqueid, linkedid, cleaned_transcription, raw_transcription, summary, state, src_number, dst_number, duration_seconds, updated_at
		FROM transcripts
		WHERE deleted_at IS NULL
			AND linkedid IN (%s)
			AND (src_number IN (%s) OR dst_number IN (%s))
		ORDER BY uniqueid, src_number, dst_number, updated_at DESC, id DESC`,
		linkedPlaceholders, srcPlaceholders, dstPlaceholders)

	args := make([]interface{}, 0, len(linkedIDs)+2*len(phoneNumbers))
	for _, id := range linkedIDs {
		args = append(args, id)
	}
	for _, p := range phoneNumbers {
		args = append(args, p)
	}
	for _, p := range phoneNumbers {
		args = append(args, p)
	}

	rows, err := database.QueryContext(queryCtx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]SummaryListItem, 0)
	for rows.Next() {
		var (
			dbID        int64
			dbUniqueID  string
			dbLinkedID  sql.NullString
			dbCleaned   sql.NullString
			dbRaw       sql.NullString
			dbSummary   sql.NullString
			dbState     string
			dbSrc       sql.NullString
			dbDst       sql.NullString
			dbDuration  sql.NullInt64
			dbUpdatedAt time.Time
		)

		if err := rows.Scan(&dbID, &dbUniqueID, &dbLinkedID, &dbCleaned, &dbRaw, &dbSummary, &dbState, &dbSrc, &dbDst, &dbDuration, &dbUpdatedAt); err != nil {
			return nil, err
		}

		hasTranscription := (dbCleaned.Valid && strings.TrimSpace(dbCleaned.String) != "") ||
			(dbRaw.Valid && strings.TrimSpace(dbRaw.String) != "")
		hasSummary := dbSummary.Valid && strings.TrimSpace(dbSummary.String) != ""

		updatedAt := dbUpdatedAt
		item := SummaryListItem{
			ID:               dbID,
			LinkedID:         strings.TrimSpace(dbLinkedID.String),
			UniqueID:         dbUniqueID,
			State:            dbState,
			HasTranscription: hasTranscription,
			HasSummary:       hasSummary,
			SrcNumber:        strings.TrimSpace(dbSrc.String),
			DstNumber:        strings.TrimSpace(dbDst.String),
			UpdatedAt:        &updatedAt,
		}
		if dbDuration.Valid {
			d := int(dbDuration.Int64)
			item.DurationSeconds = &d
		}
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return items, nil
}

// userHasSwitchboardCapability reports whether the user may view the switchboard
// (all-extensions) CDR — and therefore the transcripts of any call, not just
// the ones they took part in.
func userHasSwitchboardCapability(username string) bool {
	if username == "" {
		return false
	}
	caps, err := store.GetUserCapabilities(username)
	if err != nil {
		return false
	}
	return caps["cdr.ad_cdr"]
}

// switchboardDrawerAllowed reports whether the request asked for the switchboard
// scope (?switchboard=true) AND the user is authorized for it (cdr.ad_cdr).
func switchboardDrawerAllowed(c *gin.Context) bool {
	if c.Query("switchboard") != "true" {
		return false
	}
	username, err := getUsernameFromContext(c)
	if err != nil {
		return false
	}
	return userHasSwitchboardCapability(username)
}

// fetchAllConversationsByLinkedIDsFromDB returns every non-deleted transcript
// under the given linkedids, regardless of participant. Used for the switchboard
// (supervisor) view, where the caller is authorized to see all conversations.
func fetchAllConversationsByLinkedIDsFromDB(linkedIDs []string) ([]SummaryListItem, error) {
	if len(linkedIDs) == 0 {
		return []SummaryListItem{}, nil
	}

	database := db.GetSatelliteDB()
	if database == nil {
		return nil, sql.ErrConnDone
	}

	queryCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	placeholders := buildPostgresPlaceholders(len(linkedIDs), 1)
	query := fmt.Sprintf(`
		SELECT DISTINCT ON (uniqueid, src_number, dst_number)
			id, uniqueid, linkedid, cleaned_transcription, raw_transcription, summary, state, src_number, dst_number, duration_seconds, updated_at
		FROM transcripts
		WHERE deleted_at IS NULL AND linkedid IN (%s)
		ORDER BY uniqueid, src_number, dst_number, updated_at DESC, id DESC`, placeholders)

	args := make([]interface{}, 0, len(linkedIDs))
	for _, id := range linkedIDs {
		args = append(args, id)
	}

	rows, err := database.QueryContext(queryCtx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]SummaryListItem, 0)
	for rows.Next() {
		var (
			dbID        int64
			dbUniqueID  string
			dbLinkedID  sql.NullString
			dbCleaned   sql.NullString
			dbRaw       sql.NullString
			dbSummary   sql.NullString
			dbState     string
			dbSrc       sql.NullString
			dbDst       sql.NullString
			dbDuration  sql.NullInt64
			dbUpdatedAt time.Time
		)
		if err := rows.Scan(&dbID, &dbUniqueID, &dbLinkedID, &dbCleaned, &dbRaw, &dbSummary, &dbState, &dbSrc, &dbDst, &dbDuration, &dbUpdatedAt); err != nil {
			return nil, err
		}
		hasTranscription := (dbCleaned.Valid && strings.TrimSpace(dbCleaned.String) != "") ||
			(dbRaw.Valid && strings.TrimSpace(dbRaw.String) != "")
		hasSummary := dbSummary.Valid && strings.TrimSpace(dbSummary.String) != ""
		updatedAt := dbUpdatedAt
		item := SummaryListItem{
			ID:               dbID,
			LinkedID:         strings.TrimSpace(dbLinkedID.String),
			UniqueID:         dbUniqueID,
			State:            dbState,
			HasTranscription: hasTranscription,
			HasSummary:       hasSummary,
			SrcNumber:        strings.TrimSpace(dbSrc.String),
			DstNumber:        strings.TrimSpace(dbDst.String),
			UpdatedAt:        &updatedAt,
		}
		if dbDuration.Valid {
			d := int(dbDuration.Int64)
			item.DurationSeconds = &d
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

// phoneNumberMatches reports whether value equals one of the user's phone numbers.
func phoneNumberMatches(value string, phoneNumbers []string) bool {
	value = strings.TrimSpace(value)
	if value == "" {
		return false
	}
	for _, p := range phoneNumbers {
		if strings.TrimSpace(p) == value {
			return true
		}
	}
	return false
}

// fetchSummaryDrawerByID returns the summary of one specific transcript row,
// identified by its database id. This disambiguates conversations that share an
// Asterisk uniqueid (e.g. the consultation and post-transfer legs of an attended
// transfer). The caller must be a party of the conversation (IDOR guard).
func fetchSummaryDrawerByID(id int64, phoneNumbers []string, bypassParty bool) (*SummaryDrawer, bool, error) {
	database := db.GetSatelliteDB()
	if database == nil {
		return nil, false, sql.ErrConnDone
	}

	queryCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var (
		dbUniqueID  string
		dbSummary   sql.NullString
		dbSentiment sql.NullInt16
		dbState     string
		dbSrc       sql.NullString
		dbDst       sql.NullString
		dbCreatedAt time.Time
		dbUpdatedAt time.Time
		dbDeletedAt sql.NullTime
	)

	query := `SELECT uniqueid, summary, sentiment, state, src_number, dst_number, created_at, updated_at, deleted_at
		FROM transcripts WHERE id = $1 AND deleted_at IS NULL LIMIT 1`
	if err := database.QueryRowContext(queryCtx, query, id).Scan(
		&dbUniqueID, &dbSummary, &dbSentiment, &dbState, &dbSrc, &dbDst, &dbCreatedAt, &dbUpdatedAt, &dbDeletedAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, false, nil
		}
		return nil, false, err
	}

	// IDOR guard: only a participant of this conversation may read it, unless the
	// caller is authorized for the switchboard (all-calls) view.
	if !bypassParty && !phoneNumberMatches(dbSrc.String, phoneNumbers) && !phoneNumberMatches(dbDst.String, phoneNumbers) {
		return nil, false, nil
	}
	if !dbSummary.Valid || strings.TrimSpace(dbSummary.String) == "" {
		return nil, false, nil
	}

	var sentiment *int
	if dbSentiment.Valid {
		value := int(dbSentiment.Int16)
		sentiment = &value
	}

	callMeta, err := fetchSummaryCDRFields(dbUniqueID)
	if err != nil {
		return nil, false, err
	}
	callTimestamp := alignCallTimestampLocation(callMeta.CallTimestamp, &dbCreatedAt)

	// Prefer the conversation's own parties (from the transcript) for the header.
	src := callMeta.Src
	dst := callMeta.Dst
	if strings.TrimSpace(dbSrc.String) != "" {
		src = strings.TrimSpace(dbSrc.String)
	}
	if strings.TrimSpace(dbDst.String) != "" {
		dst = strings.TrimSpace(dbDst.String)
	}

	return &SummaryDrawer{
		UniqueID:      dbUniqueID,
		Summary:       strings.TrimSpace(dbSummary.String),
		Sentiment:     sentiment,
		State:         dbState,
		Src:           src,
		Dst:           dst,
		CNam:          callMeta.CNam,
		Company:       callMeta.Company,
		DstCompany:    callMeta.DstCompany,
		DstCNam:       callMeta.DstCNam,
		CallTimestamp: callTimestamp,
		CreatedAt:     dbCreatedAt,
		UpdatedAt:     dbUpdatedAt,
	}, true, nil
}

func fetchSummaryStateFromDB(uniqueID string) (string, bool, bool, bool, error) {
	database := db.GetSatelliteDB()
	if database == nil {
		return "", false, false, false, sql.ErrConnDone
	}

	queryCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var (
		state     sql.NullString
		summary   sql.NullString
		cleaned   sql.NullString
		raw       sql.NullString
		deletedAt sql.NullTime
	)

	query := "SELECT state, summary, cleaned_transcription, raw_transcription, deleted_at FROM transcripts WHERE uniqueid = $1 AND deleted_at IS NULL ORDER BY updated_at DESC, id DESC LIMIT 1"
	if err := database.QueryRowContext(queryCtx, query, uniqueID).Scan(&state, &summary, &cleaned, &raw, &deletedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", false, false, false, nil
		}
		return "", false, false, false, err
	}

	if deletedAt.Valid {
		return "", false, false, false, nil
	}

	cleanState := strings.TrimSpace(state.String)
	hasSummary := summary.Valid && strings.TrimSpace(summary.String) != ""
	hasTranscription := (cleaned.Valid && strings.TrimSpace(cleaned.String) != "") ||
		(raw.Valid && strings.TrimSpace(raw.String) != "")

	return cleanState, hasSummary, hasTranscription, true, nil
}

func fetchSummaryFromDB(uniqueID string) (string, bool, error) {
	database := db.GetSatelliteDB()
	if database == nil {
		return "", false, sql.ErrConnDone
	}

	queryCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var summaryText sql.NullString
	query := "SELECT summary FROM transcripts WHERE uniqueid = $1 AND deleted_at IS NULL ORDER BY updated_at DESC, id DESC LIMIT 1"
	err := database.QueryRowContext(queryCtx, query, uniqueID).Scan(&summaryText)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", false, nil
		}
		return "", false, err
	}

	if !summaryText.Valid || strings.TrimSpace(summaryText.String) == "" {
		return "", false, nil
	}

	return summaryText.String, true, nil
}

// updateSummaryByID updates the summary of one specific transcript row,
// identified by its id, only if the requester is a party of that conversation.
// Used to edit a single transfer leg without overwriting the other.
func updateSummaryByID(id int64, summaryText string, phoneNumbers []string, bypassParty bool) (bool, error) {
	database := db.GetSatelliteDB()
	if database == nil {
		return false, sql.ErrConnDone
	}
	if !bypassParty && len(phoneNumbers) == 0 {
		return false, nil
	}

	queryCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var query string
	args := make([]interface{}, 0, 2+len(phoneNumbers))
	args = append(args, summaryText, id)
	if bypassParty {
		// Switchboard supervisor: edit the exact row regardless of participant.
		query = `UPDATE transcripts SET summary = $1 WHERE id = $2 AND deleted_at IS NULL`
	} else {
		phonePlaceholders := buildPostgresPlaceholders(len(phoneNumbers), 3)
		query = fmt.Sprintf(`UPDATE transcripts SET summary = $1
			WHERE id = $2 AND deleted_at IS NULL
			AND (src_number IN (%s) OR dst_number IN (%s))`, phonePlaceholders, phonePlaceholders)
		for _, p := range phoneNumbers {
			args = append(args, p)
		}
	}

	result, err := database.ExecContext(queryCtx, query, args...)
	if err != nil {
		return false, err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return false, err
	}
	return affected > 0, nil
}

func updateSummaryInDB(uniqueID, summaryText string) (bool, error) {
	database := db.GetSatelliteDB()
	if database == nil {
		return false, sql.ErrConnDone
	}

	queryCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	query := `
		WITH canonical AS (
			SELECT id FROM transcripts WHERE uniqueid = $2 AND deleted_at IS NULL ORDER BY updated_at DESC, id DESC LIMIT 1
		)
		UPDATE transcripts SET summary = $1 WHERE id IN (SELECT id FROM canonical)`
	result, err := database.ExecContext(queryCtx, query, summaryText, uniqueID)
	if err != nil {
		return false, err
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return false, err
	}

	return affected > 0, nil
}

func fetchSummaryCDRFields(uniqueID string) (*CallMetadata, error) {
	database := db.GetCDRDB()
	if database == nil {
		return nil, sql.ErrConnDone
	}

	queryCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	callMeta, err := fetchCallMetadataFromCDR(queryCtx, database, uniqueID)
	if err != nil {
		return nil, err
	}
	return callMeta, nil
}

func fetchCallMetadataFromCDR(queryCtx context.Context, database *sql.DB, uniqueID string) (*CallMetadata, error) {
	var (
		src        sql.NullString
		dst        sql.NullString
		cnam       sql.NullString
		company    sql.NullString
		dstCompany sql.NullString
		dstCNam    sql.NullString
		callDate   sql.NullTime
	)

	query := "SELECT src, dst, cnam, company, dst_company, dst_cnam, calldate FROM cdr WHERE uniqueid = ? ORDER BY calldate DESC LIMIT 1"
	err := database.QueryRowContext(queryCtx, query, uniqueID).Scan(&src, &dst, &cnam, &company, &dstCompany, &dstCNam, &callDate)
	if err != nil && isMissingColumnError(err) {
		query = "SELECT src, dst, cnam, dst_cnam, calldate FROM cdr WHERE uniqueid = ? ORDER BY calldate DESC LIMIT 1"
		err = database.QueryRowContext(queryCtx, query, uniqueID).Scan(&src, &dst, &cnam, &dstCNam, &callDate)
	}
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return &CallMetadata{}, nil
		}
		return nil, err
	}

	var callTimestamp *time.Time
	if callDate.Valid {
		value := callDate.Time
		callTimestamp = &value
	}

	return &CallMetadata{
		Src:           strings.TrimSpace(src.String),
		Dst:           strings.TrimSpace(dst.String),
		CNam:          strings.TrimSpace(cnam.String),
		Company:       strings.TrimSpace(company.String),
		DstCompany:    strings.TrimSpace(dstCompany.String),
		DstCNam:       strings.TrimSpace(dstCNam.String),
		CallTimestamp: callTimestamp,
	}, nil
}

func isMissingColumnError(err error) bool {
	return strings.Contains(strings.ToLower(err.Error()), "unknown column")
}

func alignCallTimestampLocation(callTimestamp *time.Time, reference *time.Time) *time.Time {
	if callTimestamp == nil || reference == nil {
		return callTimestamp
	}

	value := time.Date(
		callTimestamp.Year(),
		callTimestamp.Month(),
		callTimestamp.Day(),
		callTimestamp.Hour(),
		callTimestamp.Minute(),
		callTimestamp.Second(),
		callTimestamp.Nanosecond(),
		reference.Location(),
	)

	return &value
}

func buildPostgresPlaceholders(count int, startIndex int) string {
	if count <= 0 {
		return ""
	}
	placeholders := make([]string, 0, count)
	for i := 0; i < count; i++ {
		placeholders = append(placeholders, fmt.Sprintf("$%d", startIndex+i))
	}
	return strings.Join(placeholders, ",")
}
