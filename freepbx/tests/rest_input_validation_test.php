<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Run the REST handlers against recording fakes: invalid extensions, MACs, ring times, template names and CTI profile names never reach SQL, AMI or the filesystem, valid ones reach them unchanged.

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\RequestHandlerInterface;
use Slim\Factory\AppFactory;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Routing\RouteContext;

$rest = realpath(__DIR__ . '/../var/www/html/freepbx/rest');
require $rest . '/vendor/autoload.php';
ini_set('error_log', '/dev/null');

function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}

class LockedException extends Exception {}

class RecordingDatabase {
    public array $log = [];
    public bool $locked = false;
    public $rows;

    public function prepare($sql) { return new RecordingStatement($this, $sql); }
    public function query($sql) {
        $this->log[] = ['query', $sql, null];
        if ($this->locked) { throw new LockedException('database locked'); }
        return new RecordingStatement($this, $sql);
    }
    public function sql($sql, $type = 'query', $mode = null) {
        $this->log[] = ['sql', $sql, null];
        if ($this->locked) { throw new LockedException('database locked'); }
        return $type === 'getAll' ? [] : false;
    }
    public function exec($sql) {
        $this->log[] = ['exec', $sql, null];
        if ($this->locked) { throw new LockedException('database locked'); }
        return 0;
    }
}

class RecordingStatement {
    private array $result = [];
    public function __construct(private RecordingDatabase $db, private string $sql) {}
    public function execute($params = []) {
        $this->db->log[] = ['prepare', $this->sql, $params];
        if ($this->db->locked) { throw new LockedException('database locked'); }
        $this->result = ($this->db->rows)($this->sql, $params);
        return true;
    }
    public function fetchAll($mode = null) { return $this->result; }
    public function fetch($mode = null) { return array_shift($this->result) ?? false; }
    public function fetchColumn() { return $this->result ? reset($this->result[0]) : false; }
}

class RecordingManager {
    public array $log = [];
    public bool $locked = false;
    public function __call($name, $args) {
        $this->log[] = [$name, $args];
        if ($this->locked) { throw new LockedException('manager locked'); }
        return $name === 'connected' ? true : ['Response' => 'Success', 'data' => ''];
    }
}

class FakeCore {
    public $config;
    public function getAllUsers() {
        return [['extension' => '201'], ['extension' => '202'], ['extension' => '91202']];
    }
    public function __call($name, $args) { return []; }
}

class StaticCalls {
    public static array $log = [];
    public function __construct(private string $module) {}
    public function __call($name, $args) {
        self::$log[] = [$this->module, $name, $args];
        return true;
    }
}

class FakeOutboundrouting {
    public function __call($name, $args) {
        StaticCalls::$log[] = ['Outboundrouting', $name, $args];
        return true;
    }
}
class_alias('FakeOutboundrouting', 'FreePBX\\modules\\Core\\Components\\Outboundrouting');

class FreePBX {
    public static RecordingDatabase $db;
    public static $instance;
    public $Core;
    public $astman;
    public $Soundlang;
    public $Userman;
    public static function Database() { return self::$db; }
    public static function create() { return self::$instance; }
    public static function __callStatic($name, $args) { return new StaticCalls($name); }
}

class FakeTancrediDefaults {
    public static $defaults = [];
    public static int $reads = 0;
    public function get($path) {
        self::$reads++;
        if ($path !== 'defaults' || !is_array(self::$defaults)) { throw new RuntimeException('Tancredi unavailable'); }
        return self::$defaults;
    }
}

function resetFakes() {
    global $astman;
    FreePBX::$db = new RecordingDatabase();
    FreePBX::$db->rows = fn($sql, $params) => [];
    $astman = new RecordingManager();
    FreePBX::$instance = new FreePBX();
    FreePBX::$instance->Core = new FakeCore();
    FreePBX::$instance->Core->config = new StaticCalls('Config');
    FreePBX::$instance->Soundlang = new StaticCalls('Soundlang');
    FreePBX::$instance->astman = $astman;
    StaticCalls::$log = [];
}

function lockFakes() {
    global $astman;
    FreePBX::$db->locked = true;
    $astman->locked = true;
}

$sandbox = sys_get_temp_dir() . '/rest_input_validation_test_' . getmypid();
$templates = "$sandbox/templates";
mkdir("$sandbox/rest/modules", 0700, true);
mkdir("$sandbox/admin/modules/core", 0700, true);
mkdir($templates, 0700, true);
file_put_contents("$sandbox/admin/modules/core/functions.inc.php", '<?php');
$copy = function ($from, $to) use (&$copy) {
    if (is_dir($from)) {
        mkdir($to, 0700, true);
        foreach (array_diff(scandir($from), ['.', '..']) as $entry) { $copy("$from/$entry", "$to/$entry"); }
    } else {
        copy($from, $to);
    }
};
$copy("$rest/lib", "$sandbox/rest/lib");
$patch = function ($file, $from, $to, $count) {
    $source = str_replace($from, $to, file_get_contents($file), $found);
    check($found === $count, basename($file) . ": expected $count occurrences of $from, found $found");
    file_put_contents($file, $source);
};
$patch("$sandbox/rest/lib/libExtensions.php", 'new TancrediKeyLabelsClient()', 'new FakeTancrediDefaults()', 1);
$patch("$sandbox/rest/lib/libBulk.php", "include_once '/var/www/html/freepbx/rest/lib/libCTI.php';", '', 1);
$patch("$sandbox/rest/lib/libCTI.php", "include_once '/etc/freepbx.conf';", '', 1);
$patch("$sandbox/rest/lib/libCTI.php", "include_once '/var/www/html/freepbx/admin/modules/customcontexts/functions.inc.php';", '', 1);
$patch("$sandbox/rest/lib/libCTI.php", "include_once '/var/www/html/freepbx/rest/config.inc.php';", '', 1);
$patch("$sandbox/rest/lib/libCTI.php", "include_once '/var/www/html/freepbx/rest/lib/context_default_permissions.php';", '', 1);
foreach (['webrtc.php' => 2, 'nethlink.php' => 2, 'physicalextensions.php' => 7, 'devices.php' => 1, 'routes.php' => 4, 'bulk.php' => 1, 'cti.php' => 23, 'trunks.php' => 3, 'settings.php' => 1, 'mainextensions.php' => 3] as $module => $helpers) {
    copy("$rest/modules/$module", "$sandbox/rest/modules/$module");
    $patch("$sandbox/rest/modules/$module", "system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');", 'null;', $helpers);
}
copy("$rest/modules/users.php", "$sandbox/rest/modules/users.php");
$patch("$sandbox/rest/modules/users.php", 'exec("/usr/bin/sudo', 'recordExec("/usr/bin/sudo', 3);
$patch("$sandbox/rest/modules/users.php", "system('fwconsole userman --syncall --force > /dev/null &');", 'null;', 1);
$patch("$sandbox/rest/modules/users.php", 'system("/usr/local/bin/php /var/www/html/freepbx/rest/lib/csvimport.php ', 'recordSystem("/usr/local/bin/php /var/www/html/freepbx/rest/lib/csvimport.php ', 1);
$routeImportStatus = "$sandbox/csvimport-route.code";
$patch("$sandbox/rest/modules/users.php", "'/var/run/nethvoice/csvimport.code'", var_export($routeImportStatus, true), 2);
$patch("$sandbox/rest/lib/libUsers.php", "require_once('/etc/freepbx.conf');", '', 1);
$patch("$sandbox/rest/modules/cti.php", "include_once('lib/libCTI.php');", '', 1);
$cardTemplatesPath = "'/var/lib/nethserver/nethcti/templates/customer_card'";
$patch("$sandbox/rest/modules/cti.php", $cardTemplatesPath, var_export($templates, true), max(1, substr_count(file_get_contents("$rest/modules/cti.php"), $cardTemplatesPath)));
register_shutdown_function(function () use ($sandbox) {
    $remove = function ($path) use (&$remove) {
        if (is_dir($path) && !is_link($path)) {
            foreach (array_diff(scandir($path), ['.', '..']) as $entry) { $remove("$path/$entry"); }
            rmdir($path);
        } else {
            unlink($path);
        }
    };
    $remove($sandbox);
});

set_include_path("$sandbox/rest");
chdir("$sandbox/rest");
require "$sandbox/rest/lib/JsonResponse.php";
require_once "$sandbox/rest/lib/Permissions.php";
resetFakes();

$app = AppFactory::create();
$app->add(function (Request $request, RequestHandlerInterface $handler): Response {
    $route = $request->getAttribute(RouteContext::ROUTE);
    if ($route !== null && $request->getAttribute('route') === null) {
        $request = $request->withAttribute('route', $route);
    }
    return $handler->handle($request);
});
$app->addRoutingMiddleware();
foreach (['webrtc.php', 'nethlink.php', 'physicalextensions.php', 'devices.php', 'routes.php', 'bulk.php', 'cti.php', 'trunks.php', 'settings.php', 'mainextensions.php', 'users.php'] as $module) {
    require "$sandbox/rest/modules/$module";
}
require_once "$sandbox/rest/lib/libCTI.php";

$caller = ['users', 'trunks', 'routes', 'phones', 'integrations', 'settings'];
function call($app, $method, $path, $body = null) {
    $request = (new ServerRequestFactory())->createServerRequest($method, $path)->withAttribute(NETHVOICE_PERMISSIONS_ATTRIBUTE, $GLOBALS['caller']);
    if ($body !== null) { $request = $request->withParsedBody($body); }
    $response = $app->handle($request);
    return [$response->getStatusCode(), (string) $response->getBody()];
}

$invalidExtensions = ['', ' 201', '201 ', "201\n", '2O1', '201.0', '-201', '+201', '1e3', '0x1A', '";TRUNCATE ampusers#', '"OR SLEEP(2)#', ['201'], null, true, 201.5, -201];
$validExtensions = ['201', 201, '0201', '91201'];
$extensionRoutes = [
    ['/webrtc', 'extension', []],
    ['/nethlink', 'extension', []],
    ['/mobileapp', 'mainextension', []],
    ['/physicalextensions', 'mainextension', ['mac' => '', 'model' => '', 'web_user' => 'admin', 'web_password' => 'invented', 'line' => null]],
];
error_reporting(E_ALL & ~E_WARNING & ~E_DEPRECATED);
foreach ($extensionRoutes as [$path, $field, $extra]) {
    foreach ($invalidExtensions as $value) {
        resetFakes();
        lockFakes();
        $expected = $path === '/physicalextensions' && empty($value) ? [500, '{"status":"Error adding phone"}'] : [400, '{"status":"Invalid extension"}'];
        check(call($app, 'POST', $path, [$field => $value] + $extra) === $expected, "$path accepted the extension " . json_encode($value));
        check(FreePBX::$db->log === [] && $astman->log === [], "$path reached the database or the manager with the extension " . json_encode($value));
    }
    foreach ($validExtensions as $value) {
        resetFakes();
        lockFakes();
        check(call($app, 'POST', $path, [$field => $value] + $extra) === [500, '{"status":"Error creating extension"}'], "$path refused the extension " . json_encode($value));
        check(FreePBX::$db->log[0] === ['prepare', 'SELECT * FROM `rest_devices_phones` WHERE `extension` = ?', [$value]], "$path did not pass the extension " . json_encode($value) . ' unchanged');
    }
}
error_reporting(E_ALL);

