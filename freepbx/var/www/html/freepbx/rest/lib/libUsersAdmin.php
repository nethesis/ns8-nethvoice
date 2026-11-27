<?php

#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

const USERS_ADMIN_PROTECTED_ACCOUNTS = ['admin', 'administrator', 'guest', 'krbtgt', 'ldapservice'];
const USERS_ADMIN_DOMAIN_ADMINS_GROUP = 'domain admins';
const USERS_ADMIN_PRIVILEGED_GROUPS = ['administrators', 'account operators', 'enterprise admins', 'schema admins', 'server operators', 'print operators', 'backup operators'];
const USERS_ADMIN_USERNAME_PATTERN = '/^[A-Za-z0-9._@-]+$/D';
const USERS_ADMIN_MAX_LENGTH = 256;
const USERS_ADMIN_STATUS_CACHE = '/var/run/nethvoice/users-domain.json';
const USERS_ADMIN_STATUS_CACHE_SECONDS = 30;
const USERS_ADMIN_TOKEN_CACHE = '/var/run/nethvoice/users-admin-token.json';
const USERS_ADMIN_TOKEN_CACHE_SECONDS = 300;
const USERS_ADMIN_SYNC_LOCK = '/var/run/nethvoice/users-sync.lock';
const USERS_ADMIN_MEMBERS_LOCK = '/var/run/nethvoice/users-members.lock';
const USERS_ADMIN_SYNC_WAIT_MICROSECONDS = 6000000;
const USERS_ADMIN_SYNC_STEP_MICROSECONDS = 250000;
const USERS_ADMIN_DISPLAY_NAME_MAX_LENGTH = 50;
const USERS_ADMIN_SECTIONS = ['dashboard', 'users', 'trunks', 'routes', 'phones', 'integrations', 'settings'];
const USERS_ADMIN_GROUP_PREFIX_PATTERN = '/^nethvoice([a-z0-9-]{0,22}[a-z0-9])?$/D';
const USERS_ADMIN_NETHVOICE_GROUP_PATTERN = '/^nethvoice(?:[a-z0-9-]*[a-z0-9])?-(?:admins|dashboard|users|trunks|routes|phones|integrations|settings)$/D';
const USERS_ADMIN_POLICY_ERRORS = [
    'error_password_complexity' => 'password_complexity',
    'error_password_history' => 'password_history',
    'error_password_same' => 'password_same',
];
const USERS_ADMIN_MESSAGES = [
    'invalid_request' => 'Invalid request',
    'protected_account' => 'This account cannot be managed here',
    'own_account' => 'You cannot change the account you are signed in with',
    'domain_admin' => 'Domain administrator accounts are managed in the user domain',
    'superadmin_account' => 'The account of another superadmin cannot be changed here',
    'nethvoice_admin' => 'Only the superadmin can change the account of an administrator',
    'domain_not_manageable' => 'The user domain cannot be managed from NethVoice',
    'domain_unavailable' => 'The user domain is not reachable',
    'provider_error' => 'The user domain did not complete the request',
    'password_complexity' => 'The password does not meet the complexity rules of the user domain',
    'password_history' => 'The password was used recently',
    'password_same' => 'The password is the same as the current one',
    'password_rejected' => 'The password does not meet the rules of the user domain',
    'invalid_mail' => 'Invalid email address',
    'invalid_display_name' => 'The display name contains control characters',
    'user_not_found' => 'The user does not exist in the user domain',
    'display_name_too_long' => 'The display name is too long',
    'not_instance_user' => 'Only the superadmin can manage a user who is not a member of this NethVoice',
];

class UsersAdminTokenCache
{
    public function __construct(private string $file, private string $key, private $clock = 'time')
    {
    }

    public function get(): ?string
    {
        $data = is_file($this->file) ? json_decode((string) @file_get_contents($this->file), true) : null;
        $now = ($this->clock)();
        if (!is_array($data) || !is_string($data['key'] ?? null) || !hash_equals($this->key, $data['key'])
            || !is_string($data['token'] ?? null) || $data['token'] === '' || !is_int($data['stored_at'] ?? null)
            || $now < $data['stored_at'] || $now - $data['stored_at'] >= USERS_ADMIN_TOKEN_CACHE_SECONDS) {
            return null;
        }
        return $data['token'];
    }

