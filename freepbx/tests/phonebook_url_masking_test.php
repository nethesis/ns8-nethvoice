<?php
// SPDX-License-Identifier: GPL-3.0-or-later

$rest = __DIR__ . '/../var/www/html/freepbx/rest';
require $rest . '/vendor/autoload.php';
require $rest . '/lib/JsonResponse.php';
require $rest . '/lib/Permissions.php';

use Slim\Psr7\Factory\ResponseFactory;
use Slim\Psr7\Factory\ServerRequestFactory;

function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}

class RouteCollector {
    public array $routes = [];
    public function __call($method, $arguments) { $this->routes[strtoupper($method) . ' ' . $arguments[0]] = $arguments[1]; }
}

class RouteArguments {
    public function __construct(private array $arguments) {}
    public function getArgument($name) { return $this->arguments[$name] ?? null; }
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

$sandbox = sys_get_temp_dir() . '/phonebook-url-masking-test-' . getmypid();
$sources = "$sandbox/sources.d";
mkdir($sources, 0700, true);
$module = str_replace("'/etc/phonebook/sources.d", var_export($sources, true) . " . '", file_get_contents($rest . '/modules/phonebook.php'), $found);
check($found === 6, "expected six sources paths in phonebook.php, found $found");
$module = str_replace(["include_once('lib/libMiddleware.php');", "include_once('lib/libUsers.php');"], '', $module, $found);
check($found === 2, "expected the FreePBX libraries in phonebook.php, found $found");
$module = str_replace("__DIR__ . '/../lib/", var_export($rest . '/lib/', true) . " . '", $module, $found);
check($found === 1, "expected one library path relative to phonebook.php, found $found");
file_put_contents("$sandbox/phonebook.php", $module);
register_shutdown_function(function () use ($sandbox, $sources) {
    foreach (glob("$sources/*") ?: [] as $file) {
        unlink($file);
    }
    rmdir($sources);
    unlink("$sandbox/phonebook.php");
    rmdir($sandbox);
});

$app = new RouteCollector();
$cwd = getcwd();
chdir($rest);
require "$sandbox/phonebook.php";
chdir($cwd);
ini_set('error_log', '/dev/null');

$superadmin = [NETHVOICE_SUPERADMIN];
$integrator = ['integrations'];
$csvUrl = 'https://qa_reader:Url-Pass@csv.example.invalid/export?token=Qa-Token&format=csv';
$csvMasked = 'https://***@csv.example.invalid/export?token=***&format=***';
$erpUrl = 'https://qa:Qa-Erp-Url-Pass@erp.example.invalid';
$erpMasked = 'https://***@erp.example.invalid';
$csv = ['dbtype' => 'csv', 'url' => $csvUrl, 'mapping' => ['name' => 'name'], 'type' => 'QA CSV', 'access' => 'public', 'interval' => 1440, 'enabled' => true];
$erp = ['dbtype' => 'infinity', 'url' => $erpUrl, 'username' => 'qa', 'password' => 'Qa-Erp-Pass', 'type' => 'QA ERP', 'access' => 'public', 'interval' => 1440, 'enabled' => true];

function store(string $id, array $source): void {
    global $sources;
    file_put_contents("$sources/$id.json", json_encode([$id => $source]));
}

function stored(string $id): array {
    global $sources;
    return json_decode(file_get_contents("$sources/$id.json"), true)[$id];
}

store('custom_1', $csv);
store('custom_2', $erp);

[$status, $body] = call($app, 'GET /phonebook/config', $integrator);
$listed = json_decode($body, true);
check($status === 200 && $listed['custom_1']['url'] === $csvMasked && $listed['custom_2']['url'] === $erpMasked, "URLs not masked for a limited administrator: $status $body");
check(!preg_match('/Url-Pass|Qa-Token|qa_reader|Qa-Erp/', $body), "secret listed to a limited administrator: $body");
[$status, $body] = call($app, 'GET /phonebook/config', $superadmin);
$listed = json_decode($body, true);
check($status === 200 && $listed['custom_1']['url'] === $csvUrl && $listed['custom_2']['url'] === $erpUrl && $listed['custom_2']['password'] === 'Qa-Erp-Pass', "URLs of the superadmin changed: $status $body");

[$status, $body] = call($app, 'POST /phonebook/config[/{id}]', $integrator, ['url' => $csvMasked, 'type' => 'QA CSV renamed'] + $csv, ['id' => 'custom_1']);
check($status === 200, "masked URL refused: $status $body");
check(stored('custom_1')['url'] === $csvUrl && stored('custom_1')['type'] === 'QA CSV renamed', 'masked URL saved: ' . json_encode(stored('custom_1')));
check(empty(stored('custom_1')['guard_addresses']), 'unchanged URL marked for the address guard');

[$status, $body] = call($app, 'POST /phonebook/config[/{id}]', $integrator, ['url' => $erpMasked, 'password' => '', 'type' => 'QA ERP renamed'] + $erp, ['id' => 'custom_2']);
check($status === 200, "masked Infinity URL asked for the password again: $status $body");
check(stored('custom_2')['url'] === $erpUrl && stored('custom_2')['password'] === 'Qa-Erp-Pass', 'Infinity source lost its URL or password: ' . json_encode(stored('custom_2')));

[$status, $body] = call($app, 'POST /phonebook/config[/{id}]', $integrator, ['url' => 'https://***@other.example.invalid', 'password' => ''] + $erp, ['id' => 'custom_2']);
check($status === 400 && stored('custom_2')['url'] === $erpUrl, "stored password kept for another URL: $status $body");

[$status, $body] = call($app, 'POST /phonebook/config[/{id}]', $superadmin, ['url' => $csvMasked] + $csv, ['id' => 'custom_1']);
check($status === 200 && stored('custom_1')['url'] === $csvMasked, "the superadmin cannot save a URL of their choice: $status $body");

echo "PASS: phonebook source URLs masked for limited administrators and kept when saved back\n";
