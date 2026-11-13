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
check(count($legacyNew['gates']) === 1 && $legacyNew['gates'][0]['name'] === 'Door 1' && $legacyNew['gates'][0]['code'] === '1234', 'legacy create makes Door 1');
$unnamed = streaming_normalize_source(['descr' => 'Unnamed', 'url' => 'http://cam/img.jpg', 'gates' => [['type' => 'dtmf', 'code' => '1'], ['name' => ' ', 'type' => 'dtmf', 'code' => '2']]]);
check($unnamed['gates'][0]['name'] === 'Door 1' && $unnamed['gates'][1]['name'] === 'Door 2', 'unnamed gates default to Door N');
check(strpos(file_get_contents(__DIR__ . '/../initdb.d/streaming-migration.php'), "VALUES (?, 0, 'Door 1', 'dtmf', ?)") !== false, 'migrated open code becomes Door 1');
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
    'rtspTransports: [tcp]', '  rtspTransport: tcp', '  sourceOnDemand: true', '  maxReaders: 100', 'authHTTPExclude: []',
    '  "streaming-gw/vs_front_door":', '    source: "rtsp://admin:Door-Spike-42@188.166.124.125:18554/cam-auth"',
] as $line) {
    check(strpos($yml, $line . "\n") !== false, "mediamtx.yml contains $line");
}
check(strpos($yml, 'vs_garden') === false, 'image sources are not gateway paths');
check(strpos($yml, 'action: api') === false && strpos($yml, '  - action:') === false, 'the control API goes through the authentication hook');
$noHosts = streaming_mediamtx_config([], array_merge($settings, ['ice_hosts' => []]));
check(strpos($noHosts, "paths:\n  \"~^.*$\":\n    source: publisher\n    sourceOnDemand: false\n") !== false && strpos($noHosts, 'webrtcIPsFromInterfaces: true') !== false, 'empty configuration: only the catch-all path');
check(substr($yml, -strlen("  \"~^.*$\":\n    source: publisher\n    sourceOnDemand: false\n")) === "  \"~^.*$\":\n    source: publisher\n    sourceOnDemand: false\n", 'catch-all path after the sources');

$special = streaming_mediamtx_config(['x' => ['descr' => 'Door "1"', 'type' => 'rtsp', 'url' => 'rtsps://cam:322/a', 'user' => 'u"x', 'secret' => "p'\\#: y", 'gates' => []]], $settings);
check(strpos($special, '"streaming-gw/vs_door_1":') !== false, 'quoted path name');
check(strpos($special, 'source: "rtsps://u%22x:p%27%5C%23%3A%20y@cam:322/a"') !== false, 'credentials are encoded, YAML stays valid');

// YAML scalars: only printable ASCII, everything else escaped
check(streaming_yaml_string('Ingresso è già') === '"Ingresso \\u00e8 gi\\u00e0"', 'accented characters escaped');
check(streaming_yaml_string("a\u{85}b\u{9f}c\u{2028}d") === '"a\\u0085b\\u009fc\\u2028d"', 'C1 controls and line separators escaped');
check(streaming_yaml_string("x\u{1F6AA}y") === '"x\\U0001f6aay"', 'characters beyond the BMP as \\U escapes');
check(streaming_yaml_string("bad\xc3(") === '"bad\\ufffd("', 'invalid UTF-8 replaced');
check(streaming_yaml_string("t\tq\"b\\/") === '"t\\tq\\"b\\\\/"', 'JSON escapes are YAML escapes');
$accented = streaming_mediamtx_config(['x' => ['descr' => 'Porta', 'type' => 'rtsp', 'url' => "rtsp://cam/vid\u{e9}o\u{85}/\u{1F6AA}", 'user' => '', 'secret' => '', 'gates' => []]], $settings);
check(preg_match('/^[\x09\x0a\x20-\x7e]*$/', $accented) === 1, 'mediamtx.yml is printable ASCII');
check(strpos($accented, 'source: "rtsp://cam/vid\\u00e9o\\u0085/\\U0001f6aa"') !== false, 'escaped source URL');

// --- Device addresses ----------------------------------------------------------

