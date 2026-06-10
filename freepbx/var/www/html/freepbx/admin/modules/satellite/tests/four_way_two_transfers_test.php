#!/usr/bin/env php
<?php

/*
 * Regression case:
 * 1. Bob (208) calls Foo One (201).
 * 2. Foo One starts an attended transfer to Foo Two (202) and speaks with 202.
 * 3. Foo One finalizes the transfer, so Bob speaks with Foo Two.
 * 4. Foo Two starts an attended transfer to Foo Three (203) and speaks with 203.
 * 5. Foo Two finalizes the transfer, so Bob speaks with Foo Three.
 *
 * Expected transcription segments:
 * - Bob (208) -> Foo One (201)
 * - Foo One (201) -> Foo Two (202)
 * - Bob (208) -> Foo Two (202)
 * - Foo Two (202) -> Foo Three (203)
 * - Bob (208) -> Foo Three (203)
 */

require_once __DIR__ . '/bootstrap.php';

satellite_test_bootstrap();

$celRows = four_way_two_transfers_cel_rows();
$cdrRows = array();
$usersByExtension = array(
    '201' => 'Foo One',
    '202' => 'Foo Two',
    '203' => 'Foo Three',
    '208' => 'Bob',
);

$channelFacts = build_channel_facts($celRows, $cdrRows);

$allSegments = array_merge(
    build_pipeline_segments_for_recording($celRows, $cdrRows, $channelFacts, $usersByExtension, '1777967918.433', '1777967918.433'),
    build_pipeline_segments_for_recording($celRows, $cdrRows, $channelFacts, $usersByExtension, '1777967940.461', '1777967918.433'),
    build_pipeline_segments_for_recording($celRows, $cdrRows, $channelFacts, $usersByExtension, '1777967982.518', '1777967918.433')
);

assert_segment_labels(
    array(
        'Bob (208) -> Foo One (201)',
        'Foo One (201) -> Foo Two (202)',
        'Bob (208) -> Foo Two (202)',
        'Foo Two (202) -> Foo Three (203)',
        'Bob (208) -> Foo Three (203)',
    ),
    $allSegments,
    'Four-way call with two transfers should produce the five expected transcription segments'
);

fwrite(STDOUT, "ok - four-way two transfers regression\n");

function build_pipeline_segments_for_recording($celRows, $cdrRows, $channelFacts, $usersByExtension, $uniqueid, $linkedid) {
    $recordingContext = resolve_recording_context($celRows, $uniqueid, $linkedid);
    $bridgeSegments = build_bridge_segments(
        $celRows,
        $recordingContext['primary_channel'],
        $recordingContext['start'],
        $recordingContext['end']
    );
    $rawSegments = filter_superseded_segments($bridgeSegments, $celRows, $uniqueid);
    if (empty($rawSegments)) {
        return array();
    }

    $rawSegments = normalize_local_channel_segments(
        $rawSegments,
        $celRows,
        $recordingContext['start'],
        $recordingContext['end']
    );
    if (empty($rawSegments)) {
        $rawSegments = build_cdr_fallback_segments(
            $cdrRows,
            $recordingContext['primary_channel'],
            $uniqueid,
            $recordingContext['start'],
            $recordingContext['end']
        );
    }

    return coalesce_adjacent_segments(
        enrich_segments(
            $rawSegments,
            $cdrRows,
            $channelFacts,
            $usersByExtension,
            $recordingContext['primary_channel'],
            $uniqueid,
            '',
            ''
        )
    );
}

