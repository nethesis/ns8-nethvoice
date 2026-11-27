<?php

#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

const CSV_IMPORT_STATUS = '/var/run/nethvoice/csvimport.code';
const CSV_IMPORT_MAX_BASE64_LENGTH = 131072;
const CSV_IMPORT_START_GRACE_SECONDS = 30;
const CSV_IMPORT_KEEP_SECONDS = 86400;
const CSV_IMPORT_ID_PATTERN = '/^[a-f0-9]{16}$/D';
const CSV_IMPORT_STOPPED = 'CSV import stopped unexpectedly';
const CSV_IMPORT_NOT_ACTIVE = 'No csv import active';

function csvExportCell($value): string
{
    $value = (string) $value;
    if (preg_match('/^[+-]?[0-9][0-9 ().\/-]*$/', $value) === 1) {
        return $value;
    }
    return preg_match('/^[=+\-@\t\r]/', $value) === 1 ? "'" . $value : $value;
}

function csvImportCell($value): string
{
    $value = (string) $value;
    return preg_match('/^\'[=+\-@\t\r]/', $value) === 1 ? substr($value, 1) : $value;
}

function csvImportProcessAlive(int $pid): bool
{
    return $pid > 0 && is_dir('/proc/' . $pid);
}

function csvImportReadStatus(string $file): ?array
{
    if (!is_file($file)) {
        return null;
    }
    $status = json_decode((string) @file_get_contents($file), true);
    return is_array($status) ? $status : null;
}

function csvImportWriteStatus(string $file, array $status): bool
{
    $temporary = $file . '.' . bin2hex(random_bytes(4)) . '.tmp';
    if (@file_put_contents($temporary, json_encode($status)) === false) {
        @unlink($temporary);
        return @file_put_contents($file, json_encode($status)) !== false;
    }
    if (!@rename($temporary, $file)) {
        @unlink($temporary);
        return false;
    }
    return true;
}

