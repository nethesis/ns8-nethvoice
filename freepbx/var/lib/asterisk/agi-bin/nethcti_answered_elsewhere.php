#!/usr/bin/env php
<?php

#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

set_time_limit(5);

if (!file_exists('/etc/freepbx.conf')) {
    exit(0);
}

include_once '/etc/freepbx.conf';

function nethcti_answered_elsewhere_log(string $message): void
{
    error_log('nethcti_answered_elsewhere: ' . $message);
}

$uniqueid = $argv[1] ?? '';
$linkedid = $argv[2] ?? '';
$dst = $argv[3] ?? '';
$lastapp = $argv[4] ?? '';

if ($uniqueid === '' || $linkedid === '' || !isset($amp_conf) || !is_array($amp_conf)) {
    exit(0);
}

$cdrDbHost = $amp_conf['CDRDBHOST'] ?: $amp_conf['AMPDBHOST'];
$cdrDbPort = $amp_conf['CDRDBPORT'] ?: $amp_conf['AMPDBPORT'];
$cdrDbName = $amp_conf['CDRDBNAME'] ?: 'asteriskcdrdb';
$cdrDbUser = $amp_conf['CDRDBUSER'] ?: $amp_conf['AMPDBUSER'];
$cdrDbPass = $amp_conf['CDRDBPASS'] ?: $amp_conf['AMPDBPASS'];
if (empty($cdrDbHost) || empty($cdrDbPort) || empty($cdrDbName) || empty($cdrDbUser)) {
    exit(0);
}

try {
    $cdrdb = new PDO(
        "mysql:host={$cdrDbHost};port={$cdrDbPort};dbname={$cdrDbName};charset=utf8",
        $cdrDbUser,
        $cdrDbPass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (Throwable $e) {
    nethcti_answered_elsewhere_log('DB connect failed: ' . $e->getMessage());
    exit(0);
}

$queueIds = [];
if ($lastapp === 'Queue' && preg_match('/^[0-9]+$/', $dst)) {
    $queueIds[] = $dst;
}

if (empty($queueIds)) {
    $queueIdsStmt = $cdrdb->prepare(
        "SELECT DISTINCT `dst`
         FROM `cdr`
         WHERE `linkedid` = :linkedid
           AND `lastapp` = 'Queue'
           AND `dst` REGEXP '^[0-9]+$'"
    );

    try {
        $queueIdsStmt->execute([
            ':linkedid' => $linkedid,
        ]);
        $queueIds = $queueIdsStmt->fetchAll(PDO::FETCH_COLUMN);
    } catch (Throwable $e) {
    nethcti_answered_elsewhere_log(sprintf(
        'queue lookup failed for uniqueid=%s linkedid=%s: %s',
        $uniqueid,
        $linkedid,
        $e->getMessage()
    ));
        exit(0);
    }
}

$answeredElsewhereEnabled = false;
foreach ($queueIds as $queueId) {
    if (!function_exists('queues_get')) {
        break;
    }
    $queue = queues_get($queueId);
    if (!is_array($queue)) {
        continue;
    }
    $value = $queue['answered_elsewhere'] ?? null;
    if (in_array((string) $value, ['1', 'yes', 'Yes', 'YES'], true)) {
        $answeredElsewhereEnabled = true;
        break;
    }
}

if (!$answeredElsewhereEnabled) {
    exit(0);
}

/*
 * Rewrite queue local-channel NO ANSWER branches to ANSWERED_ELSEWHERE
 * only when another branch on the same linkedid was actually answered.
 */
$sql = "
UPDATE `cdr` target
SET target.`disposition` = 'ANSWERED_ELSEWHERE'
WHERE target.`linkedid` = :linkedid
  AND target.`disposition` = 'NO ANSWER'
  AND target.`channel` LIKE 'Local/%@from-queue-%;2'
  AND EXISTS (
      SELECT 1
      FROM `cdr` answered
      WHERE answered.`linkedid` = target.`linkedid`
        AND answered.`uniqueid` <> target.`uniqueid`
        AND answered.`disposition` IN ('ANSWERED', 'ANSWERED_ELSEWHERE')
        AND (
            answered.`lastapp` = 'Queue'
            OR answered.`channel` LIKE 'Local/%@from-queue-%;2'
        )
  )
";

try {
    $stmt = $cdrdb->prepare($sql);
    $updatedRows = 0;
    for ($attempt = 0; $attempt < 12; $attempt++) {
        $stmt->execute([
            ':linkedid' => $linkedid,
        ]);
        $updatedRows = $stmt->rowCount();
        if ($updatedRows > 0) {
            break;
        }
        usleep(250000);
    }
} catch (Throwable $e) {
    nethcti_answered_elsewhere_log(
        sprintf(
            'update failed for uniqueid=%s linkedid=%s: %s',
            $uniqueid,
            $linkedid,
            $e->getMessage()
        )
    );
}

exit(0);
