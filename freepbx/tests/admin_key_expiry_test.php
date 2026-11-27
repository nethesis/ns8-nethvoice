<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Lifetime, rotation and fail-closed re-read of the keys of the administrators from the user domain.

$rest = __DIR__ . '/../var/www/html/freepbx/rest';
require $rest . '/vendor/autoload.php';
require $rest . '/lib/libDomainAdmins.php';
require $rest . '/lib/AuthMiddleware.php';
require __DIR__ . '/../../tancredi/usr/share/tancredi/src/Entity/NethVoiceAuth.php';

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Slim\Factory\AppFactory;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Response;
use Tancredi\Entity\NethVoiceAuth;

const SECRET = 'invented-shared-secret';
const PASSWORD = 'Invented-Secret-42!';
const DOMAIN = 'ns8.example.org';

function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}

function reply(int $status, $data): array {
    return ['status' => $status, 'body' => is_string($data) ? $data : json_encode($data)];
}

function groups(array $groups): array {
    return reply(200, ['status' => 'success', 'message' => 'groups_listed', 'groups' => $groups]);
}

function users(array $users): array {
    return reply(200, ['status' => 'success', 'message' => 'users_listed', 'users' => array_map(
        fn($user) => is_array($user) ? $user : ['user' => $user, 'display_name' => ucfirst($user), 'locked' => false],
        $users
    )]);
}

class FreePBX {
    public static ?PDO $db = null;
    public static function Database() { return self::$db; }
}

class Fixture {
    public PDO $db;
    public array $responses = [];
    public array $accounts = [];
    public array $expiration = ['status' => 'success', 'expired' => false, 'must_change' => false];
    public string $url = 'https://users-admin.example.org/api';
    public ?string $prefix = 'nethvoice3';
    public int $now;
    public int $randoms = 0;
    public string $directory;

    public function __construct() {
        $this->now = time();
        $this->db = new PDO('sqlite::memory:');
        $this->db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->db->exec("CREATE TABLE ampusers (username TEXT NOT NULL COLLATE NOCASE PRIMARY KEY, password_sha1 TEXT NOT NULL, extension_low TEXT NOT NULL DEFAULT '', extension_high TEXT NOT NULL DEFAULT '', deptname TEXT NOT NULL DEFAULT '', sections BLOB NOT NULL, email TEXT DEFAULT '', extension TEXT DEFAULT '')");
        $this->db->exec("CREATE TABLE rest_domain_admins (username TEXT NOT NULL COLLATE NOCASE PRIMARY KEY, domain TEXT NOT NULL, created_at TEXT NOT NULL, synced_at TEXT NULL, key_issued_at TEXT NULL)");
        $this->local('admin', 'Admin-Password-1', '*');
        $this->local('qa_trunks', 'Trunks-Password-1', 'nethvoice:trunks');
        $this->directory = sys_get_temp_dir() . '/admin-key-' . bin2hex(random_bytes(6));
        mkdir($this->directory);
        $this->responses['list-users'] = users(['alice', 'Bob']);
        $this->responses['list-groups'] = groups([
            ['group' => 'domain admins', 'description' => '', 'users' => ['Bob']],
            ['group' => 'nethvoice3-phones', 'description' => '', 'users' => ['alice']],
        ]);
        $this->accounts = [
            'alice' => ['uid' => 'alice', 'groups' => ['nethvoice3-phones']],
            'bob' => ['uid' => 'Bob', 'groups' => ['domain admins']],
        ];
        FreePBX::$db = $this->db;
    }

    public function local(string $username, string $password, string $sections): void {
        $this->db->prepare('INSERT INTO ampusers (username, password_sha1, sections) VALUES (?, ?, ?)')->execute([$username, sha1($password), $sections]);
    }

