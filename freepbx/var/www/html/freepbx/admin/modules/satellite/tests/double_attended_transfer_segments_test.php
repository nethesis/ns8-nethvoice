#!/usr/bin/env php
<?php

/*
 * Regression case:
 * 1. Foo One calls Foo Two.
 * 2. Foo Two starts an attended transfer to Foo Three and they speak.
 * 3. Foo Two finalizes the transfer, so Foo One and Foo Three speak.
 * 4. Foo Three starts an attended transfer back to Foo Two and they speak.
 * 5. Foo Three finalizes the transfer, so Foo One and Foo Two speak again.
 *
 * Expected transcription segments:
 * - Foo One (201) -> Foo Two (202)
 * - Foo Two (202) -> Foo Three (203)
 * - Foo One (201) -> Foo Three (203)
 * - Foo Three (203) -> Foo Two (202)
 * - Foo One (201) -> Foo Two (202)
 *
 * The original SQL output omitted the `extra` bridge payload, so this fixture
 * adds bridge ids where the segment builder needs them to track membership.
 */

require_once __DIR__ . '/bootstrap.php';

satellite_test_bootstrap();

$celRows = double_attended_transfer_cel_rows();
$cdrRows = array();
$usersByExtension = array(
    '201' => 'Foo One',
    '202' => 'Foo Two',
    '203' => 'Foo Three',
);

$channelFacts = build_channel_facts($celRows, $cdrRows);

$firstLegSegments = build_bridge_segments(
    $celRows,
    'PJSIP/201-00000002',
    parse_time('2026-05-05 08:47:59'),
    parse_time('2026-05-05 08:48:13')
);
$firstLegSegments = enrich_segments(
    $firstLegSegments,
    $cdrRows,
    $channelFacts,
    $usersByExtension,
    'PJSIP/201-00000002',
    '1777963676.54',
    '',
    ''
);

$firstTransferSegments = build_recording_segments(
    $celRows,
    $cdrRows,
    $channelFacts,
    $usersByExtension,
    '1777963693.83',
    '1777963676.54',
    'Local/203@from-internal-00000000;2',
    '2026-05-05 08:48:13'
);

$secondTransferSegments = build_recording_segments(
    $celRows,
    $cdrRows,
    $channelFacts,
    $usersByExtension,
    '1777963727.143',
    '1777963676.54',
    'Local/202@from-internal-00000001;2',
    '2026-05-05 08:48:47'
);

$allSegments = array_merge($firstLegSegments, $firstTransferSegments, $secondTransferSegments);

assert_segment_labels(
    array(
        'Foo One (201) -> Foo Two (202)',
        'Foo Two (202) -> Foo Three (203)',
        'Foo One (201) -> Foo Three (203)',
        'Foo Three (203) -> Foo Two (202)',
        'Foo One (201) -> Foo Two (202)',
    ),
    $allSegments,
    'Double attended transfer should produce the five expected transcription segments'
);

fwrite(STDOUT, "ok - double attended transfer regression\n");

function build_recording_segments($celRows, $cdrRows, $channelFacts, $usersByExtension, $uniqueid, $linkedid, $expectedPrimaryChannel, $expectedStart) {
    $recordingContext = resolve_recording_context($celRows, $uniqueid, $linkedid);
    assert_same($expectedPrimaryChannel, $recordingContext['primary_channel'], 'Transfer recording should anchor on the expected Local leg');
    assert_same($expectedStart, format_time($recordingContext['start']), 'Transfer recording should start from the expected CHAN_START time');

    $segments = build_bridge_segments(
        $celRows,
        $recordingContext['primary_channel'],
        $recordingContext['start'],
        $recordingContext['end']
    );
    $segments = normalize_local_channel_segments(
        $segments,
        $celRows,
        $recordingContext['start'],
        $recordingContext['end']
    );
    $segments = enrich_segments(
        $segments,
        $cdrRows,
        $channelFacts,
        $usersByExtension,
        $recordingContext['primary_channel'],
        $uniqueid,
        '',
        ''
    );

    return coalesce_adjacent_segments($segments);
}

