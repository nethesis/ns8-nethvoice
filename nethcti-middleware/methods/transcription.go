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
	"sort"
	"strings"
	"time"

	jwt "github.com/appleboy/gin-jwt/v3"
	"github.com/fatih/structs"
	"github.com/gin-gonic/gin"

	"github.com/nethesis/nethcti-middleware/db"
	"github.com/nethesis/nethcti-middleware/logs"
	"github.com/nethesis/nethcti-middleware/models"
	"github.com/nethesis/nethcti-middleware/store"
	"github.com/nethesis/nethcti-middleware/summary"
)

var (
	getUserInfoFunc                                                           = GetUserInfo
	fetchTranscriptionFunc                                                    = fetchTranscriptionFromDB
	fetchTranscriptionByIDFunc                                                = fetchTranscriptionByID
	fetchTranscriptionMetaFunc                                                = fetchTranscriptionMetadataFromCDR
	checkUserParticipationFunc                                                = checkUserParticipationInCDR
	checkUserParticipationByLinkedIDFunc                                      = checkUserParticipationByLinkedIDInCDR
	resolveLinkedIDToUniqueIDFunc                                             = resolveUniqueIDByLinkedIDForUserInCDR
	discoverLinkedIDFromCDRFunc                                               = discoverLinkedIDFromCDR
	checkSatelliteRecordExistsFunc       func(string) (bool, bool, error)     = checkSatelliteRecordExists
	checkSatelliteParticipationFunc      func(string, []string) (bool, error) = checkSatelliteParticipation
	findSatelliteUniqueIDsByLinkedIDFunc                                      = findSatelliteUniqueIDsByLinkedID
	getExternalPartiesFromCDRFunc                                             = getExternalPartiesFromCDR
	getExternalSrcNumsFromCDRFunc        func(string, []string) ([]string, error) = getExternalSrcNumsFromCDR
	isCDRAnsweredFunc                                                         = isCDRAnswered
	checkSrcEqualsDstFunc                func(string, []string) (bool, error) = checkSrcEqualsDstInCDR
)

var errUnauthorized = errors.New("unauthorized")

type TranscriptionDrawer struct {
	UniqueID      string     `json:"uniqueid"`
	Transcription string     `json:"transcription"`
	Src           string     `json:"src,omitempty"`
	CNum          string     `json:"cnum,omitempty"`
	CNam          string     `json:"cnam,omitempty"`
	Company       string     `json:"company,omitempty"`
	CCompany      string     `json:"ccompany,omitempty"`
	DstCompany    string     `json:"dst_company,omitempty"`
	DstCNam       string     `json:"dst_cnam,omitempty"`
	Dst           string     `json:"dst,omitempty"`
	CallTimestamp *time.Time `json:"call_timestamp,omitempty"`
	CreatedAt     *time.Time `json:"created_at"`
}

// GetTranscriptionByUniqueID returns the transcription for the given uniqueid.
func GetTranscriptionByUniqueID(c *gin.Context) {
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
		logs.Log("[ERROR][TRANSCRIPTS] Failed to validate CDR participation for uniqueid " + uniqueIDHint + ": " + err.Error())
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

	// A specific transcript id fetches that exact conversation (disambiguates the
	// legs of an attended transfer that share a uniqueid); otherwise pick the best
	// transcript for the uniqueid as before.
	var transcription string
	var createdAt *time.Time
	var found bool
	if transcriptID := getTranscriptIDFromQuery(c); transcriptID > 0 {
		transcription, createdAt, found, err = fetchTranscriptionByIDFunc(transcriptID, phoneNumbers, sbAllowed)
	} else {
		transcription, createdAt, found, err = fetchTranscriptionFunc(uniqueID, phoneNumbers, excludedSrcNums)
	}
	if err != nil {
		if isSatelliteSchemaMissingError(err) {
			logs.Log("[WARNING][TRANSCRIPTS] Satellite schema is not initialized while fetching transcription for uniqueid " + uniqueID + ": " + err.Error())
			writeSatelliteSchemaMissingResponse(c)
			return
		}
		if isSatelliteDBUnavailableError(err) {
			logs.Log("[WARNING][TRANSCRIPTS] Satellite database is unavailable while fetching transcription for uniqueid " + uniqueID + ": " + err.Error())
			writeSatelliteDBUnavailableResponse(c)
			return
		}

		logs.Log("[ERROR][TRANSCRIPTS] Failed to fetch transcription for uniqueid " + uniqueID + ": " + err.Error())
		c.JSON(http.StatusInternalServerError, structs.Map(models.StatusInternalServerError{
			Code:    http.StatusInternalServerError,
			Message: "failed to fetch transcription",
			Data:    nil,
		}))
		return
	}

	if !found {
		c.JSON(http.StatusNotFound, structs.Map(models.StatusNotFound{
			Code:    http.StatusNotFound,
			Message: "transcription not found",
			Data:    nil,
		}))
		return
	}

	callMeta, err := fetchTranscriptionMetaFunc(uniqueID)
	if err != nil {
		logs.Log("[ERROR][TRANSCRIPTS] Failed to fetch CDR metadata for uniqueid " + uniqueID + ": " + err.Error())
		c.JSON(http.StatusServiceUnavailable, structs.Map(models.StatusServiceUnavailable{
			Code:    http.StatusServiceUnavailable,
			Message: "cdr database unavailable",
			Data:    nil,
		}))
		return
	}

	c.JSON(http.StatusOK, structs.Map(models.StatusOK{
		Code:    http.StatusOK,
		Message: "success",
		Data: gin.H{
			"uniqueid":       uniqueID,
			"transcription":  transcription,
			"src":            callMeta.Src,
			"cnum":           callMeta.Src,
			"cnam":           callMeta.CNam,
			"company":        callMeta.Company,
			"ccompany":       callMeta.Company,
			"dst_company":    callMeta.DstCompany,
			"dst_cnam":       callMeta.DstCNam,
			"dst":            callMeta.Dst,
			"call_timestamp": alignCallTimestampLocation(callMeta.CallTimestamp, createdAt),
			"created_at":     createdAt,
		},
	}))
}

