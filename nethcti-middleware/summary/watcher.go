/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package summary

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"sync"
	"time"

	"github.com/nethesis/nethcti-middleware/configuration"
	"github.com/nethesis/nethcti-middleware/db"
	"github.com/nethesis/nethcti-middleware/logs"
	"github.com/nethesis/nethcti-middleware/store"
)

// SummaryMessage represents the payload sent over WebSocket when a summary is available.
type SummaryMessage struct {
	UniqueID      string `json:"uniqueid"`
	LinkedID      string `json:"linkedid,omitempty"`
	DisplayName   string `json:"display_name,omitempty"`
	DisplayNumber string `json:"display_number,omitempty"`
	Username      string `json:"-"`
}

func (m SummaryMessage) TargetUsername() string {
	return strings.TrimSpace(m.Username)
}

type watcher struct {
	mutex  sync.Mutex
	active map[string]context.CancelFunc
}

type WatchStartResult string

const (
	WatchStarted       WatchStartResult = "started"
	WatchAlreadyActive WatchStartResult = "already_active"
	WatchMisconfigured WatchStartResult = "misconfigured"
	WatchInvalidInput  WatchStartResult = "invalid_input"
)

var summaryWatcher = &watcher{active: make(map[string]context.CancelFunc)}

var fetchSummaryFunc = fetchSummaryFromDB
var fetchSummaryWatchStatusFunc = fetchSummaryWatchStatusFromDB
var fetchSummaryMetadataFunc = fetchSummaryMetadataFromCDR
var fetchUserDisplayInfoFunc = store.GetUserDisplayInfo

type notifyFunc func(SummaryMessage)

var notifySummaryFunc notifyFunc = func(SummaryMessage) {}

var summaryPollInterval = 5 * time.Second
var summaryWatchTimeout = 5 * time.Minute

func buildWatchKey(uniqueID, username string) string {
	return strings.TrimSpace(username) + ":" + strings.TrimSpace(uniqueID)
}

// StartSummaryWatch registers a watcher for the given user and unique ID.
// It returns a result that distinguishes whether the watcher started, was already active, or could not start.
func StartSummaryWatch(uniqueID, username string) WatchStartResult {
	return StartSummaryWatchWithLinkedID(uniqueID, "", username)
}

// StartSummaryWatchWithLinkedID registers a watcher and keeps the linked ID for the notification payload.
func StartSummaryWatchWithLinkedID(uniqueID, linkedID, username string) WatchStartResult {
	cleanUniqueID := strings.TrimSpace(uniqueID)
	cleanLinkedID := strings.TrimSpace(linkedID)
	if cleanLinkedID == "" {
		cleanLinkedID = cleanUniqueID
	}
	cleanUsername := strings.TrimSpace(username)
	if cleanUniqueID == "" || cleanUsername == "" {
		return WatchInvalidInput
	}

	if !IsSatelliteDBConfigured() {
		logs.Log("[ERROR][SUMMARY] Satellite DB configuration missing; cannot start watcher")
		return WatchMisconfigured
	}

	watchKey := buildWatchKey(cleanUniqueID, cleanUsername)

	summaryWatcher.mutex.Lock()
	if _, exists := summaryWatcher.active[watchKey]; exists {
		summaryWatcher.mutex.Unlock()
		return WatchAlreadyActive
	}

	ctx, cancel := context.WithTimeout(context.Background(), summaryWatchTimeout)
	summaryWatcher.active[watchKey] = cancel
	summaryWatcher.mutex.Unlock()

	go summaryWatcher.watch(ctx, cleanUniqueID, cleanLinkedID, cleanUsername)
	return WatchStarted
}

// IsSatelliteDBConfigured checks whether the satellite DB configuration is present.
func IsSatelliteDBConfigured() bool {
	return configuration.Config.SatellitePgSQLHost != "" &&
		configuration.Config.SatellitePgSQLPort != "" &&
		configuration.Config.SatellitePgSQLDB != "" &&
		configuration.Config.SatellitePgSQLUser != ""
}

