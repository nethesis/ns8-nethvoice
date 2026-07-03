#!/usr/bin/env php
<?php

/*
 * Regression case for NethServer/dev#8040:
 * each transcription segment of a transfer must be persisted under the uniqueid
 * of its OWN answered CDR leg, not under the recording's invocation uniqueid.
 *
 * Before the fix every segment was posted under the single invocation uniqueid,
 * so a transfer's legs collapsed onto one CDR row (often the 00:00:00 leg) while
 * the other legs showed no/duplicate transcription.
 */

require_once __DIR__ . '/bootstrap.php';

satellite_test_bootstrap();

$usersByExtension = array(
    '201' => 'Foo One',
    '202' => 'Foo Two',
    '203' => 'Foo Three',
);

// Two answered legs under one linkedid, each with its own uniqueid.
$cdrRows = array(
    array(
        'uniqueid' => 'U-A', 'linkedid' => 'L-1',
        'channel' => 'PJSIP/201-aaa', 'dstchannel' => 'PJSIP/202-bbb',
        'src' => '201', 'dst' => '202', 'cnum' => '201',
        'disposition' => 'ANSWERED', 'billsec' => 10, 'duration' => 10,
        'calldate' => '2026-05-05 10:00:00', 'accountcode' => '', 'cnam' => 'Foo One', 'dst_cnam' => 'Foo Two',
    ),
    array(
        'uniqueid' => 'U-B', 'linkedid' => 'L-1',
        'channel' => 'PJSIP/201-aaa', 'dstchannel' => 'PJSIP/203-ccc',
        'src' => '201', 'dst' => '203', 'cnum' => '201',
        'disposition' => 'ANSWERED', 'billsec' => 8, 'duration' => 8,
        'calldate' => '2026-05-05 10:00:10', 'accountcode' => '', 'cnam' => 'Foo One', 'dst_cnam' => 'Foo Three',
    ),
);

$channelFacts = build_channel_facts(array(), $cdrRows);

$rawSegments = array(
    array(
        'start' => parse_time('2026-05-05 10:00:00'),
        'end' => parse_time('2026-05-05 10:00:10'),
        'primary_channel' => 'PJSIP/201-aaa',
        'peer_channel' => 'PJSIP/202-bbb',
        'audio_start_offset' => 0,
        'audio_end_offset' => 10,
    ),
    array(
        'start' => parse_time('2026-05-05 10:00:10'),
        'end' => parse_time('2026-05-05 10:00:18'),
        'primary_channel' => 'PJSIP/201-aaa',
        'peer_channel' => 'PJSIP/203-ccc',
        'audio_start_offset' => 0,
        'audio_end_offset' => 8,
    ),
    // A leg with no matching answered CDR -> uniqueid must stay empty so the
    // caller falls back to the invocation uniqueid (legacy behaviour).
    array(
        'start' => parse_time('2026-05-05 10:00:20'),
        'end' => parse_time('2026-05-05 10:00:25'),
        'primary_channel' => 'PJSIP/204-ddd',
        'peer_channel' => 'PJSIP/205-eee',
        'audio_start_offset' => 0,
        'audio_end_offset' => 5,
    ),
);

$segments = enrich_segments(
    $rawSegments,
    $cdrRows,
    $channelFacts,
    $usersByExtension,
    'PJSIP/201-aaa',
    'U-INVOCATION',
    '',
    ''
);

assert_same(3, count($segments), 'All three segments should survive enrichment');
assert_same('U-A', $segments[0]['uniqueid'], 'Segment 201->202 must carry its own leg uniqueid');
assert_same('U-B', $segments[1]['uniqueid'], 'Segment 201->203 must carry its own leg uniqueid');
assert_same('', $segments[2]['uniqueid'], 'Segment with no matching CDR must have an empty uniqueid');

// Mirror the main-loop selection: per-leg uniqueid when present, else fallback.
$invocationUniqueid = 'U-INVOCATION';
$selected = array();
foreach ($segments as $segment) {
    $selected[] = (!empty($segment['uniqueid'])) ? $segment['uniqueid'] : $invocationUniqueid;
}
assert_same(array('U-A', 'U-B', 'U-INVOCATION'), $selected, 'Posting uniqueid should be per-leg with invocation fallback');

