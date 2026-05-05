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

define('SATELLITE_TRANSCRIPTION_LIBRARY_MODE', true);
putenv('DEBUG=0');

require_once dirname(__DIR__) . '/bin/satellite_transcript';

$celRows = external_attended_transfer_cel_rows();
$cdrRows = external_attended_transfer_cdr_rows();
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
$externalSegments = filter_superseded_segments($externalSegments, $celRows, '1777907274.715');
assert_same(array(), $externalSegments, 'Broad queue trunk recording should be skipped when a Local leg recording exists');

$queueRecordingContext = resolve_recording_context($celRows, '1777907275.722', '1777907274.715');
assert_true($queueRecordingContext['is_fallback'] === true, 'Queue member recording should use fallback context');
assert_same('Local/201@from-queue-00000009;2', $queueRecordingContext['primary_channel'], 'Queue member recording should anchor on the Local/201;2 leg');

$queueSegments = build_bridge_segments(
    $celRows,
    $queueRecordingContext['primary_channel'],
    $queueRecordingContext['start'],
    $queueRecordingContext['end']
);
$queueSegments = filter_superseded_segments($queueSegments, $celRows, '1777907275.722');
$queueSegments = normalize_local_channel_segments(
    $queueSegments,
    $celRows,
    $queueRecordingContext['start'],
    $queueRecordingContext['end']
);
$queueSegments = enrich_segments(
    $queueSegments,
    $cdrRows,
    $channelFacts,
    $usersByExtension,
    $queueRecordingContext['primary_channel'],
    '1777907275.722',
    '',
    ''
);
$queueSegments = coalesce_adjacent_segments($queueSegments);

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
$transferSegments = filter_superseded_segments($transferSegments, $celRows, '1777907286.754');
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
$transferSegments = coalesce_adjacent_segments($transferSegments);

$allSegments = array_merge($queueSegments, $transferSegments);

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

function external_attended_transfer_cdr_rows() {
    return array(
        cdr_row('2026-05-04 17:07:54', '3400069069', '401', 'ext-queues', 'PJSIP/Opensolution-0000001d', 'Local/201@from-queue-00000009;1', '1777907274.715', '1777907274.715', 41, 38, 'ANSWERED', 121, '3400069069', '3400069069', '', ''),
        cdr_row('2026-05-04 17:07:55', '3400069069', '201', 'from-internal', 'Local/201@from-queue-00000009;2', 'PJSIP/201-0000001e', '1777907275.722', '1777907274.715', 11, 9, 'ANSWERED', 123, '3400069069', '3400069069', 'Andrea Marchionni', '201'),
        cdr_row('2026-05-04 17:08:06', '3400069069', '202', 'from-internal', 'Local/202@from-internal-0000000a;2', 'PJSIP/202-0000001f', '1777907286.754', '1777907274.715', 29, 25, 'ANSWERED', 130, '201', 'Andrea Marchionni', 'Antonio Colapietro', '201'),
        cdr_row('2026-05-04 17:08:06', '201', 's', 'macro-dial-one', 'PJSIP/201-0000001e', 'Local/202@from-internal-0000000a;1', '1777907275.727', '1777907274.715', 18, 18, 'ANSWERED', 131, '', '', '', '201'),
        cdr_row('2026-05-04 17:08:24', '202', '202', 'from-internal', 'Local/202@from-internal-0000000a;1', '', '1777907286.752', '1777907274.715', 11, 11, 'ANSWERED', 137, '', '', '', '201'),
        cdr_row('2026-05-04 17:08:24', '3400069069', '201', 'from-internal', 'Local/201@from-queue-00000009;2', 'Local/202@from-internal-0000000a;1', '1777907275.722', '1777907274.715', 11, 11, 'ANSWERED', 138, '3400069069', '3400069069', 'Andrea Marchionni', '201'),
    );
}

function cdr_row($calldate, $src, $dst, $dcontext, $channel, $dstchannel, $uniqueid, $linkedid, $duration, $billsec, $disposition, $sequence, $cnum, $cnam, $dstCnam, $accountcode) {
    return array(
        'calldate' => $calldate,
        'src' => $src,
        'dst' => $dst,
        'dcontext' => $dcontext,
        'channel' => $channel,
        'dstchannel' => $dstchannel,
        'uniqueid' => $uniqueid,
        'linkedid' => $linkedid,
        'duration' => (string) $duration,
        'billsec' => (string) $billsec,
        'disposition' => $disposition,
        'sequence' => (string) $sequence,
        'cnum' => $cnum,
        'cnam' => $cnam,
        'dst_cnam' => $dstCnam,
        'accountcode' => $accountcode,
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
