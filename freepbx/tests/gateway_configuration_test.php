#!/usr/bin/env php
<?php

/**
 * Regression tests for Grandstream gateway configuration rendering.
 *
 * Copyright (C) 2026 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

require_once __DIR__ . '/../var/www/html/freepbx/rest/lib/gateway/functions.inc.php';

function gateway_test_assert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

final class GatewayTestStatement
{
    private array $rows;
    private array $parameters;

    public function __construct(array $rows, array $parameters)
    {
        $this->rows = $rows;
        $this->parameters = $parameters;
    }

    public function execute(array $parameters): void
    {
        gateway_test_assert($parameters === $this->parameters, 'unexpected configuration query parameters');
    }

    public function fetch(int $mode)
    {
        gateway_test_assert($mode === PDO::FETCH_ASSOC, 'configuration query must fetch associative rows');
        return array_shift($this->rows) ?? false;
    }
}

final class GatewayTestDatabase
{
    private array $fixture;
    private bool $withMac;

    public function __construct(array $fixture, bool $withMac)
    {
        $this->fixture = $fixture;
        $this->withMac = $withMac;
    }

    public function prepare(string $sql): GatewayTestStatement
    {
        gateway_test_assert(preg_match('/FROM `([^`]+)`/', $sql, $matches) === 1, 'unexpected configuration query');
        $table = $matches[1];
        gateway_test_assert(isset($this->fixture[$table]), "unexpected configuration table $table");
        if ($table === 'gateway_config') {
            gateway_test_assert(
                (strpos($sql, 'AND `mac` = ?') !== false) === $this->withMac,
                'optional MAC filter does not match the request'
            );
            $parameters = [$this->fixture[$table][0]['name']];
            if ($this->withMac) {
                $parameters[] = $this->fixture[$table][0]['mac'];
            }
        } elseif ($table === 'gateway_models') {
            $parameters = [$this->fixture['gateway_config'][0]['model_id']];
        } else {
            $parameters = [$this->fixture['gateway_config'][0]['id']];
        }

        return new GatewayTestStatement($this->fixture[$table], $parameters);
    }
}

final class FreePBX
{
    public static object $database;
    public static object $core;

    public static function Database(): object
    {
        return self::$database;
    }

    public static function Core(): object
    {
        return self::$core;
    }
}

final class GatewayEditState
{
    public array $log = [];
    public array $existing = [];
    public array $sameMac = [];
    public $fxoPjsipId = false;
    public $fxoAors = false;
    public ?string $failOn = null;
    public array $failingExtensions = [];
    public int $nextTrunk = 1;
    public array $trunks = [];
    public array $extensions = [];
    public bool $inTransaction = false;
}

final class GatewayEditStatement
{
    private GatewayEditState $state;
    private string $sql;
    private array $rows = [];

    public function __construct(GatewayEditState $state, string $sql)
    {
        $this->state = $state;
        $this->sql = $sql;
    }

    public function execute(array $parameters): bool
    {
        $this->state->log[] = ['sql' => $this->sql, 'params' => $parameters];
        if ($this->state->failOn !== null && strpos($this->sql, $this->state->failOn) !== false) {
            throw new PDOException('forced failure on ' . $this->state->failOn);
        }
        if (strpos($this->sql, 'FROM `gateway_models`') !== false) {
            $this->rows = [['manufacturer' => 'Grandstream']];
        } elseif (strpos($this->sql, 'FROM `gateway_config` WHERE `name` = ? AND `mac` = ?') !== false) {
            $this->rows = $this->state->existing;
        } elseif (strpos($this->sql, 'FROM `gateway_config` WHERE `mac` = ?') !== false) {
            $this->rows = $this->state->sameMac;
        } elseif (strpos($this->sql, 'FROM `gateway_config` WHERE `name` = ? ORDER BY') !== false) {
            $this->rows = [['id' => '55']];
        } elseif (strpos($this->sql, 'keyword = "trunk_name"') !== false) {
            $this->rows = [['id' => $this->state->fxoPjsipId]];
        } elseif (strpos($this->sql, 'keyword = "aors"') !== false && strpos($this->sql, 'SELECT') === 0) {
            $this->rows = [['data' => $this->state->fxoAors]];
        } elseif (strpos($this->sql, 'FROM `sip`') !== false) {
            $this->rows = [['data' => 'ext-secret-' . $parameters[0]]];
        }
        return true;
    }

    public function fetch(int $mode)
    {
        return array_shift($this->rows) ?? false;
    }

    public function fetchColumn()
    {
        $row = array_shift($this->rows);
        return $row === null ? false : reset($row);
    }
}

final class GatewayEditDatabase
{
    private GatewayEditState $state;

    public function __construct(GatewayEditState $state)
    {
        $this->state = $state;
    }

    public function prepare(string $sql): GatewayEditStatement
    {
        return new GatewayEditStatement($this->state, $sql);
    }

    public function beginTransaction(): bool
    {
        $this->state->log[] = ['sql' => 'BEGIN', 'params' => []];
        $this->state->inTransaction = true;
        return true;
    }

    public function commit(): bool
    {
        $this->state->log[] = ['sql' => 'COMMIT', 'params' => []];
        $this->state->inTransaction = false;
        return true;
    }

    public function rollBack(): bool
    {
        $this->state->log[] = ['sql' => 'ROLLBACK', 'params' => []];
        $this->state->inTransaction = false;
        return true;
    }

    public function inTransaction(): bool
    {
        return $this->state->inTransaction;
    }
}

final class GatewayEditCore
{
    private GatewayEditState $state;

    public function __construct(GatewayEditState $state)
    {
        $this->state = $state;
    }

    public function deleteTrunk($trunkId): void
    {
        $this->state->log[] = ['sql' => 'deleteTrunk', 'params' => [$trunkId]];
        unset($this->state->trunks[$trunkId]);
    }

    public function deleteTrunkDialRulesByID($trunkId): void
    {
        $this->state->log[] = ['sql' => 'deleteTrunkDialRulesByID', 'params' => [$trunkId]];
    }
}

function gateway_edit_state(bool $reset = false): GatewayEditState
{
    static $state = null;
    if ($reset || $state === null) {
        $state = new GatewayEditState();
    }
    return $state;
}

function core_trunks_list(): array
{
    return array_values(gateway_edit_state()->trunks);
}

function core_trunks_add($tech, $channelid, ...$rest)
{
    $state = gateway_edit_state();
    $trunkId = $state->nextTrunk++;
    $state->trunks[$trunkId] = $channelid;
    $state->log[] = ['sql' => 'core_trunks_add', 'params' => [$trunkId, $channelid]];
    return $trunkId;
}

function core_trunks_update_dialrules($trunkId, &$patterns): void
{
}

function createExtension($mainExtension, $delete = false)
{
    $state = gateway_edit_state();
    if (in_array($mainExtension, $state->failingExtensions, true)) {
        return false;
    }
    $extension = '91' . $mainExtension;
    $state->extensions[$extension] = true;
    return $extension;
}

function useExtensionAsCustomPhysical($extension, $secret = false, $type = 'physical')
{
    return true;
}

function deletePhysicalExtension($extension)
{
    gateway_edit_state()->log[] = ['sql' => 'deletePhysicalExtension', 'params' => [$extension]];
    return true;
}

function deleteExtension($extension)
{
    $state = gateway_edit_state();
    $state->log[] = ['sql' => 'deleteExtension', 'params' => [$extension]];
    unset($state->extensions[$extension]);
    return true;
}

function gateway_test_fixture(string $model): array
{
    $fixture = [
        'gateway_config' => [[
            'id' => '17',
            'name' => 'test-gateway',
            'model_id' => '42',
            'mac' => 'aa:bb:cc:dd:ee:ff',
            'ipv4_green' => '192.0.2.10',
            'ipv4_new' => '198.51.100.42',
            'netmask_green' => '255.255.255.0',
            'gateway' => '198.51.100.1',
            'proxy' => 'voice.example.test',
        ]],
        'gateway_models' => [['model' => $model, 'manufacturer' => 'Grandstream']],
        'gateway_config_isdn' => [],
        'gateway_config_pri' => [],
        'gateway_config_fxo' => [],
        'gateway_config_fxs' => [],
    ];
    for ($i = 1; $i <= 4; $i++) {
        if ($model === 'ht841TLS') {
            $fixture['gateway_config_fxo'][] = [
                'trunk' => (string) $i,
                'trunknumber' => "trunk-$i",
                'number' => "line-$i",
                'username' => "fxo-user-$i",
                'secret' => "fxo-secret-$i",
            ];
        } else {
            $fixture['gateway_config_fxs'][] = [
                'physical_extension' => (string) (200 + $i),
                'secret' => "fxs-secret-$i",
            ];
        }
    }
    return $fixture;
}

function gateway_test_render(array $fixture, bool $withMac): string
{
    FreePBX::$database = new GatewayTestDatabase($fixture, $withMac);
    $config = $fixture['gateway_config'][0];
    $bufferLevel = ob_get_level();
    ob_start();
    try {
        return $withMac
            ? gateway_generate_configuration_file($config['name'], $config['mac'])
            : gateway_generate_configuration_file($config['name']);
    } finally {
        while (ob_get_level() > $bufferLevel) {
            ob_end_clean();
        }
    }
}

function gateway_test_assert_tag(string $output, string $tag, string $value): void
{
    gateway_test_assert(strpos($output, "<$tag>$value</$tag>") !== false, "$tag has an unexpected value");
}

function gateway_test_assert_common(string $output): void
{
    gateway_test_assert_tag($output, 'mac', 'AABBCCDDEEFF');
    gateway_test_assert_tag($output, 'P4511', 'AABBCCDDEEFF');
    $network = [
        9 => '198', 10 => '51', 11 => '100', 12 => '42',
        13 => '255', 14 => '255', 15 => '255', 16 => '0',
        17 => '198', 18 => '51', 19 => '100', 20 => '1',
        21 => '198', 22 => '51', 23 => '100', 24 => '1',
    ];
    foreach ($network as $parameter => $value) {
        gateway_test_assert_tag($output, "P$parameter", $value);
    }
    gateway_test_assert_tag($output, 'P30', '192.0.2.10');
    gateway_test_assert(
        preg_match('/MAC|UTIME|(?:IP|MASK|DNS|GATE)[0-3]|ASTERISKIP|GATEWAYIP|DEFGATEWAY|NETMASK|PROXY|TRUNK(?:NUMBER|USERNAME|SECRET)[0-9]+|LINENUMBER[0-9]+|FXS(?:EXTENSION|PASS)[0-9]+/', $output) === 0,
        'configuration contains unresolved placeholders'
    );
}

$tests = [];
foreach ([true, false] as $withMac) {
    $tests['HT841 TLS FXO ' . ($withMac ? 'with MAC filter' : 'without MAC filter')] = static function () use ($withMac): void {
        $output = gateway_test_render(gateway_test_fixture('ht841TLS'), $withMac);
        gateway_test_assert_common($output);
        gateway_test_assert_tag($output, 'P748', 'voice.example.test:5061');
        for ($i = 1; $i <= 4; $i++) {
            foreach ([4060, 4090, 4180] as $base) {
                gateway_test_assert_tag($output, 'P' . ($base + $i), "fxo-user-$i");
            }
            gateway_test_assert_tag($output, 'P' . (4120 + $i), "fxo-secret-$i");
            gateway_test_assert_tag($output, $i === 1 ? 'P3305' : 'P' . (92827 + $i), "line-$i");
        }
    };
}

$tests['HT814 TLS FXS identity, time, network and credentials'] = static function (): void {
    $before = time();
    $output = gateway_test_render(gateway_test_fixture('ht814TLS'), false);
    $after = time();
    gateway_test_assert_common($output);
    gateway_test_assert_tag($output, 'P8201', 'AABBCCDDEEFF');
    gateway_test_assert_tag($output, 'P48', 'voice.example.test:5061');
    gateway_test_assert(preg_match('/<P4509>([0-9]+)<\/P4509>/', $output, $matches) === 1, 'missing Unix timestamp');
    gateway_test_assert((int) $matches[1] >= $before && (int) $matches[1] <= $after, 'Unix timestamp is not current');
    for ($i = 0; $i < 4; $i++) {
        foreach ([4060, 4090, 4180] as $base) {
            gateway_test_assert_tag($output, 'P' . ($base + $i), (string) (201 + $i));
        }
        gateway_test_assert_tag($output, 'P' . (4120 + $i), 'fxs-secret-' . ($i + 1));
    }
};

function gateway_edit_run(GatewayEditState $state, array $params): array
{
    FreePBX::$database = new GatewayEditDatabase($state);
    FreePBX::$core = new GatewayEditCore($state);
    return addEditGateway($params);
}

function gateway_edit_params(int $fxo, array $fxs): array
{
    $params = [
        'name' => 'HT 818 TLS gateway',
        'model' => '42',
        'ipv4_new' => '198.51.100.42',
        'gateway' => '198.51.100.1',
        'ipv4_green' => '192.0.2.10',
        'netmask_green' => '255.255.255.0',
        'mac' => 'aa:bb:cc:dd:ee:ff',
        'trunks_fxo' => [],
        'trunks_fxs' => [],
    ];
    for ($i = 1; $i <= $fxo; $i++) {
        $params['trunks_fxo'][] = ['number' => "line-$i"];
    }
    foreach ($fxs as $extension) {
        $params['trunks_fxs'][] = ['linked_extension' => $extension];
    }
    return $params;
}

function gateway_edit_calls(GatewayEditState $state, string $needle): array
{
    return array_values(array_filter($state->log, static function (array $entry) use ($needle): bool {
        return strpos($entry['sql'], $needle) !== false;
    }));
}

function gateway_edit_assert_no_config_writes(GatewayEditState $state): void
{
    foreach ($state->log as $entry) {
        gateway_test_assert(
            preg_match('/^(INSERT|REPLACE|DELETE)[^`]*`gateway_config/', $entry['sql']) !== 1 || in_array('ROLLBACK', array_column($state->log, 'sql'), true),
            'gateway configuration was written outside a rolled back transaction'
        );
    }
    gateway_test_assert(gateway_edit_calls($state, 'COMMIT') === [], 'failed gateway save must not commit');
}

$tests['addEditGateway creates trunks, extensions and configuration in one transaction'] = static function (): void {
    $state = gateway_edit_state(true);
    $result = gateway_edit_run($state, gateway_edit_params(2, ['201']));
    gateway_test_assert($result['status'] === true, 'successful save must report status true');
    gateway_test_assert($result['id'] === '55', 'successful save must return the configuration id');
    gateway_test_assert(count($state->trunks) === 2, 'one trunk per FXO port must be kept');
    gateway_test_assert(array_map('strval', array_keys($state->extensions)) === ['91201'], 'the FXS extension must be kept');
    gateway_test_assert(gateway_edit_calls($state, 'delete') === [], 'successful save must not delete anything');
    $sequence = array_column(array_filter($state->log, static function (array $entry): bool {
        return preg_match('/^(BEGIN|COMMIT|INSERT INTO `gateway_config`|REPLACE INTO `gateway_config_)/', $entry['sql']) === 1;
    }), 'sql');
    gateway_test_assert(count($sequence) === 6, 'unexpected number of configuration writes');
    gateway_test_assert($sequence[0] === 'BEGIN' && $sequence[5] === 'COMMIT', 'configuration writes must be inside one transaction');
    gateway_test_assert(strpos($sequence[1], 'INSERT INTO `gateway_config`') === 0, 'gateway must be inserted before its ports');
    foreach (gateway_edit_calls($state, 'REPLACE INTO `gateway_config_') as $entry) {
        gateway_test_assert($entry['params'][0] === '55', 'port rows must reference the new configuration');
    }
    $fxs = gateway_edit_calls($state, 'gateway_config_fxs');
    gateway_test_assert($fxs[0]['params'] === ['55', '201', '91201', 'ext-secret-91201'], 'FXS row has unexpected values');
};

$tests['addEditGateway removes created trunks and extensions when an FXS port fails'] = static function (): void {
    $state = gateway_edit_state(true);
    $state->existing = [['id' => '17']];
    $state->sameMac = [['id' => '17']];
    $state->fxoPjsipId = '99';
    $state->fxoAors = 'old-aor';
    $state->failingExtensions = ['202'];
    $result = gateway_edit_run($state, gateway_edit_params(2, ['201', '202']));
    gateway_test_assert($result['status'] === false, 'failed save must report status false');
    gateway_test_assert($result['errors'] === ['Error creating extension'], 'failed save must report the cause');
    gateway_test_assert($state->trunks === [], 'created trunks must be removed');
    gateway_test_assert($state->extensions === [], 'created extensions must be removed');
    gateway_test_assert(gateway_edit_calls($state, 'BEGIN') === [], 'configuration must not be touched before every port is ready');
    gateway_test_assert(gateway_edit_calls($state, '`gateway_config` WHERE `id`') === [], 'existing configuration must be kept');
    gateway_edit_assert_no_config_writes($state);
    $aors = gateway_edit_calls($state, "REPLACE INTO `pjsip`");
    $last = end($aors);
    gateway_test_assert($last['params'] == ['99', 'aors', 'old-aor', '0'], 'pre-existing trunk AOR must be restored');
};

$tests['addEditGateway rolls back the configuration and removes trunks when a port row fails'] = static function (): void {
    $state = gateway_edit_state(true);
    $state->failOn = 'REPLACE INTO `gateway_config_fxo`';
    $result = gateway_edit_run($state, gateway_edit_params(2, []));
    gateway_test_assert($result['status'] === false, 'failed save must report status false');
    gateway_test_assert(gateway_edit_calls($state, 'ROLLBACK') !== [], 'configuration transaction must be rolled back');
    gateway_test_assert($state->trunks === [], 'created trunks must be removed');
    gateway_test_assert(count(gateway_edit_calls($state, 'deleteTrunkDialRulesByID')) === 2, 'dial rules of created trunks must be removed');
    gateway_edit_assert_no_config_writes($state);
};

$tests['addEditGateway rejects a MAC address used by another gateway before creating trunks'] = static function (): void {
    $state = gateway_edit_state(true);
    $state->sameMac = [['id' => '8']];
    $result = gateway_edit_run($state, gateway_edit_params(2, ['201']));
    gateway_test_assert($result['status'] === false && ($result['http_status'] ?? null) === 409, 'duplicate MAC must answer 409');
    gateway_test_assert(gateway_edit_calls($state, 'core_trunks_add') === [], 'no trunk must be created for a duplicate MAC');
    gateway_test_assert($state->extensions === [], 'no extension must be created for a duplicate MAC');
};

set_error_handler(static function (int $severity, string $message, string $file, int $line): void {
    throw new ErrorException($message, 0, $severity, $file, $line);
});

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
restore_error_handler();
exit($failures === 0 ? 0 : 1);
