<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Check the system information shown by the dashboard.

function check($condition, $message) {
    if (!$condition) throw new RuntimeException($message);
}

function throws(callable $callback) {
    try {
        $callback();
    } catch (Exception $e) {
        return true;
    }
    return false;
}

class RouteCollector {
    public array $routes = [];
    public function get($pattern, $handler) { $this->routes[] = "GET $pattern"; }
}

define('ADMINPHONE_ACCOUNTCODE', 'nv-admin');

$app = new RouteCollector();
require __DIR__ . '/../var/www/html/freepbx/rest/modules/dashboard.php';

check(in_array('GET /dashboard/system', $app->routes, true), 'the module must register GET /dashboard/system');

check(dashboardParseRelease('ghcr.io/nethesis/nethvoice:1.9.0') === '1.9.0', 'the release must be the image tag');
check(dashboardParseRelease('ghcr.io/nethesis/nethvoice:pr-1201.1765-1.0d0aa64') === 'pr-1201.1765-1.0d0aa64', 'a development tag must be returned as is');
check(dashboardParseRelease('registry.example.org:5000/nethvoice:2.0.0') === '2.0.0', 'the registry port must not be taken as the tag');
check(dashboardParseRelease('ghcr.io/nethesis/nethvoice:1.9.0@sha256:abc') === '1.9.0', 'the digest must not be part of the tag');
check(dashboardParseRelease('registry.example.org:5000/nethvoice') === null, 'an image without tag must have no release');
check(dashboardParseRelease('ghcr.io/nethesis/nethvoice:') === null, 'an empty tag must have no release');
check(dashboardParseRelease('') === null, 'a missing image must have no release');
check(dashboardParseRelease(null) === null, 'an unset image must have no release');

check(dashboardParseUptime("1231932.53 4567890.12\n") === 1231932, 'the uptime must be the whole seconds since boot');
check(throws(fn() => dashboardParseUptime('')), 'an empty uptime must be rejected');

check(dashboardParseLoadAverage("0.42 0.38 0.30 1/523 12345\n") === 0.42, 'the load average must be the one of the last minute');
check(throws(fn() => dashboardParseLoadAverage('n/a')), 'an invalid load average must be rejected');

$meminfo = "MemTotal:       16000000 kB\nMemFree:         2000000 kB\nMemAvailable:    9920000 kB\nBuffers:          100000 kB\n";
check(dashboardParseMemoryUsedPercent($meminfo) === 38.0, 'the used memory must exclude the available memory');
check(dashboardParseMemoryUsedPercent("MemTotal: 1000 kB\nMemAvailable: 1200 kB\n") === 0.0, 'the used memory must not be negative');
check(throws(fn() => dashboardParseMemoryUsedPercent("MemTotal: 1000 kB\nMemFree: 200 kB\n")), 'a kernel without MemAvailable must be rejected');
check(throws(fn() => dashboardParseMemoryUsedPercent("MemTotal: 0 kB\nMemAvailable: 0 kB\n")), 'a zero total memory must be rejected');

$proc = sys_get_temp_dir() . '/dashboard_system_test_' . getmypid();
mkdir($proc);
file_put_contents("$proc/uptime", "1231932.53 4567890.12\n");
file_put_contents("$proc/loadavg", "0.42 0.38 0.30 1/523 12345\n");
file_put_contents("$proc/meminfo", $meminfo);
try {
    $info = dashboardSystemInfo('ghcr.io/nethesis/nethvoice:1.9.0', $proc);
    check($info === [
        'release' => '1.9.0',
        'uptime_seconds' => 1231932,
        'load_average' => 0.42,
        'memory_used_percent' => 38.0,
    ], 'the system information must combine the release and the host figures');
    check(json_encode($info) === '{"release":"1.9.0","uptime_seconds":1231932,"load_average":0.42,"memory_used_percent":38}', 'the response must keep numbers as JSON numbers');

    unlink("$proc/loadavg");
    check(throws(fn() => dashboardSystemInfo(null, $proc)), 'a missing proc file must be reported');
} finally {
    array_map('unlink', glob("$proc/*"));
    rmdir($proc);
}

check(is_array(dashboardSystemInfo(null)), 'the host proc files must be readable');

echo "dashboard system tests passed\n";
