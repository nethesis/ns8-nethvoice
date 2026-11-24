<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Run GET /mobiles/{username} against a recording database: the username reaches SQL only as a bound parameter.

use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Response;

$rest = __DIR__ . '/../var/www/html/freepbx/rest';
require $rest . '/vendor/autoload.php';
require $rest . '/lib/JsonResponse.php';

function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}

class RecordingDatabase {
    public array $log = [];
    public array $mobiles = ['alice' => '00391234567'];

    public function sql($sql, $type = 'query', $mode = null) {
        $this->log[] = ['sql', $sql];
        throw new RuntimeException("unexpected sql(): $sql");
    }

    public function prepare($sql) { return new RecordingStatement($this, $sql); }
}

class RecordingStatement {
    private array $result = [];

    public function __construct(private RecordingDatabase $db, private string $sql) {}

    public function execute($params = []) {
        $this->db->log[] = ['prepare', $this->sql, $params];
        if ($this->sql !== 'SELECT rest_users.mobile FROM rest_users JOIN userman_users ON userman_users.id = rest_users.user_id WHERE userman_users.username = ?') {
            throw new RuntimeException("unexpected statement: {$this->sql}");
        }
        $this->result = isset($this->db->mobiles[$params[0]]) ? [[$this->db->mobiles[$params[0]]]] : [];
        return true;
    }

    public function fetchColumn() { return $this->result ? $this->result[0][0] : false; }
}

class FreePBX {
    public static RecordingDatabase $db;
    public static function Database() { return self::$db; }
}

class FakeRoute {
    public function __construct(private array $arguments) {}
    public function getArgument($name) { return $this->arguments[$name] ?? null; }
}

class FakeApp {
    public array $routes = [];
    public function __call($method, $args) { $this->routes[strtoupper($method) . ' ' . $args[0]] = $args[1]; }
}

$app = new FakeApp();
require $rest . '/modules/mobiles.php';

function mobile($app, string $username): array {
    FreePBX::$db = new RecordingDatabase();
    $request = (new ServerRequestFactory())->createServerRequest('GET', '/')->withAttribute('route', new FakeRoute(['username' => $username]));
    $response = $app->routes['GET /mobiles/{username}']($request, new Response(), ['username' => $username]);
    return [$response->getStatusCode(), (string) $response->getBody(), FreePBX::$db->log];
}

ini_set('error_log', '/dev/null');
[$status, $body, $log] = mobile($app, 'alice');
check($status === 200 && $body === '"00391234567"', "a stored mobile number is not returned: $status $body");
check($log === [['prepare', 'SELECT rest_users.mobile FROM rest_users JOIN userman_users ON userman_users.id = rest_users.user_id WHERE userman_users.username = ?', ['alice']]], 'unexpected queries: ' . json_encode($log));

foreach (["zz' OR SLEEP(3) OR '", "a'b", 'nobody'] as $username) {
    [$status, $body, $log] = mobile($app, $username);
    check($status === 200 && $body === 'null', "$username: expected no mobile number, got $status $body");
    check(count($log) === 1 && $log[0][0] === 'prepare' && $log[0][2] === [$username] && !str_contains($log[0][1], $username), "$username reached the SQL text: " . json_encode($log));
}

echo "PASS: GET /mobiles/{username} binds the username and keeps its answers\n";