    public function put(string $token): void
    {
        $directory = dirname($this->file);
        $temporary = is_dir($directory) ? @tempnam($directory, 'token') : false;
        if ($temporary === false) {
            return;
        }
        if (dirname($temporary) !== $directory || !@chmod($temporary, 0600)
            || @file_put_contents($temporary, json_encode(['key' => $this->key, 'token' => $token, 'stored_at' => ($this->clock)()])) === false
            || !@rename($temporary, $this->file)) {
            @unlink($temporary);
        }
    }

    public function drop(): void
    {
        @unlink($this->file);
    }
}

class UsersAdminClient
{
    private ?string $token = null;
    private bool $tokenFromCache = false;

    public function __construct(private string $url, private $tokenProvider, private $transport, private ?UsersAdminTokenCache $tokenCache = null)
    {
    }

    public function isConfigured(): bool
    {
        return $this->url !== '';
    }

    public function token(): string
    {
        if ($this->token === null) {
            $cached = $this->isConfigured() && $this->tokenCache !== null ? $this->tokenCache->get() : null;
            $this->tokenFromCache = $cached !== null;
            $this->token = $cached ?? $this->login();
        }
        return $this->token;
    }

    private function login(): string
    {
        $token = $this->isConfigured() ? ($this->tokenProvider)() : '';
        $token = is_string($token) ? $token : '';
        if ($token !== '' && $this->tokenCache !== null) {
            $this->tokenCache->put($token);
        }
        return $token;
    }

    public function call(string $handler, array $payload = []): array
    {
        $result = $this->send($handler, $payload);
        if ($this->tokenFromCache && in_array($result['status'], [401, 403], true)) {
            $this->tokenCache->drop();
            $this->tokenFromCache = false;
            $this->token = $this->login();
            $result = $this->send($handler, $payload);
        }
        return $result;
    }

    private function send(string $handler, array $payload): array
    {
        $token = $this->token();
        if ($token === '') {
            return ['status' => 0, 'data' => null];
        }
        try {
            $result = ($this->transport)($this->url . '/' . $handler, $payload, $token);
        } catch (\Throwable $e) {
            $result = null;
        }
        $status = is_array($result) && is_int($result['status'] ?? null) ? $result['status'] : 0;
        $body = is_array($result) && is_string($result['body'] ?? null) ? $result['body'] : '';
        $data = json_decode($body, true);
        if ($status === 0 || $status >= 500) {
            error_log('users-admin ' . $handler . ' failed with status ' . $status);
        }
        return ['status' => $status, 'data' => is_array($data) ? $data : null];
    }
}

function usersAdminCurlTransport(string $url, array $payload, string $token): array
{
    $ch = curl_init($url);
    setUserPortalCurlDefaults($ch, ['Content-Type: application/json', 'Authorization: Bearer ' . $token]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload ?: new \stdClass()));
    $body = curl_exec($ch);
    $status = curl_errno($ch) ? 0 : (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['status' => $status, 'body' => is_string($body) ? $body : ''];
}

function usersAdminDefaultClient(): UsersAdminClient
{
    $url = getUserPortalUrl();
    $key = hash_hmac('sha256', $url . "\n" . (string) ($_ENV['REDIS_USER'] ?? ''), (string) ($_ENV['REDIS_PASSWORD'] ?? ''));
    return new UsersAdminClient($url, 'getToken', 'usersAdminCurlTransport', new UsersAdminTokenCache(USERS_ADMIN_TOKEN_CACHE, $key));
}

function usersAdminRunSynchronization(): array
{
    exec('/usr/bin/fwconsole userman --syncall --force 2>&1', $output, $status);
    return [$status, implode("\n", $output)];
}

function usersAdminLockSynchronization(string $lockFile, callable $sleep, int &$budget)
{
    $lock = @fopen($lockFile, 'c');
    if ($lock === false) {
        return null;
    }
    while (!@flock($lock, LOCK_EX | LOCK_NB)) {
        if ($budget <= 0) {
            fclose($lock);
            return null;
        }
        $sleep(USERS_ADMIN_SYNC_STEP_MICROSECONDS);
        $budget -= USERS_ADMIN_SYNC_STEP_MICROSECONDS;
    }
    return $lock;
}

