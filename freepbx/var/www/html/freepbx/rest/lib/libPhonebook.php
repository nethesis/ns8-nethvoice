<?php

#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

const PHONEBOOK_IMPORTER = '/usr/share/phonebooks/phonebook-import';
const PHONEBOOK_ERROR_KINDS = ['connection', 'auth', 'query', 'file', 'http', 'format', 'unknown'];
const PHONEBOOK_ERROR_DETAILS_MAX_LENGTH = 500;
const PHONEBOOK_IMPORT_FILENAME_MAX_LENGTH = 255;
const PHONEBOOK_UPLOADS_DIR = '/var/lib/nethvoice/phonebook/uploads/';
const PHONEBOOK_CONTAINER_STARTED = '/var/run/nethvoice/freepbx-started';

function phonebookDatabase(): PDO
{
    return new PDO(
        'mysql:host='.$_ENV['PHONEBOOK_DB_HOST'].';port='.$_ENV['PHONEBOOK_DB_PORT'].';dbname='.$_ENV['PHONEBOOK_DB_NAME'],
        $_ENV['PHONEBOOK_DB_USER'],
        $_ENV['PHONEBOOK_DB_PASS']);
}

function phonebookTestCommand(string $file, bool $withTotal, bool $guardAddresses = false): string
{
    return PHONEBOOK_IMPORTER . ' --check --error-json' . ($withTotal ? ' --with-total' : '') . ($guardAddresses ? ' --guard-addresses' : '') . ' ' . escapeshellarg($file);
}

function phonebookGuardedSource(array $source, ?array $stored, bool $superadmin): array
{
    unset($source['guard_addresses']);
    if ($superadmin) {
        return $source;
    }
    $sameTarget = is_array($stored)
        && ($stored['dbtype'] ?? null) === ($source['dbtype'] ?? null)
        && ($stored['url'] ?? null) === ($source['url'] ?? null);
    if (!$sameTarget || ($stored['guard_addresses'] ?? false) === true) {
        $source['guard_addresses'] = true;
    }
    return $source;
}

function phonebookPublicSource($source)
{
    if (is_object($source)) {
        $source = clone $source;
        unset($source->guard_addresses);
    } elseif (is_array($source)) {
        unset($source['guard_addresses']);
    }
    return $source;
}

function phonebookSyncCommand(string $id, bool $force): string
{
    return PHONEBOOK_IMPORTER . ' ' . ($force ? '--force ' : '') . escapeshellarg("/etc/phonebook/sources.d/$id.json");
}

function phonebookTestError(array $output): ?array
{
    $line = $output === [] ? '' : trim((string) end($output));
    $error = json_decode($line, true);
    if (!is_array($error) || !in_array($error['kind'] ?? null, PHONEBOOK_ERROR_KINDS, true) || !is_string($error['details'] ?? null)) {
        return null;
    }
    return ['kind' => $error['kind'], 'details' => mb_substr($error['details'], 0, PHONEBOOK_ERROR_DETAILS_MAX_LENGTH)];
}

function phonebookTestResult(int $return, array $output, bool $withTotal): array
{
    if ($return != 0) {
        $error = phonebookTestError($output);
        return $error === null ? ['status' => false] : ['status' => false, 'error' => $error];
    }
    $res = isset($output[0]) ? json_decode($output[0]) : null;
    if ($withTotal) {
        if (!is_object($res) || !is_array($res->rows ?? null) || !is_int($res->total ?? null)) {
            return ['status' => false];
        }
        return ['rows' => array_slice($res->rows, 0, 3), 'total' => $res->total];
    }
    if (!is_array($res)) {
        return ['status' => false];
    }
    return array_slice($res, 0, 3);
}

function phonebookIsoTime($value): ?string
{
    if ($value === null || $value === '') {
        return null;
    }
    $time = is_numeric($value) ? (int) $value : strtotime($value . ' UTC');
    return $time === false ? null : gmdate('Y-m-d\TH:i:s\Z', $time);
}

function phonebookIsMissingTable(PDOException $e): bool
{
    return ($e->errorInfo[0] ?? null) === '42S02';
}

