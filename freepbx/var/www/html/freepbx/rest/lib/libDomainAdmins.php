<?php

#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

require_once __DIR__ . '/Permissions.php';
require_once __DIR__ . '/libUsersAdmin.php';

const DOMAIN_ADMINS_LOCK = '/var/run/nethvoice/domain-admins.lock';
const DOMAIN_ADMINS_FAILURES = '/var/run/nethvoice/signin-failures.json';
const DOMAIN_ADMINS_FAILURE_WINDOW = 300;
const DOMAIN_ADMINS_FAILURES_PER_ACCOUNT = 5;
const DOMAIN_ADMINS_FAILURES_PER_ADDRESS = 20;
const DOMAIN_ADMINS_FAILURES_TRACKED = 10000;
const DOMAIN_ADMINS_SIGNIN_MESSAGES = [
    'invalid_request' => 'Invalid request',
    'invalid_credentials' => 'Invalid username or password',
    'password_expired' => 'The password has expired and must be changed',
    'account_conflict' => 'A local administrator has the same username',
    'too_many_attempts' => 'Too many failed attempts, try again later',
    'domain_unavailable' => 'The user domain is not reachable',
];
const DOMAIN_ADMINS_MESSAGES = [
    'invalid_request' => 'Invalid request',
    'own_account' => 'You cannot change the permissions of the account you are signed in with',
    'protected_account' => 'This account cannot be managed here',
    'domain_admin' => 'Domain administrators always have full access',
    'local_account' => 'A local administrator has the same username',
    'user_not_found' => 'The user is not an administrator or does not exist in the user domain',
    'domain_not_manageable' => 'The user domain cannot be managed from NethVoice',
    'domain_unavailable' => 'The user domain is not reachable',
    'provider_error' => 'The user domain did not complete the request',
    'username_taken' => 'The username is already in use in the user domain',
    'invalid_mail' => 'Invalid email address',
    'password_rejected' => 'The password does not meet the rules of the user domain',
    'account_created' => 'The account was created in the user domain, but its permissions could not be granted',
];
const DOMAIN_ADMINS_NEW_USERNAME_PATTERN = '/^[a-z][a-z0-9._-]{0,31}$/D';
const DOMAIN_ADMINS_DISPLAY_NAME_MAX_LENGTH = 50;

function domainAdminsError(int $status, string $code): array
{
    return [$status, ['code' => $code, 'message' => DOMAIN_ADMINS_MESSAGES[$code]]];
}

function domainAdminsSignInError(int $status, string $code, array $headers = []): array
{
    return [$status, ['code' => $code, 'message' => DOMAIN_ADMINS_SIGNIN_MESSAGES[$code]], $headers];
}

function domainAdminsSections(array $permissions): string
{
    return implode(';', array_map(fn($permission) => NETHVOICE_SECTION_PREFIX . $permission, $permissions));
}

function domainAdminsAccountKey($dbh, string $username): string
{
    $stmt = $dbh->prepare('SELECT username FROM ampusers WHERE username = ?');
    $stmt->execute([$username]);
    $stored = $stmt->fetchColumn();

    return strtolower(is_string($stored) ? $stored : $username);
}

function domainAdminsSignInThrottle(string $failuresFile = DOMAIN_ADMINS_FAILURES): SignInThrottle
{
    return new SignInThrottle($failuresFile);
}

class SignInThrottle
{
    private $clock;

    public function __construct(private string $failuresFile = DOMAIN_ADMINS_FAILURES, ?callable $clock = null)
    {
        $this->clock = $clock ?? 'time';
    }

    public function retryAfter(string $address, string $account): ?int
    {
        $now = ($this->clock)();
        $failures = $this->update(fn($failures) => $failures);
        $retry = null;
        foreach ($this->keys($address, $account) as $key => $limit) {
            [$count, $first] = $failures[$key] ?? [0, $now];
            if ($count >= $limit && $now - $first < DOMAIN_ADMINS_FAILURE_WINDOW) {
                $retry = max($retry ?? 0, DOMAIN_ADMINS_FAILURE_WINDOW - ($now - $first));
            }
        }
        return $retry;
    }

