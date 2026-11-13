/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package methods

import "testing"

func TestEnrichQueueRows_SetsQueueName(t *testing.T) {
	// The queue-entry leg of an unanswered queue call: dst is the queue number.
	// The display name must become the queue NAME.
	rows := []map[string]interface{}{
		{"linkedid": "L1", "uniqueid": "u1", "src": "202", "dst": "401", "lastapp": "Queue", "disposition": "NO ANSWER", "dst_cnam": ""},
	}
	enrichQueueRows(rows, map[string]string{"401": "Test"})

	if rows[0]["dst"] != "401" {
		t.Fatalf("expected dst to stay the queue number 401, got %v", rows[0]["dst"])
	}
	if rows[0]["dst_cnam"] != "Test" {
		t.Fatalf("expected dst_cnam = queue name, got %v", rows[0]["dst_cnam"])
	}
	if rows[0]["queueName"] != "Test" {
		t.Fatalf("expected queueName marker, got %v", rows[0]["queueName"])
	}
}

func TestEnrichQueueRows_LeavesAgentLegUntouched(t *testing.T) {
	// The ANSWERED parent of a queue call is the agent (dst = agent extension, not a
	// queue number): it must not be rewritten to a queue name.
	rows := []map[string]interface{}{
		{"dst": "203", "dstchannel": "PJSIP/203-1", "disposition": "ANSWERED", "dst_cnam": "Agent"},
	}
	enrichQueueRows(rows, map[string]string{"401": "Test"})

	if rows[0]["dst"] != "203" || rows[0]["dst_cnam"] != "Agent" {
		t.Fatalf("agent leg was modified: %v", rows[0])
	}
	if _, marked := rows[0]["queueName"]; marked {
		t.Fatalf("agent leg must not get a queueName marker")
	}
}

func TestEnrichQueueRows_EmptyMapNoop(t *testing.T) {
	rows := []map[string]interface{}{
		{"dst": "401", "disposition": "NO ANSWER"},
	}
	enrichQueueRows(rows, map[string]string{})
	if _, marked := rows[0]["queueName"]; marked {
		t.Fatalf("no queues configured must be a no-op")
	}
}
