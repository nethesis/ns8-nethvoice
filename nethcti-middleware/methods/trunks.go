/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package methods

import (
	"context"
	"database/sql"
	"strings"
	"sync"
	"time"

	"github.com/nethesis/nethcti-middleware/db"
	"github.com/nethesis/nethcti-middleware/logs"
)

// Which side of a call leg faces the outside is told by its channels, the same
// way cti-server classifies a switchboard row: a leg whose destination channel is
// a trunk dialled out, one whose own channel is a trunk came in. The trunks are
// read from the PBX configuration, with the same caching as the queue and
// ring-group names.

var (
	trunkCacheMu  sync.Mutex
	trunkCache    []string
	trunkCacheAt  time.Time
	trunkCacheTTL = 5 * time.Minute
)

// getTrunks returns the cached channel ids of the configured trunks. On a load
// failure it keeps serving the previous cache (or nothing), in which case legs
// fall back to the classification cti-server attached to them, if any.
func getTrunks() []string {
	trunkCacheMu.Lock()
	defer trunkCacheMu.Unlock()

	if trunkCache != nil && time.Since(trunkCacheAt) < trunkCacheTTL {
		return trunkCache
	}
	if loaded := loadTrunks(); loaded != nil {
		trunkCache = loaded
		trunkCacheAt = time.Now()
	}
	return trunkCache
}

// loadTrunks reads the trunks' channel ids from the FreePBX trunks table. Disabled
// trunks are kept: the calls they carried are still in the history.
func loadTrunks() []string {
	conn := db.GetCDRDB()
	if conn == nil {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	rows, err := conn.QueryContext(ctx, "SELECT channelid FROM "+ringGroupDBSchema+".trunks")
	if err != nil {
		logs.Log("[WARNING][HISTORY] Failed to load trunks: " + err.Error())
		return nil
	}
	defer rows.Close()

	result := []string{}
	for rows.Next() {
		var channelID sql.NullString
		if err := rows.Scan(&channelID); err != nil {
			continue
		}
		if value := strings.TrimSpace(channelID.String); value != "" {
			result = append(result, value)
		}
	}
	return result
}

// isTrunkChannel reports whether an Asterisk channel ("<tech>/<endpoint>-<seq>")
// belongs to one of the given trunks.
func isTrunkChannel(channel string, trunks []string) bool {
	if channel == "" {
		return false
	}
	for _, trunk := range trunks {
		if strings.Contains(channel, "/"+trunk+"-") || strings.HasSuffix(channel, "/"+trunk) {
			return true
		}
	}
	return false
}