    public function fail(string $address, string $account): void
    {
        $now = ($this->clock)();
        $this->update(function ($failures) use ($address, $account, $now) {
            foreach ($this->keys($address, $account) as $key => $limit) {
                if (!isset($failures[$key]) && count($failures) >= DOMAIN_ADMINS_FAILURES_TRACKED) {
                    uasort($failures, fn($a, $b) => $a[1] <=> $b[1]);
                    $failures = array_slice($failures, count($failures) - DOMAIN_ADMINS_FAILURES_TRACKED + 1, null, true);
                }
                [$count, $first] = $failures[$key] ?? [0, $now];
                $failures[$key] = $now - $first < DOMAIN_ADMINS_FAILURE_WINDOW ? [$count + 1, $first] : [1, $now];
            }
            return $failures;
        });
    }

    public function succeed(string $address, string $account): void
    {
        $keys = $this->keys($address, $account);
        $this->update(fn($failures) => array_diff_key($failures, [array_key_first($keys) => true]));
    }

    private function keys(string $address, string $account): array
    {
        return [
            'a' . hash('sha256', $address . "\n" . $account) => DOMAIN_ADMINS_FAILURES_PER_ACCOUNT,
            's' . hash('sha256', $address) => DOMAIN_ADMINS_FAILURES_PER_ADDRESS,
        ];
    }

    private function update(callable $change): array
    {
        $now = ($this->clock)();
        $handle = @fopen($this->failuresFile, 'c+');
        if ($handle === false) {
            return [];
        }
        try {
            flock($handle, LOCK_EX);
            $data = json_decode((string) stream_get_contents($handle), true);
            $failures = [];
            foreach (is_array($data) ? $data : [] as $key => $value) {
                if (is_string($key) && is_array($value) && count($value) === 2 && is_int($value[0]) && is_int($value[1])
                    && $value[1] <= $now && $now - $value[1] < DOMAIN_ADMINS_FAILURE_WINDOW) {
                    $failures[$key] = $value;
                }
            }
            $changed = $change($failures);
            if ($changed !== $failures || $data !== $failures) {
                ftruncate($handle, 0);
                rewind($handle);
                fwrite($handle, json_encode((object) $changed));
            }
            return $changed;
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }
}

function domainAdminsPortalCall(string $url, string $handler, array $payload, string $token): array
{
    try {
        $result = usersAdminCurlTransport($url . '/' . $handler, $payload, $token);
    } catch (\Throwable $e) {
        $result = ['status' => 0, 'body' => ''];
    }
    $data = json_decode($result['body'], true);
    return ['status' => $result['status'], 'data' => is_array($data) ? $data : null];
}

class DomainAdmins
{
    private $portal;
    private $clock;
    private $random;
    private SignInThrottle $throttle;

    public function __construct(
        private $dbh,
        private string $secret,
        private UsersAdminClient $client,
        ?callable $portal,
        private ?string $prefix,
        private string $domain,
        private string $host,
        private string $lockFile = DOMAIN_ADMINS_LOCK,
        private string $failuresFile = DOMAIN_ADMINS_FAILURES,
        ?callable $clock = null,
        ?callable $random = null
    ) {
        $this->portal = $portal;
        $this->clock = $clock ?? 'time';
        $this->random = $random ?? fn() => bin2hex(random_bytes(20));
        $this->throttle = new SignInThrottle($failuresFile, $this->clock);
    }

    public function groupNames(): array
    {
        $groups = usersAdminOwnGroups($this->prefix);
        return $groups ?: array_fill_keys(array_merge([NETHVOICE_SUPERADMIN], NETHVOICE_SECTIONS), '');
    }

    public function permissionsOf(array $groupNames): array
    {
        if ($this->prefix === null) {
            return [];
        }
        $names = array_map('strtolower', array_filter($groupNames, 'is_string'));
        if (in_array(USERS_ADMIN_DOMAIN_ADMINS_GROUP, $names, true) || in_array($this->prefix . '-admins', $names, true)) {
            return [NETHVOICE_SUPERADMIN];
        }
        return array_values(array_filter(NETHVOICE_SECTIONS, fn($section) => in_array($this->prefix . '-' . $section, $names, true)));
    }

