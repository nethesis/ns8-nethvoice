<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Check that the live data routes return only the allowed fields of the CTI answers.

function check($condition, $message) {
    if (!$condition) throw new RuntimeException($message);
}

class RouteCollector {
    public array $routes = [];
    public function get($pattern, $handler) { $this->routes[] = "GET $pattern"; }
}

define('ADMINPHONE_ACCOUNTCODE', 'nv-admin');

$app = new RouteCollector();
require __DIR__ . '/../var/www/html/freepbx/rest/modules/dashboard.php';

foreach (['extensions', 'trunks', 'users'] as $source) {
    check(in_array("GET /dashboard/live/$source", $app->routes, true), "the module must register GET /dashboard/live/$source");
}

const LEAKS = ['webrtc-secret-value', 'sip-auth-user', 'secret', 'username-of-endpoint', 'mac-aa-bb', 'from-internal', 'nested-secret', 'ctx-value', 'queue-x', 'owner-201'];

function fakeCti(array $answers, array &$requested): callable {
    return function (string $path) use ($answers, &$requested) {
        $requested[] = $path;
        return $answers[$path];
    };
}

function live(string $source, $answer, array &$requested = []): array {
    $paths = ['extensions' => '/astproxy/extensions', 'trunks' => '/astproxy/trunks', 'users' => '/user/endpoints/all'];
    [$status, $body] = dashboardLiveResponse($source, fakeCti([$paths[$source] => $answer], $requested));
    return [$status, json_encode($body)];
}

function ok(string $body): array {
    return ['status' => 200, 'body' => $body];
}

function checkNoLeak(string $json, string $label) {
    foreach (LEAKS as $leak) {
        check(!str_contains($json, $leak), "$label must not contain $leak: $json");
    }
}

$extensions = json_encode([
    '201' => [
        'exten' => '201', 'name' => 'Alice Example', 'status' => 'busy', 'dnd' => false, 'cf' => '',
        'codecs' => ['ulaw', 'alaw', ['nested-secret']], 'ip' => '192.0.2.10', 'port' => '5060', 'sipuseragent' => 'Yealink T46U',
        'username' => 'sip-auth-user', 'mac' => 'mac-aa-bb', 'context' => 'from-internal', 'chanType' => 'pjsip',
        'useWebsocket' => false, 'cfb' => '', 'cfu' => '', 'cfVm' => '', 'cfbVm' => '', 'cfuVm' => '',
        'secret' => 'webrtc-secret-value',
        'conversations' => [
            'PJSIP/201-0001>PJSIP/202-0002' => [
                'id' => 'PJSIP/201-0001>PJSIP/202-0002', 'linkedId' => '1700000000.1', 'duration' => 42, 'direction' => 'out',
                'connected' => true, 'throughQueue' => false, 'throughTrunk' => false, 'counterpartNum' => '202',
                'counterpartName' => 'Bob Example', 'owner' => 'owner-201', 'queueId' => 'queue-x', 'uniqueId' => '1700000000.1',
                'chSource' => ['channel' => 'PJSIP/201-0001', 'secret' => 'nested-secret'], 'recording' => 'false',
                'startTime' => 1700000000000, 'inConference' => false,
            ],
        ],
    ],
    '202' => ['exten' => '202', 'name' => ['secret' => 'nested-secret'], 'status' => 'online', 'conversations' => []],
]);

$requested = [];
[$status, $json] = live('extensions', ok($extensions), $requested);
check($requested === ['/astproxy/extensions'], 'the extensions route must read /astproxy/extensions');
check($status === 200, 'the extensions must be returned');
checkNoLeak($json, 'the extensions');
check(json_decode($json, true) === [
    '201' => [
        'exten' => '201', 'name' => 'Alice Example', 'status' => 'busy',
        'conversations' => [
            'PJSIP/201-0001>PJSIP/202-0002' => [
                'id' => 'PJSIP/201-0001>PJSIP/202-0002', 'linkedId' => '1700000000.1', 'duration' => 42, 'direction' => 'out',
                'connected' => true, 'throughQueue' => false, 'throughTrunk' => false, 'counterpartNum' => '202',
                'counterpartName' => 'Bob Example',
            ],
        ],
        'dnd' => false, 'cf' => '', 'codecs' => ['ulaw', 'alaw'],
        'ip' => '192.0.2.10', 'port' => '5060', 'sipuseragent' => 'Yealink T46U', 'chanType' => 'pjsip',
    ],
    '202' => ['exten' => '202', 'status' => 'online', 'conversations' => []],
], "the extensions must keep only the allowed fields: $json");
check(str_contains($json, '"conversations":{}'), "an empty map must stay a JSON object: $json");

