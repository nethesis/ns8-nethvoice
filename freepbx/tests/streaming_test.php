#!/usr/bin/env php
<?php

/**
 * Tests for the video sources library (NethServer/dev#7535): URL and
 * credential handling, validation, gates, streaming.json and MediaMTX
 * configuration, probe result parsing.
 *
 * Copyright (C) 2026 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

require_once __DIR__ . '/../var/www/html/freepbx/rest/lib/libStreaming.php';
require_once __DIR__ . '/../initdb.d/streaming-migration.php';

$failures = 0;
$count = 0;

function check(bool $condition, string $message): void
{
    global $failures, $count;
    $count++;
    if (!$condition) {
        $failures++;
        fwrite(STDERR, "FAIL: $message\n");
    }
}

function expect_validation(callable $fn, string $field, string $message): void
{
    try {
        $fn();
        check(false, "$message: no exception");
    } catch (StreamingValidationException $e) {
        check($e->getField() === $field, "$message: field " . $e->getField() . " instead of $field");
    }
}

// --- URL parsing and credentials -------------------------------------------

$parsed = streaming_parse_url('rtsp://admin:p@ss:w0rd@192.0.2.10:8554/cam/1?x=1');
check($parsed !== null, 'rtsp URL with raw @ in the password parses');
check($parsed['type'] === 'rtsp' && $parsed['host'] === '192.0.2.10' && $parsed['port'] === '8554', 'host and port');
check($parsed['user'] === 'admin' && $parsed['secret'] === 'p@ss:w0rd', 'credentials split at the last @ and first colon');
check($parsed['url'] === 'rtsp://192.0.2.10:8554/cam/1?x=1', 'stored URL has no credentials');

$parsed = streaming_parse_url('RTSPS://user%40corp:a%2Fb@[2001:db8::1]:322/live');
check($parsed !== null && $parsed['scheme'] === 'rtsps' && $parsed['host'] === '2001:db8::1', 'rtsps with IPv6');
check($parsed['user'] === 'user@corp' && $parsed['secret'] === 'a/b', 'percent-encoded credentials are decoded');

$parsed = streaming_parse_url('http://door.example.org/snapshot.jpg');
check($parsed !== null && $parsed['type'] === 'image' && !$parsed['has_credentials'], 'http image URL');

foreach ([
    '', 'file:///etc/passwd', 'ftp://host/x', 'gopher://host', 'rtsp://', 'rtsp:///path',
    'rtsp://host:0/x', 'rtsp://host:70000/x', "rtsp://host/a b", "rtsp://host/\n", 'rtsp://-host;rm/x',
    'host/path', '-i rtsp://host/x',
] as $bad) {
    check(streaming_parse_url($bad) === null, 'rejects ' . json_encode($bad));
}

check(streaming_type_from_url('rtsps://h/x') === 'rtsp' && streaming_type_from_url('https://h/x') === 'image', 'type from scheme');

$url = streaming_url_with_credentials('rtsp://192.0.2.10:554/cam', 'ad min', 'p@ss:/?#%');
check($url === 'rtsp://ad%20min:p%40ss%3A%2F%3F%23%25@192.0.2.10:554/cam', 'credentials are URL-encoded: ' . $url);
$back = streaming_parse_url($url);
check($back['user'] === 'ad min' && $back['secret'] === 'p@ss:/?#%' && $back['url'] === 'rtsp://192.0.2.10:554/cam', 'credentials round trip');
check(streaming_url_with_credentials('rtsp://h/x', '', 'secret') === 'rtsp://h/x', 'no user, no credentials');
check(streaming_url_endpoint('rtsp://h/x') === streaming_url_endpoint('rtsp://user:pw@H:554/y'), 'endpoint uses default port and ignores path');
check(streaming_url_endpoint('rtsp://h/x') !== streaming_url_endpoint('rtsp://other/x'), 'different hosts');

check(streaming_permission_name('Front Door #1') === 'vs_front_door_1', 'permission name');
check(streaming_gateway_path('Front Door #1') === 'streaming-gw/vs_front_door_1', 'gateway path');

// --- Source validation -------------------------------------------------------

$source = streaming_normalize_source([
    'descr' => 'Front door',
    'url' => 'rtsp://admin:Door-Spike-42@188.166.124.125:18554/cam-auth',
    'exten' => '201',
    'gates' => [
        ['name' => 'Pedestrian', 'type' => 'dtmf', 'code' => '*1'],
        ['name' => 'Car gate', 'type' => 'url', 'url' => 'http://gate:Gate-Spike-77@188.166.124.125:18080/open?gate=1', 'method' => 'post'],
    ],
]);
check($source['type'] === 'rtsp' && $source['url'] === 'rtsp://188.166.124.125:18554/cam-auth', 'rtsp source, credentials removed from URL');
check($source['user'] === 'admin' && $source['secret'] === 'Door-Spike-42', 'credentials from URL');
check($source['exten'] === 201 && $source['frame-rate'] === 1000, 'exten and default frame rate');
check($source['open'] === '*1', 'open is the first DTMF gate');
check($source['gates'][1]['method'] === 'POST' && $source['gates'][1]['username'] === 'gate' && $source['gates'][1]['password'] === 'Gate-Spike-77', 'URL gate credentials split');
check($source['gates'][1]['url'] === 'http://188.166.124.125:18080/open?gate=1', 'URL gate stored without credentials');

// Stored source as returned by streaming_load_sources()
$current = $source;
$current['gates'][0]['id'] = 7;
$current['gates'][1]['id'] = 8;

$updated = streaming_normalize_source([
    'descr' => 'Front door',
    'url' => 'rtsp://188.166.124.125:18554/cam-auth',
    'user' => 'admin',
    'secret' => '',
    'gates' => [
        ['id' => 8, 'name' => 'Car gate', 'type' => 'url', 'url' => 'http://188.166.124.125:18080/open?gate=1', 'username' => 'gate', 'password' => ''],
        ['id' => 7, 'name' => 'Pedestrian', 'type' => 'dtmf', 'code' => '*2'],
    ],
], $current);
check($updated['secret'] === 'Door-Spike-42', 'empty secret keeps the stored one');
check($updated['gates'][0]['id'] === 8 && $updated['gates'][0]['password'] === 'Gate-Spike-77', 'empty gate password keeps the stored one');
check($updated['gates'][1]['id'] === 7 && $updated['gates'][1]['position'] === 1, 'gates reordered');
check($updated['open'] === '*2', 'open follows the first DTMF gate, wherever it is');

$cleared = streaming_normalize_source(['descr' => 'Front door', 'url' => 'rtsp://188.166.124.125:18554/cam-auth', 'user' => '', 'gates' => []], $current);
check($cleared['user'] === '' && $cleared['secret'] === '' && $cleared['gates'] === [] && $cleared['open'] === '', 'empty user clears the credentials, empty gates clear open');

$forged = streaming_normalize_source([
    'descr' => 'Front door', 'url' => 'rtsp://188.166.124.125:18554/cam-auth', 'user' => 'admin',
    'gates' => [['id' => 999, 'name' => 'X', 'type' => 'url', 'url' => 'http://h/x', 'username' => 'gate']],
], $current);
check($forged['gates'][0]['id'] === null && $forged['gates'][0]['password'] === null, 'unknown gate id gets no stored password');

// Legacy clients only send "open"
$sameUrl = 'rtsp://188.166.124.125:18554/cam-auth';
$legacy = streaming_normalize_source(['descr' => 'Front door', 'url' => $sameUrl, 'open' => '#9'], $current);
check($legacy['type'] === 'rtsp' && count($legacy['gates']) === 2, 'legacy update keeps the gates');
check($legacy['gates'][0]['code'] === '#9' && $legacy['gates'][0]['id'] === 7 && $legacy['open'] === '#9', 'legacy open replaces the first DTMF gate');
check($legacy['gates'][1]['password'] === 'Gate-Spike-77', 'legacy update keeps the URL gate password');
$legacyNew = streaming_normalize_source(['descr' => 'Gate', 'url' => 'http://cam/img.jpg', 'open' => '1234']);
check(count($legacyNew['gates']) === 1 && $legacyNew['gates'][0]['name'] === 'Gate 1' && $legacyNew['gates'][0]['code'] === '1234', 'legacy create makes Gate 1');
$legacyRemove = streaming_normalize_source(['descr' => 'Front door', 'url' => $sameUrl, 'open' => ''], $current);
check(count($legacyRemove['gates']) === 1 && $legacyRemove['gates'][0]['type'] === 'url' && $legacyRemove['open'] === '', 'legacy empty open removes the first DTMF gate');
$untouched = streaming_normalize_source(['descr' => 'Front door', 'url' => 'rtsp://188.166.124.125:18554/other-path'], $current);
check(count($untouched['gates']) === 2 && $untouched['user'] === 'admin' && $untouched['secret'] === 'Door-Spike-42', 'no gates and no user: everything kept, also with another path');

// A stored password is never sent to another device
expect_validation(function () use ($current) {
    streaming_normalize_source(['descr' => 'Front door', 'url' => 'rtsp://198.51.100.1:18554/cam-auth', 'user' => 'admin'], $current);
}, 'secret', 'stored password with another host');
$moved = streaming_normalize_source(['descr' => 'Front door', 'url' => 'rtsp://198.51.100.1:18554/cam-auth', 'user' => 'admin', 'secret' => 'new', 'gates' => []], $current);
check($moved['secret'] === 'new', 'a new password for the new host');
expect_validation(function () use ($current) {
    streaming_normalize_source(['descr' => 'Front door', 'url' => 'rtsp://188.166.124.125:18554/cam-auth', 'gates' => [
        ['id' => 8, 'name' => 'Car gate', 'type' => 'url', 'url' => 'http://198.51.100.1/open', 'username' => 'gate'],
    ]], $current);
}, 'gates[0].password', 'stored gate password with another host');

expect_validation(function () { streaming_normalize_source(['descr' => '', 'url' => 'rtsp://h/x']); }, 'descr', 'empty name');
expect_validation(function () { streaming_normalize_source(['descr' => '###', 'url' => 'rtsp://h/x']); }, 'descr', 'name without letters');
expect_validation(function () { streaming_normalize_source(['descr' => str_repeat('a', 51), 'url' => 'rtsp://h/x']); }, 'descr', 'long name');
expect_validation(function () { streaming_normalize_source(['descr' => 'a', 'url' => 'file:///etc/passwd']); }, 'url', 'file URL');
expect_validation(function () { streaming_normalize_source(['descr' => 'a', 'url' => 'rtsp://h/x', 'exten' => '20a']); }, 'exten', 'bad extension');
expect_validation(function () { streaming_normalize_source(['descr' => 'a', 'url' => 'rtsp://h/x', 'user' => "u\n"]); }, 'user', 'control characters');
expect_validation(function () { streaming_normalize_source(['descr' => 'a', 'url' => 'rtsp://h/x', 'open' => '1;2']); }, 'open', 'bad legacy code');
expect_validation(function () { streaming_normalize_source(['descr' => 'a', 'url' => 'rtsp://h/x', 'gates' => [['type' => 'dtmf', 'code' => '12 3']]]); }, 'gates[0].code', 'bad DTMF');
expect_validation(function () { streaming_normalize_source(['descr' => 'a', 'url' => 'rtsp://h/x', 'gates' => [['type' => 'url', 'url' => 'rtsp://h/x']]]); }, 'gates[0].url', 'gate URL must be http');
expect_validation(function () { streaming_normalize_source(['descr' => 'a', 'url' => 'rtsp://h/x', 'gates' => [['type' => 'url', 'url' => 'http://h/x', 'method' => 'DELETE']]]); }, 'gates[0].method', 'bad method');
expect_validation(function () { streaming_normalize_source(['descr' => 'a', 'url' => 'rtsp://h/x', 'gates' => [['type' => 'relay']]]); }, 'gates[0].type', 'bad gate type');
expect_validation(function () { streaming_normalize_source(['descr' => 'a', 'url' => 'rtsp://h/x', 'gates' => ['x' => []]]); }, 'gates', 'gates object');
expect_validation(function () { streaming_normalize_source(['descr' => 'a', 'url' => 'rtsp://h/x', 'gates' => array_fill(0, 11, ['type' => 'dtmf', 'code' => '1'])]); }, 'gates', 'too many gates');
expect_validation(function () { streaming_normalize_profiles(['1', 'x']); }, 'profiles', 'bad profile');
check(streaming_normalize_profiles(['1', 2, '2']) === [1, 2], 'profiles normalized');

// --- REST view, streaming.json, MediaMTX --------------------------------------

$stored = [
    'Front door' => array_merge($updated, ['frame-rate' => '1000', 'exten' => '201']),
    'Garden' => [
        'descr' => 'Garden', 'type' => 'image', 'url' => 'http://192.0.2.20/snap.jpg', 'user' => 'viewer', 'secret' => 'pw',
        'frame-rate' => '2000', 'exten' => null, 'open' => '', 'gates' => [],
    ],
];

$public = streaming_public_source($stored['Front door']);
$json = json_encode($public);
check(strpos($json, 'Door-Spike-42') === false && strpos($json, 'Gate-Spike-77') === false, 'REST view has no secrets');
check($public['has_secret'] === true && $public['gates'][0]['has_password'] === true, 'REST view has the has_* flags');
check($public['gateway_path'] === 'streaming-gw/vs_front_door' && $public['permission'] === 'vs_front_door', 'REST view gateway path');

$cti = streaming_cti_config($stored);
check(array_keys($cti) === ['vs_front_door', 'vs_garden'], 'streaming.json keys');
foreach (['descr', 'url', 'user', 'secret', 'frame-rate', 'exten', 'open'] as $key) {
    check(array_key_exists($key, $cti['vs_front_door']), "streaming.json keeps legacy key $key");
}
check($cti['vs_front_door']['url'] === '' && $cti['vs_front_door']['type'] === 'rtsp', 'RTSP source has no legacy URL');
check($cti['vs_front_door']['user'] === '' && $cti['vs_front_door']['secret'] === '', 'legacy user/secret never populated');
check($cti['vs_front_door']['gateway_path'] === 'streaming-gw/vs_front_door', 'gateway_path for nethcti-server');
check($cti['vs_front_door']['open'] === '*2', 'legacy open in streaming.json');
check($cti['vs_front_door']['gates'][0]['password'] === 'Gate-Spike-77' && $cti['vs_front_door']['gates'][1]['code'] === '*2', 'gates for nethcti-server');
check($cti['vs_garden']['url'] === 'http://192.0.2.20/snap.jpg' && $cti['vs_garden']['image_auth']['password'] === 'pw', 'image source with credentials');
check(strpos(json_encode($cti), 'Door-Spike-42') === false, 'RTSP password is not in streaming.json');

$settings = streaming_gateway_settings([
    'MEDIAMTX_WHEP_PORT' => '20042', 'MEDIAMTX_API_PORT' => '20043', 'MEDIAMTX_RTSP_PORT' => '20044',
    'MEDIAMTX_ICE_TCP_PORT' => '20045', 'MEDIAMTX_ICE_UDP_PORT' => '21000', 'NETHCTI_INTERNAL_REST_PORT9' => '20017',
    'MEDIAMTX_ICE_HOSTS' => '203.0.113.5, 10.0.0.5,203.0.113.5,bad host',
]);
check($settings !== null && $settings['ice_hosts'] === ['203.0.113.5', '10.0.0.5'], 'ICE hosts deduplicated and validated');
check($settings['auth_url'] === 'http://127.0.0.1:20017/mediamtx/auth', 'auth hook URL');
check(streaming_gateway_settings(['MEDIAMTX_WHEP_PORT' => '20042']) === null, 'missing ports');

$yml = streaming_mediamtx_config($stored, $settings);
foreach ([
    'authMethod: http', 'authHTTPAddress: "http://127.0.0.1:20017/mediamtx/auth"', 'apiAddress: "127.0.0.1:20043"',
    'rtspAddress: "127.0.0.1:20044"', 'webrtcAddress: "127.0.0.1:20042"', 'webrtcLocalUDPAddress: ":21000"',
    'webrtcLocalTCPAddress: ":20045"', 'webrtcAdditionalHosts: ["203.0.113.5", "10.0.0.5"]', 'webrtcIPsFromInterfaces: false',
    'rtmp: false', 'srt: false', 'moq: false', 'hls: false', 'metrics: false', 'pprof: false', 'playback: false',
    'rtspTransports: [tcp]', '  rtspTransport: tcp', '  sourceOnDemand: true',
    '  "streaming-gw/vs_front_door":', '    source: "rtsp://admin:Door-Spike-42@188.166.124.125:18554/cam-auth"',
] as $line) {
    check(strpos($yml, $line . "\n") !== false, "mediamtx.yml contains $line");
}
check(strpos($yml, 'vs_garden') === false, 'image sources are not gateway paths');
$noHosts = streaming_mediamtx_config([], array_merge($settings, ['ice_hosts' => []]));
check(strpos($noHosts, "paths: {}\n") !== false && strpos($noHosts, 'webrtcIPsFromInterfaces: true') !== false, 'empty configuration');

$special = streaming_mediamtx_config(['x' => ['descr' => 'Door "1"', 'type' => 'rtsp', 'url' => 'rtsps://cam:322/a', 'user' => 'u"x', 'secret' => "p'\\#: y", 'gates' => []]], $settings);
check(strpos($special, '"streaming-gw/vs_door_1":') !== false, 'quoted path name');
check(strpos($special, 'source: "rtsps://u%22x:p%27%5C%23%3A%20y@cam:322/a"') !== false, 'credentials are encoded, YAML stays valid');

// --- Probe parsing -----------------------------------------------------------

check(streaming_failure_reason('rtsp://h/x: Server returned 401 Unauthorized (authorization failed)') === 'auth_failed', '401');
check(streaming_failure_reason('rtsp://127.0.0.1:1/x: Connection refused') === 'connection_refused', 'refused');
check(streaming_failure_reason('rtsp://10.255.255.1:554/x: Connection timed out') === 'timeout', 'timed out');
check(streaming_failure_reason('rtsp://h/x: Server returned 404 Not Found') === 'not_found', '404');
check(streaming_failure_reason('Invalid data found when processing input') === 'unsupported', 'invalid data');
check(streaming_failure_reason('rtsp://h/x: No route to host') === 'unknown', 'other errors');
check(streaming_failure_reason('', true) === 'timeout', 'killed after the timeout');

$calls = [];
$fake = function (array $command, int $timeout) use (&$calls) {
    $calls[] = $command;
    if ($command[0] === 'ffprobe') {
        return [0, json_encode(['streams' => [
            ['codec_name' => 'hevc', 'codec_type' => 'video', 'width' => 1920, 'height' => 1080],
            ['codec_name' => 'pcm_mulaw', 'codec_type' => 'audio', 'sample_rate' => '8000'],
        ]]), '', false];
    }
    return [0, "\xff\xd8\xff\xe0jpeg", '', false];
};
$result = streaming_probe_rtsp('rtsp://192.0.2.10/live', 'admin', 'p w', $fake);
check($result['success'] && $result['h265'] && $result['warnings'] === ['h265'], 'H.265 is detected');
check($result['video'] === ['codec' => 'hevc', 'width' => 1920, 'height' => 1080] && $result['audio']['sample_rate'] === 8000, 'codecs and resolution');
check(base64_decode($result['image']) === "\xff\xd8\xff\xe0jpeg" && $result['mime'] === 'image/jpeg', 'preview');
check(end($calls[0]) === 'rtsp://admin:p%20w@192.0.2.10/live' && in_array('tcp', $calls[0], true), 'ffprobe arguments: encoded credentials, TCP');
check(in_array('-i', $calls[1], true) && $calls[1][array_search('-i', $calls[1], true) + 1] === 'rtsp://admin:p%20w@192.0.2.10/live', 'ffmpeg input argument');

$denied = streaming_probe_rtsp('rtsp://192.0.2.10/live', 'admin', 'bad', function () {
    return [1, '{}', "[rtsp @ 0x1] method DESCRIBE failed: 401 (Unauthorized)\nrtsp://admin:bad@192.0.2.10/live: Server returned 401 Unauthorized (authorization failed)\n", false];
});
check(!$denied['success'] && $denied['reason'] === 'auth_failed', 'auth failure reason');
check(strpos($denied['message'], 'bad@') === false && strpos($denied['message'], 'rtsp://192.0.2.10/live') !== false, 'credentials removed from the message');

$noVideo = streaming_probe_rtsp('rtsp://192.0.2.10/live', '', '', function () {
    return [0, json_encode(['streams' => [['codec_type' => 'audio', 'codec_name' => 'aac']]]), '', false];
});
check(!$noVideo['success'] && $noVideo['reason'] === 'unsupported', 'audio-only stream');

$mpeg4 = streaming_probe_rtsp('rtsp://192.0.2.10/live', '', '', function (array $command) {
    return $command[0] === 'ffprobe' ? [0, json_encode(['streams' => [['codec_type' => 'video', 'codec_name' => 'mpeg4']]]), '', false] : [1, '', 'error', false];
});
check($mpeg4['success'] && $mpeg4['warnings'] === ['codec_not_supported_by_webrtc', 'preview_failed'] && $mpeg4['image'] === null, 'codec and preview warnings');
check(streaming_probe_rtsp('http://h/x', '', '', $fake)['reason'] === 'unsupported', 'RTSP probe rejects other schemes');

// --- Atomic write --------------------------------------------------------------

$dir = sys_get_temp_dir() . '/streaming-test-' . getmypid();
mkdir($dir);
check(streaming_write_file_atomic("$dir/mediamtx.yml", "a: 1\n", 0640), 'atomic write');
check(file_get_contents("$dir/mediamtx.yml") === "a: 1\n" && (fileperms("$dir/mediamtx.yml") & 0777) === 0640, 'content and mode');
check(streaming_write_file_atomic("$dir/mediamtx.yml", "a: 2\n", 0640), 'atomic replace');
check(array_values(array_diff(scandir($dir), ['.', '..'])) === ['mediamtx.yml'], 'no temporary file left');
check(!streaming_write_file_atomic("$dir/missing/mediamtx.yml", "a\n"), 'missing directory');
array_map('unlink', glob("$dir/*"));
rmdir($dir);

// --- Migration helper --------------------------------------------------------

$split = streamingMigrationSplitCredentials('http://admin:p@ss@192.0.2.1/cgi-bin/snap.jpg');
check($split === ['url' => 'http://192.0.2.1/cgi-bin/snap.jpg', 'user' => 'admin', 'secret' => 'p@ss'], 'migration splits URL credentials');
check(streamingMigrationSplitCredentials('http://192.0.2.1/snap.jpg?a=b@c') === null, 'migration ignores @ outside the authority');

if ($failures > 0) {
    fwrite(STDERR, "$failures of $count checks failed\n");
    exit(1);
}
echo "streaming_test: $count checks passed\n";