    public function signIn($body, string $address): array
    {
        if (!is_array($body) || array_diff(array_keys($body), ['username', 'password'])
            || !is_string($body['username'] ?? null) || !is_string($body['password'] ?? null)
            || $body['username'] === '' || $body['password'] === ''
            || strlen($body['username']) > USERS_ADMIN_MAX_LENGTH || strlen($body['password']) > USERS_ADMIN_MAX_LENGTH) {
            return domainAdminsSignInError(400, 'invalid_request');
        }
        $username = $body['username'];
        $password = $body['password'];
        if (preg_match(USERS_ADMIN_USERNAME_PATTERN, $username) !== 1) {
            return domainAdminsSignInError(400, 'invalid_request');
        }
        $local = $this->ampuser($username);
        $account = strtolower($local['username'] ?? $username);
        $retry = $this->throttle->retryAfter($address, $account);
        if ($retry !== null) {
            return domainAdminsSignInError(429, 'too_many_attempts', ['Retry-After' => (string) $retry]);
        }

        if ($local !== null && !$this->isManaged($local['username'])) {
            $permissions = nethvoiceParseSections($local['sections']);
            if (!$permissions || !hash_equals((string) $local['password_sha1'], sha1($password))) {
                return $this->failed($address, $account);
            }
            $this->throttle->succeed($address, $account);
            return [200, [
                'user' => $local['username'],
                'secretkey' => sha1($local['username'] . $local['password_sha1'] . $this->secret),
                'permissions' => $permissions,
                'source' => 'local',
            ], []];
        }
        if ($this->isReserved($username) || !$this->client->isConfigured() || $this->portal === null || $this->prefix === null) {
            return $this->failed($address, $account);
        }

        $login = ($this->portal)('login', ['username' => $username, 'password' => $password], '');
        if ($login['status'] === 401) {
            return $this->failed($address, $account);
        }
        $claims = $login['data']['claims'] ?? null;
        $token = $login['data']['token'] ?? null;
        if ($login['status'] !== 200 || !is_array($claims) || !is_string($claims['uid'] ?? null) || !is_array($claims['groups'] ?? null)
            || !is_string($token) || $token === '') {
            return domainAdminsSignInError(503, 'domain_unavailable');
        }
        $permissions = $this->permissionsOf($claims['groups']);
        if (!$permissions) {
            return $this->failed($address, $account);
        }
        $expiration = ($this->portal)('get-password-expiration', [], $token);
        if ($expiration['status'] !== 200 || !is_array($expiration['data'])) {
            return domainAdminsSignInError(503, 'domain_unavailable');
        }
        if (!empty($expiration['data']['expired']) || !empty($expiration['data']['must_change'])) {
            return domainAdminsSignInError(403, 'password_expired');
        }
        $uid = $claims['uid'];
        if (preg_match(USERS_ADMIN_USERNAME_PATTERN, $uid) !== 1 || $this->isReserved($uid)) {
            return domainAdminsSignInError(403, 'account_conflict');
        }

        $hash = $this->locked(function () use ($uid, $permissions) {
            $row = $this->ampuser($uid);
            $managed = $this->isManaged($uid);
            if ($row !== null && !$managed) {
                return null;
            }
            $hash = $row !== null && preg_match('/^[0-9a-f]{40}$/D', (string) $row['password_sha1']) === 1 ? (string) $row['password_sha1'] : ($this->random)();
            $this->store($uid, $hash, domainAdminsSections($permissions), $row !== null, $managed);
            return $hash;
        });
        if ($hash === null) {
            return domainAdminsSignInError(403, 'account_conflict');
        }
        $this->throttle->succeed($address, $account);
        return [200, [
            'user' => $uid,
            'secretkey' => sha1($uid . $hash . $this->secret),
            'permissions' => $permissions,
            'source' => 'domain',
        ], []];
    }