$assignment = ['mainextension' => '201', 'mac' => 'AC:CD:EF:01:02:03', 'model' => 'yealink-T46', 'web_user' => 'admin', 'line' => null, 'clear_temporary' => true];
$storedWebPassword = function () {
    foreach (FreePBX::$db->log as [, $sql, $params]) {
        if (str_starts_with($sql, 'UPDATE `rest_devices_phones` SET user_id')) { return $params[4]; }
    }
    return 'not stored';
};
error_reporting(E_ALL & ~E_WARNING & ~E_DEPRECATED);
foreach ([
    [['users'], ['web_password' => 'Chosen-Web-1!'], 'Stored-Default-1!', 1],
    [['users'], [], 'Stored-Default-1!', 1],
    [['users', 'trunks'], ['web_password' => ''], 'Stored-Default-1!', 1],
    [['phones'], ['web_password' => 'Chosen-Web-1!'], 'Chosen-Web-1!', 0],
    [['users', 'phones'], ['web_password' => 'Chosen-Web-1!'], 'Chosen-Web-1!', 0],
    [['superadmin'], ['web_password' => 'Chosen-Web-1!'], 'Chosen-Web-1!', 0],
    [['superadmin'], [], null, 0],
] as [$permissions, $extra, $expected, $reads]) {
    resetFakes();
    FreePBX::$db->rows = fn($sql, $params) => str_contains($sql, 'FROM `sip` WHERE id = ? AND keyword = "secret"') ? [['data' => 'invented-secret']] : [];
    FakeTancrediDefaults::$defaults = ['adminpw' => 'Stored-Default-1!', 'language' => 'it'];
    FakeTancrediDefaults::$reads = 0;
    $caller = $permissions;
    $answer = call($app, 'POST', '/physicalextensions', $assignment + $extra);
    check($answer === [200, '{"extension":"201"}'], json_encode([$permissions, $extra]) . ' could not assign the phone: ' . json_encode($answer));
    check($storedWebPassword() === $expected, json_encode([$permissions, $extra]) . ' stored the web password ' . json_encode($storedWebPassword()) . ' instead of ' . json_encode($expected));
    check(FakeTancrediDefaults::$reads === $reads, json_encode($permissions) . ' read the Tancredi defaults ' . FakeTancrediDefaults::$reads . ' times');
}
foreach ([null, [], ['adminpw' => ''], ['adminpw' => ['x']], ['language' => 'it']] as $defaults) {
    resetFakes();
    FakeTancrediDefaults::$defaults = $defaults;
    $caller = ['users'];
    $answer = call($app, 'POST', '/physicalextensions', $assignment + ['web_password' => 'Chosen-Web-1!']);
    check($answer === [500, '{"status":"Default phone web password not available"}'], 'a phone was assigned without the default web password ' . json_encode($defaults) . ': ' . json_encode($answer));
    check(FreePBX::$db->log === [] && $astman->log === [], 'an assignment without the default web password reached the database or the manager');
}
$caller = ['users'];
resetFakes();
FakeTancrediDefaults::$defaults = null;
FakeTancrediDefaults::$reads = 0;
check(call($app, 'POST', '/physicalextensions', ['mac' => 'AC:CD:EF:01:02:03', 'model' => 'yealink-T46'])[0] === 200 && FakeTancrediDefaults::$reads === 0, 'adding a phone without a user must not read the Tancredi defaults');
$caller = ['users', 'trunks', 'routes', 'phones', 'integrations', 'settings'];
error_reporting(E_ALL);

$source = file_get_contents("$rest/lib/libExtensions.php");
check(!str_contains($source, "WHERE id = \"' . \$extension"), 'an extension is still concatenated into a sip query');
check(substr_count($source, '= getExtensionSecret($extension);') === 5, 'the extension secret is not read through the bound helper');
resetFakes();
FreePBX::$db->rows = fn($sql, $params) => $params === ['201'] ? [['data' => 'invented-secret']] : ($params === ['202'] ? [['data' => '']] : []);
check(getExtensionSecret('201') === 'invented-secret', 'the secret of an existing extension changed');
check(getExtensionSecret('202') === false && getExtensionSecret('";TRUNCATE ampusers#') === false, 'an empty or missing secret is not false');
check(array_column(FreePBX::$db->log, 2) === [['201'], ['202'], ['";TRUNCATE ampusers#']] && array_unique(array_column(FreePBX::$db->log, 1)) === ['SELECT data FROM `sip` WHERE id = ? AND keyword="secret"'], 'the extension secret query is not bound: ' . json_encode(FreePBX::$db->log));

$gateway = ['name' => 'Grandstream-HT802', 'model' => 126, 'ipv4' => '', 'ipv4_new' => '192.0.2.50', 'gateway' => '192.0.2.1', 'ipv4_green' => '192.0.2.5', 'netmask_green' => '255.255.255.0', 'proxy' => ''];
foreach (['AA:BB:CC:00:10:01', 'aa:bb:cc:00:10:02', 'AA-BB-CC-00-10-03', 'AABBCC001004', 'aabb.cc00.1005'] as $mac) {
    foreach ([[], [['name' => 1, 'linked_extension' => '203']], [['name' => 1, 'linked_extension' => 203], ['name' => 2, 'linked_extension' => '201']]] as $fxs) {
        resetFakes();
        lockFakes();
        $result = addEditGateway($gateway + ['mac' => $mac, 'trunks_fxs' => $fxs]);
        check($result['status'] === false && $result['errors'] === ['database locked'] && !isset($result['http_status']), "the gateway MAC $mac or its ports were refused: " . json_encode($result));
        check(FreePBX::$db->log[0] === ['prepare', 'SELECT `manufacturer` FROM `gateway_models` WHERE `id` = ?', [126]], "the gateway MAC $mac did not reach the model lookup");
    }
}
foreach (['"OR""="', '"OR SLEEP(1)OR"', 'AA:BB:CC:00:10', 'AA:BB:CC:00:10:01:02', 'AA:BB:CC:00:10:0G', ' AA:BB:CC:00:10:01', ['AA:BB:CC:00:10:01'], 1234] as $mac) {
    resetFakes();
    lockFakes();
    $result = addEditGateway($gateway + ['mac' => $mac, 'trunks_fxs' => []], true);
    check($result === ['status' => false, 'errors' => ['Invalid gateway MAC address'], 'warnings' => [], 'infos' => [], 'http_status' => 400], 'the gateway MAC ' . json_encode($mac) . ' was not refused: ' . json_encode($result));
    check(FreePBX::$db->log === [], 'the gateway MAC ' . json_encode($mac) . ' reached the database');
}
foreach (['', null, ' 203', '";TRUNCATE ampusers#', ['203']] as $linked) {
    resetFakes();
    lockFakes();
    $result = addEditGateway($gateway + ['mac' => 'AA:BB:CC:00:10:01', 'trunks_fxs' => [['name' => 1, 'linked_extension' => '203'], ['name' => 2, 'linked_extension' => $linked]]], true);
    check($result === ['status' => false, 'errors' => ['Invalid linked extension'], 'warnings' => [], 'infos' => [], 'http_status' => 400], 'the linked extension ' . json_encode($linked) . ' was not refused: ' . json_encode($result));
    check(FreePBX::$db->log === [], 'the linked extension ' . json_encode($linked) . ' reached the database');
}
foreach ([['"OR""="', []], ['AA:BB:CC:00:10:01', [['name' => 1, 'linked_extension' => '']]]] as [$mac, $fxs]) {
    resetFakes();
    lockFakes();
    $result = addEditGateway($gateway + ['mac' => $mac, 'trunks_fxs' => $fxs]);
    check($result['errors'] === ['database locked'] && FreePBX::$db->log[0] === ['prepare', 'SELECT `manufacturer` FROM `gateway_models` WHERE `id` = ?', [126]], 'the superadmin gateway ' . json_encode([$mac, $fxs]) . ' was refused: ' . json_encode($result));
}
resetFakes();
$result = addEditGateway(['name' => 'Grandstream-HT802', 'model' => 126]);
check($result['http_status'] === 400 && $result['errors'] === ['Missing gateway field ipv4_new', 'Missing gateway field gateway', 'Missing gateway field ipv4_green', 'Missing gateway field netmask_green', 'Missing gateway field mac'], 'missing gateway fields changed answer: ' . json_encode($result));

function sql($query, $type, $mode) {
    FreePBX::$db->log[] = ['sql', $query, null];
    return [
        ['id' => 1, 'mac' => 'AA:BB:CC:00:10:01', 'model' => 126, 'manufacturer' => 'Grandstream'],
        ['id' => 3, 'mac' => '"OR""="', 'model' => 126, 'manufacturer' => 'Grandstream'],
    ];
}
resetFakes();
FreePBX::$db->rows = fn($sql, $params) => str_contains($sql, '`gateway_config_fxs`') && $params === ['AA:BB:CC:00:10:01'] ? [['linked_extension' => '201']] : [];
[$status, $body] = call($app, 'GET', '/devices/gateways/list/1');
check($status === 200, 'the gateway list failed');
$list = json_decode($body, true);
check($list[0]['trunks_fxs'] === [['linked_extension' => '201']] && !isset($list[1]['trunks_fxs']), 'a stored MAC changed the ports of another gateway: ' . $body);
$prepared = array_values(array_filter(FreePBX::$db->log, fn($entry) => $entry[0] === 'prepare'));
check(count($prepared) === 8 && array_column($prepared, 2) === array_merge(array_fill(0, 4, ['AA:BB:CC:00:10:01']), array_fill(0, 4, ['"OR""="'])), 'the stored gateway MAC did not travel as a bound parameter: ' . json_encode($prepared));
check(str_ends_with($prepared[0][1], ' WHERE `gateway_config`.mac = ?'), 'the gateway ports query changed: ' . $prepared[0][1]);

foreach ([['7', '2'], ['7', '2"OR"1'], ['7', "2\";DELETE FROM ampusers;#"], ['x', '2abc']] as [$route, $trunk]) {
    resetFakes();
    check(call($app, 'DELETE', '/outboundroutes/' . rawurlencode($route) . '/trunks/' . rawurlencode($trunk)) === [200, ''], "removing trunk $trunk from route $route changed answer");
    check(FreePBX::$db->log === [['prepare', 'DELETE FROM `outbound_route_trunks` WHERE `route_id`=? AND `trunk_id`=?', [$route, $trunk]]], 'the route trunk did not travel as a bound parameter: ' . json_encode(FreePBX::$db->log));
}

