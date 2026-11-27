<?php
// SPDX-License-Identifier: GPL-3.0-or-later

require __DIR__ . '/../var/www/html/freepbx/rest/lib/libMiddleware.php';

$logFile = tempnam(sys_get_temp_dir(), 'cti-user-data-log');
ini_set('log_errors', '1');
ini_set('error_log', $logFile);

function check($condition, $message) {
    if (!$condition) { throw new RuntimeException($message); }
}

class FakeCtiStatement {
    public function __construct(private FakeCtiDatabase $db, private string $sql) {}
    public function execute($args = []) {
        if ($this->db->failOn !== null && str_contains($this->sql, $this->db->failOn)) {
            throw new PDOException('table is locked');
        }
        $this->db->executed[] = [$this->sql, $args];
        return true;
    }
}

class FakeCtiDatabase {
    public array $executed = [];
    public function __construct(public ?string $failOn = null) {}
    public function prepare($sql) { return new FakeCtiStatement($this, $sql); }
}

$tests = [];

$tests['gives a large CTI phonebook import the time to finish'] = function () {
    $options = ctiPhonebookImportCurlOptions('qa-token', ['username' => 'qa_user']);
    check($options[CURLOPT_TIMEOUT] >= 600, 'the import is cut before the middleware finishes');
    check($options[CURLOPT_CONNECTTIMEOUT] === 2, 'the connect timeout changed');
    check($options[CURLOPT_POSTFIELDS] === ['username' => 'qa_user'], 'the upload changed');
    check($options[CURLOPT_HTTPHEADER] === ['Authorization: Bearer qa-token'], 'the token changed');
};

$tests['deletes the settings, the NethLink state and the tokens of the user'] = function () {
    $db = new FakeCtiDatabase();
    $revoked = [];
    check(deleteCtiUserData('qa_user', $db, function ($username) use (&$revoked) { $revoked[] = $username; return true; }) === true, 'the deletion must succeed');
    check($revoked === ['qa_user'], 'the middleware sessions and 2FA were not revoked');
    check($db->executed === [
        ['DELETE FROM user_settings WHERE username = ?', ['qa_user']],
        ['DELETE FROM user_nethlink WHERE user = ?', ['qa_user']],
        ['DELETE FROM auth WHERE user = ? OR user LIKE ?', ['qa_user', 'qa\_user\_phone-island\_%']],
    ], 'unexpected statements: ' . json_encode($db->executed));
};

$tests['reports a failure of the middleware or of the database'] = function () {
    $db = new FakeCtiDatabase();
    check(deleteCtiUserData('alice', $db, fn() => false) === false, 'a failed revocation must be reported');
    check(count($db->executed) === 3, 'a failed revocation must not keep the data');

    $db = new FakeCtiDatabase('user_nethlink');
    check(deleteCtiUserData('alice', $db, fn() => true) === false, 'a database error must be reported');
};

$tests['skips the middleware for usernames it cannot hold and fails without its settings'] = function () {
    foreach (['-bob', 'a..b', 'bob/x'] as $username) {
        check(revokeMiddlewareUser($username) === true, "$username cannot have middleware data");
    }
    unset($_ENV['NETHVOICE_MIDDLEWARE_SUPER_ADMIN_TOKEN'], $_ENV['NETHVOICE_MIDDLEWARE_PORT']);
    check(revokeMiddlewareUser('Alice') === false, 'a missing middleware must be reported');
    check(revokeMiddlewareUser('bob@example.org') === false, 'a username with a domain was not revoked');
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
unlink($logFile);

if ($failures > 0) {
    echo "FAIL: $failures of " . count($tests) . " tests\n";
    exit(1);
}
echo 'PASS: ' . count($tests) . " tests\n";
