<?php
// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: GPL-3.0-or-later

function migrateGatewaySchema(\PDO $db, string $proxy, string $host): void
{
    $columns = $db->query("SELECT TABLE_NAME, COLUMN_NAME, CHARACTER_MAXIMUM_LENGTH
        FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'asterisk'
        AND TABLE_NAME IN ('gateway_config', 'gateway_config_isdn', 'gateway_config_fxo', 'gateway_config_pri')")
        ->fetchAll(\PDO::FETCH_ASSOC);
    $lengths = [];
    foreach ($columns as $column) {
        $lengths[$column['TABLE_NAME']][$column['COLUMN_NAME']] = $column['CHARACTER_MAXIMUM_LENGTH'];
    }

    if (!isset($lengths['gateway_config']['proxy'])) {
        $db->exec('ALTER TABLE asterisk.gateway_config ADD COLUMN proxy VARCHAR(255) DEFAULT NULL AFTER mac');
    }

    // DDL commits immediately: inspect each column so any partial run can resume.
    $widen = [
        'gateway_config' => ['gateway', 'ipv4', 'ipv4_green', 'ipv4_new'],
        'gateway_config_isdn' => ['secret'],
        'gateway_config_fxo' => ['secret'],
        'gateway_config_pri' => ['secret'],
    ];
    foreach ($widen as $table => $names) {
        foreach ($names as $name) {
            if ((int) ($lengths[$table][$name] ?? 0) < 255) {
                $db->exec("ALTER TABLE `asterisk`.`$table` MODIFY COLUMN `$name` VARCHAR(255) DEFAULT NULL");
            }
        }
    }

    $stmt = $db->prepare('UPDATE asterisk.gateway_config SET proxy = ? WHERE proxy IS NULL');
    $stmt->execute([$proxy]);
    $stmt = $db->prepare('UPDATE asterisk.gateway_config SET ipv4_green = ?');
    $stmt->execute([$host]);
}
