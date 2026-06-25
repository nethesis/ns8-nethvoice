#!/usr/bin/env php
<?php

require_once __DIR__ . '/bootstrap.php';

satellite_test_bootstrap();

$segments = array(
    array(
        'caller_num' => '3401234567',
        'callee_num' => '201',
    ),
    array(
        'caller_num' => '201',
        'callee_num' => '202',
    ),
    array(
        'caller_num' => '201',
        'callee_num' => '',
    ),
);

assert_same(
    array('3401234567', '201', '202'),
    collect_segment_party_extensions($segments),
    'Segment permission gate must collect unique caller and callee numbers'
);

assert_same(
    array('202'),
    filter_extensions_with_satellite_stt_permission(
        collect_segment_party_extensions($segments),
        array('202' => true)
    ),
    'One permitted party must be enough to allow transcription'
);

assert_same(
    array('201'),
    filter_extensions_with_satellite_stt_permission(
        collect_segment_party_extensions($segments),
        array('201' => true)
    ),
    'Caller permission must allow transcription'
);

assert_same(
    array(),
    filter_extensions_with_satellite_stt_permission(
        collect_segment_party_extensions($segments),
        array('203' => true)
    ),
    'Transcription must be skipped when no call party has satellite_stt permission'
);

assert_same(
    array(),
    filter_extensions_with_satellite_stt_permission(array(), array('201' => true)),
    'Empty party lists must not authorize transcription'
);

assert_same(
    array('201', '202'),
    filter_registered_user_extensions(
        collect_segment_party_extensions($segments),
        array('201' => 'Alice', '202' => 'Bob')
    ),
    'External numbers must not be reported as registered user extensions'
);

$transferSegments = array(
    array(
        'caller_num' => '201',
        'callee_num' => '202',
        'label' => 'before transfer',
    ),
    array(
        'caller_num' => '202',
        'callee_num' => '203',
        'label' => 'after transfer',
    ),
);

assert_same(
    array($transferSegments[0]),
    filter_segments_with_satellite_stt_permission($transferSegments, array('201' => true)),
    'Permission from one segment party must not authorize later unrelated segments'
);

assert_same(
    array($transferSegments[1]),
    filter_segments_with_satellite_stt_permission($transferSegments, array('203' => true)),
    'Each segment must be authorized by one of its active parties'
);

class SatelliteSttFailingDb {
    public function prepare($sql) {
        throw new RuntimeException('database unavailable');
    }
}

global $db;
$db = new SatelliteSttFailingDb();

assert_throws(
    function () {
        fetch_satellite_stt_extensions(array('201'));
    },
    'Unable to read satellite_stt CTI permissions: database unavailable',
    'Permission lookup failures must abort transcription instead of looking like a denied call'
);

assert_throws(
    function () {
        fetch_users_by_extension();
    },
    'Unable to read FreePBX users table: database unavailable',
    'Registered-user lookup failures must abort transcription instead of looking like an external-only call'
);

fwrite(STDOUT, "ok - satellite STT permission gate regression\n");