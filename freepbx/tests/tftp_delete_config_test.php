#!/usr/bin/env php
<?php

/**
 * Regression tests for gateway provisioning file removal.
 *
 * Copyright (C) 2026 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const TFTP_DELETE_SCRIPT = __DIR__ . '/../var/www/html/freepbx/rest/lib/tftpDeleteConfig.php';

function tftp_delete_assert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function tftp_delete_bootstrap(): string
{
    return <<<'PHP'
<?php
if (!defined('FREEPBX_IS_AUTH')) {
    define('FREEPBX_IS_AUTH', 'TRUE');
}
set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
    throw new ErrorException($message, 0, $severity, $file, $line);
});

final class TftpDeleteTestStatement
{
    private array $rows;
    private array $columns;
    private array $result = [];

    public function __construct(array $rows, array $columns)
    {
        $this->rows = $rows;
        $this->columns = $columns;
    }

    public function execute(array $parameters): bool
    {
        if (count($parameters) !== count($this->columns)) {
            throw new RuntimeException('unexpected query parameters');
        }
        $criteria = array_combine($this->columns, $parameters);
        $this->result = array_values(array_filter($this->rows, static function (array $row) use ($criteria): bool {
            foreach ($criteria as $column => $value) {
                if ((string) ($row[$column] ?? '') !== (string) $value) {
                    return false;
                }
            }
            return true;
        }));
        return true;
    }

    public function fetch(int $mode)
    {
        if ($mode !== PDO::FETCH_ASSOC) {
            throw new RuntimeException('rows must be fetched as associative arrays');
        }
        return array_shift($this->result) ?? false;
    }
}

final class TftpDeleteTestDatabase
{
    public function prepare(string $sql): TftpDeleteTestStatement
    {
        $fixture = json_decode(getenv('TFTP_DELETE_FIXTURE'), true, 512, JSON_THROW_ON_ERROR);
        if (preg_match('/FROM `([^`]+)` WHERE (.*)$/', $sql, $matches) !== 1 || !isset($fixture[$matches[1]])) {
            throw new RuntimeException("unexpected query: $sql");
        }
        preg_match_all('/`([^`]+)` = \?/', $matches[2], $columns);
        return new TftpDeleteTestStatement($fixture[$matches[1]], $columns[1]);
    }
}

final class FreePBX
{
    public static function Database(): TftpDeleteTestDatabase
    {
        return new TftpDeleteTestDatabase();
    }
}
PHP;
}

function tftp_delete_fixture(string $manufacturer, string $mac = 'C0:74:AD:0A:A0:03'): array
{
    return [
        'gateway_config' => [
            ['id' => '5', 'model_id' => '7', 'name' => 'test-gateway', 'mac' => $mac, 'ipv4' => '', 'ipv4_new' => '192.0.2.10', 'gateway' => '192.0.2.1'],
            ['id' => '6', 'model_id' => '7', 'name' => 'other-gateway', 'mac' => '02:00:00:00:00:01', 'ipv4' => '', 'ipv4_new' => '192.0.2.11', 'gateway' => '192.0.2.1'],
        ],
        'gateway_models' => [
            ['id' => '7', 'model' => 'test-model', 'manufacturer' => $manufacturer],
        ],
    ];
}

function tftp_delete_run(array $fixture, array $arguments, array $files): array
{
    $directory = sys_get_temp_dir() . '/tftp-delete-test-' . bin2hex(random_bytes(6));
    $tftpdir = "$directory/tftpboot";
    mkdir($tftpdir, 0700, true);
    try {
        file_put_contents("$directory/freepbx.conf", tftp_delete_bootstrap());
        $source = file_get_contents(TFTP_DELETE_SCRIPT);
        foreach (['/etc/freepbx.conf' => "$directory/freepbx.conf", '/var/lib/tftpboot' => $tftpdir] as $path => $replacement) {
            tftp_delete_assert(substr_count($source, $path) === 1, "script must reference $path once");
            $source = str_replace($path, $replacement, $source);
        }
        file_put_contents("$directory/tftpDeleteConfig.php", $source);
        foreach ($files as $file) {
            file_put_contents("$tftpdir/$file", "provisioning\n");
        }

        $command = array_merge([PHP_BINARY, '-d', 'display_errors=stderr', '-d', 'log_errors=0', '-d', 'error_log=', "$directory/tftpDeleteConfig.php"], $arguments);
        $environment = ['TFTP_DELETE_FIXTURE' => json_encode($fixture)];
        $process = proc_open($command, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, $directory, $environment);
        tftp_delete_assert(is_resource($process), 'unable to start the script');
        $output = stream_get_contents($pipes[1]) . stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $exitCode = proc_close($process);

        $remaining = array_values(array_diff(scandir($tftpdir), ['.', '..']));
        sort($remaining);
        return ['exit' => $exitCode, 'output' => $output, 'files' => $remaining];
    } finally {
        foreach (glob("$tftpdir/*") ?: [] as $file) {
            unlink($file);
        }
        rmdir($tftpdir);
        foreach (glob("$directory/*") ?: [] as $file) {
            unlink($file);
        }
        rmdir($directory);
    }
}

function tftp_delete_assert_success(array $result, array $files): void
{
    sort($files);
    tftp_delete_assert($result['exit'] === 0, "script must succeed, exit {$result['exit']}: " . trim($result['output']));
    tftp_delete_assert($result['files'] === $files, 'unexpected remaining files: ' . implode(', ', $result['files']));
}

function tftp_delete_assert_failure(array $result, string $message, array $files): void
{
    sort($files);
    tftp_delete_assert($result['exit'] === 1, "script must exit 1, exit {$result['exit']}");
    tftp_delete_assert(strpos($result['output'], $message) !== false, "missing error '$message': " . trim($result['output']));
    tftp_delete_assert($result['files'] === $files, 'files must not be removed on error');
}

$untouched = ['020000000001.cfg', 'other.txt'];

$tests = [];

$tests['removes the configuration file of the gateway when FreePBX already defined FREEPBX_IS_AUTH'] = static function () use ($untouched): void {
    $result = tftp_delete_run(tftp_delete_fixture('Grandstream'), ['test-gateway', 'C0:74:AD:0A:A0:03'], array_merge(['C074AD0AA003.cfg'], $untouched));
    tftp_delete_assert_success($result, $untouched);
};

$tests['removes the configuration file selected by name only'] = static function () use ($untouched): void {
    $result = tftp_delete_run(tftp_delete_fixture('Patton'), ['test-gateway'], array_merge(['C074AD0AA003.cfg'], $untouched));
    tftp_delete_assert_success($result, $untouched);
};

$tests['removes both Sangoma configuration and script files'] = static function () use ($untouched): void {
    $result = tftp_delete_run(tftp_delete_fixture('Sangoma'), ['test-gateway', 'C0:74:AD:0A:A0:03'], array_merge(['C074AD0AA003config.txt', 'C074AD0AA003script.txt', 'C074AD0AA003.cfg'], $untouched));
    tftp_delete_assert_success($result, array_merge(['C074AD0AA003.cfg'], $untouched));
};

$tests['uses the placeholder file name for a gateway without MAC address'] = static function () use ($untouched): void {
    $result = tftp_delete_run(tftp_delete_fixture('Grandstream', ''), ['test-gateway', ''], array_merge(['AAAAAAAAAAAA.cfg'], $untouched));
    tftp_delete_assert_success($result, $untouched);
};

$tests['succeeds when no provisioning file exists'] = static function () use ($untouched): void {
    $result = tftp_delete_run(tftp_delete_fixture('Grandstream'), ['test-gateway', 'C0:74:AD:0A:A0:03'], $untouched);
    tftp_delete_assert_success($result, $untouched);
};

$tests['fails without gateway name'] = static function () use ($untouched): void {
    $result = tftp_delete_run(tftp_delete_fixture('Grandstream'), [], $untouched);
    tftp_delete_assert_failure($result, 'Missing gateway name', $untouched);
};

$tests['fails when the gateway does not exist'] = static function () use ($untouched): void {
    $files = array_merge(['C074AD0AA003.cfg'], $untouched);
    $result = tftp_delete_run(tftp_delete_fixture('Grandstream'), ['missing-gateway', 'C0:74:AD:0A:A0:03'], $files);
    tftp_delete_assert_failure($result, 'Gateway configuration not found', $files);
};

$tests['fails when the MAC address belongs to another gateway'] = static function () use ($untouched): void {
    $files = array_merge(['C074AD0AA003.cfg'], $untouched);
    $result = tftp_delete_run(tftp_delete_fixture('Grandstream'), ['test-gateway', '02:00:00:00:00:01'], $files);
    tftp_delete_assert_failure($result, 'Gateway configuration not found', $files);
};

$tests['fails when the gateway model does not exist'] = static function () use ($untouched): void {
    $fixture = tftp_delete_fixture('Grandstream');
    $fixture['gateway_models'] = [];
    $files = array_merge(['C074AD0AA003.cfg'], $untouched);
    $result = tftp_delete_run($fixture, ['test-gateway', 'C0:74:AD:0A:A0:03'], $files);
    tftp_delete_assert_failure($result, 'Gateway model not found', $files);
};

$failures = 0;
foreach ($tests as $name => $test) {
    try {
        $test();
        echo "PASS: $name\n";
    } catch (Throwable $exception) {
        $failures++;
        fwrite(STDERR, "FAIL: $name: {$exception->getMessage()}\n");
    }
}
exit($failures === 0 ? 0 : 1);