func getLinkedIDFromQuery(c *gin.Context) string {
	return strings.TrimSpace(c.Query("linkedid"))
}

func getUserPhoneNumbersFromContext(c *gin.Context) ([]string, error) {
	username, err := getUsernameFromContext(c)
	if err != nil {
		return nil, err
	}

	userSession := store.UserSessions[username]
	if userSession == nil || strings.TrimSpace(userSession.NethCTIToken) == "" {
		logs.Log("[WARNING][TRANSCRIPTS] Missing user session or token for user " + username)
		return nil, errUnauthorized
	}

	userInfo, err := getUserInfoFunc(userSession.NethCTIToken)
	if err != nil {
		logs.Log("[ERROR][TRANSCRIPTS] Failed to load user info for user " + username + ": " + err.Error())
		return nil, err
	}

	return userInfo.PhoneNumbers, nil
}

func resolveAuthorizedUniqueID(uniqueID string, linkedID string, phoneNumbers []string) (string, bool, error) {
	resolvedUniqueID, _, ok, err := resolveAuthorizedUniqueIDFull(uniqueID, linkedID, phoneNumbers)
	return resolvedUniqueID, ok, err
}

func resolveAuthorizedUniqueIDFull(uniqueID string, linkedID string, phoneNumbers []string) (string, []string, bool, error) {
	if len(phoneNumbers) == 0 {
		return "", nil, false, nil
	}

	// Skip NO ANSWER rows — the user never actually talked on this leg
	// (e.g., a queue ring that wasn't picked up). No transcription to show.
	if uniqueID != "" {
		answered, err := isCDRAnsweredFunc(uniqueID)
		if err != nil {
			logs.Log("[WARNING][RESOLVE] CDR disposition check failed for uniqueid " + uniqueID + ": " + err.Error())
		} else if !answered {
			return "", nil, false, nil
		}
	}

	// Discover linkedID from CDR when not provided by the client.
	// This handles older clients and queue/transfer calls where the frontend
	// only knows the initial leg's uniqueID.
	if linkedID == "" && uniqueID != "" {
		discovered, err := discoverLinkedIDFromCDRFunc(uniqueID)
		if err != nil {
			return "", nil, false, err
		}
		if discovered != "" {
			linkedID = discovered
		}
	}

	// Step 1: Direct satellite match + CDR/satellite participation.
	// Fast path for the common case (direct calls with content).
	var directMatchEmpty bool
	if uniqueID != "" {
		exists, hasContent, err := checkSatelliteRecordExistsFunc(uniqueID)
		if err != nil {
			logs.Log("[WARNING][RESOLVE] satellite check failed for uniqueid " + uniqueID + ": " + err.Error())
		} else if exists {
			ok, err := checkUserParticipationFunc(uniqueID, phoneNumbers)
			if err != nil {
				return "", nil, false, err
			}
			if !ok {
				// CDR doesn't show this user — check satellite src/dst
				// (handles consultation segments where CDR has dst='s').
				satOk, satErr := checkSatelliteParticipationFunc(uniqueID, phoneNumbers)
				if satErr != nil {
					logs.Log("[WARNING][RESOLVE] satellite participation check failed for uniqueid " + uniqueID + ": " + satErr.Error())
				}
				ok = satOk
			}
			if ok {
				if hasContent {
					return uniqueID, nil, true, nil
				}
				directMatchEmpty = true
			}
			// If satellite has content but user is NOT a participant (neither
			// CDR nor satellite), don't reject yet — fall through to Step 2
			// which may find a related segment (e.g., consultation) the user
			// DID participate in.
		}
	}

	// Lazy computation of the requested CDR row's external parties.
	// Used in Steps 2 and 3 to prevent cross-segment contamination:
	// a satellite record is only matched if it shares at least one non-user
	// party (e.g., the external caller) with the requested CDR row.
	var requestedExternals map[string]struct{}
	var externalsComputed bool
	getRequestedExternals := func() map[string]struct{} {
		if !externalsComputed {
			externalsComputed = true
			if uniqueID != "" {
				ext, err := getExternalPartiesFromCDRFunc(uniqueID, phoneNumbers)
				if err == nil {
					requestedExternals = ext
				}
			}
		}
		return requestedExternals
	}

	// Lazy detection of Local channel ;1 routing artifacts.
	// A routing artifact has src == dst == user extension in CDR (e.g., 202→202).
	// The actual satellite transcript lives on the paired ;2 leg under the same
	// linkedid, so the external-party cross-check must be bypassed for these rows.
	var localRoutingComputed bool
	var localRoutingArtifact bool
	getIsLocalRoutingArtifact := func() bool {
		if !localRoutingComputed {
			localRoutingComputed = true
			if len(getRequestedExternals()) == 0 && uniqueID != "" {
				localRoutingArtifact, _ = checkSrcEqualsDstFunc(uniqueID, phoneNumbers)
			}
		}
		return localRoutingArtifact
	}

	// Step 2: Satellite lookup by linkedid + per-record participation check.
	// For transfers/queues, the satellite record may be stored under a different
	// uniqueid than the CDR row the user sees in history. We find all satellite
	// records sharing the same linkedid, then pick the one where the user
	// actually participated AND that belongs to the same call segment.
	//
	// Two passes:
	// Pass A — consultation segments: the user participates but the segment has
	//   no external party in CDR (e.g., dst='s'). These are transfer consultation
	//   calls that the user should see.
	// Pass B — main call segments: the user participates AND external parties
	//   match the requested CDR row. This prevents cross-segment contamination.
	if linkedID != "" {
		satUIDs, err := findSatelliteUniqueIDsByLinkedIDFunc(linkedID)
		if err != nil {
			logs.Log("[WARNING][RESOLVE] satellite linkedid lookup failed for linkedid " + linkedID + ": " + err.Error())
		} else if len(satUIDs) > 0 {
			// Pass A: consultation segments (no external parties in CDR).
			for _, satUID := range satUIDs {
				if satUID == uniqueID {
					continue
				}
				ok, err := checkUserParticipationFunc(satUID, phoneNumbers)
				if err != nil {
					return "", nil, false, err
				}
				if !ok {
					satOk, _ := checkSatelliteParticipationFunc(satUID, phoneNumbers)
					ok = satOk
				}
				if !ok {
					continue
				}
				candidateExternals, _ := getExternalPartiesFromCDRFunc(satUID, phoneNumbers)
				if len(candidateExternals) == 0 {
					// No external parties — consultation segment.
					exists, hasContent, _ := checkSatelliteRecordExistsFunc(satUID)
					if exists && hasContent {
						return satUID, nil, true, nil
					}
				}
			}

			// Pass B: main call segments (external parties match).
			for _, satUID := range satUIDs {
				if satUID == uniqueID {
					continue
				}
				ok, err := checkUserParticipationFunc(satUID, phoneNumbers)
				if err != nil {
					return "", nil, false, err
				}
				if ok {
					if !matchesExternalParties(satUID, getRequestedExternals(), phoneNumbers) {
						// Local channel ;1 routing artifacts (src==dst==user) carry no
						// satellite record of their own — the transcript belongs to the
						// paired ;2 leg. Bypass the external-party check and accept the
						// candidate if it has satellite content.
						if !getIsLocalRoutingArtifact() {
							continue
						}
						exists, hasContent, _ := checkSatelliteRecordExistsFunc(satUID)
						if !exists || !hasContent {
							continue
						}
						// Use only the CDR src column (not cnum) to build excludedSrcNums.
						// cnum carries the original caller across the whole chain and would
						// accidentally exclude the consultation segment (src=201) when 201
						// is the cnum of the ;2 CDR row.
						excludedSrcNums, err := getExternalSrcNumsFromCDRFunc(satUID, phoneNumbers)
						if err != nil {
							logs.Log("[WARNING][RESOLVE] external-src lookup failed for routing artifact uniqueid " + satUID + ": " + err.Error())
						}
						return satUID, excludedSrcNums, true, nil
					}
					return satUID, nil, true, nil
				}
			}
		}
	}

	// Step 1 found an empty match and Step 2 found nothing better.
	// Return the empty match — the call segment existed but had no speech.
	if directMatchEmpty {
		return uniqueID, nil, true, nil
	}

	// Step 3: CDR-only fallback for calls where no satellite record exists yet
	// (e.g., transcription still in progress). Resolve the user's specific
	// leg rather than just checking chain-wide participation.
	if linkedID != "" {
		resolvedUniqueID, err := resolveLinkedIDToUniqueIDFunc(linkedID, phoneNumbers)
		if err != nil {
			return "", nil, false, err
		}
		if resolvedUniqueID != "" {
			if matchesExternalParties(resolvedUniqueID, getRequestedExternals(), phoneNumbers) ||
				getIsLocalRoutingArtifact() {
				return resolvedUniqueID, nil, true, nil
			}
		}
	}

	// Step 4: Direct uniqueID participation check (no linkedid available).
	if uniqueID != "" {
		ok, err := checkUserParticipationFunc(uniqueID, phoneNumbers)
		if err != nil {
			return "", nil, false, err
		}
		if !ok {
			return "", nil, false, nil
		}
		return uniqueID, nil, true, nil
	}

	return "", nil, false, nil
}

