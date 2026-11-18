<?php

#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

if (!defined('ADMINPHONE_ACCOUNTCODE')) {
    include_once __DIR__ . '/../lib/libAdminPhone.php';
}

const DASHBOARD_CALLS_QUERY = "SELECT
        MAX(disposition = 'ANSWERED') AS answered,
        MAX(disposition IN ('NO ANSWER', 'BUSY')) AS missed,
        HOUR(MIN(calldate)) AS hour
    FROM asteriskcdrdb.cdr
    WHERE calldate >= ? AND calldate < ? AND dst NOT LIKE '*%'
    GROUP BY COALESCE(NULLIF(linkedid, ''), uniqueid)
    HAVING MAX(accountcode = ? OR peeraccount = ?) = 0";

function dashboardSummarizeCalls(array $calls, int $hours): array
{
    $summary = [
        'total' => 0,
        'answered' => 0,
        'missed' => 0,
        'invalid' => 0,
        'calls_by_hour' => array_fill(0, $hours, 0),
    ];

    foreach ($calls as $call) {
        $summary['total']++;
        if ((int) $call['answered']) {
            $summary['answered']++;
        } elseif ((int) $call['missed']) {
            $summary['missed']++;
        } else {
            $summary['invalid']++;
        }

        $hour = (int) $call['hour'];
        if ($hour >= 0 && $hour < $hours) {
            $summary['calls_by_hour'][$hour]++;
        }
    }

    return $summary;
}

function dashboardParseRelease(?string $imageUrl): ?string
{
    $reference = explode('@', trim((string) $imageUrl), 2)[0];
    $separator = strrpos($reference, ':');
    if ($separator === false || strpos($reference, '/', $separator) !== false) {
        return null;
    }
    $tag = substr($reference, $separator + 1);
    return $tag === '' ? null : $tag;
}

function dashboardParseUptime(string $uptime): int
{
    $seconds = explode(' ', trim($uptime))[0];
    if (!is_numeric($seconds)) {
        throw new UnexpectedValueException('Invalid uptime');
    }
    return max(0, (int) floor((float) $seconds));
}

function dashboardParseLoadAverage(string $loadavg): float
{
    $load = explode(' ', trim($loadavg))[0];
    if (!is_numeric($load)) {
        throw new UnexpectedValueException('Invalid load average');
    }
    return max(0.0, (float) $load);
}

function dashboardParseMemoryUsedPercent(string $meminfo): float
{
    $values = [];
    foreach (explode("\n", $meminfo) as $line) {
        if (preg_match('/^(\w+):\s+(\d+)/', $line, $matches)) {
            $values[$matches[1]] = (int) $matches[2];
        }
    }
    $total = $values['MemTotal'] ?? 0;
    $available = $values['MemAvailable'] ?? null;
    if ($total <= 0 || $available === null) {
        throw new UnexpectedValueException('Invalid memory information');
    }
    $used = min($total, max(0, $total - $available));
    return round($used / $total * 100, 1);
}

function dashboardReadProcFile(string $path): string
{
    $content = @file_get_contents($path);
    if ($content === false) {
        throw new RuntimeException("Cannot read $path");
    }
    return $content;
}

function dashboardSystemInfo(?string $imageUrl, string $procDirectory = '/proc'): array
{
    return [
        'release' => dashboardParseRelease($imageUrl),
        'uptime_seconds' => dashboardParseUptime(dashboardReadProcFile("$procDirectory/uptime")),
        'load_average' => dashboardParseLoadAverage(dashboardReadProcFile("$procDirectory/loadavg")),
        'memory_used_percent' => dashboardParseMemoryUsedPercent(dashboardReadProcFile("$procDirectory/meminfo")),
    ];
}

const DASHBOARD_PHONE_STATUSES = ['provisioned', 'pending', 'unassigned', 'failed', 'unknown'];
const DASHBOARD_PHONES_CACHE_TTL = 30;
const DASHBOARD_PHONES_CONCURRENCY = 20;