    public function admins(): DomainAdmins {
        $client = new UsersAdminClient($this->url, fn() => 'invented-token', function (string $url, array $payload, string $token) {
            $handler = substr($url, strrpos($url, '/') + 1);
            return $this->responses[$handler] ?? reply(200, ['status' => 'success', 'message' => 'ok']);
        });
        $portal = $this->url === '' ? null : function (string $handler, array $payload, string $token) {
            if ($handler === 'login') {
                $account = $this->accounts[strtolower($payload['username'])] ?? null;
                if ($account === null || $payload['password'] !== PASSWORD) {
                    return ['status' => 401, 'data' => ['code' => 401, 'message' => 'incorrect Username or Password']];
                }
                return ['status' => 200, 'data' => ['code' => 200, 'token' => 'user-token-' . $account['uid'], 'claims' => ['uid' => $account['uid'], 'groups' => $account['groups'], 'scope' => []]]];
            }
            return ['status' => 200, 'data' => $this->expiration];
        };
        return new DomainAdmins(
            $this->db, SECRET, $client, $portal, $this->prefix, DOMAIN, 'voice.example.org',
            $this->directory . '/domain-admins.lock', $this->directory . '/signin-failures.json',
            fn() => $this->now,
            function () { $this->randoms++; return str_repeat(dechex($this->randoms % 16), 40); }
        );
    }

    public function signIn(string $username): array {
        return $this->admins()->signIn(['username' => $username, 'password' => PASSWORD], '192.0.2.10');
    }

    public function column(string $sql, string $username) {
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$username]);
        return $stmt->fetchColumn();
    }

    public function hash(string $username): string {
        return (string) $this->column('SELECT password_sha1 FROM ampusers WHERE username = ?', $username);
    }

    public function sections(string $username): string {
        return (string) $this->column('SELECT sections FROM ampusers WHERE username = ?', $username);
    }

    public function issuedAt(string $username) {
        return $this->column('SELECT key_issued_at FROM rest_domain_admins WHERE username = ?', $username);
    }

    public function age(string $username, int $seconds): void {
        $this->db->prepare('UPDATE rest_domain_admins SET key_issued_at = ? WHERE username = ?')->execute([gmdate('Y-m-d H:i:s', time() - $seconds), $username]);
    }

    public function syncedAgo(string $username, int $seconds): void {
        $this->db->prepare('UPDATE rest_domain_admins SET synced_at = ? WHERE username = ?')->execute([gmdate('Y-m-d H:i:s', $this->now - $seconds), $username]);
    }

    public function cleanup(): void {
        foreach (glob($this->directory . '/*') as $file) { unlink($file); }
        rmdir($this->directory);
    }
}

function restApp(): \Slim\App {
    $app = AppFactory::create();
    $app->setBasePath('/freepbx/rest');
    $app->get('/me', fn($req, $res) => $res->withStatus(200));
    $app->addRoutingMiddleware();
    $app->add(new AuthMiddleware(SECRET, $app->getResponseFactory()));
    $app->addErrorMiddleware(false, false, false);
    return $app;
}

function restCall(string $user, string $key): ResponseInterface {
    $request = (new ServerRequestFactory())->createServerRequest('GET', '/freepbx/rest/me')->withHeader('User', $user)->withHeader('Secretkey', $key);
    return restApp()->handle($request);
}

class TancrediAuth extends NethVoiceAuth {
    protected function findUser(string $username): array {
        $stmt = FreePBX::$db->prepare('SELECT a.*, d.username AS nethvoice_managed, d.key_issued_at AS nethvoice_key_issued_at FROM ampusers a LEFT JOIN rest_domain_admins d ON d.username = a.username WHERE a.username = ?');
        $stmt->execute([$username]);
        return $stmt->fetchAll();
    }
}

class OkHandler implements RequestHandlerInterface {
    public function handle(ServerRequestInterface $request): ResponseInterface {
        $response = new Response(200);
        $response->getBody()->write('[]');
        return $response->withHeader('Content-Type', 'application/json');
    }
}

function tancrediCall(string $user, string $key): int {
    $request = (new ServerRequestFactory())->createServerRequest('GET', 'http://localhost/tancredi/api/v1/phones')->withHeader('User', $user)->withHeader('Secretkey', $key);
    return (new TancrediAuth(['secret' => SECRET, 'static_token' => 'static-token']))->process($request, new OkHandler())->getStatusCode();
}

$tests = [];