func getExternalPartiesSliceFromCDR(uniqueID string, phoneNumbers []string) ([]string, error) {
	externals, err := getExternalPartiesFromCDRFunc(uniqueID, phoneNumbers)
	if err != nil {
		return nil, err
	}
	if len(externals) == 0 {
		return nil, nil
	}

	values := make([]string, 0, len(externals))
	for external := range externals {
		values = append(values, external)
	}
	sort.Strings(values)

	return values, nil
}

// getExternalSrcNumsFromCDR returns only the CDR src values for the given
// uniqueid that are not in the user's phone number set.
// Unlike getExternalPartiesFromCDR, it deliberately ignores cnum.
// cnum carries the original caller across the whole transfer chain, so
// including it would accidentally mark consultation-leg sources (e.g. 201)
// as excluded when they appear as cnum in the ;2 CDR row.
func getExternalSrcNumsFromCDR(uniqueID string, phoneNumbers []string) ([]string, error) {
	if uniqueID == "" || len(phoneNumbers) == 0 {
		return nil, nil
	}

	database := db.GetCDRDB()
	if database == nil {
		return nil, sql.ErrConnDone
	}

	phoneSet := make(map[string]struct{}, len(phoneNumbers))
	for _, p := range phoneNumbers {
		if cleaned := strings.TrimSpace(p); cleaned != "" {
			phoneSet[cleaned] = struct{}{}
		}
	}

	queryCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	rows, err := database.QueryContext(queryCtx, "SELECT src FROM cdr WHERE uniqueid = ?", uniqueID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	seen := make(map[string]struct{})
	var result []string
	for rows.Next() {
		var src sql.NullString
		if err := rows.Scan(&src); err != nil {
			return nil, err
		}
		if !src.Valid {
			continue
		}
		v := strings.TrimSpace(src.String)
		if v == "" || v == "s" {
			continue
		}
		if _, isUser := phoneSet[v]; isUser {
			continue
		}
		if _, alreadySeen := seen[v]; alreadySeen {
			continue
		}
		seen[v] = struct{}{}
		result = append(result, v)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	sort.Strings(result)
	return result, nil
}

func ensureUserParticipatedInCall(c *gin.Context, uniqueID string, linkedID string) (string, []string, []string, bool, error) {
	phoneNumbers, err := getUserPhoneNumbersFromContext(c)
	if err != nil {
		return "", nil, nil, false, err
	}

	if len(phoneNumbers) == 0 {
		username, _ := getUsernameFromContext(c)
		logs.Log("[WARNING][TRANSCRIPTS] No phone numbers for user " + username + " (uniqueid: " + uniqueID + ", linkedid: " + linkedID + ")")
		return "", phoneNumbers, nil, false, nil
	}

	resolvedUniqueID, excludedSrcNums, ok, err := resolveAuthorizedUniqueIDFull(uniqueID, linkedID, phoneNumbers)
	return resolvedUniqueID, phoneNumbers, excludedSrcNums, ok, err
}

func logForbiddenParticipation(c *gin.Context, uniqueID string) {
	username, err := getUsernameFromContext(c)
	if err != nil {
		logs.Log("[WARNING][TRANSCRIPTS] Forbidden participation check without valid user (uniqueid: " + uniqueID + ")")
		return
	}

	userSession := store.UserSessions[username]
	if userSession == nil || strings.TrimSpace(userSession.NethCTIToken) == "" {
		logs.Log("[WARNING][TRANSCRIPTS] Forbidden participation: missing session for user " + username + " (uniqueid: " + uniqueID + ")")
		return
	}

	userInfo, err := getUserInfoFunc(userSession.NethCTIToken)
	if err != nil {
		logs.Log("[WARNING][TRANSCRIPTS] Forbidden participation: failed to load user info for user " + username + " (uniqueid: " + uniqueID + "): " + err.Error())
		return
	}

	logs.Log("[INFO][TRANSCRIPTS] Forbidden participation: user " + username + " (uniqueid: " + uniqueID + ") numbers: " + strings.Join(userInfo.PhoneNumbers, ", "))
}

func getUsernameFromContext(c *gin.Context) (string, error) {
	claims := jwt.ExtractClaims(c)
	username, ok := claims["id"].(string)
	if !ok || username == "" {
		return "", errUnauthorized
	}
	return username, nil
}

// fetchTranscriptionByID returns the transcription of one specific transcript
// row, identified by its database id. Disambiguates conversations that share an
// Asterisk uniqueid (attended-transfer legs). The caller must be a party of the
// conversation (IDOR guard).
func fetchTranscriptionByID(id int64, phoneNumbers []string, bypassParty bool) (string, *time.Time, bool, error) {
	database := db.GetSatelliteDB()
	if database == nil {
		return "", nil, false, sql.ErrConnDone
	}

	queryCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var (
		cleaned   sql.NullString
		raw       sql.NullString
		createdAt sql.NullTime
		src       sql.NullString
		dst       sql.NullString
	)

	query := "SELECT cleaned_transcription, raw_transcription, created_at, src_number, dst_number FROM transcripts WHERE id = $1 AND deleted_at IS NULL LIMIT 1"
	if err := database.QueryRowContext(queryCtx, query, id).Scan(&cleaned, &raw, &createdAt, &src, &dst); err != nil {
		if err == sql.ErrNoRows {
			return "", nil, false, nil
		}
		return "", nil, false, err
	}

	// IDOR guard: only a participant may read it, unless authorized for the
	// switchboard (all-calls) view.
	if !bypassParty && !phoneNumberMatches(src.String, phoneNumbers) && !phoneNumberMatches(dst.String, phoneNumbers) {
		return "", nil, false, nil
	}

	var createdAtPtr *time.Time
	if createdAt.Valid {
		createdAtPtr = &createdAt.Time
	}
	if cleaned.Valid {
		if t := strings.TrimSpace(cleaned.String); t != "" {
			return t, createdAtPtr, true, nil
		}
	}
	if raw.Valid {
		if t := strings.TrimSpace(raw.String); t != "" {
			return t, createdAtPtr, true, nil
		}
	}
	return "", createdAtPtr, false, nil
}

func fetchTranscriptionFromDB(uniqueID string, phoneNumbers []string, excludedSrcNums []string) (string, *time.Time, bool, error) {
	database := db.GetSatelliteDB()
	if database == nil {
		return "", nil, false, sql.ErrConnDone
	}

	queryCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var cleaned sql.NullString
	var raw sql.NullString
	var createdAt sql.NullTime

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

	query := fmt.Sprintf("SELECT cleaned_transcription, raw_transcription, created_at FROM transcripts WHERE uniqueid = $1 AND deleted_at IS NULL ORDER BY %s LIMIT 1", orderBy)
	err := database.QueryRowContext(queryCtx, query, args...).Scan(&cleaned, &raw, &createdAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", nil, false, nil
		}
		return "", nil, false, err
	}

	var createdAtPtr *time.Time
	if createdAt.Valid {
		createdAtPtr = &createdAt.Time
	}

	if cleaned.Valid {
		cleanedText := strings.TrimSpace(cleaned.String)
		if cleanedText != "" {
			return cleanedText, createdAtPtr, true, nil
		}
	}

	if raw.Valid {
		rawText := strings.TrimSpace(raw.String)
		if rawText != "" {
			return rawText, createdAtPtr, true, nil
		}
	}

	return "", createdAtPtr, false, nil
}

func fetchTranscriptionMetadataFromCDR(uniqueID string) (*CallMetadata, error) {
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

func checkUserParticipationInCDR(uniqueID string, phoneNumbers []string) (bool, error) {
	if uniqueID == "" || len(phoneNumbers) == 0 {
		return false, nil
	}

	database := db.GetCDRDB()
	if database == nil {
		return false, sql.ErrConnDone
	}

	phoneSet := make(map[string]struct{}, len(phoneNumbers))
	for _, number := range phoneNumbers {
		cleaned := strings.TrimSpace(number)
		if cleaned != "" {
			phoneSet[cleaned] = struct{}{}
		}
	}
	if len(phoneSet) == 0 {
		return false, nil
	}

	queryCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Only check src and dst — NOT cnum. The cnum field preserves the
	// originating extension even after a transfer, making the transfer
	// initiator appear as a participant in post-transfer CDR rows.
	rows, err := database.QueryContext(queryCtx, "SELECT src, dst FROM cdr WHERE uniqueid = ?", uniqueID)
	if err != nil {
		return false, err
	}
	defer rows.Close()

	for rows.Next() {
		var src, dst sql.NullString
		if err := rows.Scan(&src, &dst); err != nil {
			return false, err
		}

		for _, val := range []sql.NullString{src, dst} {
			if val.Valid {
				if _, ok := phoneSet[strings.TrimSpace(val.String)]; ok {
					return true, nil
				}
			}
		}
	}

	if err := rows.Err(); err != nil {
		return false, err
	}

	return false, nil
}

// isCDRAnswered checks whether the CDR row for the given uniqueID has
// disposition 'ANSWERED' with duration > 0. Returns false for unanswered
// legs (queue rings) and zero-duration routing artifacts (Local channel
// CDR entries like src=202 dst=202 dur=0).
func isCDRAnswered(uniqueID string) (bool, error) {
	if uniqueID == "" {
		return false, nil
	}

	database := db.GetCDRDB()
	if database == nil {
		return false, sql.ErrConnDone
	}

	queryCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var disposition string
	err := database.QueryRowContext(queryCtx,
		"SELECT disposition FROM cdr WHERE uniqueid = ? AND disposition = 'ANSWERED' AND duration > 0 LIMIT 1",
		uniqueID).Scan(&disposition)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

// checkUserParticipationByLinkedIDInCDR checks whether any leg of the call chain
// identified by linkedID has the user's phone number as src, dst, or cnum. This is the
// correct check for transferred calls and queue calls, where multiple CDR rows
// share the same linkedid. cnum is also checked to handle outbound calls where src
// contains the trunk CallerID instead of the originating extension.
func checkUserParticipationByLinkedIDInCDR(linkedID string, phoneNumbers []string) (bool, error) {
	if linkedID == "" || len(phoneNumbers) == 0 {
		return false, nil
	}

	database := db.GetCDRDB()
	if database == nil {
		return false, sql.ErrConnDone
	}

	phoneSet := make(map[string]struct{}, len(phoneNumbers))
	for _, number := range phoneNumbers {
		cleaned := strings.TrimSpace(number)
		if cleaned != "" {
			phoneSet[cleaned] = struct{}{}
		}
	}
	if len(phoneSet) == 0 {
		return false, nil
	}

	queryCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	rows, err := database.QueryContext(queryCtx, "SELECT src, dst, cnum FROM cdr WHERE linkedid = ?", linkedID)
	if err != nil {
		return false, err
	}
	defer rows.Close()

	for rows.Next() {
		var src, dst, cnum sql.NullString
		if err := rows.Scan(&src, &dst, &cnum); err != nil {
			return false, err
		}

		for _, val := range []sql.NullString{src, dst, cnum} {
			if val.Valid {
				if _, ok := phoneSet[strings.TrimSpace(val.String)]; ok {
					return true, nil
				}
			}
		}
	}

	if err := rows.Err(); err != nil {
		return false, err
	}

	return false, nil
}

func resolveUniqueIDByLinkedIDForUserInCDR(linkedID string, phoneNumbers []string) (string, error) {
	if linkedID == "" || len(phoneNumbers) == 0 {
		return "", nil
	}

	database := db.GetCDRDB()
	if database == nil {
		return "", sql.ErrConnDone
	}

	phoneSet := make(map[string]struct{}, len(phoneNumbers))
	for _, number := range phoneNumbers {
		cleaned := strings.TrimSpace(number)
		if cleaned != "" {
			phoneSet[cleaned] = struct{}{}
		}
	}
	if len(phoneSet) == 0 {
		return "", nil
	}

	queryCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	rows, err := database.QueryContext(
		queryCtx,
		`SELECT uniqueid, src, dst, cnum
		 FROM cdr
		 WHERE linkedid = ?
		 ORDER BY CASE WHEN disposition = 'ANSWERED' THEN 0 ELSE 1 END, calldate DESC`,
		linkedID,
	)
	if err != nil {
		return "", err
	}
	defer rows.Close()

	for rows.Next() {
		var uniqueID string
		var src, dst, cnum sql.NullString
		if err := rows.Scan(&uniqueID, &src, &dst, &cnum); err != nil {
			return "", err
		}

		for _, val := range []sql.NullString{src, dst, cnum} {
			if val.Valid {
				if _, ok := phoneSet[strings.TrimSpace(val.String)]; ok {
					return uniqueID, nil
				}
			}
		}
	}

	if err := rows.Err(); err != nil {
		return "", err
	}

	return "", nil
}

// discoverLinkedIDFromCDR looks up the linkedid for a given uniqueid in the CDR.
// This is used as a fallback when the client did not provide a linkedid, allowing
// the middleware to find all legs of a multi-leg call (e.g., queue or transfer calls).
func discoverLinkedIDFromCDR(uniqueID string) (string, error) {
	if uniqueID == "" {
		return "", nil
	}

	database := db.GetCDRDB()
	if database == nil {
		return "", nil
	}

	queryCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var linkedID sql.NullString
	err := database.QueryRowContext(queryCtx, "SELECT linkedid FROM cdr WHERE uniqueid = ? LIMIT 1", uniqueID).Scan(&linkedID)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", nil
		}
		return "", err
	}

	if linkedID.Valid {
		return strings.TrimSpace(linkedID.String), nil
	}
	return "", nil
}

// checkSatelliteRecordExists checks whether a non-deleted transcript record
// exists in the satellite database for the given uniqueid. Returns both
// existence and whether the record has actual transcription content.
func checkSatelliteRecordExists(uniqueID string) (bool, bool, error) {
	if uniqueID == "" {
		return false, false, nil
	}

	database := db.GetSatelliteDB()
	if database == nil {
		return false, false, sql.ErrConnDone
	}

	queryCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var hasContent bool
	err := database.QueryRowContext(queryCtx,
		`SELECT (COALESCE(raw_transcription, '') != '' OR state IN ('progress', 'summarizing'))
		 FROM transcripts WHERE uniqueid = $1 AND deleted_at IS NULL
		 ORDER BY updated_at DESC, id DESC
		 LIMIT 1`,
		uniqueID).Scan(&hasContent)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, false, nil
		}
		return false, false, err
	}
	return true, hasContent, nil
}