$cards = new PDO('sqlite::memory:');
$cards->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$cards->exec("CREATE TABLE customer_card (id INTEGER PRIMARY KEY, name TEXT, template TEXT)");
$cards->exec("INSERT INTO customer_card VALUES (1, 'Orders', 'orders_custom')");
(new ReflectionProperty('NethCTI', 'db'))->setValue(null, $cards);
$deleteTemplate = function ($name, $files) use ($app, $templates) {
    foreach (array_diff(scandir($templates), ['.', '..']) as $file) { unlink("$templates/$file"); }
    foreach ($files as $file) { file_put_contents("$templates/$file", 'x'); }
    $result = call($app, 'DELETE', '/cti/customer_card/template/' . $name);
    return [$result[0], array_values(array_diff(scandir($templates), ['.', '..']))];
};
check($deleteTemplate('mycard', ['mycard_custom.ejs', 'table.ejs']) === [200, ['table.ejs']], 'a template was not deleted');
check($deleteTemplate('mycard', ['mycard.ejs', 'mycard_custom.ejs']) === [200, ['mycard.ejs']], 'a customized template was not deleted first');
check($deleteTemplate('table2', ['table2_custom.ejs']) === [200, []], 'a template with digits was not deleted');
check($deleteTemplate('mycard', ['mycard.ejs', 'table.ejs']) === [403, ['mycard.ejs', 'table.ejs']], 'a built-in template was deleted');
check($deleteTemplate('orders', ['orders_custom.ejs']) === [409, ['orders_custom.ejs']], 'a template used by a card was deleted');
check($deleteTemplate('nocard', ['table.ejs']) === [500, ['table.ejs']], 'a missing template changed answer');
foreach (['My_Card' => ['My_Card.ejs'], 'MyCard' => ['MyCard.ejs'], '..' => ['...ejs'], 'my%20card' => ['my card.ejs'], 'card%0A' => ["card\n.ejs"]] as $name => $files) {
    check($deleteTemplate($name, $files) === [500, $files], "the template name $name was not refused");
}

foreach (['20', 20, '0', 0, '120', 120, '020'] as $ringtime) {
    resetFakes();
    check(call($app, 'POST', '/bulk/201,202', ['ringtime' => $ringtime]) === [200, '{"status":true}'], 'the ring time ' . json_encode($ringtime) . ' was refused');
    check($astman->log === [['connected', []], ['database_put', ['AMPUSER', '201/ringtimer', $ringtime]], ['database_put', ['AMPUSER', '202/ringtimer', $ringtime]], ['database_put', ['AMPUSER', '91202/ringtimer', $ringtime]]], 'the ring time ' . json_encode($ringtime) . ' was not written unchanged: ' . json_encode($astman->log));
}
foreach ([['ringtime' => null], ['displayname' => null]] as $body) {
    resetFakes();
    check(call($app, 'POST', '/bulk/201,202', $body) === [200, '{"status":true}'] && $astman->log === [], 'a bulk request without ring time changed: ' . json_encode($body));
}
foreach (['121', '-1', -1, 121, 20.5, '20.5', 'abc', '', ' 20', "20\n", "20\r\nAction: Originate\r\nApplication: System\r\nData: touch /tmp/x\r\n", '0" | SHELL("touch /tmp/x") | "1', true, false, ['20']] as $ringtime) {
    resetFakes();
    lockFakes();
    check(call($app, 'POST', '/bulk/201,202', ['ringtime' => $ringtime, 'callwaiting' => true]) === [400, '{"status":false,"error":"Invalid ring time"}'], 'the ring time ' . json_encode($ringtime) . ' was not refused');
    check($astman->log === [] && FreePBX::$db->log === [], 'the ring time ' . json_encode($ringtime) . ' reached the manager or the database');
}

$customContexts = [];
$added = [];
$edited = [];
function customcontexts_getcontexts() { global $customContexts; return array_map(fn($c, $d) => [$c, $d], array_keys($customContexts), $customContexts); }
function customcontexts_customcontexts_add($context, $description, ...$rest) { global $customContexts, $added; $added[] = $description; $customContexts[$context] = stripslashes($description); }
function customcontexts_getincludes($context) { return [[$context, '', 'from-internal-custom', '', 'yes', 1, 0]]; }
function customcontexts_customcontexts_get($context) { global $customContexts; return [$context, $customContexts[$context], '', '', '', '', '']; }
function customcontexts_customcontexts_edit($context, $newcontext, $description, ...$rest) { global $edited; $edited[] = $description; }
function customcontexts_customcontexts_editincludes(...$args) {}
$context_default_permissions = [];
$context_permission_map = [];

foreach (['Sales', 'Ufficio Vendite è più', 'Team "A"', 'R&D (lab) #2 / 50%', "O'Brien", 'Lab\\Ops', "'WHERE 0;UPDATE ampusers SET password_sha1=SHA1('p')WHERE username='admin';#", "a\nb\0c"] as $name) {
    resetFakes();
    $customContexts = [];
    $added = [];
    $edited = [];
    setCustomContextPermissions(['id' => 7, 'name' => $name, 'macro_permissions' => []]);
    check($added === ['CTI Profile ' . addslashes($name)] && $edited === [addslashes("CTI Profile $name")], "the context description of the profile $name is not escaped as a SQL string: " . json_encode([$added, $edited]));
}
foreach (['CTI Profile Advanced', "CTI Profile Adv'anced", "CTI Profile x'WHERE 0;UPDATE ampusers SET password_sha1=SHA1('p')#", 'CTI Profile a\\'] as $stored) {
    resetFakes();
    $customContexts = ['cti-profile-3' => $stored];
    $added = [];
    $edited = [];
    setCustomContextPermissions(['id' => 3, 'name' => 'Renamed', 'macro_permissions' => []]);
    check($added === [] && $edited === [addslashes($stored)], 'a stored custom context description reached the update unescaped: ' . json_encode($edited));
}

$controlCharacters = ["\r", "\n", "\t", "\0", "\x7f", "\x1b"];
$controlRefused = [400, '{"status":false,"error":"Invalid control character"}'];
$bulkFields = ['displayname' => 'Alice', 'callgroup' => '1', 'pickupgroup' => '1', 'noanswerdest' => 'app-blackhole,hangup,1', 'busydest' => 'app-blackhole,busy,1', 'notreachabledest' => 'ext-local,vmu201,1', 'outboundcid_fixed' => '0721000000'];
foreach ($bulkFields as $field => $base) {
    foreach ($controlCharacters as $character) {
        foreach (["$base{$character}#exec /bin/id", $character . $base, $base . $character] as $value) {
            resetFakes();
            lockFakes();
            check(call($app, 'POST', '/bulk/201,202', [$field => $value, 'callwaiting' => true]) === $controlRefused, "the bulk field $field accepted " . json_encode($value));
            check(FreePBX::$db->log === [] && $astman->log === [], "the bulk field $field reached the database or the manager with " . json_encode($value));
        }
    }
}
foreach ([['callgroup' => ['1', "2\n#exec /bin/id"]], ['context' => "from-internal\n#exec /bin/id"], ['outboundcid_fixed' => '0721', 'outboundcid_variable' => "2\n"]] as $body) {
    resetFakes();
    lockFakes();
    check(call($app, 'POST', '/bulk/201,202', $body) === $controlRefused && FreePBX::$db->log === [] && $astman->log === [], 'a bulk body with a control character was not refused: ' . json_encode($body));
}
$sipUpdate = 'UPDATE `sip` SET `data`=? WHERE (`id`=? OR `id` LIKE ?) AND `keyword`=?';
foreach (['callgroup' => 'namedcallgroup', 'pickupgroup' => 'namedpickupgroup'] as $field => $keyword) {
    foreach (['1', '1,2', 'sales,support', '#3 & 4', 'Zoë "A"', ''] as $value) {
        resetFakes();
        check(call($app, 'POST', '/bulk/201,202', [$field => $value]) === [200, '{"status":true}'], "the bulk field $field refused " . json_encode($value));
        check(FreePBX::$db->log === [['prepare', $sipUpdate, [$value, '201', '9%201', $keyword]], ['prepare', $sipUpdate, [$value, '202', '9%202', $keyword]], ['prepare', $sipUpdate, [$value, '91202', '9%91202', $keyword]]], "the bulk field $field did not store " . json_encode($value) . ' unchanged: ' . json_encode(FreePBX::$db->log));
    }
}
foreach (['noanswerdest' => 'noanswer_dest', 'busydest' => 'busy_dest', 'notreachabledest' => 'chanunavail_dest'] as $field => $column) {
    foreach (['', 'app-blackhole,hangup,1', 'ext-local,vmu201,1', 'from-did-direct,202,1'] as $value) {
        resetFakes();
        check(call($app, 'POST', '/bulk/201,202', [$field => $value]) === [200, '{"status":true}'], "the bulk field $field refused " . json_encode($value));
        $update = "UPDATE `users` SET `$column` = ? WHERE `extension` = ?";
        check(FreePBX::$db->log === [['prepare', $update, [$value, '201']], ['prepare', $update, [$value, '202']]], "the bulk field $field did not store " . json_encode($value) . ' unchanged');
    }
}
foreach (['Alice Example', 'Zoë Müller-Ça', 'Team "A"', 'R&D #2 / 50%', "O'Brien", '  spaced  ', ''] as $value) {
    resetFakes();
    check(call($app, 'POST', '/bulk/201,202', ['displayname' => $value]) === [200, '{"status":true}'], 'the bulk display name ' . json_encode($value) . ' was refused');
    check(FreePBX::$db->log === [
        ['prepare', $sipUpdate, ["$value <201>", '201', '9%201', 'callerid']],
        ['prepare', 'UPDATE `users` SET `name`=? WHERE `extension`=?', [$value, '201']],
        ['prepare', $sipUpdate, ["$value <202>", '202', '9%202', 'callerid']],
        ['prepare', 'UPDATE `users` SET `name`=? WHERE `extension`=?', [$value, '202']],
        ['prepare', 'UPDATE `users` SET `name`=? WHERE `extension`=?', [$value, '91202']],
    ], 'the bulk display name ' . json_encode($value) . ' was not stored unchanged: ' . json_encode(FreePBX::$db->log));
}
foreach (['"Sales è" <0721000000>', '<0721000000>'] as $value) {
    resetFakes();
    check(call($app, 'POST', '/bulk/201', ['outboundcid_fixed' => $value]) === [200, '{"status":true}'], 'the bulk outbound caller ID ' . json_encode($value) . ' was refused');
    check(FreePBX::$db->log === [['prepare', 'UPDATE `users` SET `outboundcid` = ? WHERE `extension` = ?', [$value, '201']]] && $astman->log === [['database_put', ['AMPUSER', '201/outboundcid', $value]]], 'the bulk outbound caller ID ' . json_encode($value) . ' was not stored unchanged');
}
resetFakes();
check(call($app, 'POST', '/bulk/201,202', ['displayname' => 'Example ???', 'profile' => null, 'callwaiting' => true, 'ringtime' => 20, 'callgroup' => '1', 'pickupgroup' => '1', 'noanswerdest' => '', 'busydest' => '', 'notreachabledest' => '', 'outboundcid' => 'fixed', 'outboundcid_fixed' => null]) === [200, '{"status":true}'], 'the body of the previous wizard was refused');

