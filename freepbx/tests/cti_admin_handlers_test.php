<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Run the customer card and CTI profile handlers of cti.php against SQLite, as the superadmin and as limited administrators.

$rest = __DIR__ . '/../var/www/html/freepbx/rest';
require $rest . '/vendor/autoload.php';
require $rest . '/lib/JsonResponse.php';
require $rest . '/lib/Permissions.php';
require $rest . '/lib/libParamUrls.php';

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
$cwd = getcwd();
chdir(sys_get_temp_dir());
$level = error_reporting(E_ALL & ~E_WARNING);
require $rest . '/modules/cti.php';
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
