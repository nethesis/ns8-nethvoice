/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package methods

import "testing"

func TestEnrichRingGroupRows_UnansweredShowsGroupName(t *testing.T) {
	// A ring-group call nobody answered: a single CDR row with dst=600 (the group
	// number) and NO ANSWER. The destination must become the group NAME.
	rows := []map[string]interface{}{
		{"linkedid": "L1", "uniqueid": "u1", "src": "202", "dst": "600", "dstchannel": "PJSIP/201-00000014", "disposition": "NO ANSWER", "dst_cnam": ""},
	}
	enrichRingGroupRows(rows, map[string]string{"600": "Test RG"})
	// The leg itself names the member it rang; the group is restored on the parent.
	if rows[0]["dst"] != "201" {
		t.Fatalf("expected the leg to name the member it rang (201), got %v", rows[0]["dst"])
	}
	applyRingGroupParentNames(rows)

	if rows[0]["dst"] != "600" {
		t.Fatalf("expected unanswered parent to show the group number 600, got %v", rows[0]["dst"])
	}
	if rows[0]["dst_cnam"] != "Test RG" {
		t.Fatalf("expected dst_cnam = group name, got %v", rows[0]["dst_cnam"])
	}
	if rows[0]["ringGroupName"] != "Test RG" {
		t.Fatalf("expected ringGroupName marker, got %v", rows[0]["ringGroupName"])
	}
}

func TestRingGroupMultiLeg_ParentAnsweredChildKeepsItsMember(t *testing.T) {
	// A ring group that rang two members: 202 answered, 203 did not. Both rows share
	// the call's linkedid, so they collapse into one row; each leg must keep naming
	// the member it rang, and the answered parent must show who answered.
	rows := []map[string]interface{}{
		{"linkedid": "L1", "uniqueid": "u1", "time": float64(100), "src": "201", "dst": "600", "dstchannel": "PJSIP/202-00000003", "disposition": "ANSWERED", "lastapp": "Dial"},
		{"linkedid": "L1", "uniqueid": "u1", "time": float64(103), "src": "201", "dst": "600", "dstchannel": "PJSIP/203-00000004", "disposition": "NO ANSWER", "lastapp": "Dial"},
	}
	enrichRingGroupRows(rows, map[string]string{"600": "Test RG"})
	collapsed := collapseHistoryRowsByLinkedid(rows)
	applyRingGroupParentNames(collapsed)

	if len(collapsed) != 1 {
		t.Fatalf("expected the two legs to collapse into 1 row, got %d", len(collapsed))
	}
	parent := collapsed[0]
	if parent["dst"] != "202" {
		t.Fatalf("expected parent to show who answered (202), got %v", parent["dst"])
	}
	if parent["interactionsCount"] != 2 {
		t.Fatalf("expected interactionsCount 2, got %v", parent["interactionsCount"])
	}
	children, _ := parent["interactions"].([]map[string]interface{})
	if len(children) != 2 {
		t.Fatalf("expected both member legs listed, got %v", children)
	}
	// Each leg keeps naming the member it rang, the answered one included.
	if children[0]["dst"] != "202" || children[1]["dst"] != "203" {
		t.Fatalf("expected the members it rang (202, 203), got %v", children)
	}
}

func TestRingGroupMultiLeg_NobodyAnsweredShowsGroup(t *testing.T) {
	// Same shape, but no member answered: the parent must show the GROUP.
	rows := []map[string]interface{}{
		{"linkedid": "L1", "uniqueid": "u1", "time": float64(100), "dst": "600", "dstchannel": "PJSIP/202-1", "disposition": "NO ANSWER", "lastapp": "Dial"},
		{"linkedid": "L1", "uniqueid": "u1", "time": float64(103), "dst": "600", "dstchannel": "PJSIP/203-1", "disposition": "NO ANSWER", "lastapp": "Dial"},
	}
	enrichRingGroupRows(rows, map[string]string{"600": "Test RG"})
	collapsed := collapseHistoryRowsByLinkedid(rows)
	applyRingGroupParentNames(collapsed)

	if collapsed[0]["dst"] != "600" || collapsed[0]["dst_cnam"] != "Test RG" {
		t.Fatalf("expected unanswered parent to show the group, got dst=%v cnam=%v",
			collapsed[0]["dst"], collapsed[0]["dst_cnam"])
	}
}