$_ENV['PROXY_IP'] = '192.0.2.10';
$_ENV['PROXY_PORT'] = '5060';
$trunk = ['provider' => 'clouditalia', 'name' => 'Main line', 'username' => 'user01', 'password' => 'Inv3nted!pass', 'phone' => '0721000000', 'codecs' => ['alaw', 'g729'], 'forceCodec' => false];
foreach (['name', 'username', 'password', 'phone', 'provider'] as $field) {
    foreach ($controlCharacters as $character) {
        resetFakes();
        lockFakes();
        check(call($app, 'POST', '/trunks', [$field => $trunk[$field] . $character . '#exec /bin/id'] + $trunk) === [400, '{"error":"Invalid control character"}'], "the trunk field $field accepted a control character");
        check(FreePBX::$db->log === [] && StaticCalls::$log === [], "the trunk field $field reached the database with a control character");
    }
}
resetFakes();
lockFakes();
check(call($app, 'POST', '/trunks', ['codecs' => ['alaw', "g729\n#exec /bin/id"]] + $trunk) === [400, '{"error":"Invalid control character"}'] && FreePBX::$db->log === [], 'a trunk codec with a control character was not refused');
foreach ([$trunk, ['name' => 'Linea è #2 & co', 'username' => "o'brien@example.test", 'password' => 'p"a s#s&ö'] + $trunk] as $body) {
    resetFakes();
    check(call($app, 'POST', '/trunks', $body) === [200, ''], 'a valid trunk was refused: ' . json_encode($body));
    $insert = array_values(array_filter(FreePBX::$db->log, fn($entry) => str_starts_with($entry[1], 'INSERT INTO `trunks`')));
    check($insert[0][2] === [1, 'pjsip', $body['name'], $body['name'], $body['phone'], 'off', '', '', '', '', $body['provider'], 'off', 'off'], 'a valid trunk was not stored unchanged: ' . json_encode($insert));
    $pjsip = array_values(array_filter(FreePBX::$db->log, fn($entry) => str_starts_with($entry[1], 'INSERT INTO `pjsip`')))[0][2];
    foreach (['username' => $body['username'], 'secret' => $body['password'], 'trunk_name' => $body['name'], 'codecs' => 'alaw,g729'] as $keyword => $value) {
        check($pjsip[array_search($keyword, $pjsip, true) + 1] === $value, "the trunk $keyword was not stored unchanged");
    }
}
$countTrunk = fn($sql, $params) => str_starts_with($sql, 'SELECT COUNT(*)') ? [['n' => 1]] : [];
foreach (['username' => 'user01', 'password' => 'Inv3nted!pass', 'phone' => '0721000000'] as $field => $base) {
    foreach ($controlCharacters as $character) {
        resetFakes();
        FreePBX::$db->rows = $countTrunk;
        check(call($app, 'PATCH', '/trunks/3', [$field => $base . $character . '#exec /bin/id']) === [400, '{"error":"Invalid control character"}'], "the trunk change of $field accepted a control character");
        check(count(FreePBX::$db->log) === 1 && str_starts_with(FreePBX::$db->log[0][1], 'SELECT COUNT(*)'), "the trunk change of $field wrote with a control character");
    }
}
resetFakes();
FreePBX::$db->rows = $countTrunk;
check(call($app, 'PATCH', '/trunks/3', ['username' => "o'brien", 'password' => 'p"a s#s&ö', 'phone' => '0721000000']) === [204, ''], 'a valid trunk change was refused');
check(array_column(array_slice(FreePBX::$db->log, 1), 2) === [["o'brien", '3', 'username', 'contact_user', 'from_user'], ['p"a s#s&ö', '3', 'secret'], ['0721000000', '3']], 'a valid trunk change was not stored unchanged: ' . json_encode(FreePBX::$db->log));
resetFakes();
FreePBX::$db->rows = $countTrunk;
check(call($app, 'PATCH', '/trunks/3', null) === [204, ''], 'a trunk change without body changed answer');

$inbound = ['extension' => '0721000000', 'cidnum' => '', 'description' => 'Main "DID" è & #1', 'destination' => 'from-did-direct,201,1'];
resetFakes();
check(call($app, 'POST', '/inboundroutes', $inbound) === [200, ''] && StaticCalls::$log === [['Core', 'addDID', [$inbound]]], 'a valid inbound route did not reach FreePBX unchanged');
foreach (['extension', 'cidnum', 'description', 'destination'] as $field) {
    foreach ($controlCharacters as $character) {
        resetFakes();
        lockFakes();
        check(call($app, 'POST', '/inboundroutes', [$field => $inbound[$field] . $character . 'x'] + $inbound) === [400, '{"message":"Invalid control character"}'] && StaticCalls::$log === [], "the inbound route field $field accepted a control character");
    }
}

$outbound = ['it' => [['name' => 'national_it', 'trunks' => [['trunkid' => 1]]]]];
resetFakes();
check(call($app, 'POST', '/outboundroutes', $outbound) === [200, ''] && StaticCalls::$log[0][1] === 'add' && StaticCalls::$log[0][2][0] === 'national_it', 'a valid outbound route did not reach FreePBX unchanged: ' . json_encode(StaticCalls::$log));
foreach ($controlCharacters as $character) {
    resetFakes();
    lockFakes();
    check(call($app, 'POST', '/outboundroutes', ['it' => [['name' => "national_it{$character}#exec /bin/id", 'trunks' => [['trunkid' => 1]]]]]) === [400, '{"message":"Invalid control character"}'] && StaticCalls::$log === [] && FreePBX::$db->log === [], 'an outbound route name with a control character was not refused');
}

$amp_conf = ['AS_OVERRIDE_READONLY' => false];
foreach (['it' => 'it', 'en' => 'us'] as $language => $tonezone) {
    resetFakes();
    check(call($app, 'POST', '/settings/defaultlanguage', ['lang' => $language]) === [200, ''], "the language $language was refused");
    check(StaticCalls::$log === [['Soundlang', 'setLanguage', [$language]], ['Config', 'set_conf_values', [['TONEZONE' => $tonezone], true, false]]], "the language $language was not stored unchanged");
}
foreach ($controlCharacters as $character) {
    resetFakes();
    check(call($app, 'POST', '/settings/defaultlanguage', ['lang' => "it{$character}#exec /bin/id"]) === [400, ''] && StaticCalls::$log === [], 'a language with a control character was not refused');
}

foreach (['Alice Example', 'Zoë "A" & #1', "O'Brien"] as $value) {
    resetFakes();
    check(call($app, 'POST', '/extension/201', ['displayname' => $value]) === [204, ''] && StaticCalls::$log === [['Nethcti3', 'setExtensionsDisplayName', [['201', '201'], $value, '201']]], 'the display name ' . json_encode($value) . ' did not reach the extensions unchanged');
}
foreach ($controlCharacters as $character) {
    resetFakes();
    lockFakes();
    check(call($app, 'POST', '/extension/201', ['displayname' => "Alice{$character}#exec /bin/id"]) === [400, ''] && StaticCalls::$log === [] && FreePBX::$db->log === [], 'a display name with a control character was not refused');
}

$gatewayRequest = $gateway + ['mac' => 'AA:BB:CC:00:10:01', 'trunks_fxs' => [['name' => 1, 'linked_extension' => '203']]];
foreach (['name', 'ipv4_new', 'gateway', 'ipv4_green', 'netmask_green', 'proxy'] as $field) {
    foreach ($controlCharacters as $character) {
        resetFakes();
        lockFakes();
        check(call($app, 'POST', '/devices/gateways', [$field => $gatewayRequest[$field] . $character . '#exec /bin/id'] + $gatewayRequest) === [400, '{"status":false,"errors":["Invalid control character"],"warnings":[],"infos":[]}'] && FreePBX::$db->log === [], "the gateway field $field accepted a control character");
    }
}
resetFakes();
lockFakes();
[$status] = call($app, 'POST', '/devices/gateways', $gatewayRequest);
check($status === 500 && FreePBX::$db->log[0] === ['prepare', 'SELECT `manufacturer` FROM `gateway_models` WHERE `id` = ?', [126]], 'a valid gateway did not reach the model lookup');
foreach ($controlCharacters as $character) {
    resetFakes();
    lockFakes();
    check(call($app, 'PUT', '/devices/gateways/4', ['ipv4_green' => '192.0.2.5' . $character . '#exec /bin/id'] + $gatewayRequest) === [400, '{"status":false,"errors":["Invalid control character"],"warnings":[],"infos":[]}'] && FreePBX::$db->log === [], 'the gateway update accepted a control character');
}
foreach (['4a', '0x4', '-4'] as $id) {
    resetFakes();
    lockFakes();
    check(call($app, 'PUT', "/devices/gateways/$id", $gatewayRequest) === [404, '{"status":false,"errors":["Gateway configuration not found"],"warnings":[],"infos":[]}'] && FreePBX::$db->log === [], "the gateway update accepted the id $id");
}
resetFakes();
lockFakes();
[$status] = call($app, 'PUT', '/devices/gateways/4', $gatewayRequest);
check($status === 500 && FreePBX::$db->log[0] === ['prepare', 'SELECT * FROM `gateway_config` WHERE `id` = ?', ['4']], 'a valid gateway update did not reach the configuration lookup');

class FakeUserman {
    public array $log = [];
    public function getAllUsers() { $this->log[] = ['getAllUsers']; return []; }
    public function getUserByUsername($username) {
        $this->log[] = ['getUserByUsername', $username];
        return ['id' => 7, 'username' => $username, 'displayname' => 'Alice Example'];
    }
}
$mainextensionRows = fn($sql, $params) => $sql === 'SELECT * FROM `sip` WHERE `id`= ?' ? [['id' => $params[0]]] : [];
$postMainextension = function ($body) use ($app, $mainextensionRows) {
    resetFakes();
    FreePBX::$db->rows = $mainextensionRows;
    FreePBX::$instance->Userman = new FakeUserman();
    return call($app, 'POST', '/mainextensions', $body);
};
error_reporting(E_ALL & ~E_WARNING & ~E_DEPRECATED);
foreach (['201', 201, '0201', '91201'] as $value) {
    check($postMainextension(['username' => 'alice', 'extension' => $value]) === [422, json_encode(['message' => "Extension $value already in use"])], 'the main extension ' . json_encode($value) . ' did not reach the free extension check');
    check(FreePBX::$db->log[1] === ['prepare', 'SELECT * FROM `sip` WHERE `id`= ?', [$value]], 'the main extension ' . json_encode($value) . ' was not checked unchanged: ' . json_encode(FreePBX::$db->log));
}
foreach ([['extension' => ''], ['extension' => null], ['extension' => '0'], ['extension' => 0], ['extension' => 'none'], ['extension' => false], ['extension' => true], []] as $body) {
    check($postMainextension(['username' => 'alice'] + $body) === [200, '{"message":"No extension specified"}'], 'removing the main extension with ' . json_encode($body) . ' changed answer');
    check(FreePBX::$instance->Userman->log === [['getAllUsers'], ['getUserByUsername', 'alice']] && FreePBX::$db->log === [['prepare', 'SELECT `default_extension` FROM `userman_users` WHERE `username` = ?', ['alice']]], 'removing the main extension with ' . json_encode($body) . ' changed path: ' . json_encode(FreePBX::$db->log));
}
foreach ([' 201', '201 ', "201\n", "201\r\n", "\t201", "201\0", '2O1', '201.0', '-201', '+201', '1e3', '0x1A', 'NONE', ' ', '";TRUNCATE ampusers#', ['201'], 201.5, -201] as $value) {
    check($postMainextension(['username' => 'alice', 'extension' => $value]) === [400, '{"message":"Invalid extension"}'], 'the main extension ' . json_encode($value) . ' was not refused');
    check(FreePBX::$db->log === [] && $astman->log === [] && FreePBX::$instance->Userman->log === [], 'the main extension ' . json_encode($value) . ' reached the database, the manager or userman');
}
foreach ([['201'], ['201', '0202']] as $extensions) {
    resetFakes();
    FreePBX::$db->rows = fn($sql, $params) => $sql === 'SHOW TABLES LIKE ?' ? [['rest_orphan_extensions']] : [];
    check(call($app, 'POST', '/mainextensions/orphans/release', ['extensions' => $extensions]) === [404, '{"message":"Extension 201 does not belong to a removed user"}'], 'the orphan extensions ' . json_encode($extensions) . ' changed answer');
    check(FreePBX::$db->log[1] === ['prepare', 'SELECT user_id, extension FROM rest_orphan_extensions WHERE extension = ?', ['201']], 'the orphan extension was not looked up unchanged');
}
foreach ([["201\n"], ['201', ' 202'], ["201\0"], ['2e3'], [201], [['201']], []] as $extensions) {
    resetFakes();
    lockFakes();
    check(call($app, 'POST', '/mainextensions/orphans/release', ['extensions' => $extensions]) === [400, $extensions === [] ? '{"message":"Missing extensions"}' : '{"message":"Invalid extension"}'], 'the orphan extensions ' . json_encode($extensions) . ' were not refused');
    check(FreePBX::$db->log === [], 'the orphan extensions ' . json_encode($extensions) . ' reached the database');
}
foreach (['201%0A', '201%00', '%20201', '2e3'] as $extension) {
    resetFakes();
    lockFakes();
    try {
        call($app, 'POST', "/mainextensions/$extension/reassign", ['username' => 'bob']);
        check(false, "the reassign route matched the extension $extension");
    } catch (Slim\Exception\HttpNotFoundException $e) {
        check(FreePBX::$db->log === [], "the reassign route reached the database with $extension");
    }
}
error_reporting(E_ALL);

