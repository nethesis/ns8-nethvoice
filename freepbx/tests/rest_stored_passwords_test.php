<?php
// SPDX-License-Identifier: GPL-3.0-or-later

$rest = __DIR__ . '/../var/www/html/freepbx/rest';
require $rest . '/vendor/autoload.php';
require $rest . '/lib/JsonResponse.php';
require $rest . '/lib/Permissions.php';
require_once $rest . '/lib/libSecurity.php';

use Slim\Psr7\Factory\ResponseFactory;
use Slim\Psr7\Factory\ServerRequestFactory;

function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}

class NethCTI {
    public static ?ConnectionsTable $pdo = null;
    public static function Database() { return self::$pdo; }
}

class ConnectionsTable {
    public array $rows = [];
    public function prepare($sql) { return new ConnectionsStatement($this, $sql); }
}

class ConnectionsStatement {
    private array $result = [];
    public function __construct(private ConnectionsTable $table, private string $sql) {}
    public function execute($args = []) {
        if ($this->sql === 'SELECT * FROM user_dbconn') {
            $this->result = array_values($this->table->rows);
        } elseif ($this->sql === 'SELECT * FROM user_dbconn WHERE id = ?') {
            $this->result = isset($this->table->rows[$args[0]]) ? [$this->table->rows[$args[0]]] : [];
        } elseif (preg_match('/^UPDATE user_dbconn SET (.+) WHERE id = \?$/', $this->sql, $match)) {
            $id = array_pop($args);
            foreach (explode(', ', $match[1]) as $i => $assignment) {
                check(preg_match('/^(host|port|type|user|pass|name) = \?$/', $assignment, $field) === 1, "unexpected assignment: $assignment");
                $this->table->rows[$id][$field[1]] = $args[$i];
            }
        } else {
            throw new RuntimeException("unexpected query: {$this->sql}");
        }
        return true;
    }
    public function fetch($mode = null) { return $this->result[0] ?? false; }
    public function fetchAll($mode = null) { return $this->result; }
}

class FreePBX {
    public static ?StreamingTable $pdo = null;
    public static function Database() { return self::$pdo; }
}

class StreamingTable {
    public array $sources = [];
    public array $permissions = [];
    public array $profiles = [];
    public function prepare($sql) { return new StreamingStatement($this, $sql); }
}

class StreamingStatement {
    private array $result = [];
    public function __construct(private StreamingTable $table, private string $sql) {}
    public function execute($args = []) {
        if ($this->sql === 'SELECT * FROM rest_cti_streaming') {
            $this->result = $this->table->sources;
        } elseif ($this->sql === 'SELECT id FROM rest_cti_permissions WHERE name=?') {
            $this->result = isset($this->table->permissions[$args[0]]) ? [['id' => $this->table->permissions[$args[0]]]] : [];
        } elseif ($this->sql === 'SELECT profile_id FROM rest_cti_profiles_permissions WHERE permission_id=?') {
            $this->result = array_map(fn($id) => ['profile_id' => $id], $this->table->profiles[$args[0]] ?? []);
        } else {
            throw new RuntimeException("unexpected query: {$this->sql}");
        }
        return true;
    }
    public function fetchAll($mode = null) { return $this->result; }
}

class RouteCollector {
    public array $routes = [];
    public function __call($method, $arguments) { $this->routes[strtoupper($method) . ' ' . $arguments[0]] = $arguments[1]; }
}

class RouteArguments {
    public function __construct(private array $arguments) {}
    public function getArgument($name) { return $this->arguments[$name] ?? null; }
}

function resetConnections() {
    NethCTI::$pdo = new ConnectionsTable();
    NethCTI::$pdo->rows = [
        5 => ['id' => 5, 'host' => 'crm.example.com', 'port' => '3306', 'type' => 'mysql', 'user' => 'crm', 'pass' => 'stored-password', 'name' => 'crm', 'creation' => '2026-01-01'],
        6 => ['id' => 6, 'host' => 'erp.example.com', 'port' => '1433', 'type' => 'mssql:7_4', 'user' => 'erp', 'pass' => '', 'name' => 'erp', 'creation' => '2026-01-01'],
    ];
}

function storedConnection($id) {
    $row = NethCTI::$pdo->rows[$id];
    return ['host' => $row['host'], 'port' => $row['port'], 'type' => $row['type'], 'user' => $row['user'], 'pass' => $row['pass'], 'name' => $row['name']];
}

