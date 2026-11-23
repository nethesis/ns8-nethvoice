<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Run the account management of domain users against a fake users-admin provider.

$rest = __DIR__ . '/../var/www/html/freepbx/rest';
require $rest . '/lib/libUsersAdmin.php';

const PASSWORD = 'Invented-Secret-42!';

$logFile = tempnam(sys_get_temp_dir(), 'users-account-log');
ini_set('log_errors', '1');
ini_set('error_log', $logFile);

function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}

class FakeProvider {
    public array $calls = [];
    public int $logins = 0;
    public array $responses = [];
    public string $token = 'invented-token';

    public function __construct() {
        $this->responses['list-users'] = reply(200, ['status' => 'success', 'message' => 'users_listed', 'users' => array_map(
            fn($user) => ['user' => $user, 'display_name' => ucfirst($user), 'locked' => false],
            ['alice', 'Bob', 'carol', 'helpdesk']
        )]);
    }

    public function client(string $url = 'https://users-admin.example.org/api', ?UsersAdminTokenCache $cache = null): UsersAdminClient {
        return new UsersAdminClient(
            $url,
            function () { $this->logins++; return $this->token; },
            function (string $url, array $payload, string $token) {
                $handler = substr($url, strrpos($url, '/') + 1);
                $this->calls[] = [$handler, $payload, $token];
                $response = $this->responses[$handler] ?? ['status' => 200, 'body' => json_encode(['status' => 'success', 'message' => 'ok'])];
                if (is_array($response) && array_is_list($response) && is_array($response[0] ?? null)) {
                    $response = count($response) > 1 ? array_shift($this->responses[$handler]) : $response[0];
                }
                if ($response instanceof Throwable) { throw $response; }
                return $response;
            },
            $cache
        );
    }

    public function writes(): array {
        return array_values(array_diff($this->handlers(), ['list-users', 'list-groups']));
    }

    public function handlers(): array {
        return array_column($this->calls, 0);
    }
}

function reply(int $status, $data): array {
    return ['status' => $status, 'body' => is_string($data) ? $data : json_encode($data)];
}

function groups(array $groups): array {
    return reply(200, ['status' => 'success', 'message' => 'groups_listed', 'groups' => $groups]);
}

const SUPERADMIN = ['username' => 'admin', 'superadmin' => true];
const LIMITED = ['username' => 'helpdesk', 'superadmin' => false];

$tests = [];

$tests['an external domain cannot be managed'] = function () {
    $provider = new FakeProvider();
    check(usersAdminDomainStatus($provider->client(''), null) === ['manageable' => false, 'reason' => 'external'], 'empty portal URL must mean external');
    check($provider->logins === 0, 'no login without a portal URL');
    check(usersAdminChangePassword($provider->client(''), 'alice', ['password' => PASSWORD], SUPERADMIN) === usersAdminError(409, 'domain_not_manageable'), 'writes must be refused on an external domain');
    check(usersAdminListAccounts($provider->client(''))[0] === 409, 'accounts cannot be listed on an external domain');
    check($provider->calls === [], 'nothing must reach a provider');
};

$tests['a missing token makes the domain unavailable'] = function () {
    $provider = new FakeProvider();
    $provider->token = '';
    check(usersAdminDomainStatus($provider->client(), null) === ['manageable' => false, 'reason' => 'unavailable'], 'missing token must mean unavailable');
    check(usersAdminDeleteAccount($provider->client(), 'alice', SUPERADMIN, fn() => true) === usersAdminError(503, 'domain_unavailable'), 'writes need a token');
    check($provider->calls === [], 'no handler called without a token');
};

$tests['the domain status is cached briefly and holds no secret'] = function () {
    $cache = tempnam(sys_get_temp_dir(), 'users-domain');
    unlink($cache);
    $provider = new FakeProvider();
    check(usersAdminDomainStatus($provider->client(), $cache, 1000) === ['manageable' => true, 'reason' => null], 'token must mean manageable');
    check(usersAdminDomainStatus($provider->client(), $cache, 1010)['manageable'] === true && $provider->logins === 1, 'the answer must come from the cache');
    $stored = (string) file_get_contents($cache);
    check(!str_contains($stored, 'invented-token') && !str_contains($stored, 'example.org'), 'the cache must not hold the token or the URL');
    $provider->token = '';
    check(usersAdminDomainStatus($provider->client(), $cache, 1000 + USERS_ADMIN_STATUS_CACHE_SECONDS)['manageable'] === false && $provider->logins === 2, 'an expired cache must be refreshed');
    check(usersAdminDomainStatus($provider->client(), $cache, 500)['manageable'] === false && $provider->logins === 3, 'a cache from the future must be ignored');
    unlink($cache);
};

$tests['changes the password with must_change_password false'] = function () {
    $provider = new FakeProvider();
    check(usersAdminChangePassword($provider->client(), 'alice', ['password' => PASSWORD], SUPERADMIN) === [204, null], 'password change must succeed');
    check($provider->calls === [['list-users', [], 'invented-token'], ['alter-user', ['user' => 'alice', 'password' => PASSWORD, 'must_change_password' => false], 'invented-token']], 'unexpected calls: ' . json_encode($provider->handlers()));
};

