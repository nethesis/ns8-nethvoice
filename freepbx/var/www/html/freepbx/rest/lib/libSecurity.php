<?php

#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

function nethvoiceIsForbiddenAddress(string $ip): bool
{
    $packed = @inet_pton($ip);
    if ($packed === false) {
        return true;
    }
    if (strlen($packed) === 16) {
        $prefix = substr($packed, 0, 12);
        if ($prefix === str_repeat("\0", 10) . "\xff\xff" || $prefix === str_repeat("\0", 12)) {
            $packed = substr($packed, 12);
        } else {
            return (ord($packed[0]) === 0xfe && (ord($packed[1]) & 0xc0) === 0x80);
        }
    }
    $first = ord($packed[0]);

    return $first === 0 || $first === 127 || ($first === 169 && ord($packed[1]) === 254);
}

function nethvoiceResolveHost(string $host): array
{
    if (filter_var($host, FILTER_VALIDATE_IP) !== false) {
        return [$host];
    }
    $addresses = gethostbynamel($host) ?: [];
    $records = @dns_get_record($host, DNS_AAAA);
    foreach (is_array($records) ? $records : [] as $record) {
        if (!empty($record['ipv6'])) {
            $addresses[] = $record['ipv6'];
        }
    }

    return array_values(array_unique($addresses));
}

function nethvoiceParseFetchUrl($url, array $schemes = ['http', 'https']): ?array
{
    if (!is_string($url) || $url === '' || preg_match('/[\x00-\x20\x7f\\\\]/', $url)) {
        return null;
    }
    $parts = parse_url($url);
    if (!is_array($parts) || !isset($parts['scheme'], $parts['host'])) {
        return null;
    }
    $scheme = strtolower($parts['scheme']);
    $host = strtolower(trim($parts['host'], '[]'));
    if (!in_array($scheme, $schemes, true) || $host === '') {
        return null;
    }
    $port = isset($parts['port']) ? (int) $parts['port'] : ($scheme === 'https' ? 443 : 80);
    $userinfo = '';
    if (isset($parts['user'])) {
        $userinfo = $parts['user'] . (isset($parts['pass']) ? ':' . $parts['pass'] : '') . '@';
    }
    $hostPart = filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6) !== false ? '[' . $host . ']' : $host;

    return [
        'scheme' => $scheme,
        'host' => $host,
        'port' => $port,
        'url' => $scheme . '://' . $userinfo . $hostPart . (isset($parts['port']) ? ':' . $port : '')
            . ($parts['path'] ?? '') . (isset($parts['query']) ? '?' . $parts['query'] : ''),
    ];
}

function nethvoiceCheckFetchUrl($url, array $schemes = ['http', 'https']): ?array
{
    $target = nethvoiceParseFetchUrl($url, $schemes);
    if ($target === null) {
        return null;
    }
    $addresses = nethvoiceResolveHost($target['host']);
    if (!$addresses) {
        return null;
    }
    foreach ($addresses as $address) {
        if (nethvoiceIsForbiddenAddress($address)) {
            return null;
        }
    }
    $target['addresses'] = $addresses;

    return $target;
}

function nethvoiceFetchUrl($url, int $connectTimeout = 5, int $timeout = 10)
{
    $target = nethvoiceCheckFetchUrl($url);
    if ($target === null) {
        return null;
    }
    $pinned = array_map(fn($address) => str_contains($address, ':') ? '[' . $address . ']' : $address, $target['addresses']);

    $curl = curl_init($target['url']);
    if (defined('CURLOPT_PROTOCOLS_STR')) {
        curl_setopt($curl, CURLOPT_PROTOCOLS_STR, 'http,https');
        curl_setopt($curl, CURLOPT_REDIR_PROTOCOLS_STR, 'http,https');
    } else {
        curl_setopt($curl, CURLOPT_PROTOCOLS, CURLPROTO_HTTP | CURLPROTO_HTTPS);
        curl_setopt($curl, CURLOPT_REDIR_PROTOCOLS, CURLPROTO_HTTP | CURLPROTO_HTTPS);
    }
    curl_setopt($curl, CURLOPT_FOLLOWLOCATION, false);
    if (filter_var($target['host'], FILTER_VALIDATE_IP) === false) {
        curl_setopt($curl, CURLOPT_RESOLVE, [$target['host'] . ':' . $target['port'] . ':' . implode(',', $pinned)]);
    }
    curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($curl, CURLOPT_CONNECTTIMEOUT, $connectTimeout);
    curl_setopt($curl, CURLOPT_TIMEOUT, $timeout);
    $body = curl_exec($curl);
    $error = curl_error($curl);
    $primaryIp = (string) curl_getinfo($curl, CURLINFO_PRIMARY_IP);

    if ($body === false) {
        error_log(__FILE__ . ':' . __LINE__ . ' curl error: ' . $error);
        return false;
    }
    if ($primaryIp === '' || nethvoiceIsForbiddenAddress($primaryIp)) {
        return false;
    }

    return $body;
}

