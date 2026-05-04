#!/usr/bin/env php
<?php

define('SATELLITE_TRANSCRIPTION_LIBRARY_MODE', true);
putenv('DEBUG=0');
putenv('SATELLITE_CALL_SUMMARY_ENABLED=False');

require_once dirname(__DIR__) . '/bin/satellite_transcript';

$segment = array(
    'caller_num' => '201',
    'caller_name' => 'Foo One',
    'callee_num' => '202',
    'callee_name' => 'Foo Two',
);

$postFields = build_satellite_upload_fields('1777277927.999', '1777277927.999', $segment);

assert_same('1777277927.999', $postFields['uniqueid'], 'Upload payload should keep the Asterisk uniqueid unchanged');
assert_same('1777277927.999', $postFields['linkedid'], 'Upload payload should always include linkedid');
assert_same('201', $postFields['src_number'], 'Upload payload should send src_number from caller_num');
assert_same('202', $postFields['dst_number'], 'Upload payload should send dst_number from callee_num');
assert_same('Foo Two (202)', $postFields['channel0_name'], 'Channel 0 label should still describe the callee leg');
assert_same('Foo One (201)', $postFields['channel1_name'], 'Channel 1 label should still describe the caller leg');

$formattedFields = format_satellite_upload_fields($postFields);
assert_same('1777277927.999', $formattedFields['linkedid'], 'Formatted debug payload should include linkedid');
assert_same('201', $formattedFields['src_number'], 'Formatted debug payload should include src_number');
assert_same('202', $formattedFields['dst_number'], 'Formatted debug payload should include dst_number');

assert_throws(
    function () use ($segment) {
        build_satellite_upload_fields('1777277927.999', '', $segment);
    },
    'Satellite upload requires a non-empty linkedid',
    'Upload payload builder should reject missing linkedid'
);

fwrite(STDOUT, "ok - upload fields regression\n");

function assert_same($expected, $actual, $message) {
    if ($expected !== $actual) {
        fwrite(STDERR, "not ok - $message\n");
        fwrite(STDERR, 'expected: ' . var_export($expected, true) . PHP_EOL);
        fwrite(STDERR, 'actual:   ' . var_export($actual, true) . PHP_EOL);
        exit(1);
    }
}

function assert_throws($callback, $expectedMessage, $message) {
    try {
        $callback();
    } catch (Throwable $e) {
        assert_same($expectedMessage, $e->getMessage(), $message);
        return;
    }

    fwrite(STDERR, "not ok - $message\n");
    fwrite(STDERR, "expected exception was not thrown\n");
    exit(1);
}