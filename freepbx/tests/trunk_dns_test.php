<?php
// SPDX-License-Identifier: GPL-3.0-or-later

require_once __DIR__ . '/../var/lib/asterisk/bin/trunk_dns.php';

function check($condition, $message) {
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

putenv('PROXY_IP=192.0.2.1');
putenv('PROXY_PORT=5060');
$trunk = [
    'trunk_name' => 'provider', 'sip_server' => '192.0.2.10',
    'registration' => 'none', 'authentication' => 'off',
    'outbound_proxy' => 'sip:192.0.2.1:5060;lr',
];
$base = ['provider' => ['type' => 'identify', 'endpoint' => 'provider']];
$sections = $base;
nethvoice_add_trunk_headers($sections, [1 => ['sip_server' => '192.0.2.9'] + $trunk, 2 => $trunk]);
check($sections['provider'] === $base['provider'] + ['match_header=X-Forwarded-For: 192.0.2.10'], 'copied trunk, literal IP');
foreach (['registration' => 'send', 'authentication' => 'inbound', 'outbound_proxy' => ''] as $key => $value) {
    $sections = $base;
    nethvoice_add_trunk_headers($sections, [[$key => $value] + $trunk]);
    check($sections === $base, "ineligible $key");
}

$query = static function ($name, $type) {
    return match ([$name, $type]) {
        ['sip.example.', DNS_CNAME] => [['target' => 'edge.example', 'ttl' => 30]],
        ['edge.example.', DNS_CNAME] => [],
        ['edge.example.', DNS_A | DNS_AAAA] => [
            ['ip' => '192.0.2.10', 'ttl' => 3600],
            ['ipv6' => '2001:db8::1', 'ttl' => 600],
        ],
    };
};
check(trunk_dns_records('sip.example.', $query) === [['192.0.2.10', '2001:db8::1'], 30], 'alias TTL');
check(trunk_dns_records('sip.example.', fn($name, $type) => $type === DNS_CNAME ? [] : false) === null, 'temporary DNS failure');

$dir = sys_get_temp_dir() . '/trunk-dns-' . bin2hex(random_bytes(8));
mkdir($dir, 0700);
$host = 'sip.provider.example';
$file = "$dir/$host";
$marker = "$dir/.reload";
$parent = "$dir/pjsip.identify.conf";
file_put_contents($parent, "#include nethvoice-trunk-dns/$host\n");
$pool = ['2001:db8::1', '192.0.2.11', '192.0.2.10'];
try {
    trunk_dns_update($dir, $host, 100, fn() => [$pool, 30]);
    $first = file_get_contents($file);
    $rule = 'match_header=X-Forwarded-For: /^(192\\.0\\.2\\.10|192\\.0\\.2\\.11|2001:db8::1)$/';
    check(str_contains($first, $rule), 'exact alternatives include every address');
    trunk_dns_update($dir, $host, 129, fn() => throw new RuntimeException('queried before TTL'));
    trunk_dns_update($dir, $host, 130, fn() => [array_reverse($pool), 30], $parent);
    check(!file_exists($marker), 'DNS reordering triggered a reload');

    trunk_dns_update($dir, $host, 160, fn() => [['192.0.2.12'], 60]);
    check(file_exists($marker), 'changed include must be retried even if Apply fails later');
    unlink($marker);
    $single = "match_header=X-Forwarded-For: 192.0.2.12\n";
    check(str_ends_with(file_get_contents($file), "\n" . $single), 'rotation removes old addresses');

    trunk_dns_update($dir, $host, 220, fn() => null, $parent);
    check(str_ends_with(file_get_contents($file), $single) && !file_exists($marker), 'transient failure');
    trunk_dns_update($dir, $host, 520, fn() => null, $parent);
    check(!str_contains(file_get_contents($file), 'match_header') && file_exists($marker), 'bounded grace');
    unlink($marker);
    trunk_dns_update($dir, $host, 600, fn() => [$pool, 1], $parent);
    check(str_contains(file_get_contents($file), $rule), 'recovery');
    unlink($marker);
    trunk_dns_update($dir, $host, 601, fn() => [[], 60], $parent);
    check(!str_contains(file_get_contents($file), 'match_header') && file_exists($marker), 'DNS withdrawal');
    unlink($marker);
    trunk_dns_update($dir, $host, 800, function () use ($parent, $pool) {
        file_put_contents($parent, '');
        return [$pool, 60];
    }, $parent);
    check(!file_exists($marker) && !str_contains(file_get_contents($file), 'match_header'), 'retired during lookup');
} finally {
    foreach ([$file, $marker, $parent] as $path) {
        if (file_exists($path)) {
            unlink($path);
        }
    }
    rmdir($dir);
}
echo "Trunk DNS checks passed\n";
