<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Sign-in, Admin control and re-read job of the administrators from the user domain, against a fake users-admin and SQLite.

$rest = __DIR__ . '/../var/www/html/freepbx/rest';
require $rest . '/vendor/autoload.php';
require $rest . '/lib/libDomainAdmins.php';

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

class Fixture {
    public PDO $db;
    public array $calls = [];
    public array $portalCalls = [];
    public array $responses = [];
    public array $accounts = [];
    public array $expiration = ['status' => 'success', 'expired' => false, 'must_change' => false];
    public ?array $portalFailure = null;
    public string $token = 'invented-token';
    public string $url = 'https://users-admin.example.org/api';
    public ?string $prefix = 'nethvoice3';
    public int $now = 1000000;
    public int $randoms = 0;
    public string $directory;

    public function __construct() {
        $this->db = new PDO('sqlite::memory:');
        $this->db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->db->exec("CREATE TABLE ampusers (username TEXT NOT NULL COLLATE NOCASE PRIMARY KEY, password_sha1 TEXT NOT NULL, extension_low TEXT NOT NULL DEFAULT '', extension_high TEXT NOT NULL DEFAULT '', deptname TEXT NOT NULL DEFAULT '', sections BLOB NOT NULL, email TEXT DEFAULT '', extension TEXT DEFAULT '')");
        $this->db->exec("CREATE TABLE rest_domain_admins (username TEXT NOT NULL COLLATE NOCASE PRIMARY KEY, domain TEXT NOT NULL, created_at TEXT NOT NULL, synced_at TEXT NULL)");
        $this->local('admin', 'Admin-Password-1', '*');
        $this->local('qa_trunks', 'Trunks-Password-1', 'nethvoice:trunks');
        $this->local('support-abc123', 'Support-Password-1', '*');
        $this->local('fpbxonly', 'Fpbx-Password-1', 'core;cdr');
        $this->directory = sys_get_temp_dir() . '/domain-admins-' . bin2hex(random_bytes(6));
        mkdir($this->directory);
        $this->responses['list-users'] = users(['alice', 'Bob', 'carol', 'dave', 'administrator']);
        $this->responses['list-groups'] = groups([
            ['group' => 'domain admins', 'description' => '', 'users' => ['Bob', 'administrator']],
            ['group' => 'nethvoice3-trunks', 'description' => '', 'users' => ['alice', 'dave']],
            ['group' => 'nethvoice3-phones', 'description' => '', 'users' => ['alice']],
            ['group' => 'nethvoice-admins', 'description' => '', 'users' => ['carol']],
            ['group' => 'sales', 'description' => '', 'users' => ['carol']],
        ]);
        $this->accounts = [
            'alice' => ['uid' => 'alice', 'groups' => ['nethvoice3-trunks', 'nethvoice3-phones', 'sales']],
            'bob' => ['uid' => 'Bob', 'groups' => ['domain admins']],
            'carol' => ['uid' => 'carol', 'groups' => ['nethvoice-admins', 'sales']],
            'erin' => ['uid' => 'erin', 'groups' => ['NethVoice3-Admins']],
        ];
    }

    public function local(string $username, string $password, string $sections): void {
        $this->db->prepare('INSERT INTO ampusers (username, password_sha1, sections) VALUES (?, ?, ?)')->execute([$username, sha1($password), $sections]);
    }