function nethvoicePhonebookUrlAllowed($dbtype, $url, array $knownUrls, bool $uploadedFile): bool
{
    if ($dbtype !== 'csv' && $dbtype !== 'infinity') {
        return true;
    }
    if (!is_string($url)) {
        return false;
    }
    if (in_array($url, $knownUrls, true)) {
        return true;
    }
    if ($dbtype === 'csv') {
        return $uploadedFile || nethvoiceCheckFetchUrl(trim($url)) !== null;
    }
    $url = trim($url);

    return nethvoiceCheckFetchUrl(strpos($url, '://') === false ? 'https://' . $url : $url) !== null;
}

function nethvoiceWithoutUserSecrets(array $users): array
{
    foreach ($users as $i => $user) {
        unset($users[$i]['password']);
        foreach (is_array($user['devices'] ?? null) ? $user['devices'] : [] as $j => $device) {
            unset($users[$i]['devices'][$j]['secret'], $users[$i]['devices'][$j]['web_user'], $users[$i]['devices'][$j]['web_password']);
        }
    }

    return $users;
}

function nethvoiceWithoutLineSecrets(array $phones): array
{
    foreach ($phones as $i => $phone) {
        if (!is_array($phone) || !is_array($phone['lines'] ?? null)) {
            continue;
        }
        foreach ($phone['lines'] as $j => $line) {
            if (is_object($line)) {
                $line = clone $line;
                unset($line->secret, $line->web_user, $line->web_password);
            } elseif (is_array($line)) {
                unset($line['secret'], $line['web_user'], $line['web_password']);
            }
            $phones[$i]['lines'][$j] = $line;
        }
    }

    return $phones;
}

function nethvoiceWithoutStoredPassword($item, string $field, bool $keepPassword = false)
{
    if (is_object($item)) {
        $item = clone $item;
        $item->has_password = isset($item->$field) && (string) $item->$field !== '';
        if (!$keepPassword) {
            unset($item->$field);
        }
    } elseif (is_array($item)) {
        $item['has_password'] = isset($item[$field]) && (string) $item[$field] !== '';
        if (!$keepPassword) {
            unset($item[$field]);
        }
    }

    return $item;
}

function nethvoiceWithoutStoredPasswords(array $items, string $field, bool $keepPassword = false): array
{
    foreach ($items as $key => $item) {
        $items[$key] = nethvoiceWithoutStoredPassword($item, $field, $keepPassword);
    }

    return $items;
}

function nethvoiceStoredTargetChanged(array $data, array $stored, array $targetFields): bool
{
    foreach ($targetFields as $field) {
        if (!array_key_exists($field, $data)) {
            continue;
        }
        if (trim((string) $data[$field]) !== trim((string) ($stored[$field] ?? ''))) {
            return true;
        }
    }

    return false;
}

function nethvoiceKeepStoredPassword(array $data, ?array $stored, string $field, array $targetFields): ?array
{
    if (isset($data[$field]) && is_scalar($data[$field]) && (string) $data[$field] !== '') {
        return $data;
    }
    unset($data[$field]);
    $storedPassword = is_array($stored) ? (string) ($stored[$field] ?? '') : '';
    if ($storedPassword === '') {
        return $data;
    }
    if (nethvoiceStoredTargetChanged($data, $stored, $targetFields)) {
        return null;
    }
    $data[$field] = $storedPassword;

    return $data;
}
