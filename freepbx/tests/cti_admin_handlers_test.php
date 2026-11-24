<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Run the customer card, CTI profile and video source handlers of cti.php against SQLite, as the superadmin and as limited administrators.

$rest = __DIR__ . '/../var/www/html/freepbx/rest';
require $rest . '/vendor/autoload.php';
require $rest . '/lib/JsonResponse.php';
require $rest . '/lib/Permissions.php';
require $rest . '/lib/libParamUrls.php';
require $rest . '/lib/libStreaming.php';
require $rest . '/lib/libDoorPhones.php';

use Slim\Psr7\Factory\ResponseFactory;
use Slim\Psr7\Factory\ServerRequestFactory;

function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}

class FreePBX {
    public static ?PDO $pdo = null;
    public static function Database() { return self::$pdo; }
}

class NethCTI {
    public static ?PDO $pdo = null;
    public static function Database() { return self::$pdo; }
}

class RouteCollector {
    public array $routes = [];
    public function __call($method, $arguments) { $this->routes[strtoupper($method) . ' ' . $arguments[0]] = $arguments[1]; }
}

class RouteArguments {
    public function __construct(private array $arguments) {}
    public function getArgument($name) { return $this->arguments[$name] ?? null; }
}

$created = [];
function postCTIProfile($profile, $id = false) {
    global $created;
    $created[] = $profile;
    return 42;
}

function triggerMiddlewareProfilesReload() {}

function getCTIPermissionProfiles($id) {
    $sth = FreePBX::$pdo->prepare('SELECT id, name FROM rest_cti_profiles WHERE id = ?');
    $sth->execute([$id]);
    return $sth->fetch(PDO::FETCH_ASSOC);
}

function sqlite(array $statements): PDO {
    $db = new PDO('sqlite::memory:');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    foreach ($statements as $statement) {
        $db->exec($statement);
    }
    return $db;
}

function resetDatabases(): void {
    FreePBX::$pdo = sqlite([
        "CREATE TABLE rest_cti_permissions (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL DEFAULT '' UNIQUE, displayname TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '')",
        'CREATE TABLE rest_cti_profiles_permissions (profile_id INTEGER NOT NULL, permission_id INTEGER NOT NULL)',
        'CREATE TABLE rest_cti_macro_permissions_permissions (macro_permission_id INTEGER NOT NULL, permission_id INTEGER NOT NULL)',
        'CREATE TABLE rest_cti_profiles (id INTEGER PRIMARY KEY, name TEXT NOT NULL)',
        "INSERT INTO rest_cti_permissions (id, name, displayname, description) VALUES (4001, 'cc_crm', 'CRM', 'Enable the customer card for this profile'), (4002, 'cc_shop', 'Shop', 'Enable the customer card for this profile'), (4003, 'vs_gate', 'Gate', 'Enable the video source for this profile'), (10, 'spy', 'Spy', 'Listen to calls')",
        'INSERT INTO rest_cti_profiles_permissions VALUES (1, 4001), (3, 4001), (1, 4002), (1, 4003)',
        "INSERT INTO rest_cti_profiles (id, name) VALUES (1, 'Base'), (3, 'Advanced')",
    ]);
    NethCTI::$pdo = sqlite([
        'CREATE TABLE customer_card (id INTEGER PRIMARY KEY, name TEXT NOT NULL, creation TEXT NOT NULL, query TEXT, template TEXT, dbconn_id INTEGER, permission_id INTEGER)',
        "INSERT INTO customer_card VALUES (1, 'CRM', '2026-01-01 00:00:00', 'select 1', 'identity', 5, 4001), (2, 'Shop', '2026-01-02 00:00:00', 'select 2', 'table', 5, 4002), (3, 'Invoices', '2026-01-03 00:00:00', 'select 3', 'identity', 6, NULL)",
    ]);
}

function call($app, string $route, array $permissions, $body = null, array $arguments = [], string $query = ''): array {
    [$method] = explode(' ', $route, 2);
    $request = (new ServerRequestFactory())->createServerRequest($method, '/freepbx/rest' . ($query === '' ? '' : '?' . $query))
        ->withAttribute(NETHVOICE_PERMISSIONS_ATTRIBUTE, $permissions)
        ->withAttribute('route', new RouteArguments($arguments));
    if ($body !== null) {
        $request = $request->withParsedBody($body);
    }
    $response = $app->routes[$route]($request, (new ResponseFactory())->createResponse(), $arguments);
    return [$response->getStatusCode(), (string) $response->getBody()];
}