$tests['maps the password policy failures'] = function () {
    $cases = [
        'error_password_complexity' => 'password_complexity',
        'error_password_history' => 'password_history',
        'error_password_same' => 'password_same',
        'error_unknown' => 'password_rejected',
        'something_new' => 'password_rejected',
    ];
    foreach ($cases as $message => $code) {
        $provider = new FakeProvider();
        $provider->responses['alter-user'] = reply(200, ['status' => 'failure', 'message' => $message]);
        $result = usersAdminChangePassword($provider->client(), 'alice', ['password' => PASSWORD], SUPERADMIN);
        check($result === usersAdminError(422, $code), "$message must map to $code, got " . json_encode($result));
        check(!str_contains(json_encode($result), $message), 'the provider message must not be returned');
    }
};

$tests['maps a Samba failure and bad answers'] = function () {
    $cases = [
        'samba 500' => [reply(500, ['code' => 500, 'status' => 'Internal server error']), usersAdminError(422, 'password_rejected')],
        'schema 400' => [reply(400, ['code' => 400, 'status' => 'Bad request', 'error' => []]), usersAdminError(422, 'password_rejected')],
        'timeout' => [['status' => 0, 'body' => ''], usersAdminError(502, 'provider_error')],
        'exception' => [new RuntimeException('connection reset'), usersAdminError(502, 'provider_error')],
        'expired token' => [reply(401, ['code' => 401, 'message' => 'expired']), usersAdminError(502, 'provider_error')],
        'not json' => [reply(200, '<html>proxy error</html>'), usersAdminError(502, 'provider_error')],
        'no status' => [reply(200, ['message' => 'password_changed']), usersAdminError(502, 'provider_error')],
        'malformed transport' => ['nonsense', usersAdminError(502, 'provider_error')],
    ];
    foreach ($cases as $name => [$response, $expected]) {
        $provider = new FakeProvider();
        $provider->responses['alter-user'] = $response;
        $result = usersAdminChangePassword($provider->client(), 'alice', ['password' => PASSWORD], SUPERADMIN);
        check($result === $expected, "$name: got " . json_encode($result));
    }
};

$tests['refuses protected accounts, the own account and bad requests'] = function () {
    $cases = [
        ['admin', ['password' => PASSWORD], SUPERADMIN, usersAdminError(403, 'protected_account')],
        ['Administrator', ['password' => PASSWORD], SUPERADMIN, usersAdminError(403, 'protected_account')],
        ['helpdesk', ['password' => PASSWORD], LIMITED, usersAdminError(403, 'own_account')],
        ['alice', ['password' => ''], SUPERADMIN, usersAdminError(400, 'invalid_request')],
        ['alice', ['password' => str_repeat('a', 257)], SUPERADMIN, usersAdminError(400, 'invalid_request')],
        ['alice', ['password' => PASSWORD, 'must_change_password' => true], SUPERADMIN, usersAdminError(400, 'invalid_request')],
        ['alice', null, SUPERADMIN, usersAdminError(400, 'invalid_request')],
        ['al ice', ['password' => PASSWORD], SUPERADMIN, usersAdminError(400, 'invalid_request')],
    ];
    foreach ($cases as [$username, $body, $caller, $expected]) {
        $provider = new FakeProvider();
        $result = usersAdminChangePassword($provider->client(), $username, $body, $caller);
        check($result === $expected, "$username: got " . json_encode($result));
        check($provider->calls === [], "$username: nothing must reach the provider");
    }
    $provider = new FakeProvider();
    check(usersAdminDeleteAccount($provider->client(), 'admin', SUPERADMIN, fn() => true) === usersAdminError(403, 'protected_account'), 'admin cannot be deleted');
    check(usersAdminDeleteAccount($provider->client(), 'HelpDesk', LIMITED, fn() => true) === usersAdminError(403, 'own_account'), 'the own account cannot be deleted');
    check(usersAdminUpdateAccount($provider->client(), 'helpdesk', ['locked' => true], LIMITED, fn() => true) === usersAdminError(403, 'own_account'), 'the own account cannot be disabled');
    check($provider->calls === [], 'nothing must reach the provider');
};

$tests['protects the domain administrators from limited administrators'] = function () {
    $adminGroups = groups([
        ['group' => 'Domain Admins', 'description' => '', 'users' => ['Bob']],
        ['group' => 'sales', 'description' => '', 'users' => ['alice']],
    ]);
    $actions = [
        'password' => fn($client, $caller) => usersAdminChangePassword($client, 'bob', ['password' => PASSWORD], $caller),
        'disable' => fn($client, $caller) => usersAdminUpdateAccount($client, 'bob', ['locked' => true], $caller, fn() => true),
        'enable' => fn($client, $caller) => usersAdminUpdateAccount($client, 'bob', ['locked' => false], $caller, fn() => true),
        'delete' => fn($client, $caller) => usersAdminDeleteAccount($client, 'bob', $caller, fn() => true),
    ];
    foreach ($actions as $name => $action) {
        $provider = new FakeProvider();
        $provider->responses['list-groups'] = $adminGroups;
        check($action($provider->client(), LIMITED) === usersAdminError(403, 'domain_admin'), "$name: a limited administrator must be refused");
        check($provider->handlers() === ['list-users', 'list-groups'], "$name: only the listings may run, got " . json_encode($provider->handlers()));

        $provider = new FakeProvider();
        $provider->responses['list-groups'] = $adminGroups;
        check(in_array($action($provider->client(), SUPERADMIN)[0], [200, 204], true), "$name: the superadmin must be allowed");
        check(!in_array('list-groups', $provider->handlers(), true), "$name: the superadmin needs no group check");

        $provider = new FakeProvider();
        $provider->responses['list-groups'] = reply(500, ['code' => 500]);
        check($action($provider->client(), LIMITED) === usersAdminError(502, 'provider_error'), "$name: an unknown membership must refuse");
        check($provider->handlers() === ['list-users', 'list-groups'], "$name: nothing may change when the membership is unknown");
    }
    $provider = new FakeProvider();
    $provider->responses['list-groups'] = $adminGroups;
    check(usersAdminChangePassword($provider->client(), 'alice', ['password' => PASSWORD], LIMITED) === [204, null], 'a regular user must be allowed');
    check(usersAdminUpdateAccount($provider->client(), 'bob', ['display_name' => 'Bob White'], LIMITED, fn() => true)[0] === 200, 'renaming a domain administrator stays allowed');
};

