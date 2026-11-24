<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Run POST /testauth with a fake FreePBX user store: failed attempts are throttled like POST /signin, successful sign-ins are not.

use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Response;

$rest = __DIR__ . '/../var/www/html/freepbx/rest';
require $rest . '/vendor/autoload.php';
require $rest . '/lib/JsonResponse.php';
require $rest . '/lib/Permissions.php';

const SECRET = 'invented-shared-secret';
const ACCOUNTS = [
    'admin' => ['Admin-Password-1', '*'],
    'qa_users' => ['Users-Password-1', 'nethvoice:users'],
    'qa_boss' => ['Boss-Password-1', 'nethvoice:superadmin'],
];

function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}

function storedAccount(string $username): ?string {
    foreach (array_keys(ACCOUNTS) as $account) {
        if (strcasecmp(rtrim($username, ' '), $account) === 0) {
            return $account;
        }
    }
    return null;
}

class FakeStatement {
    private $value = false;
    public function execute($params) { $this->value = storedAccount($params[0]) ?? false; return true; }
    public function fetchColumn() { return $this->value; }
}

class FakeDatabase {
    public function prepare($sql) {
        check($sql === 'SELECT username FROM ampusers WHERE username = ?', "unexpected query: $sql");
        return new FakeStatement();
    }
}

class FreePBX {
    public static function Database() { return new FakeDatabase(); }
}

class FakeApp {
    public array $routes = [];
    public function __call($method, $args) { $this->routes[strtoupper($method) . ' ' . $args[0]] = $args[1]; }
}

function domainAdminsClientAddress($request): string {
    return (string) ($request->getServerParams()['REMOTE_ADDR'] ?? '');
}

$sandbox = sys_get_temp_dir() . '/rest_testauth_test_' . getmypid();
mkdir("$sandbox/rest/modules", 0700, true);
mkdir("$sandbox/admin/libraries", 0700, true);
define('FAILURES_FILE', "$sandbox/signin-failures.json");
$source = str_replace(
    ["__DIR__ . '/../lib/libDomainAdmins.php'", 'domainAdminsSignInThrottle()'],
    [var_export($rest . '/lib/libDomainAdmins.php', true), 'domainAdminsSignInThrottle(FAILURES_FILE)'],
    file_get_contents("$rest/modules/authentication.php"),
    $count
);
check($count === 2, "authentication.php: unexpected number of replacements ($count)");
file_put_contents("$sandbox/rest/modules/authentication.php", $source);
file_put_contents("$sandbox/rest/config.inc.php", '<?php $config = ["settings" => ["secretkey" => ' . var_export(SECRET, true) . ']];');
file_put_contents("$sandbox/admin/libraries/ampuser.class.php", '<?php
class ampuser {
    private ?string $account;
    public function __construct($username) { $this->account = storedAccount($username); }
    public function checkPassword($password) { return $this->account !== null && ACCOUNTS[$this->account][0] === $password; }
    public function checkSection($section) { return $this->account !== null && ACCOUNTS[$this->account][1] === $section; }
    public function getSections() { return $this->account === null ? "" : ACCOUNTS[$this->account][1]; }
}');
register_shutdown_function(function () use ($sandbox) {
    foreach (['rest/modules/authentication.php', 'rest/config.inc.php', 'admin/libraries/ampuser.class.php', 'signin-failures.json'] as $file) {
        @unlink("$sandbox/$file");
    }
    foreach (['rest/modules', 'rest', 'admin/libraries', 'admin', ''] as $dir) {
        rmdir("$sandbox/$dir");
    }
});

$app = new FakeApp();
require "$sandbox/rest/modules/authentication.php";
ini_set('session.save_path', $sandbox);
ini_set('session.use_cookies', '0');

function testauth($app, $username, string $password, string $address = '192.0.2.10'): Response {
    $request = (new ServerRequestFactory())->createServerRequest('POST', '/freepbx/rest/testauth', ['REMOTE_ADDR' => $address])
        ->withParsedBody(['username' => $username, 'password' => $password]);
    $level = error_reporting(E_ALL & ~E_WARNING);
    try {
        return $app->routes['POST /testauth']($request, new Response(), []);
    } finally {
        error_reporting($level);
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_destroy();
        }
    }
}

$ok = testauth($app, 'admin', 'Admin-Password-1');
check($ok->getStatusCode() === 200 && json_decode((string) $ok->getBody(), true) === ['result' => SECRET], 'the superadmin must sign in as before: ' . $ok->getStatusCode());
check(!file_exists(FAILURES_FILE) || json_decode((string) file_get_contents(FAILURES_FILE), true) === [], 'a successful sign-in must not be counted');
for ($i = 0; $i < 20; $i++) {
    check(testauth($app, 'admin', 'Admin-Password-1')->getStatusCode() === 200, 'repeated successful sign-ins must not be throttled');
}

for ($i = 0; $i < DOMAIN_ADMINS_FAILURES_PER_ACCOUNT; $i++) {
    check(testauth($app, 'admin', 'wrong')->getStatusCode() === 401, 'a wrong password must be refused');
}
foreach (['admin', 'ADMIN', 'admin  '] as $username) {
    $throttled = testauth($app, $username, 'Admin-Password-1');
    check($throttled->getStatusCode() === 429 && $throttled->getHeaderLine('Retry-After') === (string) DOMAIN_ADMINS_FAILURE_WINDOW, json_encode($username) . ' must be throttled after repeated failures, got ' . $throttled->getStatusCode());
    check(json_decode((string) $throttled->getBody(), true)['code'] === 'too_many_attempts', 'unexpected throttle body: ' . $throttled->getBody());
}
check(testauth($app, 'admin', 'Admin-Password-1', '192.0.2.11')->getStatusCode() === 200, 'another address must not be throttled');
$boss = testauth($app, 'qa_boss', 'Boss-Password-1');
check($boss->getStatusCode() === 200 && json_decode((string) $boss->getBody(), true) === ['result' => SECRET], 'a NethVoice superadmin must receive the secret: ' . $boss->getStatusCode());
for ($i = 0; $i < DOMAIN_ADMINS_FAILURES_PER_ACCOUNT + 1; $i++) {
    $limited = testauth($app, 'qa_users', 'Users-Password-1');
    check($limited->getStatusCode() === 401 && !str_contains((string) $limited->getBody(), SECRET), 'an administrator who is not superadmin received the secret: ' . $limited->getStatusCode() . ' ' . $limited->getBody());
}
check(testauth($app, 'qa_users', 'wrong')->getStatusCode() === 401, 'the correct password of a limited administrator must not be counted as a failure');

for ($i = 0; $i < DOMAIN_ADMINS_FAILURES_PER_ADDRESS; $i++) {
    testauth($app, 'sprayed' . $i, 'Common-Password-1', '198.51.100.7');
}
check(testauth($app, 'qa_users', 'Users-Password-1', '198.51.100.7')->getStatusCode() === 429, 'too many failures from one address must throttle every account');
check(testauth($app, ['admin'], 'Admin-Password-1', '198.51.100.9')->getStatusCode() === 401, 'a username that is not a string must be refused');
check(testauth($app, '', 'x', '198.51.100.9')->getStatusCode() === 401, 'an empty username must be refused');

echo "PASS: POST /testauth throttles failures per address and account and per address, keeps successful sign-ins, gives the secret only to superadmins\n";