// merge_segment_pair must keep the real (non-Local) leg's uniqueid.
$localLeg = array(
    'start' => parse_time('2026-05-05 10:00:00'),
    'end' => parse_time('2026-05-05 10:00:05'),
    'primary_channel' => 'PJSIP/201-aaa',
    'peer_channel' => 'Local/203@from-internal-00000013;1',
    'audio_start_offset' => 0,
    'audio_end_offset' => 5,
    'caller_num' => '201', 'caller_name' => 'Foo One',
    'callee_num' => '203', 'callee_name' => 'Foo Three',
    'uniqueid' => '',
);
$realLeg = array(
    'start' => parse_time('2026-05-05 10:00:05'),
    'end' => parse_time('2026-05-05 10:00:10'),
    'primary_channel' => 'PJSIP/201-aaa',
    'peer_channel' => 'PJSIP/203-ccc',
    'audio_start_offset' => 5,
    'audio_end_offset' => 10,
    'caller_num' => '201', 'caller_name' => 'Foo One',
    'callee_num' => '203', 'callee_name' => 'Foo Three',
    'uniqueid' => 'U-B',
);
$merged = merge_segment_pair($localLeg, $realLeg);
assert_same('U-B', $merged['uniqueid'], 'Merged segment should adopt the real leg uniqueid');

// Attended-transfer consultation leg recorded over a Local channel (NethServer/dev#8040
// scenario B): the consultation segment 202<->201 and the post-transfer segment
// 203<->201 are both produced from the 201-side recording (invocation uniqueid =
// the post-transfer leg). The consultation must be reattached to 202's own CDR leg;
// the post-transfer must keep the invocation uniqueid.
$consultCdrs = array(
    array(
        'uniqueid' => 'CONSULT-202', 'linkedid' => 'L-9',
        'src' => '202', 'dst' => '', 'cnum' => '',
        'channel' => 'PJSIP/202-bbb', 'dstchannel' => 'Local/201@from-internal-00000001;1',
        'disposition' => 'ANSWERED', 'billsec' => 20, 'duration' => 20,
        'calldate' => '2026-05-05 11:00:00', 'accountcode' => '', 'cnam' => '', 'dst_cnam' => '',
    ),
    array(
        'uniqueid' => 'POSTXFER-201', 'linkedid' => 'L-9',
        'src' => '203', 'dst' => '201', 'cnum' => '202',
        'channel' => 'Local/201@from-internal-00000001;2', 'dstchannel' => 'PJSIP/201-ccc',
        'disposition' => 'ANSWERED', 'billsec' => 55, 'duration' => 58,
        'calldate' => '2026-05-05 11:00:00', 'accountcode' => '', 'cnam' => '', 'dst_cnam' => '',
    ),
);
$recordingPrimary = 'Local/201@from-internal-00000001;2'; // 201-side recording channel

$consultSeg = array(
    'start' => parse_time('2026-05-05 11:00:03'), 'end' => parse_time('2026-05-05 11:00:20'),
    'primary_channel' => 'PJSIP/202-bbb', 'peer_channel' => 'PJSIP/201-ccc',
    'audio_start_offset' => 0, 'audio_end_offset' => 17,
);
$consultCdr = find_best_cdr_for_segment($consultCdrs, $consultSeg, $recordingPrimary, 'POSTXFER-201');
assert_true($consultCdr !== null, 'Consultation segment should match a CDR leg');
assert_same('CONSULT-202', $consultCdr['uniqueid'], 'Consultation leg must attach to 202 own CDR, not the invocation leg');

$postSeg = array(
    'start' => parse_time('2026-05-05 11:00:20'), 'end' => parse_time('2026-05-05 11:00:58'),
    'primary_channel' => 'PJSIP/203-aaa', 'peer_channel' => 'PJSIP/201-ccc',
    'audio_start_offset' => 17, 'audio_end_offset' => 55,
);
$postCdr = find_best_cdr_for_segment($consultCdrs, $postSeg, $recordingPrimary, 'POSTXFER-201');
assert_true($postCdr === null, 'Post-transfer leg must keep the invocation uniqueid (no reattach)');

fwrite(STDOUT, "ok - per-leg segment uniqueid regression\n");
