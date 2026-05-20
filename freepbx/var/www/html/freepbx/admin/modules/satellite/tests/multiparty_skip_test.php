#!/usr/bin/env php
<?php

require_once __DIR__ . '/bootstrap.php';

satellite_test_bootstrap(array(
    'SATELLITE_CALL_SUMMARY_ENABLED' => 'False',
));

// --- Helpers --------------------------------------------------------------

function make_cel_row($eventType, $extra = array()) {
    return array_merge(array(
        'eventtype' => $eventType,
        'eventtime' => '2026-01-01 10:00:00',
        'channame' => 'PJSIP/201-00000001',
        'uniqueid' => '1777277927.1',
        'linkedid' => '1777277927.1',
    ), $extra);
}

function make_cdr_row($lastapp, $extra = array()) {
    return array_merge(array(
        'calldate' => '2026-01-01 10:00:00',
        'src' => '201',
        'dst' => '202',
        'channel' => 'PJSIP/201-00000001',
        'dstchannel' => 'PJSIP/202-00000002',
        'lastapp' => $lastapp,
        'disposition' => 'ANSWERED',
        'linkedid' => '1777277927.1',
        'uniqueid' => '1777277927.1',
        'sequence' => 1,
    ), $extra);
}

// --- Direct 2P call: must NOT be skipped ----------------------------------

$direct2pCel = array(
    make_cel_row('CHAN_START'),
    make_cel_row('ANSWER'),
    make_cel_row('BRIDGE_ENTER'),
    make_cel_row('BRIDGE_EXIT'),
    make_cel_row('HANGUP'),
);
$direct2pCdr = array(
    make_cdr_row('Dial'),
);
assert_same(
    null,
    detect_multiparty_call($direct2pCel, $direct2pCdr),
    'Direct 2P call must NOT be flagged as multi-party'
);

// --- Queue call with single answering agent: must NOT be skipped ----------
// Queues just produce multiple Dial attempts; no transfer/conf markers.

$queueCel = array(
    make_cel_row('CHAN_START'),
    make_cel_row('APP_START', array('appname' => 'Queue')),
    make_cel_row('ANSWER'),
    make_cel_row('BRIDGE_ENTER'),
    make_cel_row('BRIDGE_EXIT'),
    make_cel_row('HANGUP'),
);
$queueCdr = array(
    make_cdr_row('Queue'),
    make_cdr_row('Dial', array('dst' => '301', 'disposition' => 'NO ANSWER', 'sequence' => 2)),
    make_cdr_row('Dial', array('dst' => '302', 'disposition' => 'ANSWERED', 'sequence' => 3)),
);
assert_same(
    null,
    detect_multiparty_call($queueCel, $queueCdr),
    'Queue call with single answering agent must NOT be flagged as multi-party'
);

// --- Blind transfer: MUST be skipped --------------------------------------

$blindCel = array(
    make_cel_row('CHAN_START'),
    make_cel_row('ANSWER'),
    make_cel_row('BRIDGE_ENTER'),
    make_cel_row('BLINDTRANSFER'),
    make_cel_row('BRIDGE_EXIT'),
    make_cel_row('HANGUP'),
);
$blindCdr = array(make_cdr_row('Dial'));
assert_same(
    'transfer',
    detect_multiparty_call($blindCel, $blindCdr),
    'Blind transfer must be flagged as multi-party'
);

// --- Attended transfer: MUST be skipped -----------------------------------

$attendedCel = array(
    make_cel_row('CHAN_START'),
    make_cel_row('ANSWER'),
    make_cel_row('BRIDGE_ENTER'),
    make_cel_row('ATTENDEDTRANSFER'),
    make_cel_row('BRIDGE_EXIT'),
    make_cel_row('HANGUP'),
);
$attendedCdr = array(make_cdr_row('Dial'));
assert_same(
    'transfer',
    detect_multiparty_call($attendedCel, $attendedCdr),
    'Attended transfer must be flagged as multi-party'
);

// --- Conference (ConfBridge): MUST be skipped -----------------------------

$confCel = array(
    make_cel_row('CHAN_START'),
    make_cel_row('ANSWER'),
    make_cel_row('APP_START', array('appname' => 'ConfBridge')),
    make_cel_row('HANGUP'),
);
$confCdr = array(make_cdr_row('ConfBridge'));
assert_same(
    'conference',
    detect_multiparty_call($confCel, $confCdr),
    'ConfBridge call must be flagged as multi-party'
);

// --- Case-insensitive ConfBridge match ------------------------------------

$confCdrLower = array(make_cdr_row('confbridge'));
assert_same(
    'conference',
    detect_multiparty_call(array(make_cel_row('CHAN_START')), $confCdrLower),
    'ConfBridge match must be case-insensitive'
);

// --- Empty inputs: must NOT crash and must return null --------------------

assert_same(
    null,
    detect_multiparty_call(array(), array()),
    'Empty CEL and CDR rows must return null (no crash)'
);
assert_same(
    null,
    detect_multiparty_call(null, null),
    'Null CEL and CDR rows must return null (no crash)'
);

// --- Conference wins over a transfer event (deterministic order) ----------

$mixedCel = array(make_cel_row('BLINDTRANSFER'));
$mixedCdr = array(make_cdr_row('ConfBridge'));
assert_same(
    'conference',
    detect_multiparty_call($mixedCel, $mixedCdr),
    'When both markers are present, conference takes precedence'
);

// --- Voicemail leg: MUST be skipped when uniqueid matches -----------------
// Scenario: blind transfer to 202, 202 does not answer → goes to VoiceMail.
// The Local/202 leg CDR row has lastapp=VoiceMail and its own uniqueid.

$vmCdr = array(
    make_cdr_row('Dial',      array('uniqueid' => '1779181281.146', 'linkedid' => '1779181281.146')),
    make_cdr_row('VoiceMail', array('uniqueid' => '1779181293.173', 'linkedid' => '1779181281.146')),
);
$vmCel = array(make_cel_row('CHAN_START'));

// The voicemail leg uniqueid → must be skipped
assert_same(
    'voicemail',
    detect_multiparty_call($vmCel, $vmCdr, '1779181293.173'),
    'VoiceMail leg must be flagged and skipped'
);

// The main call uniqueid for the same linkedid → must NOT be skipped
assert_same(
    null,
    detect_multiparty_call($vmCel, $vmCdr, '1779181281.146'),
    'Main call must NOT be skipped because a sibling leg went to voicemail'
);

// Without uniqueid the voicemail check is inactive → no skip
assert_same(
    null,
    detect_multiparty_call($vmCel, $vmCdr),
    'Voicemail skip must be inactive when no uniqueid is passed'
);

fwrite(STDOUT, "ok - multi-party skip detection regression\n");