$execs = [];
function recordExec($command, &$output = null, &$status = null) {
    global $execs;
    $execs[] = $command;
    $status = 1;
}
$legacyRefused = [422, '{"result":"User name or full name invalid"}'];
foreach ([['alice', 'Alice Example'], ['Alice', 'Zoë "A" & #1'], ['o.brien', "Anna O'Brien"], ['alice', '#exec /bin/id']] as [$username, $fullname]) {
    $execs = [];
    check(call($app, 'POST', '/users', ['username' => $username, 'fullname' => $fullname]) === [422, ''], 'the legacy user ' . json_encode([$username, $fullname]) . ' changed answer');
    check($execs === ['/usr/bin/sudo /sbin/e-smith/signal-event user-create ' . escapeshellarg(strtolower($username)) . ' ' . escapeshellarg($fullname) . " '/bin/false'"], 'the legacy user ' . json_encode([$username, $fullname]) . ' did not reach the provider unchanged: ' . json_encode($execs));
}
foreach ($controlCharacters as $character) {
    foreach ([['alice', "Alice{$character}#exec /bin/id"], ['alice', "Alice Example{$character}"], ["alice{$character}", 'Alice Example'], ["{$character}alice", 'Alice Example']] as [$username, $fullname]) {
        $execs = [];
        check(call($app, 'POST', '/users', ['username' => $username, 'fullname' => $fullname]) === $legacyRefused && $execs === [], 'the legacy user ' . json_encode([$username, $fullname]) . ' was not refused');
    }
}

error_reporting(E_ALL & ~E_WARNING & ~E_DEPRECATED);
$caller = ['superadmin'];
$newRefusals = ['{"status":"Invalid extension"}', '{"status":"Invalid MAC address"}', '{"status":false,"error":"Invalid ring time"}', '{"status":false,"error":"Invalid control character"}', '{"error":"Invalid control character"}', '{"message":"Invalid control character"}', '{"message":"Invalid extension"}', '{"status":false,"errors":["Invalid control character"],"warnings":[],"infos":[]}', '{"result":"User name or full name invalid"}'];
foreach ([
    ['POST', '/webrtc', ['extension' => '2O1']],
    ['POST', '/nethlink', ['extension' => '201 ']],
    ['POST', '/mobileapp', ['mainextension' => "201\n"]],
    ['POST', '/physicalextensions', ['mainextension' => '2O1', 'mac' => '', 'model' => '', 'web_user' => 'admin', 'web_password' => 'invented', 'line' => null]],
    ['POST', '/physicalextensions', ['mainextension' => '201', 'mac' => 'AA:BB:CC:00:10', 'model' => '', 'web_user' => 'admin', 'web_password' => 'invented', 'line' => null]],
    ['POST', '/bulk/201', ['ringtime' => 20.5]],
    ['POST', '/bulk/201', ['displayname' => "Alice\tExample"]],
    ['POST', '/trunks', ['name' => "Main\tline"] + $trunk],
    ['PATCH', '/trunks/3', ['username' => "user\t01"]],
    ['POST', '/inboundroutes', ['description' => "Main\tline"] + $inbound],
    ['POST', '/outboundroutes', ['it' => [['name' => "national\t", 'trunks' => []]]]],
    ['POST', '/settings/defaultlanguage', ['lang' => "it\t"]],
    ['POST', '/extension/201', ['displayname' => "Alice\tExample"]],
    ['POST', '/devices/gateways', ['name' => "Gateway\t1"] + $gatewayRequest],
    ['POST', '/mainextensions', ['username' => 'alice', 'extension' => '2O1']],
    ['POST', '/users', ['username' => 'alice', 'fullname' => "Alice\tExample"]],
] as [$method, $path, $body]) {
    resetFakes();
    lockFakes();
    FreePBX::$instance->Userman = new FakeUserman();
    $execs = [];
    try {
        [$status, $answer] = call($app, $method, $path, $body);
    } catch (LockedException $e) {
        [$status, $answer] = ['locked', ''];
    }
    check(!($status === 400 && in_array($answer, $newRefusals, true)) && !($status === 400 && $answer === '' && in_array($path, ['/settings/defaultlanguage', '/extension/201'], true)), "the superadmin request $method $path " . json_encode($body) . " got a refusal of the limited administrators: $status $answer");
}
$caller = ['users', 'trunks', 'routes', 'phones', 'integrations', 'settings'];
error_reporting(E_ALL);

$mobileRows = function ($sql, $params) {
    if (str_contains($sql, 'FROM `userman_users` WHERE `default_extension` = ?')) {
        return in_array($params[0], ['201', '202'], true) ? [['username' => 'qa_owner' . $params[0]]] : [];
    }
    if (str_contains($sql, 'FROM `rest_devices_phones` WHERE user_id = (')) {
        return $params === ['201', 'mobile'] ? [['extension' => '93201']] : [];
    }
    return [];
};
foreach (['201', '91201', '92201', '93202', '94201', '7701'] as $extension) {
    resetFakes();
    FreePBX::$db->rows = $mobileRows;
    check(call($app, 'DELETE', "/mobileapp/$extension") === [404, '{"message":"Mobile app extension not found"}'], "DELETE /mobileapp accepted the extension $extension");
    check(array_filter(FreePBX::$db->log, fn($entry) => str_starts_with($entry[1], 'UPDATE') || str_starts_with($entry[1], 'DELETE')) === [], "DELETE /mobileapp changed the extension $extension");
}
resetFakes();
FreePBX::$db->rows = $mobileRows;
$astman = new class { public function database_get($family, $key) { return false; } public function database_put($family, $key, $value) { return true; } };
check(call($app, 'DELETE', '/mobileapp/93201')[0] === 204, 'the mobile app extension of a user was not deleted');
check(in_array(['prepare', 'UPDATE rest_devices_phones SET user_id = NULL, extension = NULL, secret = NULL WHERE extension = ?', ['93201']], FreePBX::$db->log, true), 'the mobile app extension was not released: ' . json_encode(FreePBX::$db->log));

