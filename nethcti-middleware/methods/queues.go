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

// Queue names are resolved server-side for the same reason as ring groups (see
// ringgroups.go): the frontend's queue store (state.queues) is populated only by
// the operator/queue-manager panels and only for the queues the user manages, so
// the call-history page cannot rely on it to show a queue's name. The middleware
// reads extension -> descr from the FreePBX queues_config table (same MariaDB
// server as the CDR DB) and injects the name into history rows whose destination
// is a queue, so an unanswered queue call shows the queue NAME regardless of the
// frontend store state.
//
// Only the queue-entry leg carries the queue number as its dst (an ANSWERED queue
// call's group parent is the answering agent, whose dst is the agent extension),
// so enriching by dst naturally targets the unanswered-queue case without
// overwriting who-answered.

var (
	queueNameCacheMu  sync.Mutex
	queueNameCache    map[string]string
	queueNameCacheAt  time.Time
	queueNameCacheTTL = 5 * time.Minute
)

// getQueueNames returns a cached queue number -> name map, refreshing it from the
// database at most once per TTL. On a load failure it keeps serving the previous
// cache (or an empty map) so history enrichment degrades gracefully.
func getQueueNames() map[string]string {
	queueNameCacheMu.Lock()
	defer queueNameCacheMu.Unlock()

	if queueNameCache != nil && time.Since(queueNameCacheAt) < queueNameCacheTTL {
		return queueNameCache
	}

	if loaded := loadQueueNames(); loaded != nil {
		queueNameCache = loaded
		queueNameCacheAt = time.Now()
	}
	if queueNameCache == nil {
		return map[string]string{}
	}
	return queueNameCache
}

// loadQueueNames reads extension -> descr from the FreePBX queues_config table.
// Returns nil on any error so the caller can fall back to the previous cache.
func loadQueueNames() map[string]string {
	conn := db.GetCDRDB()
	if conn == nil {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	rows, err := conn.QueryContext(ctx, "SELECT extension, descr FROM "+ringGroupDBSchema+".queues_config")
	if err != nil {
		logs.Log("[WARNING][HISTORY] Failed to load queue names: " + err.Error())
		return nil
	}
	defer rows.Close()

	result := map[string]string{}
	for rows.Next() {
		var num, desc sql.NullString
		if err := rows.Scan(&num, &desc); err != nil {
			continue
		}
		ext := strings.TrimSpace(num.String)
		if ext == "" {
			continue
		}
		result[ext] = strings.TrimSpace(desc.String)
	}
	return result
}

// enrichQueueRows sets, in place, the display name for history rows whose dst is a
// queue number, so the destination shows the queue NAME over its number even when
// the frontend queue store is empty. It is a no-op when there are no queues.
func enrichQueueRows(rows []map[string]interface{}, queueNames map[string]string) {
	if len(queueNames) == 0 {
		return
	}
	for _, row := range rows {
		dst := getHistoryRowString(row, "dst")
		name, ok := queueNames[dst]
		if !ok || name == "" {
			continue
		}
		row["queueName"] = name
		// dst stays the queue number; setting dst_cnam makes CallDestination render
		// the name over the number without depending on the frontend queue store.
		row["dst_cnam"] = name
	}
}