// SetSummaryNotifier sets the callback used to deliver summary notifications.
func SetSummaryNotifier(fn notifyFunc) {
	if fn == nil {
		notifySummaryFunc = func(SummaryMessage) {}
		return
	}
	notifySummaryFunc = fn
}

func (w *watcher) watch(ctx context.Context, uniqueID, linkedID, username string) {
	if w.poll(uniqueID, linkedID, username) {
		return
	}

	ticker := time.NewTicker(summaryPollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			w.remove(uniqueID, username)
			logs.Log("[INFO][SUMMARY] Watch timeout reached for user " + username + " uniqueid: " + uniqueID)
			return
		case <-ticker.C:
			if w.poll(uniqueID, linkedID, username) {
				return
			}
		}
	}
}

func (w *watcher) poll(uniqueID, linkedID, username string) bool {
	_, found, err := fetchSummaryFunc(uniqueID)
	if err != nil {
		logs.Log("[ERROR][SUMMARY] Failed to fetch summary for uniqueid " + uniqueID + ": " + err.Error())
		return false
	}
	if !found {
		stop, err := fetchSummaryWatchStatusFunc(uniqueID)
		if err != nil {
			logs.Log("[ERROR][SUMMARY] Failed to fetch watch status for uniqueid " + uniqueID + ": " + err.Error())
			return false
		}
		if stop {
			w.remove(uniqueID, username)
			logs.Log("[INFO][SUMMARY] Watch stopped for user " + username + " uniqueid without summary: " + uniqueID)
			return true
		}
		return false
	}

	displayName, displayNumber := resolveSummaryDisplay(uniqueID, username)
	notifySummaryFunc(SummaryMessage{
		UniqueID:      uniqueID,
		LinkedID:      linkedID,
		DisplayName:   displayName,
		DisplayNumber: displayNumber,
		Username:      username,
	})
	w.remove(uniqueID, username)
	logs.Log("[INFO][SUMMARY] Summary found for user " + username + " uniqueid: " + uniqueID)
	return true
}

func (w *watcher) remove(uniqueID, username string) {
	watchKey := buildWatchKey(uniqueID, username)
	w.mutex.Lock()
	if cancel, exists := w.active[watchKey]; exists {
		delete(w.active, watchKey)
		cancel()
	}
	w.mutex.Unlock()
}

func fetchSummaryFromDB(uniqueID string) (string, bool, error) {
	database := db.GetSatelliteDB()
	if database == nil {
		return "", false, sql.ErrConnDone
	}

	queryCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var summary sql.NullString
	query := "SELECT summary FROM transcripts WHERE uniqueid = $1 AND deleted_at IS NULL ORDER BY updated_at DESC, id DESC LIMIT 1"
	err := database.QueryRowContext(queryCtx, query, uniqueID).Scan(&summary)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", false, nil
		}
		return "", false, err
	}

	if !summary.Valid || strings.TrimSpace(summary.String) == "" {
		return "", false, nil
	}

	return summary.String, true, nil
}

func fetchSummaryWatchStatusFromDB(uniqueID string) (bool, error) {
	database := db.GetSatelliteDB()
	if database == nil {
		return false, sql.ErrConnDone
	}

	queryCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var (
		state   sql.NullString
		summary sql.NullString
		cleaned sql.NullString
		raw     sql.NullString
	)

	query := "SELECT state, summary, cleaned_transcription, raw_transcription FROM transcripts WHERE uniqueid = $1 AND deleted_at IS NULL ORDER BY updated_at DESC, id DESC LIMIT 1"
	err := database.QueryRowContext(queryCtx, query, uniqueID).Scan(&state, &summary, &cleaned, &raw)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}
		return false, err
	}

	hasSummary := summary.Valid && strings.TrimSpace(summary.String) != ""
	hasTranscription := (cleaned.Valid && strings.TrimSpace(cleaned.String) != "") ||
		(raw.Valid && strings.TrimSpace(raw.String) != "")
	finalState := strings.TrimSpace(state.String) == "done" || strings.TrimSpace(state.String) == "failed"

	return finalState && !hasSummary && !hasTranscription, nil
}

