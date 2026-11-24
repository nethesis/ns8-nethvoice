<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Run shared REST handlers as the superadmin and as a limited administrator: the superadmin and the old wizard keep the answers of main, limited administrators get the new checks.

use Psr\Http\Message\ResponseInterface as Response;
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

class Recorder {
    public static array $log = [];
    public static $rows;
}

class FakeStatement {
    private array $result = [];
    public function __construct(private string $sql) {}
    public function execute($params = []) {
        Recorder::$log[] = ['prepare', $this->sql, $params];
        $this->result = (Recorder::$rows)($this->sql, $params);
        return true;
    }
    public function fetchAll($mode = null) { return $this->result; }
    public function fetch($mode = null) { return array_shift($this->result) ?? false; }
    public function fetchColumn() { return $this->result ? reset($this->result[0]) : false; }
}

class FakeDatabase {
    public function prepare($sql) { return new FakeStatement($sql); }
    public function query($sql) { Recorder::$log[] = ['query', $sql]; return new FakeStatement($sql); }
    public function sql($sql, $type = 'query', $mode = null) { Recorder::$log[] = ['sql', $sql]; return $type === 'getAll' ? [] : false; }
    public function exec($sql) { Recorder::$log[] = ['exec', $sql]; return 0; }
}

class FakeCore {
    public function listTrunks() {
        return [['trunkid' => '3', 'tech' => 'pjsip', 'name' => 'Main line']];
    }
    public function getTrunkDetails($trunkid) {
        return ['username' => 'line01', 'secret' => 'invented-secret', 'md5_cred' => 'invented-md5', 'auth_rejection_permanent' => 'off', 'sip_server' => 'sip.example.test'];
    }
    public function __call($name, $args) {
        Recorder::$log[] = ['Core', $name, $args];
        return true;
    }
}

class StaticCalls {
    public function __construct(private string $module) {}
    public function __call($name, $args) {
        Recorder::$log[] = [$this->module, $name, $args];
        return true;
    }
}

class FakeManager {
    public function __call($name, $args) {
        Recorder::$log[] = ['astman', $name, $args];
        return '';
    }
}

class FreePBX {
    public static $instance;
    public $Core;
    public static function Database() { return new FakeDatabase(); }
    public static function Core() { return new FakeCore(); }
    public static function create() { return self::$instance; }
    public static function __callStatic($name, $args) { return new StaticCalls($name); }
}

function sql($sql) { Recorder::$log[] = ['sql', $sql]; }
function recordSystem($command) { Recorder::$log[] = ['system', $command]; }
function recordRps($mac, $url) {
    Recorder::$log[] = ['rps', $mac, $url];
    return ['httpCode' => 200];
}

class FakeTancredi {
    public static array $phones = [];
    public function getMany(array $paths) {
        Recorder::$log[] = ['tancredi', $paths];
        return array_combine($paths, array_map(fn($path) => self::$phones[$path] ?? null, $paths));
    }
}

function resetFakes() {
    global $astman;
    Recorder::$log = [];
    Recorder::$rows = fn($sql, $params) => [];
    FreePBX::$instance = new FreePBX();
    FreePBX::$instance->Core = new FakeCore();
    $astman = new FakeManager();
}

$sandbox = sys_get_temp_dir() . '/superadmin_compatibility_test_' . getmypid();
$notify = "$sandbox/notify";
mkdir("$sandbox/rest/modules", 0700, true);
mkdir("$sandbox/admin/modules/core", 0700, true);
mkdir($notify, 0700, true);
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
$patch("$sandbox/rest/lib/libCTI.php", "include_once '/etc/freepbx.conf';", '', 1);
$patch("$sandbox/rest/lib/libCTI.php", "include_once '/var/www/html/freepbx/admin/modules/customcontexts/functions.inc.php';", '', 1);
$patch("$sandbox/rest/lib/libCTI.php", "include_once '/var/www/html/freepbx/rest/config.inc.php';", '', 1);
$patch("$sandbox/rest/lib/libCTI.php", "include_once '/var/www/html/freepbx/rest/lib/context_default_permissions.php';", '', 1);
$modules = ['trunks.php', 'routes.php', 'nethlink.php', 'configuration.php', 'provisioning-v2.php'];
foreach ($modules as $module) {
    copy("$rest/modules/$module", "$sandbox/rest/modules/$module");
    $helpers = substr_count(file_get_contents("$rest/modules/$module"), "system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');");
    $patch("$sandbox/rest/modules/$module", "system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');", 'null;', $helpers);
}
$patch("$sandbox/rest/modules/configuration.php", 'system("/usr/sbin/asterisk -rx', 'recordSystem("/usr/sbin/asterisk -rx', 1);
$patch("$sandbox/rest/modules/configuration.php", "'/notify/'.\$notification", var_export("$notify/", true) . '.$notification', 1);
$patch("$sandbox/rest/modules/provisioning-v2.php", "require_once '/var/www/html/freepbx/rest/vendor/autoload.php';", '', 1);
$patch("$sandbox/rest/modules/provisioning-v2.php", 'setFalconieriRPS(', 'recordRps(', 1);
$patch("$sandbox/rest/modules/provisioning-v2.php", 'new TancrediKeyLabelsClient()', 'new FakeTancredi()', 1);
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
$_ENV['PROXY_IP'] = '192.0.2.1';
$_ENV['PROXY_PORT'] = '5060';
resetFakes();