// checkSatelliteParticipation checks whether the satellite transcript record
// for the given uniqueid has the user's extension in src_number or dst_number.
// This is a fallback for consultation/transfer segments whose CDR rows contain
// technical values (e.g., dst='s') instead of the real participants.
func checkSatelliteParticipation(uniqueID string, phoneNumbers []string) (bool, error) {
	if uniqueID == "" || len(phoneNumbers) == 0 {
		return false, nil
	}

	database := db.GetSatelliteDB()
	if database == nil {
		return false, sql.ErrConnDone
	}

	phoneSet := make(map[string]struct{}, len(phoneNumbers))
	for _, number := range phoneNumbers {
		cleaned := strings.TrimSpace(number)
		if cleaned != "" {
			phoneSet[cleaned] = struct{}{}
		}
	}
	if len(phoneSet) == 0 {
		return false, nil
	}

	queryCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	rows, err := database.QueryContext(queryCtx,
		`SELECT src_number, dst_number FROM transcripts
		 WHERE uniqueid = $1 AND deleted_at IS NULL`, uniqueID)
	if err != nil {
		return false, err
	}
	defer rows.Close()

	for rows.Next() {
		var srcNum, dstNum sql.NullString
		if err := rows.Scan(&srcNum, &dstNum); err != nil {
			return false, err
		}
		for _, val := range []sql.NullString{srcNum, dstNum} {
			if val.Valid {
				if _, ok := phoneSet[strings.TrimSpace(val.String)]; ok {
					return true, nil
				}
			}
		}
	}

	return false, rows.Err()
}

