<?php
// SPDX-License-Identifier: GPL-3.0-or-later

const TRUNK_DNS_DIR = '/etc/asterisk/nethvoice-trunk-dns';

// The driver keys sections by endpoint name. Follow the same overwrite order
// for legacy/copied trunks which share a name.
function nethvoice_add_trunk_headers(array &$sections, array $trunks, string $dir = TRUNK_DNS_DIR): void
{
    $proxy = getenv('PROXY_IP');
    $port = getenv('PROXY_PORT');
    if (!$proxy || !$port) {
        return;
    }
    $active = [];
    foreach ($trunks as $id => $trunk) {
        if (!empty($trunk['trunk_name']) && ($trunk['disabletrunk'] ?? '') !== 'on') {
            $active[$trunk['trunk_name']] = $id;
        }
    }
    foreach ($active as $endpoint => $id) {
        $trunk = $trunks[$id];
        if (!isset($sections[$endpoint]['endpoint']) || ($trunk['registration'] ?? '') !== 'none'
            || !in_array($trunk['authentication'] ?? '', ['none', 'outbound', 'off'], true)
            || ($trunk['outbound_proxy'] ?? '') !== "sip:$proxy:$port;lr") {
            continue;
        }
        $host = strtolower(trim($trunk['sip_server'] ?? ''));
        if (filter_var($host, FILTER_VALIDATE_IP)) {
            $sections[$endpoint][] = 'match_header=X-Forwarded-For: ' . inet_ntop(inet_pton($host));
            continue;
        }
        if (!filter_var($host, FILTER_VALIDATE_DOMAIN, FILTER_FLAG_HOSTNAME)) {
            error_log("Invalid SIP server hostname for trunk $endpoint");
            continue;
        }
        trunk_dns_update($dir, $host, time());
        // Native hostname matching can fail to load during a DNS outage.
        // Give the header rule its own identify object pointing to the same endpoint.
        $name = "nethvoice-xff:$id";
        while (isset($sections[$name])) {
            $name .= ':xff';
        }
        $sections[$name] = ['endpoint' => $endpoint, '#include nethvoice-trunk-dns/' . $host];
    }
}

function trunk_dns_lock(string $path, bool $wait = true)
{
    $lock = fopen($path, 're');
    if (!$lock) {
        throw new RuntimeException("Cannot open $path");
    }
    if (!flock($lock, $wait ? LOCK_EX : LOCK_EX | LOCK_NB, $busy)) {
        fclose($lock);
        if ($busy) {
            return null;
        }
        throw new RuntimeException("Cannot lock $path");
    }
    return $lock;
}

// The container resolves local host aliases before DNS. They have no TTL.
function trunk_dns_lookup(string $host): ?array
{
    $addresses = [];
    foreach (file('/etc/hosts', FILE_IGNORE_NEW_LINES) as $line) {
        $fields = preg_split('/\s+/', trim(explode('#', $line, 2)[0]));
        $ip = array_shift($fields);
        if (filter_var($ip, FILTER_VALIDATE_IP)
            && in_array(rtrim($host, '.'), array_map('strtolower', $fields), true)) {
            $addresses[] = inet_ntop(inet_pton($ip));
        }
    }
    if ($addresses) {
        return [$addresses, 60];
    }
    // Let NSS choose the search domain for unqualified names. Separate DNS
    // queries for different record types could select different search suffixes.
    if (!str_contains($host, '.')) {
        $info = @socket_addrinfo_lookup($host, null, ['ai_socktype' => SOCK_DGRAM]);
        if ($info === false) {
            return null;
        }
        foreach ($info as $entry) {
            $addr = socket_addrinfo_explain($entry)['ai_addr'];
            $ip = $addr['sin_addr'] ?? $addr['sin6_addr'] ?? '';
            if (filter_var($ip, FILTER_VALIDATE_IP)) {
                $addresses[] = inet_ntop(inet_pton($ip));
            }
        }
        return [$addresses, 60];
    }
    return trunk_dns_records(rtrim($host, '.') . '.');
}

function trunk_dns_records(string $host, ?callable $query = null): ?array
{
    $query ??= static fn($host, $type) => @dns_get_record($host, $type);
    $ttl = PHP_INT_MAX;
    // PHP filters replies by record type. Follow aliases explicitly so that
    // a short-lived CNAME can move before the terminal address records expire.
    for ($depth = 0; $depth < 16; $depth++) {
        $aliases = $query($host, DNS_CNAME);
        if ($aliases === false) {
            return null;
        }
        if (!$aliases) {
            $records = $query($host, DNS_A | DNS_AAAA);
            if ($records === false) {
                return null;
            }
            $addresses = [];
            foreach ($records as $record) {
                $ip = $record['ip'] ?? $record['ipv6'] ?? '';
                if (filter_var($ip, FILTER_VALIDATE_IP)) {
                    $addresses[] = inet_ntop(inet_pton($ip));
                    $ttl = min($ttl, $record['ttl']);
                }
            }
            return [$addresses, $addresses ? $ttl : 60];
        }
        $ttl = min($ttl, $aliases[0]['ttl']);
        $host = rtrim($aliases[0]['target'], '.') . '.';
    }
    return null;
}

