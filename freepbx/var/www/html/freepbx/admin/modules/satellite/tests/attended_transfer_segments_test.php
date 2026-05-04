#!/usr/bin/env php
<?php

/*
 * Regression case:
 * 1. Foo 1 calls Foo 2.
 * 2. Foo 2 starts an attended transfer to Foo 3 and speaks with Foo 3.
 * 3. Foo 2 finalizes the transfer.
 * 4. Foo 1 and Foo 3 continue speaking together.
 *
 * Expected transcription segments:
 * - Foo One (201) -> Foo Two (202)
 * - Foo Two (202) -> Foo Three (203)
 * - Foo One (201) -> Foo Three (203)
 *
 * The CEL fixture mirrors the user-reported rows. Bridge ids are added in the
 * `extra` field because the original SQL output omitted that column, while the
 * segment builder relies on it to track bridge membership.
 */

define('SATELLITE_TRANSCRIPTION_LIBRARY_MODE', true);
putenv('DEBUG=0');

require_once dirname(__DIR__) . '/bin/satellite_transcript';

$celRows = attended_transfer_cel_rows();
$cdrRows = array();
$usersByExtension = array(
    '201' => 'Foo One',
    '202' => 'Foo Two',
    '203' => 'Foo Three',
);

$coalescedSegments = coalesce_adjacent_segments(
    array(
        array(
            'start' => parse_time('2026-04-27 10:19:12'),
            'end' => parse_time('2026-04-27 10:19:17'),
            'primary_channel' => 'PJSIP/201-0000003b',
            'peer_channel' => 'Local/203@from-internal-00000013;1',
            'audio_start_offset' => 10,
            'audio_end_offset' => 15,
            'caller_num' => '201',
            'caller_name' => 'Foo One',
            'callee_num' => '203',
            'callee_name' => 'Foo Three',
        ),
        array(
            'start' => parse_time('2026-04-27 10:19:17'),
            'end' => parse_time('2026-04-27 10:19:20'),
            'primary_channel' => 'PJSIP/201-0000003b',
            'peer_channel' => 'PJSIP/203-0000003d',
            'audio_start_offset' => 15,
            'audio_end_offset' => 18,
            'caller_num' => '201',
            'caller_name' => 'Foo One',
            'callee_num' => '203',
            'callee_name' => 'Foo Three',
        ),
    )
);
assert_same(1, count($coalescedSegments), 'Adjacent segments with the same parties should be merged');
assert_same('2026-04-27 10:19:20', format_time($coalescedSegments[0]['end']), 'Merged segment should keep the last end time');
assert_same(18, $coalescedSegments[0]['audio_end_offset'], 'Merged segment should keep the last audio end offset');

$channelFacts = build_channel_facts($celRows, $cdrRows);

$firstLegSegments = build_bridge_segments(
    $celRows,
    'PJSIP/201-0000003b',
    parse_time('2026-04-27 10:18:57'),
    parse_time('2026-04-27 10:19:02')
);
$firstLegSegments = enrich_segments(
    $firstLegSegments,
    $cdrRows,
    $channelFacts,
    $usersByExtension,
    'PJSIP/201-0000003b',
    '1777277927.999',
    '',
    ''
);

$transferRecordingContext = resolve_recording_context($celRows, '1777277942.1012', '1777277927.999');
assert_true($transferRecordingContext['is_fallback'] === true, 'Transfer recording should use fallback context even when MixMonitor APP_START exists');
assert_same('Local/203@from-internal-00000013;2', $transferRecordingContext['primary_channel'], 'Fallback context should anchor on the Local/203;2 recording leg');
assert_same('2026-04-27 10:19:02', format_time($transferRecordingContext['start']), 'Fallback context should start from the Local leg CHAN_START time');

$transferSegments = build_bridge_segments(
    $celRows,
    $transferRecordingContext['primary_channel'],
    $transferRecordingContext['start'],
    $transferRecordingContext['end']
);
$transferSegments = normalize_local_channel_segments(
    $transferSegments,
    $celRows,
    $transferRecordingContext['start'],
    $transferRecordingContext['end']
);
$transferSegments = enrich_segments(
    $transferSegments,
    $cdrRows,
    $channelFacts,
    $usersByExtension,
    $transferRecordingContext['primary_channel'],
    '1777277942.1012',
    '',
    ''
);