$importer = "$sandbox/rest/lib/csvimport.php";
$importLog = "$sandbox/csvimport.log";
$importStatus = "$sandbox/csvimport.code";
$patch($importer, "include_once('/var/www/html/freepbx/rest/lib/libUsers.php');", 'require ' . var_export("$sandbox/csvimport_fakes.php", true) . ';', 1);
foreach (['libExtensions.php', 'libCTI.php', 'libMiddleware.php', 'libUsersAdmin.php'] as $lib) {
    $patch($importer, "include_once('/var/www/html/freepbx/rest/lib/$lib');", '', 1);
}
$patch($importer, "include_once('/var/www/html/freepbx/rest/lib/libCTIGroups.php');", "require_once(__DIR__ . '/libCTIGroups.php');", 1);
$patch($importer, "if (file_exists('/var/www/html/freepbx/rest/lib/libMigration.php')) {", 'if (false) {', 1);
$patch($importer, "'/var/run/nethvoice/csvimport.code'", var_export($importStatus, true), 1);
$patch($importer, "system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');", 'null;', 1);
$patch($importer, 'curl_', 'fake_curl_', 6);
file_put_contents("$sandbox/csvimport_fakes.php", '<?php
$events = [];
register_shutdown_function(function () { file_put_contents(' . var_export($importLog, true) . ', json_encode($GLOBALS["events"])); });
ini_set("error_log", "/dev/null");
function getToken() { return "invented-token"; }
function getUserPortalUrl() { return "https://users-admin.example.org/api"; }
function setUserPortalCurlDefaults($ch, $headers) {}
function generateRandomPassword() { return "Generated-42!"; }
function triggerMiddlewareProfilesReload() {}
function userExists($username, $token) { $GLOBALS["events"][] = ["userExists", $username]; return in_array($username, explode(",", (string) getenv("QA_EXISTING")), true); }
function usersAdminSynchronize() { $GLOBALS["events"][] = ["sync"]; if (getenv("QA_SYNC_FAILS") === "kill") { exit(9); } return getenv("QA_SYNC_FAILS") !== "1"; }
function usersAdminDefaultClient() { return "client"; }
function usersAdminTargetError($username, $caller, $selfAllowed) { return $username === "admin" ? [403, ["code" => "protected_account"]] : null; }
function usersAdminProtectedTargetError($client, $username, $caller) { $GLOBALS["events"][] = ["protected", $username, $caller]; return in_array($username, explode(",", (string) getenv("QA_PROTECTED")), true) ? [403, ["code" => "domain_admin"]] : null; }
function ctiCreateGroup($name) { $GLOBALS["events"][] = ["group", $name]; return 5; }
function getProfileID($name) { return null; }
function getUserID($username) { $GLOBALS["events"][] = ["getUserID", $username]; return 7; }
function createMainExtensionForUser($username, $extension) { $GLOBALS["events"][] = ["createMainExtensionForUser", $username, $extension]; return true; }
function fake_curl_init($url) { return ["url" => $url]; }
function fake_curl_setopt(&$ch, $option, $value) { $ch["body"] = json_decode($value, true); }
function fake_curl_exec($ch) {
    $GLOBALS["events"][] = ["post", basename($ch["url"]), $ch["body"]];
    if (in_array($ch["body"]["user"] ?? "", explode(",", (string) getenv("QA_ADD_WEAK")), true)) { return json_encode(["status" => "failure", "message" => "error_password_complexity"]); }
    if (in_array($ch["body"]["user"] ?? "", explode(",", (string) getenv("QA_ADD_FAILS")), true)) { return json_encode(["status" => "failure", "error" => [["error" => "unexpected"]]]); }
    return json_encode(["status" => "success"]);
}
function usersAdminAssignmentError($username, $caller, $client = null) { return in_array($username, explode(",", (string) getenv("QA_NONMEMBERS")), true) ? [403, ["code" => "not_instance_user"]] : null; }
function usersAdminAddMembers($client, $usernames) { $GLOBALS["events"][] = ["members", $usernames]; return getenv("QA_MEMBERS_FAIL") !== "1"; }
function usersAdminPasswordPolicy($client) { return getenv("QA_POLICY") === "1" ? ["strength" => ["enforced" => true, "password_min_length" => 8, "complexity_check" => true]] : null; }
function usersAdminRemoveCreatedAccount($client, $username) { $GLOBALS["events"][] = ["removeCreated", $username]; return getenv("QA_REMOVE_FAILS") === "1" ? false : true; }
function usersAdminAccountError($client, $username) { return getenv("QA_LEFT") === "1" ? null : [404, ["code" => "user_not_found"]]; }
function fake_curl_error($ch) { return ""; }
function fake_curl_getinfo($ch, $info) { return 200; }
function fake_curl_close($ch) {}
class FakeImportStatement { public function execute($params) { $GLOBALS["events"][] = ["sql", $params]; return true; } }
function qaPairs($name) { $pairs = []; foreach (array_filter(explode(",", (string) getenv($name))) as $pair) { [$key, $value] = array_pad(explode("=", $pair, 2), 2, ""); $pairs[$key] = $value; } return $pairs; }
function getUserMainExtension($username) { return qaPairs("QA_MAIN")[$username] ?? null; }
function getWebRTCExtension($main) { return qaPairs("QA_DEVICES")["webrtc"] ?? null; }
function getWebRTCMobileExtension($main) { return qaPairs("QA_DEVICES")["webrtc_mobile"] ?? null; }
function getNethLinkExtension($main) { return qaPairs("QA_DEVICES")["nethlink"] ?? null; }
function getNethLinkMobileExtension($main) { return qaPairs("QA_DEVICES")["nethlink_mobile"] ?? null; }
function createExtension($main, $delete) { $GLOBALS["events"][] = ["createExtension", $main]; return "95" . $main; }
function useExtensionAsWebRTC($extension) { $GLOBALS["events"][] = ["webrtc", $extension]; return true; }
function useExtensionAsNethLink($extension) { $GLOBALS["events"][] = ["nethlink", $extension]; return true; }
function deleteExtension($extension) { $GLOBALS["events"][] = ["deleteExtension", $extension]; return true; }
function setCTIUserProfile($uid, $profile) { $GLOBALS["events"][] = ["profile", $uid, $profile]; return true; }
class FakeImportVoicemail {
    public function getMailbox($extension) { return getenv("QA_MAILBOX") === "1" ? ["mailbox" => $extension] : false; }
    public function processQuickCreate($tech, $extension, $data) { $GLOBALS["events"][] = ["voicemail", $extension]; }
    public function delMailbox($extension) { $GLOBALS["events"][] = ["delMailbox", $extension]; }
}
class FreePBX {
    public static function Database() { return new class { public function prepare($sql) { return new FakeImportStatement(); } public function query($sql) { return new class { public function fetchAll($mode = null) { return [["id" => 1, "name" => "Sales"]]; } }; } }; }
    public static function create() { return new class { public $Voicemail; public function __construct() { $this->Voicemail = new FakeImportVoicemail(); } }; }
}
');
$import = function ($csv, $restricted = true, $rfc4180 = false) use ($importer, $importLog, $importStatus) {
    @unlink($importLog);
    @unlink($importStatus);
    exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($importer) . ' ' . escapeshellarg(base64_encode($csv)) . ($restricted ? ' restricted' : '') . ($rfc4180 ? ' rfc4180' : ''), $output, $exitCode);
    return [$exitCode, json_decode((string) file_get_contents($importStatus), true), json_decode((string) file_get_contents($importLog), true)];
};
function serializeRows(array $rows): string {
    return implode('', array_map(fn($row) => implode(',', array_map(fn($cell) => '"' . str_replace('"', '""', $cell) . '"', $row)) . "\r\n", $rows));
}
$validRows = [
    ['alice', 'Alice Example', '201', 'Invented-Pass-1!'],
    ['bob', 'Zoë Müller-Ça', '202', 'p"a s#s&ö', '+39 333 000 0000'],
    ['carol', 'Anna O\'Brien "R&D" #2 / 50%', '', ''],
];
$validCsv = serializeRows($validRows);
[$exitCode, $status, $events] = $import($validCsv);
check($exitCode === 0 && $status === ['exitcode' => 0, 'errors' => '', 'progress' => 100], 'a valid CSV import failed: ' . json_encode($status));
check($events === [
    ['userExists', 'alice'], ['post', 'add-user', ['user' => 'alice', 'display_name' => 'Alice Example', 'password' => 'Invented-Pass-1!', 'locked' => false, 'groups' => []]],
    ['userExists', 'bob'], ['post', 'add-user', ['user' => 'bob', 'display_name' => 'Zoë Müller-Ça', 'password' => 'p"a s#s&ö', 'locked' => false, 'groups' => []]],
    ['userExists', 'carol'], ['post', 'add-user', ['user' => 'carol', 'display_name' => 'Anna O\'Brien "R&D" #2 / 50%', 'password' => 'Generated-42!', 'locked' => false, 'groups' => []]],
    ['members', ['alice', 'bob', 'carol']],
    ['sync'],
    ['getUserID', 'alice'], ['createMainExtensionForUser', 'alice', '201'],
    ['getUserID', 'bob'], ['createMainExtensionForUser', 'bob', '202'], ['sql', ['00393330000000', 'bob', '00393330000000']],
    ['getUserID', 'carol'],
], 'a valid CSV import did not reach the provider and FreePBX unchanged: ' . json_encode($events));
foreach ($controlCharacters as $character) {
    foreach ([0, 1, 2, 3, 4] as $column) {
        $row = ['dave', 'Dave Example', '203', 'Invented-Pass-2!', '3330000001'];
        $row[$column] = $column === 2 ? "203{$character}" : $row[$column] . "{$character}#exec /bin/id";
        if ($character === "\n" || $character === "\r") {
            continue;
        }
        [$exitCode, $status, $events] = $import(serializeRows([$validRows[0], $row]));
        check($exitCode === 1 && $status['exitcode'] === 1 && $status['errors'] === "Error creating user: control characters are not allowed at CSV line 2\n", 'a CSV row with ' . json_encode($row) . ' was not reported: ' . json_encode($status));
        check(!str_contains(json_encode($events), 'dave'), 'a CSV row with ' . json_encode($row) . ' reached the provider or FreePBX: ' . json_encode($events));
        check(in_array(['getUserID', 'alice'], $events, true), 'a CSV row with a control character stopped the valid rows');
    }
}
[$exitCode, $status, $events] = $import(serializeRows([['erin', "Erin\tExample"]]) . "\"frank\",\"Frank\x01\",\"204\"\r\n");
check($exitCode === 1 && $status['errors'] === "Error creating user: control characters are not allowed at CSV line 1\nError creating user: control characters are not allowed at CSV line 2\n" && $events === [['sync']], 'CSV rows with control characters were not all reported: ' . json_encode([$status, $events]));
[$exitCode, $status, $events] = $import(serializeRows([['erin', "Erin\tExample"]]), false);
check($exitCode === 0 && $events[1] === ['post', 'add-user', ['user' => 'erin', 'display_name' => "Erin\tExample", 'password' => 'Generated-42!', 'locked' => false, 'groups' => []]], 'the superadmin CSV import refused a control character: ' . json_encode([$status, $events]));

$addedUsers = fn($events) => array_values(array_map(fn($event) => $event[2], array_filter($events, fn($event) => $event[0] === 'post')));
$backslashRows = [
    ['alice', 'Alice Example', '201', 'Invented-Pass-1!\\'],
    ['bob', 'Bob Example\\', '202', 'Invented-Pass-2!'],
    ['carol', 'Carol \\"Example\\"', '', 'p\\\\a"s\\s'],
];
foreach ([true, false] as $restricted) {
    [$exitCode, $status, $events] = $import(serializeRows($backslashRows), $restricted, true);
    check($exitCode === 0 && $addedUsers($events) === [
        ['user' => 'alice', 'display_name' => 'Alice Example', 'password' => 'Invented-Pass-1!\\', 'locked' => false, 'groups' => []],
        ['user' => 'bob', 'display_name' => 'Bob Example\\', 'password' => 'Invented-Pass-2!', 'locked' => false, 'groups' => []],
        ['user' => 'carol', 'display_name' => 'Carol \\"Example\\"', 'password' => 'p\\\\a"s\\s', 'locked' => false, 'groups' => []],
    ] && in_array(['createMainExtensionForUser', 'bob', '202'], $events, true), 'an RFC 4180 CSV import changed values with backslashes: ' . json_encode([$status, $events]));
    [$exitCode, $status, $events] = $import($validCsv, $restricted, true);
    check($exitCode === 0 && $status === ['exitcode' => 0, 'errors' => '', 'progress' => 100] && $addedUsers($events) === array_map(fn($row) => ['user' => $row[0], 'display_name' => $row[1], 'password' => $row[3] !== '' ? $row[3] : 'Generated-42!', 'locked' => false, 'groups' => []], $validRows), 'an RFC 4180 CSV import changed a valid CSV: ' . json_encode([$status, $events]));
}
[$exitCode, $status, $events] = $import(serializeRows($backslashRows));
check($addedUsers($events)[0]['password'] === 'Invented-Pass-1!\\"' && !in_array(['createMainExtensionForUser', 'bob', '202'], $events, true), 'the CSV import without the RFC 4180 option no longer parses backslashes as before: ' . json_encode($events));