$tests['locks and unlocks without synchronizing'] = function () {
    foreach ([true, false] as $locked) {
        $provider = new FakeProvider();
        $synced = 0;
        $result = usersAdminUpdateAccount($provider->client(), 'alice', ['locked' => $locked], SUPERADMIN, function () use (&$synced) { $synced++; return true; });
        check($result === [200, ['synchronized' => null]], 'a lock change must not claim a synchronization: ' . json_encode($result));
        check($provider->calls === [['list-users', [], 'invented-token'], ['alter-user', ['user' => 'alice', 'locked' => $locked], 'invented-token']], 'unexpected calls: ' . json_encode($provider->calls));
        check($synced === 0, 'a lock change needs no synchronization');
    }
    $provider = new FakeProvider();
    $provider->responses['alter-user'] = reply(500, ['code' => 500]);
    check(usersAdminUpdateAccount($provider->client(), 'alice', ['locked' => true], SUPERADMIN, fn() => true) === usersAdminError(502, 'provider_error'), 'a failed lock must be a provider error');
};

$tests['changes display name and email, then synchronizes'] = function () {
    $provider = new FakeProvider();
    $synced = 0;
    $result = usersAdminUpdateAccount($provider->client(), 'alice', ['display_name' => '  Alice White ', 'mail' => 'alice@example.org'], LIMITED, function () use (&$synced) { $synced++; return false; });
    check($result === [200, ['synchronized' => false]], 'the response must report the failed synchronization: ' . json_encode($result));
    check($provider->writes() === ['alter-user'] && $provider->calls[1] === ['alter-user', ['user' => 'alice', 'display_name' => 'Alice White', 'mail' => 'alice@example.org'], 'invented-token'], 'unexpected calls: ' . json_encode($provider->calls));
    check($synced === 1, 'a name change must synchronize once');

    $provider = new FakeProvider();
    check(usersAdminUpdateAccount($provider->client(), 'alice', ['mail' => ''], SUPERADMIN, fn() => true) === [200, ['synchronized' => true]], 'the email can be cleared');
    check(usersAdminUpdateAccount($provider->client(), 'helpdesk', ['display_name' => 'Help Desk'], LIMITED, fn() => true)[0] === 200, 'the own name can be changed');

    $provider = new FakeProvider();
    check(usersAdminUpdateAccount($provider->client(), 'alice', ['mail' => 'not-an-address'], SUPERADMIN, fn() => true) === usersAdminError(422, 'invalid_mail'), 'an invalid email must be refused');
    foreach ([[], ['display_name' => ''], ['display_name' => " \n "], ['display_name' => 5], ['locked' => 'yes'], ['password' => PASSWORD], ['mail' => null]] as $body) {
        check(usersAdminUpdateAccount($provider->client(), 'alice', $body, SUPERADMIN, fn() => true) === usersAdminError(400, 'invalid_request'), 'invalid body accepted: ' . json_encode($body));
    }
    check($provider->calls === [], 'invalid requests must not reach the provider');

    $provider = new FakeProvider();
    $provider->responses['alter-user'] = reply(400, ['code' => 400, 'status' => 'Bad request', 'error' => [['field' => 'mail', 'parameter' => 'mail', 'value' => 'a@b', 'error' => 'format']]]);
    check(usersAdminUpdateAccount($provider->client(), 'alice', ['mail' => 'alice@example.org'], SUPERADMIN, fn() => true) === usersAdminError(422, 'invalid_mail'), 'a provider refusal of the email must be an invalid email');
};