    public function overview(string $caller): array
    {
        $groups = null;
        $users = null;
        if (!$this->client->isConfigured()) {
            $reason = 'external';
        } elseif ($this->prefix === null || ($groups = usersAdminGroups($this->client)) === null || ($users = $this->domainUsers()) === null) {
            $reason = 'unavailable';
        } else {
            $reason = null;
        }

        $managed = [];
        foreach ($this->managedRows() as $row) {
            $managed[strtolower($row['username'])] = $row;
        }
        $admins = [];
        $localNames = [];
        foreach ($this->query('SELECT username, sections FROM ampusers') as $row) {
            $name = (string) $row['username'];
            if (isset($managed[strtolower($name)])) {
                continue;
            }
            $localNames[strtolower($name)] = true;
            $permissions = nethvoiceParseSections((string) $row['sections']);
            if (!$permissions || stripos($name, 'support-') === 0) {
                continue;
            }
            $why = strcasecmp($name, $caller) === 0 ? 'own_account' : (strtolower($name) === 'admin' ? 'builtin' : 'local_account');
            $admins[] = $this->entry($name, null, 'local', $permissions, [], null, false, $why === 'local_account', $why);
        }

        if ($reason === null) {
            $roles = usersAdminRoles($groups, $this->prefix);
            $memberships = $this->memberships($groups);
            foreach ($users as $user) {
                $key = strtolower($user['user']);
                $own = $memberships[$key] ?? [];
                $domainAdmin = isset($roles['domain'][$key]);
                if ((!$domainAdmin && !$own) || isset($localNames[$key])) {
                    continue;
                }
                $permissions = $domainAdmin ? [NETHVOICE_SUPERADMIN] : $this->permissionsOf($own);
                if (strcasecmp($user['user'], $caller) === 0) {
                    $why = 'own_account';
                } elseif ($domainAdmin) {
                    $why = 'domain_admin';
                } elseif ($this->isReserved($user['user'])) {
                    $why = 'builtin';
                } else {
                    $why = null;
                }
                $admins[] = $this->entry($user['user'], $user['display_name'], $domainAdmin ? 'domain_admin' : 'domain', $permissions, $own, $user['locked'], $why === null, $why === null, $why);
            }
        } else {
            foreach ($managed as $row) {
                $own = strcasecmp($row['username'], $caller) === 0;
                $admins[] = $this->entry($row['username'], null, 'domain', nethvoiceParseSections((string) ($row['sections'] ?? '')), [], null, false, false, $own ? 'own_account' : 'domain_not_manageable');
            }
        }
        usort($admins, fn($a, $b) => strcasecmp($a['username'], $b['username']));

        return [200, [
            'prefix' => $this->prefix ?? '',
            'groups' => $this->groupNames(),
            'manageable' => $reason === null,
            'reason' => $reason,
            'admins' => $admins,
        ]];
    }

    public function setPermissions(string $username, $body, string $caller): array
    {
        $permissions = $this->requestedPermissions($body);
        if ($permissions === null || preg_match(USERS_ADMIN_USERNAME_PATTERN, $username) !== 1) {
            return domainAdminsError(400, 'invalid_request');
        }
        $error = $this->targetError($username, $caller);
        if ($error !== null) {
            return $error;
        }
        $local = $this->ampuser($username);
        if ($local !== null && !$this->isManaged($local['username'])) {
            return domainAdminsError(403, 'local_account');
        }
        $error = $this->availabilityError();
        if ($error !== null) {
            return $error;
        }
        return $this->locked(function () use ($username, $permissions) {
            $users = $this->domainUsers();
            $groups = $users === null ? null : usersAdminGroups($this->client);
            if ($groups === null) {
                return domainAdminsError(502, 'provider_error');
            }
            $user = null;
            foreach ($users as $candidate) {
                if (strcasecmp($candidate['user'], $username) === 0) {
                    $user = $candidate;
                }
            }
            if ($user === null) {
                return domainAdminsError(404, 'user_not_found');
            }
            if (isset(usersAdminRoles($groups, $this->prefix)['domain'][strtolower($user['user'])])) {
                return domainAdminsError(403, 'domain_admin');
            }
            if (!$this->applyMembership($user['user'], $permissions, $groups)) {
                return domainAdminsError(502, 'provider_error');
            }
            if ($this->isManaged($user['user'])) {
                $this->execute('UPDATE ampusers SET sections = ? WHERE username = ?', [domainAdminsSections($permissions), $user['user']]);
            }
            $own = array_values(array_intersect_key($this->groupNames(), array_flip($permissions)));
            return [200, $this->entry($user['user'], $user['display_name'], 'domain', $permissions, $own, $user['locked'], true, true, null)];
        });
    }

