/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package summary

import (
	"context"
	"testing"
	"time"

	"github.com/nethesis/nethcti-middleware/configuration"
)

func TestStartSummaryWatchBroadcastsAndStops(t *testing.T) {
	configuration.Config.SatellitePgSQLHost = "test"
	configuration.Config.SatellitePgSQLPort = "3306"
	configuration.Config.SatellitePgSQLDB = "test"
	configuration.Config.SatellitePgSQLUser = "test"

	originalInterval := summaryPollInterval
	summaryPollInterval = 10 * time.Millisecond
	originalTimeout := summaryWatchTimeout
	summaryWatchTimeout = time.Second

	originalFetch := fetchSummaryFunc
	originalWatchStatus := fetchSummaryWatchStatusFunc
	originalFetchMetadata := fetchSummaryMetadataFunc
	originalFetchUserDisplayInfo := fetchUserDisplayInfoFunc
	originalNotify := notifySummaryFunc
	defer func() {
		fetchSummaryFunc = originalFetch
		fetchSummaryWatchStatusFunc = originalWatchStatus
		fetchSummaryMetadataFunc = originalFetchMetadata
		fetchUserDisplayInfoFunc = originalFetchUserDisplayInfo
		notifySummaryFunc = originalNotify
		summaryPollInterval = originalInterval
		summaryWatchTimeout = originalTimeout
		resetWatcher()
	}()

	called := 0
	fetchSummaryFunc = func(uniqueID string) (string, bool, error) {
		called++
		if called >= 1 {
			return "summary text", true, nil
		}
		return "", false, nil
	}
	fetchSummaryWatchStatusFunc = func(uniqueID string) (bool, error) {
		return false, nil
	}
	fetchUserDisplayInfoFunc = func(username string) (string, []string, error) {
		return "Alice", []string{"100"}, nil
	}
	fetchSummaryMetadataFunc = func(uniqueID string) (*CallMetadata, error) {
		return &CallMetadata{
			Src:     "100",
			Dst:     "+39021234567",
			DstCNam: "Mario Rossi",
		}, nil
	}

	ch := make(chan SummaryMessage, 1)
	notifySummaryFunc = func(msg SummaryMessage) {
		ch <- msg
	}

	if StartSummaryWatchWithLinkedID("abc123", "linked123", "alice") != WatchStarted {
		t.Fatalf("expected watcher to start")
	}

	select {
	case msg := <-ch:
		if msg.UniqueID != "abc123" {
			t.Fatalf("unexpected uniqueid: %s", msg.UniqueID)
		}
		if msg.LinkedID != "linked123" {
			t.Fatalf("unexpected linkedid: %s", msg.LinkedID)
		}
		if msg.Username != "alice" {
			t.Fatalf("unexpected username: %s", msg.Username)
		}
		if msg.DisplayName != "Mario Rossi" {
			t.Fatalf("unexpected display name: %s", msg.DisplayName)
		}
		if msg.DisplayNumber != "+39021234567" {
			t.Fatalf("unexpected display number: %s", msg.DisplayNumber)
		}
	case <-time.After(200 * time.Millisecond):
		t.Fatal("timeout waiting for summary broadcast")
	}
}

func TestStartSummaryWatchIsIdempotent(t *testing.T) {
	configuration.Config.SatellitePgSQLHost = "test"
	configuration.Config.SatellitePgSQLPort = "3306"
	configuration.Config.SatellitePgSQLDB = "test"
	configuration.Config.SatellitePgSQLUser = "test"

	originalInterval := summaryPollInterval
	summaryPollInterval = 10 * time.Millisecond
	originalTimeout := summaryWatchTimeout
	summaryWatchTimeout = time.Second

	originalFetch := fetchSummaryFunc
	originalWatchStatus := fetchSummaryWatchStatusFunc
	originalFetchMetadata := fetchSummaryMetadataFunc
	originalFetchUserDisplayInfo := fetchUserDisplayInfoFunc
	originalNotify := notifySummaryFunc
	defer func() {
		fetchSummaryFunc = originalFetch
		fetchSummaryWatchStatusFunc = originalWatchStatus
		fetchSummaryMetadataFunc = originalFetchMetadata
		fetchUserDisplayInfoFunc = originalFetchUserDisplayInfo
		notifySummaryFunc = originalNotify
		summaryPollInterval = originalInterval
		summaryWatchTimeout = originalTimeout
		resetWatcher()
	}()

	fetchSummaryFunc = func(uniqueID string) (string, bool, error) {
		return "", false, nil
	}
	fetchSummaryWatchStatusFunc = func(uniqueID string) (bool, error) {
		return true, nil
	}
	notifySummaryFunc = func(msg SummaryMessage) {}

	if StartSummaryWatch("dup123", "alice") != WatchStarted {
		t.Fatalf("expected watcher to start")
	}

	if StartSummaryWatch("dup123", "alice") != WatchAlreadyActive {
		t.Fatalf("expected duplicate watcher to be rejected")
	}

	if StartSummaryWatch("dup123", "bob") != WatchStarted {
		t.Fatalf("expected same uniqueid for another user to be allowed")
	}

	time.Sleep(50 * time.Millisecond)
}