function call($app, $route, array $permissions, $body = null, array $arguments = []) {
    [$method] = explode(' ', $route, 2);
    $request = (new ServerRequestFactory())->createServerRequest($method, '/freepbx/rest')
        ->withAttribute(NETHVOICE_PERMISSIONS_ATTRIBUTE, $permissions)
        ->withAttribute('route', new RouteArguments($arguments));
    if ($body !== null) {
        $request = $request->withParsedBody($body);
    }
    $response = $app->routes[$route]($request, (new ResponseFactory())->createResponse(), $arguments);
    return [$response->getStatusCode(), json_decode((string) $response->getBody(), true)];
}

$app = new RouteCollector();
$cwd = getcwd();
chdir(sys_get_temp_dir());
$level = error_reporting(E_ALL & ~E_WARNING);
require $rest . '/modules/cti.php';
error_reporting($level);
chdir($cwd);

foreach (['GET /cti/dbconn', 'PUT /cti/dbconn/{id}', 'POST /cti/dbconn/test'] as $route) {
    check(isset($app->routes[$route]), "$route is not registered");
}

resetConnections();
[$status, $body] = call($app, 'GET /cti/dbconn', ['integrations']);
check($status === 200 && count($body) === 2, 'the connections are not listed');
check(!str_contains(json_encode($body), 'stored-password'), 'the password is returned to a limited administrator');
check(!array_key_exists('pass', $body[0]) && $body[0]['has_password'] === true && $body[1]['has_password'] === false, 'has_password is wrong');
check($body[0]['host'] === 'crm.example.com' && $body[0]['user'] === 'crm', 'the other fields are not returned');

[, $body] = call($app, 'GET /cti/dbconn', ['superadmin']);
check($body[0]['pass'] === 'stored-password' && $body[0]['has_password'] === true, 'the legacy wizard of the superadmin lost the password');

[$status] = call($app, 'PUT /cti/dbconn/{id}', ['integrations'], ['host' => 'crm.example.com', 'port' => '3306', 'type' => 'mysql', 'user' => 'reader', 'pass' => '', 'name' => 'crm2'], ['id' => '5']);
check($status === 200, 'an update without password failed');
check(storedConnection(5) === ['host' => 'crm.example.com', 'port' => '3306', 'type' => 'mysql', 'user' => 'reader', 'pass' => 'stored-password', 'name' => 'crm2'], 'an empty password did not keep the stored one');

[$status] = call($app, 'PUT /cti/dbconn/{id}', ['integrations'], ['user' => 'writer'], ['id' => '5']);
check($status === 200 && storedConnection(5)['pass'] === 'stored-password' && storedConnection(5)['user'] === 'writer', 'an omitted password did not keep the stored one');

[$status] = call($app, 'PUT /cti/dbconn/{id}', ['integrations'], ['pass' => ''], ['id' => '5']);
check($status === 200 && storedConnection(5)['pass'] === 'stored-password', 'an update with only an empty password changed the connection');

[$status, $body] = call($app, 'PUT /cti/dbconn/{id}', ['integrations'], ['host' => 'attacker.example.org', 'pass' => ''], ['id' => '5']);
check($status === 400 && $body['message'] === CTI_DBCONN_PASSWORD_REQUIRED, 'the stored password was moved to another host');
check(storedConnection(5)['host'] === 'crm.example.com', 'the refused update changed the connection');

[$status] = call($app, 'PUT /cti/dbconn/{id}', ['integrations'], ['host' => 'crm2.example.com', 'pass' => 'new-password'], ['id' => '5']);
check($status === 200 && storedConnection(5)['host'] === 'crm2.example.com' && storedConnection(5)['pass'] === 'new-password', 'a typed password was not saved');

[$status] = call($app, 'PUT /cti/dbconn/{id}', ['integrations'], ['host' => 'erp2.example.com', 'pass' => ''], ['id' => '6']);
check($status === 200 && storedConnection(6)['host'] === 'erp2.example.com' && storedConnection(6)['pass'] === '', 'a connection without password could not change host');

[$status] = call($app, 'PUT /cti/dbconn/{id}', ['integrations'], ['secret' => 'x'], ['id' => '5']);
check($status === 400, 'an unknown field was accepted');

resetConnections();
$test = ['host' => 'attacker.example.org', 'port' => '3306', 'type' => 'mysql', 'user' => 'crm', 'pass' => '', 'name' => 'crm', 'id' => '5'];
[$status, $body] = call($app, 'POST /cti/dbconn/test', ['integrations'], $test);
check($status === 400 && $body['message'] === CTI_DBCONN_PASSWORD_REQUIRED, 'the stored password was tested against another host');