$trunks = json_encode([
    'Provider' => [
        'name' => 'Provider', 'status' => 'online', 'registration' => 'registered', 'ip' => '198.51.100.7', 'port' => '5060',
        'exten' => '2001', 'codecs' => ['alaw'], 'chanType' => 'pjsip', 'maxChannels' => 4, 'sipuseragent' => 'secret',
        'username' => 'sip-auth-user', 'password' => 'webrtc-secret-value',
        'conversations' => [
            'c1' => [
                'id' => 'c1', 'duration' => 7, 'direction' => 'in', 'owner' => 'owner-201', 'recording' => 'false',
                'chSource' => ['channelStatus' => 'up', 'channel' => 'PJSIP/trunk-1', 'callerNum' => 'nested-secret'],
                'chDest' => null,
                'internalNum' => '201', 'internalName' => 'Alice Example', 'externalNum' => '0200000000',
                'externalName' => '', 'throughQueue' => true,
            ],
            'c2' => ['id' => 'c2', 'direction' => 'out', 'connected' => false, 'chSource' => 'nested-secret'],
        ],
    ],
    'Unmonitored' => ['name' => 'Unmonitored', 'status' => null, 'conversations' => new stdClass()],
]);

[$status, $json] = live('trunks', ok($trunks), $requested);
check($status === 200, 'the trunks must be returned');
checkNoLeak($json, 'the trunks');
check(json_decode($json, true) === [
    'Provider' => [
        'name' => 'Provider', 'status' => 'online', 'registration' => 'registered',
        'conversations' => [
            'c1' => [
                'id' => 'c1', 'duration' => 7, 'direction' => 'in', 'chSource' => ['channelStatus' => 'up'], 'chDest' => null,
                'internalNum' => '201', 'internalName' => 'Alice Example', 'externalNum' => '0200000000',
                'externalName' => '', 'throughQueue' => true,
            ],
            'c2' => ['id' => 'c2', 'direction' => 'out', 'connected' => false],
        ],
    ],
    'Unmonitored' => ['name' => 'Unmonitored', 'status' => null, 'conversations' => []],
], "the trunks must keep only the allowed fields: $json");
check(!str_contains(json_encode(json_decode($json, true)['Provider']['conversations']['c2']), 'chSource'), 'a channel that is not an object must be dropped');

$users = json_encode([
    'alice' => [
        'name' => 'Alice Example', 'username' => 'alice', 'presence' => 'online', 'mainPresence' => 'busy',
        'presenceOnBusy' => 'online', 'profile' => ['id' => 3, 'macro_permissions' => ['nested-secret' => true]],
        'endpoints' => [
            'email' => [['id' => 'alice@example.org']],
            'cellphone' => [['id' => '3330000000']],
            'voicemail' => [['id' => '201']],
            'mainextension' => [['id' => '201', 'description' => 'Yealink T46U']],
            'extension' => [
                ['id' => '201', 'type' => 'physical', 'description' => 'Yealink T46U'],
                ['id' => '91201', 'type' => 'webrtc', 'secret' => 'webrtc-secret-value', 'username' => 'username-of-endpoint', 'description' => 'Janus'],
                ['id' => '92201', 'type' => 'mobile', 'password' => 'webrtc-secret-value', 'auth' => ['secret' => 'nested-secret']],
            ],
        ],
        'secret' => 'webrtc-secret-value',
    ],
    'bob' => ['name' => 'Bob Example', 'username' => 'bob', 'mainPresence' => 'offline', 'endpoints' => ['extension' => [], 'mainextension' => []]],
]);

[$status, $json] = live('users', ok($users), $requested);
check($status === 200, 'the users must be returned');
checkNoLeak($json, 'the users');
check(json_decode($json, true) === [
    'alice' => [
        'name' => 'Alice Example', 'username' => 'alice', 'mainPresence' => 'busy',
        'endpoints' => [
            'mainextension' => [['id' => '201']],
            'extension' => [
                ['id' => '201', 'type' => 'physical'],
                ['id' => '91201', 'type' => 'webrtc'],
                ['id' => '92201', 'type' => 'mobile'],
            ],
        ],
    ],
    'bob' => ['name' => 'Bob Example', 'username' => 'bob', 'mainPresence' => 'offline', 'endpoints' => ['mainextension' => [], 'extension' => []]],
], "the users must keep only the allowed fields: $json");

[$status, $json] = live('users', ok('{}'));
check($status === 200 && $json === '{}', "an empty CTI answer must stay a JSON object: $json");

[$status, $json] = live('extensions', null);
check($status === 503, 'an unreachable CTI server must give 503');
check(json_decode($json, true) === ['message' => 'The CTI server is not reachable'], "the 503 must use the standard error shape: $json");

[$status, $json] = live('trunks', ['status' => 401, 'body' => 'Unauthorized: webrtc-secret-value']);
check($status === 502, 'a CTI error must give 502');
check(json_decode($json, true) === ['message' => 'The CTI server answered with an error'], "the 502 must not carry the CTI text: $json");
checkNoLeak($json, 'the 502 answer');

foreach (['not json', '[]', '"text"', '42', 'null'] as $invalid) {
    [$status, $json] = live('users', ok($invalid));
    check($status === 502, "an answer that is not a JSON object ($invalid) must give 502");
    check(!str_contains($json, $invalid === 'null' ? 'nothing' : $invalid), "the 502 must not echo the CTI answer: $json");
}

echo "dashboard_live_test.php: OK\n";
