<?php
// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: GPL-3.0-or-later

/*
 * Video sources (NethServer/dev#7535): source type, credentials kept out of
 * the URL and several gates per source. Every step inspects the current
 * schema and data first, so the function can run again after a partial run
 * (DDL commits immediately) and on installations created with the new schema.
 */
function migrateStreamingSchema(\PDO $db): void
{
    $columns = [];
    $stmt = $db->query("SELECT COLUMN_NAME, CHARACTER_MAXIMUM_LENGTH
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = 'asterisk' AND TABLE_NAME = 'rest_cti_streaming'");
    foreach ($stmt->fetchAll(\PDO::FETCH_ASSOC) as $column) {
        $columns[$column['COLUMN_NAME']] = (int) $column['CHARACTER_MAXIMUM_LENGTH'];
    }
    if (empty($columns)) {
        // The table is created by the MariaDB initialization: nothing to migrate.
        return;
    }

    if (!isset($columns['type'])) {
        $db->exec("ALTER TABLE `asterisk`.`rest_cti_streaming` ADD COLUMN `type` varchar(10) NOT NULL DEFAULT 'image' AFTER `descr`");
    }
    if (($columns['user'] ?? 0) < 255) {
        $db->exec("ALTER TABLE `asterisk`.`rest_cti_streaming` MODIFY COLUMN `user` varchar(255) DEFAULT ''");
    }
    if (($columns['secret'] ?? 0) < 255) {
        $db->exec("ALTER TABLE `asterisk`.`rest_cti_streaming` MODIFY COLUMN `secret` varchar(255) DEFAULT ''");
    }
    if (($columns['open'] ?? 0) < 30) {
        $db->exec("ALTER TABLE `asterisk`.`rest_cti_streaming` MODIFY COLUMN `open` varchar(30) DEFAULT ''");
    }

    $db->exec("CREATE TABLE IF NOT EXISTS `asterisk`.`rest_cti_streaming_gates` (
        `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
        `source` varchar(50) NOT NULL,
        `position` int(10) unsigned NOT NULL DEFAULT '0',
        `name` varchar(50) NOT NULL,
        `type` varchar(10) NOT NULL DEFAULT 'dtmf',
        `code` varchar(30) DEFAULT NULL,
        `url` varchar(2048) DEFAULT NULL,
        `method` varchar(6) NOT NULL DEFAULT 'GET',
        `username` varchar(255) DEFAULT NULL,
        `password` varchar(255) DEFAULT NULL,
        PRIMARY KEY (`id`),
        KEY `source_position` (`source`,`position`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // The type follows the URL scheme. Only RTSP sources are new: everything
    // else keeps the legacy HTTP image polling.
    $db->exec("UPDATE `asterisk`.`rest_cti_streaming` SET `type` = 'rtsp'
        WHERE `type` <> 'rtsp' AND (`url` LIKE 'rtsp://%' OR `url` LIKE 'rtsps://%')");

    $sources = $db->query("SELECT `descr`, `url`, `user`, `secret`, `open`
        FROM `asterisk`.`rest_cti_streaming`")->fetchAll(\PDO::FETCH_ASSOC);
    $hasGates = $db->prepare("SELECT COUNT(*) FROM `asterisk`.`rest_cti_streaming_gates` WHERE `source` = ?");
    $addGate = $db->prepare("INSERT INTO `asterisk`.`rest_cti_streaming_gates`
        (`source`, `position`, `name`, `type`, `code`) VALUES (?, 0, 'Gate 1', 'dtmf', ?)");
    $setCredentials = $db->prepare("UPDATE `asterisk`.`rest_cti_streaming`
        SET `url` = ?, `user` = ?, `secret` = ? WHERE `descr` = ?");

    foreach ($sources as $source) {
        // The legacy opening code becomes the first DTMF gate, once.
        $open = trim((string) ($source['open'] ?? ''));
        if ($open !== '') {
            $hasGates->execute([$source['descr']]);
            if ((int) $hasGates->fetchColumn() === 0) {
                $addGate->execute([$source['descr'], $open]);
            }
        }

        // Credentials embedded in the URL are moved to their own columns:
        // the URL is shown to CTI users and must not carry them.
        $split = streamingMigrationSplitCredentials((string) $source['url']);
        if ($split !== null) {
            $user = (string) ($source['user'] ?? '') !== '' ? $source['user'] : $split['user'];
            $secret = (string) ($source['secret'] ?? '') !== '' ? $source['secret'] : $split['secret'];
            $setCredentials->execute([$split['url'], $user, $secret, $source['descr']]);
        }
    }
}

/*
 * Video sources: per-source "skip TLS certificate verification" and the
 * pinned certificate of the device (NethServer/dev#7535). Added after
 * MIGRATION_SCRIPT 3 was released to test instances, so it does not depend on
 * the version: it runs at every start and only adds the missing columns.
 */
function migrateStreamingTlsSchema(\PDO $db): void
{
    $columns = $db->query("SELECT COLUMN_NAME
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = 'asterisk' AND TABLE_NAME = 'rest_cti_streaming'")->fetchAll(\PDO::FETCH_COLUMN);
    if (empty($columns)) {
        // The table is created by the MariaDB initialization: nothing to migrate.
        return;
    }
    if (!in_array('tls_skip_verify', $columns, true)) {
        $db->exec("ALTER TABLE `asterisk`.`rest_cti_streaming` ADD COLUMN `tls_skip_verify` tinyint(1) NOT NULL DEFAULT 0");
    }
    if (!in_array('tls_fingerprint', $columns, true)) {
        $db->exec("ALTER TABLE `asterisk`.`rest_cti_streaming` ADD COLUMN `tls_fingerprint` varchar(64) DEFAULT NULL");
    }
}

/*
 * Return the URL without its user info and the decoded credentials, or null
 * when the URL has no credentials (or cannot be parsed).
 */
function streamingMigrationSplitCredentials(string $url): ?array
{
    if (!preg_match('#^([a-z][a-z0-9+.-]*://)([^/?\#]*)(.*)$#is', $url, $matches)) {
        return null;
    }
    // A raw "@" in the password is common: the host starts after the last one.
    $at = strrpos($matches[2], '@');
    if ($at === false) {
        return null;
    }
    $userinfo = substr($matches[2], 0, $at);
    $colon = strpos($userinfo, ':');
    $user = $colon === false ? $userinfo : substr($userinfo, 0, $colon);
    $secret = $colon === false ? '' : substr($userinfo, $colon + 1);
    return [
        'url' => $matches[1] . substr($matches[2], $at + 1) . $matches[3],
        'user' => rawurldecode($user),
        'secret' => rawurldecode($secret),
    ];
}
