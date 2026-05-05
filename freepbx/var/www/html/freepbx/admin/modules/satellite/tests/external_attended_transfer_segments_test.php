#!/usr/bin/env php
<?php

/*
 * Regression case:
 * 1. An external caller reaches extension 201 through a queue.
 * 2. Extension 201 starts an attended transfer to extension 202.
 * 3. Extension 201 finalizes the transfer.
 * 4. The external caller and extension 202 keep speaking together.
 *
 * Expected transcription segments:
 * - 3400069069 -> Andrea Marchionni (201)
 * - Andrea Marchionni (201) -> Antonio Colapietro (202)
 * - 3400069069 -> Antonio Colapietro (202)
 */

require_once __DIR__ . '/bootstrap.php';

satellite_test_bootstrap();

$celRows = external_attended_transfer_cel_rows();
$cdrRows = array();
$usersByExtension = array(
    '201' => 'Andrea Marchionni',
    '202' => 'Antonio Colapietro',
);

$channelFacts = build_channel_facts($celRows, $cdrRows);

$externalRecordingContext = resolve_recording_context($celRows, '1777907274.715', '1777907274.715');
assert_true($externalRecordingContext['is_fallback'] === true, 'External recording should use fallback context');
assert_same('PJSIP/Opensolution-0000001d', $externalRecordingContext['primary_channel'], 'External recording should anchor on the trunk leg');
assert_same('2026-05-04 17:07:54', format_time($externalRecordingContext['start']), 'External recording should start from the trunk CHAN_START time');

$externalSegments = build_bridge_segments(
    $celRows,
    $externalRecordingContext['primary_channel'],
    $externalRecordingContext['start'],
    $externalRecordingContext['end']
);
$externalSegments = normalize_local_channel_segments(
    $externalSegments,
    $celRows,
    $externalRecordingContext['start'],
    $externalRecordingContext['end']
);
$externalSegments = enrich_segments(
    $externalSegments,
    $cdrRows,
    $channelFacts,
    $usersByExtension,
    $externalRecordingContext['primary_channel'],
    '1777907274.715',
    '',
    ''
);

$transferRecordingContext = resolve_recording_context($celRows, '1777907286.754', '1777907274.715');
assert_true($transferRecordingContext['is_fallback'] === true, 'Transfer recording should use fallback context');
assert_same('Local/202@from-internal-0000000a;2', $transferRecordingContext['primary_channel'], 'Transfer recording should anchor on the Local/202;2 leg');
assert_same('2026-05-04 17:08:06', format_time($transferRecordingContext['start']), 'Transfer recording should start from the Local leg CHAN_START time');

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
    '1777907286.754',
    '',
    ''
);

$allSegments = array_merge($externalSegments, $transferSegments);

assert_segment_labels(
    array(
        '3400069069 -> Andrea Marchionni (201)',
        'Andrea Marchionni (201) -> Antonio Colapietro (202)',
        '3400069069 -> Antonio Colapietro (202)',
    ),
    $allSegments,
    'External attended transfer should produce the three expected transcription segments'
);

fwrite(STDOUT, "ok - external attended transfer regression\n");