function cardIds(string $body): array {
    return array_column(json_decode($body, true) ?? [], 'id');
}

function permissions(): array {
    return FreePBX::$pdo->query('SELECT id, name, displayname FROM rest_cti_permissions ORDER BY id')->fetchAll(PDO::FETCH_ASSOC);
}

$app = new RouteCollector();
$sandbox = sys_get_temp_dir() . '/cti-admin-handlers-test-' . getmypid();
mkdir($sandbox);
$lock = "$sandbox/contextLock";
$module = str_replace("'/var/run/nethvoice/contextLock'", var_export($lock, true), file_get_contents($rest . '/modules/cti.php'), $found);
check($found === 1, "expected one profile lock path in cti.php, found $found");
file_put_contents("$sandbox/cti.php", $module);
register_shutdown_function(function () use ($sandbox, $lock) {
    @unlink($lock);
    unlink("$sandbox/cti.php");
    rmdir($sandbox);
});
$cwd = getcwd();
chdir(sys_get_temp_dir());
$level = error_reporting(E_ALL & ~E_WARNING);
require "$sandbox/cti.php";
error_reporting($level);
chdir($cwd);
ini_set('error_log', '/dev/null');

$superadmin = [NETHVOICE_SUPERADMIN];
$integrator = ['integrations'];
$userer = ['users'];

$tests = [];

$tests['GET /cti/customer_card filters on the card columns only, joined by AND'] = function () use ($app, $superadmin, $integrator) {
    resetDatabases();
    [$status, $body] = call($app, 'GET /cti/customer_card', $superadmin);
    check($status === 200 && cardIds($body) === [1, 2, 3], "the superadmin must list every card: $status $body");
    check(json_decode($body, true)[0]['profiles'] === [1, 3], "the profiles of a card are not listed: $body");
    [$status, $body] = call($app, 'GET /cti/customer_card', $superadmin, null, [], 'permission_id=4002');
    check($status === 200 && cardIds($body) === [2], "the superadmin must filter on permission_id: $status $body");
    foreach ([$superadmin, $integrator] as $permissions) {
        [$status, $body] = call($app, 'GET /cti/customer_card', $permissions, null, [], 'dbconn_id=5&template=identity');
        check($status === 200 && cardIds($body) === [1], "two filters must both apply: $status $body");
        [$status, $body] = call($app, 'GET /cti/customer_card', $permissions, null, [], 'id=2');
        check($status === 200 && cardIds($body) === [2], "a single filter must apply: $status $body");
        foreach (['id%3D0%20OR%201%3D1%20OR%20id=1', 'id%3D0%09OR%09SLEEP(2)%09OR%09id=1', 'nonexistent=1', 'id[]=1', 'id[a]=1'] as $query) {
            [$status, $body] = call($app, 'GET /cti/customer_card', $permissions, null, [], $query);
            check($status === 400, "the filter $query must be refused, got $status $body");
        }
    }
};

$tests['renaming a customer card keeps a working permission when the new name is taken'] = function () use ($app, $superadmin, $integrator) {
    foreach ([$superadmin, $integrator] as $permissions) {
        resetDatabases();
        [$status] = call($app, 'PUT /cti/customer_card/{id}', $permissions, ['name' => 'Shop!'], ['id' => '1']);
        check($status === 200, "a rename whose permission name is taken must succeed, got $status");
        check(NethCTI::$pdo->query('SELECT name FROM customer_card WHERE id = 1')->fetchColumn() === 'Shop!', 'the card was not renamed');
        $rows = permissions();
        check($rows[1] === ['id' => 4001, 'name' => 'cc_crm', 'displayname' => 'Shop!'] && $rows[2] === ['id' => 4002, 'name' => 'cc_shop', 'displayname' => 'Shop'], 'unexpected permissions: ' . json_encode($rows));

        [$status] = call($app, 'PUT /cti/customer_card/{id}', $permissions, ['name' => 'Big Customers'], ['id' => '1']);
        $rows = permissions();
        check($status === 200 && $rows[1] === ['id' => 4001, 'name' => 'cc_big_customers', 'displayname' => 'Big Customers'], 'a free permission name must follow the card: ' . json_encode($rows));
    }
};

