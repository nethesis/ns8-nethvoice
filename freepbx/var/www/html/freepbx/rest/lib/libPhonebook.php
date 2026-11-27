<?php

#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

const PHONEBOOK_IMPORTER = '/usr/share/phonebooks/phonebook-import';
const PHONEBOOK_ERROR_KINDS = ['connection', 'auth', 'query', 'file', 'http', 'format', 'unknown'];
const PHONEBOOK_ERROR_DETAILS_MAX_LENGTH = 500;
const PHONEBOOK_IMPORT_FILENAME_MAX_LENGTH = 255;
const PHONEBOOK_TEXT_MAX_LENGTH = 255;
const PHONEBOOK_UPLOADS_DIR = '/var/lib/nethvoice/phonebook/uploads/';
const PHONEBOOK_CONTAINER_STARTED = '/var/run/nethvoice/freepbx-started';
const PHONEBOOK_SOURCES_DIR = '/etc/phonebook/sources.d';
const PHONEBOOK_SHARING_PREFIX = 'group:';
const PHONEBOOK_TEST_TIMEOUT = 60;
const PHONEBOOK_SYNC_TIMEOUT = 900;
const PHONEBOOK_TIMEOUT_STATUSES = [124, 137];

function phonebookDatabase(): PDO
{
    return new PDO(
        'mysql:host='.$_ENV['PHONEBOOK_DB_HOST'].';port='.$_ENV['PHONEBOOK_DB_PORT'].';dbname='.$_ENV['PHONEBOOK_DB_NAME'],
        $_ENV['PHONEBOOK_DB_USER'],
        $_ENV['PHONEBOOK_DB_PASS']);
}

function phonebookTextTooLong(string $value): bool
{
    return mb_strlen($value, 'UTF-8') > PHONEBOOK_TEXT_MAX_LENGTH;
}

function phonebookTimeLimit(int $seconds): string
{
    return 'timeout -s ALRM -k 10 ' . $seconds . ' ';
}

function phonebookTestCommand(string $file, bool $withTotal, bool $guardAddresses = false): string
{
    return phonebookTimeLimit(PHONEBOOK_TEST_TIMEOUT) . PHONEBOOK_IMPORTER . ' --check --error-json' . ($withTotal ? ' --with-total' : '') . ($guardAddresses ? ' --guard-addresses' : '') . ' ' . escapeshellarg($file);
}