$app = AppFactory::create();
$app->add(function ($request, RequestHandlerInterface $handler): Response {
    $route = $request->getAttribute(RouteContext::ROUTE);
    if ($route !== null && $request->getAttribute('route') === null) {
        $request = $request->withAttribute('route', $route);
    }
    return $handler->handle($request);
});
$app->addRoutingMiddleware();
foreach ($modules as $module) {
    require "$sandbox/rest/modules/$module";
}

$superadmin = ['superadmin'];
$limited = ['users', 'trunks', 'routes', 'phones', 'integrations', 'settings'];
function call($app, $caller, $method, $path, $body = null) {
    $request = (new ServerRequestFactory())->createServerRequest($method, $path)->withAttribute(NETHVOICE_PERMISSIONS_ATTRIBUTE, $caller);
    if ($body !== null) { $request = $request->withParsedBody($body); }
    $response = $app->handle($request);
    return [$response->getStatusCode(), (string) $response->getBody()];
}
function logged($kind) {
    return array_values(array_filter(Recorder::$log, fn($entry) => $entry[0] === $kind));
}

resetFakes();
[$status, $body] = call($app, $superadmin, 'GET', '/trunks');
$details = json_decode($body, true)[0]['details'] ?? [];
check($status === 200 && ($details['secret'] ?? null) === 'invented-secret' && ($details['md5_cred'] ?? null) === 'invented-md5' && ($details['auth_rejection_permanent'] ?? null) === 'off', 'the superadmin trunk list lost the credentials: ' . $body);
resetFakes();
[$status, $body] = call($app, $limited, 'GET', '/trunks');
$details = json_decode($body, true)[0]['details'] ?? [];
check($status === 200 && !isset($details['secret']) && !isset($details['md5_cred']) && !isset($details['auth_rejection_permanent']) && $details['sip_server'] === 'sip.example.test', 'a limited administrator received trunk credentials: ' . $body);

$trunk = ['provider' => 'vivavox', 'username' => 'line01', 'password' => 'invented', 'phone' => '0721000000', 'codecs' => ['alaw'], 'forceCodec' => false, 'name' => str_repeat('n', 60)];
resetFakes();
check(call($app, $superadmin, 'POST', '/trunks', $trunk) === [200, ''], 'the superadmin long trunk name was refused');
check(count(array_filter(Recorder::$log, fn($entry) => $entry[0] === 'prepare' && str_starts_with($entry[1], 'INSERT INTO `trunks`') && $entry[2][2] === $trunk['name'])) === 1, 'the superadmin long trunk name was not saved');
resetFakes();
check(call($app, $limited, 'POST', '/trunks', $trunk) === [422, '{"message":"Trunk name must be a string of at most 50 characters"}'] && Recorder::$log === [], 'a limited administrator saved a long trunk name');

foreach ([['extension' => '0721000000'], ['extension' => '0721000000', 'destination' => ''], ['extension' => '0721000000', 'destination' => '   ']] as $route) {
    resetFakes();
    check(call($app, $superadmin, 'POST', '/inboundroutes', $route) === [200, ''] && logged('Core') === [['Core', 'addDID', [$route]]], 'the superadmin inbound route without destination was refused: ' . json_encode($route));
    resetFakes();
    check(call($app, $limited, 'POST', '/inboundroutes', $route) === [422, '{"message":"Inbound route extension and destination are required"}'] && Recorder::$log === [], 'a limited administrator saved an inbound route without destination: ' . json_encode($route));
}
resetFakes();
check(call($app, $superadmin, 'POST', '/inboundroutes', ['extension' => '0721000000', 'description' => "Main\tline", 'destination' => 'app-blackhole,hangup,1'])[0] === 200, 'the superadmin inbound route with a control character was refused');
resetFakes();
check(call($app, $limited, 'POST', '/inboundroutes', ['extension' => '0721000000', 'description' => "Main\tline", 'destination' => 'app-blackhole,hangup,1']) === [400, '{"message":"Invalid control character"}'], 'a limited administrator saved a control character');

