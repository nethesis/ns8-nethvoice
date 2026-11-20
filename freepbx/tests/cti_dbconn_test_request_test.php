<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Check what the database connection test sends to the CTI server and how it reads the answer.

$rest = getenv('NETHVOICE_REST_DIR') ?: __DIR__ . '/../var/www/html/freepbx/rest';
require $rest . '/vendor/autoload.php';
require $rest . '/lib/JsonResponse.php';

function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}

class FreePBX {
    public static function Database() {
        return new class {
            public function query($sql) {
                return new class { public function fetchColumn() { return 'invented-password-hash'; } };
            }
        };
    }
}

class RouteCollector {
    public function __call($method, $arguments) {}
}

$app = new RouteCollector();
$cwd = getcwd();
chdir(sys_get_temp_dir());
$level = error_reporting(E_ALL & ~E_WARNING);
require $rest . '/modules/cti.php';
error_reporting($level);
chdir($cwd);

$directory = sys_get_temp_dir() . '/cti-dbconn-test-' . getmypid();
mkdir($directory);
file_put_contents("$directory/router.php", '<?php
$directory = ' . var_export($directory, true) . ';
file_put_contents("$directory/request.json", json_encode([
    "method" => $_SERVER["REQUEST_METHOD"],
    "path" => $_SERVER["REQUEST_URI"],
    "user" => $_SERVER["HTTP_USER"] ?? null,
    "secretkey" => $_SERVER["HTTP_SECRETKEY"] ?? null,
    "type" => $_SERVER["CONTENT_TYPE"] ?? null,
    "body" => file_get_contents("php://input"),
]));
http_response_code((int) file_get_contents("$directory/status"));
echo "{}";
');
$socket = stream_socket_server('tcp://127.0.0.1:0');
$port = (int) substr(strrchr(stream_socket_get_name($socket, false), ':'), 1);
fclose($socket);
$server = proc_open([PHP_BINARY, '-S', "127.0.0.1:$port", "$directory/router.php"], [['pipe', 'r'], ['file', '/dev/null', 'w'], ['pipe', 'w']], $pipes);
register_shutdown_function(function () use ($server, $directory) {
    proc_terminate($server);
    proc_close($server);
    array_map('unlink', glob("$directory/*"));
    rmdir($directory);
});
check(str_contains((string) fgets($pipes[2]), 'started'), 'the fake CTI server did not start');

ini_set('error_log', '/dev/null');
$_ENV['NETHVOICESECRETKEY'] = 'invented-secret';
$_ENV['NETHCTI_SERVER_API_PORT'] = (string) $port;
$connection = ['host' => '192.0.2.10', 'port' => '3306', 'type' => 'mysql', 'user' => 'crm', 'pass' => 'p"a s#s&ö', 'name' => 'crm'];
foreach ([200 => true, 503 => false, 500 => null, 401 => null, 404 => null] as $status => $expected) {
    file_put_contents("$directory/status", (string) $status);
    @unlink("$directory/request.json");
    check(ctiTestDbConnection($connection) === $expected, "the CTI answer $status was not read as " . json_encode($expected));
    $request = json_decode((string) file_get_contents("$directory/request.json"), true);
    check($request === [
        'method' => 'POST',
        'path' => '/dbconn/test',
        'user' => 'admin',
        'secretkey' => sha1('admin' . 'invented-password-hash' . 'invented-secret'),
        'type' => 'application/json',
        'body' => json_encode($connection),
    ], 'the CTI server received ' . json_encode($request));
}

$_ENV['NETHCTI_SERVER_API_PORT'] = (string) ($port === 65535 ? 65534 : $port + 1);
check(ctiTestDbConnection($connection) === null, 'an unreachable CTI server was not reported as null');
$_ENV['NETHCTI_SERVER_API_PORT'] = 'x';
check(ctiTestDbConnection($connection) === null, 'a CTI port that is not a number was not reported as null');

echo "PASS: the database connection test posts the connection to the CTI server and reads 200, 503 and the other answers\n";