$systemCalls = [];
function recordSystem($command, &$status = null) {
    $GLOBALS['systemCalls'][] = $command;
    $status = 0;
}
$launchArguments = function (string $command): array {
    preg_match_all("/'([^']*)'/", $command, $matches);
    return $matches[1];
};
foreach ([
    [['users'], ['file' => 'ZmFrZQ=='], ['--caller=', 'restricted']],
    [['users'], ['file' => 'ZmFrZQ==', 'rfc4180' => true], ['--caller=', 'restricted', 'rfc4180']],
    [['users'], ['file' => 'ZmFrZQ==', 'rfc4180' => 'true'], ['--caller=', 'restricted']],
    [['superadmin'], ['file' => 'ZmFrZQ=='], []],
    [['superadmin'], ['file' => 'ZmFrZQ==', 'rfc4180' => true], ['rfc4180']],
] as [$caller, $body, $options]) {
    $systemCalls = [];
    @unlink($routeImportStatus);
    [$status, $started] = call($app, 'POST', '/csv/csvimport', $body);
    $id = json_decode($started, true)['id'] ?? '';
    $arguments = count($systemCalls) === 1 ? $launchArguments($systemCalls[0]) : [];
    check($status === 200 && preg_match('/^[a-f0-9]{16}$/', $id) === 1 && str_starts_with($systemCalls[0] ?? '', '/usr/local/bin/php /var/www/html/freepbx/rest/lib/csvimport.php ') && str_ends_with($systemCalls[0], ' > /dev/null 2>&1 &'), 'the CSV import route did not start ' . json_encode([$caller, $body, $started, $systemCalls]));
    check(array_slice($arguments, 1) === array_merge(['--id=' . $id], $options) && $arguments[0] === "--file=$routeImportStatus.$id.csv" && file_get_contents("$routeImportStatus.$id.csv") === 'ZmFrZQ==' && (fileperms("$routeImportStatus.$id.csv") & 0777) === 0600, 'the CSV import route did not pass the payload in a private file and the options ' . json_encode([$caller, $body, $arguments]));
    check(!str_contains($systemCalls[0], 'ZmFrZQ=='), 'the CSV payload is still passed on the command line');
    unlink("$routeImportStatus.$id.csv");
}
foreach ([['superadmin'], ['users']] as $caller) {
    @unlink($routeImportStatus);
    $systemCalls = [];
    [, $started] = call($app, 'POST', '/csv/csvimport', ['file' => 'ZmFrZQ==']);
    $id = json_decode($started, true)['id'];
    @unlink("$routeImportStatus.$id.csv");
    check(json_decode(file_get_contents($routeImportStatus), true)['id'] === $id, 'the CSV import started without an initial status');
    check(call($app, 'GET', '/csv/csvimport') === [200, '{"result":0}'], 'a CSV import that has not read its first row is not reported as running');
    check(call($app, 'GET', "/csv/csvimport?id=$id") === [200, '{"result":0}'], 'a CSV import is not reported to the client that started it');
    check(call($app, 'POST', '/csv/csvimport', ['file' => 'ZmFrZQ=='])[0] === 409 && count($systemCalls) === 1, 'a second CSV import started while one is running');
    file_put_contents($routeImportStatus, json_encode(['id' => $id, 'pid' => getmypid(), 'progress' => 40]));
    check(call($app, 'POST', '/csv/csvimport', ['file' => 'ZmFrZQ=='])[0] === 409, 'a second CSV import started while the first process runs');
    check(call($app, 'GET', '/csv/csvimport?id=0123456789abcdef') === [422, '{"status":"No csv import active"}'], 'another client read the status of a CSV import it did not start');
    file_put_contents($routeImportStatus, json_encode(['id' => $id, 'exitcode' => 0, 'errors' => '', 'progress' => 100]));
    [$status, $second] = call($app, 'POST', '/csv/csvimport', ['file' => 'ZmFrZQ==']);
    $secondId = json_decode($second, true)['id'] ?? '';
    @unlink("$routeImportStatus.$secondId.csv");
    check($status === 200 && $secondId !== $id, 'a CSV import did not start after the previous one ended');
    check(call($app, 'GET', "/csv/csvimport?id=$id") === [200, '{"result":100}'], 'the result of a finished CSV import was lost when another one started');
    check(call($app, 'GET', "/csv/csvimport?id=$id") === [422, '{"status":"No csv import active"}'], 'a reported CSV import is still kept');
    check(call($app, 'GET', "/csv/csvimport?id=$secondId") === [200, '{"result":0}'], 'reading the previous CSV import removed the running one');
    file_put_contents($routeImportStatus, json_encode(['id' => $secondId, 'exitcode' => 0, 'errors' => '', 'progress' => 100]));
    check(call($app, 'GET', '/csv/csvimport') === [200, '{"result":100}'], 'a finished CSV import is not reported as finished to the old wizard');
    check(call($app, 'GET', '/csv/csvimport') === [422, '{"status":"No csv import active"}'], 'a CSV import reported to the old wizard is still active');
    check(call($app, 'GET', "/csv/csvimport?id=$secondId") === [200, '{"result":100}'], 'the old wizard took the result of a CSV import from the client that started it');
    file_put_contents($routeImportStatus, json_encode(['id' => $secondId, 'progress' => 0, 'started_at' => time() - 60]));
    check(call($app, 'GET', '/csv/csvimport') === [500, '{"status":"CSV import stopped unexpectedly","problems":[{"code":"stopped"}]}'], 'a CSV import that never started is still reported as running');
    check(call($app, 'GET', '/csv/csvimport') === [422, '{"status":"No csv import active"}'], 'a CSV import that never started is still active');
    file_put_contents($routeImportStatus, json_encode(['id' => $secondId, 'pid' => 999999999, 'progress' => 30]));
    check(call($app, 'GET', "/csv/csvimport?id=$secondId")[0] === 500, 'a CSV import whose process ended is still reported as running');
    check(call($app, 'POST', '/csv/csvimport', ['file' => str_repeat('A', CSV_IMPORT_MAX_BASE64_LENGTH + 4)])[0] === 413, 'a CSV payload over the limit was accepted');
    check(call($app, 'POST', '/csv/csvimport', [])[0] === 400, 'a CSV import without a file was accepted');
    foreach (glob("$routeImportStatus.*") as $file) { unlink($file); }
    @unlink($routeImportStatus);
}
check(csvExportCell('=HYPERLINK("http://x")') === '\'=HYPERLINK("http://x")' && csvExportCell('+HYPERLINK("http://x")') === '\'+HYPERLINK("http://x")' && csvExportCell('-cmd') === "'-cmd" && csvExportCell('@SUM(A1)') === "'@SUM(A1)" && csvExportCell("\tx") === "'\tx" && csvExportCell("\rx") === "'\rx", 'formulas are exported as they are');
check(csvExportCell('Anna Rossi') === 'Anna Rossi' && csvExportCell(201) === '201' && csvExportCell(null) === '' && csvExportCell('a=b') === 'a=b', 'plain values are changed in the export');
check(csvExportCell('+39 333 1234567') === '+39 333 1234567' && csvExportCell('+393331234567') === '+393331234567' && csvExportCell('-1') === '-1' && csvExportCell('0039 (02) 123-45') === '0039 (02) 123-45', 'phone numbers are changed in the export');
check(csvImportCell("'=SUM(A1)") === '=SUM(A1)' && csvImportCell("'+x") === '+x' && csvImportCell("'@a") === '@a' && csvImportCell("'abc") === "'abc" && csvImportCell('Anna') === 'Anna' && csvImportCell(csvExportCell('=x')) === '=x', 'exported formula cells do not import back unchanged');

$importWith = function (array $arguments, array $environment = []) use ($importer, $importLog, $importStatus) {
    @unlink($importLog);
    @unlink($importStatus);
    $command = implode(' ', array_map(fn($name, $value) => $name . '=' . escapeshellarg($value), array_keys($environment), $environment)) . ' ' . escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($importer) . ' ' . implode(' ', array_map('escapeshellarg', $arguments));
    exec($command, $output, $exitCode);
    return [$exitCode, json_decode((string) file_get_contents($importStatus), true), json_decode((string) file_get_contents($importLog), true)];
};
$payload = "$sandbox/csvimport.payload.csv";
file_put_contents($payload, base64_encode(serializeRows([$validRows[0]])));
[$exitCode, $status, $events] = $importWith(["--file=$payload", '--id=0123456789abcdef']);
check($exitCode === 0 && $status['id'] === '0123456789abcdef' && is_int($status['pid']) && $status['exitcode'] === 0 && $status['progress'] === 100 && in_array(['createMainExtensionForUser', 'alice', '201'], $events, true), 'a CSV import from a file failed: ' . json_encode([$status, $events]));
check(!file_exists($payload), 'the CSV payload file was not removed');
file_put_contents($payload, base64_encode(serializeRows([$validRows[0]])));
[$exitCode, $status, $events] = $importWith(["--file=$payload", '--id=0123456789abcdef'], ['QA_SYNC_FAILS' => '1']);
check($exitCode === 1 && $status['problems'] === [['code' => 'sync_failed'], ['code' => 'account_created', 'line' => 1, 'username' => 'alice']] && !in_array(['getUserID', 'alice'], $events, true), 'a failed user synchronization was not reported with the accounts it created: ' . json_encode([$status, $events]));
file_put_contents($payload, base64_encode(serializeRows([$validRows[0], ['qa_old', 'Old Example', '210']])));
[$exitCode, $status, $events] = $importWith(["--file=$payload", '--id=0123456789abcdef'], ['QA_SYNC_FAILS' => 'kill', 'QA_EXISTING' => 'qa_old']);
check(!isset($status['exitcode']) && $status['created'] === [['line' => 1, 'username' => 'alice']], 'a CSV import stopped after creating accounts did not record them: ' . json_encode($status));
check(csvImportStopped($status)['problems'] === [['code' => 'stopped'], ['code' => 'account_created', 'line' => 1, 'username' => 'alice']], 'a stopped CSV import did not report the accounts it created: ' . json_encode(csvImportStopped($status)));
check(csvImportStopped(['id' => '0123456789abcdef', 'created' => [['line' => '1', 'username' => 'alice'], ['username' => ['x']], 'bad']])['problems'] === [['code' => 'stopped']], 'malformed created accounts were reported');