    public function create($body, string $caller): array
    {
        $account = $this->requestedAccount($body);
        $permissions = $account === null ? null : $this->requestedPermissions(['permissions' => $body['permissions']]);
        if ($permissions === null) {
            return domainAdminsError(400, 'invalid_request');
        }
        if (isset($account['mail']) && (strlen($account['mail']) > USERS_ADMIN_MAX_LENGTH || filter_var($account['mail'], FILTER_VALIDATE_EMAIL) === false)) {
            return domainAdminsError(422, 'invalid_mail');
        }
        $username = $account['user'];
        $error = $this->targetError($username, $caller);
        if ($error !== null) {
            return $error;
        }
        if ($this->ampuser($username) !== null) {
            return domainAdminsError(409, 'local_account');
        }
        $error = $this->availabilityError();
        if ($error !== null) {
            return $error;
        }
        return $this->locked(function () use ($account, $username, $permissions) {
            $users = $this->domainUsers();
            $groups = $users === null ? null : usersAdminGroups($this->client);
            if ($groups === null) {
                return domainAdminsError(502, 'provider_error');
            }
            foreach ($users as $user) {
                if (strcasecmp($user['user'], $username) === 0) {
                    return domainAdminsError(409, 'username_taken');
                }
            }
            $result = $this->client->call('add-user', $account);
            if (!usersAdminSucceeded($result)) {
                return $this->addUserError($result);
            }
            if (!$this->applyMembership($username, $permissions, $groups)) {
                $removed = usersAdminSucceeded($this->client->call('remove-user', ['user' => $username]));
                return domainAdminsError(502, $removed ? 'provider_error' : 'account_created');
            }
            $own = array_values(array_intersect_key($this->groupNames(), array_flip($permissions)));
            return [201, $this->entry($username, $account['display_name'], 'domain', $permissions, $own, false, true, true, null)];
        });
    }

    public function remove(string $username, string $caller): array
    {
        if (preg_match(USERS_ADMIN_USERNAME_PATTERN, $username) !== 1) {
            return domainAdminsError(400, 'invalid_request');
        }
        $error = $this->targetError($username, $caller);
        if ($error !== null) {
            return $error;
        }
        $local = $this->ampuser($username);
        if ($local !== null && !$this->isManaged($local['username'])) {
            $this->execute('DELETE FROM ampusers WHERE username = ?', [$local['username']]);
            return [204, null];
        }
        $error = $this->availabilityError();
        if ($error !== null) {
            return $error;
        }
        return $this->locked(function () use ($username) {
            $groups = usersAdminGroups($this->client);
            if ($groups === null) {
                return domainAdminsError(502, 'provider_error');
            }
            if (isset(usersAdminRoles($groups, $this->prefix)['domain'][strtolower($username)])) {
                return domainAdminsError(403, 'domain_admin');
            }
            $member = ($this->memberships($groups)[strtolower($username)] ?? []) !== [];
            $managed = $this->managedName($username);
            if (!$member && $managed === null) {
                return domainAdminsError(404, 'user_not_found');
            }
            if ($member && !$this->applyMembership($username, [], $groups)) {
                return domainAdminsError(502, 'provider_error');
            }
            if ($managed !== null) {
                $this->forget($managed);
            }
            return [204, null];
        });
    }