$tests['refuses control characters in the display name before the provider and the extensions'] = function () {
    foreach (["\r", "\n", "\t", "\0", "\x7f", "\x1b"] as $character) {
        foreach (["Alice{$character}White", "Alice White{$character}#exec /bin/id", "{$character}Alice", "Alice{$character}"] as $name) {
            foreach ([['display_name' => $name], ['display_name' => $name, 'mail' => 'alice@example.org', 'locked' => true]] as $body) {
                $provider = new FakeProvider();
                $events = [];
                $result = usersAdminUpdateAccount($provider->client(), 'alice', $body, SUPERADMIN, function () use (&$events) { $events[] = 'sync'; return true; }, function (...$args) use (&$events) { $events[] = $args; });
                check($result === [422, ['code' => 'invalid_display_name', 'message' => 'The display name contains control characters']], 'the display name ' . json_encode($name) . ' was not refused: ' . json_encode($result));
                check($provider->calls === [] && $provider->logins === 0 && $events === [], 'the display name ' . json_encode($name) . ' reached the provider or the extensions');
            }
        }
    }
    foreach (['Zoë Müller-Ça', 'José Ñúñez', "Anna O'Brien", 'Team "A"', 'R&D #2 / 50%', 'Mario  De Rossi', '  Alice White ', '#exec /bin/id'] as $name) {
        $provider = new FakeProvider();
        $events = [];
        $result = usersAdminUpdateAccount($provider->client(), 'alice', ['display_name' => $name], SUPERADMIN, function () use (&$events) { $events[] = 'sync'; return true; }, function (...$args) use (&$events) { $events[] = $args; });
        check($result === [200, ['synchronized' => true]], 'the display name ' . json_encode($name) . ' was refused: ' . json_encode($result));
        check($provider->calls[1] === ['alter-user', ['user' => 'alice', 'display_name' => trim($name)], 'invented-token'] && $events === ['sync', ['alice', trim($name)]], 'the display name ' . json_encode($name) . ' did not reach the provider and the extensions unchanged: ' . json_encode([$provider->calls, $events]));
    }
};

$tests['deletes the account, then synchronizes, and touches no extension'] = function () {
    $provider = new FakeProvider();
    $provider->responses['list-groups'] = groups([['group' => 'domain admins', 'description' => '', 'users' => ['bob']]]);
    $order = [];
    $result = usersAdminDeleteAccount($provider->client(), 'alice', LIMITED, function () use (&$order, $provider) { $order = $provider->handlers(); return true; });
    check($result === [200, ['synchronized' => true]], 'delete must succeed: ' . json_encode($result));
    check($order === ['list-users', 'list-groups', 'remove-user'], 'remove-user must run before the synchronization: ' . json_encode($order));
    check($provider->calls[2] === ['remove-user', ['user' => 'alice'], 'invented-token'], 'unexpected remove-user call');

    $provider = new FakeProvider();
    $provider->responses['remove-user'] = reply(500, ['code' => 500]);
    $synced = false;
    check(usersAdminDeleteAccount($provider->client(), 'alice', SUPERADMIN, function () use (&$synced) { $synced = true; return true; }) === usersAdminError(502, 'provider_error'), 'a failed removal must be a provider error');
    check(!$synced, 'a failed removal must not synchronize');

    $source = file_get_contents(__DIR__ . '/../var/www/html/freepbx/rest/lib/libUsersAdmin.php');
    foreach (['deleteExtension', 'delMailbox', 'releaseOrphanExtensions', 'releaseUserExtensions', 'rest_users', 'setPassword'] as $forbidden) {
        check(!str_contains($source, $forbidden), "the account library must not use $forbidden");
    }
};

$tests['lists the accounts defensively'] = function () {
    $provider = new FakeProvider();
    $provider->responses['list-users'] = reply(200, ['status' => 'success', 'message' => 'users_listed', 'users' => [
        ['user' => 'alice', 'display_name' => 'Alice White', 'locked' => false, 'expired' => false, 'password_expiration' => -1, 'mail' => 'alice@example.org'],
        ['user' => 'bob', 'display_name' => 'Bob Black', 'locked' => true],
        ['user' => 'carol'],
        ['display_name' => 'No user'],
        'garbage',
    ]]);
    $provider->responses['list-groups'] = groups([['group' => 'domain admins', 'description' => '', 'users' => ['bob']], 'garbage']);
    [$status, $accounts] = usersAdminListAccounts($provider->client());
    check($status === 200, 'list must succeed');
    check($accounts === [
        ['username' => 'alice', 'display_name' => 'Alice White', 'mail' => 'alice@example.org', 'locked' => false, 'domain_admin' => false],
        ['username' => 'bob', 'display_name' => 'Bob Black', 'mail' => '', 'locked' => true, 'domain_admin' => true],
        ['username' => 'carol', 'display_name' => '', 'mail' => '', 'locked' => null, 'domain_admin' => false],
    ], 'unexpected accounts: ' . json_encode($accounts));

    $provider = new FakeProvider();
    $provider->responses['list-users'] = reply(200, ['status' => 'success', 'users' => [['user' => 'alice']]]);
    $provider->responses['list-groups'] = reply(200, 'not json');
    check(usersAdminListAccounts($provider->client())[1][0]['domain_admin'] === null, 'an unknown membership must be null');

    foreach ([reply(200, ['status' => 'success']), reply(200, ['status' => 'failure', 'users' => []]), reply(500, ''), ['status' => 0, 'body' => '']] as $response) {
        $provider = new FakeProvider();
        $provider->responses['list-users'] = $response;
        check(usersAdminListAccounts($provider->client()) === usersAdminError(502, 'provider_error'), 'a bad list must be a provider error: ' . json_encode($response));
    }
};

$reloads = 0;
function triggerMiddlewareProfilesReload() { $GLOBALS['reloads']++; }

function tempDirectory(): string {
    $directory = sys_get_temp_dir() . '/users-account-' . bin2hex(random_bytes(6));
    mkdir($directory, 0700);
    return $directory;
}

function removeDirectory(string $directory): void {
    foreach (glob("$directory/*") ?: [] as $file) { unlink($file); }
    rmdir($directory);
}

