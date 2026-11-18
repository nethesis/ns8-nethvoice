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

// Ring groups have no dedicated CDR application marker (unlike queues, whose entry
// leg is lastapp="Queue"). A ring-group call is instead recorded as a single CDR
// row whose dst is the ring-group NUMBER (e.g. 600) and whose dstchannel is the
// member that answered (or was last attempted). We therefore recognise a
// ring-group call by matching dst against the configured ring-group numbers, read
// from the FreePBX database, and enrich the row so the history shows:
//   - unanswered: the ring-group NAME as the destination (esito "Non risposta"),
//     instead of a raw number or a random member;
//   - answered: WHO answered (the member extension parsed from dstchannel), with
//     the ring-group name kept as an indicator that it was a group call.
//
// The ring-group directory is not exposed by cti-server (astproxy has queues and
// operator groups but no ring groups), so the middleware reads it directly. The
// ringgroups table lives in the FreePBX database on the same MariaDB server as the
// CDR database, reachable through the CDR connection.
const ringGroupDBSchema = "asterisk" // FreePBX main database name

var (
	ringGroupCacheMu  sync.Mutex
	ringGroupCache    map[string]string
	ringGroupCacheAt  time.Time
	ringGroupCacheTTL = 5 * time.Minute
)

// getRingGroupNames returns a cached ring-group number -> name map, refreshing it
// from the database at most once per TTL. On a load failure it keeps serving the
// previous cache (or an empty map) so history enrichment degrades gracefully.
func getRingGroupNames() map[string]string {
	ringGroupCacheMu.Lock()
	defer ringGroupCacheMu.Unlock()

	if ringGroupCache != nil && time.Since(ringGroupCacheAt) < ringGroupCacheTTL {
		return ringGroupCache
	}

	if loaded := loadRingGroupNames(); loaded != nil {
		ringGroupCache = loaded
		ringGroupCacheAt = time.Now()
	}
	if ringGroupCache == nil {
		return map[string]string{}
	}
	return ringGroupCache
}

// loadRingGroupNames reads grpnum -> description from the FreePBX ringgroups table.
// Returns nil on any error so the caller can fall back to the previous cache.
func loadRingGroupNames() map[string]string {
	conn := db.GetCDRDB()
	if conn == nil {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	rows, err := conn.QueryContext(ctx, "SELECT grpnum, description FROM "+ringGroupDBSchema+".ringgroups")
	if err != nil {
		logs.Log("[WARNING][HISTORY] Failed to load ring groups: " + err.Error())
		return nil
	}
	defer rows.Close()

	result := map[string]string{}
	for rows.Next() {
		var num, desc sql.NullString
		if err := rows.Scan(&num, &desc); err != nil {
			continue
		}
		grpnum := strings.TrimSpace(num.String)
		if grpnum == "" {
			continue
		}
		result[grpnum] = strings.TrimSpace(desc.String)
	}
	return result
}

// enrichRingGroupRows mutates, in place, the history rows whose dst is a ring-group
// number so the destination reflects the group (see the file comment). It is a
// no-op when there are no ring groups configured.
func enrichRingGroupRows(rows []map[string]interface{}, ringGroupNames map[string]string) {
	if len(ringGroupNames) == 0 {
		return
	}
	for _, row := range rows {
		dst := getHistoryRowString(row, "dst")
		name, ok := ringGroupNames[dst]
		if !ok {
			continue
		}

		// Mark the row as a ring-group call and keep the group identity so the
		// frontend can indicate it (e.g. "via <group>") on answered calls too.
		row["ringGroupNum"] = dst
		row["ringGroupName"] = name

		// Every leg names the MEMBER it rang (from the channel that was dialled),
		// answered or not: when a ring group rings several members Asterisk writes
		// one CDR row per member, all sharing the call's linkedid, and each of them
		// becomes an interaction of the collapsed row. Labelling them all with the
		// group name would hide which member each attempt actually rang.
		// The group name is restored afterwards, on the collapsed parent only, when
		// nobody answered the call (see applyRingGroupParentNames).
		if member := extensionFromChannel(getHistoryRowString(row, "dstchannel")); member != "" {
			row["dst"] = member
			// Let the frontend resolve the operator's display name from dst.
			row["dst_cnam"] = ""
		} else {
			// No member channel to name (nobody was reachable): keep the group.
			row["dst_cnam"] = name
		}
	}
}

// extensionFromChannel extracts the extension from an Asterisk channel name such
// as "PJSIP/201-00000012", "SIP/201-abcd" or "Local/201@from-queue-00001;1",
// returning "" when the channel does not carry a numeric extension.
func extensionFromChannel(channel string) string {
	if channel == "" {
		return ""
	}
	slash := strings.IndexByte(channel, '/')
	if slash < 0 {
		return ""
	}
	rest := channel[slash+1:]
	if cut := strings.IndexAny(rest, "-@"); cut >= 0 {
		rest = rest[:cut]
	}
	if rest == "" {
		return ""
	}
	for i := 0; i < len(rest); i++ {
		if rest[i] < '0' || rest[i] > '9' {
			return ""
		}
	}
	return rest
}

// applyRingGroupParentNames restores the ring-group identity on collapsed parents
// that nobody answered, so an unanswered group call shows the GROUP as its
// destination (esito "Non risposta") instead of whichever member happened to be
// picked as the parent leg. Answered parents keep the member who answered.
// Runs after collapsing, since only then is it known which leg represents the call.
func applyRingGroupParentNames(rows []map[string]interface{}) {
	for _, row := range rows {
		name := getHistoryRowString(row, "ringGroupName")
		num := getHistoryRowString(row, "ringGroupNum")
		if name == "" || num == "" {
			continue
		}
		if getHistoryRowString(row, "disposition") == "ANSWERED" {
			continue
		}
		row["dst"] = num
		row["dst_cnam"] = name
	}
}