    public function sync(): bool
    {
        return $this->locked(function () {
            $rows = [];
            foreach ($this->managedRows() as $row) {
                if ($row['domain'] !== $this->domain || $row['sections'] === null) {
                    $this->forget($row['username']);
                    continue;
                }
                $rows[] = $row;
            }
            if (!$rows || !$this->client->isConfigured()) {
                return true;
            }
            if ($this->prefix === null) {
                return false;
            }
            $groups = usersAdminGroups($this->client);
            $users = $groups === null ? null : $this->domainUsers();
            if ($users === null) {
                return false;
            }
            $active = [];
            foreach ($users as $user) {
                if ($user['locked'] !== true) {
                    $active[strtolower($user['user'])] = true;
                }
            }
            $memberships = $this->memberships($groups);
            $roles = usersAdminRoles($groups, $this->prefix);
            foreach ($rows as $row) {
                $key = strtolower($row['username']);
                $permissions = !isset($active[$key]) ? [] : (isset($roles['domain'][$key]) ? [NETHVOICE_SUPERADMIN] : $this->permissionsOf($memberships[$key] ?? []));
                if (!$permissions) {
                    $this->forget($row['username']);
                    continue;
                }
                $sections = domainAdminsSections($permissions);
                if ($sections !== $row['sections']) {
                    $this->execute('UPDATE ampusers SET sections = ? WHERE username = ?', [$sections, $row['username']]);
                }
                $this->execute('UPDATE rest_domain_admins SET synced_at = ? WHERE username = ?', [$this->now(), $row['username']]);
            }
            return true;
        });
    }

    private function entry(string $username, ?string $displayName, string $source, array $permissions, array $groups, ?bool $locked, bool $editable, bool $removable, ?string $reason): array
    {
        return [
            'username' => $username,
            'display_name' => $displayName,
            'source' => $source,
            'permissions' => $permissions,
            'groups' => array_values($groups),
            'locked' => $locked,
            'editable' => $editable,
            'removable' => $removable,
            'reason' => $reason,
        ];
    }

    private function requestedPermissions($body): ?array
    {
        if (!is_array($body) || array_keys($body) !== ['permissions'] || !is_array($body['permissions']) || !array_is_list($body['permissions'])) {
            return null;
        }
        $permissions = $body['permissions'];
        if ($permissions === [] || count($permissions) !== count(array_unique($permissions, SORT_REGULAR))) {
            return null;
        }
        foreach ($permissions as $permission) {
            if (!is_string($permission) || !in_array($permission, array_merge([NETHVOICE_SUPERADMIN], NETHVOICE_SECTIONS), true)) {
                return null;
            }
        }
        if (in_array(NETHVOICE_SUPERADMIN, $permissions, true)) {
            return count($permissions) === 1 ? $permissions : null;
        }
        return array_values(array_intersect(NETHVOICE_SECTIONS, $permissions));
    }

    private function requestedAccount($body): ?array
    {
        if (!is_array($body) || array_diff(array_keys($body), ['username', 'display_name', 'password', 'mail', 'permissions'])
            || !isset($body['permissions']) || !is_string($body['username'] ?? null) || !is_string($body['display_name'] ?? null)
            || !is_string($body['password'] ?? null) || (array_key_exists('mail', $body) && !is_string($body['mail']))) {
            return null;
        }
        $displayName = trim($body['display_name']);
        if (preg_match(DOMAIN_ADMINS_NEW_USERNAME_PATTERN, $body['username']) !== 1
            || preg_match('/^[^\x00-\x1F\x7F]{1,' . DOMAIN_ADMINS_DISPLAY_NAME_MAX_LENGTH . '}$/u', $displayName) !== 1
            || $body['password'] === '' || strlen($body['password']) > USERS_ADMIN_MAX_LENGTH) {
            return null;
        }
        $account = ['user' => $body['username'], 'display_name' => $displayName, 'password' => $body['password'], 'locked' => false, 'groups' => []];
        $mail = trim($body['mail'] ?? '');
        return $mail === '' ? $account : $account + ['mail' => $mail];
    }