class FakeSqlStatement {
    private array $rows = [];
    private int $affected = 0;
    public function __construct(private FakeSql $db, private string $sql) {}
    public function execute($args = []) {
        $this->db->queries[] = [$this->sql, $args];
        [$this->rows, $this->affected] = ($this->db->handler)($this->sql, $args);
        return true;
    }
    public function fetch($mode = null) { return $this->rows[0] ?? false; }
    public function fetchAll($mode = null) { return $mode === PDO::FETCH_COLUMN ? array_map(fn($row) => array_values($row)[0], $this->rows) : $this->rows; }
    public function rowCount() { return $this->affected; }
}

class FakeSql {
    public array $queries = [];
    public function __construct(public $handler) {}
    public function prepare($sql) { return new FakeSqlStatement($this, $sql); }
}

class FakeMailboxes {
    public array $updates = [];
    public function __construct(public array $boxes) {}
    public function getMailbox($extension, $cached = true) { return $this->boxes[$extension] ?? null; }
    public function updateMailbox($extension, $mailbox, $cached = true) { $this->updates[] = [$extension, $mailbox, $cached]; $this->boxes[$extension] = $mailbox; }
}

$tests['refuses every write on an account missing from the domain'] = function () {
    $actions = [
        'password' => fn($client, $caller, $sync) => usersAdminChangePassword($client, 'ghost', ['password' => PASSWORD], $caller),
        'lock' => fn($client, $caller, $sync) => usersAdminUpdateAccount($client, 'ghost', ['locked' => true], $caller, $sync),
        'unlock' => fn($client, $caller, $sync) => usersAdminUpdateAccount($client, 'ghost', ['locked' => false], $caller, $sync),
        'clear mail' => fn($client, $caller, $sync) => usersAdminUpdateAccount($client, 'ghost', ['mail' => ''], $caller, $sync),
        'rename' => fn($client, $caller, $sync) => usersAdminUpdateAccount($client, 'ghost', ['display_name' => 'Ghost White'], $caller, $sync, function () { throw new LogicException('renamed a missing account'); }),
        'delete' => fn($client, $caller, $sync) => usersAdminDeleteAccount($client, 'ghost', $caller, $sync, function () { throw new LogicException('deleted the data of a missing account'); }),
    ];
    foreach ($actions as $name => $action) {
        foreach ([SUPERADMIN, LIMITED] as $caller) {
            $provider = new FakeProvider();
            $synced = 0;
            $result = $action($provider->client(), $caller, function () use (&$synced) { $synced++; return true; });
            check($result === usersAdminError(404, 'user_not_found'), "$name: a missing account must be 404, got " . json_encode($result));
            check($provider->handlers() === ['list-users'], "$name: only one listing may run, got " . json_encode($provider->handlers()));
            check($synced === 0, "$name: nothing to synchronize");
        }
    }
    $provider = new FakeProvider();
    $provider->responses['list-users'] = reply(500, ['code' => 500]);
    check(usersAdminUpdateAccount($provider->client(), 'alice', ['locked' => true], SUPERADMIN, fn() => true) === usersAdminError(502, 'provider_error'), 'an unknown user list must refuse');
    check($provider->writes() === [], 'nothing may change when the user list is unknown');
    $provider = new FakeProvider();
    check(usersAdminUpdateAccount($provider->client(), 'ALICE', ['locked' => true], SUPERADMIN, fn() => true)[0] === 200, 'the account must be found ignoring the case');
};

$tests['reads each listing at most once per request'] = function () {
    $requests = [
        fn($client) => usersAdminChangePassword($client, 'alice', ['password' => PASSWORD], LIMITED),
        fn($client) => usersAdminUpdateAccount($client, 'alice', ['locked' => true, 'display_name' => 'Alice White'], LIMITED, fn() => true),
        fn($client) => usersAdminDeleteAccount($client, 'alice', LIMITED, fn() => true),
        fn($client) => usersAdminListAccounts($client),
    ];
    foreach ($requests as $index => $request) {
        $provider = new FakeProvider();
        $request($provider->client());
        $counts = array_count_values($provider->handlers());
        check(($counts['list-users'] ?? 0) === 1 && ($counts['list-groups'] ?? 0) <= 1 && $provider->logins === 1, "request $index: listings or logins repeated: " . json_encode($provider->handlers()));
    }
};

$tests['reuses the provider token for a short time'] = function () {
    $directory = tempDirectory();
    $file = "$directory/users-admin-token.json";
    $now = 1000;
    $clock = function () use (&$now) { return $now; };
    $provider = new FakeProvider();
    foreach (range(1, 3) as $request) {
        $client = $provider->client('https://users-admin.example.org/api', new UsersAdminTokenCache($file, 'key-a', $clock));
        check(usersAdminListAccounts($client)[0] === 200, "request $request must succeed");
    }
    check($provider->logins === 1, 'three requests must log in once, got ' . $provider->logins);
    check((fileperms($file) & 0777) === 0600, 'the token file must be readable only by its owner');
    $stored = (string) file_get_contents($file);
    check(!str_contains($stored, 'example.org') && !str_contains($stored, PASSWORD), 'the token file must not hold the URL');

    $now = 1000 + USERS_ADMIN_TOKEN_CACHE_SECONDS;
    usersAdminListAccounts($provider->client('https://users-admin.example.org/api', new UsersAdminTokenCache($file, 'key-a', $clock)));
    check($provider->logins === 2, 'an expired token must not be reused');
    $now = 500;
    usersAdminListAccounts($provider->client('https://users-admin.example.org/api', new UsersAdminTokenCache($file, 'key-a', $clock)));
    check($provider->logins === 3, 'a token from the future must not be reused');
    usersAdminListAccounts($provider->client('https://users-admin.example.org/api', new UsersAdminTokenCache($file, 'key-b', $clock)));
    check($provider->logins === 4, 'a token of other credentials must not be reused');
    removeDirectory($directory);
};