func TestEnrichRingGroupRows_AnsweredShowsWhoAnswered(t *testing.T) {
	// A ring-group call answered by member 201: dst=600, ANSWERED, dstchannel points
	// to 201. The destination must become the answering member, not the group.
	rows := []map[string]interface{}{
		{"linkedid": "L1", "uniqueid": "u1", "src": "202", "dst": "600", "dstchannel": "PJSIP/201-00000012", "disposition": "ANSWERED", "dst_cnam": ""},
	}
	enrichRingGroupRows(rows, map[string]string{"600": "Test RG"})

	if rows[0]["dst"] != "201" {
		t.Fatalf("expected dst = who answered (201), got %v", rows[0]["dst"])
	}
	if rows[0]["ringGroupName"] != "Test RG" {
		t.Fatalf("expected ringGroupName marker kept for answered call, got %v", rows[0]["ringGroupName"])
	}
}

func TestEnrichRingGroupRows_NonGroupRowsUntouched(t *testing.T) {
	// A normal direct call to 201 must not be altered.
	rows := []map[string]interface{}{
		{"dst": "201", "dstchannel": "PJSIP/201-1", "disposition": "ANSWERED", "dst_cnam": "Andrea"},
	}
	enrichRingGroupRows(rows, map[string]string{"600": "Test RG"})

	if rows[0]["dst"] != "201" || rows[0]["dst_cnam"] != "Andrea" {
		t.Fatalf("non-group row was modified: %v", rows[0])
	}
	if _, marked := rows[0]["ringGroupName"]; marked {
		t.Fatalf("non-group row must not get a ringGroupName marker")
	}
}

func TestEnrichRingGroupRows_EmptyMapNoop(t *testing.T) {
	rows := []map[string]interface{}{
		{"dst": "600", "disposition": "NO ANSWER"},
	}
	enrichRingGroupRows(rows, map[string]string{})
	if _, marked := rows[0]["ringGroupName"]; marked {
		t.Fatalf("no ring groups configured must be a no-op")
	}
}

func TestExtensionFromChannel(t *testing.T) {
	cases := map[string]string{
		"PJSIP/201-00000012":            "201",
		"SIP/202-abcd":                  "202",
		"Local/203@from-internal-0001;1": "203",
		"PJSIP/trunk-name-1":            "", // non-numeric endpoint
		"":                             "",
		"garbage":                      "",
	}
	for in, want := range cases {
		if got := extensionFromChannel(in); got != want {
			t.Fatalf("extensionFromChannel(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestRingGroupFailoverToHangupIsNotAnAnsweredCall(t *testing.T) {
	// An outside call to a ring group nobody answered, whose failover is the
	// "Terminate Call: Hangup" destination (real rows). The trunk had already
	// answered the caller, so the hangup leg (context app-blackhole) is ANSWERED:
	// it must not become the summary, which is the group and a missed call.
	withTrunks(t, "OpenSolution Sip")
	leg := func(time float64, dst, dcontext, dstchannel, lastapp, disposition string, duration float64) map[string]interface{} {
		return map[string]interface{}{"linkedid": "1791467498.31", "uniqueid": "1791467498.31", "time": time,
			"src": "3400069069", "cnum": "3400069069", "dst": dst, "dcontext": dcontext,
			"channel": "PJSIP/OpenSolution Sip-00000005", "dstchannel": dstchannel,
			"lastapp": lastapp, "disposition": disposition, "duration": duration, "type": "in"}
	}
	rows := []map[string]interface{}{
		leg(1791467519, "hangup", "app-blackhole", "", "Hangup", "ANSWERED", 0),
		leg(1791467499, "600", "ext-group", "PJSIP/202-00000007", "Dial", "NO ANSWER", 20),
		leg(1791467499, "600", "ext-group", "PJSIP/203-00000008", "Dial", "NO ANSWER", 20),
		leg(1791467498, "600", "ext-group", "PJSIP/201-00000006", "Dial", "NO ANSWER", 21),
	}
	enrichRingGroupRows(rows, map[string]string{"600": "Test RG"})
	collapsed := collapseHistoryRowsByLinkedid(rows)
	applyRingGroupParentNames(collapsed)

	if len(collapsed) != 1 {
		t.Fatalf("expected 1 call, got %d", len(collapsed))
	}
	parent := collapsed[0]
	if parent["disposition"] != "NO ANSWER" || parent["dst"] != "600" || parent["dst_cnam"] != "Test RG" {
		t.Fatalf("expected a missed call to Test RG 600, got disposition=%v dst=%v dst_cnam=%v",
			parent["disposition"], parent["dst"], parent["dst_cnam"])
	}
	legs, _ := parent["interactions"].([]map[string]interface{})
	if len(legs) != 3 {
		t.Fatalf("expected the 3 members rung, got %d legs", len(legs))
	}
	for _, l := range legs {
		if l["dcontext"] == "app-blackhole" {
			t.Fatalf("the hangup leg must not be listed: %v", l)
		}
	}
}