function four_way_two_transfers_cel_rows() {
    return array(
        cel_row(array('uniqueid' => '1777967918.433', 'linkedid' => '1777967918.433', 'eventtype' => 'CHAN_START', 'eventtime' => '2026-05-05 09:58:38', 'cid_name' => 'Bob', 'cid_num' => '208', 'cid_dnid' => '201', 'exten' => '201', 'channame' => 'PJSIP/208-0000000a')),
        cel_row(array('uniqueid' => '1777967918.437', 'linkedid' => '1777967918.433', 'eventtype' => 'CHAN_START', 'eventtime' => '2026-05-05 09:58:38', 'cid_name' => 'Foo One', 'cid_num' => '201', 'exten' => 's', 'accountcode' => '201', 'channame' => 'PJSIP/201-0000000b')),
        cel_row(array('uniqueid' => '1777967918.437', 'linkedid' => '1777967918.433', 'eventtype' => 'ANSWER', 'eventtime' => '2026-05-05 09:58:42', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '201', 'exten' => '201', 'accountcode' => '201', 'channame' => 'PJSIP/201-0000000b')),
        cel_row(array('uniqueid' => '1777967918.433', 'linkedid' => '1777967918.433', 'eventtype' => 'ANSWER', 'eventtime' => '2026-05-05 09:58:42', 'cid_name' => 'Bob', 'cid_num' => '208', 'cid_ani' => '208', 'cid_dnid' => '201', 'exten' => 's', 'channame' => 'PJSIP/208-0000000a')),
        cel_row(array('uniqueid' => '1777967918.433', 'linkedid' => '1777967918.433', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-05-05 09:58:42', 'cid_name' => 'Bob', 'cid_num' => '208', 'cid_ani' => '208', 'cid_dnid' => '201', 'peer' => 'PJSIP/201-0000000b', 'channame' => 'PJSIP/208-0000000a', 'extra' => bridge_extra('b1'))),
        cel_row(array('uniqueid' => '1777967918.437', 'linkedid' => '1777967918.433', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-05-05 09:58:42', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '201', 'peer' => 'PJSIP/208-0000000a', 'accountcode' => '201', 'channame' => 'PJSIP/201-0000000b', 'extra' => bridge_extra('b1'))),

        cel_row(array('uniqueid' => '1777967940.459', 'linkedid' => '1777967918.433', 'eventtype' => 'CHAN_START', 'eventtime' => '2026-05-05 09:59:00', 'exten' => '202', 'channame' => 'Local/202@from-internal-00000004;1')),
        cel_row(array('uniqueid' => '1777967940.461', 'linkedid' => '1777967918.433', 'eventtype' => 'CHAN_START', 'eventtime' => '2026-05-05 09:59:00', 'exten' => '202', 'accountcode' => '201', 'channame' => 'Local/202@from-internal-00000004;2')),
        cel_row(array('uniqueid' => '1777967940.461', 'linkedid' => '1777967918.433', 'eventtype' => 'APP_START', 'eventtime' => '2026-05-05 09:59:00', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '201', 'accountcode' => '201', 'channame' => 'Local/202@from-internal-00000004;2', 'appname' => 'MixMonitor')),
        cel_row(array('uniqueid' => '1777967940.459', 'linkedid' => '1777967918.433', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-05-05 09:59:00', 'peer' => 'PJSIP/201-0000000b', 'exten' => '202', 'channame' => 'Local/202@from-internal-00000004;1', 'extra' => bridge_extra('b2'))),
        cel_row(array('uniqueid' => '1777967918.437', 'linkedid' => '1777967918.433', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-05-05 09:59:00', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '201', 'accountcode' => '201', 'channame' => 'PJSIP/201-0000000b', 'extra' => bridge_extra('b1'))),
        cel_row(array('uniqueid' => '1777967918.437', 'linkedid' => '1777967918.433', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-05-05 09:59:00', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '201', 'peer' => 'Local/202@from-internal-00000004;1', 'accountcode' => '201', 'channame' => 'PJSIP/201-0000000b', 'extra' => bridge_extra('b2'))),
        cel_row(array('uniqueid' => '1777967940.468', 'linkedid' => '1777967918.433', 'eventtype' => 'CHAN_START', 'eventtime' => '2026-05-05 09:59:00', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'exten' => 's', 'accountcode' => '202', 'channame' => 'PJSIP/202-0000000c')),
        cel_row(array('uniqueid' => '1777967940.468', 'linkedid' => '1777967918.433', 'eventtype' => 'ANSWER', 'eventtime' => '2026-05-05 09:59:07', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'exten' => '202', 'accountcode' => '202', 'channame' => 'PJSIP/202-0000000c')),
        cel_row(array('uniqueid' => '1777967940.461', 'linkedid' => '1777967918.433', 'eventtype' => 'ANSWER', 'eventtime' => '2026-05-05 09:59:07', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '201', 'exten' => 's', 'accountcode' => '201', 'channame' => 'Local/202@from-internal-00000004;2')),
        cel_row(array('uniqueid' => '1777967940.459', 'linkedid' => '1777967918.433', 'eventtype' => 'ANSWER', 'eventtime' => '2026-05-05 09:59:07', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'exten' => '202', 'accountcode' => '202', 'channame' => 'Local/202@from-internal-00000004;1')),
        cel_row(array('uniqueid' => '1777967940.461', 'linkedid' => '1777967918.433', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-05-05 09:59:07', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '201', 'peer' => 'PJSIP/202-0000000c', 'accountcode' => '201', 'channame' => 'Local/202@from-internal-00000004;2', 'extra' => bridge_extra('b3'))),
        cel_row(array('uniqueid' => '1777967940.468', 'linkedid' => '1777967918.433', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-05-05 09:59:07', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'peer' => 'Local/202@from-internal-00000004;2', 'accountcode' => '202', 'channame' => 'PJSIP/202-0000000c', 'extra' => bridge_extra('b3'))),
        cel_row(array('uniqueid' => '1777967918.437', 'linkedid' => '1777967918.433', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-05-05 09:59:18', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '201', 'accountcode' => '201', 'channame' => 'PJSIP/201-0000000b', 'extra' => bridge_extra('b2'))),
        cel_row(array('uniqueid' => '1777967940.459', 'linkedid' => '1777967918.433', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-05-05 09:59:18', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'exten' => '202', 'accountcode' => '202', 'channame' => 'Local/202@from-internal-00000004;1', 'extra' => bridge_extra('b2'))),
        cel_row(array('uniqueid' => '1777967940.459', 'linkedid' => '1777967918.433', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-05-05 09:59:18', 'cid_name' => 'Bob', 'cid_num' => '208', 'cid_ani' => '208', 'peer' => 'PJSIP/208-0000000a', 'exten' => '202', 'channame' => 'Local/202@from-internal-00000004;1', 'extra' => bridge_extra('b1'))),
        cel_row(array('uniqueid' => '1777967918.437', 'linkedid' => '1777967918.433', 'eventtype' => 'ATTENDEDTRANSFER', 'eventtime' => '2026-05-05 09:59:18', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '201', 'accountcode' => '201', 'channame' => 'PJSIP/201-0000000b')),
        cel_row(array('uniqueid' => '1777967918.437', 'linkedid' => '1777967918.433', 'eventtype' => 'HANGUP', 'eventtime' => '2026-05-05 09:59:18', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '201', 'accountcode' => '201', 'channame' => 'PJSIP/201-0000000b')),
        cel_row(array('uniqueid' => '1777967918.437', 'linkedid' => '1777967918.433', 'eventtype' => 'CHAN_END', 'eventtime' => '2026-05-05 09:59:18', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '201', 'accountcode' => '201', 'channame' => 'PJSIP/201-0000000b')),

        cel_row(array('uniqueid' => '1777967982.516', 'linkedid' => '1777967918.433', 'eventtype' => 'CHAN_START', 'eventtime' => '2026-05-05 09:59:42', 'exten' => '203', 'channame' => 'Local/203@from-internal-00000005;1')),
        cel_row(array('uniqueid' => '1777967982.518', 'linkedid' => '1777967918.433', 'eventtype' => 'CHAN_START', 'eventtime' => '2026-05-05 09:59:42', 'exten' => '203', 'accountcode' => '202', 'channame' => 'Local/203@from-internal-00000005;2')),
        cel_row(array('uniqueid' => '1777967982.518', 'linkedid' => '1777967918.433', 'eventtype' => 'APP_START', 'eventtime' => '2026-05-05 09:59:42', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'accountcode' => '202', 'channame' => 'Local/203@from-internal-00000005;2', 'appname' => 'MixMonitor')),
        cel_row(array('uniqueid' => '1777967982.516', 'linkedid' => '1777967918.433', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-05-05 09:59:42', 'peer' => 'PJSIP/202-0000000c', 'exten' => '203', 'channame' => 'Local/203@from-internal-00000005;1', 'extra' => bridge_extra('b4'))),
        cel_row(array('uniqueid' => '1777967940.468', 'linkedid' => '1777967918.433', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-05-05 09:59:42', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'accountcode' => '202', 'channame' => 'PJSIP/202-0000000c', 'extra' => bridge_extra('b3'))),
        cel_row(array('uniqueid' => '1777967940.468', 'linkedid' => '1777967918.433', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-05-05 09:59:42', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'peer' => 'Local/203@from-internal-00000005;1', 'accountcode' => '202', 'channame' => 'PJSIP/202-0000000c', 'extra' => bridge_extra('b4'))),
        cel_row(array('uniqueid' => '1777967982.525', 'linkedid' => '1777967918.433', 'eventtype' => 'CHAN_START', 'eventtime' => '2026-05-05 09:59:42', 'cid_name' => 'Foo Three', 'cid_num' => '203', 'exten' => 's', 'accountcode' => '203', 'channame' => 'PJSIP/203-0000000d')),
        cel_row(array('uniqueid' => '1777967982.525', 'linkedid' => '1777967918.433', 'eventtype' => 'ANSWER', 'eventtime' => '2026-05-05 09:59:46', 'cid_name' => 'Foo Three', 'cid_num' => '203', 'cid_ani' => '203', 'exten' => '203', 'accountcode' => '203', 'channame' => 'PJSIP/203-0000000d')),
        cel_row(array('uniqueid' => '1777967982.518', 'linkedid' => '1777967918.433', 'eventtype' => 'ANSWER', 'eventtime' => '2026-05-05 09:59:46', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'exten' => 's', 'accountcode' => '202', 'channame' => 'Local/203@from-internal-00000005;2')),
        cel_row(array('uniqueid' => '1777967982.516', 'linkedid' => '1777967918.433', 'eventtype' => 'ANSWER', 'eventtime' => '2026-05-05 09:59:46', 'cid_name' => 'Foo Three', 'cid_num' => '203', 'exten' => '203', 'accountcode' => '203', 'channame' => 'Local/203@from-internal-00000005;1')),
        cel_row(array('uniqueid' => '1777967982.518', 'linkedid' => '1777967918.433', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-05-05 09:59:46', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'peer' => 'PJSIP/203-0000000d', 'accountcode' => '202', 'channame' => 'Local/203@from-internal-00000005;2', 'extra' => bridge_extra('b5'))),
        cel_row(array('uniqueid' => '1777967982.525', 'linkedid' => '1777967918.433', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-05-05 09:59:46', 'cid_name' => 'Foo Three', 'cid_num' => '203', 'cid_ani' => '203', 'peer' => 'Local/203@from-internal-00000005;2', 'accountcode' => '203', 'channame' => 'PJSIP/203-0000000d', 'extra' => bridge_extra('b5'))),
        cel_row(array('uniqueid' => '1777967940.468', 'linkedid' => '1777967918.433', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-05-05 09:59:57', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'accountcode' => '202', 'channame' => 'PJSIP/202-0000000c', 'extra' => bridge_extra('b4'))),
        cel_row(array('uniqueid' => '1777967982.516', 'linkedid' => '1777967918.433', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-05-05 09:59:57', 'cid_name' => 'Foo Three', 'cid_num' => '203', 'exten' => '203', 'accountcode' => '203', 'channame' => 'Local/203@from-internal-00000005;1', 'extra' => bridge_extra('b4'))),
        cel_row(array('uniqueid' => '1777967982.516', 'linkedid' => '1777967918.433', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-05-05 09:59:57', 'cid_name' => 'Bob', 'cid_num' => '208', 'cid_ani' => '208', 'peer' => 'PJSIP/208-0000000a', 'exten' => '203', 'channame' => 'Local/203@from-internal-00000005;1', 'extra' => bridge_extra('b1'))),
        cel_row(array('uniqueid' => '1777967940.468', 'linkedid' => '1777967918.433', 'eventtype' => 'ATTENDEDTRANSFER', 'eventtime' => '2026-05-05 09:59:57', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'accountcode' => '202', 'channame' => 'PJSIP/202-0000000c')),
        cel_row(array('uniqueid' => '1777967940.468', 'linkedid' => '1777967918.433', 'eventtype' => 'HANGUP', 'eventtime' => '2026-05-05 09:59:57', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'accountcode' => '202', 'channame' => 'PJSIP/202-0000000c')),
        cel_row(array('uniqueid' => '1777967940.468', 'linkedid' => '1777967918.433', 'eventtype' => 'CHAN_END', 'eventtime' => '2026-05-05 09:59:57', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'accountcode' => '202', 'channame' => 'PJSIP/202-0000000c')),

        cel_row(array('uniqueid' => '1777967918.433', 'linkedid' => '1777967918.433', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-05-05 10:00:09', 'cid_name' => 'Bob', 'cid_num' => '208', 'cid_ani' => '208', 'cid_dnid' => '201', 'exten' => 's', 'channame' => 'PJSIP/208-0000000a', 'extra' => bridge_extra('b1'))),
        cel_row(array('uniqueid' => '1777967982.516', 'linkedid' => '1777967918.433', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-05-05 10:00:09', 'cid_name' => 'Foo Three', 'cid_num' => '203', 'exten' => '203', 'accountcode' => '203', 'channame' => 'Local/203@from-internal-00000005;1', 'extra' => bridge_extra('b1'))),
        cel_row(array('uniqueid' => '1777967982.518', 'linkedid' => '1777967918.433', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-05-05 10:00:09', 'cid_name' => 'Bob', 'cid_num' => '208', 'cid_ani' => '202', 'accountcode' => '202', 'channame' => 'Local/203@from-internal-00000005;2', 'extra' => bridge_extra('b5'))),
        cel_row(array('uniqueid' => '1777967982.525', 'linkedid' => '1777967918.433', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-05-05 10:00:09', 'cid_name' => 'Foo Three', 'cid_num' => '203', 'cid_ani' => '203', 'accountcode' => '203', 'channame' => 'PJSIP/203-0000000d', 'extra' => bridge_extra('b5'))),
        cel_row(array('uniqueid' => '1777967982.518', 'linkedid' => '1777967918.433', 'eventtype' => 'HANGUP', 'eventtime' => '2026-05-05 10:00:09', 'cid_name' => 'Bob', 'cid_num' => '208', 'cid_ani' => '202', 'accountcode' => '202', 'channame' => 'Local/203@from-internal-00000005;2')),
        cel_row(array('uniqueid' => '1777967982.518', 'linkedid' => '1777967918.433', 'eventtype' => 'CHAN_END', 'eventtime' => '2026-05-05 10:00:09', 'cid_name' => 'Bob', 'cid_num' => '208', 'cid_ani' => '202', 'accountcode' => '202', 'channame' => 'Local/203@from-internal-00000005;2')),
        cel_row(array('uniqueid' => '1777967982.525', 'linkedid' => '1777967918.433', 'eventtype' => 'HANGUP', 'eventtime' => '2026-05-05 10:00:09', 'cid_name' => 'Foo Three', 'cid_num' => '203', 'cid_ani' => '203', 'accountcode' => '203', 'channame' => 'PJSIP/203-0000000d')),
        cel_row(array('uniqueid' => '1777967982.525', 'linkedid' => '1777967918.433', 'eventtype' => 'CHAN_END', 'eventtime' => '2026-05-05 10:00:09', 'cid_name' => 'Foo Three', 'cid_num' => '203', 'cid_ani' => '203', 'accountcode' => '203', 'channame' => 'PJSIP/203-0000000d')),
        cel_row(array('uniqueid' => '1777967918.433', 'linkedid' => '1777967918.433', 'eventtype' => 'HANGUP', 'eventtime' => '2026-05-05 10:00:09', 'cid_name' => 'Bob', 'cid_num' => '208', 'cid_ani' => '208', 'cid_dnid' => '201', 'exten' => 'h', 'channame' => 'PJSIP/208-0000000a')),
        cel_row(array('uniqueid' => '1777967918.433', 'linkedid' => '1777967918.433', 'eventtype' => 'CHAN_END', 'eventtime' => '2026-05-05 10:00:09', 'cid_name' => 'Bob', 'cid_num' => '208', 'cid_ani' => '208', 'cid_dnid' => '201', 'exten' => 'h', 'channame' => 'PJSIP/208-0000000a')),
        cel_row(array('uniqueid' => '1777967918.433', 'linkedid' => '1777967918.433', 'eventtype' => 'LINKEDID_END', 'eventtime' => '2026-05-05 10:00:09', 'cid_name' => 'Bob', 'cid_num' => '208', 'cid_ani' => '208', 'cid_dnid' => '201', 'exten' => 'h', 'channame' => 'PJSIP/208-0000000a')),
    );
}

function cel_row($values) {
    return array_merge(
        array(
            'uniqueid' => '',
            'linkedid' => '',
            'eventtype' => '',
            'eventtime' => '',
            'cid_name' => '',
            'cid_num' => '',
            'cid_ani' => '',
            'cid_rdnis' => '',
            'cid_dnid' => '',
            'exten' => '',
            'channame' => '',
            'peer' => '',
            'appname' => '',
            'appdata' => '',
            'accountcode' => '',
            'extra' => '',
        ),
        $values
    );
}

function bridge_extra($bridgeId) {
    return json_encode(array('bridge_id' => $bridgeId));
}