$tests['logs in again once when the provider refuses the reused token'] = function () {
    foreach ([401, 403] as $status) {
        $directory = tempDirectory();
        $file = "$directory/users-admin-token.json";
        $provider = new FakeProvider();
        $cache = fn() => new UsersAdminTokenCache($file, 'key-a');
        usersAdminListAccounts($provider->client('https://users-admin.example.org/api', $cache()));
        $provider->calls = [];
        $provider->token = 'renewed-token';
        $provider->responses['alter-user'] = [reply($status, ['code' => $status, 'message' => 'Token is expired']), reply(200, ['status' => 'success'])];
        $result = usersAdminUpdateAccount($provider->client('https://users-admin.example.org/api', $cache()), 'alice', ['locked' => true], SUPERADMIN, fn() => true);
        check($result === [200, ['synchronized' => null]], "$status: the change must succeed after a new login: " . json_encode($result));
        check($provider->logins === 2, "$status: one new login expected, got " . $provider->logins);
        check(array_map(fn($call) => [$call[0], $call[2]], $provider->calls) === [['list-users', 'invented-token'], ['alter-user', 'invented-token'], ['alter-user', 'renewed-token']], "$status: unexpected calls " . json_encode($provider->calls));
        check(str_contains((string) file_get_contents($file), 'renewed-token'), "$status: the new token must replace the refused one");

        $provider->calls = [];
        $provider->responses['alter-user'] = reply($status, ['code' => $status]);
        check(usersAdminUpdateAccount($provider->client('https://users-admin.example.org/api', $cache()), 'alice', ['locked' => true], SUPERADMIN, fn() => true) === usersAdminError(502, 'provider_error'), "$status: a refused new token must be a provider error");
        check($provider->logins === 3 && count($provider->calls) === 3, "$status: only one retry is allowed, got " . json_encode($provider->handlers()));
        removeDirectory($directory);
    }
    $provider = new FakeProvider();
    $provider->responses['alter-user'] = reply(401, ['code' => 401]);
    usersAdminUpdateAccount($provider->client(), 'alice', ['locked' => true], SUPERADMIN, fn() => true);
    check($provider->logins === 1 && $provider->writes() === ['alter-user'], 'a fresh token must not be retried');
};

$tests['keeps the token only in a private file of its directory'] = function () {
    $cache = new UsersAdminTokenCache(sys_get_temp_dir() . '/users-account-missing-' . bin2hex(random_bytes(6)) . '/token.json', 'key-a');
    $before = glob(sys_get_temp_dir() . '/token*') ?: [];
    $cache->put('invented-token');
    check($cache->get() === null, 'a missing directory must not store the token');
    check((glob(sys_get_temp_dir() . '/token*') ?: []) === $before, 'the token must not fall back to the temporary directory');
};

$tests['synchronizes once at a time and waits for a running synchronization'] = function () {
    $directory = tempDirectory();
    $lockFile = "$directory/users-sync.lock";
    $slept = [];
    $sleep = function ($microseconds) use (&$slept) { $slept[] = $microseconds; };
    $busy = [1, "User Manager is already syncing (Process: 4242)"];

    $GLOBALS['reloads'] = 0;
    $runs = 0;
    check(usersAdminSynchronize(function () use (&$runs) { $runs++; return [0, '']; }, $sleep, $lockFile) === true && $runs === 1 && $slept === [] && $GLOBALS['reloads'] === 1, 'a free synchronization must run once');

    $replies = [$busy, $busy, [0, 'done']];
    $slept = [];
    check(usersAdminSynchronize(function () use (&$replies) { return array_shift($replies); }, $sleep, $lockFile) === true, 'a running synchronization must be waited for');
    check($replies === [] && count($slept) === 2 && $GLOBALS['reloads'] === 2, 'two retries expected, slept ' . json_encode($slept));

    $runs = 0;
    $slept = [];
    check(usersAdminSynchronize(function () use (&$runs, $busy) { $runs++; return $busy; }, $sleep, $lockFile) === false, 'a synchronization that never frees must give up');
    check(array_sum($slept) === USERS_ADMIN_SYNC_WAIT_MICROSECONDS && $runs === count($slept) + 1, "the wait must be capped, ran $runs times and slept " . array_sum($slept));

    $runs = 0;
    $slept = [];
    check(usersAdminSynchronize(function () use (&$runs) { $runs++; return [1, 'Database error']; }, $sleep, $lockFile) === false && $runs === 1 && $slept === [], 'another failure must not be retried');

    $holder = fopen($lockFile, 'c');
    flock($holder, LOCK_EX);
    $slept = [];
    $locked = null;
    $release = function ($microseconds) use (&$slept, $holder) { $slept[] = $microseconds; if (count($slept) === 2) { flock($holder, LOCK_UN); } };
    $result = usersAdminSynchronize(function () use (&$locked, $lockFile) {
        $probe = fopen($lockFile, 'c');
        $locked = !flock($probe, LOCK_EX | LOCK_NB);
        fclose($probe);
        return [0, ''];
    }, $release, $lockFile);
    check($result === true && count($slept) === 2 && $locked === true, 'the synchronization must wait for the lock and hold it while running');
    $probe = fopen($lockFile, 'c');
    check(flock($probe, LOCK_EX | LOCK_NB), 'the lock must be released');
    fclose($probe);

    flock($holder, LOCK_EX);
    $runs = 0;
    $slept = [];
    check(usersAdminSynchronize(function () use (&$runs) { $runs++; return [0, '']; }, $sleep, $lockFile) === true && $runs === 1, 'a lock never released must not fail the request');
    check(array_sum($slept) === USERS_ADMIN_SYNC_WAIT_MICROSECONDS, 'the lock wait must be capped');
    fclose($holder);

    $runs = 0;
    check(usersAdminSynchronize(function () use (&$runs) { $runs++; return [0, '']; }, $sleep, "$directory/missing/users-sync.lock") === true && $runs === 1, 'a lock file that cannot be opened must not fail the request');
    removeDirectory($directory);
};

