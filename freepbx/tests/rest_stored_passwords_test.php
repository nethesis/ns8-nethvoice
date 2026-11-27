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
        } elseif ($this->sql === 'SELECT COUNT(*) FROM user_dbconn WHERE host = ? AND port = ? AND user = ? AND name = ? AND id != ?') {
            [$host, $port, $user, $name, $except] = $args;
            $this->result = [[count(array_filter($this->table->rows, fn($row) => [$row['host'], $row['port'], $row['user'], $row['name']] === [$host, $port, $user, $name] && $row['id'] !== $except))]];
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
    public function fetchColumn() { return $this->result[0][0] ?? false; }
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

echo "PASS: database connection passwords are write-only for limited administrators and stay with their server\n";
