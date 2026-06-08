#!/usr/bin/env php
<?php

require_once __DIR__ . '/bootstrap.php';

satellite_test_bootstrap(array(
    'SATELLITE_CALL_SUMMARY_ENABLED' => 'False',
));

// --- Helpers --------------------------------------------------------------

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

assert_same(
    null,
    detect_voicemail_leg(array(make_cdr_row('Dial'))),
    'Direct 2P call must NOT be skipped'
);

// --- Transfer / conference: now transcribed, must NOT be skipped ----------
// detect_voicemail_leg only looks at voicemail; transfer/conference legs go
// through the segmentation pipeline.

assert_same(
    null,
    detect_voicemail_leg(array(make_cdr_row('ConfBridge'))),
    'Conference (ConfBridge) must NOT be skipped'
);
assert_same(
    null,
    detect_voicemail_leg(array(make_cdr_row('Dial')), '1777277927.1'),
    'Transfer leg (Dial) must NOT be skipped'
);

// --- Empty inputs: must NOT crash and must return null --------------------

assert_same(
    null,
    detect_voicemail_leg(array()),
    'Empty CDR rows must return null (no crash)'
);
assert_same(
    null,
    detect_voicemail_leg(null),
    'Null CDR rows must return null (no crash)'
);

// --- Voicemail leg: MUST be skipped when uniqueid matches -----------------
// Scenario: blind transfer to 202, 202 does not answer → goes to VoiceMail.
// The Local/202 leg CDR row has lastapp=VoiceMail and its own uniqueid.

$vmCdr = array(
    make_cdr_row('Dial',      array('uniqueid' => '1779181281.146', 'linkedid' => '1779181281.146')),
    make_cdr_row('VoiceMail', array('uniqueid' => '1779181293.173', 'linkedid' => '1779181281.146')),
);

// The voicemail leg uniqueid → must be skipped
assert_same(
    'voicemail',
    detect_voicemail_leg($vmCdr, '1779181293.173'),
    'VoiceMail leg must be flagged and skipped'
);

// The main call uniqueid for the same linkedid → must NOT be skipped
assert_same(
    null,
    detect_voicemail_leg($vmCdr, '1779181281.146'),
    'Main call must NOT be skipped because a sibling leg went to voicemail'
);

// Without uniqueid the voicemail check is inactive → no skip
assert_same(
    null,
    detect_voicemail_leg($vmCdr),
    'Voicemail skip must be inactive when no uniqueid is passed'
);

fwrite(STDOUT, "ok - voicemail leg skip detection regression\n");