    private function addUserError(array $result): array
    {
        $errors = is_array($result['data']['error'] ?? null) ? array_filter($result['data']['error'], 'is_array') : [];
        if (in_array('user_already_exists', array_column($errors, 'error'), true)) {
            return domainAdminsError(409, 'username_taken');
        }
        $fields = array_column($errors, 'field');
        if (in_array('mail', $fields, true)) {
            return domainAdminsError(422, 'invalid_mail');
        }
        $message = $result['data']['message'] ?? null;
        if (in_array('password', $fields, true) || ($result['status'] === 200 && is_string($message) && isset(USERS_ADMIN_POLICY_ERRORS[$message]))) {
            return domainAdminsError(422, 'password_rejected');
        }
        return domainAdminsError(502, 'provider_error');
    }

    private function targetError(string $username, string $caller): ?array
    {
        if (strcasecmp($username, $caller) === 0) {
            return domainAdminsError(403, 'own_account');
        }
        if ($this->isReserved($username) || in_array(strtolower($username), USERS_ADMIN_PROTECTED_ACCOUNTS, true)) {
            return domainAdminsError(403, 'protected_account');
        }
        return null;
    }

    private function availabilityError(): ?array
    {
        if (!$this->client->isConfigured()) {
            return domainAdminsError(409, 'domain_not_manageable');
        }
        if ($this->prefix === null || $this->client->token() === '') {
            return domainAdminsError(503, 'domain_unavailable');
        }
        return null;
    }

    private function isReserved(string $username): bool
    {
        return strtolower($username) === 'admin' || stripos($username, 'support-') === 0;
    }

    private function domainUsers(): ?array
    {
        $result = $this->client->call('list-users');
        if (!usersAdminSucceeded($result) || !is_array($result['data']['users'] ?? null)) {
            return null;
        }
        $users = [];
        foreach ($result['data']['users'] as $user) {
            if (!is_array($user) || !is_string($user['user'] ?? null) || $user['user'] === '') {
                continue;
            }
            $users[] = [
                'user' => $user['user'],
                'display_name' => is_string($user['display_name'] ?? null) ? $user['display_name'] : null,
                'locked' => is_bool($user['locked'] ?? null) ? $user['locked'] : null,
            ];
        }
        return $users;
    }

    private function memberships(array $groups): array
    {
        $own = array_flip(array_map('strtolower', usersAdminOwnGroups($this->prefix)));
        $memberships = [];
        foreach ($groups as $group) {
            if (!isset($own[strtolower($group['group'])])) {
                continue;
            }
            foreach ($group['users'] as $member) {
                $memberships[strtolower($member)][] = strtolower($group['group']);
            }
        }
        return $memberships;
    }

    private function applyMembership(string $username, array $permissions, array $groups): bool
    {
        $existing = [];
        foreach ($groups as $group) {
            $existing[strtolower($group['group'])] = $group;
        }
        foreach (usersAdminOwnGroups($this->prefix) as $permission => $name) {
            $group = $existing[$name] ?? null;
            $members = $group['users'] ?? [];
            $others = array_values(array_filter($members, fn($member) => strcasecmp($member, $username) !== 0));
            $wanted = in_array($permission, $permissions, true);
            if ($wanted === (count($others) !== count($members))) {
                continue;
            }
            if ($group !== null) {
                $result = $this->writeGroup('alter-group', ['group' => $group['group'], 'users' => $wanted ? array_merge($others, [$username]) : $others]);
            } else {
                $result = $this->writeGroup('add-group', ['group' => $name, 'description' => $this->description($permission), 'users' => [$username]]);
            }
            if (!$result) {
                return false;
            }
        }
        return true;
    }

    private function writeGroup(string $handler, array $payload): bool
    {
        if (!in_array(strtolower($payload['group']), usersAdminOwnGroups($this->prefix), true)) {
            throw new LogicException('refusing to change a group that does not belong to this NethVoice');
        }
        return usersAdminSucceeded($this->client->call($handler, $payload));
    }