foreach (['127.0.0.1', '127.9.9.9', '0.0.0.0', '0.1.2.3', '169.254.169.254', '::1', '::', '0:0:0:0:0:0:0:1', 'fe80::1', 'febf::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:169.254.1.1', '[::1]', 'fe80::1%eth0', 'not an ip'] as $ip) {
    check(streaming_ip_blocked($ip), "$ip refused");
}
foreach (['192.168.1.10', '10.0.0.1', '172.16.5.4', '203.0.113.7', '1.1.1.1', 'fd00::1', 'fec0::1', '2001:db8::1', '::ffff:192.168.1.1'] as $ip) {
    check(!streaming_ip_blocked($ip), "$ip allowed");
}
$fakeDns = function (string $host) {
    $table = ['door.lan' => ['192.168.1.20'], 'rebind.example' => ['192.168.1.20', '127.0.0.1'], 'meta.example' => ['fe80::1'], '0x7f000001' => ['127.0.0.1'], 'gone.lan' => []];
    return $table[$host] ?? [$host];
};
foreach (['localhost', 'LOCALHOST.', 'cam.localhost', 'rebind.example', 'meta.example', '0x7f000001', '127.0.0.1', '[::1]'] as $host) {
    check(streaming_host_blocked($host, $fakeDns), "host $host refused");
}
foreach (['door.lan', 'gone.lan', '192.168.1.30'] as $host) {
    check(!streaming_host_blocked($host, $fakeDns), "host $host allowed");
}
// the numeric forms read by inet_aton()/getaddrinfo() like the clients
foreach (['0x7f000001', '0X7F000001', '2130706433', '0177.0.0.1', '127.1', '0x7f.1', '0', '0x0', '017700000001', '0xa9.0xfe.0xa9.0xfe', '2852039166'] as $host) {
    check(streaming_host_blocked($host), "numeric host $host refused");
}
check(streaming_numeric_ipv4('3232235777') === '192.168.1.1' && streaming_numeric_ipv4('192.168.257') === '192.168.1.1' && streaming_numeric_ipv4('10.1') === '10.0.0.1', 'numeric forms decoded');
check(streaming_numeric_ipv4('1.2.3.256') === null && streaming_numeric_ipv4('4294967296') === null && streaming_numeric_ipv4('08.1.1.1') === null && streaming_numeric_ipv4('cam1') === null && streaming_numeric_ipv4('1.2.3.4.5') === null, 'not numeric hosts');
expect_validation(function () use ($fakeDns) { streaming_normalize_source(['descr' => 'Loop', 'url' => 'http://127.0.0.1:20043/v3/config/global/get'], null, $fakeDns); }, 'url', 'loopback source refused');
expect_validation(function () use ($fakeDns) { streaming_normalize_source(['descr' => 'Loop', 'url' => 'rtsp://rebind.example/live'], null, $fakeDns); }, 'url', 'name with a loopback address refused');
expect_validation(function () use ($fakeDns) { streaming_normalize_source(['descr' => 'Meta', 'url' => 'rtsp://door.lan/live', 'gates' => [['type' => 'url', 'url' => 'http://169.254.169.254/latest/meta-data/']]], null, $fakeDns); }, 'gates[0].url', 'link-local gate refused');
check(streaming_normalize_source(['descr' => 'Lan', 'url' => 'rtsp://door.lan/live', 'gates' => [['type' => 'url', 'url' => 'http://192.168.1.21/open']]], null, $fakeDns)['url'] === 'rtsp://door.lan/live', 'LAN devices allowed');

// --- Probe parsing -----------------------------------------------------------

check(streaming_failure_reason('rtsp://h/x: Server returned 401 Unauthorized (authorization failed)') === 'auth_failed', '401');
check(streaming_failure_reason('rtsp://127.0.0.1:1/x: Connection refused') === 'connection_refused', 'refused');
check(streaming_failure_reason('rtsp://10.255.255.1:554/x: Connection timed out') === 'timeout', 'timed out');
check(streaming_failure_reason('rtsp://h/x: Server returned 404 Not Found') === 'not_found', '404');
check(streaming_failure_reason('Invalid data found when processing input') === 'unsupported', 'invalid data');
check(streaming_failure_reason('rtsp://h/x: No route to host') === 'unknown', 'other errors');
check(streaming_failure_reason('', true) === 'timeout', 'killed after the timeout');

