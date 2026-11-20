<?php

#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

const NETHVOICE_PARAMURL_NAME_MAX_LENGTH = 50;

function nethvoiceParamUrlHost(string $url): string
{
    $url = trim($url);
    $host = parse_url($url, PHP_URL_HOST);
    if (!is_string($host) || $host === '') {
        $host = parse_url('http://' . $url, PHP_URL_HOST);
    }

    return is_string($host) && $host !== '' ? strtolower($host) : $url;
}

function nethvoiceDefaultParamUrlNames(array $rows): array
{
    $hosts = [];
    $count = [];
    foreach ($rows as $row) {
        $host = nethvoiceParamUrlHost((string) $row['url']);
        $hosts[$row['id']] = $host;
        $count[$host] = ($count[$host] ?? 0) + 1;
    }

    $names = [];
    foreach ($rows as $row) {
        if ((string) $row['name'] !== '') {
            continue;
        }
        $host = $hosts[$row['id']];
        $suffix = $count[$host] > 1 ? ' (' . ($row['profile'] ?? $row['profile_id']) . ')' : '';
        $room = max(0, NETHVOICE_PARAMURL_NAME_MAX_LENGTH - mb_strlen($suffix));
        $name = mb_substr(mb_substr($host, 0, $room) . $suffix, 0, NETHVOICE_PARAMURL_NAME_MAX_LENGTH);
        if ($name !== '') {
            $names[$row['id']] = $name;
        }
    }

    return $names;
}

function nethvoiceFillParamUrlNames($db): void
{
    $rows = $db->query('SELECT u.id, u.profile_id, u.url, u.name, p.name AS profile FROM rest_cti_profiles_paramurl AS u LEFT JOIN rest_cti_profiles AS p ON p.id = u.profile_id ORDER BY u.id')->fetchAll(PDO::FETCH_ASSOC);
    $names = nethvoiceDefaultParamUrlNames($rows);
    if (!$names) {
        return;
    }
    $sth = $db->prepare("UPDATE rest_cti_profiles_paramurl SET name = ? WHERE id = ? AND name = ''");
    foreach ($names as $id => $name) {
        $sth->execute([$name, $id]);
    }
}

function nethvoiceIsValidParamUrlName(string $name): bool
{
    return trim($name) !== ''
        && preg_match('//u', $name) === 1
        && mb_strlen($name) <= NETHVOICE_PARAMURL_NAME_MAX_LENGTH
        && preg_match('/[\x00-\x1F\x7F]/', $name) !== 1;
}

function nethvoiceParamUrlNamesInput($data, bool $restricted): ?array
{
    if (!is_array($data) || !array_key_exists('names', $data)) {
        return [];
    }
    if (!is_array($data['names'])) {
        return null;
    }
    foreach ($data['names'] as $name) {
        if (!is_string($name) || ($restricted && !nethvoiceIsValidParamUrlName($name))) {
            return null;
        }
    }

    return $data['names'];
}

function nethvoiceSaveParamUrlNames($db, array $profiles, array $names): void
{
    $sth = null;
    foreach ($profiles as $profile) {
        if (!(is_int($profile) || is_string($profile)) || !isset($names[$profile])) {
            continue;
        }
        $sth ??= $db->prepare('UPDATE rest_cti_profiles_paramurl SET name = ? WHERE profile_id = ?');
        $sth->execute([$names[$profile], $profile]);
    }
    nethvoiceFillParamUrlNames($db);
}

function nethvoiceParamUrlNamesByProfile($db): array
{
    $names = [];
    foreach ($db->query('SELECT profile_id, name FROM rest_cti_profiles_paramurl')->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $names[(string) $row['profile_id']] = (string) $row['name'];
    }

    return $names;
}