$tests['says whether a synchronization ran'] = function () {
    $cases = [
        [['locked' => true], null],
        [['locked' => false], null],
        [['mail' => ''], true],
        [['mail' => 'alice@example.org'], true],
        [['display_name' => 'Alice White'], true],
        [['display_name' => 'Alice White', 'locked' => true], true],
    ];
    foreach ($cases as [$body, $expected]) {
        $provider = new FakeProvider();
        $synced = 0;
        $result = usersAdminUpdateAccount($provider->client(), 'alice', $body, SUPERADMIN, function () use (&$synced) { $synced++; return true; });
        check($result === [200, ['synchronized' => $expected]] && $synced === ($expected === null ? 0 : 1), json_encode($body) . ': got ' . json_encode($result));
    }
    $provider = new FakeProvider();
    check(usersAdminUpdateAccount($provider->client(), 'alice', ['display_name' => 'Alice White'], SUPERADMIN, fn() => false) === [200, ['synchronized' => false]], 'a failed synchronization must be reported');
};

$tests['applies a new display name to voicemail and devices'] = function () {
    $renamed = [];
    $record = function (...$args) use (&$renamed) { $renamed[] = $args; };
    $provider = new FakeProvider();
    usersAdminUpdateAccount($provider->client(), 'alice', ['display_name' => '  Alice White ', 'mail' => 'alice@example.org'], SUPERADMIN, fn() => false, $record);
    check($renamed === [['alice', 'Alice White']], 'the new name must be applied even when the synchronization failed: ' . json_encode($renamed));
    foreach ([['mail' => 'alice@example.org'], ['locked' => true]] as $body) {
        usersAdminUpdateAccount($provider->client(), 'alice', $body, SUPERADMIN, fn() => true, $record);
    }
    check(count($renamed) === 1, 'only a name change applies a name');
    $provider->responses['alter-user'] = reply(500, ['code' => 500]);
    usersAdminUpdateAccount($provider->client(), 'alice', ['display_name' => 'Alice Black'], SUPERADMIN, fn() => true, $record);
    check(count($renamed) === 1, 'a refused name must not be applied');
    $provider = new FakeProvider();
    $result = usersAdminUpdateAccount($provider->client(), 'alice', ['display_name' => 'Alice Black'], SUPERADMIN, fn() => true, function () { throw new RuntimeException('database gone'); });
    check($result === [200, ['synchronized' => true]], 'a failure after the provider change must not fail the request');

    $descriptions = ['201' => 'Alice Rossi', '91201' => 'Alice Rossi', '92201' => 'Alice White', '202' => 'Dave Verdi'];
    $db = new FakeSql(function ($sql, $args) use (&$descriptions) {
        switch ($sql) {
            case 'SELECT id, default_extension FROM userman_users WHERE username = ?':
                $users = ['alice' => ['id' => 1, 'default_extension' => '201'], 'carol' => ['id' => 3, 'default_extension' => 'none']];
                return [isset($users[$args[0]]) ? [$users[$args[0]]] : [], 0];
            case 'SELECT extension FROM rest_devices_phones WHERE user_id = ? AND extension IS NOT NULL AND extension != ""':
                return [$args[0] === 1 ? [['extension' => '91201'], ['extension' => '92201'], ['extension' => '201']] : [], 0];
            case 'UPDATE devices SET description = ? WHERE id = ? AND description != ?':
                if (isset($descriptions[$args[1]]) && $descriptions[$args[1]] !== $args[2]) {
                    $descriptions[$args[1]] = $args[0];
                    return [[], 1];
                }
                return [[], 0];
        }
        throw new RuntimeException('Unexpected query: ' . $sql);
    });
    $voicemail = new FakeMailboxes(['201' => ['name' => 'Alice Rossi', 'email' => 'alice@example.org', 'pwd' => '1234'], '202' => ['name' => 'Dave Verdi']]);
    $reloads = 0;
    $reload = function () use (&$reloads) { $reloads++; };
    check(usersAdminApplyDisplayName('alice', 'Alice White', $db, $voicemail, $reload) === true, 'the name must be applied');
    check($descriptions === ['201' => 'Alice White', '91201' => 'Alice White', '92201' => 'Alice White', '202' => 'Dave Verdi'], 'device descriptions not updated: ' . json_encode($descriptions));
    check($voicemail->boxes['201'] === ['name' => 'Alice White', 'email' => 'alice@example.org', 'pwd' => '1234'] && $voicemail->updates[0][2] === false, 'voicemail name not updated or other fields changed');
    check($voicemail->boxes['202'] === ['name' => 'Dave Verdi'] && $reloads === 1, 'another mailbox changed or no reload');

    check(usersAdminApplyDisplayName('alice', 'Alice White', $db, $voicemail, $reload) === false && $reloads === 1 && count($voicemail->updates) === 1, 'an unchanged name must not reload');
    $long = str_repeat('à', 60);
    usersAdminApplyDisplayName('alice', $long, $db, $voicemail, $reload);
    check($descriptions['201'] === str_repeat('à', 50) && $voicemail->boxes['201']['name'] === $long, 'the description must be cut to its column width');
    check(usersAdminApplyDisplayName('carol', 'Carol', $db, $voicemail, $reload) === false && usersAdminApplyDisplayName('ghost', 'Ghost', $db, $voicemail, $reload) === false, 'users without extension must be skipped');
};