function dashboardNormalizeMac($mac): ?string
{
    $compact = strtoupper(str_replace([':', '-', '.'], '', trim((string) $mac)));
    return preg_match('/^[0-9A-F]{12}$/', $compact) ? $compact : null;
}

function dashboardPhoneAssignments(array $rows): array
{
    $assignments = [];
    foreach ($rows as $row) {
        $mac = dashboardNormalizeMac($row['mac'] ?? null);
        if ($mac === null) {
            continue;
        }
        $assignments[$mac] = $assignments[$mac] ?? [];
        $extension = trim((string) ($row['extension'] ?? ''));
        if ($extension !== '') {
            $assignments[$mac][] = $extension;
        }
    }
    return $assignments;
}

function dashboardRegisteredExtensions(array $astdbKeys): array
{
    $registered = [];
    foreach ($astdbKeys as $key) {
        if (preg_match('#^/registrar/contact/([^;/]+);@#', (string) $key, $matches)) {
            $registered[$matches[1]] = true;
        }
    }
    return $registered;
}

function dashboardPhoneStatus(array $extensions, $details, array $registered): string
{
    if (!$extensions) {
        return 'unassigned';
    }
    foreach ($extensions as $extension) {
        if (isset($registered[$extension])) {
            return 'provisioned';
        }
    }
    if (!is_array($details) || empty($details['tok2'])) {
        return 'unknown';
    }
    if (!empty($details['tok1'])) {
        return 'pending';
    }
    return 'failed';
}

function dashboardSummarizePhones(array $inventory, array $assignments, array $details, array $registered): array
{
    $summary = array_fill_keys(DASHBOARD_PHONE_STATUSES, 0);
    foreach ($inventory as $phone) {
        $mac = dashboardNormalizeMac(is_array($phone) ? ($phone['mac'] ?? null) : null);
        $status = $mac === null
            ? 'unknown'
            : dashboardPhoneStatus($assignments[$mac] ?? [], $details[$mac] ?? null, $registered);
        $summary[$status]++;
    }
    $summary['total'] = count($inventory);
    return $summary;
}

function dashboardFetchJson(array $urls, array $headers, int $timeout): array
{
    $multi = curl_multi_init();
    $handles = [];
    foreach ($urls as $key => $url) {
        $handle = curl_init($url);
        curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_CONNECTTIMEOUT => 2,
            CURLOPT_TIMEOUT => $timeout,
        ]);
        curl_multi_add_handle($multi, $handle);
        $handles[$key] = $handle;
    }

    do {
        $status = curl_multi_exec($multi, $running);
        if ($running && curl_multi_select($multi, 1.0) === -1) {
            usleep(10000);
        }
    } while ($running && $status === CURLM_OK);

    $results = [];
    foreach ($handles as $key => $handle) {
        $body = curl_multi_getcontent($handle);
        $decoded = curl_getinfo($handle, CURLINFO_HTTP_CODE) === 200 && is_string($body)
            ? json_decode($body, true)
            : null;
        $results[$key] = is_array($decoded) ? $decoded : null;
        curl_multi_remove_handle($multi, $handle);
        curl_close($handle);
    }
    curl_multi_close($multi);
    return $results;
}

function dashboardTancrediSettings(): array
{
    global $config;
    $host = $_ENV['NETHVOICE_HOST'] ?? getenv('NETHVOICE_HOST');
    $secret = $config['settings']['secretkey'] ?? ($_ENV['NETHVOICESECRETKEY'] ?? getenv('NETHVOICESECRETKEY'));
    $passwordHash = FreePBX::Database()
        ->query("SELECT `password_sha1` FROM `ampusers` WHERE `username` = 'admin'")
        ->fetchColumn();
    if (empty($host) || empty($secret) || empty($passwordHash)) {
        throw new RuntimeException('Missing Tancredi credentials');
    }
    return [
        'url' => "http://$host/tancredi/api/v1",
        'headers' => [
            'Accept: application/json;charset=utf-8',
            'user: admin',
            'secretkey: ' . sha1("admin{$passwordHash}{$secret}"),
        ],
    ];
}

