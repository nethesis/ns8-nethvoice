<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Usage: php local_testing/mailbox_migration_test.php 'mysql:host=127.0.0.1;port=3306'
// Requires a disposable MariaDB accepting root with an empty password.
if ($argc !== 2) {
    fwrite(STDERR, "Usage: php mailbox_migration_test.php MYSQL_DSN\n");
    exit(2);
}
$db = new PDO($argv[1], 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
// Refuse to overwrite an existing installation.
$db->exec('CREATE DATABASE asterisk');
$script = tempnam(sys_get_temp_dir(), 'mailbox-migration-');
try {
    $db->exec("CREATE TABLE asterisk.admin (variable varchar(80) PRIMARY KEY, value varchar(80));
        CREATE TABLE asterisk.sip (id varchar(20), keyword varchar(80), data varchar(255), flags int DEFAULT 0);
        CREATE TABLE asterisk.rest_devices_phones (extension varchar(20));
        CREATE TABLE asterisk.soundlang_packages (
            type varchar(20), module varchar(20), language varchar(20), author varchar(80),
            installed varchar(20), version varchar(20));
        CREATE TABLE asterisk.soundlang_prompts (filename varchar(255))");
    $source = file_get_contents(__DIR__ . '/../freepbx/initdb.d/migration.php');
    $source = str_replace("include_once '/etc/freepbx_db.conf';",
        '$db = new PDO($argv[1], "root", "", [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]); $db->exec("USE asterisk");', $source, $replacements);
    if ($replacements !== 1) {
        throw new RuntimeException('Unable to isolate the migration database connection');
    }
    file_put_contents($script, $source);

    foreach ([1, 2] as $version) {
        $db->exec("TRUNCATE asterisk.sip;
            REPLACE INTO asterisk.admin VALUES ('MIGRATION_SCRIPT', '$version');
            INSERT INTO asterisk.sip (id, keyword, data, flags) VALUES
                ('201', 'account', '201', 1),
                ('201', 'mailbox', '201@default', 2),
                ('202', 'mailbox', '201@default', 3),
                ('202', 'accountcode', '202', 4),
                ('202', 'mwi_subscription', 'auto', 5),
                ('203', 'mailbox', '', 6),
                ('204', 'account', '', 7),
                ('204', 'mailbox', '', 8),
                ('205', 'account', '205', 9),
                ('206', 'context', 'from-internal', 10)");
        $before = $db->query('SELECT * FROM asterisk.sip ORDER BY id, keyword')->fetchAll(PDO::FETCH_ASSOC);
        $expected = array_values(array_filter($before, static function ($row) {
            return !($row['keyword'] === 'mailbox' && in_array($row['id'], ['202', '203'], true));
        }));
        foreach ([1, 2] as $run) {
            $process = proc_open([PHP_BINARY, $script, $argv[1]], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
            $output = stream_get_contents($pipes[1]) . stream_get_contents($pipes[2]);
            fclose($pipes[1]);
            fclose($pipes[2]);
            if (proc_close($process) !== 0) {
                throw new RuntimeException("Migration failed: $output");
            }
            $actual = $db->query('SELECT * FROM asterisk.sip ORDER BY id, keyword')->fetchAll(PDO::FETCH_ASSOC);
            if ($actual !== $expected) {
                throw new RuntimeException("Version $version, run $run: invalid mailbox cleanup or unrelated settings changed");
            }
            if ($db->query("SELECT value FROM asterisk.admin WHERE variable = 'MIGRATION_SCRIPT'")->fetchColumn() !== '2') {
                throw new RuntimeException('Migration completion marker changed');
            }
        }
        echo "PASS: migration version $version, valid/empty mailboxes, unrelated settings and repeat execution\n";
    }
} finally {
    unlink($script);
    $db->exec('DROP DATABASE asterisk');
}