$tests['deletes the NethVoice data only after the removal and the synchronization'] = function () {
    $events = [];
    $provider = new FakeProvider();
    $result = usersAdminDeleteAccount($provider->client(), 'alice', SUPERADMIN,
        function () use (&$events, $provider) { $events[] = ['sync', $provider->writes()]; return true; },
        function ($username) use (&$events) { $events[] = ['cleanup', $username]; return true; }
    );
    check($result === [200, ['synchronized' => true, 'cleaned' => true]], 'delete must succeed: ' . json_encode($result));
    check($events === [['sync', ['remove-user']], ['cleanup', 'alice']], 'the data must be deleted after the removal and the synchronization: ' . json_encode($events));

    $events = [];
    $provider = new FakeProvider();
    $provider->responses['remove-user'] = reply(500, ['code' => 500]);
    $result = usersAdminDeleteAccount($provider->client(), 'alice', SUPERADMIN,
        function () use (&$events) { $events[] = 'sync'; return true; },
        function () use (&$events) { $events[] = 'cleanup'; return true; }
    );
    check($result === usersAdminError(502, 'provider_error') && $events === [], 'a failed removal must leave NethVoice untouched: ' . json_encode([$result, $events]));

    $provider = new FakeProvider();
    $result = usersAdminDeleteAccount($provider->client(), 'alice', SUPERADMIN, fn() => false, fn() => false);
    check($result === [200, ['synchronized' => false, 'cleaned' => false]], 'a failed cleanup must be reported: ' . json_encode($result));

    $provider = new FakeProvider();
    $result = usersAdminDeleteAccount($provider->client(), 'alice', SUPERADMIN, fn() => true, function () { throw new RuntimeException('database gone'); });
    check($result === [200, ['synchronized' => true, 'cleaned' => false]] && $provider->writes() === ['remove-user'], 'a cleanup error must be reported after the removal: ' . json_encode($result));
};

$tests['runs every NethVoice cleanup step and reloads once'] = function () {
    $events = [];
    $step = function ($name, $result) use (&$events) {
        return function ($username) use (&$events, $name, $result) {
            $events[] = [$name, $username];
            if ($result instanceof Throwable) { throw $result; }
            return $result;
        };
    };
    $reload = function () use (&$events) { $events[] = 'reload'; };
    check(usersAdminDeleteNethvoiceData('alice', [$step('pbx', true), $step('cti', true)], $reload) === true, 'all steps done must succeed');
    check($events === [['pbx', 'alice'], ['cti', 'alice'], 'reload'], 'unexpected steps: ' . json_encode($events));

    $events = [];
    check(usersAdminDeleteNethvoiceData('alice', [$step('pbx', new RuntimeException('database gone')), $step('cti', true)], $reload) === false, 'a failed step must fail the cleanup');
    check($events === [['pbx', 'alice'], ['cti', 'alice'], 'reload'], 'a failed step must not stop the others: ' . json_encode($events));

    $events = [];
    check(usersAdminDeleteNethvoiceData('alice', [$step('pbx', true), $step('cti', false)], $reload) === false && end($events) === 'reload', 'a step that reports a failure must fail the cleanup');
};

$failures = 0;
foreach ($tests as $name => $test) {
    try {
        $test();
        echo "ok - $name\n";
    } catch (Throwable $e) {
        $failures++;
        echo "not ok - $name: {$e->getMessage()}\n";
    }
}

$log = (string) file_get_contents($logFile);
unlink($logFile);
if (str_contains($log, PASSWORD) || str_contains($log, 'invented-token') || str_contains($log, 'renewed-token')) {
    $failures++;
    echo "not ok - the log contains a password or a token\n";
} else {
    echo "ok - the log contains no password or token\n";
}

if ($failures > 0) {
    echo "FAIL: $failures of " . (count($tests) + 1) . " tests\n";
    exit(1);
}
echo 'PASS: ' . (count($tests) + 1) . " tests\n";