function phonebookContainerStartedAt(string $marker = PHONEBOOK_CONTAINER_STARTED): ?int
{
    $time = @filemtime($marker);
    return $time === false ? null : $time;
}

function phonebookSyncStatuses(PDO $db, ?int $startedAt = null): array
{
    try {
        $rows = $db->query('SELECT sid, status, started_at, finished_at, imported, message FROM sync_status ORDER BY sid')->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        if (phonebookIsMissingTable($e)) {
            return [];
        }
        throw $e;
    }
    return array_map(function ($row) use ($startedAt) {
        $interrupted = $startedAt !== null && $row['status'] === 'running'
            && strtotime($row['started_at'] . ' UTC') < $startedAt;
        return [
            'id' => (string) $row['sid'],
            'status' => $interrupted ? 'failed' : (string) $row['status'],
            'started_at' => phonebookIsoTime($row['started_at']),
            'finished_at' => phonebookIsoTime($row['finished_at']),
            'imported' => $row['imported'] === null ? null : (int) $row['imported'],
            'message' => $interrupted ? 'The sync was interrupted' : ($row['message'] === null ? null : (string) $row['message']),
        ];
    }, $rows);
}

function phonebookDeleteSyncStatus(PDO $db, string $id): void
{
    try {
        $db->prepare('DELETE FROM sync_status WHERE sid = ?')->execute([$id]);
    } catch (Throwable $e) {
        error_log('Cannot delete the sync status of phonebook source ' . $id . ': ' . $e->getMessage());
    }
}

function phonebookImportFilename($value): ?string
{
    if (!is_string($value)) {
        return null;
    }
    $name = trim(basename(str_replace('\\', '/', $value)));
    return $name === '' ? null : mb_substr($name, 0, PHONEBOOK_IMPORT_FILENAME_MAX_LENGTH);
}

function phonebookRecordImport(PDO $db, string $owner, ?string $filename, string $type, $result, int $time): void
{
    if (!is_array($result)) {
        return;
    }
    $count = fn($key) => max(0, (int) ($result[$key] ?? 0));
    try {
        $db->prepare('INSERT INTO rest_phonebook_imports (created_at, owner, filename, `type`, total, imported, skipped, failed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([$time, $owner, $filename, $type, $count('total_rows'), $count('imported_rows'), $count('skipped_rows'), $count('failed_rows')]);
    } catch (Throwable $e) {
        error_log('Cannot record the phonebook import: ' . $e->getMessage());
    }
}

function phonebookImports(PDO $db): array
{
    try {
        $rows = $db->query('SELECT id, created_at, owner, filename, `type`, total, imported, skipped, failed FROM rest_phonebook_imports ORDER BY created_at DESC, id DESC')->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        if (phonebookIsMissingTable($e)) {
            return [];
        }
        throw $e;
    }
    return array_map(fn($row) => [
        'id' => (int) $row['id'],
        'created_at' => phonebookIsoTime($row['created_at']),
        'owner' => (string) $row['owner'],
        'filename' => $row['filename'] === null ? null : (string) $row['filename'],
        'type' => (string) $row['type'],
        'total' => (int) $row['total'],
        'imported' => (int) $row['imported'],
        'skipped' => (int) $row['skipped'],
        'failed' => (int) $row['failed'],
    ], $rows);
}

function phonebookDeleteUpload(string $name, callable $inUse, string $dir = PHONEBOOK_UPLOADS_DIR): string
{
    if (preg_match('/^[0-9a-f]{13}\.csv\z/', $name) !== 1) {
        return 'invalid';
    }
    $path = $dir . $name;
    if (is_link($path) || !is_file($path)) {
        return 'missing';
    }
    if ($inUse($path)) {
        return 'in_use';
    }
    return unlink($path) ? 'deleted' : 'failed';
}

function phonebookDeleteImportedUpload(int $status, $url, callable $inUse, string $dir = PHONEBOOK_UPLOADS_DIR): ?string
{
    if ($status < 200 || $status >= 300) {
        return null;
    }
    $prefix = 'file://' . $dir;
    if (!is_string($url) || strpos($url, $prefix) !== 0) {
        return 'invalid';
    }
    return phonebookDeleteUpload(substr($url, strlen($prefix)), $inUse, $dir);
}