$problemsOf = function (array $rows, array $environment, bool $restricted = true) use ($importWith) {
    [$exitCode, $status, $events] = $importWith(array_merge([base64_encode(serializeRows($rows))], $restricted ? ['--caller=qa_helper', 'restricted'] : []), $environment);
    return [$exitCode, $status['problems'] ?? [], $events];
};
foreach ([true, false] as $restricted) {
    [$exitCode, $problems, $events] = $problemsOf([['qa_weak', 'Weak Example', '211', 'weakpass'], ['qa_ok', 'Ok Example', '212', 'Strong-Pass-1']], ['QA_POLICY' => '1'], $restricted);
    $posted = array_column(array_filter($events, fn($event) => $event[0] === 'post'), 2);
    check($exitCode === 1 && $problems === [['code' => 'weak_password', 'line' => 1, 'username' => 'qa_weak']] && array_column($posted, 'user') === ['qa_ok'], 'a password against the domain policy reached the user domain: ' . json_encode([$problems, $events]));
}
[$exitCode, $problems, $events] = $problemsOf([['qa_weak', 'Weak Example', '211', 'weakpass']], []);
check($exitCode === 0 && $problems === [], 'without a readable policy the user domain must decide: ' . json_encode($problems));
[$exitCode, $problems, $events] = $problemsOf([['qa_bad', 'Bad Example', '213', 'Rejected-Pass-1']], ['QA_ADD_WEAK' => 'qa_bad']);
check($exitCode === 1 && $problems === [['code' => 'weak_password', 'line' => 1, 'username' => 'qa_bad']] && in_array(['removeCreated', 'qa_bad'], $events, true) && !in_array(['getUserID', 'qa_bad'], $events, true), 'an account refused for its password was left in the user domain: ' . json_encode([$problems, $events]));
[$exitCode, $problems] = $problemsOf([['qa_bad', 'Bad Example', '213', 'Rejected-Pass-1']], ['QA_ADD_WEAK' => 'qa_bad', 'QA_REMOVE_FAILS' => '1']);
check($problems === [['code' => 'account_created', 'line' => 1, 'username' => 'qa_bad'], ['code' => 'weak_password', 'line' => 1, 'username' => 'qa_bad']], 'an account that could not be removed was not reported: ' . json_encode($problems));
[$exitCode, $problems, $events] = $problemsOf([['qa_gen', 'Gen Example', '214']], ['QA_ADD_FAILS' => 'qa_gen', 'QA_LEFT' => '1']);
check($problems === [['code' => 'account_created', 'line' => 1, 'username' => 'qa_gen'], ['code' => 'create_failed', 'line' => 1, 'username' => 'qa_gen']] && !in_array(['removeCreated', 'qa_gen'], $events, true), 'an account left by a failed creation was removed or not reported: ' . json_encode([$problems, $events]));
[$exitCode, $problems, $events] = $problemsOf([['qa_out', 'Out Example', '215'], ['qa_in', 'In Example', '216']], ['QA_EXISTING' => 'qa_out,qa_in', 'QA_NONMEMBERS' => 'qa_out']);
check($exitCode === 1 && $problems === [['code' => 'not_instance_user', 'line' => 1, 'username' => 'qa_out']] && !in_array(['getUserID', 'qa_out'], $events, true) && in_array(['getUserID', 'qa_in'], $events, true), 'a limited administrator imported a user who is not a member: ' . json_encode([$problems, $events]));
[$exitCode, $problems, $events] = $problemsOf([['qa_out', 'Out Example', '215'], ['qa_none', 'None Example', '']], ['QA_EXISTING' => 'qa_out,qa_none', 'QA_NONMEMBERS' => 'qa_out'], false);
check($exitCode === 0 && in_array(['members', ['qa_out']], $events, true), 'the superadmin import did not make the users with an extension members: ' . json_encode([$problems, $events]));
[$exitCode, $problems, $events] = $problemsOf([['qa_new', 'New Example', '217']], ['QA_MEMBERS_FAIL' => '1']);
check($exitCode === 1 && $problems === [['code' => 'membership_failed']] && in_array(['getUserID', 'qa_new'], $events, true), 'a new account left out of the members was not reported: ' . json_encode([$problems, $events]));
[$exitCode, $problems] = $problemsOf([['qa_old', 'Old Example', '218']], ['QA_EXISTING' => 'qa_old', 'QA_MEMBERS_FAIL' => '1'], false);
check($exitCode === 0 && $problems === [], 'the superadmin import of existing users failed for the members group: ' . json_encode($problems));
check(csvImportWeakPassword('Abcdef1!', ['strength' => ['enforced' => true, 'password_min_length' => 8, 'complexity_check' => true]]) === false && csvImportWeakPassword('abcdefg1', ['strength' => ['enforced' => true, 'password_min_length' => 8, 'complexity_check' => true]]) === true && csvImportWeakPassword('Abc1!', ['strength' => ['enforced' => true, 'password_min_length' => 8, 'complexity_check' => false]]) === true && csvImportWeakPassword('abc', ['strength' => ['enforced' => false, 'password_min_length' => 8]]) === false && csvImportWeakPassword('abc', null) === false, 'the password policy is not applied as the user domain does');
check(csvImportAddUserProblem('{"status":"failure","message":"error_password_history"}') === 'weak_password' && csvImportAddUserProblem('{"status":"failure","error":[{"field":"password","error":"x"}]}') === 'weak_password' && csvImportAddUserProblem('{"status":"failure","error":[{"field":"password"},{"error":"user_already_exists"}]}') === 'create_failed' && csvImportAddUserProblem(false) === 'create_failed' && csvImportAddUserProblem('<html>') === 'create_failed', 'the add-user failures are not classified');

$deviceEvents = fn($events) => array_values(array_filter($events, fn($event) => in_array($event[0], ['createMainExtensionForUser', 'createExtension', 'webrtc', 'nethlink', 'deleteExtension', 'voicemail', 'delMailbox'], true)));
foreach ([true, false] as $restricted) {
    $arguments = array_merge([base64_encode(serializeRows([['alice', 'Alice Example', '201', '', '', 'TRUE', 'TRUE', '', '', 'TRUE']]))], $restricted ? ['--caller=qa_helper', 'restricted'] : []);
    [$exitCode, $status, $events] = $importWith($arguments, ['QA_EXISTING' => 'alice', 'QA_MAIN' => 'alice=201', 'QA_DEVICES' => 'webrtc=92201,nethlink=93201', 'QA_MAILBOX' => '1']);
    check($exitCode === 0 && $deviceEvents($events) === [], 'importing an existing user with the same extension changed the extension, its devices or its voicemail: ' . json_encode([$status, $events]));
    $arguments[0] = base64_encode(serializeRows([['alice', 'Alice Example', '201', '', '', 'TRUE', 'FALSE', '', '', 'TRUE']]));
    [$exitCode, $status, $events] = $importWith($arguments, ['QA_EXISTING' => 'alice', 'QA_MAIN' => 'alice=201', 'QA_DEVICES' => 'webrtc=92201,webrtc_mobile=94201', 'QA_MAILBOX' => '0']);
    check($exitCode === 0 && $deviceEvents($events) === [['voicemail', '201'], ['deleteExtension', '92201'], ['deleteExtension', '94201'], ['createExtension', '201'], ['nethlink', '95201']], 'importing an existing user with the same extension did not change only the devices whose flag changed: ' . json_encode([$status, $events]));
    $arguments[0] = base64_encode(serializeRows([['alice', 'Alice Example', '205', '', '', 'TRUE', 'TRUE']]));
    [$exitCode, $status, $events] = $importWith($arguments, ['QA_EXISTING' => 'alice', 'QA_MAIN' => 'alice=201', 'QA_MAILBOX' => '1']);
    check($exitCode === 0 && $deviceEvents($events) === [['createMainExtensionForUser', 'alice', '205'], ['voicemail', '205'], ['createExtension', '205'], ['webrtc', '95205']], 'importing an existing user with a new extension did not recreate it: ' . json_encode([$status, $events]));
}
$protectedRows = serializeRows([['qa_boss', 'Boss Example', '205'], ['qa_plain', 'Plain Example', '206'], ['admin', 'Admin', '207'], ['qa_new', 'New Example', '208']]);
foreach ([true, false] as $restricted) {
    file_put_contents($payload, base64_encode($protectedRows));
    [$exitCode, $status, $events] = $importWith(array_merge(["--file=$payload", '--id=0123456789abcdef'], $restricted ? ['--caller=qa_helper', 'restricted'] : []), ['QA_EXISTING' => 'qa_boss,qa_plain,admin', 'QA_PROTECTED' => 'qa_boss']);
    $touched = array_values(array_unique(array_map(fn($event) => $event[1], array_filter($events, fn($event) => in_array($event[0], ['getUserID', 'createMainExtensionForUser'], true)))));
    if ($restricted) {
        check($exitCode === 1 && $status['problems'] === [['code' => 'protected_account', 'line' => 1, 'username' => 'qa_boss'], ['code' => 'protected_account', 'line' => 3, 'username' => 'admin']], 'protected accounts were not refused to an administrator with sections: ' . json_encode($status));
        check($touched === ['qa_plain', 'qa_new'], 'the telephony of a protected account was changed: ' . json_encode($events));
        check(in_array(['protected', 'qa_plain', ['username' => 'qa_helper', 'superadmin' => false]], $events, true) && !in_array('qa_new', array_column(array_filter($events, fn($event) => $event[0] === 'protected'), 1), true), 'the protection was not checked for existing users only: ' . json_encode($events));
    } else {
        check($exitCode === 0 && $touched === ['qa_boss', 'qa_plain', 'admin', 'qa_new'] && !in_array('protected', array_column($events, 0), true), 'the superadmin CSV import changed: ' . json_encode([$status, $events]));
    }
}
foreach ([true, false] as $restricted) {
    file_put_contents($payload, base64_encode(serializeRows([['qa_grp', 'Group Example', '209', '', '', '', '', 'sales|Sales, North|North']])));
    [$exitCode, $status, $events] = $importWith(array_merge(["--file=$payload", '--id=0123456789abcdef'], $restricted ? ['--caller=qa_helper', 'restricted'] : []));
    $groups = array_column(array_filter($events, fn($event) => $event[0] === 'group'), 1);
    if ($restricted) {
        check($exitCode === 1 && $groups === ['sales', 'North'] && $status['problems'] === [['code' => 'group_name_invalid', 'line' => 1, 'username' => 'qa_grp', 'group' => 'Sales, North']], 'an invalid group name was created by an administrator with sections: ' . json_encode([$status, $events]));
    } else {
        check($exitCode === 0 && $groups === ['sales', 'Sales, North', 'North'], 'the superadmin CSV import changed the groups: ' . json_encode([$status, $events]));
    }
}
[$exitCode, $status] = $import("\"bad\",\"\"\r\n");
check($exitCode === 1 && $status['problems'] === [['code' => 'missing_name', 'line' => 1]] && !isset($status['id']), 'a legacy CSV import did not report the row: ' . json_encode($status));
$caller = ['superadmin'];
resetFakes();
FreePBX::$instance->Userman = new class {
    public function getAllUsers() { return [['id' => '7', 'username' => 'alice', 'displayname' => 'Alice Example', 'default_extension' => '201'], ['id' => '8', 'username' => 'bob', 'displayname' => 'Bob Example', 'default_extension' => '202']]; }
};
FreePBX::$db = new class extends RecordingDatabase {
    public function sql($sql, $type = 'query', $mode = null) {
        $this->log[] = ['sql', $sql, null];
        return str_contains($sql, 'rest_users.mobile') ? [['mobile' => '00393330000000', 'username' => 'alice', 'id' => 7]] : [];
    }
};
FreePBX::$db->rows = fn($sql, $params) => [];
[$status, $body] = call($app, 'GET', '/csv/csvexport');
$exported = base64_decode((string) json_decode($body, true));
check($status === 200 && $exported === "alice,\"Alice Example\",201,,00393330000000,FALSE,FALSE,,\r\nbob,\"Bob Example\",202,,,FALSE,FALSE,,\r\n", 'the CSV export did not include the mobile of its user: ' . json_encode([$status, $exported]));
resetFakes();
[$exitCode, $status, $events] = $importWith([base64_encode($exported)], ['QA_EXISTING' => 'alice,bob', 'QA_MAIN' => 'alice=201,bob=202']);
check($exitCode === 0 && in_array(['sql', ['00393330000000', 'alice', '00393330000000']], $events, true) && in_array(['sql', [null, 'bob', null]], $events, true), 'an exported mobile did not import back unchanged: ' . json_encode([$status, $events]));

$caller = ['users', 'trunks', 'routes', 'phones', 'integrations', 'settings'];

echo "PASS: invalid extensions, MACs, ring times, template names, CTI profile names and control characters in bulk, trunk, route, language, display name and gateway values never reach SQL, AMI or FreePBX; valid values reach them unchanged\n";
