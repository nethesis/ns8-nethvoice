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

fwrite(STDOUT, "ok - per-leg segment uniqueid regression\n");