putenv('NETHCTI_SERVER_API_PORT');
unset($_ENV['NETHCTI_SERVER_API_PORT']);
[$status, $body] = call($app, 'POST /cti/dbconn/test', ['integrations'], ['host' => 'crm.example.com'] + $test);
check($status === 502 && $body['message'] === 'Cannot reach the CTI server', 'a test without CTI server did not fail');

[$status] = call($app, 'POST /cti/dbconn/test', ['integrations'], ['id' => '99'] + $test);
check($status === 404, 'a missing connection was tested');

[$status, $body] = call($app, 'POST /cti/dbconn/test', ['integrations'], ['host' => ''] + $test);
check($status === 400 && $body['message'] === 'Missing value: host', 'a test without host was accepted');

[$status] = call($app, 'POST /cti/dbconn/test', ['integrations']);
check($status === 400, 'a test without body was accepted');

check(ctiStoredDbConnection(NethCTI::$pdo, '5')['pass'] === 'stored-password', 'the stored connection is not read');
check(ctiStoredDbConnection(NethCTI::$pdo, '5 OR 1=1') === null && ctiStoredDbConnection(NethCTI::$pdo, ['5']) === null, 'an invalid id was accepted');

check(isset($app->routes['GET /cti/streaming']), 'GET /cti/streaming is not registered');
FreePBX::$pdo = new StreamingTable();
FreePBX::$pdo->sources = [
    ['descr' => 'Front door', 'url' => 'http://camera:stream-password@192.0.2.10/snapshot.jpg', 'user' => 'camera', 'secret' => 'stored-secret', 'frame-rate' => 1000, 'exten' => 390, 'open' => '*9'],
    ['descr' => 'Warehouse', 'url' => 'http://192.0.2.20/image.jpg', 'user' => '', 'secret' => '', 'frame-rate' => 1000, 'exten' => null, 'open' => ''],
];
FreePBX::$pdo->permissions = ['vs_front_door' => 7];
FreePBX::$pdo->profiles = [7 => [1, 3]];
$streaming = $app->routes['GET /cti/streaming'];
$request = fn(array $permissions) => (new ServerRequestFactory())->createServerRequest('GET', '/freepbx/rest')
    ->withAttribute(NETHVOICE_PERMISSIONS_ATTRIBUTE, $permissions);

$superadmin = $streaming($request(['superadmin']), (new ResponseFactory())->createResponse(), []);
$legacy = FreePBX::$pdo->sources;
$legacy[0]['profiles'] = ['1', '3'];
$legacy[1]['profiles'] = [];
check($superadmin->getStatusCode() === 200 && (string) $superadmin->getBody() === json_encode($legacy), 'the video sources of the superadmin changed');

$limited = $streaming($request(['integrations']), (new ResponseFactory())->createResponse(), []);
$body = json_decode((string) $limited->getBody(), true);
check($limited->getStatusCode() === 200 && count($body) === 2, 'the video sources are not listed');
check(!str_contains((string) $limited->getBody(), 'stored-secret'), 'the stored secret of a video source is returned to a limited administrator');
check(!array_key_exists('secret', $body[0]) && $body[0]['has_password'] === true && $body[1]['has_password'] === false, 'has_password of the video sources is wrong');
check($body[0]['user'] === 'camera' && $body[0]['url'] === $legacy[0]['url'] && $body[0]['profiles'] === ['1', '3'], 'the other fields of the video sources are not returned');

foreach ([
    'jpeg' => "\xff\xd8\xff\xe0\x00\x10JFIF",
    'png' => "\x89PNG\r\n\x1a\n\x00\x00\x00\x0dIHDR",
    'gif87a' => "GIF87a\x01\x00\x01\x00",
    'gif89a' => "GIF89a\x01\x00\x01\x00",
] as $name => $image) {
    check(ctiIsImage($image), "a $name image was refused");
}
foreach ([
    'html' => '<!DOCTYPE html><html><body>login</body></html>',
    'json' => '{"error":"unauthorized"}',
    'empty' => '',
    'truncated jpeg' => "\xff\xd8",
    'png without its header' => 'PNG image',
    'gif of another version' => 'GIF90a',
    'image after text' => " \x89PNG\r\n\x1a\n",
    'not a string' => false,
] as $name => $content) {
    check(!ctiIsImage($content), "a $name content was accepted as an image");
}

echo "PASS: database connection passwords are write-only for limited administrators and stay with their server\n";
