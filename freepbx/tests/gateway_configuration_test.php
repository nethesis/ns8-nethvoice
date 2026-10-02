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
    public static GatewayTestDatabase $database;

    public static function Database(): GatewayTestDatabase
    {
        return self::$database;
    }
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
            gateway_test_assert_tag($output, $i === 1 ? 'P3305' : 'P' . (92827 + $i), "trunk-$i");
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