func TestStartSummaryWatchPollsImmediately(t *testing.T) {
	configuration.Config.SatellitePgSQLHost = "test"
	configuration.Config.SatellitePgSQLPort = "3306"
	configuration.Config.SatellitePgSQLDB = "test"
	configuration.Config.SatellitePgSQLUser = "test"

	originalInterval := summaryPollInterval
	summaryPollInterval = time.Hour
	originalTimeout := summaryWatchTimeout
	summaryWatchTimeout = time.Second

	originalFetch := fetchSummaryFunc
	originalWatchStatus := fetchSummaryWatchStatusFunc
	originalFetchMetadata := fetchSummaryMetadataFunc
	originalFetchUserDisplayInfo := fetchUserDisplayInfoFunc
	originalNotify := notifySummaryFunc
	defer func() {
		fetchSummaryFunc = originalFetch
		fetchSummaryWatchStatusFunc = originalWatchStatus
		fetchSummaryMetadataFunc = originalFetchMetadata
		fetchUserDisplayInfoFunc = originalFetchUserDisplayInfo
		notifySummaryFunc = originalNotify
		summaryPollInterval = originalInterval
		summaryWatchTimeout = originalTimeout
		resetWatcher()
	}()

	fetchSummaryFunc = func(uniqueID string) (string, bool, error) {
		return "ready now", true, nil
	}
	fetchSummaryWatchStatusFunc = func(uniqueID string) (bool, error) {
		return false, nil
	}
	fetchUserDisplayInfoFunc = func(username string) (string, []string, error) {
		return "Alice", []string{"100"}, nil
	}
	fetchSummaryMetadataFunc = func(uniqueID string) (*CallMetadata, error) {
		return &CallMetadata{
			Src:  "+39021234567",
			CNam: "Mario Rossi",
			Dst:  "100",
		}, nil
	}

	ch := make(chan SummaryMessage, 1)
	notifySummaryFunc = func(msg SummaryMessage) {
		ch <- msg
	}

	if StartSummaryWatch("instant123", "alice") != WatchStarted {
		t.Fatalf("expected watcher to start")
	}

	select {
	case msg := <-ch:
		if msg.UniqueID != "instant123" {
			t.Fatalf("unexpected uniqueid: %s", msg.UniqueID)
		}
	case <-time.After(100 * time.Millisecond):
		t.Fatal("timeout waiting for immediate summary broadcast")
	}
}

func resetWatcher() {
	summaryWatcher.mutex.Lock()
	for _, cancel := range summaryWatcher.active {
		cancel()
	}
	summaryWatcher.active = map[string]context.CancelFunc{}
	summaryWatcher.mutex.Unlock()
}