function usersAdminSynchronize(?callable $run = null, ?callable $sleep = null, string $lockFile = USERS_ADMIN_SYNC_LOCK): bool
{
    $run = $run ?? 'usersAdminRunSynchronization';
    $sleep = $sleep ?? 'usleep';
    $budget = USERS_ADMIN_SYNC_WAIT_MICROSECONDS;
    $lock = usersAdminLockSynchronization($lockFile, $sleep, $budget);
    try {
        while (true) {
            [$status, $output] = $run();
            if ($status === 0) {
                triggerMiddlewareProfilesReload();
                return true;
            }
            if ($budget <= 0 || stripos((string) $output, 'already syncing') === false) {
                break;
            }
            $sleep(USERS_ADMIN_SYNC_STEP_MICROSECONDS);
            $budget -= USERS_ADMIN_SYNC_STEP_MICROSECONDS;
        }
        error_log('users-admin: FreePBX user synchronization failed (exit ' . $status . ')');
        return false;
    } finally {
        if ($lock !== null) {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }
}

function usersAdminSynchronizationRunning(string $lockFile = USERS_ADMIN_SYNC_LOCK): bool
{
    $lock = @fopen($lockFile, 'c');
    if ($lock === false) {
        return false;
    }
    $free = @flock($lock, LOCK_EX | LOCK_NB);
    if ($free) {
        flock($lock, LOCK_UN);
    }
    fclose($lock);
    return !$free;
}

function usersAdminStartSynchronization(?callable $system = null, string $lockFile = USERS_ADMIN_SYNC_LOCK): bool
{
    if (usersAdminSynchronizationRunning($lockFile)) {
        return false;
    }
    ($system ?? 'system')('/usr/bin/flock -n ' . escapeshellarg($lockFile) . ' /usr/bin/fwconsole userman --syncall --force > /dev/null 2>&1 &');
    return true;
}

function usersAdminScheduleReload(): void
{
    system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null 2>&1 &');
}

function usersAdminApplyDisplayName(string $username, string $displayName, $dbh = null, $voicemail = null, ?callable $reload = null): bool
{
    $dbh = $dbh ?? FreePBX::Database();
    $stmt = $dbh->prepare('SELECT id, default_extension FROM userman_users WHERE username = ?');
    $stmt->execute([$username]);
    $user = $stmt->fetch(\PDO::FETCH_ASSOC);
    if (!is_array($user) || empty($user['default_extension']) || $user['default_extension'] === 'none') {
        return false;
    }
    $mainextension = (string) $user['default_extension'];
    $stmt = $dbh->prepare('SELECT extension FROM rest_devices_phones WHERE user_id = ? AND extension IS NOT NULL AND extension != ""');
    $stmt->execute([$user['id']]);
    $extensions = array_unique(array_merge([$mainextension], array_map('strval', $stmt->fetchAll(\PDO::FETCH_COLUMN))));

    $description = (string) iconv_substr($displayName, 0, USERS_ADMIN_DISPLAY_NAME_MAX_LENGTH, 'UTF-8');
    $update = $dbh->prepare('UPDATE devices SET description = ? WHERE id = ? AND description != ?');
    $changed = false;
    foreach ($extensions as $extension) {
        $update->execute([$description, $extension, $description]);
        $changed = $update->rowCount() > 0 || $changed;
    }

    $voicemail = $voicemail ?? FreePBX::create()->Voicemail;
    $mailbox = $voicemail->getMailbox($mainextension, false);
    if (is_array($mailbox) && ($mailbox['name'] ?? null) !== $displayName) {
        $mailbox['name'] = $displayName;
        $voicemail->updateMailbox($mainextension, $mailbox, false);
        $changed = true;
    }

    if ($changed) {
        ($reload ?? 'usersAdminScheduleReload')();
    }
    return $changed;
}

function usersAdminError(int $status, string $code): array
{
    return [$status, ['code' => $code, 'message' => USERS_ADMIN_MESSAGES[$code]]];
}

function usersAdminSucceeded(array $result): bool
{
    return $result['status'] === 200 && ($result['data']['status'] ?? null) === 'success';
}

function usersAdminDomainStatus(UsersAdminClient $client, ?string $cacheFile = USERS_ADMIN_STATUS_CACHE, ?int $now = null): array
{
    if (!$client->isConfigured()) {
        return ['manageable' => false, 'reason' => 'external'];
    }
    $now = $now ?? time();
    $cached = $cacheFile !== null && is_file($cacheFile) ? json_decode((string) @file_get_contents($cacheFile), true) : null;
    if (is_array($cached) && ($cached['manageable'] ?? null) === true && is_int($cached['checked_at'] ?? null)
        && $now >= $cached['checked_at'] && $now - $cached['checked_at'] < USERS_ADMIN_STATUS_CACHE_SECONDS) {
        $manageable = $cached['manageable'];
    } else {
        $manageable = $client->token() !== '';
        if ($cacheFile !== null && $manageable) {
            @file_put_contents($cacheFile, json_encode(['manageable' => $manageable, 'checked_at' => $now]));
        } elseif ($cacheFile !== null) {
            @unlink($cacheFile);
        }
    }
    return ['manageable' => $manageable, 'reason' => $manageable ? null : 'unavailable'];
}

function usersAdminAvailabilityError(UsersAdminClient $client): ?array
{
    if (!$client->isConfigured()) {
        return usersAdminError(409, 'domain_not_manageable');
    }
    if ($client->token() === '') {
        return usersAdminError(503, 'domain_unavailable');
    }
    return null;
}

function usersAdminGroupPrefix(): ?string
{
    $prefix = $_ENV['NETHVOICE_ADMIN_GROUP_PREFIX'] ?? getenv('NETHVOICE_ADMIN_GROUP_PREFIX');
    return is_string($prefix) && preg_match(USERS_ADMIN_GROUP_PREFIX_PATTERN, $prefix) === 1 ? $prefix : null;
}

function usersAdminOwnGroups(?string $prefix): array
{
    if ($prefix === null) {
        return [];
    }
    $groups = ['superadmin' => $prefix . '-admins'];
    foreach (USERS_ADMIN_SECTIONS as $section) {
        $groups[$section] = $prefix . '-' . $section;
    }
    return $groups;
}

function usersAdminGroups(UsersAdminClient $client): ?array
{
    $result = $client->call('list-groups');
    if (!usersAdminSucceeded($result) || !is_array($result['data']['groups'] ?? null)) {
        return null;
    }
    $groups = [];
    foreach ($result['data']['groups'] as $group) {
        if (!is_array($group) || !is_string($group['group'] ?? null)) {
            continue;
        }
        $members = array_values(array_filter(is_array($group['users'] ?? null) ? $group['users'] : [], fn($member) => is_string($member) && $member !== ''));
        $groups[] = ['group' => $group['group'], 'users' => $members];
    }
    return $groups;
}

function usersAdminRoles(array $groups, ?string $prefix): array
{
    $own = array_flip(array_map('strtolower', usersAdminOwnGroups($prefix)));
    $roles = ['domain' => [], 'superadmin' => [], 'sections' => [], 'other' => [], 'privileged' => []];
    foreach ($groups as $group) {
        $name = strtolower($group['group']);
        if (in_array($name, USERS_ADMIN_PRIVILEGED_GROUPS, true)) {
            $role = 'privileged';
        } elseif ($name === USERS_ADMIN_DOMAIN_ADMINS_GROUP) {
            $role = 'domain';
        } elseif ($name === $prefix . '-admins') {
            $role = 'superadmin';
        } elseif (isset($own[$name])) {
            $role = 'sections';
        } elseif (preg_match(USERS_ADMIN_NETHVOICE_GROUP_PATTERN, $name) === 1) {
            $role = 'other';
        } else {
            continue;
        }
        foreach ($group['users'] as $member) {
            $roles[$role][strtolower($member)] = true;
        }
    }
    return $roles;
}

function usersAdminAccess(array $roles, string $username): ?string
{
    $username = strtolower($username);
    if (isset($roles['domain'][$username]) || isset($roles['superadmin'][$username])) {
        return 'superadmin';
    }
    if (isset($roles['sections'][$username])) {
        return 'sections';
    }
    return isset($roles['other'][$username]) ? 'other_instance' : null;
}

function usersAdminListAccounts(UsersAdminClient $client): array
{
    $unavailable = usersAdminAvailabilityError($client);
    if ($unavailable !== null) {
        return $unavailable;
    }
    $result = $client->call('list-users');
    if (!usersAdminSucceeded($result) || !is_array($result['data']['users'] ?? null)) {
        return usersAdminError(502, 'provider_error');
    }
    $groups = usersAdminGroups($client);
    $roles = $groups === null ? null : usersAdminRoles($groups, usersAdminGroupPrefix());
    $members = $groups === null ? null : usersAdminInstanceMembers($client, true, $groups);
    $accounts = [];
    foreach ($result['data']['users'] as $user) {
        if (!is_array($user) || !is_string($user['user'] ?? null) || $user['user'] === '') {
            continue;
        }
        $accounts[] = [
            'username' => $user['user'],
            'display_name' => is_string($user['display_name'] ?? null) ? $user['display_name'] : '',
            'mail' => is_string($user['mail'] ?? null) ? $user['mail'] : '',
            'locked' => is_bool($user['locked'] ?? null) ? $user['locked'] : null,
            'domain_admin' => $roles === null ? null : isset($roles['domain'][strtolower($user['user'])]),
            'admin_access' => $roles === null ? null : usersAdminAccess($roles, $user['user']),
            'member' => $members === null ? null : isset($members[strtolower($user['user'])]),
        ];
    }
    return [200, $accounts];
}

function usersAdminAccountError(UsersAdminClient $client, string $username): ?array
{
    $result = $client->call('list-users');
    if (!usersAdminSucceeded($result) || !is_array($result['data']['users'] ?? null)) {
        return usersAdminError(502, 'provider_error');
    }
    foreach ($result['data']['users'] as $user) {
        if (is_array($user) && is_string($user['user'] ?? null) && strcasecmp($user['user'], $username) === 0) {
            return null;
        }
    }
    return usersAdminError(404, 'user_not_found');
}

function usersAdminTargetError(string $username, array $caller, bool $selfAllowed): ?array
{
    if (preg_match(USERS_ADMIN_USERNAME_PATTERN, $username) !== 1) {
        return usersAdminError(400, 'invalid_request');
    }
    if (in_array(strtolower($username), USERS_ADMIN_PROTECTED_ACCOUNTS, true)) {
        return usersAdminError(403, 'protected_account');
    }
    if (!$selfAllowed && strcasecmp($username, (string) ($caller['username'] ?? '')) === 0) {
        return usersAdminError(403, 'own_account');
    }
    return null;
}

function usersAdminProtectedTargetError(UsersAdminClient $client, string $username, array $caller): ?array
{
    if (strcasecmp($username, (string) ($caller['username'] ?? '')) === 0) {
        return null;
    }
    $groups = usersAdminGroups($client);
    if ($groups === null) {
        return usersAdminError(502, 'provider_error');
    }
    $roles = usersAdminRoles($groups, usersAdminGroupPrefix());
    $username = strtolower($username);
    if (isset($roles['domain'][$username]) || isset($roles['privileged'][$username])) {
        return usersAdminError(403, 'domain_admin');
    }
    if (isset($roles['superadmin'][$username]) || isset($roles['other'][$username])) {
        return usersAdminError(403, 'superadmin_account');
    }
    if (isset($roles['sections'][$username]) && empty($caller['superadmin'])) {
        return usersAdminError(403, 'nethvoice_admin');
    }
    return null;
}

function usersAdminHasExtension(string $username): bool
{
    $stmt = FreePBX::Database()->prepare('SELECT default_extension FROM userman_users WHERE LOWER(username) = LOWER(?)');
    $stmt->execute([$username]);
    foreach ($stmt->fetchAll(\PDO::FETCH_COLUMN) as $extension) {
        $extension = trim((string) $extension);
        if ($extension !== '' && $extension !== 'none') {
            return true;
        }
    }
    return false;
}

function usersAdminExtensionUsers(): array
{
    $stmt = FreePBX::Database()->prepare("SELECT username FROM userman_users WHERE default_extension IS NOT NULL AND default_extension != '' AND default_extension != 'none'");
    $stmt->execute([]);
    return array_values(array_map('strval', $stmt->fetchAll(\PDO::FETCH_COLUMN)));
}

function usersAdminMembersGroup(): ?string
{
    $prefix = usersAdminGroupPrefix();
    return $prefix === null ? null : $prefix . '-members';
}

function usersAdminMembersOf(array $groups): ?array
{
    $name = usersAdminMembersGroup();
    foreach ($name === null ? [] : $groups as $group) {
        if (strcasecmp($group['group'], $name) === 0) {
            return array_fill_keys(array_map('strtolower', $group['users']), true);
        }
    }
    return null;
}

function usersAdminWithMembersLock(string $lockFile, callable $work)
{
    $lock = @fopen($lockFile, 'c');
    if ($lock !== false && !@flock($lock, LOCK_EX)) {
        fclose($lock);
        $lock = false;
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

function usersAdminAddMembers(UsersAdminClient $client, array $usernames, ?callable $extensionUsers = null, string $lockFile = USERS_ADMIN_MEMBERS_LOCK): bool
{
    $name = usersAdminMembersGroup();
    if ($name === null || !$client->isConfigured()) {
        return true;
    }
    $usernames = array_values(array_filter($usernames, fn($username) => is_string($username) && $username !== '' && !in_array(strtolower($username), USERS_ADMIN_PROTECTED_ACCOUNTS, true)));
    return (bool) usersAdminWithMembersLock($lockFile, function () use ($client, $name, $usernames, $extensionUsers) {
        $groups = usersAdminGroups($client);
        if ($groups === null) {
            return false;
        }
        foreach ($groups as $group) {
            if (strcasecmp($group['group'], $name) !== 0) {
                continue;
            }
            $members = $group['users'];
            $known = array_fill_keys(array_map('strtolower', $members), true);
            foreach ($usernames as $username) {
                if (!isset($known[strtolower($username)])) {
                    $known[strtolower($username)] = true;
                    $members[] = $username;
                }
            }
            if (count($members) === count($group['users'])) {
                return true;
            }
            return usersAdminSucceeded($client->call('alter-group', ['group' => $group['group'], 'users' => $members]));
        }
        $result = $client->call('list-users');
        if (!usersAdminSucceeded($result) || !is_array($result['data']['users'] ?? null)) {
            return false;
        }
        $domain = [];
        foreach ($result['data']['users'] as $user) {
            if (is_array($user) && is_string($user['user'] ?? null) && $user['user'] !== '') {
                $domain[strtolower($user['user'])] = $user['user'];
            }
        }
        $members = [];
        foreach (array_merge(($extensionUsers ?? 'usersAdminExtensionUsers')(), $usernames) as $username) {
            $key = strtolower((string) $username);
            if (isset($domain[$key]) && !in_array($key, USERS_ADMIN_PROTECTED_ACCOUNTS, true)) {
                $members[$key] = $domain[$key];
            }
        }
        $host = trim('NethVoice ' . (string) ($_ENV['NETHVOICE_HOST'] ?? getenv('NETHVOICE_HOST') ?: ''));
        return usersAdminSucceeded($client->call('add-group', ['group' => $name, 'description' => $host . ': users', 'users' => array_values($members)]));
    });
}

function usersAdminPasswordPolicy(UsersAdminClient $client): ?array
{
    if (!$client->isConfigured()) {
        return null;
    }
    $result = $client->call('get-password-policy');
    return usersAdminSucceeded($result) && is_array($result['data']['policy'] ?? null) ? $result['data']['policy'] : null;
}

function usersAdminRemoveCreatedAccount(UsersAdminClient $client, string $username): ?bool
{
    $result = $client->call('list-users');
    if (!usersAdminSucceeded($result) || !is_array($result['data']['users'] ?? null)) {
        return null;
    }
    foreach ($result['data']['users'] as $user) {
        if (is_array($user) && is_string($user['user'] ?? null) && strcasecmp($user['user'], $username) === 0) {
            return usersAdminSucceeded($client->call('remove-user', ['user' => $user['user']]));
        }
    }
    return true;
}

function usersAdminRemoveMember(UsersAdminClient $client, string $username, string $lockFile = USERS_ADMIN_MEMBERS_LOCK): bool
{
    $name = usersAdminMembersGroup();
    if ($name === null || !$client->isConfigured()) {
        return true;
    }
    return (bool) usersAdminWithMembersLock($lockFile, function () use ($client, $name, $username) {
        $groups = usersAdminGroups($client);
        if ($groups === null) {
            return false;
        }
        foreach ($groups as $group) {
            if (strcasecmp($group['group'], $name) !== 0) {
                continue;
            }
            $others = array_values(array_filter($group['users'], fn($member) => strcasecmp($member, $username) !== 0));
            return count($others) === count($group['users']) || usersAdminSucceeded($client->call('alter-group', ['group' => $group['group'], 'users' => $others]));
        }
        return true;
    });
}

function usersAdminInstanceMembers(UsersAdminClient $client, bool $create = false, ?array $groups = null): ?array
{
    if (usersAdminMembersGroup() === null || !$client->isConfigured()) {
        return null;
    }
    $groups = $groups ?? usersAdminGroups($client);
    $members = $groups === null ? null : usersAdminMembersOf($groups);
    if ($create && $groups !== null && $members === null && usersAdminAddMembers($client, [])) {
        $groups = usersAdminGroups($client);
        $members = $groups === null ? null : usersAdminMembersOf($groups);
    }
    return $members;
}

function usersAdminIsInstanceUser(string $username, ?UsersAdminClient $client = null): bool
{
    $members = usersAdminInstanceMembers($client ?? usersAdminDefaultClient());
    return $members === null ? usersAdminHasExtension($username) : isset($members[strtolower($username)]);
}

function usersAdminInstanceError(string $username, array $caller, ?callable $isInstanceUser, ?UsersAdminClient $client = null): ?array
{
    if (!empty($caller['superadmin']) || strcasecmp($username, (string) ($caller['username'] ?? '')) === 0) {
        return null;
    }
    return ($isInstanceUser ?? 'usersAdminIsInstanceUser')($username, $client) ? null : usersAdminError(403, 'not_instance_user');
}

function usersAdminAssignmentError(string $username, array $caller, ?UsersAdminClient $client = null): ?array
{
    if (!empty($caller['superadmin'])) {
        return null;
    }
    $members = usersAdminInstanceMembers($client ?? usersAdminDefaultClient(), true);
    return $members === null || isset($members[strtolower($username)]) ? null : usersAdminError(403, 'not_instance_user');
}

function usersAdminChangePassword(UsersAdminClient $client, string $username, $body, array $caller, ?callable $isInstanceUser = null): array
{
    $password = is_array($body) ? ($body['password'] ?? null) : null;
    if (!is_string($password) || $password === '' || strlen($password) > USERS_ADMIN_MAX_LENGTH || array_diff(array_keys($body), ['password'])) {
        return usersAdminError(400, 'invalid_request');
    }
    $error = usersAdminTargetError($username, $caller, false)
        ?? usersAdminInstanceError($username, $caller, $isInstanceUser, $client)
        ?? usersAdminAvailabilityError($client)
        ?? usersAdminAccountError($client, $username)
        ?? usersAdminProtectedTargetError($client, $username, $caller);
    if ($error !== null) {
        return $error;
    }
    $result = $client->call('alter-user', ['user' => $username, 'password' => $password, 'must_change_password' => false]);
    if (usersAdminSucceeded($result)) {
        return [204, null];
    }
    if ($result['status'] === 200 && ($result['data']['status'] ?? null) === 'failure') {
        $message = $result['data']['message'] ?? null;
        return usersAdminError(422, is_string($message) && isset(USERS_ADMIN_POLICY_ERRORS[$message]) ? USERS_ADMIN_POLICY_ERRORS[$message] : 'password_rejected');
    }
    if ($result['status'] === 400 || $result['status'] >= 500) {
        return usersAdminError(422, 'password_rejected');
    }
    return usersAdminError(502, 'provider_error');
}

function usersAdminAccountChanges($body): ?array
{
    if (!is_array($body) || $body === [] || array_diff(array_keys($body), ['display_name', 'mail', 'locked'])) {
        return null;
    }
    $changes = [];
    if (array_key_exists('display_name', $body)) {
        $name = is_string($body['display_name']) ? trim($body['display_name']) : '';
        if (preg_match('/^.{1,' . USERS_ADMIN_MAX_LENGTH . '}$/us', $name) !== 1) {
            return null;
        }
        $changes['display_name'] = $name;
    }
    if (array_key_exists('mail', $body)) {
        if (!is_string($body['mail'])) {
            return null;
        }
        $changes['mail'] = trim($body['mail']);
    }
    if (array_key_exists('locked', $body)) {
        if (!is_bool($body['locked'])) {
            return null;
        }
        $changes['locked'] = $body['locked'];
    }
    return $changes;
}

function usersAdminUpdateAccount(UsersAdminClient $client, string $username, $body, array $caller, callable $synchronize, ?callable $renamed = null, ?callable $isInstanceUser = null): array
{
    $changes = usersAdminAccountChanges($body);
    if ($changes === null) {
        return usersAdminError(400, 'invalid_request');
    }
    if (isset($changes['display_name']) && preg_match('/[\x00-\x1F\x7F]/', $body['display_name']) === 1) {
        return usersAdminError(422, 'invalid_display_name');
    }
    if (isset($changes['display_name']) && empty($caller['superadmin']) && mb_strlen($changes['display_name'], 'UTF-8') > USERS_ADMIN_DISPLAY_NAME_MAX_LENGTH) {
        return usersAdminError(422, 'display_name_too_long');
    }
    if (isset($changes['mail']) && $changes['mail'] !== '' && (strlen($changes['mail']) > USERS_ADMIN_MAX_LENGTH || filter_var($changes['mail'], FILTER_VALIDATE_EMAIL) === false)) {
        return usersAdminError(422, 'invalid_mail');
    }
    $locking = array_key_exists('locked', $changes);
    $error = usersAdminTargetError($username, $caller, !$locking)
        ?? usersAdminInstanceError($username, $caller, $isInstanceUser, $client)
        ?? usersAdminAvailabilityError($client)
        ?? usersAdminAccountError($client, $username)
        ?? usersAdminProtectedTargetError($client, $username, $caller);
    if ($error !== null) {
        return $error;
    }
    $result = $client->call('alter-user', ['user' => $username] + $changes);
    if (!usersAdminSucceeded($result)) {
        if ($result['status'] === 400 && isset($changes['mail']) && in_array('mail', array_column(is_array($result['data']['error'] ?? null) ? array_filter($result['data']['error'], 'is_array') : [], 'field'), true)) {
            return usersAdminError(422, 'invalid_mail');
        }
        return usersAdminError(502, 'provider_error');
    }
    $synchronized = isset($changes['display_name']) || isset($changes['mail']) ? (bool) $synchronize() : null;
    if (isset($changes['display_name']) && $renamed !== null) {
        try {
            $renamed($username, $changes['display_name']);
        } catch (\Throwable $e) {
            error_log('users-admin: cannot apply the new display name to the extensions of ' . $username);
        }
    }
    return [200, ['synchronized' => $synchronized]];
}

function usersAdminDeleteAccount(UsersAdminClient $client, string $username, array $caller, callable $synchronize, ?callable $cleanup = null, ?callable $isInstanceUser = null): array
{
    $error = usersAdminTargetError($username, $caller, false)
        ?? usersAdminInstanceError($username, $caller, $isInstanceUser, $client)
        ?? usersAdminAvailabilityError($client)
        ?? usersAdminAccountError($client, $username)
        ?? usersAdminProtectedTargetError($client, $username, $caller);
    if ($error !== null) {
        return $error;
    }
    if (!usersAdminSucceeded($client->call('remove-user', ['user' => $username]))) {
        return usersAdminError(502, 'provider_error');
    }
    if (!usersAdminRemoveMember($client, $username)) {
        error_log('users-admin: cannot remove ' . $username . ' from the members of this NethVoice');
    }
    $synchronized = (bool) $synchronize();
    if ($cleanup === null) {
        return [200, ['synchronized' => $synchronized]];
    }
    try {
        $cleaned = (bool) $cleanup($username);
    } catch (\Throwable $e) {
        error_log('users-admin: cannot delete the NethVoice data of ' . $username);
        $cleaned = false;
    }
    return [200, ['synchronized' => $synchronized, 'cleaned' => $cleaned]];
}

function usersAdminDeleteNethvoiceData(string $username, array $steps = ['deleteRemovedUserExtensions', 'deleteCtiUserData'], ?callable $reload = null): bool
{
    $deleted = true;
    foreach ($steps as $step) {
        try {
            $deleted = (bool) $step($username) && $deleted;
        } catch (\Throwable $e) {
            error_log('users-admin: cannot delete part of the NethVoice data of ' . $username . ': ' . $e->getMessage());
            $deleted = false;
        }
    }
    ($reload ?? 'usersAdminScheduleReload')();
    return $deleted;
}