$tests['the key of a domain administrator is accepted for 12 hours and then refused with 401'] = function () {
    $f = new Fixture();
    $key = $f->signIn('alice')[1]['secretkey'];
    check(is_string($f->issuedAt('alice')) && $f->issuedAt('alice') === gmdate('Y-m-d H:i:s', $f->now), 'sign-in must store when the key was issued: ' . json_encode($f->issuedAt('alice')));
    check(restCall('alice', $key)->getStatusCode() === 200, 'a fresh key must be accepted');
    check(tancrediCall('alice', $key) === 200, 'Tancredi must accept a fresh key');

    $f->age('alice', NETHVOICE_ADMIN_KEY_LIFETIME - 60);
    check(restCall('alice', $key)->getStatusCode() === 200, 'a key just before the lifetime must be accepted');

    $f->age('alice', NETHVOICE_ADMIN_KEY_LIFETIME + 1);
    $expired = restCall('alice', $key);
    check($expired->getStatusCode() === 401, 'an old key must be refused with 401, got ' . $expired->getStatusCode());
    check(json_decode((string) $expired->getBody(), true)['code'] === 'session_expired', 'the refusal must say the session expired: ' . $expired->getBody());
    check(tancrediCall('alice', $key) === 403, 'Tancredi must refuse an old key');

    $f->db->prepare('UPDATE rest_domain_admins SET key_issued_at = NULL WHERE username = ?')->execute(['alice']);
    check(restCall('alice', $key)->getStatusCode() === 401, 'a key without issue time must be refused');
    check(restCall('alice', 'wrong')->getStatusCode() === 403, 'a wrong key must keep its 403');
    $f->cleanup();
};

$tests['the keys of local administrators never expire'] = function () {
    $f = new Fixture();
    check(restCall('admin', sha1('admin' . sha1('Admin-Password-1') . SECRET))->getStatusCode() === 200, 'the local admin must keep working');
    check(restCall('qa_trunks', sha1('qa_trunks' . sha1('Trunks-Password-1') . SECRET))->getStatusCode() === 200, 'a local limited admin must keep working');
    check(tancrediCall('admin', sha1('admin' . sha1('Admin-Password-1') . SECRET)) === 200, 'Tancredi must keep accepting the local admin');
    $f->cleanup();
};

$tests['a new sign-in reuses a recent key and renews an old one'] = function () {
    $f = new Fixture();
    $first = $f->signIn('alice')[1]['secretkey'];
    $f->now += DOMAIN_ADMINS_KEY_RENEW_AFTER - 1;
    $f->db->prepare('UPDATE rest_domain_admins SET key_issued_at = ? WHERE username = ?')->execute([gmdate('Y-m-d H:i:s', $f->now - DOMAIN_ADMINS_KEY_RENEW_AFTER + 1), 'alice']);
    $again = $f->signIn('alice')[1]['secretkey'];
    check($again === $first && $f->randoms === 1, 'a recent key must be reused so other open sessions keep working');

    $f->db->prepare('UPDATE rest_domain_admins SET key_issued_at = ? WHERE username = ?')->execute([gmdate('Y-m-d H:i:s', $f->now - DOMAIN_ADMINS_KEY_RENEW_AFTER), 'alice']);
    $renewed = $f->signIn('alice')[1]['secretkey'];
    check($renewed !== $first && $f->randoms === 2, 'an old key must be replaced');
    check($renewed === sha1('alice' . $f->hash('alice') . SECRET), 'the new key must match the stored hash');
    check($f->issuedAt('alice') === gmdate('Y-m-d H:i:s', $f->now), 'the issue time must be renewed');

    $f->db->prepare('UPDATE rest_domain_admins SET key_issued_at = NULL WHERE username = ?')->execute(['alice']);
    $upgraded = $f->signIn('alice')[1]['secretkey'];
    check($upgraded !== $renewed && $f->issuedAt('alice') !== null, 'a row without issue time must get a new key');
    $f->cleanup();
};