    private function description(string $permission): string
    {
        $name = trim('NethVoice ' . $this->host);
        return $permission === NETHVOICE_SUPERADMIN ? "$name: full access" : $name . ': ' . ucfirst($permission) . ' section';
    }

    private function ampuser(string $username): ?array
    {
        $rows = $this->query('SELECT username, password_sha1, sections FROM ampusers WHERE username = ?', [$username]);
        return $rows ? ['username' => (string) $rows[0]['username'], 'password_sha1' => (string) $rows[0]['password_sha1'], 'sections' => (string) $rows[0]['sections']] : null;
    }

    private function isManaged(string $username): bool
    {
        return $this->managedName($username) !== null;
    }

    private function managedName(string $username): ?string
    {
        foreach ($this->query('SELECT username FROM rest_domain_admins') as $row) {
            if (strcasecmp((string) $row['username'], $username) === 0) {
                return (string) $row['username'];
            }
        }
        return null;
    }

    private function managedRows(): array
    {
        return array_map(fn($row) => [
            'username' => (string) $row['username'],
            'domain' => (string) $row['domain'],
            'sections' => $row['sections'] === null ? null : (string) $row['sections'],
        ], $this->query('SELECT d.username, d.domain, a.sections FROM rest_domain_admins d LEFT JOIN ampusers a ON a.username = d.username'));
    }

    private function store(string $username, string $hash, string $sections, bool $exists, bool $managed): void
    {
        if ($exists) {
            $this->execute('UPDATE ampusers SET sections = ? WHERE username = ?', [$sections, $username]);
        } else {
            $this->execute('INSERT INTO ampusers (username, password_sha1, sections) VALUES (?, ?, ?)', [$username, $hash, $sections]);
        }
        if ($managed) {
            $this->execute('UPDATE rest_domain_admins SET domain = ?, synced_at = ? WHERE username = ?', [$this->domain, $this->now(), $username]);
        } else {
            $this->execute('INSERT INTO rest_domain_admins (username, domain, created_at, synced_at) VALUES (?, ?, ?, ?)', [$username, $this->domain, $this->now(), $this->now()]);
        }
    }

    private function forget(string $username): void
    {
        $this->execute('DELETE FROM ampusers WHERE username = ?', [$username]);
        $this->execute('DELETE FROM rest_domain_admins WHERE username = ?', [$username]);
    }

    private function now(): string
    {
        return gmdate('Y-m-d H:i:s', ($this->clock)());
    }

    private function query(string $sql, array $parameters = []): array
    {
        $stmt = $this->dbh->prepare($sql);
        $stmt->execute($parameters);
        return $stmt->fetchAll(\PDO::FETCH_ASSOC);
    }

    private function execute(string $sql, array $parameters): void
    {
        $this->dbh->prepare($sql)->execute($parameters);
    }

    private function locked(callable $work)
    {
        $lock = @fopen($this->lockFile, 'c');
        if ($lock !== false) {
            flock($lock, LOCK_EX);
        }
        try {
            return $work();
        } finally {
            if ($lock !== false) {
                flock($lock, LOCK_UN);
                fclose($lock);
            }
        }
    }

    private function failed(string $address, string $account): array
    {
        $this->throttle->fail($address, $account);
        return domainAdminsSignInError(401, 'invalid_credentials');
    }
}

function domainAdminsDefault(): DomainAdmins
{
    require __DIR__ . '/../config.inc.php';
    $url = getUserPortalUrl();
    return new DomainAdmins(
        FreePBX::Database(),
        (string) ($config['settings']['secretkey'] ?? ''),
        usersAdminDefaultClient(),
        $url === '' ? null : fn(string $handler, array $payload, string $token) => domainAdminsPortalCall($url, $handler, $payload, $token),
        usersAdminGroupPrefix(),
        (string) ($_ENV['USER_DOMAIN'] ?? getenv('USER_DOMAIN') ?: ''),
        (string) ($_ENV['NETHVOICE_HOST'] ?? getenv('NETHVOICE_HOST') ?: '')
    );
}