    public function admins(): DomainAdmins {
        $client = new UsersAdminClient($this->url, fn() => $this->token, function (string $url, array $payload, string $token) {
            $handler = substr($url, strrpos($url, '/') + 1);
            $this->calls[] = [$handler, $payload];
            return $this->responses[$handler] ?? reply(200, ['status' => 'success', 'message' => 'ok']);
        });
        $portal = $this->url === '' ? null : function (string $handler, array $payload, string $token) {
            $this->portalCalls[] = [$handler, $payload, $token];
            if ($this->portalFailure !== null) {
                return $this->portalFailure;
            }
            if ($handler === 'login') {
                $account = $this->accounts[strtolower($payload['username'])] ?? null;
                if ($account === null || $payload['password'] !== PASSWORD) {
                    return ['status' => 401, 'data' => ['code' => 401, 'message' => 'incorrect Username or Password']];
                }
                return ['status' => 200, 'data' => ['code' => 200, 'token' => 'user-token-' . $account['uid'], 'claims' => ['uid' => $account['uid'], 'groups' => $account['groups'], 'scope' => ['change-password']]]];
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

    public function row(string $username): ?array {
        $stmt = $this->db->prepare('SELECT username, password_sha1, sections FROM ampusers WHERE username = ?');
        $stmt->execute([$username]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row === false ? null : $row;
    }

    public function managed(): array {
        return $this->db->query('SELECT username, domain FROM rest_domain_admins ORDER BY username')->fetchAll(PDO::FETCH_KEY_PAIR);
    }

    public function writes(): array {
        return array_values(array_filter($this->calls, fn($call) => !in_array($call[0], ['list-users', 'list-groups'], true)));
    }

    public function cleanup(): void {
        foreach (glob($this->directory . '/*') as $file) { unlink($file); }
        rmdir($this->directory);
    }
}

function signIn(Fixture $f, string $username, string $password, string $address = '192.0.2.10'): array {
    return $f->admins()->signIn(['username' => $username, 'password' => $password], $address);
}

$tests = [];

$tests['the sections of the group names are the sections of the permissions'] = function () {
    check(USERS_ADMIN_SECTIONS === NETHVOICE_SECTIONS, 'the section lists differ');
    foreach (['nethvoice', 'nethvoice3', 'nethvoice-sales', 'nethvoice1a'] as $prefix) {
        check(preg_match(USERS_ADMIN_GROUP_PREFIX_PATTERN, $prefix) === 1, "$prefix must be a valid prefix");
        foreach (usersAdminOwnGroups($prefix) as $group) {
            check(preg_match(USERS_ADMIN_NETHVOICE_GROUP_PATTERN, $group) === 1, "$group must be recognized as a NethVoice group");
        }
    }
    foreach (['', 'NethVoice', 'voice3', 'nethvoice-', 'nethvoice3_x', 'nethvoice-' . str_repeat('a', 30)] as $prefix) {
        check(preg_match(USERS_ADMIN_GROUP_PREFIX_PATTERN, $prefix) !== 1, "$prefix must be refused");
    }
};

$tests['a local administrator signs in with the key of the previous client'] = function () {
    $f = new Fixture();
    $result = signIn($f, 'admin', 'Admin-Password-1');
    check($result === [200, ['user' => 'admin', 'secretkey' => sha1('admin' . sha1('Admin-Password-1') . SECRET), 'permissions' => ['superadmin'], 'source' => 'local'], []], 'unexpected answer: ' . json_encode($result));
    check(signIn($f, 'qa_trunks', 'Trunks-Password-1')[1]['permissions'] === ['trunks'], 'a local limited administrator must get its sections');
    foreach ([['admin', 'wrong'], ['qa_trunks', 'Admin-Password-1'], ['fpbxonly', 'Fpbx-Password-1'], ['support-other', PASSWORD], ['Admin', PASSWORD]] as [$user, $password]) {
        check(signIn($f, $user, $password)[0] === 401, "$user must be refused");
    }
    check($f->portalCalls === [] && $f->calls === [], 'local and reserved names must never reach the user domain');
    $f->cleanup();
};

$tests['a domain administrator signs in with the sections of the groups'] = function () {
    $f = new Fixture();
    $result = signIn($f, 'ALICE', PASSWORD);
    $hash = str_repeat('1', 40);
    check($result === [200, ['user' => 'alice', 'secretkey' => sha1('alice' . $hash . SECRET), 'permissions' => ['trunks', 'phones'], 'source' => 'domain'], []], 'unexpected answer: ' . json_encode($result));
    check($f->row('alice') === ['username' => 'alice', 'password_sha1' => $hash, 'sections' => 'nethvoice:trunks;nethvoice:phones'], 'unexpected row: ' . json_encode($f->row('alice')));
    check(nethvoicePermissionsFor($f->row('alice')) === ['trunks', 'phones'], 'the row must give the same permissions to the authenticator');
    check($f->managed() === ['alice' => DOMAIN], 'the row must be marked as managed');
    check(array_column($f->portalCalls, 0) === ['login', 'get-password-expiration'] && $f->portalCalls[0][2] === '' && $f->portalCalls[1][2] === 'user-token-alice', 'unexpected portal calls');
    check(!str_contains(json_encode($result), SECRET), 'the shared secret must never be returned');

    $f->accounts['alice']['groups'] = ['nethvoice3-routes'];
    $again = signIn($f, 'alice', PASSWORD);
    check($again[1]['secretkey'] === $result[1]['secretkey'] && $f->randoms === 1, 'a second sign-in must reuse the credential');
    check($again[1]['permissions'] === ['routes'] && $f->row('alice')['sections'] === 'nethvoice:routes', 'a second sign-in must refresh the sections');

    foreach (['bob' => 'Bob', 'erin' => 'erin'] as $user => $uid) {
        $answer = signIn($f, $user, PASSWORD);
        check($answer[1]['user'] === $uid && $answer[1]['permissions'] === ['superadmin'], "$user must be a superadmin: " . json_encode($answer));
        check($f->row($uid)['sections'] === 'nethvoice:superadmin', "$user must never get the FreePBX '*' section");
    }
    $f->cleanup();
};

$tests['an account without permissions gets the answer of a wrong password'] = function () {
    $f = new Fixture();
    $wrong = signIn($f, 'alice', 'wrong');
    check($wrong === [401, ['code' => 'invalid_credentials', 'message' => 'Invalid username or password'], []], 'unexpected answer: ' . json_encode($wrong));
    $f->portalCalls = [];
    check(signIn($f, 'carol', PASSWORD) === $wrong, 'a member of another instance only must get the wrong password answer');
    check(array_column($f->portalCalls, 0) === ['login'], 'the password expiration must not be read without permissions');
    $f->accounts['carol']['groups'] = [];
    check(signIn($f, 'carol', PASSWORD) === $wrong, 'an account without groups must get the wrong password answer');
    check($f->managed() === [] && $f->row('carol') === null, 'no row may be written');
    $f->cleanup();
};

$tests['an expired password, a conflict and an unreachable domain are told apart'] = function () {
    foreach ([['expired' => true], ['must_change' => true]] as $expiration) {
        $f = new Fixture();
        $f->expiration = $expiration + ['status' => 'success'];
        check(signIn($f, 'alice', PASSWORD)[1]['code'] === 'password_expired' && $f->managed() === [], 'an expired password must be refused: ' . json_encode($expiration));
        $f->cleanup();
    }
    $f = new Fixture();
    $f->accounts['qa_alias'] = ['uid' => 'qa_trunks', 'groups' => ['nethvoice3-admins']];
    $f->accounts['administrator2'] = ['uid' => 'admin', 'groups' => ['domain admins']];
    foreach (['qa_alias', 'administrator2'] as $user) {
        check(signIn($f, $user, PASSWORD)[0] === 403 && signIn($f, $user, PASSWORD)[1]['code'] === 'account_conflict', "$user must be a conflict");
    }
    check($f->row('qa_trunks')['sections'] === 'nethvoice:trunks' && $f->row('admin')['sections'] === '*' && $f->managed() === [], 'a local row must stay as it is');
    foreach ([['status' => 0, 'data' => null], ['status' => 502, 'data' => null], ['status' => 200, 'data' => ['token' => 'x']]] as $failure) {
        $f->portalFailure = $failure;
        check(signIn($f, 'alice', PASSWORD, '192.0.2.99')[1]['code'] === 'domain_unavailable', 'an unreachable domain must be told: ' . json_encode($failure));
    }
    $f->portalFailure = null;
    check(signIn($f, 'alice', PASSWORD, '192.0.2.99')[0] === 200, 'an unreachable domain must not count as a failure');
    $f->cleanup();
};

$tests['the domain is not asked without a prefix or a users-admin service'] = function () {
    foreach (['prefix' => null, 'url' => ''] as $property => $value) {
        $f = new Fixture();
        $f->$property = $value;
        check(signIn($f, 'alice', PASSWORD)[0] === 401 && $f->portalCalls === [], "no $property must disable the domain sign-in");
        check(signIn($f, 'admin', 'Admin-Password-1')[0] === 200, "no $property must keep the local sign-in");
        $f->cleanup();
    }
};

$tests['repeated failures are throttled'] = function () {
    $f = new Fixture();
    for ($i = 0; $i < DOMAIN_ADMINS_FAILURES_PER_ADDRESS; $i++) {
        check(signIn($f, 'alice', 'wrong')[0] === 401, 'a wrong password must be refused');
    }
    $f->now += 10;
    $throttled = signIn($f, 'Alice', PASSWORD);
    check($throttled[0] === 429 && $throttled[1]['code'] === 'too_many_attempts' && $throttled[2] === ['Retry-After' => '290'], 'unexpected answer: ' . json_encode($throttled));
    check(signIn($f, 'admin', 'Admin-Password-1')[0] === 200, 'other usernames must not be throttled');
    check(signIn($f, 'alice', PASSWORD, '192.0.2.11')[0] === 200, 'another address must not be throttled');
    $f->now += DOMAIN_ADMINS_FAILURE_WINDOW;
    check(signIn($f, 'alice', PASSWORD)[0] === 200, 'the throttle must end after the window');
    check(signIn($f, 'alice', 'wrong')[0] === 401 && signIn($f, 'alice', PASSWORD)[0] === 200, 'a success must reset the failures of the address');

    $f = new Fixture();
    for ($i = 0; $i < DOMAIN_ADMINS_FAILURES_PER_USER; $i++) {
        signIn($f, 'qa_trunks', 'wrong', '198.51.100.' . $i);
    }
    check(signIn($f, 'qa_trunks', 'Trunks-Password-1', '203.0.113.1')[0] === 429, 'too many failures from many addresses must throttle the username');
    $stored = (string) file_get_contents($f->directory . '/signin-failures.json');
    check(!str_contains($stored, 'qa_trunks') && !str_contains($stored, '198.51.100'), 'the failure file must not hold usernames or addresses');
    $f->cleanup();
};

$tests['invalid sign-in requests are refused before any check'] = function () {
    $f = new Fixture();
    foreach ([null, [], ['username' => 'alice'], ['username' => '', 'password' => 'x'], ['username' => 'alice', 'password' => 5], ['username' => 'alice', 'password' => 'x', 'extra' => 1], ['username' => str_repeat('a', 257), 'password' => 'x']] as $body) {
        check($f->admins()->signIn($body, '192.0.2.10')[1]['code'] === 'invalid_request', 'accepted: ' . json_encode($body));
    }
    check($f->portalCalls === [], 'invalid requests must not reach the domain');
    $f->cleanup();
};

$tests['Admin control lists local, domain and domain administrator accounts'] = function () {
    $f = new Fixture();
    signIn($f, 'alice', PASSWORD);
    [$status, $data] = $f->admins()->overview('admin');
    check($status === 200 && $data['prefix'] === 'nethvoice3' && $data['manageable'] === true && $data['reason'] === null, 'unexpected status: ' . json_encode($data));
    check($data['groups'] === ['superadmin' => 'nethvoice3-admins', 'dashboard' => 'nethvoice3-dashboard', 'users' => 'nethvoice3-users', 'trunks' => 'nethvoice3-trunks', 'routes' => 'nethvoice3-routes', 'phones' => 'nethvoice3-phones', 'integrations' => 'nethvoice3-integrations', 'settings' => 'nethvoice3-settings'], 'unexpected groups');
    $admins = array_column($data['admins'], null, 'username');
    check(array_keys($admins) === ['admin', 'administrator', 'alice', 'Bob', 'dave', 'qa_trunks'], 'unexpected admins: ' . json_encode(array_keys($admins)));
    check($admins['admin'] === ['username' => 'admin', 'display_name' => null, 'source' => 'local', 'permissions' => ['superadmin'], 'groups' => [], 'locked' => null, 'editable' => false, 'removable' => false, 'reason' => 'own_account'], 'unexpected admin');
    check($admins['qa_trunks']['source'] === 'local' && $admins['qa_trunks']['removable'] === true && $admins['qa_trunks']['editable'] === false && $admins['qa_trunks']['reason'] === 'local_account', 'unexpected local administrator');
    check($admins['Bob']['source'] === 'domain_admin' && $admins['Bob']['permissions'] === ['superadmin'] && $admins['Bob']['reason'] === 'domain_admin' && !$admins['Bob']['editable'], 'unexpected domain administrator');
    check($admins['alice'] === ['username' => 'alice', 'display_name' => 'Alice', 'source' => 'domain', 'permissions' => ['trunks', 'phones'], 'groups' => ['nethvoice3-trunks', 'nethvoice3-phones'], 'locked' => false, 'editable' => true, 'removable' => true, 'reason' => null], 'unexpected domain administrator alice: ' . json_encode($admins['alice']));
    check(!isset($admins['carol']), 'the administrators of another instance must not be listed');
    check($f->admins()->overview('alice')[1]['admins'][2]['reason'] === 'own_account', 'the caller must not edit the own entry');
    check($f->admins()->overview('admin')[1]['admins'][0]['reason'] === 'own_account' && $f->admins()->overview('qa_trunks')[1]['admins'][0]['reason'] === 'builtin', 'admin is the built-in administrator');

    $f->responses['list-groups'] = reply(500, ['code' => 500]);
    [, $data] = $f->admins()->overview('admin');
    check($data['manageable'] === false && $data['reason'] === 'unavailable', 'an unreachable domain must be unavailable');
    $alice = array_column($data['admins'], null, 'username')['alice'];
    check($alice['source'] === 'domain' && $alice['permissions'] === ['trunks', 'phones'] && $alice['reason'] === 'domain_not_manageable' && !$alice['removable'], 'known domain rows must be read-only: ' . json_encode($alice));
    $f->url = '';
    check($f->admins()->overview('admin')[1]['reason'] === 'external', 'no users-admin must mean external');
    $f->cleanup();
};

$tests['Admin control sets exactly the groups of the permissions'] = function () {
    $f = new Fixture();
    signIn($f, 'alice', PASSWORD);
    $f->calls = [];
    $result = $f->admins()->setPermissions('ALICE', ['permissions' => ['superadmin']], 'admin');
    check($result === [200, ['username' => 'alice', 'display_name' => 'Alice', 'source' => 'domain', 'permissions' => ['superadmin'], 'groups' => ['nethvoice3-admins'], 'locked' => false, 'editable' => true, 'removable' => true, 'reason' => null]], 'unexpected answer: ' . json_encode($result));
    check($f->writes() === [
        ['add-group', ['group' => 'nethvoice3-admins', 'description' => 'NethVoice voice.example.org: full access', 'users' => ['alice']]],
        ['alter-group', ['group' => 'nethvoice3-trunks', 'users' => ['dave']]],
        ['alter-group', ['group' => 'nethvoice3-phones', 'users' => []]],
    ], 'unexpected writes: ' . json_encode($f->writes()));
    check($f->row('alice')['sections'] === 'nethvoice:superadmin', 'a signed-in administrator must get the new permissions at once');

    $f->calls = [];
    check($f->admins()->setPermissions('dave', ['permissions' => ['settings', 'users', 'trunks']], 'admin')[1]['permissions'] === ['users', 'trunks', 'settings'], 'the sections must be in the canonical order');
    check($f->writes() === [
        ['add-group', ['group' => 'nethvoice3-users', 'description' => 'NethVoice voice.example.org: Users section', 'users' => ['dave']]],
        ['add-group', ['group' => 'nethvoice3-settings', 'description' => 'NethVoice voice.example.org: Settings section', 'users' => ['dave']]],
    ], 'only the missing groups must be written: ' . json_encode($f->writes()));
    check($f->row('dave') === null, 'no row is created before the sign-in');
    foreach ($f->writes() as [, $payload]) {
        check(str_starts_with($payload['group'], 'nethvoice3-'), 'a group of another owner was written: ' . $payload['group']);
    }

    $f->calls = [];
    check($f->admins()->setPermissions('carol', ['permissions' => ['phones']], 'admin')[0] === 200, 'an administrator of another instance can get permissions here');
    check($f->writes() === [['alter-group', ['group' => 'nethvoice3-phones', 'users' => ['alice', 'carol']]]], 'only the own group may change: ' . json_encode($f->writes()));
    $f->cleanup();
};

$tests['Admin control refuses invalid requests and protected accounts without writing'] = function () {
    $f = new Fixture();
    foreach ([null, [], ['permissions' => []], ['permissions' => ['superadmin', 'users']], ['permissions' => ['bogus']], ['permissions' => ['users', 'users']], ['permissions' => ['users'], 'extra' => 1], ['permissions' => 'users'], ['permissions' => ['a' => 'users']], ['permissions' => ['lookup']]] as $body) {
        check($f->admins()->setPermissions('alice', $body, 'admin') === domainAdminsError(400, 'invalid_request'), 'accepted: ' . json_encode($body));
    }
    $cases = [
        ['alice', 'Alice', 'own_account'],
        ['admin', 'qa_trunks', 'protected_account'],
        ['support-x1', 'admin', 'protected_account'],
        ['Administrator', 'admin', 'protected_account'],
        ['qa_trunks', 'admin', 'local_account'],
        ['bob', 'admin', 'domain_admin'],
        ['zoe', 'admin', 'user_not_found'],
        ['bad name', 'admin', 'invalid_request'],
    ];
    foreach ($cases as [$target, $caller, $code]) {
        check($f->admins()->setPermissions($target, ['permissions' => ['users']], $caller)[1]['code'] === $code, "$target by $caller must be $code");
    }
    $f->token = '';
    check($f->admins()->setPermissions('alice', ['permissions' => ['users']], 'admin')[1]['code'] === 'domain_unavailable', 'no token must be unavailable');
    $f->token = 'invented-token';
    $f->prefix = null;
    check($f->admins()->setPermissions('alice', ['permissions' => ['users']], 'admin')[1]['code'] === 'domain_unavailable', 'no prefix must be unavailable');
    $f->prefix = 'nethvoice3';
    $f->url = '';
    check($f->admins()->setPermissions('alice', ['permissions' => ['users']], 'admin') === domainAdminsError(409, 'domain_not_manageable'), 'an external domain must not be managed');
    $f->url = 'https://users-admin.example.org/api';
    $f->responses['add-group'] = reply(500, ['code' => 500]);
    check($f->admins()->setPermissions('alice', ['permissions' => ['users']], 'admin')[1]['code'] === 'provider_error', 'a failed write must be a provider error');
    check(array_column($f->writes(), 0) === ['add-group'], 'only the failed write may run: ' . json_encode($f->writes()));
    $f->cleanup();
};

$tests['Admin control removes the permissions and signs the administrator out'] = function () {
    $f = new Fixture();
    signIn($f, 'alice', PASSWORD);
    $f->calls = [];
    check($f->admins()->remove('alice', 'admin') === [204, null], 'the removal must succeed');
    check($f->writes() === [['alter-group', ['group' => 'nethvoice3-trunks', 'users' => ['dave']]], ['alter-group', ['group' => 'nethvoice3-phones', 'users' => []]]], 'unexpected writes: ' . json_encode($f->writes()));
    check($f->row('alice') === null && $f->managed() === [], 'the administrator must be signed out at once');

    $f->calls = [];
    check($f->admins()->remove('qa_trunks', 'admin') === [204, null] && $f->row('qa_trunks') === null && $f->calls === [], 'a local administrator must be deleted locally');
    foreach ([['admin', 'qa_x', 'protected_account'], ['support-abc123', 'admin', 'protected_account'], ['bob', 'admin', 'domain_admin'], ['carol', 'admin', 'user_not_found'], ['admin', 'admin', 'own_account']] as [$target, $caller, $code]) {
        check($f->admins()->remove($target, $caller)[1]['code'] === $code, "$target by $caller must be $code");
    }
    check($f->row('admin') !== null && $f->row('support-abc123') !== null && $f->writes() === [], 'nothing else may change');
    $f->cleanup();
};

$tests['the re-read job revokes and updates the domain administrators'] = function () {
    $f = new Fixture();
    $f->accounts['dave'] = ['uid' => 'dave', 'groups' => ['nethvoice3-trunks']];
    $f->accounts['frank'] = ['uid' => 'frank', 'groups' => ['nethvoice3-users']];
    $f->accounts['gina'] = ['uid' => 'gina', 'groups' => ['nethvoice3-users']];
    foreach (['alice', 'bob', 'dave', 'frank', 'gina', 'carol'] as $user) {
        signIn($f, $user, PASSWORD);
    }
    $f->db->prepare('INSERT INTO rest_domain_admins (username, domain, created_at) VALUES (?, ?, ?)')->execute(['olddomain', 'old.example.org', '2026-01-01 00:00:00']);
    $f->local('olddomain', 'x', 'nethvoice:users');
    $f->db->prepare('INSERT INTO rest_domain_admins (username, domain, created_at) VALUES (?, ?, ?)')->execute(['orphan', DOMAIN, '2026-01-01 00:00:00']);
    check(array_keys($f->managed()) === ['alice', 'Bob', 'dave', 'frank', 'gina', 'olddomain', 'orphan'], 'unexpected rows: ' . json_encode($f->managed()));

    $f->responses['list-users'] = users(['alice', 'Bob', 'dave', ['user' => 'gina', 'locked' => true], 'administrator']);
    $f->responses['list-groups'] = groups([
        ['group' => 'domain admins', 'users' => ['Bob']],
        ['group' => 'nethvoice3-routes', 'users' => ['alice']],
        ['group' => 'nethvoice3-users', 'users' => ['gina']],
        ['group' => 'nethvoice-admins', 'users' => ['dave']],
    ]);
    $saved = $f->responses['list-groups'];
    $f->responses['list-groups'] = reply(500, ['code' => 500]);
    check($f->admins()->sync() === false, 'an unreadable domain must fail');
    check(array_keys($f->managed()) === ['alice', 'Bob', 'dave', 'frank', 'gina'] && $f->row('dave') !== null && $f->row('olddomain') === null, 'only the rows of another domain or without an account may go when the domain cannot be read: ' . json_encode($f->managed()));
    $f->responses['list-groups'] = $saved;
    check($f->admins()->sync() === true, 'the re-read must succeed');
    check($f->managed() === ['alice' => DOMAIN, 'Bob' => DOMAIN], 'unexpected rows: ' . json_encode($f->managed()));
    check($f->row('alice')['sections'] === 'nethvoice:routes' && $f->row('Bob')['sections'] === 'nethvoice:superadmin', 'the sections must follow the groups');
    foreach (['dave', 'frank', 'gina', 'olddomain', 'orphan'] as $user) {
        check($f->row($user) === null, "$user must be signed out");
    }
    check($f->row('admin') !== null && $f->row('qa_trunks') !== null && $f->row('support-abc123') !== null, 'local rows must never be touched');
    $f->url = '';
    check($f->admins()->sync() === true && count($f->managed()) === 2, 'an external domain must change nothing');
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