$allSegments = array_merge($firstLegSegments, $transferSegments);

assert_segment_labels(
    array(
        'Foo One (201) -> Foo Two (202)',
        'Foo Two (202) -> Foo Three (203)',
        'Foo One (201) -> Foo Three (203)',
    ),
    $allSegments,
    'Attended transfer should produce the three expected transcription segments'
);

fwrite(STDOUT, "ok - attended transfer regression\n");

function attended_transfer_cel_rows() {
    return array(
        array('uniqueid' => '1777277927.999', 'linkedid' => '1777277927.999', 'eventtype' => 'CHAN_START', 'eventtime' => '2026-04-27 10:18:47', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '', 'cid_dnid' => '', 'channame' => 'PJSIP/201-0000003b', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '', 'exten' => ''),
        array('uniqueid' => '1777277927.999', 'linkedid' => '1777277927.999', 'eventtype' => 'APP_START', 'eventtime' => '2026-04-27 10:18:47', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '201', 'cid_dnid' => '202', 'channame' => 'PJSIP/201-0000003b', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '', 'exten' => ''),
        array('uniqueid' => '1777277927.999', 'linkedid' => '1777277927.999', 'eventtype' => 'APP_END', 'eventtime' => '2026-04-27 10:18:47', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '201', 'cid_dnid' => '202', 'channame' => 'PJSIP/201-0000003b', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '', 'exten' => ''),
        array('uniqueid' => '1777277927.999', 'linkedid' => '1777277927.999', 'eventtype' => 'APP_START', 'eventtime' => '2026-04-27 10:18:47', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '201', 'cid_dnid' => '202', 'channame' => 'PJSIP/201-0000003b', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '', 'exten' => ''),
        array('uniqueid' => '1777277927.999', 'linkedid' => '1777277927.999', 'eventtype' => 'APP_END', 'eventtime' => '2026-04-27 10:18:47', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '201', 'cid_dnid' => '202', 'channame' => 'PJSIP/201-0000003b', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '', 'exten' => ''),
        array('uniqueid' => '1777277927.1005', 'linkedid' => '1777277927.999', 'eventtype' => 'CHAN_START', 'eventtime' => '2026-04-27 10:18:47', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '', 'cid_dnid' => '', 'channame' => 'PJSIP/202-0000003c', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '', 'exten' => ''),
        array('uniqueid' => '1777277927.1005', 'linkedid' => '1777277927.999', 'eventtype' => 'ANSWER', 'eventtime' => '2026-04-27 10:18:57', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'cid_dnid' => '', 'channame' => 'PJSIP/202-0000003c', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '', 'exten' => ''),
        array('uniqueid' => '1777277927.999', 'linkedid' => '1777277927.999', 'eventtype' => 'ANSWER', 'eventtime' => '2026-04-27 10:18:57', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '201', 'cid_dnid' => '202', 'channame' => 'PJSIP/201-0000003b', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '', 'exten' => ''),
        array('uniqueid' => '1777277927.1005', 'linkedid' => '1777277927.999', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-04-27 10:18:57', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'cid_dnid' => '', 'channame' => 'PJSIP/202-0000003c', 'peer' => 'PJSIP/201-0000003b', 'appname' => 'AppDial', 'appdata' => '', 'accountcode' => '', 'exten' => '', 'extra' => json_encode(array('bridge_id' => 'b1'))),
        array('uniqueid' => '1777277927.999', 'linkedid' => '1777277927.999', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-04-27 10:18:57', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '201', 'cid_dnid' => '202', 'channame' => 'PJSIP/201-0000003b', 'peer' => 'PJSIP/202-0000003c', 'appname' => 'Dial', 'appdata' => 'satellite', 'accountcode' => '', 'exten' => '', 'extra' => json_encode(array('bridge_id' => 'b1'))),
        array('uniqueid' => '1777277942.1011', 'linkedid' => '1777277927.999', 'eventtype' => 'CHAN_START', 'eventtime' => '2026-04-27 10:19:02', 'cid_name' => '', 'cid_num' => '', 'cid_ani' => '', 'cid_dnid' => '', 'channame' => 'Local/203@from-internal-00000013;1', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '', 'exten' => ''),
        array('uniqueid' => '1777277942.1012', 'linkedid' => '1777277927.999', 'eventtype' => 'CHAN_START', 'eventtime' => '2026-04-27 10:19:02', 'cid_name' => '', 'cid_num' => '', 'cid_ani' => '', 'cid_dnid' => '', 'channame' => 'Local/203@from-internal-00000013;2', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '201', 'exten' => ''),
        array('uniqueid' => '1777277942.1012', 'linkedid' => '1777277927.999', 'eventtype' => 'APP_START', 'eventtime' => '2026-04-27 10:19:03', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'cid_dnid' => '', 'channame' => 'Local/203@from-internal-00000013;2', 'peer' => '', 'appname' => 'MixMonitor', 'appdata' => 'satellite /var/run/nethvoice/other.wav', 'accountcode' => '201', 'exten' => ''),
        array('uniqueid' => '1777277942.1011', 'linkedid' => '1777277927.999', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-04-27 10:19:02', 'cid_name' => '', 'cid_num' => '', 'cid_ani' => '', 'cid_dnid' => '', 'channame' => 'Local/203@from-internal-00000013;1', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '', 'exten' => '', 'extra' => json_encode(array('bridge_id' => 'b2'))),
        array('uniqueid' => '1777277927.1005', 'linkedid' => '1777277927.999', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-04-27 10:19:02', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'cid_dnid' => '', 'channame' => 'PJSIP/202-0000003c', 'peer' => 'PJSIP/201-0000003b', 'appname' => 'AppDial', 'appdata' => '', 'accountcode' => '', 'exten' => '', 'extra' => json_encode(array('bridge_id' => 'b1'))),
        array('uniqueid' => '1777277927.1005', 'linkedid' => '1777277927.999', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-04-27 10:19:02', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'cid_dnid' => '', 'channame' => 'PJSIP/202-0000003c', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '', 'exten' => '', 'extra' => json_encode(array('bridge_id' => 'b2'))),
        array('uniqueid' => '1777277942.1012', 'linkedid' => '1777277927.999', 'eventtype' => 'APP_START', 'eventtime' => '2026-04-27 10:19:02', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'cid_dnid' => '', 'channame' => 'Local/203@from-internal-00000013;2', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '201', 'exten' => ''),
        array('uniqueid' => '1777277942.1012', 'linkedid' => '1777277927.999', 'eventtype' => 'APP_END', 'eventtime' => '2026-04-27 10:19:02', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'cid_dnid' => '', 'channame' => 'Local/203@from-internal-00000013;2', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '201', 'exten' => ''),
        array('uniqueid' => '1777277942.1022', 'linkedid' => '1777277927.999', 'eventtype' => 'CHAN_START', 'eventtime' => '2026-04-27 10:19:02', 'cid_name' => 'Foo Three', 'cid_num' => '203', 'cid_ani' => '', 'cid_dnid' => '', 'channame' => 'PJSIP/203-0000003d', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '', 'exten' => ''),
        array('uniqueid' => '1777277942.1022', 'linkedid' => '1777277927.999', 'eventtype' => 'ANSWER', 'eventtime' => '2026-04-27 10:19:05', 'cid_name' => 'Foo Three', 'cid_num' => '203', 'cid_ani' => '203', 'cid_dnid' => '', 'channame' => 'PJSIP/203-0000003d', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '', 'exten' => ''),
        array('uniqueid' => '1777277942.1012', 'linkedid' => '1777277927.999', 'eventtype' => 'ANSWER', 'eventtime' => '2026-04-27 10:19:05', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'cid_dnid' => '', 'channame' => 'Local/203@from-internal-00000013;2', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '201', 'exten' => ''),
        array('uniqueid' => '1777277942.1022', 'linkedid' => '1777277927.999', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-04-27 10:19:05', 'cid_name' => 'Foo Three', 'cid_num' => '203', 'cid_ani' => '203', 'cid_dnid' => '', 'channame' => 'PJSIP/203-0000003d', 'peer' => 'Local/203@from-internal-00000013;2', 'appname' => 'Dial', 'appdata' => '', 'accountcode' => '', 'exten' => '', 'extra' => json_encode(array('bridge_id' => 'b3'))),
        array('uniqueid' => '1777277942.1012', 'linkedid' => '1777277927.999', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-04-27 10:19:05', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'cid_dnid' => '', 'channame' => 'Local/203@from-internal-00000013;2', 'peer' => 'PJSIP/203-0000003d', 'appname' => 'Dial', 'appdata' => '', 'accountcode' => '201', 'exten' => '', 'extra' => json_encode(array('bridge_id' => 'b3'))),
        array('uniqueid' => '1777277942.1011', 'linkedid' => '1777277927.999', 'eventtype' => 'ANSWER', 'eventtime' => '2026-04-27 10:19:05', 'cid_name' => 'Foo Three', 'cid_num' => '203', 'cid_ani' => '', 'cid_dnid' => '', 'channame' => 'Local/203@from-internal-00000013;1', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '', 'exten' => ''),
        array('uniqueid' => '1777277927.1005', 'linkedid' => '1777277927.999', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-04-27 10:19:12', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'cid_dnid' => '', 'channame' => 'PJSIP/202-0000003c', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '', 'exten' => '', 'extra' => json_encode(array('bridge_id' => 'b2'))),
        array('uniqueid' => '1777277942.1011', 'linkedid' => '1777277927.999', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-04-27 10:19:12', 'cid_name' => 'Foo Three', 'cid_num' => '203', 'cid_ani' => '', 'cid_dnid' => '', 'channame' => 'Local/203@from-internal-00000013;1', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '', 'exten' => '', 'extra' => json_encode(array('bridge_id' => 'b2'))),
        array('uniqueid' => '1777277942.1011', 'linkedid' => '1777277927.999', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-04-27 10:19:12', 'cid_name' => 'Foo Three', 'cid_num' => '203', 'cid_ani' => '', 'cid_dnid' => '', 'channame' => 'Local/203@from-internal-00000013;1', 'peer' => 'PJSIP/201-0000003b', 'appname' => '', 'appdata' => '', 'accountcode' => '', 'exten' => '', 'extra' => json_encode(array('bridge_id' => 'b1'))),
        array('uniqueid' => '1777277927.1005', 'linkedid' => '1777277927.999', 'eventtype' => 'ATTENDEDTRANSFER', 'eventtime' => '2026-04-27 10:19:12', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'cid_dnid' => '', 'channame' => 'PJSIP/202-0000003c', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '', 'exten' => ''),
        array('uniqueid' => '1777277927.1005', 'linkedid' => '1777277927.999', 'eventtype' => 'HANGUP', 'eventtime' => '2026-04-27 10:19:12', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'cid_dnid' => '', 'channame' => 'PJSIP/202-0000003c', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '', 'exten' => ''),
        array('uniqueid' => '1777277927.1005', 'linkedid' => '1777277927.999', 'eventtype' => 'CHAN_END', 'eventtime' => '2026-04-27 10:19:12', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'cid_dnid' => '', 'channame' => 'PJSIP/202-0000003c', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '', 'exten' => ''),
        array('uniqueid' => '1777277942.1022', 'linkedid' => '1777277927.999', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-04-27 10:19:17', 'cid_name' => 'Foo Three', 'cid_num' => '203', 'cid_ani' => '203', 'cid_dnid' => '', 'channame' => 'PJSIP/203-0000003d', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '', 'exten' => '', 'extra' => json_encode(array('bridge_id' => 'b3'))),
        array('uniqueid' => '1777277942.1012', 'linkedid' => '1777277927.999', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-04-27 10:19:17', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '202', 'cid_dnid' => '', 'channame' => 'Local/203@from-internal-00000013;2', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '201', 'exten' => '', 'extra' => json_encode(array('bridge_id' => 'b3'))),
        array('uniqueid' => '1777277942.1022', 'linkedid' => '1777277927.999', 'eventtype' => 'HANGUP', 'eventtime' => '2026-04-27 10:19:17', 'cid_name' => 'Foo Three', 'cid_num' => '203', 'cid_ani' => '203', 'cid_dnid' => '', 'channame' => 'PJSIP/203-0000003d', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '', 'exten' => ''),
        array('uniqueid' => '1777277942.1022', 'linkedid' => '1777277927.999', 'eventtype' => 'CHAN_END', 'eventtime' => '2026-04-27 10:19:17', 'cid_name' => 'Foo Three', 'cid_num' => '203', 'cid_ani' => '203', 'cid_dnid' => '', 'channame' => 'PJSIP/203-0000003d', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '', 'exten' => ''),
        array('uniqueid' => '1777277942.1011', 'linkedid' => '1777277927.999', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-04-27 10:19:17', 'cid_name' => 'Foo Three', 'cid_num' => '203', 'cid_ani' => '', 'cid_dnid' => '', 'channame' => 'Local/203@from-internal-00000013;1', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '', 'exten' => '', 'extra' => json_encode(array('bridge_id' => 'b1'))),
        array('uniqueid' => '1777277942.1011', 'linkedid' => '1777277927.999', 'eventtype' => 'HANGUP', 'eventtime' => '2026-04-27 10:19:17', 'cid_name' => 'Foo Three', 'cid_num' => '203', 'cid_ani' => '', 'cid_dnid' => '', 'channame' => 'Local/203@from-internal-00000013;1', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '', 'exten' => ''),
        array('uniqueid' => '1777277942.1011', 'linkedid' => '1777277927.999', 'eventtype' => 'CHAN_END', 'eventtime' => '2026-04-27 10:19:17', 'cid_name' => 'Foo Three', 'cid_num' => '203', 'cid_ani' => '', 'cid_dnid' => '', 'channame' => 'Local/203@from-internal-00000013;1', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '', 'exten' => ''),
        array('uniqueid' => '1777277942.1012', 'linkedid' => '1777277927.999', 'eventtype' => 'HANGUP', 'eventtime' => '2026-04-27 10:19:17', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '202', 'cid_dnid' => '', 'channame' => 'Local/203@from-internal-00000013;2', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '201', 'exten' => ''),
        array('uniqueid' => '1777277942.1012', 'linkedid' => '1777277927.999', 'eventtype' => 'CHAN_END', 'eventtime' => '2026-04-27 10:19:17', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '202', 'cid_dnid' => '', 'channame' => 'Local/203@from-internal-00000013;2', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '201', 'exten' => ''),
        array('uniqueid' => '1777277927.999', 'linkedid' => '1777277927.999', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-04-27 10:19:17', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '201', 'cid_dnid' => '202', 'channame' => 'PJSIP/201-0000003b', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '', 'exten' => ''),
        array('uniqueid' => '1777277927.999', 'linkedid' => '1777277927.999', 'eventtype' => 'HANGUP', 'eventtime' => '2026-04-27 10:19:17', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '201', 'cid_dnid' => '202', 'channame' => 'PJSIP/201-0000003b', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '', 'exten' => ''),
        array('uniqueid' => '1777277927.999', 'linkedid' => '1777277927.999', 'eventtype' => 'CHAN_END', 'eventtime' => '2026-04-27 10:19:17', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '201', 'cid_dnid' => '202', 'channame' => 'PJSIP/201-0000003b', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '', 'exten' => ''),
        array('uniqueid' => '1777277927.999', 'linkedid' => '1777277927.999', 'eventtype' => 'LINKEDID_END', 'eventtime' => '2026-04-27 10:19:17', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '201', 'cid_dnid' => '202', 'channame' => 'PJSIP/201-0000003b', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '', 'exten' => ''),
    );
}

function assert_segment_labels($expectedLabels, $segments, $message) {
    $actualLabels = array();
    foreach ($segments as $segment) {
        $actualLabels[] = party_label($segment['caller_name'], $segment['caller_num'], 'caller')
            . ' -> '
            . party_label($segment['callee_name'], $segment['callee_num'], 'callee');
    }

    assert_same($expectedLabels, $actualLabels, $message);
}

function assert_same($expected, $actual, $message) {
    if ($expected !== $actual) {
        fwrite(STDERR, "not ok - $message\n");
        fwrite(STDERR, 'expected: ' . var_export($expected, true) . PHP_EOL);
        fwrite(STDERR, 'actual:   ' . var_export($actual, true) . PHP_EOL);
        exit(1);
    }
}

function assert_true($value, $message) {
    assert_same(true, $value, $message);
}