// the device URL is read from files: keep their content and mode while the command runs
function probe_input(array $command): array
{
    $at = array_search($command[0] === 'ffprobe' ? '-/i' : '-i', $command, true);
    $file = $at === false ? '' : (string) $command[$at + 1];
    return ['file' => $file, 'content' => is_file($file) ? file_get_contents($file) : null, 'mode' => is_file($file) ? fileperms($file) & 0777 : null];
}
$calls = [];
$inputs = [];
$fake = function (array $command, int $timeout) use (&$calls, &$inputs) {
    $calls[] = $command;
    $inputs[] = probe_input($command);
    if ($command[0] === 'ffprobe') {
        return [0, json_encode(['streams' => [
            ['codec_name' => 'hevc', 'codec_type' => 'video', 'width' => 1920, 'height' => 1080],
            ['codec_name' => 'pcm_mulaw', 'codec_type' => 'audio', 'sample_rate' => '8000'],
        ]]), '', false];
    }
    return [0, "\xff\xd8\xff\xe0jpeg", '', false];
};
$result = streaming_probe_rtsp('rtsp://192.0.2.10/live', 'admin', 'p w', false, $fake);
check($result['success'] && $result['h265'] && $result['warnings'] === ['h265'], 'H.265 is detected');
check($result['video'] === ['codec' => 'hevc', 'width' => 1920, 'height' => 1080] && $result['audio']['sample_rate'] === 8000, 'codecs and resolution');
check(base64_decode($result['image']) === "\xff\xd8\xff\xe0jpeg" && $result['mime'] === 'image/jpeg', 'preview');
check($inputs[0]['content'] === 'rtsp://admin:p%20w@192.0.2.10/live' && in_array('tcp', $calls[0], true), 'ffprobe reads the URL from a file ("-/i"): encoded credentials, TCP');
check($inputs[0]['mode'] === 0600 && $inputs[1]['mode'] === 0600, 'URL files readable only by the owner');
check(array_slice($calls[1], 0, 9) === ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-nostdin', '-f', 'concat', '-safe', '0'], 'ffmpeg reads a concat script');
check(strpos($inputs[1]['content'], "ffconcat version 1.0\nfile 'rtsp://admin:p%20w@192.0.2.10/live'\n") === 0
    && strpos($inputs[1]['content'], "option rtsp_transport tcp\n") !== false && strpos($inputs[1]['content'], 'tls_verify') === false, 'ffmpeg input in the concat script, TCP');
foreach ($calls as $command) {
    check(strpos(implode(' ', $command), 'p%20w') === false && strpos(implode(' ', $command), 'admin') === false, $command[0] . ': no credentials on the command line');
}
check(!is_file($inputs[0]['file']) && !is_file($inputs[1]['file']), 'URL files removed');
$calls = [];
$inputs = [];
streaming_probe_rtsp("rtsp://192.0.2.10/it's", "o'neil", "a'b", false, $fake);
check(strpos($inputs[1]['content'], "file 'rtsp://o%27neil:a%27b@192.0.2.10/it'\\''s'\n") !== false, 'quote escaped in the concat script');
$thrownInput = null;
try {
    streaming_probe_rtsp('rtsp://192.0.2.10/live', 'admin', 'bad', false, function (array $command) use (&$thrownInput) {
        $thrownInput = probe_input($command);
        throw new RuntimeException('killed');
    });
    check(false, 'exception propagated');
} catch (RuntimeException $e) {
    check($thrownInput['content'] !== null && !is_file($thrownInput['file']), 'URL files removed after an error');
}

$denied = streaming_probe_rtsp('rtsp://192.0.2.10/live', 'admin', 'bad', false, function () {
    return [1, '{}', "[rtsp @ 0x1] method DESCRIBE failed: 401 (Unauthorized)\nrtsp://admin:bad@192.0.2.10/live: Server returned 401 Unauthorized (authorization failed)\n", false];
});
check(!$denied['success'] && $denied['reason'] === 'auth_failed', 'auth failure reason');
check(strpos($denied['message'], 'bad@') === false && strpos($denied['message'], 'rtsp://192.0.2.10/live') !== false, 'credentials removed from the message');

$noVideo = streaming_probe_rtsp('rtsp://192.0.2.10/live', '', '', false, function () {
    return [0, json_encode(['streams' => [['codec_type' => 'audio', 'codec_name' => 'aac']]]), '', false];
});
check(!$noVideo['success'] && $noVideo['reason'] === 'unsupported', 'audio-only stream');

$mpeg4 = streaming_probe_rtsp('rtsp://192.0.2.10/live', '', '', false, function (array $command) {
    return $command[0] === 'ffprobe' ? [0, json_encode(['streams' => [['codec_type' => 'video', 'codec_name' => 'mpeg4']]]), '', false] : [1, '', 'error', false];
});
check($mpeg4['success'] && $mpeg4['warnings'] === ['codec_not_supported_by_webrtc', 'preview_failed'] && $mpeg4['image'] === null, 'codec and preview warnings');
check(streaming_probe_rtsp('http://h/x', '', '', false, $fake)['reason'] === 'unsupported', 'RTSP probe rejects other schemes');
check(!in_array('-tls_verify', $calls[0], true), 'no TLS options for plain RTSP');

// --- TLS: skip verification option, certificate pinning ----------------------

$fpA = str_repeat('ab', 32);
$fpB = str_repeat('cd', 32);
check(STREAMING_REASONS === array_values(array_unique(STREAMING_REASONS)) && in_array('tls_error', STREAMING_REASONS, true), 'tls_error reason');
check(!streaming_tls_relevant('rtsp://h/x', []) && streaming_tls_relevant('rtsps://h/x', []) && streaming_tls_relevant('https://h/x', []), 'TLS relevance from the URL');
check(streaming_tls_relevant('rtsp://h/x', [['type' => 'url', 'url' => 'https://h/open']]), 'TLS relevance from an https gate');
check(!streaming_tls_relevant('http://h/x', [['type' => 'url', 'url' => 'http://h/open'], ['type' => 'dtmf', 'code' => '1']]), 'no TLS anywhere');
check(streaming_normalize_fingerprint('AB:' . substr(strtoupper($fpA), 2)) === $fpA && streaming_normalize_fingerprint('xyz') === null && streaming_normalize_fingerprint(null) === null, 'fingerprint normalization');

$tlsNew = streaming_normalize_source(['descr' => 'Tls', 'url' => 'rtsps://u:p@192.0.2.30:322/live']);
check($tlsNew['tls_skip_verify'] === false && $tlsNew['tls_fingerprint'] === null, 'TLS verification is on by default');
$tlsOn = streaming_normalize_source(['descr' => 'Tls', 'url' => 'rtsps://u:p@192.0.2.30:322/live', 'tls_skip_verify' => true]);
check($tlsOn['tls_skip_verify'] === true && streaming_needs_fingerprint($tlsOn), 'skip verification on a rtsps source needs a fingerprint');
foreach ([true, 1, '1', 'true'] as $value) {
    check(streaming_normalize_source(['descr' => 'Tls', 'url' => 'https://h/s.jpg', 'tls_skip_verify' => $value])['tls_skip_verify'] === true, 'true value ' . json_encode($value));
}
foreach ([false, 0, '0', 'false', '', null] as $value) {
    check(streaming_normalize_source(['descr' => 'Tls', 'url' => 'https://h/s.jpg', 'tls_skip_verify' => $value])['tls_skip_verify'] === false, 'false value ' . json_encode($value));
}
expect_validation(function () { streaming_normalize_source(['descr' => 'Tls', 'url' => 'https://h/s.jpg', 'tls_skip_verify' => 'yes please']); }, 'tls_skip_verify', 'bad boolean');
expect_validation(function () { streaming_normalize_source(['descr' => 'Tls', 'url' => 'https://h/s.jpg', 'tls_skip_verify' => [true]]); }, 'tls_skip_verify', 'array boolean');
$plain = streaming_normalize_source(['descr' => 'Tls', 'url' => 'rtsp://192.0.2.30/live', 'tls_skip_verify' => true, 'gates' => [['type' => 'url', 'url' => 'http://192.0.2.30/open']]]);
check($plain['tls_skip_verify'] === false, 'not relevant: stored as false');
$httpsGate = streaming_normalize_source(['descr' => 'Tls', 'url' => 'rtsp://192.0.2.30/live', 'tls_skip_verify' => true, 'gates' => [['type' => 'url', 'url' => 'https://192.0.2.30/open']]]);
check($httpsGate['tls_skip_verify'] === true && !streaming_needs_fingerprint($httpsGate), 'an https gate makes it relevant, no fingerprint for plain RTSP');

$tlsStored = array_merge($tlsOn, ['tls_fingerprint' => $fpA]);
$kept = streaming_normalize_source(['descr' => 'Tls', 'url' => 'rtsps://192.0.2.30:322/other', 'user' => 'u'], $tlsStored);
check($kept['tls_skip_verify'] === true && $kept['tls_fingerprint'] === $fpA, 'absent option keeps the stored value and the pinned certificate of the same device');
$movedTls = streaming_normalize_source(['descr' => 'Tls', 'url' => 'rtsps://192.0.2.31:322/live', 'user' => 'u', 'secret' => 'x'], $tlsStored);
check($movedTls['tls_skip_verify'] === true && $movedTls['tls_fingerprint'] === null, 'another device: the pinned certificate is dropped');
$offTls = streaming_normalize_source(['descr' => 'Tls', 'url' => 'rtsps://192.0.2.30:322/live', 'tls_skip_verify' => false], $tlsStored);
check($offTls['tls_skip_verify'] === false && $offTls['tls_fingerprint'] === null, 'option off: no pinned certificate');

[$refreshed, $error] = streaming_refresh_fingerprint($kept, function ($url) use ($fpB) {
    return [strtoupper($fpB), ''];
});
check($refreshed['tls_fingerprint'] === $fpB && $error === [], 'save pins the current certificate');
[$offline, $error] = streaming_refresh_fingerprint($kept, function ($url) {
    return [null, 'Connection refused'];
});
check($offline['tls_fingerprint'] === $fpA && $error === ['url' => 'Connection refused'], 'device offline at save: the stored certificate is kept');
[$offlineNew, $error] = streaming_refresh_fingerprint($tlsOn, function ($url) {
    return [null, ''];
});
check($offlineNew['tls_fingerprint'] === null && $error !== [], 'device offline at the first save: no certificate pinned');
[$noPin, $error] = streaming_refresh_fingerprint($plain, function () {
    check(false, 'no certificate read when not needed');
    return [null, ''];
});
check($noPin['tls_fingerprint'] === null && $error === [], 'nothing to pin');
// https URL gates are pinned too, on their own device
$fetchedGates = [];
[$gatePinned, $error] = streaming_refresh_fingerprint($httpsGate, function ($url) use (&$fetchedGates, $fpA) {
    $fetchedGates[] = $url;
    return [$fpA, ''];
});
check($fetchedGates === ['https://192.0.2.30/open'] && $gatePinned['tls_fingerprint'] === null && $gatePinned['gates'][0]['tls_fingerprint'] === $fpA && $error === [], 'https gate pinned, plain RTSP source not');
check(streaming_cti_config(['Tls' => array_merge($gatePinned, ['frame-rate' => '1000'])])['vs_tls']['gates'][0]['tls_fingerprint'] === $fpA, 'gate fingerprint in streaming.json');
$publicGate = streaming_public_source($gatePinned);
check($publicGate['gates'][0]['tls_fingerprint'] === $fpA && $publicGate['tls_unpinned'] === false, 'REST view: gate fingerprint, pinned');
check(streaming_public_source($httpsGate)['tls_unpinned'] === true, 'REST view: unpinned gate flagged (saved by an older version)');
check(streaming_tls_unpinned(array_merge($httpsGate, ['tls_skip_verify' => false])) === false, 'nothing to pin without the option');
// the stored gate certificate is kept for the same device only
$gateStored = $gatePinned;
$gateStored['gates'][0]['id'] = 7;
$sameGate = streaming_normalize_source(['descr' => 'Tls', 'url' => 'rtsp://192.0.2.30/live', 'gates' => [['id' => 7, 'type' => 'url', 'url' => 'https://192.0.2.30/open?x=1']]], $gateStored);
check($sameGate['gates'][0]['tls_fingerprint'] === $fpA, 'same gate device: certificate kept');
$otherGate = streaming_normalize_source(['descr' => 'Tls', 'url' => 'rtsp://192.0.2.30/live', 'gates' => [['id' => 7, 'type' => 'url', 'url' => 'https://192.0.2.31/open']]], $gateStored);
check($otherGate['gates'][0]['tls_fingerprint'] === null, 'another gate device: certificate dropped');
$offGate = streaming_normalize_source(['descr' => 'Tls', 'url' => 'rtsp://192.0.2.30/live', 'tls_skip_verify' => false, 'gates' => [['id' => 7, 'type' => 'url', 'url' => 'https://192.0.2.30/open']]], $gateStored);
check($offGate['gates'][0]['tls_fingerprint'] === null, 'option off: gate certificate dropped');
// a source that skips the verification is never saved without the certificates
[$pinnedSave] = streaming_pin_certificates($httpsGate, function () use ($fpB) { return [$fpB, '']; });
check($pinnedSave['gates'][0]['tls_fingerprint'] === $fpB, 'save pins the gate');
expect_validation(function () use ($httpsGate) {
    streaming_pin_certificates($httpsGate, function () { return [null, 'Connection refused']; });
}, 'gates[0].url', 'unreachable https gate at the first save');
expect_validation(function () use ($tlsOn) {
    streaming_pin_certificates($tlsOn, function () { return [null, 'Connection refused']; });
}, 'tls_skip_verify', 'unreachable rtsps device at the first save');
$snapOn = streaming_normalize_source(['descr' => 'Snap', 'url' => 'https://192.0.2.32/s.jpg', 'tls_skip_verify' => true]);
expect_validation(function () use ($snapOn) {
    streaming_pin_certificates($snapOn, function () { return [null, 'timeout']; });
}, 'tls_skip_verify', 'unreachable https image device at the first save');
[$keptSave, $errors] = streaming_pin_certificates(array_merge($tlsOn, ['tls_fingerprint' => $fpA]), function () { return [null, 'Connection refused']; });
check($keptSave['tls_fingerprint'] === $fpA && $errors === ['url' => 'Connection refused'], 'device offline: the stored certificate is kept, no error');
try {
    streaming_pin_certificates($tlsOn, function () { return [null, 'Connection refused']; });
} catch (StreamingValidationException $e) {
    check(strpos($e->getMessage(), 'could not read the TLS certificate of the device') === 0 && $e->getDetail() === 'Connection refused', 'clear error message, cause for the log');
}

$tlsSources = [
    'Tls' => array_merge($refreshed, ['frame-rate' => '1000', 'exten' => null]),
    'Snap' => array_merge(streaming_normalize_source(['descr' => 'Snap', 'url' => 'https://192.0.2.32/s.jpg', 'tls_skip_verify' => true]), ['tls_fingerprint' => $fpA]),
    'Strict' => array_merge(streaming_normalize_source(['descr' => 'Strict', 'url' => 'rtsps://192.0.2.33/live']), ['tls_fingerprint' => $fpA]),
];
$public = streaming_public_source($tlsSources['Tls']);
check($public['tls_skip_verify'] === true && $public['tls_fingerprint'] === $fpB, 'REST view: option and pinned certificate');
check(streaming_public_source($tlsSources['Snap'])['tls_fingerprint'] === $fpA && streaming_public_source($tlsSources['Strict'])['tls_fingerprint'] === null
    && streaming_public_source($stored['Garden'])['tls_skip_verify'] === false, 'REST view: https fingerprint, none without the option, false by default');
$cti = streaming_cti_config($tlsSources);
check($cti['vs_tls']['tls_skip_verify'] === true && $cti['vs_snap']['tls_skip_verify'] === true && $cti['vs_strict']['tls_skip_verify'] === false, 'streaming.json has tls_skip_verify');
check(strpos(json_encode($cti), $fpB) === false, 'the fingerprint of a rtsps source is not in streaming.json');
check($cti['vs_snap']['tls_fingerprint'] === $fpA && $cti['vs_strict']['tls_fingerprint'] === null, 'streaming.json pins the https image device');
check(streaming_cti_config($stored)['vs_garden']['tls_skip_verify'] === false, 'streaming.json default');
$yml = streaming_mediamtx_config($tlsSources, $settings);
check(strpos($yml, "  \"streaming-gw/vs_tls\":\n    source: \"rtsps://u:p@192.0.2.30:322/other\"\n    sourceFingerprint: \"$fpB\"\n") !== false, 'gateway pins the certificate');
check(strpos($yml, "  \"streaming-gw/vs_strict\":\n    source: \"rtsps://192.0.2.33/live\"\n") !== false && substr_count($yml, 'sourceFingerprint') === 1, 'gateway verifies the certificate without the option');
$unpinned = streaming_mediamtx_config(['x' => array_merge($tlsOn, ['tls_fingerprint' => null])], $settings);
check(strpos($unpinned, 'sourceFingerprint') === false, 'no fingerprint, no pinning');

check(streaming_failure_reason("[tls @ 0x55a0f87a3a80] error:0A000086:SSL routines::certificate verify failed\nrtsps://127.0.0.1:28322/cam: Input/output error") === 'tls_error', 'ffmpeg certificate error');
check(streaming_failure_reason('SSL certificate problem: self-signed certificate') === 'tls_error', 'curl certificate error');
check(streaming_failure_reason("SSL: no alternative certificate subject name matches target host name 'h'") === 'tls_error', 'curl host name error');
check(streaming_failure_reason('error:0A00010B:SSL routines::wrong version number') === 'unknown', 'a TLS protocol error is not a certificate error');

$tlsCalls = [];
$tlsInputs = [];
$tlsFake = function (array $command, int $timeout) use (&$tlsCalls, &$tlsInputs) {
    $tlsCalls[] = $command;
    $tlsInputs[] = probe_input($command);
    if ($command[0] === 'ffprobe') {
        return [0, json_encode(['streams' => [['codec_name' => 'h264', 'codec_type' => 'video']]]), '', false];
    }
    return [0, "\xff\xd8jpeg", '', false];
};
$fetched = [];
$fetchFake = function (string $url) use (&$fetched, $fpB) {
    $fetched[] = $url;
    return [$fpB, ''];
};
$strict = streaming_probe_rtsp('rtsps://192.0.2.30:322/live', 'u', 'p', false, $tlsFake, $fetchFake);
check($strict['success'] && $strict['tls_fingerprint'] === null && $fetched === [], 'verified check: no certificate read');
$at = array_search('-tls_verify', $tlsCalls[0], true);
check($at !== false && $tlsCalls[0][$at + 1] === '1' && array_search('-/i', $tlsCalls[0], true) > $at && $tlsInputs[0]['content'] === 'rtsps://u:p@192.0.2.30:322/live', 'ffprobe verifies the certificate');
check(strpos($tlsInputs[1]['content'], "option tls_verify 1\n") !== false && strpos($tlsInputs[1]['content'], "file 'rtsps://u:p@192.0.2.30:322/live'") !== false, 'ffmpeg verifies the certificate');
$tlsCalls = [];
$tlsInputs = [];
$skipped = streaming_probe_rtsp('rtsps://192.0.2.30:322/live', 'u', 'p', true, $tlsFake, $fetchFake);
check($skipped['success'] && $skipped['tls_fingerprint'] === $fpB && $fetched === ['rtsps://192.0.2.30:322/live'], 'skipped check returns the device certificate, read without credentials');
check(count($tlsCalls) === 2 && $tlsCalls[0][array_search('-tls_verify', $tlsCalls[0], true) + 1] === '0' && strpos($tlsInputs[1]['content'], "option tls_verify 0\n") !== false, 'ffprobe and ffmpeg skip the verification');
$untrusted = streaming_probe_rtsp('rtsps://192.0.2.30:322/live', 'u', 'p', false, function () {
    return [1, '', "[tls @ 0x1] error:0A000086:SSL routines::certificate verify failed\nrtsps://u:p@192.0.2.30:322/live: Input/output error\n", false];
});
check(!$untrusted['success'] && $untrusted['reason'] === 'tls_error' && strpos($untrusted['message'], 'u:p@') === false, 'untrusted certificate: tls_error');

$storedTls = $tlsSources['Tls'];
check(streaming_tls_check_warnings($skipped, $storedTls, 'rtsps://192.0.2.30:322/live')['warnings'] === [], 'same certificate: no warning');
check(streaming_tls_check_warnings(array_merge($skipped, ['tls_fingerprint' => $fpA]), $storedTls, 'rtsps://192.0.2.30:322/live')['warnings'] === ['tls_certificate_changed'], 'changed certificate: warning');
check(streaming_tls_check_warnings(array_merge($skipped, ['tls_fingerprint' => $fpA]), $storedTls, 'rtsps://192.0.2.99:322/live')['warnings'] === [], 'another device: no warning');
check(streaming_tls_check_warnings($skipped, array_merge($storedTls, ['tls_fingerprint' => null]), 'rtsps://192.0.2.30:322/live')['warnings'] === ['tls_certificate_changed'], 'nothing pinned: warning');
check(streaming_tls_check_warnings($skipped, array_merge($storedTls, ['tls_skip_verify' => false]), 'rtsps://192.0.2.30:322/live')['warnings'] === [], 'option just enabled: the save pins it, no warning');
check(streaming_tls_check_warnings($skipped, null, 'rtsps://192.0.2.30:322/live')['warnings'] === [], 'new source: no warning');

// The stored password goes only to the device with the pinned certificate
$pinnedSnap = array_merge(streaming_normalize_source(['descr' => 'Snap', 'url' => 'https://192.0.2.32/s.jpg', 'user' => 'u', 'secret' => 'Stored-Pw-1', 'tls_skip_verify' => true]), ['tls_fingerprint' => $fpA]);
$pinnedCam = array_merge($tlsOn, ['tls_fingerprint' => $fpA]);
$guardFetched = [];
$sameCert = function ($url) use (&$guardFetched, $fpA) { $guardFetched[] = $url; return [strtoupper($fpA), '']; };
$otherCert = function ($url) use (&$guardFetched, $fpB) { $guardFetched[] = $url; return [$fpB, '']; };
$noCert = function ($url) use (&$guardFetched) { $guardFetched[] = $url; return [null, 'Connection refused']; };
check(streaming_stored_secret_guard($pinnedSnap, 'https://192.0.2.32/s.jpg', true, true, $sameCert) === null, 'same certificate: the check goes on');
$changed = streaming_stored_secret_guard($pinnedSnap, 'https://192.0.2.32/s.jpg', true, true, $otherCert);
check($changed !== null && !$changed['success'] && $changed['reason'] === 'tls_error' && $changed['warnings'] === ['tls_certificate_changed']
    && $changed['tls_fingerprint'] === $fpB && $changed['type'] === 'image' && $changed['image'] === null, 'changed https certificate: stored password not sent');
$changedRtsps = streaming_stored_secret_guard($pinnedCam, 'rtsps://192.0.2.30:322/live', true, true, $otherCert);
check($changedRtsps !== null && $changedRtsps['type'] === 'rtsp' && $changedRtsps['warnings'] === ['tls_certificate_changed'], 'changed rtsps certificate: stored password not sent');
$unreadable = streaming_stored_secret_guard($pinnedSnap, 'https://192.0.2.32/s.jpg', true, true, $noCert);
check($unreadable !== null && $unreadable['reason'] === 'connection_refused' && $unreadable['warnings'] === [], 'certificate not readable: stored password not sent');
$guardFetched = [];
check(streaming_stored_secret_guard($pinnedSnap, 'https://192.0.2.32/s.jpg', false, true, $otherCert) === null, 'typed password: the check goes on and reports the new certificate');
check(streaming_stored_secret_guard($pinnedSnap, 'https://192.0.2.32/s.jpg', true, false, $otherCert) === null, 'verified certificate: no guard');
check(streaming_stored_secret_guard(array_merge($pinnedSnap, ['tls_fingerprint' => null]), 'https://192.0.2.32/s.jpg', true, true, $otherCert) === null, 'nothing pinned (older version): no guard');
check(streaming_stored_secret_guard($pinnedSnap, 'http://192.0.2.32/s.jpg', true, true, $otherCert) === null, 'plain http: no guard');
check(streaming_stored_secret_guard(null, 'https://192.0.2.32/s.jpg', true, true, $otherCert) === null, 'new source: no guard');
check($guardFetched === [], 'no certificate read when no guard is needed');

// A save keeps a stored password only for the pinned certificate
$storedSnap = array_merge($pinnedSnap, ['gates' => [['id' => 9, 'position' => 0, 'name' => 'G', 'type' => 'url', 'code' => null, 'url' => 'https://192.0.2.33/open', 'method' => 'GET', 'username' => 'g', 'password' => 'Gate-Pw-1', 'tls_fingerprint' => $fpA]]]);
$saveData = ['descr' => 'Snap', 'url' => 'https://192.0.2.32/s.jpg', 'user' => 'u', 'secret' => '', 'gates' => [['id' => 9, 'name' => 'G', 'type' => 'url', 'url' => 'https://192.0.2.33/open', 'username' => 'g', 'password' => '']]];
$resaved = streaming_normalize_source($saveData, $storedSnap);
check($resaved['secret'] === 'Stored-Pw-1' && $resaved['gates'][0]['password'] === 'Gate-Pw-1', 'stored passwords kept by the update');
[$samePins] = streaming_pin_certificates($resaved, function () use ($fpA) { return [$fpA, '']; });
streaming_check_pin_changes($saveData, $samePins, $storedSnap);
check(true, 'same certificates: saved');
[$newPins] = streaming_pin_certificates($resaved, function ($url) use ($fpA, $fpB) { return [strpos($url, '/s.jpg') !== false ? $fpB : $fpA, '']; });
expect_validation(function () use ($saveData, $newPins, $storedSnap) { streaming_check_pin_changes($saveData, $newPins, $storedSnap); }, 'secret', 'changed device certificate with the stored password');
streaming_check_pin_changes(array_merge($saveData, ['secret' => 'Typed-Pw']), $newPins, $storedSnap);
check(true, 'changed device certificate with a typed password: saved');
[$newGatePin] = streaming_pin_certificates($resaved, function ($url) use ($fpA, $fpB) { return [strpos($url, '/open') !== false ? $fpB : $fpA, '']; });
expect_validation(function () use ($saveData, $newGatePin, $storedSnap) { streaming_check_pin_changes($saveData, $newGatePin, $storedSnap); }, 'gates[0].password', 'changed gate certificate with the stored password');
$typedGate = $saveData;
$typedGate['gates'][0]['password'] = 'Typed-Gate';
streaming_check_pin_changes($typedGate, $newGatePin, $storedSnap);
check(true, 'changed gate certificate with a typed password: saved');
streaming_check_pin_changes($saveData, $newPins, array_merge($storedSnap, ['tls_fingerprint' => null]));
check(true, 'nothing pinned before (older version): saved and pinned now');

// Real TLS: a local HTTPS server with a self-signed certificate
$tlsDir = sys_get_temp_dir() . '/streaming-tls-test-' . getmypid();
mkdir($tlsDir);
$key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
$csr = openssl_csr_new(['commonName' => '127.0.0.1'], $key, ['digest_alg' => 'sha256']);
$cert = openssl_csr_sign($csr, null, $key, 2, ['digest_alg' => 'sha256'], 1);
openssl_x509_export($cert, $certPem);
openssl_pkey_export($key, $keyPem);
file_put_contents("$tlsDir/server.pem", $certPem . $keyPem);
file_put_contents("$tlsDir/server.php", <<<'SERVER'
<?php
$context = stream_context_create(['ssl' => ['local_cert' => $argv[1]]]);
$server = stream_socket_server('tls://127.0.0.1:0', $errno, $errstr, STREAM_SERVER_BIND | STREAM_SERVER_LISTEN, $context);
echo stream_socket_get_name($server, false), "\n";
while (true) {
    $conn = @stream_socket_accept($server, 30);
    if ($conn === false) {
        continue;
    }
    $request = '';
    while (!feof($conn) && strpos($request, "\r\n\r\n") === false && ($chunk = fread($conn, 4096)) !== false && $chunk !== '') {
        $request .= $chunk;
    }
    $path = preg_match('#^GET (\S+)#', $request, $m) ? $m[1] : '';
    if ($path === '/text') {
        @fwrite($conn, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 18\r\nConnection: close\r\n\r\n{\"secret\": \"meta\"}");
    } elseif ($path === '/fake.jpg') {
        @fwrite($conn, "HTTP/1.1 200 OK\r\nContent-Type: image/jpeg\r\nContent-Length: 18\r\nConnection: close\r\n\r\n{\"secret\": \"meta\"}");
    } elseif ($path === '/image.png') {
        @fwrite($conn, "HTTP/1.1 200 OK\r\nContent-Type: image/png\r\nContent-Length: 10\r\nConnection: close\r\n\r\n\x89PNG\r\n\x1a\nok");
    } elseif ($path === '/big.jpg') {
        @fwrite($conn, "HTTP/1.1 200 OK\r\nContent-Type: image/jpeg\r\nConnection: close\r\n\r\n\xff\xd8\xff\xe0");
        for ($i = 0; $i < 6 && @fwrite($conn, str_repeat('x', 1048576)) !== false; $i++) {
        }
    } elseif ($request !== '') {
        @fwrite($conn, "HTTP/1.1 200 OK\r\nContent-Type: image/jpeg\r\nContent-Length: 6\r\nConnection: close\r\n\r\n\xff\xd8\xff\xe0ok");
    }
    @fclose($conn);
}
SERVER);
$serverPipes = [];
$serverProcess = proc_open([PHP_BINARY, "$tlsDir/server.php", "$tlsDir/server.pem"], [1 => ['pipe', 'w'], 2 => ['file', '/dev/null', 'w']], $serverPipes);
$address = trim((string) fgets($serverPipes[1]));
check(preg_match('/^127\.0\.0\.1:\d+$/', $address) === 1, "test TLS server listening on $address");
$expected = openssl_x509_fingerprint($certPem, 'sha256');
[$fingerprint, $error] = streaming_fetch_fingerprint("rtsps://$address/live");
check($fingerprint === $expected && $error === '', 'fingerprint of a self-signed certificate: ' . $error);
check(streaming_fetch_fingerprint("https://$address/snap.jpg")[0] === $expected, 'fingerprint of an https device');
$realStored = ['descr' => 'Real', 'type' => 'image', 'url' => "https://$address/snap.jpg", 'user' => 'u', 'secret' => 'Stored-Pw-1', 'tls_skip_verify' => true, 'tls_fingerprint' => $expected, 'gates' => []];
check(streaming_stored_secret_guard($realStored, "https://$address/snap.jpg", true, true) === null, 'real device with the pinned certificate: the check goes on');
$realChanged = streaming_stored_secret_guard(array_merge($realStored, ['tls_fingerprint' => $fpA]), "https://$address/snap.jpg", true, true);
check($realChanged !== null && $realChanged['tls_fingerprint'] === $expected && $realChanged['warnings'] === ['tls_certificate_changed'], 'real device with another certificate: stored password not sent');
check(streaming_fetch_fingerprint('rtsp://127.0.0.1:1/x')[0] === null, 'no fingerprint for plain RTSP');
[$fingerprint, $error] = streaming_fetch_fingerprint('rtsps://127.0.0.1:1/x', 2);
check($fingerprint === null && $error !== '', 'no fingerprint when the device is unreachable');
if (function_exists('curl_init')) {
    $verified = streaming_probe_image("https://$address/snap.jpg", '', '');
    check(!$verified['success'] && $verified['reason'] === 'tls_error', 'image check verifies the certificate: ' . $verified['reason'] . ' ' . $verified['message']);
    $skippedImage = streaming_probe_image("https://$address/snap.jpg", '', '', true);
    check($skippedImage['success'] && base64_decode($skippedImage['image']) === "\xff\xd8\xff\xe0ok", 'image check skips the verification: ' . $skippedImage['message']);
    check($skippedImage['tls_fingerprint'] === $expected, 'image check returns the certificate to pin');
    $notImage = streaming_probe_image("https://$address/text", '', '', true);
    check(!$notImage['success'] && $notImage['reason'] === 'unsupported' && $notImage['image'] === null, 'not an image: unsupported, no content');
    $fakeType = streaming_probe_image("https://$address/fake.jpg", '', '', true);
    check(!$fakeType['success'] && $fakeType['reason'] === 'unsupported' && $fakeType['image'] === null, 'image content type without image data: no content');
    $png = streaming_probe_image("https://$address/image.png", '', '', true);
    check($png['success'] && $png['mime'] === 'image/png', 'PNG image');
    $big = streaming_probe_image("https://$address/big.jpg", '', '', true);
    check(!$big['success'] && $big['reason'] === 'unsupported' && $big['image'] === null && strpos($big['message'], 'bigger') !== false, 'image bigger than 5 MB refused: ' . $big['message']);
    $pinnedAddress = streaming_probe_image('https://device.invalid:' . explode(':', $address)[1] . '/snap.jpg', '', '', true, function () { return [null, '']; }, '127.0.0.1');
    check($pinnedAddress['success'], 'host name connected to the checked address: ' . $pinnedAddress['message']);
} else {
    fwrite(STDERR, "SKIP: curl extension not available\n");
}
proc_terminate($serverProcess);
fclose($serverPipes[1]);
proc_close($serverProcess);
array_map('unlink', glob("$tlsDir/*"));
rmdir($tlsDir);

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

// --- Delete -------------------------------------------------------------------

class FakeStatement
{
    private $db;
    private $sql;
    private $result = [];

    public function __construct($db, string $sql)
    {
        $this->db = $db;
        $this->sql = $sql;
    }

    public function execute(array $params = []): bool
    {
        $this->db->log[] = [$this->sql, $params];
        if (strpos($this->sql, 'SELECT `descr` FROM `rest_cti_streaming` WHERE BINARY') === 0) {
            $this->result = in_array($params[0], $this->db->sources, true) ? [$params[0]] : [];
        }
        return true;
    }

    public function fetchColumn()
    {
        return $this->result ? $this->result[0] : false;
    }
}

class FakePdo extends \PDO
{
    public $log = [];
    public $sources = [];

    public function __construct(array $sources)
    {
        $this->sources = $sources;
    }

    #[\ReturnTypeWillChange]
    public function prepare($sql, $options = [])
    {
        return new FakeStatement($this, $sql);
    }

    public function inTransaction(): bool
    {
        return false;
    }

    public function beginTransaction(): bool
    {
        return true;
    }

    public function commit(): bool
    {
        return true;
    }

    public function rollBack(): bool
    {
        return true;
    }
}

$fakeDb = new FakePdo(['Ingresso']);
try {
    streaming_delete_source($fakeDb, 'Ingresso!');
    check(false, 'similar name: no exception');
} catch (StreamingNotFoundException $e) {
    check(true, 'similar name: not found');
}
check(count($fakeDb->log) === 1, 'similar name: nothing deleted');
$fakeDb->log = [];
streaming_delete_source($fakeDb, 'Ingresso');
$deletes = array_values(array_filter($fakeDb->log, function ($entry) { return strpos($entry[0], 'DELETE') === 0; }));
check(count($deletes) === 3 && $deletes[0][1] === ['vs_ingresso'] && $deletes[2][1] === ['Ingresso'], 'exact name: permission, gates and source deleted');
check(strpos($deletes[2][0], 'BINARY') !== false, 'the source row is matched exactly');

if ($failures > 0) {
    fwrite(STDERR, "$failures of $count checks failed\n");
    exit(1);
}
echo "streaming_test: $count checks passed\n";