// The metadata and the rule share one atomic write. A temporary lookup failure
// can extend use of the previous rule at most five minutes past its DNS expiry.
function trunk_dns_update(string $dir, string $host, int $now, ?callable $lookup = null, ?string $parent = null): void
{
    $path = "$dir/$host";
    $old = is_file($path) ? file_get_contents($path) : '';
    [$metadata, $rule] = array_pad(explode("\n", $old, 2), 2, '');
    [$next, $expires] = sscanf($metadata, '; next=%d expires=%d') ?: [0, 0];
    if ($next > $now) {
        return;
    }
    $previous = $rule;
    $answer = ($lookup ?? 'trunk_dns_lookup')($host);
    if ($answer === null) {
        error_log("Cannot resolve SIP trunk host $host, retrying in one minute");
        $next = $now + 60;
        if ($now >= $expires) {
            $rule = '';
        } else {
            $next = min($next, $expires);
        }
    } else {
        [$ips, $ttl] = $answer;
        $ips = array_unique($ips);
        sort($ips, SORT_STRING);
        $rule = '';
        if (count($ips) === 1) {
            $rule = "match_header=X-Forwarded-For: $ips[0]\n";
        } elseif ($ips) {
            // All values are numeric IPs. Only the IPv4 dots need escaping.
            $pattern = str_replace('.', '\\.', implode('|', $ips));
            $rule = "match_header=X-Forwarded-For: /^($pattern)$/\n";
        }
        // Omitting type on expiry removes this identify object from Sorcery.
        if ($rule !== '') {
            $rule = "type=identify\n" . $rule;
        }
        $next = $now + max(1, $ttl);
        $expires = $next + 300;
    }
    // Resolve outside the publication lock. If Apply refreshed the same host
    // in the meantime, its newer snapshot wins.
    $lock = trunk_dns_lock($dir);
    try {
        clearstatcache(true, $path);
        if ((is_file($path) ? file_get_contents($path) : '') !== $old) {
            return;
        }
        if ($parent !== null) {
            $applied = file($parent, FILE_IGNORE_NEW_LINES);
            if ($applied === false) {
                throw new RuntimeException("Cannot read $parent");
            }
            if (!in_array('#include nethvoice-trunk-dns/' . $host, $applied, true)) {
                return;
            }
        }
        if (($parent !== null || $old !== '') && $previous !== $rule && !touch("$dir/.reload")) {
            throw new RuntimeException('Cannot mark trunk DNS rules for reload');
        }
        $data = sprintf("; next=%d expires=%d\n", $next, $expires) . $rule;
        $tmp = tempnam($dir, '.tmp');
        try {
            if ($tmp === false || file_put_contents($tmp, $data) !== strlen($data)
                || !chmod($tmp, 0644) || !rename($tmp, $path)) {
                throw new RuntimeException("Cannot update trunk DNS rule for $host");
            }
        } finally {
            if ($tmp && is_file($tmp)) {
                unlink($tmp);
            }
        }
    } finally {
        fclose($lock);
    }
}

function trunk_dns_refresh(): void
{
    $parentFile = '/etc/asterisk/pjsip.identify.conf';
    if (!is_file($parentFile)) {
        return;
    }
    // Only one scheduled pass at a time, including its unlocked DNS queries.
    $worker = trunk_dns_lock(__FILE__, false);
    if (!$worker) {
        return;
    }
    try {
        // Apply Config owns the parent file. Read only includes in that file,
        // so retired hosts and pending edits cannot add an identity.
        $lock = trunk_dns_lock(TRUNK_DNS_DIR);
        try {
            $parent = file_get_contents($parentFile);
        } finally {
            fclose($lock);
        }
        if ($parent === false) {
            throw new RuntimeException('Cannot read PJSIP identify configuration');
        }
        preg_match_all('~^#include nethvoice-trunk-dns/([a-z0-9.-]+)$~m', $parent, $matches);
        foreach (array_unique($matches[1]) as $host) {
            if (filter_var($host, FILTER_VALIDATE_DOMAIN, FILTER_FLAG_HOSTNAME)) {
                trunk_dns_update(TRUNK_DNS_DIR, $host, time(), null, $parentFile);
            }
        }
        $lock = trunk_dns_lock(TRUNK_DNS_DIR);
        try {
            $pending = TRUNK_DNS_DIR . '/.reload';
            $applyPid = (int) @file_get_contents('/var/run/asterisk/reload.lock');
            if (is_file($pending) && !($applyPid > 0 && is_dir("/proc/$applyPid"))) {
                exec('/usr/sbin/asterisk -rx "module reload res_pjsip.so" 2>&1', $output, $status);
                if ($status !== 0 || !str_contains(implode("\n", $output), "Module 'res_pjsip.so' reloaded successfully")) {
                    throw new RuntimeException('Cannot reload PJSIP trunk rules: ' . implode(' ', $output));
                }
                unlink($pending);
            }
        } finally {
            fclose($lock);
        }
    } finally {
        fclose($worker);
    }
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    trunk_dns_refresh();
}