function dashboardLoadPhoneSummary(): array
{
    global $astman;
    $tancredi = dashboardTancrediSettings();
    $inventory = dashboardFetchJson(['phones' => "{$tancredi['url']}/phones"], $tancredi['headers'], 5)['phones'];
    if (!is_array($inventory)) {
        throw new RuntimeException('Cannot read the phones from Tancredi');
    }

    $rows = FreePBX::Database()
        ->query('SELECT `mac`, `extension` FROM `rest_devices_phones` WHERE `mac` IS NOT NULL')
        ->fetchAll(PDO::FETCH_ASSOC);
    $assignments = dashboardPhoneAssignments($rows);

    $urls = [];
    foreach ($inventory as $phone) {
        $mac = dashboardNormalizeMac(is_array($phone) ? ($phone['mac'] ?? null) : null);
        if ($mac !== null && !empty($assignments[$mac])) {
            $urls[$mac] = "{$tancredi['url']}/phones/" . implode('-', str_split($mac, 2));
        }
    }
    $details = [];
    foreach (array_chunk($urls, DASHBOARD_PHONES_CONCURRENCY, true) as $chunk) {
        $details += dashboardFetchJson($chunk, $tancredi['headers'], 5);
    }

    if (empty($astman->memAstDB)) {
        $astman->LoadAstDB();
    }
    $registered = dashboardRegisteredExtensions(array_keys((array) $astman->getDBCache()));

    return dashboardSummarizePhones($inventory, $assignments, $details, $registered);
}

function dashboardCachedPhoneSummary(callable $load, string $cacheFile, int $ttl, ?int $now = null): array
{
    $now = $now ?? time();
    $cached = @file_get_contents($cacheFile);
    if ($cached !== false) {
        $entry = json_decode($cached, true);
        if (is_array($entry) && is_int($entry['time'] ?? null) && is_array($entry['summary'] ?? null)
            && is_int($entry['summary']['total'] ?? null)
            && $now - $entry['time'] >= 0 && $now - $entry['time'] < $ttl) {
            return $entry['summary'];
        }
    }

    $summary = $load();
    if (($summary['unknown'] ?? 0) > 0) {
        return $summary;
    }
    $temporary = @tempnam(dirname($cacheFile), 'phones');
    if ($temporary !== false) {
        if (@file_put_contents($temporary, json_encode(['time' => $now, 'summary' => $summary])) !== false) {
            @rename($temporary, $cacheFile);
        } else {
            @unlink($temporary);
        }
    }
    return $summary;
}

$app->get('/dashboard/calls', function (Request $request, Response $response) {
    try {
        $now = new DateTimeImmutable();
        $start = $now->setTime(0, 0);
        $statement = FreePBX::Database()->prepare(DASHBOARD_CALLS_QUERY);
        $statement->execute([
            $start->format('Y-m-d H:i:s'),
            $start->modify('+1 day')->format('Y-m-d H:i:s'),
            ADMINPHONE_ACCOUNTCODE,
            ADMINPHONE_ACCOUNTCODE,
        ]);
        $calls = $statement->fetchAll(PDO::FETCH_ASSOC);

        return jsonResponse($response, dashboardSummarizeCalls($calls, (int) $now->format('G') + 1), 200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return jsonResponse($response, 'An error occurred', 500);
    }
});

$app->get('/dashboard/system', function (Request $request, Response $response) {
    try {
        $imageUrl = $_ENV['IMAGE_URL'] ?? getenv('IMAGE_URL');
        return jsonResponse($response, dashboardSystemInfo($imageUrl === false ? null : $imageUrl), 200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return jsonResponse($response, 'An error occurred', 500);
    }
});

$app->get('/dashboard/phones', function (Request $request, Response $response) {
    try {
        $summary = dashboardCachedPhoneSummary(
            'dashboardLoadPhoneSummary',
            sys_get_temp_dir() . '/nethvoice-dashboard-phones.json',
            DASHBOARD_PHONES_CACHE_TTL
        );
        return jsonResponse($response, $summary, 200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return jsonResponse($response, 'An error occurred', 500);
    }
});
