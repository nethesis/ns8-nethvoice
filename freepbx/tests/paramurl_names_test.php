<?php
// SPDX-License-Identifier: GPL-3.0-or-later

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

class MysqlOnSqlite extends PDO {
    public array $statements = [];
    public function prepare(string $query, array $options = []): PDOStatement|false {
        $query = str_replace(
            'ON DUPLICATE KEY UPDATE profile_id=VALUES(profile_id), url=VALUES(url), only_queues=VALUES(only_queues)',
            'ON CONFLICT(profile_id) DO UPDATE SET url=excluded.url, only_queues=excluded.only_queues',
            $query
        );
        $this->statements[] = $query;
        return parent::prepare($query, $options);
    }
}

class FreePBX {
    public static ?MysqlOnSqlite $pdo = null;
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

const CRM = 'https://crm.example.com/contacts?phone=$CALLER_NUMBER';
const CRM_SEARCH = 'https://CRM.example.com/search?name=$CALLER_NAME';
const HELPDESK = 'https://helpdesk.example.com/new?caller=$CALLER_NUMBER';

function database(array $rows = []): MysqlOnSqlite {
    $db = new MysqlOnSqlite('sqlite::memory:');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->exec('CREATE TABLE rest_cti_profiles (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
    $db->exec("CREATE TABLE rest_cti_profiles_paramurl (id INTEGER PRIMARY KEY AUTOINCREMENT, profile_id INTEGER NOT NULL UNIQUE, url TEXT NOT NULL DEFAULT '', only_queues INTEGER NOT NULL DEFAULT 0, name TEXT NOT NULL DEFAULT '')");
    $db->exec("INSERT INTO rest_cti_profiles (id, name) VALUES (1, 'Base'), (2, 'Standard'), (3, 'Advanced'), (5, 'Reception')");
    foreach ($rows as [$id, $profile, $url, $name]) {
        $db->prepare('INSERT INTO rest_cti_profiles_paramurl (id, profile_id, url, only_queues, name) VALUES (?, ?, ?, 0, ?)')->execute([$id, $profile, $url, $name]);
    }
    $db->statements = [];
    return $db;
}

function rows(PDO $db): array {
    return $db->query('SELECT id, profile_id, url, only_queues, name FROM rest_cti_profiles_paramurl ORDER BY id')->fetchAll(PDO::FETCH_ASSOC);
}

function names(PDO $db): array {
    return array_column(rows($db), 'name', 'profile_id');
}

function call($app, string $route, array $permissions, $body = null, array $arguments = []): array {
    [$method] = explode(' ', $route, 2);
    $request = (new ServerRequestFactory())->createServerRequest($method, '/freepbx/rest')
        ->withAttribute(NETHVOICE_PERMISSIONS_ATTRIBUTE, $permissions)
        ->withAttribute('route', new RouteArguments($arguments));
    if ($body !== null) {
        $request = $request->withParsedBody($body);
    }
    $response = $app->routes[$route]($request, (new ResponseFactory())->createResponse(), $arguments);
    return [$response->getStatusCode(), (string) $response->getBody()];
}

$db = database([
    [1, 1, CRM, ''],
    [2, 2, CRM_SEARCH, ''],
    [3, 3, HELPDESK, 'Helpdesk ticket'],
    [4, 5, 'erp.example.com/call?from=$CALLER_NUMBER', ''],
    [5, 9, 'https://user:secret@intranet.example.org:8443/', ''],
]);
nethvoiceFillParamUrlNames($db);
check(names($db) === [
    1 => 'crm.example.com (Base)',
    2 => 'crm.example.com (Standard)',
    3 => 'Helpdesk ticket',
    5 => 'erp.example.com',
    9 => 'intranet.example.org',
], 'the default names are ' . json_encode(names($db)));
$before = rows($db);
$db->statements = [];
nethvoiceFillParamUrlNames($db);
check(rows($db) === $before, 'a second run changed the names');
check(count($db->statements) === 0, 'a second run wrote: ' . json_encode($db->statements));

$long = 'https://' . str_repeat('a', 60) . '.example.com/';
$db = database([[1, 1, $long, ''], [2, 2, $long, ''], [3, 3, HELPDESK, 'Helpdesk ticket'], [4, 5, HELPDESK, '']]);
nethvoiceFillParamUrlNames($db);
$names = names($db);
check(mb_strlen($names[1]) === 50 && str_ends_with($names[1], ' (Base)') && str_starts_with($names[1], 'aaaa'), "a long host was not cut before the profile: {$names[1]}");
check(str_ends_with($names[2], ' (Standard)') && $names[1] !== $names[2], "two long hosts got the same name: {$names[2]}");
check($names[3] === 'Helpdesk ticket' && $names[5] === 'helpdesk.example.com (Reception)', 'a host shared with a named URL did not get the profile: ' . json_encode($names));

check(nethvoiceIsValidParamUrlName('CRM contact') && nethvoiceIsValidParamUrlName(str_repeat('è', 50)), 'a valid name is refused');
foreach (['', '   ', "CRM\tcontact", "CRM\ncontact", "CRM\x7f", str_repeat('a', 51), "CRM \xff"] as $name) {
    check(!nethvoiceIsValidParamUrlName($name), 'an invalid name is accepted: ' . json_encode($name, JSON_INVALID_UTF8_SUBSTITUTE));
}

$app = new RouteCollector();
$cwd = getcwd();
chdir(sys_get_temp_dir());
$level = error_reporting(E_ALL & ~E_WARNING);
require $rest . '/modules/cti.php';
error_reporting($level);
chdir($cwd);

foreach (['GET /cti/paramurls', 'POST /cti/paramurl', 'PUT /cti/paramurl/{id}'] as $route) {
    check(isset($app->routes[$route]), "$route is not registered");
}

FreePBX::$pdo = database();
[$status, $body] = call($app, 'GET /cti/paramurls', ['superadmin']);
check($status === 200 && $body === '[]', "an empty list answered $status $body");

[$status, $body] = call($app, 'POST /cti/paramurl', ['superadmin'], ['url' => CRM, 'profiles' => [1, 2], 'only_queues' => false]);
check($status === 200 && $body === '', "a superadmin create without names answered $status $body");
check(names(FreePBX::$pdo) === [1 => 'crm.example.com (Base)', 2 => 'crm.example.com (Standard)'], 'a create without names did not get the default names: ' . json_encode(names(FreePBX::$pdo)));

[$status, $body] = call($app, 'POST /cti/paramurl', ['integrations'], ['url' => HELPDESK, 'profiles' => [3], 'only_queues' => true, 'names' => ['3' => 'Helpdesk ticket']]);
check($status === 200, "a create with a name answered $status $body");
check(names(FreePBX::$pdo)[3] === 'Helpdesk ticket', 'the name of a create was not saved');

[$status, $body] = call($app, 'GET /cti/paramurls', ['superadmin']);
$list = json_decode($body, true);
check($status === 200 && count($list) === 2, "the list answered $status $body");
$crm = $list[array_search(CRM, array_column($list, 'url'), true)];
check(array_keys($crm) === ['id', 'url', 'profiles', 'only_queues', 'names'], 'the fields of a URL are ' . json_encode(array_keys($crm)));
check($crm['profiles'] === '1,2' && $crm['only_queues'] === false, 'the existing fields changed: ' . json_encode($crm));
check($crm['names'] === ['1' => 'crm.example.com (Base)', '2' => 'crm.example.com (Standard)'], 'the names of a URL are ' . json_encode($crm['names']));
check(str_contains($body, '"names":{"3":"Helpdesk ticket"}'), "a single name is not a JSON object: $body");

$echo = $crm;
$echo['profiles'] = ['1', '2'];
$echo['url'] = 'https://crm.example.com/v2?phone=$CALLER_NUMBER';
[$status, $body] = call($app, 'PUT /cti/paramurl/{id}', ['superadmin'], $echo, ['id' => (string) $crm['id']]);
check($status === 200 && $body === '', "the old wizard update answered $status $body");
check(names(FreePBX::$pdo) === [1 => 'crm.example.com (Base)', 2 => 'crm.example.com (Standard)', 3 => 'Helpdesk ticket'], 'the names echoed by the old wizard changed the names: ' . json_encode(names(FreePBX::$pdo)));

[$status] = call($app, 'PUT /cti/paramurl/{id}', ['superadmin'], ['id' => '1', 'url' => 'https://erp.example.com/', 'profiles' => [1, 2, 5], 'only_queues' => false], ['id' => '1']);
check($status === 200, 'an update without names failed');
check(names(FreePBX::$pdo) === [1 => 'crm.example.com (Base)', 2 => 'crm.example.com (Standard)', 3 => 'Helpdesk ticket', 5 => 'erp.example.com (Reception)'], 'an update without names changed the stored names: ' . json_encode(names(FreePBX::$pdo)));

[$status] = call($app, 'PUT /cti/paramurl/{id}', ['integrations'], ['id' => '1', 'url' => 'https://erp.example.com/', 'profiles' => [1, 2, 5], 'only_queues' => false, 'names' => ['2' => 'ERP sales']], ['id' => '1']);
check($status === 200, 'an update with a name failed');
check(names(FreePBX::$pdo) === [1 => 'crm.example.com (Base)', 2 => 'ERP sales', 3 => 'Helpdesk ticket', 5 => 'erp.example.com (Reception)'], 'an update with a name changed other rows: ' . json_encode(names(FreePBX::$pdo)));

$stored = rows(FreePBX::$pdo);
$invalid = [
    'a tab' => ['5' => "ERP\tsales"],
    'a line feed' => ['5' => "ERP\nsales"],
    'too long' => ['5' => str_repeat('a', 51)],
    'blank' => ['5' => '  '],
    'a number' => ['5' => 7],
    'a list of lists' => [['ERP']],
];
foreach ($invalid as $label => $names) {
    foreach ([['POST /cti/paramurl', []], ['PUT /cti/paramurl/{id}', ['id' => '1']]] as [$route, $arguments]) {
        FreePBX::$pdo->statements = [];
        [$status, $body] = call($app, $route, ['integrations'], ['id' => '1', 'url' => 'https://erp.example.com/', 'profiles' => [5], 'only_queues' => false, 'names' => $names], $arguments);
        check($status === 400 && $body === '{"status":"Invalid parameterized URL name"}', "$route with a name that is $label answered $status $body");
        check(FreePBX::$pdo->statements === [] && rows(FreePBX::$pdo) === $stored, "$route with a name that is $label wrote to the database");
    }
}
foreach (['a number' => ['5' => 7], 'not an object' => 'ERP', 'null' => null] as $label => $names) {
    [$status, $body] = call($app, 'PUT /cti/paramurl/{id}', ['superadmin'], ['url' => 'https://erp.example.com/', 'profiles' => [5], 'only_queues' => false, 'names' => $names], ['id' => '1']);
    check($status === 400 && $body === '{"status":"Invalid parameterized URL name"}', "a superadmin update with names that are $label answered $status $body");
}
check(rows(FreePBX::$pdo) === $stored, 'a refused superadmin update wrote to the database');

[$status] = call($app, 'PUT /cti/paramurl/{id}', ['superadmin'], ['url' => 'https://erp.example.com/', 'profiles' => [1, 2, 5], 'only_queues' => false, 'names' => ['5' => "ERP\tsuperadmin"]], ['id' => '1']);
check($status === 200 && names(FreePBX::$pdo)[5] === "ERP\tsuperadmin", 'the superadmin name is checked beyond its type');

[$status] = call($app, 'PUT /cti/paramurl/{id}', ['integrations'], ['url' => 'https://erp.example.com/', 'profiles' => [1, 2, 5], 'only_queues' => false, 'names' => ['5' => str_repeat('è', 50)]], ['id' => '1']);
check($status === 200 && names(FreePBX::$pdo)[5] === str_repeat('è', 50), 'a name of 50 characters is refused');

echo "PASS: parameterized URL names\n";
