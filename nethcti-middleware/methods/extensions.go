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

// The configured extensions tell, positively, that a number is a colleague: a
// caller id a trunk presents on a call placed outside is not one of them (see
// applyFinalPartiesToParent). The list is never used the other way round —
// queues, ring groups and trunk caller ids are not extensions either, yet none of
// them is an outside party.
//
// Same source and caching as the queue and ring-group names (queues.go,
// ringgroups.go): the FreePBX users table on the CDR database server.

var (
	extensionCacheMu  sync.Mutex
	extensionCache    map[string]struct{}
	extensionCacheAt  time.Time
	extensionCacheTTL = 5 * time.Minute
)

// getExtensions returns the cached set of configured extensions, refreshing it
// from the database at most once per TTL. On a load failure it keeps serving the
// previous cache (or an empty set).
func getExtensions() map[string]struct{} {
	extensionCacheMu.Lock()
	defer extensionCacheMu.Unlock()

	if extensionCache != nil && time.Since(extensionCacheAt) < extensionCacheTTL {
		return extensionCache
	}

	if loaded := loadExtensions(); len(loaded) > 0 {
		extensionCache = loaded
		extensionCacheAt = time.Now()
	}
	if extensionCache == nil {
		return map[string]struct{}{}
	}
	return extensionCache
}

// loadExtensions reads the configured extensions from the FreePBX users table.
// Returns nil on any error so the caller can fall back to the previous cache.
func loadExtensions() map[string]struct{} {
	conn := db.GetCDRDB()
	if conn == nil {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	rows, err := conn.QueryContext(ctx, "SELECT extension FROM "+ringGroupDBSchema+".users")
	if err != nil {
		logs.Log("[WARNING][HISTORY] Failed to load extensions: " + err.Error())
		return nil
	}
	defer rows.Close()

	result := map[string]struct{}{}
	for rows.Next() {
		var extension sql.NullString
		if err := rows.Scan(&extension); err != nil {
			continue
		}
		if value := strings.TrimSpace(extension.String); value != "" {
			result[value] = struct{}{}
		}
	}
	return result
}