$tests['POST /cti/profiles checks the name only for limited administrators'] = function () use ($app, $superadmin, $userer) {
    global $created;
    resetDatabases();
    foreach ([['name' => ''], ['name' => '  '], ['name' => 'Base'], ['macro_permissions' => []]] as $profile) {
        $created = [];
        [$status, $body] = call($app, 'POST /cti/profiles', $superadmin, $profile);
        check($status === 200 && $body === '{"id":42}' && $created === [$profile], 'the superadmin must create the profile as before: ' . json_encode([$profile, $status, $body, $created]));
    }
    foreach ([[['name' => ''], 422], [['name' => '  '], 422], [['macro_permissions' => []], 422], [['name' => 'Base'], 409], [['name' => ' Base '], 409]] as [$profile, $expected]) {
        $created = [];
        [$status] = call($app, 'POST /cti/profiles', $userer, $profile);
        check($status === $expected && $created === [], json_encode($profile) . " from a limited administrator: expected $expected, got $status");
    }
    $created = [];
    [$status] = call($app, 'POST /cti/profiles', $userer, ['name' => ' Sales ']);
    check($status === 200 && $created === [['name' => 'Sales']], 'a limited administrator must create a profile with a trimmed name');
};

$tests['POST /cti/profiles/{id} checks the profile only for limited administrators and answers 423 to everyone while locked'] = function () use ($app, $superadmin, $userer, $lock) {
    global $created;
    resetDatabases();
    FreePBX::$pdo->exec("INSERT INTO rest_cti_profiles (id, name) VALUES (5, 'Hotel')");
    foreach ([['9', ['name' => 'Ghost']], ['1', ['name' => '']], ['1', ['name' => '  ']], ['1', ['name' => 'Advanced']], ['5', ['name' => 'Reception']], ['1', ['name' => 'Hotel']], ['1', ['macro_permissions' => []]]] as [$id, $profile]) {
        $created = [];
        [$status, $body] = call($app, 'POST /cti/profiles/{id}', $superadmin, $profile, ['id' => $id]);
        check($status === 200 && $body === '{"status":true}' && $created === [$profile], 'the superadmin must edit the profile as before: ' . json_encode([$id, $profile, $status, $body, $created]));
    }
    foreach ([['9', ['name' => 'Ghost'], 404], ['1', ['name' => ''], 422], ['1', ['name' => '  '], 422], ['1', ['name' => 'Advanced'], 409], ['1', ['name' => ' Advanced '], 409], ['5', ['name' => 'Reception'], 422], ['1', ['name' => 'Hotel'], 422]] as [$id, $profile, $expected]) {
        $created = [];
        [$status] = call($app, 'POST /cti/profiles/{id}', $userer, $profile, ['id' => $id]);
        check($status === $expected && $created === [], json_encode([$id, $profile]) . " from a limited administrator: expected $expected, got $status");
    }
    foreach ([[['macro_permissions' => []], ['macro_permissions' => [], 'name' => 'Base']], [['name' => ' Sales '], ['name' => 'Sales']]] as [$profile, $expected]) {
        $created = [];
        [$status] = call($app, 'POST /cti/profiles/{id}', $userer, $profile, ['id' => '1']);
        check($status === 200 && $created === [$expected], 'a limited administrator must edit the profile with a checked name: ' . json_encode([$status, $created]));
    }
    touch($lock);
    try {
        foreach ([$superadmin, $userer] as $permissions) {
            $created = [];
            [$status, $body] = call($app, 'POST /cti/profiles/{id}', $permissions, ['name' => 'Base'], ['id' => '1']);
            check($status === 423 && $created === [], 'a locked profile change must answer 423 to ' . json_encode($permissions) . ": $status $body");
        }
    } finally {
        unlink($lock);
    }
};