foreach ([$superadmin, $limited] as $caller) {
    resetFakes();
    check(call($app, $caller, 'DELETE', '/nethlink/201') === [200, ''] && logged('Core') === [], 'removing a missing NethLink extension changed answer for ' . json_encode($caller));
}
resetFakes();
Recorder::$rows = fn($sql, $params) => str_contains($sql, 'FROM `rest_devices_phones`') && ($params[1] ?? null) === 'nethlink' ? [['extension' => '92201']] : [];
check(call($app, $superadmin, 'DELETE', '/nethlink/201') === [200, ''] && array_column(logged('Core'), 1) === ['delUser', 'delDevice'] && logged('Core')[0][2] === ['92201'], 'the NethLink extension was not removed: ' . json_encode(Recorder::$log));

$restarts = function () use ($notify) {
    $files = array_values(array_diff(scandir($notify), ['.', '..']));
    sort($files);
    return [count(logged('system')), $files];
};
$cases = [
    [['step' => 13, 'status' => 'true'], true],
    [['step' => '13', 'status' => 'true'], true],
    [['step' => 13, 'status' => 'false'], true],
    [['step' => 13, 'status' => false], true],
    [['step' => 12, 'status' => 'true'], false],
    [['step' => 12, 'status' => 'false'], false],
];
foreach ($cases as [$wizard, $restart]) {
    resetFakes();
    array_map('unlink', glob("$notify/*"));
    check(call($app, $superadmin, 'POST', '/configuration/wizard', $wizard) === [200, ''], 'the wizard step was not saved: ' . json_encode($wizard));
    $expected = $restart ? [1, ['restart_nethcti-middleware', 'restart_nethcti-server']] : [0, []];
    check($restarts() === $expected, 'saving the wizard step ' . json_encode($wizard) . ' changed the restarts: ' . json_encode($restarts()));
    check(logged('prepare')[0][2] === [$wizard['step'], $wizard['status']], 'the wizard step was not stored: ' . json_encode($wizard));
}

FakeTancredi::$phones = ['phones/00-15-65-AA-BB-CC' => ['mac' => '00-15-65-AA-BB-CC', 'provisioning_url1' => 'https://pbx.example.test/provisioning/first/{mac}.cfg'], 'phones/00-15-65-AA-BB-CD' => ['mac' => '00-15-65-AA-BB-CD', 'provisioning_url1' => null]];
foreach (['00:15:65:AA:BB:CC', '00-15-65-aa-bb-cc', '001565AABBCC', '00:15:65:aa:bb:cc'] as $mac) {
    resetFakes();
    check(call($app, $superadmin, 'POST', '/phones/rps/' . rawurlencode($mac), ['url' => 'https://provisioning.example.test/abc/{mac}.cfg']) === [200, ''] && logged('rps') === [['rps', $mac, 'https://provisioning.example.test/abc/{mac}.cfg']] && logged('tancredi') === [], "the MAC $mac did not reach the redirection service unchanged");
    resetFakes();
    check(call($app, $limited, 'POST', '/phones/rps/' . rawurlencode($mac), ['url' => 'https://provisioning.example.test/abc/{mac}.cfg']) === [403, ''] && logged('rps') === [] && logged('tancredi') === [], "a limited administrator sent the provisioning URL of $mac to the redirection service");
    foreach ([$superadmin, $limited] as $caller) {
        foreach ([null, [], ['url' => '']] as $body) {
            resetFakes();
            check(call($app, $caller, 'POST', '/phones/rps/' . rawurlencode($mac), $body) === [200, ''] && logged('rps') === [['rps', $mac, 'https://pbx.example.test/provisioning/first/{mac}.cfg']] && logged('tancredi') === [['tancredi', ['phones/00-15-65-AA-BB-CC']]], "the first access URL of $mac did not reach the redirection service: " . json_encode(Recorder::$log));
        }
    }
}
foreach ([$superadmin, $limited] as $caller) {
    foreach (['00:15:65:AA:BB:CD', '00:15:65:AA:BB:CE'] as $mac) {
        resetFakes();
        check(call($app, $caller, 'POST', '/phones/rps/' . rawurlencode($mac)) === [409, ''] && logged('rps') === [], "a phone without a first access URL reached the redirection service: $mac");
    }
    foreach (['00:15:65:AA:BB:CC..', '..', '00:15:65:AA:BB:CC?x=1', '00:15:65:AA:BB:CC#x', '00:15:65:AA:BB', '00:15:65:AA:BB:CC:DD', 'zz:15:65:AA:BB:CC', '00:15:65:AA:BB:CCx', ' 00:15:65:AA:BB:CC', "00:15:65:AA:BB:CC\n"] as $mac) {
        resetFakes();
        check(call($app, $caller, 'POST', '/phones/rps/' . rawurlencode($mac), $caller === $superadmin ? ['url' => 'https://provisioning.example.test/abc/{mac}.cfg'] : null) === [400, ''] && logged('rps') === [] && logged('tancredi') === [], 'the MAC ' . json_encode($mac) . ' reached the redirection service');
    }
}

echo "PASS: the superadmin keeps the answers of main, limited administrators get the new checks\n";