function csvImportWithLock(string $statusFile, callable $work)
{
    $lock = @fopen($statusFile . '.lock', 'c');
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

function csvImportRunning(array $status, callable $alive, int $now): bool
{
    if (isset($status['exitcode'])) {
        return false;
    }
    if (isset($status['pid']) && is_int($status['pid'])) {
        return (bool) $alive($status['pid']);
    }
    if (isset($status['started_at']) && is_int($status['started_at'])) {
        return $now - $status['started_at'] < CSV_IMPORT_START_GRACE_SECONDS;
    }
    return true;
}

function csvImportStopped(array $status): array
{
    return ['exitcode' => 1, 'errors' => CSV_IMPORT_STOPPED, 'progress' => -1, 'problems' => [['code' => 'stopped']]]
        + array_intersect_key($status, ['id' => true]);
}

function csvImportArchivePath(string $statusFile, string $id): string
{
    return $statusFile . '.' . $id;
}

function csvImportPayloadPath(string $statusFile, string $id): string
{
    return $statusFile . '.' . $id . '.csv';
}

function csvImportCleanup(string $statusFile, int $now): void
{
    foreach (glob($statusFile . '.*') ?: [] as $file) {
        if (preg_match('/\.[a-f0-9]{16}(\.csv)?$/D', $file) === 1 && is_file($file) && $now - (int) @filemtime($file) > CSV_IMPORT_KEEP_SECONDS) {
            @unlink($file);
        }
    }
}

function csvImportStart($base64, array $options, callable $spawn, string $statusFile = CSV_IMPORT_STATUS, ?callable $alive = null, ?int $now = null): array
{
    if (!is_string($base64) || $base64 === '') {
        return [400, ['code' => 'invalid_request', 'message' => 'Invalid or empty CSV input']];
    }
    if (strlen($base64) > CSV_IMPORT_MAX_BASE64_LENGTH) {
        return [413, ['code' => 'file_too_large', 'message' => 'The CSV file is too large']];
    }
    $alive = $alive ?? 'csvImportProcessAlive';
    $now = $now ?? time();
    return csvImportWithLock($statusFile, function () use ($base64, $options, $spawn, $statusFile, $alive, $now) {
        $current = csvImportReadStatus($statusFile);
        if ($current !== null && csvImportRunning($current, $alive, $now)) {
            return [409, ['code' => 'import_running', 'message' => 'Another CSV import is running']];
        }
        if ($current !== null && !isset($current['exitcode'])) {
            $current = csvImportStopped($current);
        }
        if ($current !== null && is_string($current['id'] ?? null) && preg_match(CSV_IMPORT_ID_PATTERN, $current['id']) === 1) {
            csvImportWriteStatus(csvImportArchivePath($statusFile, $current['id']), $current);
        }
        csvImportCleanup($statusFile, $now);
        $id = bin2hex(random_bytes(8));
        $payload = csvImportPayloadPath($statusFile, $id);
        if (@file_put_contents($payload, $base64) === false) {
            return [500, ['code' => 'import_failed', 'message' => 'Cannot start the CSV import']];
        }
        @chmod($payload, 0600);
        @unlink($statusFile);
        csvImportWriteStatus($statusFile, ['id' => $id, 'progress' => 0, 'started_at' => $now]);
        $arguments = array_merge(['--file=' . $payload, '--id=' . $id], $options);
        $spawn(implode(' ', array_map('escapeshellarg', $arguments)));
        return [200, ['id' => $id]];
    });
}

function csvImportStatus($id, string $statusFile = CSV_IMPORT_STATUS, ?callable $alive = null, ?int $now = null): array
{
    $alive = $alive ?? 'csvImportProcessAlive';
    $now = $now ?? time();
    $notActive = [422, ['status' => CSV_IMPORT_NOT_ACTIVE]];
    if ($id !== null && (!is_string($id) || preg_match(CSV_IMPORT_ID_PATTERN, $id) !== 1)) {
        return $notActive;
    }
    return csvImportWithLock($statusFile, function () use ($id, $statusFile, $alive, $now, $notActive) {
        $file = $statusFile;
        $status = csvImportReadStatus($file);
        if ($id !== null && ($status === null || ($status['id'] ?? null) !== $id)) {
            $file = csvImportArchivePath($statusFile, $id);
            $status = csvImportReadStatus($file);
        }
        if ($status === null) {
            return $notActive;
        }
        if (!isset($status['exitcode']) && !csvImportRunning($status, $alive, $now)) {
            $status = csvImportStopped($status);
        }
        if (!isset($status['exitcode'])) {
            return [200, ['result' => $status['progress'] ?? 0]];
        }
        @unlink($file);
        if ($file === $statusFile && $id === null && is_string($status['id'] ?? null) && preg_match(CSV_IMPORT_ID_PATTERN, $status['id']) === 1) {
            csvImportWriteStatus(csvImportArchivePath($statusFile, $status['id']), $status);
        }
        if ($status['exitcode'] != 0) {
            $body = ['status' => (string) ($status['errors'] ?? '')];
            if (is_array($status['problems'] ?? null)) {
                $body['problems'] = $status['problems'];
            }
            return [500, $body];
        }
        return [200, ['result' => $status['progress'] ?? 100]];
    });
}

function csvImportArguments(array $arguments): array
{
    $parsed = ['payload' => null, 'id' => null, 'caller' => '', 'restricted' => false, 'rfc4180' => false, 'file' => null];
    foreach ($arguments as $index => $argument) {
        $argument = (string) $argument;
        if (str_starts_with($argument, '--file=')) {
            $parsed['file'] = substr($argument, 7);
        } elseif (str_starts_with($argument, '--id=')) {
            $id = substr($argument, 5);
            $parsed['id'] = preg_match(CSV_IMPORT_ID_PATTERN, $id) === 1 ? $id : null;
        } elseif (str_starts_with($argument, '--caller=')) {
            $parsed['caller'] = substr($argument, 9);
        } elseif ($argument === 'restricted') {
            $parsed['restricted'] = true;
        } elseif ($argument === 'rfc4180') {
            $parsed['rfc4180'] = true;
        } elseif ($index === 0) {
            $parsed['payload'] = $argument;
        }
    }
    if ($parsed['file'] !== null) {
        $parsed['payload'] = is_file($parsed['file']) ? (string) @file_get_contents($parsed['file']) : '';
        @unlink($parsed['file']);
    }
    return $parsed;
}