$tests['video sources of limited administrators never reach the PBX node'] = function () use ($app, $superadmin, $integrator) {
    $node = ['192.0.2.5', '2001:db8::5', '10.5.4.0/24'];
    $resolve = fn(string $host) => ['camera.example.test' => ['192.0.2.5'], 'yard.example.test' => ['198.51.100.7'], 'vpn.example.test' => ['198.51.100.8', '10.5.4.2']][$host] ?? [$host];
    $source = fn(string $url, array $gates = []) => ['url' => $url, 'gates' => $gates];
    $refused = function (array $source) use ($resolve, $node) {
        try {
            ctiStreamingCheckNodeDestinations($source, $resolve, $node);
            return null;
        } catch (StreamingValidationException $e) {
            return $e->getField();
        }
    };
    check($refused($source('http://198.51.100.7/snap.jpg')) === null, 'a LAN device was refused');
    check($refused($source('rtsp://yard.example.test/live')) === null, 'a device name was refused');
    check($refused($source('http://192.0.2.5/snap.jpg')) === 'url', 'a node address was accepted');
    check($refused($source('rtsp://camera.example.test:8554/live')) === 'url', 'a name of the node was accepted');
    check($refused($source('rtsps://[2001:db8::5]/live')) === 'url', 'an IPv6 node address was accepted');
    check($refused($source('http://[::ffff:192.0.2.5]/snap.jpg')) === 'url', 'an IPv4-mapped node address was accepted');
    check($refused($source('http://vpn.example.test/snap.jpg')) === 'url', 'a name with a cluster VPN address was accepted');
    $gates = [['type' => 'dtmf', 'code' => '*1', 'url' => null], ['type' => 'url', 'url' => 'http://198.51.100.7/open'], ['type' => 'url', 'url' => 'https://camera.example.test/relay']];
    check($refused($source('rtsp://198.51.100.7/live', $gates)) === 'gates[2].url', 'a gate of the node was accepted');

    $nodeAddress = null;
    foreach (streaming_node_networks() as $network) {
        if (!str_contains($network, '/') && !streaming_ip_blocked($network)) {
            $nodeAddress = $network;
            break;
        }
    }
    if ($nodeAddress !== null) {
        $host = str_contains($nodeAddress, ':') ? "[$nodeAddress]" : $nodeAddress;
        [$status, $body] = call($app, 'POST /cti/streaming', $integrator, ['descr' => 'Door', 'url' => "http://$host:9/door.jpg", 'profiles' => []]);
        check($status === 400 && json_decode($body, true) === ['status' => 'the device address is not allowed: the addresses of the PBX node are refused', 'field' => 'url'], "a limited administrator saved a source of the node: $status $body");
        [$status, $body] = call($app, 'POST /cti/streaming', $integrator, ['descr' => 'Door', 'url' => 'rtsp://198.51.100.7/live', 'gates' => [['type' => 'url', 'url' => "http://$host:9/open"]], 'profiles' => []]);
        check($status === 400 && json_decode($body, true)['field'] === 'gates[0].url', "a limited administrator saved a gate of the node: $status $body");
        [$status, $body] = call($app, 'PUT /cti/streaming/{descr}', $integrator, ['descr' => 'Door', 'url' => "http://$host:9/door.jpg"], ['descr' => 'Door']);
        check($status !== 200, "a limited administrator updated a source of the node: $status $body");
        [$status, $body] = call($app, 'POST /cti/sources/test', $integrator, ['url' => "http://$host:9/door.jpg", 'details' => true]);
        $result = json_decode($body, true);
        check($status === 200 && $result['success'] === false && $result['reason'] === 'address_not_allowed', "a limited administrator tested a source of the node: $status $body");
        [$status, $body] = call($app, 'POST /cti/sources/test', $superadmin, ['url' => "http://$host:9/door.jpg", 'details' => true]);
        $result = json_decode($body, true);
        check($status === 200 && $result['reason'] !== 'address_not_allowed', "the superadmin cannot test a source of the node as on main: $status $body");
    }
};