// TestStartSummaryWatch_CanonicalRowWithDuplicateUniqueIDs verifies that the watcher uses the
// canonical (latest non-deleted) transcript row when multiple rows share the same uniqueid.
// The fetchSummaryFunc and fetchSummaryWatchStatusFunc are expected to follow the same
// canonical-row policy applied by the DB functions (ORDER BY updated_at DESC, id DESC LIMIT 1).
func TestStartSummaryWatch_CanonicalRowWithDuplicateUniqueIDs(t *testing.T) {
	configuration.Config.SatellitePgSQLHost = "test"
	configuration.Config.SatellitePgSQLPort = "3306"
	configuration.Config.SatellitePgSQLDB = "test"
	configuration.Config.SatellitePgSQLUser = "test"

	originalInterval := summaryPollInterval
	summaryPollInterval = 10 * time.Millisecond
	originalTimeout := summaryWatchTimeout
	summaryWatchTimeout = time.Second

	originalFetch := fetchSummaryFunc
	originalWatchStatus := fetchSummaryWatchStatusFunc
	originalFetchMetadata := fetchSummaryMetadataFunc
	originalFetchUserDisplayInfo := fetchUserDisplayInfoFunc
	originalNotify := notifySummaryFunc
	defer func() {
		fetchSummaryFunc = originalFetch
		fetchSummaryWatchStatusFunc = originalWatchStatus
		fetchSummaryMetadataFunc = originalFetchMetadata
		fetchUserDisplayInfoFunc = originalFetchUserDisplayInfo
		notifySummaryFunc = originalNotify
		summaryPollInterval = originalInterval
		summaryWatchTimeout = originalTimeout
		resetWatcher()
	}()

	// Simulate two DB rows for the same uniqueid; the DB function returns only the latest one.
	// The watcher must act on this canonical row without knowing about older fragments.
	fetchSummaryFunc = func(uniqueID string) (string, bool, error) {
		// Canonical row (latest fragment) has a summary.
		return "canonical summary from latest fragment", true, nil
	}
	fetchSummaryWatchStatusFunc = func(uniqueID string) (bool, error) {
		return false, nil
	}
	fetchUserDisplayInfoFunc = func(username string) (string, []string, error) {
		return "Alice", []string{"100"}, nil
	}
	fetchSummaryMetadataFunc = func(uniqueID string) (*CallMetadata, error) {
		return &CallMetadata{Src: "100", Dst: "+39021234567", DstCNam: "Mario Rossi"}, nil
	}

	ch := make(chan SummaryMessage, 1)
	notifySummaryFunc = func(msg SummaryMessage) {
		ch <- msg
	}

	if StartSummaryWatch("dup-uid-99", "alice") != WatchStarted {
		t.Fatalf("expected watcher to start")
	}

	select {
	case msg := <-ch:
		if msg.UniqueID != "dup-uid-99" {
			t.Fatalf("expected canonical uniqueid in notification, got %s", msg.UniqueID)
		}
		if msg.DisplayName != "Mario Rossi" {
			t.Fatalf("expected display name from canonical CDR row, got %s", msg.DisplayName)
		}
	case <-time.After(200 * time.Millisecond):
		t.Fatal("timeout: watcher did not notify for canonical row")
	}
}

func TestStartSummaryWatchStopsWhenSummaryCannotBeProduced(t *testing.T) {
	configuration.Config.SatellitePgSQLHost = "test"
	configuration.Config.SatellitePgSQLPort = "3306"
	configuration.Config.SatellitePgSQLDB = "test"
	configuration.Config.SatellitePgSQLUser = "test"

	originalInterval := summaryPollInterval
	summaryPollInterval = 10 * time.Millisecond
	originalTimeout := summaryWatchTimeout
	summaryWatchTimeout = time.Second

	originalFetch := fetchSummaryFunc
	originalWatchStatus := fetchSummaryWatchStatusFunc
	originalFetchMetadata := fetchSummaryMetadataFunc
	originalFetchUserDisplayInfo := fetchUserDisplayInfoFunc
	originalNotify := notifySummaryFunc
	defer func() {
		fetchSummaryFunc = originalFetch
		fetchSummaryWatchStatusFunc = originalWatchStatus
		fetchSummaryMetadataFunc = originalFetchMetadata
		fetchUserDisplayInfoFunc = originalFetchUserDisplayInfo
		notifySummaryFunc = originalNotify
		summaryPollInterval = originalInterval
		summaryWatchTimeout = originalTimeout
		resetWatcher()
	}()

	fetchSummaryFunc = func(uniqueID string) (string, bool, error) {
		return "", false, nil
	}
	fetchSummaryWatchStatusFunc = func(uniqueID string) (bool, error) {
		return true, nil
	}

	notified := false
	notifySummaryFunc = func(msg SummaryMessage) {
		notified = true
	}

	if StartSummaryWatch("silent123", "alice") != WatchStarted {
		t.Fatalf("expected watcher to start")
	}

	time.Sleep(50 * time.Millisecond)

	if notified {
		t.Fatalf("did not expect summary notification")
	}

	summaryWatcher.mutex.Lock()
	_, stillActive := summaryWatcher.active["alice:silent123"]
	summaryWatcher.mutex.Unlock()
	if stillActive {
		t.Fatalf("expected watcher to stop when summary cannot be produced")
	}
}