// findSatelliteUniqueIDsByLinkedID returns the uniqueids of all non-deleted
// transcript records sharing the given linkedid. Results are ordered so that
// records with actual content come first, then by creation time (earliest first).
// This ensures that in transfer scenarios, content-bearing records are preferred
// over empty ones (e.g., unanswered queue ring legs).
func findSatelliteUniqueIDsByLinkedID(linkedID string) ([]string, error) {
	if linkedID == "" {
		return nil, nil
	}

	database := db.GetSatelliteDB()
	if database == nil {
		return nil, sql.ErrConnDone
	}

	queryCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	rows, err := database.QueryContext(queryCtx,
		`SELECT uniqueid FROM transcripts
		 WHERE linkedid = $1 AND deleted_at IS NULL
		 ORDER BY (COALESCE(raw_transcription, '') != '' OR state IN ('progress', 'summarizing')) DESC,
		          created_at ASC`,
		linkedID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var uids []string
	for rows.Next() {
		var uid string
		if err := rows.Scan(&uid); err != nil {
			return nil, err
		}
		uids = append(uids, uid)
	}
	return uids, rows.Err()
}

// getExternalPartiesFromCDR returns the set of non-user parties (src, dst, cnum)
// from CDR rows matching the given uniqueid. Used to prevent cross-segment
// contamination in transfer scenarios: two CDR rows belong to the same call
// segment if they share at least one external party (e.g., the outside caller).
func getExternalPartiesFromCDR(uniqueID string, phoneNumbers []string) (map[string]struct{}, error) {
	if uniqueID == "" {
		return map[string]struct{}{}, nil
	}

	database := db.GetCDRDB()
	if database == nil {
		return nil, sql.ErrConnDone
	}

	phoneSet := make(map[string]struct{}, len(phoneNumbers))
	for _, p := range phoneNumbers {
		if cleaned := strings.TrimSpace(p); cleaned != "" {
			phoneSet[cleaned] = struct{}{}
		}
	}

	queryCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	rows, err := database.QueryContext(queryCtx, "SELECT src, dst, cnum FROM cdr WHERE uniqueid = ?", uniqueID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	externals := make(map[string]struct{})
	for rows.Next() {
		var src, dst, cnum sql.NullString
		if err := rows.Scan(&src, &dst, &cnum); err != nil {
			return nil, err
		}
		for _, val := range []sql.NullString{src, dst, cnum} {
			if val.Valid {
				v := strings.TrimSpace(val.String)
				if v == "" || v == "s" {
					continue
				}
				if _, isUser := phoneSet[v]; !isUser {
					externals[v] = struct{}{}
				}
			}
		}
	}

	return externals, rows.Err()
}

// matchesExternalParties checks whether a candidate CDR row shares at least one
// non-user party with the requested CDR row. This prevents cross-segment
// contamination: e.g., a transfer consultation row (201→s) should not match
// a satellite record from the main call (3401234567→201) because they don't
// share an external party.
func matchesExternalParties(candidateUID string, requestedExternals map[string]struct{}, userPhones []string) bool {
	if requestedExternals == nil {
		return true // couldn't determine requested externals, allow
	}
	if len(requestedExternals) == 0 {
		return false // requested CDR has no external parties (technical row)
	}

	candidateExternals, err := getExternalPartiesFromCDRFunc(candidateUID, userPhones)
	if err != nil || candidateExternals == nil {
		return true // error fetching candidate, allow
	}
	if len(candidateExternals) == 0 {
		return false // candidate has no external parties
	}

	for ext := range candidateExternals {
		if _, ok := requestedExternals[ext]; ok {
			return true
		}
	}

	return false
}

// checkSrcEqualsDstInCDR checks whether the CDR row for uniqueID has src == dst
// and both values match a user phone number. This identifies Local channel ;1
// routing legs (e.g., src=202, dst=202) where the user extension appears as
// both caller and destination, but the actual media is tracked by satellite
// under the paired ;2 leg uniqueid.
func checkSrcEqualsDstInCDR(uniqueID string, phoneNumbers []string) (bool, error) {
	if uniqueID == "" || len(phoneNumbers) == 0 {
		return false, nil
	}

	database := db.GetCDRDB()
	if database == nil {
		return false, sql.ErrConnDone
	}

	phoneSet := make(map[string]struct{}, len(phoneNumbers))
	for _, p := range phoneNumbers {
		if cleaned := strings.TrimSpace(p); cleaned != "" {
			phoneSet[cleaned] = struct{}{}
		}
	}

	queryCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var src, dst sql.NullString
	err := database.QueryRowContext(queryCtx,
		"SELECT src, dst FROM cdr WHERE uniqueid = ? LIMIT 1",
		uniqueID).Scan(&src, &dst)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	srcVal := strings.TrimSpace(src.String)
	dstVal := strings.TrimSpace(dst.String)

	if srcVal == "" || dstVal == "" || srcVal != dstVal {
		return false, nil
	}

	_, srcIsUser := phoneSet[srcVal]
	return srcIsUser, nil
}