$tests['sign-out replaces the key of a domain administrator only'] = function () {
    $f = new Fixture();
    $key = $f->signIn('alice')[1]['secretkey'];
    $f->admins()->signOut('ALICE');
    check(sha1('alice' . $f->hash('alice') . SECRET) !== $key, 'sign-out must replace the key');
    check($f->issuedAt('alice') === null, 'sign-out must clear the issue time');
    check(restCall('alice', $key)->getStatusCode() === 403, 'the old key must stop working');
    $again = $f->signIn('alice')[1]['secretkey'];
    check($again !== $key && restCall('alice', $again)->getStatusCode() === 200, 'a new sign-in must work after sign-out');

    $admin = $f->hash('admin');
    $trunks = $f->hash('qa_trunks');
    $f->admins()->signOut('admin');
    $f->admins()->signOut('qa_trunks');
    $f->admins()->signOut('nobody');
    check($f->hash('admin') === $admin && $f->hash('qa_trunks') === $trunks, 'sign-out must never touch local administrators');
    $f->cleanup();
};

$tests['an expired password replaces the key of a domain administrator'] = function () {
    foreach ([['expired' => true], ['must_change' => true]] as $expiration) {
        $f = new Fixture();
        $key = $f->signIn('alice')[1]['secretkey'];
        $f->expiration = $expiration + ['status' => 'success'];
        check($f->signIn('alice')[1]['code'] === 'password_expired', 'the expired password must be told: ' . json_encode($expiration));
        check(restCall('alice', $key)->getStatusCode() !== 200, 'the old key must stop working: ' . json_encode($expiration));
        check($f->issuedAt('alice') === null, 'the issue time must be cleared');
        $f->cleanup();
    }
};

$tests['the re-read job withdraws the sections of rows not re-read for 10 minutes'] = function () {
    $f = new Fixture();
    $f->signIn('alice');
    $f->signIn('Bob');
    $f->responses['list-groups'] = reply(500, ['code' => 500]);

    $f->syncedAgo('alice', DOMAIN_ADMINS_SYNC_GRACE - 60);
    $f->syncedAgo('Bob', DOMAIN_ADMINS_SYNC_GRACE + 1);
    check($f->admins()->sync() === false, 'an unreadable domain must fail');
    check($f->sections('alice') === 'nethvoice:phones', 'a row re-read recently must keep its sections');
    check($f->sections('Bob') === '' && nethvoicePermissionsFor(['sections' => $f->sections('Bob')]) === [], 'a stale row must lose its sections');
    $bobKey = sha1('Bob' . $f->hash('Bob') . SECRET);
    check(restCall('Bob', $bobKey)->getStatusCode() === 403, 'a stale row must not authenticate');

    $f->syncedAgo('alice', DOMAIN_ADMINS_SYNC_GRACE + 1);
    $f->db->prepare('UPDATE rest_domain_admins SET synced_at = NULL WHERE username = ?')->execute(['Bob']);
    $f->prefix = null;
    check($f->admins()->sync() === false, 'a missing prefix must fail');
    check($f->sections('alice') === '', 'a missing prefix must also withdraw stale rows');

    $f->prefix = 'nethvoice3';
    $f->responses['list-groups'] = groups([
        ['group' => 'domain admins', 'description' => '', 'users' => ['Bob']],
        ['group' => 'nethvoice3-phones', 'description' => '', 'users' => ['alice']],
    ]);
    check($f->admins()->sync() === true, 'the re-read must succeed again');
    check($f->sections('alice') === 'nethvoice:phones' && $f->sections('Bob') === 'nethvoice:superadmin', 'a successful re-read must give the sections back');
    check(restCall('Bob', $bobKey)->getStatusCode() === 200, 'the key must work again after the re-read');

    $f->url = '';
    $f->now += DOMAIN_ADMINS_SYNC_GRACE + 1;
    check($f->admins()->sync() === true, 'an external domain must not fail');
    check($f->sections('alice') === '' && $f->sections('Bob') === '', 'an external domain must withdraw rows that cannot be re-read');
    check($f->sections('admin') === '*' && $f->sections('qa_trunks') === 'nethvoice:trunks', 'local rows must never be touched');
    $f->cleanup();
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