function phonebookGuardedSource(array $source, ?array $stored, bool $superadmin): array
{
    unset($source['guard_addresses']);
    if ($superadmin) {
        return $source;
    }
    $sameTarget = is_array($stored)
        && ($stored['dbtype'] ?? null) === ($source['dbtype'] ?? null)
        && ($stored['url'] ?? null) === ($source['url'] ?? null)
        && ($stored['host'] ?? null) === ($source['host'] ?? null);
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
    return phonebookTimeLimit(PHONEBOOK_SYNC_TIMEOUT) . PHONEBOOK_IMPORTER . ' ' . ($force ? '--force ' : '') . escapeshellarg("/etc/phonebook/sources.d/$id.json");
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
        if ($error === null && in_array($return, PHONEBOOK_TIMEOUT_STATUSES, true)) {
            $error = ['kind' => 'connection', 'details' => 'The source did not answer within ' . PHONEBOOK_TEST_TIMEOUT . ' seconds'];
        }
        return $error === null ? ['status' => false] : ['status' => false, 'error' => $error];
    }
    $res = isset($output[0]) ? json_decode($output[0]) : null;
    if ($withTotal) {
        if (!is_object($res) || !is_array($res->rows ?? null) || !is_int($res->total ?? null)) {
            return ['status' => false];
        }
        $result = ['rows' => array_slice($res->rows, 0, 3), 'total' => $res->total];
        $columns = $res->columns ?? null;
        if (is_array($columns) && array_filter($columns, 'is_string') === $columns) {
            $result['columns'] = array_values($columns);
        }
        return $result;
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

function phonebookRenameSharingGroup(string $sharing, string $oldName, string $newName): string
{
    if (strpos($sharing, PHONEBOOK_SHARING_PREFIX) !== 0) {
        return $sharing;
    }
    $renamed = false;
    $groups = array();
    foreach (explode(',', substr($sharing, strlen(PHONEBOOK_SHARING_PREFIX))) as $group) {
        $group = trim($group);
        if ($group === '') {
            continue;
        }
        if (mb_strtolower($group) === mb_strtolower($oldName)) {
            $group = $newName;
            $renamed = true;
        }
        if (!in_array(mb_strtolower($group), array_map('mb_strtolower', $groups), true)) {
            $groups[] = $group;
        }
    }
    return $renamed ? PHONEBOOK_SHARING_PREFIX . implode(',', $groups) : $sharing;
}

function phonebookSourcesSharingRename(string $dir, string $oldName, string $newName, int $maxLength): array
{
    $files = array();
    $problems = array();
    foreach (glob(rtrim($dir, '/') . '/*.json') ?: array() as $path) {
        $id = basename($path, '.json');
        $content = is_readable($path) ? file_get_contents($path) : false;
        $config = is_string($content) ? json_decode($content) : null;
        if (!is_object($config)) {
            if (!is_string($content) || mb_stripos($content, $oldName) !== false) {
                $problems[] = 'The phonebook source ' . $id . ' cannot be read';
            }
            continue;
        }
        $changed = false;
        foreach ($config as $sid => $source) {
            if (!is_object($source) || !isset($source->access) || !is_string($source->access)) {
                continue;
            }
            $sharing = phonebookRenameSharingGroup($source->access, $oldName, $newName);
            if ($sharing === $source->access) {
                continue;
            }
            if (mb_strlen($sharing) > $maxLength) {
                $problems[] = 'The sharing of the phonebook source ' . $sid . ' would be longer than ' . $maxLength . ' characters';
                continue;
            }
            $source->access = $sharing;
            $changed = true;
        }
        if (!$changed) {
            continue;
        }
        if (!is_writable($path) || !is_writable(dirname($path))) {
            $problems[] = 'The phonebook source ' . $id . ' cannot be written';
            continue;
        }
        $files[$path] = array('old' => $content, 'new' => json_encode($config));
    }
    return array('files' => $files, 'problems' => $problems);
}

function phonebookReplaceFile(string $path, string $content): void
{
    $temporary = @tempnam(dirname($path), '.rename-');
    if ($temporary === false || dirname($temporary) !== dirname($path)) {
        if ($temporary !== false) {
            unlink($temporary);
        }
        throw new RuntimeException('Cannot write ' . $path);
    }
    if (file_put_contents($temporary, $content) !== strlen($content) || !chmod($temporary, fileperms($path) & 0777) || !rename($temporary, $path)) {
        @unlink($temporary);
        throw new RuntimeException('Cannot write ' . $path);
    }
}

function phonebookWriteFiles(array $files, string $key): array
{
    $written = array();
    try {
        foreach ($files as $path => $contents) {
            phonebookReplaceFile($path, $contents[$key]);
            $written[] = $path;
        }
    } catch (Throwable $e) {
        phonebookRestoreFiles(array_intersect_key($files, array_flip($written)));
        throw $e;
    }
    return $written;
}

function phonebookRestoreFiles(array $files): void
{
    foreach ($files as $path => $contents) {
        try {
            phonebookReplaceFile($path, $contents['old']);
        } catch (Throwable $e) {
            error_log('Cannot restore ' . $path . ': ' . $e->getMessage());
        }
    }
}

function phonebookSharingRenameRows(PDO $db, string $table, string $column, string $oldName, string $newName, int $maxLength): array
{
    $sth = $db->prepare('SELECT `id`, `' . $column . '` AS `sharing` FROM `' . $table . '` WHERE `' . $column . '` LIKE ?');
    $sth->execute(array(PHONEBOOK_SHARING_PREFIX . '%'));
    $changes = array();
    $tooLong = 0;
    foreach ($sth->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $sharing = phonebookRenameSharingGroup((string) $row['sharing'], $oldName, $newName);
        if ($sharing === (string) $row['sharing']) {
            continue;
        }
        if (mb_strlen($sharing) > $maxLength) {
            $tooLong++;
            continue;
        }
        $changes[] = array('id' => $row['id'], 'old' => (string) $row['sharing'], 'new' => $sharing);
    }
    return array('changes' => $changes, 'too_long' => $tooLong);
}

function phonebookApplySharingRows(PDO $db, string $table, string $column, array $changes, string $key): void
{
    $ids = array();
    foreach ($changes as $change) {
        $ids[$change[$key]][] = $change['id'];
    }
    foreach ($ids as $sharing => $rowIds) {
        foreach (array_chunk($rowIds, 500) as $chunk) {
            $sth = $db->prepare('UPDATE `' . $table . '` SET `' . $column . '` = ? WHERE `id` IN (' . implode(',', array_fill(0, count($chunk), '?')) . ')');
            $sth->execute(array_merge(array((string) $sharing), $chunk));
        }
    }
}
