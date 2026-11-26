<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Rename a CTI group through PUT /cti/groups/{id} against SQLite and a sources directory, and check every place that keeps the group by name.

$rest = __DIR__ . '/../var/www/html/freepbx/rest';
require $rest . '/vendor/autoload.php';
require $rest . '/lib/JsonResponse.php';
require $rest . '/lib/Permissions.php';
require $rest . '/lib/libParamUrls.php';
require $rest . '/lib/libCTIGroups.php';

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

$reloads = 0;
function triggerMiddlewareProfilesReload() { global $reloads; $reloads++; }
function testRetrieveHelper() {}

$phonebookPdo = null;
function testPhonebookDatabase() { global $phonebookPdo; return $phonebookPdo; }

function sqlite(array $statements): PDO {
    $db = new PDO('sqlite::memory:');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    foreach ($statements as $statement) {
        $db->exec($statement);
    }
    return $db;
}

function source(string $id, string $access, $mapping): string {
    return json_encode([$id => ['url' => "file:///var/lib/nethvoice/phonebook/uploads/$id.csv", 'mapping' => $mapping, 'dbtype' => 'csv', 'interval' => 1440, 'type' => 'Fornitori è', 'access' => $access, 'enabled' => true]]);
}

function resetState(string $dir): void {
    global $phonebookPdo, $reloads;
    $reloads = 0;
    FreePBX::$pdo = sqlite([
        "CREATE TABLE rest_cti_groups (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE COLLATE NOCASE)",
        "CREATE TABLE rest_cti_permissions (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, displayname TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '')",
        'CREATE TABLE rest_cti_macro_permissions (id INTEGER PRIMARY KEY, name TEXT NOT NULL)',
        'CREATE TABLE rest_cti_macro_permissions_permissions (macro_permission_id INTEGER NOT NULL, permission_id INTEGER NOT NULL)',
        'CREATE TABLE rest_cti_profiles_permissions (profile_id INTEGER NOT NULL, permission_id INTEGER NOT NULL)',
        'CREATE TABLE rest_phonebook_imports (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at INTEGER NOT NULL, owner TEXT NOT NULL, filename TEXT, type TEXT NOT NULL, total INTEGER NOT NULL DEFAULT 0, imported INTEGER NOT NULL DEFAULT 0, skipped INTEGER NOT NULL DEFAULT 0, failed INTEGER NOT NULL DEFAULT 0)',
        "INSERT INTO rest_cti_groups (id, name) VALUES (1, 'Sales'), (2, 'Support')",
        "INSERT INTO rest_cti_macro_permissions VALUES (9, 'presence_panel')",
        "INSERT INTO rest_cti_permissions VALUES (5001, 'grp_sales', 'Group: Sales', 'Group: Sales: of presence panel'), (5002, 'grp_support', 'Group: Support', 'Group: Support: of presence panel'), (10, 'spy', 'Spy', 'Listen to calls')",
        'INSERT INTO rest_cti_macro_permissions_permissions VALUES (9, 5001), (9, 5002)',
        'INSERT INTO rest_cti_profiles_permissions VALUES (1, 5001), (3, 5001), (1, 5002), (3, 10)',
        "INSERT INTO rest_phonebook_imports (created_at, owner, filename, type) VALUES (1, 'qa_owner', 'a.csv', 'group:Sales'), (2, 'qa_owner', 'b.csv', 'public'), (3, 'qa_owner', 'c.csv', 'group:Support,Sales')",
    ]);
    $phonebookPdo = sqlite([
        "CREATE TABLE phonebook (id INTEGER PRIMARY KEY AUTOINCREMENT, access TEXT NOT NULL DEFAULT 'public', type TEXT NOT NULL DEFAULT '', name TEXT)",
        "INSERT INTO phonebook (access, type, name) VALUES ('group:Sales', 'Fornitori', 'Ada'), ('group:Sales', 'Fornitori', 'Bob'), ('group:Support,Sales', 'Clienti', 'Cy'), ('public', 'group:Sales', 'Di'), ('group:Salesforce', 'Altro', 'Ed')",
    ]);
    NethCTI::$pdo = sqlite([
        "CREATE TABLE cti_phonebook (id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id TEXT NOT NULL, type TEXT NOT NULL, name TEXT)",
        "INSERT INTO cti_phonebook (owner_id, type, name) VALUES ('qa_alice', 'group:Sales', 'Fo'), ('qa_alice', 'private', 'Gi'), ('qa_bob', 'group:Support', 'Hu')",
    ]);
    foreach (array_diff(scandir($dir), ['.', '..']) as $file) {
        unlink("$dir/$file");
    }
    file_put_contents("$dir/custom_1.json", source('custom_1', 'group:Sales', ['contact' => 'name']));
    file_put_contents("$dir/custom_2.json", source('custom_2', 'public', ['contact' => 'name']));
    file_put_contents("$dir/custom_3.json", source('custom_3', 'group:Support,Sales', new stdClass()));
    chmod("$dir/custom_1.json", 0640);
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

function column(PDO $db, string $sql): array {
    return $db->query($sql)->fetchAll(PDO::FETCH_COLUMN);
}

function snapshot(string $dir): array {
    global $phonebookPdo;
    $files = [];
    foreach (glob("$dir/*") as $file) {
        $files[basename($file)] = file_get_contents($file);
    }
    return [
        FreePBX::$pdo->query('SELECT * FROM rest_cti_groups ORDER BY id')->fetchAll(PDO::FETCH_ASSOC),
        FreePBX::$pdo->query('SELECT * FROM rest_cti_permissions ORDER BY id')->fetchAll(PDO::FETCH_ASSOC),
        FreePBX::$pdo->query('SELECT * FROM rest_cti_profiles_permissions ORDER BY profile_id, permission_id')->fetchAll(PDO::FETCH_ASSOC),
        column(FreePBX::$pdo, 'SELECT type FROM rest_phonebook_imports ORDER BY id'),
        column($phonebookPdo, 'SELECT access FROM phonebook ORDER BY id'),
        column(NethCTI::$pdo, 'SELECT type FROM cti_phonebook ORDER BY id'),
        $files,
    ];
}

$app = new RouteCollector();
$sandbox = sys_get_temp_dir() . '/cti-group-rename-test-' . getmypid();
$sources = "$sandbox/sources.d";
mkdir($sources, 0755, true);
$GLOBALS['sourcesDir'] = $sources;
$module = file_get_contents($rest . '/modules/cti.php');
$module = str_replace('phonebookDatabase(),', 'testPhonebookDatabase(),', $module, $foundDb);
$module = str_replace('PHONEBOOK_SOURCES_DIR,', "\$GLOBALS['sourcesDir'],", $module, $foundDir);
$module = str_replace("system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');", 'testRetrieveHelper();', $module);
check($foundDb === 1 && $foundDir === 1, "expected one phonebook database and one sources directory in cti.php, found $foundDb and $foundDir");
file_put_contents("$sandbox/cti.php", $module);
register_shutdown_function(function () use ($sandbox, $sources) {
    foreach (array_diff(scandir($sources), ['.', '..']) as $file) {
        unlink("$sources/$file");
    }
    rmdir($sources);
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

$userer = ['users'];
$tests = [];

$tests['sharing values follow the renamed group only'] = function () {
    check(phonebookRenameSharingGroup('group:Sales', 'Sales', 'Sales Team') === 'group:Sales Team', 'single group not renamed');
    check(phonebookRenameSharingGroup('group:Support, sales ,Other', 'Sales', 'Team') === 'group:Support,Team,Other', 'group in a list not renamed');
    check(phonebookRenameSharingGroup('group:Team,Sales', 'Sales', 'Team') === 'group:Team', 'duplicate kept');
    foreach (['public', 'private', 'group:Salesforce', 'group:Support , Other', 'Sales', ''] as $value) {
        check(phonebookRenameSharingGroup($value, 'Sales', 'Team') === $value, 'unrelated value changed: ' . $value);
    }
};

$tests['the new name is checked like a new group'] = function () {
    $groups = [['id' => 1, 'name' => 'Sales'], ['id' => 2, 'name' => 'Support']];
    foreach ([[null, 400], ['', 400], ['   ', 400], [str_repeat('a', 66), 400], ['Sales, North', 400], ['!!!', 400], ['support', 409], [' SUPPORT ', 409], ['Sup-port', 409]] as [$name, $status]) {
        $issue = ctiGroupNameIssue($groups, 1, $name);
        check(is_array($issue) && $issue[0] === $status, json_encode($name) . " must be refused with $status: " . json_encode($issue));
    }
    foreach (['sales', 'SALES!', str_repeat('é', 64) . 'a', 'Sales North'] as $name) {
        check(ctiGroupNameIssue($groups, 1, $name) === null, json_encode($name) . ' must be accepted');
    }
};

$tests['renaming updates the group, its permission, the sources and the contacts shared with it'] = function () use ($app, $userer, $sources) {
    global $phonebookPdo, $reloads;
    resetState($sources);
    $publicSource = file_get_contents("$sources/custom_2.json");
    [$status, $body] = call($app, 'PUT /cti/groups/{id}', $userer, ['name' => ' Sales Team '], ['id' => '1']);
    check($status === 200, "rename failed: $status $body");
    check(json_decode($body, true) === ['id' => 1, 'name' => 'Sales Team', 'phonebook_sources' => 2, 'contacts' => 4], "unexpected result: $body");
    check($reloads === 1, 'the CTI configuration was not reloaded');
    check(column(FreePBX::$pdo, 'SELECT name FROM rest_cti_groups ORDER BY id') === ['Sales Team', 'Support'], 'group not renamed');
    check(FreePBX::$pdo->query('SELECT * FROM rest_cti_permissions WHERE id = 5001')->fetch(PDO::FETCH_ASSOC) === ['id' => 5001, 'name' => 'grp_salesteam', 'displayname' => 'Group: Sales Team', 'description' => 'Group: Sales Team: of presence panel'], 'permission not renamed in place');
    check(column(FreePBX::$pdo, 'SELECT profile_id FROM rest_cti_profiles_permissions WHERE permission_id = 5001 ORDER BY profile_id') === [1, 3], 'profiles lost the group permission');
    check(column(FreePBX::$pdo, 'SELECT type FROM rest_phonebook_imports ORDER BY id') === ['group:Sales Team', 'public', 'group:Support,Sales Team'], 'imports not updated');
    check(column($phonebookPdo, 'SELECT access FROM phonebook ORDER BY id') === ['group:Sales Team', 'group:Sales Team', 'group:Support,Sales Team', 'public', 'group:Salesforce'], 'phonebook contacts not updated');
    check(column($phonebookPdo, "SELECT type FROM phonebook WHERE name = 'Di'") === ['group:Sales'], 'the source label of a contact changed');
    check(column(NethCTI::$pdo, 'SELECT type FROM cti_phonebook ORDER BY id') === ['group:Sales Team', 'private', 'group:Support'], 'CTI contacts not updated');
    $first = json_decode(file_get_contents("$sources/custom_1.json"), true);
    check($first === json_decode(source('custom_1', 'group:Sales Team', ['contact' => 'name']), true), 'source shared with the group not updated: ' . json_encode($first));
    check((fileperms("$sources/custom_1.json") & 0777) === 0640, 'source permissions changed');
    check(file_get_contents("$sources/custom_3.json") === source('custom_3', 'group:Support,Sales Team', new stdClass()), 'source with two groups not updated or its empty mapping changed');
    check(file_get_contents("$sources/custom_2.json") === $publicSource, 'public source rewritten');
    check(array_values(array_diff(scandir($sources), ['.', '..'])) === ['custom_1.json', 'custom_2.json', 'custom_3.json'], 'temporary files left in the sources directory');

    [$status, $body] = call($app, 'PUT /cti/groups/{id}', $userer, ['name' => 'Sales Team'], ['id' => '1']);
    check($status === 200 && $reloads === 1, "same name not a no-op: $status $body $reloads");
    [$status, $body] = call($app, 'PUT /cti/groups/{id}', $userer, ['name' => 'sales team'], ['id' => '1']);
    check($status === 200 && $reloads === 2 && column(FreePBX::$pdo, 'SELECT name FROM rest_cti_groups WHERE id = 1') === ['sales team'], "case change not applied: $status $body");
    check(column(FreePBX::$pdo, 'SELECT name FROM rest_cti_permissions WHERE id = 5001') === ['grp_salesteam'] && column($phonebookPdo, 'SELECT access FROM phonebook WHERE id = 1') === ['group:sales team'], 'case change not applied to the permission and the contacts');
};

$tests['invalid names and unknown groups change nothing'] = function () use ($app, $userer, $sources) {
    global $reloads;
    resetState($sources);
    $before = snapshot($sources);
    foreach ([[['name' => 'support'], '1', 409], [['name' => 'Sup port!'], '1', 409], [['name' => ''], '1', 400], [[], '1', 400], [['name' => ['Sales']], '1', 400], [['name' => 'North, South'], '1', 400], [['name' => str_repeat('x', 66)], '1', 400], [['name' => 'Ghost'], '99', 404]] as [$body, $id, $expected]) {
        [$status, $response] = call($app, 'PUT /cti/groups/{id}', $userer, $body, ['id' => $id]);
        check($status === $expected && isset(json_decode($response, true)['message']), json_encode([$body, $id]) . " expected $expected, got $status $response");
    }
    check(snapshot($sources) === $before && $reloads === 0, 'a refused rename changed something');
};

$tests['a rename that cannot keep the sharing valid is refused with the reasons'] = function () use ($app, $userer, $sources) {
    global $phonebookPdo, $reloads;
    resetState($sources);
    $phonebookPdo->exec("INSERT INTO phonebook (access, name) VALUES ('group:Support," . str_repeat('x', 240) . "', 'Long')");
    file_put_contents("$sources/custom_8.json", '{"custom_8": {"access": "group:Support"');
    file_put_contents("$sources/custom_9.json", '{"custom_9": {"access": "public"');
    $before = snapshot($sources);
    [$status, $body] = call($app, 'PUT /cti/groups/{id}', $userer, ['name' => str_repeat('s', 30)], ['id' => '2']);
    $response = json_decode($body, true);
    check($status === 409, "expected 409, got $status $body");
    check($response['errors'] === ['The phonebook source custom_8 cannot be read', 'The sharing of 1 phonebook contacts would be longer than 255 characters'], 'unexpected reasons: ' . $body);
    check(str_starts_with($response['message'], 'The group cannot be renamed: '), 'reasons missing from the message: ' . $body);
    check(snapshot($sources) === $before && $reloads === 0, 'a refused rename changed something');
};

$tests['a failure while renaming restores everything already changed'] = function () use ($app, $userer, $sources) {
    global $phonebookPdo, $reloads;
    resetState($sources);
    NethCTI::$pdo->exec("CREATE TRIGGER qa_fail BEFORE UPDATE ON cti_phonebook BEGIN SELECT RAISE(ABORT, 'disk full'); END");
    $before = snapshot($sources);
    [$status] = call($app, 'PUT /cti/groups/{id}', $userer, ['name' => 'Sales Team'], ['id' => '1']);
    check($status === 500, "expected 500, got $status");
    check(snapshot($sources) === $before && $reloads === 0, 'a failed rename left changes behind');

    $first = "$sources/custom_1.json";
    $files = [$first => ['old' => file_get_contents($first), 'new' => 'changed'], "$sources/missing/custom_4.json" => ['old' => '', 'new' => 'changed']];
    try {
        phonebookWriteFiles($files, 'new');
        check(false, 'writing into a missing directory succeeded');
    } catch (RuntimeException $e) {
    }
    check(file_get_contents($first) === $files[$first]['old'], 'a source written before the failure was not restored');
};

$tests['a permission shared with a similar group stays with it and an unused one is replaced'] = function () use ($app, $userer, $sources) {
    resetState($sources);
    FreePBX::$pdo->exec("INSERT INTO rest_cti_groups (id, name) VALUES (3, 'sales!')");
    [$status, $body] = call($app, 'PUT /cti/groups/{id}', $userer, ['name' => 'Old Sales'], ['id' => '3']);
    check($status === 200, "rename failed: $status $body");
    check(column(FreePBX::$pdo, "SELECT name FROM rest_cti_permissions WHERE name LIKE 'grp_%' ORDER BY name") === ['grp_oldsales', 'grp_sales', 'grp_support'], 'shared permission renamed');
    $id = FreePBX::$pdo->query("SELECT id FROM rest_cti_permissions WHERE name = 'grp_oldsales'")->fetchColumn();
    check(column(FreePBX::$pdo, "SELECT profile_id FROM rest_cti_profiles_permissions WHERE permission_id = $id ORDER BY profile_id") === [1, 3], 'profiles not copied to the new permission');
    check(column(FreePBX::$pdo, "SELECT macro_permission_id FROM rest_cti_macro_permissions_permissions WHERE permission_id = $id") === [9], 'new permission not in the presence panel');
    check(column(FreePBX::$pdo, 'SELECT profile_id FROM rest_cti_profiles_permissions WHERE permission_id = 5001 ORDER BY profile_id') === [1, 3], 'the other group lost its permission');

    resetState($sources);
    FreePBX::$pdo->exec("INSERT INTO rest_cti_permissions VALUES (5009, 'grp_team', 'Group: Team', 'Group: Team: of presence panel')");
    FreePBX::$pdo->exec('INSERT INTO rest_cti_profiles_permissions VALUES (3, 5009)');
    [$status, $body] = call($app, 'PUT /cti/groups/{id}', $userer, ['name' => 'Team'], ['id' => '2']);
    check($status === 200, "rename over an unused permission failed: $status $body");
    check(column(FreePBX::$pdo, "SELECT id FROM rest_cti_permissions WHERE name = 'grp_team'") === [5002], 'group permission not renamed over the unused one');
    check(column(FreePBX::$pdo, 'SELECT profile_id FROM rest_cti_profiles_permissions WHERE permission_id IN (5002, 5009) ORDER BY profile_id') === [1], 'profiles of the unused permission kept');
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
