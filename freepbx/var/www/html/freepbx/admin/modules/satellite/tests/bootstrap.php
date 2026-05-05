<?php

function satellite_test_bootstrap($env = array()) {
    if (!defined('SATELLITE_TRANSCRIPTION_LIBRARY_MODE')) {
        define('SATELLITE_TRANSCRIPTION_LIBRARY_MODE', true);
    }

    putenv('DEBUG=0');
    foreach ($env as $name => $value) {
        putenv($name . '=' . $value);
    }

    require_once dirname(__DIR__) . '/bin/satellite_transcript';
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