function double_attended_transfer_cel_rows() {
    return array(
        cel_row(array('uniqueid' => '1777963676.54', 'linkedid' => '1777963676.54', 'eventtype' => 'CHAN_START', 'eventtime' => '2026-05-05 08:47:56', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_dnid' => '202', 'exten' => '202', 'channame' => 'PJSIP/201-00000002')),
        cel_row(array('uniqueid' => '1777963676.60', 'linkedid' => '1777963676.54', 'eventtype' => 'CHAN_START', 'eventtime' => '2026-05-05 08:47:56', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'exten' => 's', 'channame' => 'PJSIP/202-00000003')),
        cel_row(array('uniqueid' => '1777963676.60', 'linkedid' => '1777963676.54', 'eventtype' => 'ANSWER', 'eventtime' => '2026-05-05 08:47:59', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'exten' => '202', 'channame' => 'PJSIP/202-00000003')),
        cel_row(array('uniqueid' => '1777963676.54', 'linkedid' => '1777963676.54', 'eventtype' => 'ANSWER', 'eventtime' => '2026-05-05 08:47:59', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '201', 'cid_dnid' => '202', 'exten' => 's', 'channame' => 'PJSIP/201-00000002')),
        cel_row(array('uniqueid' => '1777963676.60', 'linkedid' => '1777963676.54', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-05-05 08:47:59', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'peer' => 'PJSIP/201-00000002', 'channame' => 'PJSIP/202-00000003', 'extra' => bridge_extra('b1'))),
        cel_row(array('uniqueid' => '1777963676.54', 'linkedid' => '1777963676.54', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-05-05 08:47:59', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '201', 'cid_dnid' => '202', 'peer' => 'PJSIP/202-00000003', 'channame' => 'PJSIP/201-00000002', 'extra' => bridge_extra('b1'))),

        cel_row(array('uniqueid' => '1777963693.82', 'linkedid' => '1777963676.54', 'eventtype' => 'CHAN_START', 'eventtime' => '2026-05-05 08:48:13', 'exten' => '203', 'channame' => 'Local/203@from-internal-00000000;1')),
        cel_row(array('uniqueid' => '1777963693.83', 'linkedid' => '1777963676.54', 'eventtype' => 'CHAN_START', 'eventtime' => '2026-05-05 08:48:13', 'exten' => '203', 'channame' => 'Local/203@from-internal-00000000;2')),
        cel_row(array('uniqueid' => '1777963693.82', 'linkedid' => '1777963676.54', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-05-05 08:48:13', 'exten' => '203', 'peer' => 'PJSIP/202-00000003', 'channame' => 'Local/203@from-internal-00000000;1', 'extra' => bridge_extra('b2'))),
        cel_row(array('uniqueid' => '1777963676.60', 'linkedid' => '1777963676.54', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-05-05 08:48:13', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'channame' => 'PJSIP/202-00000003')),
        cel_row(array('uniqueid' => '1777963676.60', 'linkedid' => '1777963676.54', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-05-05 08:48:13', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'peer' => 'Local/203@from-internal-00000000;1', 'channame' => 'PJSIP/202-00000003', 'extra' => bridge_extra('b2'))),
        cel_row(array('uniqueid' => '1777963693.93', 'linkedid' => '1777963676.54', 'eventtype' => 'CHAN_START', 'eventtime' => '2026-05-05 08:48:13', 'cid_name' => 'Foo Three', 'cid_num' => '203', 'exten' => 's', 'channame' => 'PJSIP/203-00000004')),
        cel_row(array('uniqueid' => '1777963693.93', 'linkedid' => '1777963676.54', 'eventtype' => 'ANSWER', 'eventtime' => '2026-05-05 08:48:18', 'cid_name' => 'Foo Three', 'cid_num' => '203', 'cid_ani' => '203', 'exten' => '203', 'channame' => 'PJSIP/203-00000004')),
        cel_row(array('uniqueid' => '1777963693.83', 'linkedid' => '1777963676.54', 'eventtype' => 'ANSWER', 'eventtime' => '2026-05-05 08:48:18', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'exten' => 's', 'channame' => 'Local/203@from-internal-00000000;2')),
        cel_row(array('uniqueid' => '1777963693.82', 'linkedid' => '1777963676.54', 'eventtype' => 'ANSWER', 'eventtime' => '2026-05-05 08:48:18', 'cid_name' => 'Foo Three', 'cid_num' => '203', 'exten' => '203', 'channame' => 'Local/203@from-internal-00000000;1')),
        cel_row(array('uniqueid' => '1777963693.93', 'linkedid' => '1777963676.54', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-05-05 08:48:18', 'cid_name' => 'Foo Three', 'cid_num' => '203', 'cid_ani' => '203', 'peer' => 'Local/203@from-internal-00000000;2', 'channame' => 'PJSIP/203-00000004', 'extra' => bridge_extra('b3'))),
        cel_row(array('uniqueid' => '1777963693.83', 'linkedid' => '1777963676.54', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-05-05 08:48:18', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'peer' => 'PJSIP/203-00000004', 'channame' => 'Local/203@from-internal-00000000;2', 'extra' => bridge_extra('b3'))),
        cel_row(array('uniqueid' => '1777963676.60', 'linkedid' => '1777963676.54', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-05-05 08:48:29', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'channame' => 'PJSIP/202-00000003')),
        cel_row(array('uniqueid' => '1777963693.82', 'linkedid' => '1777963676.54', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-05-05 08:48:29', 'cid_name' => 'Foo Three', 'cid_num' => '203', 'exten' => '203', 'channame' => 'Local/203@from-internal-00000000;1')),
        cel_row(array('uniqueid' => '1777963693.82', 'linkedid' => '1777963676.54', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-05-05 08:48:29', 'cid_name' => 'Foo Three', 'cid_num' => '203', 'exten' => '203', 'peer' => 'PJSIP/201-00000002', 'channame' => 'Local/203@from-internal-00000000;1', 'extra' => bridge_extra('b1'))),
        cel_row(array('uniqueid' => '1777963676.60', 'linkedid' => '1777963676.54', 'eventtype' => 'ATTENDEDTRANSFER', 'eventtime' => '2026-05-05 08:48:29', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'channame' => 'PJSIP/202-00000003')),
        cel_row(array('uniqueid' => '1777963676.60', 'linkedid' => '1777963676.54', 'eventtype' => 'HANGUP', 'eventtime' => '2026-05-05 08:48:29', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'channame' => 'PJSIP/202-00000003')),
        cel_row(array('uniqueid' => '1777963676.60', 'linkedid' => '1777963676.54', 'eventtype' => 'CHAN_END', 'eventtime' => '2026-05-05 08:48:29', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'channame' => 'PJSIP/202-00000003')),

        cel_row(array('uniqueid' => '1777963727.141', 'linkedid' => '1777963676.54', 'eventtype' => 'CHAN_START', 'eventtime' => '2026-05-05 08:48:47', 'exten' => '202', 'channame' => 'Local/202@from-internal-00000001;1')),
        cel_row(array('uniqueid' => '1777963727.143', 'linkedid' => '1777963676.54', 'eventtype' => 'CHAN_START', 'eventtime' => '2026-05-05 08:48:47', 'exten' => '202', 'channame' => 'Local/202@from-internal-00000001;2')),
        cel_row(array('uniqueid' => '1777963727.141', 'linkedid' => '1777963676.54', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-05-05 08:48:47', 'exten' => '202', 'peer' => 'PJSIP/203-00000004', 'channame' => 'Local/202@from-internal-00000001;1', 'extra' => bridge_extra('b4'))),
        cel_row(array('uniqueid' => '1777963693.93', 'linkedid' => '1777963676.54', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-05-05 08:48:47', 'cid_name' => 'Foo Three', 'cid_num' => '203', 'cid_ani' => '203', 'channame' => 'PJSIP/203-00000004')),
        cel_row(array('uniqueid' => '1777963693.93', 'linkedid' => '1777963676.54', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-05-05 08:48:47', 'cid_name' => 'Foo Three', 'cid_num' => '203', 'cid_ani' => '203', 'peer' => 'Local/202@from-internal-00000001;1', 'channame' => 'PJSIP/203-00000004', 'extra' => bridge_extra('b4'))),
        cel_row(array('uniqueid' => '1777963727.152', 'linkedid' => '1777963676.54', 'eventtype' => 'CHAN_START', 'eventtime' => '2026-05-05 08:48:47', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'exten' => 's', 'channame' => 'PJSIP/202-00000005')),
        cel_row(array('uniqueid' => '1777963727.152', 'linkedid' => '1777963676.54', 'eventtype' => 'ANSWER', 'eventtime' => '2026-05-05 08:48:50', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'exten' => '202', 'channame' => 'PJSIP/202-00000005')),
        cel_row(array('uniqueid' => '1777963727.143', 'linkedid' => '1777963676.54', 'eventtype' => 'ANSWER', 'eventtime' => '2026-05-05 08:48:50', 'cid_name' => 'Foo Three', 'cid_num' => '203', 'cid_ani' => '203', 'exten' => 's', 'channame' => 'Local/202@from-internal-00000001;2')),
        cel_row(array('uniqueid' => '1777963727.141', 'linkedid' => '1777963676.54', 'eventtype' => 'ANSWER', 'eventtime' => '2026-05-05 08:48:50', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'exten' => '202', 'channame' => 'Local/202@from-internal-00000001;1')),
        cel_row(array('uniqueid' => '1777963727.152', 'linkedid' => '1777963676.54', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-05-05 08:48:50', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'peer' => 'Local/202@from-internal-00000001;2', 'channame' => 'PJSIP/202-00000005', 'extra' => bridge_extra('b5'))),
        cel_row(array('uniqueid' => '1777963727.143', 'linkedid' => '1777963676.54', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-05-05 08:48:50', 'cid_name' => 'Foo Three', 'cid_num' => '203', 'cid_ani' => '203', 'peer' => 'PJSIP/202-00000005', 'channame' => 'Local/202@from-internal-00000001;2', 'extra' => bridge_extra('b5'))),
        cel_row(array('uniqueid' => '1777963693.93', 'linkedid' => '1777963676.54', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-05-05 08:49:00', 'cid_name' => 'Foo Three', 'cid_num' => '203', 'cid_ani' => '203', 'channame' => 'PJSIP/203-00000004')),
        cel_row(array('uniqueid' => '1777963727.141', 'linkedid' => '1777963676.54', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-05-05 08:49:00', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'exten' => '202', 'channame' => 'Local/202@from-internal-00000001;1')),
        cel_row(array('uniqueid' => '1777963727.141', 'linkedid' => '1777963676.54', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-05-05 08:49:00', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'exten' => '202', 'peer' => 'Local/203@from-internal-00000000;2', 'channame' => 'Local/202@from-internal-00000001;1', 'extra' => bridge_extra('b3'))),
        cel_row(array('uniqueid' => '1777963693.93', 'linkedid' => '1777963676.54', 'eventtype' => 'ATTENDEDTRANSFER', 'eventtime' => '2026-05-05 08:49:00', 'cid_name' => 'Foo Three', 'cid_num' => '203', 'cid_ani' => '203', 'channame' => 'PJSIP/203-00000004')),
        cel_row(array('uniqueid' => '1777963693.93', 'linkedid' => '1777963676.54', 'eventtype' => 'HANGUP', 'eventtime' => '2026-05-05 08:49:00', 'cid_name' => 'Foo Three', 'cid_num' => '203', 'cid_ani' => '203', 'channame' => 'PJSIP/203-00000004')),
        cel_row(array('uniqueid' => '1777963693.93', 'linkedid' => '1777963676.54', 'eventtype' => 'CHAN_END', 'eventtime' => '2026-05-05 08:49:00', 'cid_name' => 'Foo Three', 'cid_num' => '203', 'cid_ani' => '203', 'channame' => 'PJSIP/203-00000004')),

        cel_row(array('uniqueid' => '1777963727.152', 'linkedid' => '1777963676.54', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-05-05 08:49:14', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'channame' => 'PJSIP/202-00000005')),
        cel_row(array('uniqueid' => '1777963727.143', 'linkedid' => '1777963676.54', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-05-05 08:49:14', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '203', 'channame' => 'Local/202@from-internal-00000001;2')),
        cel_row(array('uniqueid' => '1777963727.143', 'linkedid' => '1777963676.54', 'eventtype' => 'HANGUP', 'eventtime' => '2026-05-05 08:49:14', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '203', 'channame' => 'Local/202@from-internal-00000001;2')),
        cel_row(array('uniqueid' => '1777963727.143', 'linkedid' => '1777963676.54', 'eventtype' => 'CHAN_END', 'eventtime' => '2026-05-05 08:49:14', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '203', 'channame' => 'Local/202@from-internal-00000001;2')),
        cel_row(array('uniqueid' => '1777963727.141', 'linkedid' => '1777963676.54', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-05-05 08:49:14', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'exten' => '202', 'channame' => 'Local/202@from-internal-00000001;1')),
        cel_row(array('uniqueid' => '1777963727.152', 'linkedid' => '1777963676.54', 'eventtype' => 'HANGUP', 'eventtime' => '2026-05-05 08:49:14', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'channame' => 'PJSIP/202-00000005')),
        cel_row(array('uniqueid' => '1777963727.152', 'linkedid' => '1777963676.54', 'eventtype' => 'CHAN_END', 'eventtime' => '2026-05-05 08:49:14', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'cid_ani' => '202', 'channame' => 'PJSIP/202-00000005')),
        cel_row(array('uniqueid' => '1777963727.141', 'linkedid' => '1777963676.54', 'eventtype' => 'HANGUP', 'eventtime' => '2026-05-05 08:49:14', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'exten' => '202', 'channame' => 'Local/202@from-internal-00000001;1')),
        cel_row(array('uniqueid' => '1777963727.141', 'linkedid' => '1777963676.54', 'eventtype' => 'CHAN_END', 'eventtime' => '2026-05-05 08:49:14', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'exten' => '202', 'channame' => 'Local/202@from-internal-00000001;1')),
        cel_row(array('uniqueid' => '1777963693.83', 'linkedid' => '1777963676.54', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-05-05 08:49:14', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '202', 'channame' => 'Local/203@from-internal-00000000;2')),

        cel_row(array('uniqueid' => '1777963693.82', 'linkedid' => '1777963676.54', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-05-05 08:49:16', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'exten' => '203', 'channame' => 'Local/203@from-internal-00000000;1')),
        cel_row(array('uniqueid' => '1777963693.83', 'linkedid' => '1777963676.54', 'eventtype' => 'HANGUP', 'eventtime' => '2026-05-05 08:49:16', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '202', 'channame' => 'Local/203@from-internal-00000000;2')),
        cel_row(array('uniqueid' => '1777963693.83', 'linkedid' => '1777963676.54', 'eventtype' => 'CHAN_END', 'eventtime' => '2026-05-05 08:49:16', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '202', 'channame' => 'Local/203@from-internal-00000000;2')),
        cel_row(array('uniqueid' => '1777963693.82', 'linkedid' => '1777963676.54', 'eventtype' => 'HANGUP', 'eventtime' => '2026-05-05 08:49:16', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'exten' => '203', 'channame' => 'Local/203@from-internal-00000000;1')),
        cel_row(array('uniqueid' => '1777963693.82', 'linkedid' => '1777963676.54', 'eventtype' => 'CHAN_END', 'eventtime' => '2026-05-05 08:49:16', 'cid_name' => 'Foo Two', 'cid_num' => '202', 'exten' => '203', 'channame' => 'Local/203@from-internal-00000000;1')),
        cel_row(array('uniqueid' => '1777963676.54', 'linkedid' => '1777963676.54', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-05-05 08:49:16', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '201', 'cid_dnid' => '202', 'exten' => 's', 'channame' => 'PJSIP/201-00000002')),
        cel_row(array('uniqueid' => '1777963676.54', 'linkedid' => '1777963676.54', 'eventtype' => 'HANGUP', 'eventtime' => '2026-05-05 08:49:16', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '201', 'cid_dnid' => '202', 'exten' => 'h', 'channame' => 'PJSIP/201-00000002')),
        cel_row(array('uniqueid' => '1777963676.54', 'linkedid' => '1777963676.54', 'eventtype' => 'CHAN_END', 'eventtime' => '2026-05-05 08:49:16', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '201', 'cid_dnid' => '202', 'exten' => 'h', 'channame' => 'PJSIP/201-00000002')),
        cel_row(array('uniqueid' => '1777963676.54', 'linkedid' => '1777963676.54', 'eventtype' => 'LINKEDID_END', 'eventtime' => '2026-05-05 08:49:16', 'cid_name' => 'Foo One', 'cid_num' => '201', 'cid_ani' => '201', 'cid_dnid' => '202', 'exten' => 'h', 'channame' => 'PJSIP/201-00000002')),
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