type CallMetadata struct {
	Src     string
	Dst     string
	CNam    string
	DstCNam string
}

func resolveSummaryDisplay(uniqueID, username string) (string, string) {
	_, phoneNumbers, err := fetchUserDisplayInfoFunc(username)
	if err != nil {
		logs.Log("[WARNING][SUMMARY] Failed to load display info for user " + username + " uniqueid: " + uniqueID + ": " + err.Error())
		return "", ""
	}

	if len(phoneNumbers) == 0 {
		return "", ""
	}

	callMeta, err := fetchSummaryMetadataFunc(uniqueID)
	if err != nil {
		logs.Log("[WARNING][SUMMARY] Failed to load CDR metadata for uniqueid " + uniqueID + ": " + err.Error())
		return "", ""
	}

	if callMeta == nil {
		return "", ""
	}

	return selectCounterpartDisplay(callMeta, phoneNumbers)
}

func fetchSummaryMetadataFromCDR(uniqueID string) (*CallMetadata, error) {
	database := db.GetCDRDB()
	if database == nil {
		return nil, sql.ErrConnDone
	}

	queryCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	return fetchCallMetadataFromCDR(queryCtx, database, uniqueID)
}

func fetchCallMetadataFromCDR(queryCtx context.Context, database *sql.DB, uniqueID string) (*CallMetadata, error) {
	var (
		src     sql.NullString
		dst     sql.NullString
		cnam    sql.NullString
		dstCNam sql.NullString
	)

	query := "SELECT src, dst, cnam, dst_cnam FROM cdr WHERE uniqueid = ? ORDER BY calldate DESC LIMIT 1"
	err := database.QueryRowContext(queryCtx, query, uniqueID).Scan(&src, &dst, &cnam, &dstCNam)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return &CallMetadata{}, nil
		}
		return nil, err
	}

	return &CallMetadata{
		Src:     strings.TrimSpace(src.String),
		Dst:     strings.TrimSpace(dst.String),
		CNam:    strings.TrimSpace(cnam.String),
		DstCNam: strings.TrimSpace(dstCNam.String),
	}, nil
}

func selectCounterpartDisplay(callMeta *CallMetadata, phoneNumbers []string) (string, string) {
	if callMeta == nil {
		return "", ""
	}

	srcIsUser := phoneNumbersContain(phoneNumbers, callMeta.Src)
	dstIsUser := phoneNumbersContain(phoneNumbers, callMeta.Dst)

	switch {
	case srcIsUser && !dstIsUser:
		return buildDisplay(callMeta.DstCNam, callMeta.Dst)
	case dstIsUser && !srcIsUser:
		return buildDisplay(callMeta.CNam, callMeta.Src)
	case !srcIsUser && dstIsUser:
		return buildDisplay(callMeta.CNam, callMeta.Src)
	case srcIsUser && dstIsUser:
		if name, number := buildDisplay(callMeta.DstCNam, callMeta.Dst); name != "" || number != "" {
			return name, number
		}
		return buildDisplay(callMeta.CNam, callMeta.Src)
	default:
		if name, number := buildDisplay(callMeta.CNam, callMeta.Src); name != "" || number != "" {
			return name, number
		}
		return buildDisplay(callMeta.DstCNam, callMeta.Dst)
	}
}

func phoneNumbersContain(phoneNumbers []string, value string) bool {
	cleanValue := strings.TrimSpace(value)
	if cleanValue == "" {
		return false
	}

	for _, phoneNumber := range phoneNumbers {
		if strings.TrimSpace(phoneNumber) == cleanValue {
			return true
		}
	}

	return false
}

func buildDisplay(name, number string) (string, string) {
	cleanName := strings.TrimSpace(name)
	cleanNumber := strings.TrimSpace(number)

	if cleanName == cleanNumber {
		cleanNumber = ""
	}

	return cleanName, cleanNumber
}