function external_attended_transfer_cel_rows() {
    return array(
        array('uniqueid' => '1777907274.715', 'linkedid' => '1777907274.715', 'eventtype' => 'CHAN_START', 'eventtime' => '2026-05-04 17:07:54', 'cid_name' => '', 'cid_num' => '3400069069', 'cid_ani' => '', 'cid_dnid' => '', 'channame' => 'PJSIP/Opensolution-0000001d', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '', 'exten' => '507211748905', 'extra' => ''),
        array('uniqueid' => '1777907274.715', 'linkedid' => '1777907274.715', 'eventtype' => 'ANSWER', 'eventtime' => '2026-05-04 17:07:54', 'cid_name' => '3400069069', 'cid_num' => '3400069069', 'cid_ani' => '3400069069', 'cid_dnid' => '507211748905', 'channame' => 'PJSIP/Opensolution-0000001d', 'peer' => '', 'appname' => 'Answer', 'appdata' => '', 'accountcode' => '', 'exten' => '401', 'extra' => ''),
        array('uniqueid' => '1777907274.715', 'linkedid' => '1777907274.715', 'eventtype' => 'APP_START', 'eventtime' => '2026-05-04 17:07:55', 'cid_name' => '3400069069', 'cid_num' => '3400069069', 'cid_ani' => '3400069069', 'cid_dnid' => '507211748905', 'channame' => 'PJSIP/Opensolution-0000001d', 'peer' => '', 'appname' => 'MixMonitor', 'appdata' => ',br(/var/run/nethvoice/satellite-r-1777907274.715-1777907274.715.wav)t(/var/run/nethvoice/satellite-t-1777907274.715-1777907274.715.wav)i(1777907274.715-1777907274.715),/var/lib/asterisk/bin/satellite_transcript -u 1777907274.715 -l 1777907274.715', 'accountcode' => '', 'exten' => 's', 'extra' => ''),
        array('uniqueid' => '1777907274.715', 'linkedid' => '1777907274.715', 'eventtype' => 'APP_END', 'eventtime' => '2026-05-04 17:07:55', 'cid_name' => '3400069069', 'cid_num' => '3400069069', 'cid_ani' => '3400069069', 'cid_dnid' => '507211748905', 'channame' => 'PJSIP/Opensolution-0000001d', 'peer' => '', 'appname' => 'MixMonitor', 'appdata' => ',br(/var/run/nethvoice/satellite-r-1777907274.715-1777907274.715.wav)t(/var/run/nethvoice/satellite-t-1777907274.715-1777907274.715.wav)i(1777907274.715-1777907274.715),/var/lib/asterisk/bin/satellite_transcript -u 1777907274.715 -l 1777907274.715', 'accountcode' => '', 'exten' => 's', 'extra' => ''),
        array('uniqueid' => '1777907274.715', 'linkedid' => '1777907274.715', 'eventtype' => 'APP_START', 'eventtime' => '2026-05-04 17:07:55', 'cid_name' => '3400069069', 'cid_num' => '3400069069', 'cid_ani' => '3400069069', 'cid_dnid' => '507211748905', 'channame' => 'PJSIP/Opensolution-0000001d', 'peer' => '', 'appname' => 'Queue', 'appdata' => '401,t,,,,,,,,', 'accountcode' => '', 'exten' => '401', 'extra' => ''),
        array('uniqueid' => '1777907275.721', 'linkedid' => '1777907274.715', 'eventtype' => 'CHAN_START', 'eventtime' => '2026-05-04 17:07:55', 'cid_name' => '', 'cid_num' => '', 'cid_ani' => '', 'cid_dnid' => '', 'channame' => 'Local/201@from-queue-00000009;1', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '', 'exten' => '201', 'extra' => ''),
        array('uniqueid' => '1777907275.722', 'linkedid' => '1777907274.715', 'eventtype' => 'CHAN_START', 'eventtime' => '2026-05-04 17:07:55', 'cid_name' => '', 'cid_num' => '', 'cid_ani' => '', 'cid_dnid' => '', 'channame' => 'Local/201@from-queue-00000009;2', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '', 'exten' => '201', 'extra' => ''),
        array('uniqueid' => '1777907275.722', 'linkedid' => '1777907274.715', 'eventtype' => 'APP_START', 'eventtime' => '2026-05-04 17:07:55', 'cid_name' => '3400069069', 'cid_num' => '3400069069', 'cid_ani' => '3400069069', 'cid_dnid' => '', 'channame' => 'Local/201@from-queue-00000009;2', 'peer' => '', 'appname' => 'MixMonitor', 'appdata' => ',br(/var/run/nethvoice/satellite-r-1777907275.722-1777907274.715.wav)t(/var/run/nethvoice/satellite-t-1777907275.722-1777907274.715.wav)i(1777907275.722-1777907274.715),/var/lib/asterisk/bin/satellite_transcript -u 1777907275.722 -l 1777907274.715', 'accountcode' => '', 'exten' => 's', 'extra' => ''),
        array('uniqueid' => '1777907275.722', 'linkedid' => '1777907274.715', 'eventtype' => 'APP_END', 'eventtime' => '2026-05-04 17:07:55', 'cid_name' => '3400069069', 'cid_num' => '3400069069', 'cid_ani' => '3400069069', 'cid_dnid' => '', 'channame' => 'Local/201@from-queue-00000009;2', 'peer' => '', 'appname' => 'MixMonitor', 'appdata' => ',br(/var/run/nethvoice/satellite-r-1777907275.722-1777907274.715.wav)t(/var/run/nethvoice/satellite-t-1777907275.722-1777907274.715.wav)i(1777907275.722-1777907274.715),/var/lib/asterisk/bin/satellite_transcript -u 1777907275.722 -l 1777907274.715', 'accountcode' => '', 'exten' => 's', 'extra' => ''),
        array('uniqueid' => '1777907275.727', 'linkedid' => '1777907274.715', 'eventtype' => 'CHAN_START', 'eventtime' => '2026-05-04 17:07:55', 'cid_name' => 'Andrea Marchionni', 'cid_num' => '201', 'cid_ani' => '', 'cid_dnid' => '', 'channame' => 'PJSIP/201-0000001e', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '201', 'exten' => 's', 'extra' => ''),
        array('uniqueid' => '1777907275.727', 'linkedid' => '1777907274.715', 'eventtype' => 'ANSWER', 'eventtime' => '2026-05-04 17:07:57', 'cid_name' => 'Andrea Marchionni', 'cid_num' => '201', 'cid_ani' => '201', 'cid_dnid' => '', 'channame' => 'PJSIP/201-0000001e', 'peer' => '', 'appname' => 'AppDial', 'appdata' => '(Outgoing Line)', 'accountcode' => '201', 'exten' => '201', 'extra' => ''),
        array('uniqueid' => '1777907275.722', 'linkedid' => '1777907274.715', 'eventtype' => 'ANSWER', 'eventtime' => '2026-05-04 17:07:57', 'cid_name' => '3400069069', 'cid_num' => '3400069069', 'cid_ani' => '3400069069', 'cid_dnid' => '', 'channame' => 'Local/201@from-queue-00000009;2', 'peer' => '', 'appname' => 'Dial', 'appdata' => 'PJSIP/201/sip:201@134.209.198.176:57390,15,HhtrM(auto-blkvm)IU(satellite^s^1)b(func-apply-sipheaders^s^1)', 'accountcode' => '', 'exten' => 's', 'extra' => ''),
        array('uniqueid' => '1777907275.721', 'linkedid' => '1777907274.715', 'eventtype' => 'ANSWER', 'eventtime' => '2026-05-04 17:07:57', 'cid_name' => '', 'cid_num' => '507211748905', 'cid_ani' => '', 'cid_dnid' => '', 'channame' => 'Local/201@from-queue-00000009;1', 'peer' => '', 'appname' => 'AppQueue', 'appdata' => '(Outgoing Line)', 'accountcode' => '', 'exten' => '401', 'extra' => ''),
        array('uniqueid' => '1777907275.727', 'linkedid' => '1777907274.715', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-05-04 17:07:57', 'cid_name' => 'Andrea Marchionni', 'cid_num' => '201', 'cid_ani' => '201', 'cid_dnid' => '', 'channame' => 'PJSIP/201-0000001e', 'peer' => '', 'appname' => 'AppDial', 'appdata' => '(Outgoing Line)', 'accountcode' => '201', 'exten' => 's', 'extra' => json_encode(array('bridge_id' => 'b201'))),
        array('uniqueid' => '1777907275.722', 'linkedid' => '1777907274.715', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-05-04 17:07:57', 'cid_name' => '3400069069', 'cid_num' => '3400069069', 'cid_ani' => '3400069069', 'cid_dnid' => '', 'channame' => 'Local/201@from-queue-00000009;2', 'peer' => 'PJSIP/201-0000001e', 'appname' => 'Dial', 'appdata' => 'PJSIP/201/sip:201@134.209.198.176:57390,15,HhtrM(auto-blkvm)IU(satellite^s^1)b(func-apply-sipheaders^s^1)', 'accountcode' => '', 'exten' => 's', 'extra' => json_encode(array('bridge_id' => 'b201'))),
        array('uniqueid' => '1777907275.721', 'linkedid' => '1777907274.715', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-05-04 17:07:57', 'cid_name' => '', 'cid_num' => '507211748905', 'cid_ani' => '', 'cid_dnid' => '', 'channame' => 'Local/201@from-queue-00000009;1', 'peer' => '', 'appname' => 'AppQueue', 'appdata' => '(Outgoing Line)', 'accountcode' => '', 'exten' => '401', 'extra' => json_encode(array('bridge_id' => 'bext'))),
        array('uniqueid' => '1777907274.715', 'linkedid' => '1777907274.715', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-05-04 17:07:57', 'cid_name' => '3400069069', 'cid_num' => '3400069069', 'cid_ani' => '3400069069', 'cid_dnid' => '507211748905', 'channame' => 'PJSIP/Opensolution-0000001d', 'peer' => 'Local/201@from-queue-00000009;1', 'appname' => 'Queue', 'appdata' => '401,t,,,,,,,,', 'accountcode' => '', 'exten' => '401', 'extra' => json_encode(array('bridge_id' => 'bext'))),
        array('uniqueid' => '1777907286.752', 'linkedid' => '1777907274.715', 'eventtype' => 'CHAN_START', 'eventtime' => '2026-05-04 17:08:06', 'cid_name' => '', 'cid_num' => '', 'cid_ani' => '', 'cid_dnid' => '', 'channame' => 'Local/202@from-internal-0000000a;1', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '201', 'exten' => '202', 'extra' => ''),
        array('uniqueid' => '1777907286.754', 'linkedid' => '1777907274.715', 'eventtype' => 'CHAN_START', 'eventtime' => '2026-05-04 17:08:06', 'cid_name' => '', 'cid_num' => '', 'cid_ani' => '', 'cid_dnid' => '', 'channame' => 'Local/202@from-internal-0000000a;2', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '201', 'exten' => '202', 'extra' => ''),
        array('uniqueid' => '1777907286.752', 'linkedid' => '1777907274.715', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-05-04 17:08:06', 'cid_name' => '', 'cid_num' => '', 'cid_ani' => '', 'cid_dnid' => '', 'channame' => 'Local/202@from-internal-0000000a;1', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '201', 'exten' => '202', 'extra' => json_encode(array('bridge_id' => 'bconsult'))),
        array('uniqueid' => '1777907275.727', 'linkedid' => '1777907274.715', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-05-04 17:08:06', 'cid_name' => 'Andrea Marchionni', 'cid_num' => '201', 'cid_ani' => '201', 'cid_dnid' => '', 'channame' => 'PJSIP/201-0000001e', 'peer' => 'Local/201@from-queue-00000009;2', 'appname' => 'AppDial', 'appdata' => '(Outgoing Line)', 'accountcode' => '201', 'exten' => 's', 'extra' => json_encode(array('bridge_id' => 'b201'))),
        array('uniqueid' => '1777907275.727', 'linkedid' => '1777907274.715', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-05-04 17:08:06', 'cid_name' => 'Andrea Marchionni', 'cid_num' => '201', 'cid_ani' => '201', 'cid_dnid' => '', 'channame' => 'PJSIP/201-0000001e', 'peer' => 'Local/202@from-internal-0000000a;1', 'appname' => 'AppDial', 'appdata' => '(Outgoing Line)', 'accountcode' => '201', 'exten' => 's', 'extra' => json_encode(array('bridge_id' => 'bconsult'))),
        array('uniqueid' => '1777907286.754', 'linkedid' => '1777907274.715', 'eventtype' => 'APP_START', 'eventtime' => '2026-05-04 17:08:07', 'cid_name' => 'Andrea Marchionni', 'cid_num' => '201', 'cid_ani' => '201', 'cid_dnid' => '', 'channame' => 'Local/202@from-internal-0000000a;2', 'peer' => '', 'appname' => 'MixMonitor', 'appdata' => ',br(/var/run/nethvoice/satellite-r-1777907286.754-1777907274.715.wav)t(/var/run/nethvoice/satellite-t-1777907286.754-1777907274.715.wav)i(1777907286.754-1777907274.715),/var/lib/asterisk/bin/satellite_transcript -u 1777907286.754 -l 1777907274.715', 'accountcode' => '201', 'exten' => 's', 'extra' => ''),
        array('uniqueid' => '1777907286.754', 'linkedid' => '1777907274.715', 'eventtype' => 'APP_END', 'eventtime' => '2026-05-04 17:08:07', 'cid_name' => 'Andrea Marchionni', 'cid_num' => '201', 'cid_ani' => '201', 'cid_dnid' => '', 'channame' => 'Local/202@from-internal-0000000a;2', 'peer' => '', 'appname' => 'MixMonitor', 'appdata' => ',br(/var/run/nethvoice/satellite-r-1777907286.754-1777907274.715.wav)t(/var/run/nethvoice/satellite-t-1777907286.754-1777907274.715.wav)i(1777907286.754-1777907274.715),/var/lib/asterisk/bin/satellite_transcript -u 1777907286.754 -l 1777907274.715', 'accountcode' => '201', 'exten' => 's', 'extra' => ''),
        array('uniqueid' => '1777907287.761', 'linkedid' => '1777907274.715', 'eventtype' => 'CHAN_START', 'eventtime' => '2026-05-04 17:08:07', 'cid_name' => 'Antonio Colapietro', 'cid_num' => '202', 'cid_ani' => '', 'cid_dnid' => '', 'channame' => 'PJSIP/202-0000001f', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '202', 'exten' => 's', 'extra' => ''),
        array('uniqueid' => '1777907287.761', 'linkedid' => '1777907274.715', 'eventtype' => 'ANSWER', 'eventtime' => '2026-05-04 17:08:09', 'cid_name' => 'Antonio Colapietro', 'cid_num' => '202', 'cid_ani' => '202', 'cid_dnid' => '', 'channame' => 'PJSIP/202-0000001f', 'peer' => '', 'appname' => 'AppDial', 'appdata' => '(Outgoing Line)', 'accountcode' => '202', 'exten' => '202', 'extra' => ''),
        array('uniqueid' => '1777907286.754', 'linkedid' => '1777907274.715', 'eventtype' => 'ANSWER', 'eventtime' => '2026-05-04 17:08:10', 'cid_name' => 'Andrea Marchionni', 'cid_num' => '201', 'cid_ani' => '201', 'cid_dnid' => '', 'channame' => 'Local/202@from-internal-0000000a;2', 'peer' => '', 'appname' => 'Dial', 'appdata' => 'PJSIP/202/sip:202@134.209.198.176:48184,15,HhtrM(auto-blkvm)IU(satellite^s^1)b(func-apply-sipheaders^s^1)', 'accountcode' => '201', 'exten' => 's', 'extra' => ''),
        array('uniqueid' => '1777907286.752', 'linkedid' => '1777907274.715', 'eventtype' => 'ANSWER', 'eventtime' => '2026-05-04 17:08:10', 'cid_name' => 'Antonio Colapietro', 'cid_num' => '202', 'cid_ani' => '', 'cid_dnid' => '', 'channame' => 'Local/202@from-internal-0000000a;1', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '201', 'exten' => '202', 'extra' => ''),
        array('uniqueid' => '1777907287.761', 'linkedid' => '1777907274.715', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-05-04 17:08:10', 'cid_name' => 'Antonio Colapietro', 'cid_num' => '202', 'cid_ani' => '202', 'cid_dnid' => '', 'channame' => 'PJSIP/202-0000001f', 'peer' => '', 'appname' => 'AppDial', 'appdata' => '(Outgoing Line)', 'accountcode' => '202', 'exten' => 's', 'extra' => json_encode(array('bridge_id' => 'b202'))),
        array('uniqueid' => '1777907286.754', 'linkedid' => '1777907274.715', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-05-04 17:08:10', 'cid_name' => 'Andrea Marchionni', 'cid_num' => '201', 'cid_ani' => '201', 'cid_dnid' => '', 'channame' => 'Local/202@from-internal-0000000a;2', 'peer' => 'PJSIP/202-0000001f', 'appname' => 'Dial', 'appdata' => 'PJSIP/202/sip:202@134.209.198.176:48184,15,HhtrM(auto-blkvm)IU(satellite^s^1)b(func-apply-sipheaders^s^1)', 'accountcode' => '201', 'exten' => 's', 'extra' => json_encode(array('bridge_id' => 'b202'))),
        array('uniqueid' => '1777907275.727', 'linkedid' => '1777907274.715', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-05-04 17:08:24', 'cid_name' => 'Andrea Marchionni', 'cid_num' => '201', 'cid_ani' => '201', 'cid_dnid' => '', 'channame' => 'PJSIP/201-0000001e', 'peer' => 'Local/202@from-internal-0000000a;1', 'appname' => 'AppDial', 'appdata' => '(Outgoing Line)', 'accountcode' => '201', 'exten' => 's', 'extra' => json_encode(array('bridge_id' => 'bconsult'))),
        array('uniqueid' => '1777907286.752', 'linkedid' => '1777907274.715', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-05-04 17:08:24', 'cid_name' => 'Antonio Colapietro', 'cid_num' => '202', 'cid_ani' => '', 'cid_dnid' => '', 'channame' => 'Local/202@from-internal-0000000a;1', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '201', 'exten' => '202', 'extra' => json_encode(array('bridge_id' => 'bconsult'))),
        array('uniqueid' => '1777907286.752', 'linkedid' => '1777907274.715', 'eventtype' => 'BRIDGE_ENTER', 'eventtime' => '2026-05-04 17:08:24', 'cid_name' => 'Antonio Colapietro', 'cid_num' => '202', 'cid_ani' => '', 'cid_dnid' => '', 'channame' => 'Local/202@from-internal-0000000a;1', 'peer' => 'Local/201@from-queue-00000009;2', 'appname' => '', 'appdata' => '', 'accountcode' => '201', 'exten' => '202', 'extra' => json_encode(array('bridge_id' => 'b201'))),
        array('uniqueid' => '1777907275.727', 'linkedid' => '1777907274.715', 'eventtype' => 'ATTENDEDTRANSFER', 'eventtime' => '2026-05-04 17:08:24', 'cid_name' => 'Andrea Marchionni', 'cid_num' => '201', 'cid_ani' => '201', 'cid_dnid' => '', 'channame' => 'PJSIP/201-0000001e', 'peer' => '', 'appname' => 'AppDial', 'appdata' => '(Outgoing Line)', 'accountcode' => '201', 'exten' => 's', 'extra' => json_encode(array('bridge1_id' => 'b201', 'channel2_name' => 'PJSIP/201-0000001e', 'channel2_uniqueid' => '1777907275.727', 'bridge2_id' => 'bconsult', 'transferee_channel_name' => 'Local/201@from-queue-00000009;2', 'transferee_channel_uniqueid' => '1777907275.722', 'transfer_target_channel_name' => 'N/A', 'transfer_target_channel_uniqueid' => 'N/A'))),
        array('uniqueid' => '1777907275.727', 'linkedid' => '1777907274.715', 'eventtype' => 'HANGUP', 'eventtime' => '2026-05-04 17:08:24', 'cid_name' => 'Andrea Marchionni', 'cid_num' => '201', 'cid_ani' => '201', 'cid_dnid' => '', 'channame' => 'PJSIP/201-0000001e', 'peer' => '', 'appname' => 'AppDial', 'appdata' => '(Outgoing Line)', 'accountcode' => '201', 'exten' => 's', 'extra' => ''),
        array('uniqueid' => '1777907275.727', 'linkedid' => '1777907274.715', 'eventtype' => 'CHAN_END', 'eventtime' => '2026-05-04 17:08:24', 'cid_name' => 'Andrea Marchionni', 'cid_num' => '201', 'cid_ani' => '201', 'cid_dnid' => '', 'channame' => 'PJSIP/201-0000001e', 'peer' => '', 'appname' => 'AppDial', 'appdata' => '(Outgoing Line)', 'accountcode' => '201', 'exten' => 's', 'extra' => ''),
        array('uniqueid' => '1777907287.761', 'linkedid' => '1777907274.715', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-05-04 17:08:35', 'cid_name' => 'Antonio Colapietro', 'cid_num' => '202', 'cid_ani' => '202', 'cid_dnid' => '', 'channame' => 'PJSIP/202-0000001f', 'peer' => 'Local/202@from-internal-0000000a;2', 'appname' => 'AppDial', 'appdata' => '(Outgoing Line)', 'accountcode' => '202', 'exten' => 's', 'extra' => json_encode(array('bridge_id' => 'b202'))),
        array('uniqueid' => '1777907286.754', 'linkedid' => '1777907274.715', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-05-04 17:08:35', 'cid_name' => '3400069069', 'cid_num' => '3400069069', 'cid_ani' => '201', 'cid_dnid' => '', 'channame' => 'Local/202@from-internal-0000000a;2', 'peer' => '', 'appname' => 'Dial', 'appdata' => 'PJSIP/202/sip:202@134.209.198.176:48184,15,HhtrM(auto-blkvm)IU(satellite^s^1)b(func-apply-sipheaders^s^1)', 'accountcode' => '201', 'exten' => 'h', 'extra' => json_encode(array('bridge_id' => 'b202'))),
        array('uniqueid' => '1777907286.752', 'linkedid' => '1777907274.715', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-05-04 17:08:35', 'cid_name' => 'Antonio Colapietro', 'cid_num' => '202', 'cid_ani' => '', 'cid_dnid' => '', 'channame' => 'Local/202@from-internal-0000000a;1', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '201', 'exten' => '202', 'extra' => json_encode(array('bridge_id' => 'b201'))),
        array('uniqueid' => '1777907275.722', 'linkedid' => '1777907274.715', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-05-04 17:08:35', 'cid_name' => '3400069069', 'cid_num' => '3400069069', 'cid_ani' => '3400069069', 'cid_dnid' => '', 'channame' => 'Local/201@from-queue-00000009;2', 'peer' => '', 'appname' => 'Dial', 'appdata' => 'PJSIP/201/sip:201@134.209.198.176:57390,15,HhtrM(auto-blkvm)IU(satellite^s^1)b(func-apply-sipheaders^s^1)', 'accountcode' => '', 'exten' => 'h', 'extra' => json_encode(array('bridge_id' => 'b201'))),
        array('uniqueid' => '1777907275.721', 'linkedid' => '1777907274.715', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-05-04 17:08:35', 'cid_name' => 'Antonio Colapietro', 'cid_num' => '202', 'cid_ani' => '', 'cid_dnid' => '', 'channame' => 'Local/201@from-queue-00000009;1', 'peer' => '', 'appname' => 'AppQueue', 'appdata' => '(Outgoing Line)', 'accountcode' => '', 'exten' => '401', 'extra' => json_encode(array('bridge_id' => 'bext'))),
        array('uniqueid' => '1777907274.715', 'linkedid' => '1777907274.715', 'eventtype' => 'BRIDGE_EXIT', 'eventtime' => '2026-05-04 17:08:35', 'cid_name' => '3400069069', 'cid_num' => '3400069069', 'cid_ani' => '3400069069', 'cid_dnid' => '507211748905', 'channame' => 'PJSIP/Opensolution-0000001d', 'peer' => '', 'appname' => 'Queue', 'appdata' => '401,t,,,,,,,,', 'accountcode' => '', 'exten' => '401', 'extra' => json_encode(array('bridge_id' => 'bext'))),
        array('uniqueid' => '1777907274.715', 'linkedid' => '1777907274.715', 'eventtype' => 'APP_END', 'eventtime' => '2026-05-04 17:08:35', 'cid_name' => '3400069069', 'cid_num' => '3400069069', 'cid_ani' => '3400069069', 'cid_dnid' => '507211748905', 'channame' => 'PJSIP/Opensolution-0000001d', 'peer' => '', 'appname' => 'Queue', 'appdata' => '401,t,,,,,,,,', 'accountcode' => '', 'exten' => '401', 'extra' => ''),
        array('uniqueid' => '1777907274.715', 'linkedid' => '1777907274.715', 'eventtype' => 'HANGUP', 'eventtime' => '2026-05-04 17:08:35', 'cid_name' => '3400069069', 'cid_num' => '3400069069', 'cid_ani' => '3400069069', 'cid_dnid' => '507211748905', 'channame' => 'PJSIP/Opensolution-0000001d', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '', 'exten' => 'h', 'extra' => ''),
        array('uniqueid' => '1777907274.715', 'linkedid' => '1777907274.715', 'eventtype' => 'CHAN_END', 'eventtime' => '2026-05-04 17:08:35', 'cid_name' => '3400069069', 'cid_num' => '3400069069', 'cid_ani' => '3400069069', 'cid_dnid' => '507211748905', 'channame' => 'PJSIP/Opensolution-0000001d', 'peer' => '', 'appname' => '', 'appdata' => '', 'accountcode' => '', 'exten' => 'h', 'extra' => ''),
        array('uniqueid' => '1777907275.721', 'linkedid' => '1777907274.715', 'eventtype' => 'HANGUP', 'eventtime' => '2026-05-04 17:08:35', 'cid_name' => 'Antonio Colapietro', 'cid_num' => '202', 'cid_ani' => '', 'cid_dnid' => '', 'channame' => 'Local/201@from-queue-00000009;1', 'peer' => '', 'appname' => 'AppQueue', 'appdata' => '(Outgoing Line)', 'accountcode' => '', 'exten' => '401', 'extra' => ''),
        array('uniqueid' => '1777907275.721', 'linkedid' => '1777907274.715', 'eventtype' => 'CHAN_END', 'eventtime' => '2026-05-04 17:08:35', 'cid_name' => 'Antonio Colapietro', 'cid_num' => '202', 'cid_ani' => '', 'cid_dnid' => '', 'channame' => 'Local/201@from-queue-00000009;1', 'peer' => '', 'appname' => 'AppQueue', 'appdata' => '(Outgoing Line)', 'accountcode' => '', 'exten' => '401', 'extra' => ''),
        array('uniqueid' => '1777907274.715', 'linkedid' => '1777907274.715', 'eventtype' => 'LINKEDID_END', 'eventtime' => '2026-05-04 17:08:35', 'cid_name' => 'Antonio Colapietro', 'cid_num' => '202', 'cid_ani' => '', 'cid_dnid' => '', 'channame' => 'Local/201@from-queue-00000009;1', 'peer' => '', 'appname' => 'AppQueue', 'appdata' => '(Outgoing Line)', 'accountcode' => '', 'exten' => '401', 'extra' => ''),
    );
}