$tests['video sources saved by limited administrators are marked for the address guard'] = function () {
    $current = ['url' => 'http://192.0.2.30/door.jpg', 'gates' => [['type' => 'url', 'url' => 'http://192.0.2.31/open']], 'guard_addresses' => '0'];
    check(ctiStreamingGuardAddresses(true, ['url' => 'http://192.0.2.32/door.jpg', 'gates' => []]) === 0, 'a source of the superadmin is guarded');
    check(ctiStreamingGuardAddresses(true, ['url' => 'http://192.0.2.32/door.jpg', 'gates' => []], array_merge($current, ['guard_addresses' => '1'])) === 0, 'a save of the superadmin kept the guard');
    check(ctiStreamingGuardAddresses(false, ['url' => 'http://192.0.2.32/door.jpg', 'gates' => []]) === 1, 'a source of a limited administrator is not guarded');
    check(ctiStreamingGuardAddresses(false, ['url' => $current['url'], 'gates' => $current['gates']], $current) === 0, 'a limited administrator who kept the addresses guarded a source of the superadmin');
    check(ctiStreamingGuardAddresses(false, ['url' => 'http://192.0.2.32/door.jpg', 'gates' => $current['gates']], $current) === 1, 'a URL changed by a limited administrator is not guarded');
    check(ctiStreamingGuardAddresses(false, ['url' => $current['url'], 'gates' => [['type' => 'url', 'url' => 'http://192.0.2.33/open']]], $current) === 1, 'a gate changed by a limited administrator is not guarded');
    check(ctiStreamingGuardAddresses(false, ['url' => $current['url'], 'gates' => $current['gates']], array_merge($current, ['guard_addresses' => '1'])) === 1, 'a limited administrator removed the guard');

    $db = sqlite([
        "CREATE TABLE rest_cti_permissions (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL DEFAULT '' UNIQUE, displayname TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '')",
        'CREATE TABLE rest_cti_profiles_permissions (profile_id INTEGER NOT NULL, permission_id INTEGER NOT NULL)',
        "CREATE TABLE rest_cti_streaming (descr TEXT PRIMARY KEY, type TEXT, url TEXT, user TEXT, secret TEXT, `frame-rate` INTEGER, exten INTEGER, open TEXT, guard_addresses INTEGER NOT NULL DEFAULT 0, tls_skip_verify INTEGER NOT NULL DEFAULT 0, tls_fingerprint TEXT, door_phone TEXT)",
        'CREATE TABLE rest_cti_streaming_gates (id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT, position INTEGER, name TEXT, type TEXT, code TEXT, url TEXT, method TEXT, username TEXT, password TEXT, tls_fingerprint TEXT)',
        "INSERT INTO rest_cti_permissions (id, name, displayname) VALUES (4003, 'vs_gate', 'Gate')",
        "INSERT INTO rest_cti_streaming (descr, type, url, user, secret, `frame-rate`, open) VALUES ('Gate', 'image', 'http://192.0.2.20/gate.jpg', '', '', 1000, '')",
    ]);
    $source = streaming_normalize_source(['descr' => 'Gate 2', 'url' => 'http://198.51.100.20/gate.jpg', 'gates' => []], ['descr' => 'Gate', 'url' => 'http://192.0.2.20/gate.jpg', 'user' => '', 'secret' => '', 'gates' => []], fn() => ['198.51.100.20']);
    ctiStoreStreamingSource($db, $source, [1], 1, 'Gate');
    check($db->query("SELECT descr || ' ' || guard_addresses FROM rest_cti_streaming")->fetchColumn() === 'Gate 2 1', 'the guard of a renamed source was not stored');
    ctiStoreStreamingSource($db, $source, [1], 0, 'Gate 2');
    check($db->query('SELECT guard_addresses FROM rest_cti_streaming')->fetchColumn() == 0, 'the guard was not removed by the superadmin');
    try {
        ctiStoreStreamingSource($db, array_merge($source, ['descr' => 'Gate 3']), [1], 1, 'Missing');
        check(false, 'a missing source was stored');
    } catch (StreamingNotFoundException $e) {
        check(!$db->inTransaction(), 'the transaction is still open');
    }

    $cti = streaming_cti_config([
        'Guarded' => ['descr' => 'Guarded', 'type' => 'image', 'url' => 'http://198.51.100.20/a.jpg', 'user' => '', 'secret' => '', 'gates' => [], 'guard_addresses' => '1'],
        'Open' => ['descr' => 'Open', 'type' => 'image', 'url' => 'http://198.51.100.21/b.jpg', 'user' => '', 'secret' => '', 'gates' => [], 'guard_addresses' => '0'],
        'Legacy' => ['descr' => 'Legacy', 'type' => 'image', 'url' => 'http://198.51.100.22/c.jpg', 'user' => '', 'secret' => '', 'gates' => []],
    ]);
    check($cti['vs_guarded']['guard_addresses'] === true && $cti['vs_open']['guard_addresses'] === false && $cti['vs_legacy']['guard_addresses'] === false, 'the guard is not written for nethcti-server: ' . json_encode($cti));
    check(!array_key_exists('guard_addresses', streaming_public_source(['descr' => 'Guarded', 'type' => 'image', 'url' => 'http://198.51.100.20/a.jpg', 'user' => '', 'secret' => '', 'gates' => [], 'guard_addresses' => '1'])), 'the guard is listed by the REST API');
};

$failures = 0;
foreach ($tests as $name => $test) {
    try {
        $test();
        echo "ok - $name\n";
    } catch (Throwable $e) {
        $failures++;
        echo "not ok - $name: {$e->getMessage()} ({$e->getFile()}:{$e->getLine()})\n";
    }
}
if ($failures > 0) {
    echo "FAIL: $failures of " . count($tests) . " tests\n";
    exit(1);
}
echo 'PASS: ' . count($tests) . " tests\n";
