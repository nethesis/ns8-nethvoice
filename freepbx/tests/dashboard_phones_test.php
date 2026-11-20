<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Check the phone status shown by the dashboard.

function check($condition, $message) {
    if (!$condition) throw new RuntimeException($message);
}

class RouteCollector {
    public array $routes = [];
    public function get($pattern, $handler) { $this->routes[] = "GET $pattern"; }
}

define('ADMINPHONE_ACCOUNTCODE', 'nv-admin');

$app = new RouteCollector();
require __DIR__ . '/../var/www/html/freepbx/rest/modules/dashboard.php';

check(in_array('GET /dashboard/phones', $app->routes, true), 'the module must register GET /dashboard/phones');

check(dashboardNormalizeMac('aa:bb:cc:dd:ee:0f') === 'AABBCCDDEE0F', 'a MAC with colons must be normalized');
check(dashboardNormalizeMac('AA-BB-CC-DD-EE-0F') === 'AABBCCDDEE0F', 'a Tancredi MAC must be normalized');
check(dashboardNormalizeMac('AA-BB-CC-DD-EE') === null, 'a short MAC must be rejected');
check(dashboardNormalizeMac('GG-BB-CC-DD-EE-0F') === null, 'a MAC with non hexadecimal digits must be rejected');
check(dashboardNormalizeMac(null) === null, 'a missing MAC must be rejected');

$assignments = dashboardPhoneAssignments([
    ['mac' => 'aa:bb:cc:dd:ee:01', 'extension' => '91201'],
    ['mac' => 'AA:BB:CC:DD:EE:02', 'extension' => null],
    ['mac' => 'AA:BB:CC:DD:EE:03', 'extension' => '91203'],
    ['mac' => 'AA:BB:CC:DD:EE:03', 'extension' => ''],
    ['mac' => 'invalid', 'extension' => '91209'],
]);
check($assignments === [
    'AABBCCDDEE01' => ['91201'],
    'AABBCCDDEE02' => [],
    'AABBCCDDEE03' => ['91203'],
], 'the extensions of every line must be grouped by MAC');

$registered = dashboardRegisteredExtensions([
    '/registrar/contact/91201;@5b1e2f0c4a',
    '/registrar/contact/201;@0f0e',
    '/registrar/contactx/91299;@aa',
    '/AMPUSER/91201/cidname',
]);
check($registered === ['91201' => true, '201' => true], 'only the registrar contacts must count as registrations');

$provisioned = ['tok1' => false, 'tok2' => 'permanent'];
$pending = ['tok1' => 'first-access', 'tok2' => 'permanent'];

check(dashboardPhoneStatus([], null, $registered) === 'unassigned', 'a phone without extensions must be unassigned');
check(dashboardPhoneStatus(['91202'], $pending, $registered) === 'pending', 'a phone with the first-access token must be pending');
check(dashboardPhoneStatus(['91201'], $pending, $registered) === 'provisioned', 'a registered phone must be provisioned even with a new first-access token');
check(dashboardPhoneStatus(['91201'], null, []) === 'unknown', 'an unregistered phone without details must be unknown');
check(dashboardPhoneStatus(['91201'], $provisioned, $registered) === 'provisioned', 'a phone that downloaded its configuration and registered must be provisioned');
check(dashboardPhoneStatus(['91202'], $provisioned, $registered) === 'failed', 'a phone that downloaded its configuration but did not register must be failed');
check(dashboardPhoneStatus(['91202', '91201'], $provisioned, $registered) === 'provisioned', 'a multi-line phone with a registered line must be provisioned');
check(dashboardPhoneStatus(['91201'], null, $registered) === 'provisioned', 'a registered phone without details must be provisioned');
check(dashboardPhoneStatus(['91202'], ['tok1' => null], $registered) === 'unknown', 'a phone without the permanent token must be unknown');

$summary = dashboardSummarizePhones(
    [
        ['mac' => 'AA-BB-CC-DD-EE-01'],
        ['mac' => 'AA-BB-CC-DD-EE-02'],
        ['mac' => 'AA-BB-CC-DD-EE-03'],
        ['mac' => 'AA-BB-CC-DD-EE-04'],
        ['mac' => 'AA-BB-CC-DD-EE-05'],
        ['mac' => 'AA-BB-CC-DD-EE-06'],
        ['model' => 'yealink-T46'],
    ],
    $assignments + [
        'AABBCCDDEE04' => ['91204'],
        'AABBCCDDEE05' => ['91205'],
    ],
    [
        'AABBCCDDEE01' => $provisioned,
        'AABBCCDDEE03' => $provisioned,
        'AABBCCDDEE04' => $pending,
        'AABBCCDDEE05' => null,
    ],
    $registered
);
check($summary === [
    'provisioned' => 1,
    'pending' => 1,
    'unassigned' => 2,
    'failed' => 1,
    'unknown' => 2,
    'total' => 7,
], 'every phone of the inventory must be counted once');

check(dashboardSummarizePhones([], [], [], [])['total'] === 0, 'an empty inventory must have no phones');

$cacheDirectory = sys_get_temp_dir() . '/dashboard-phones-test-' . getmypid();
mkdir($cacheDirectory);
$cacheFile = "$cacheDirectory/phones.json";
$loads = 0;
$load = function () use (&$loads) {
    $loads++;
    return ['provisioned' => $loads, 'pending' => 0, 'unassigned' => 0, 'failed' => 0, 'unknown' => 0, 'total' => $loads];
};
check(dashboardCachedPhoneSummary($load, $cacheFile, 30, 1000)['provisioned'] === 1, 'the first request must load the summary');
check(dashboardCachedPhoneSummary($load, $cacheFile, 30, 1029)['provisioned'] === 1, 'a recent summary must come from the cache');
check(dashboardCachedPhoneSummary($load, $cacheFile, 30, 1030)['provisioned'] === 2, 'an expired summary must be loaded again');
check(dashboardCachedPhoneSummary($load, $cacheFile, 30, 900)['provisioned'] === 3, 'a summary from the future must be loaded again');
file_put_contents($cacheFile, 'not json');
check(dashboardCachedPhoneSummary($load, $cacheFile, 30, 1000)['provisioned'] === 4, 'a broken cache must be ignored');
file_put_contents($cacheFile, json_encode(['time' => 1000, 'summary' => ['provisioned' => 9, 'pending' => 0, 'unassigned' => 0, 'failed' => 0, 'unknown' => 0]]));
check(dashboardCachedPhoneSummary($load, $cacheFile, 30, 1000)['total'] === 5, 'a cached summary without the total must be loaded again');
$failing = function () { throw new RuntimeException('Tancredi is down'); };
unlink($cacheFile);
$failed = false;
try {
    dashboardCachedPhoneSummary($failing, $cacheFile, 30, 1000);
} catch (RuntimeException $e) {
    $failed = true;
}
check($failed && !file_exists($cacheFile), 'a failure must be reported and not cached');
$partial = function () {
    return ['provisioned' => 1, 'pending' => 0, 'unassigned' => 0, 'failed' => 0, 'unknown' => 2, 'total' => 3];
};
check(dashboardCachedPhoneSummary($partial, $cacheFile, 30, 1000)['unknown'] === 2, 'a partial summary must be returned');
check(!file_exists($cacheFile), 'a summary with unknown phones must not be cached');
array_map('unlink', glob("$cacheDirectory/*"));
rmdir($cacheDirectory);

echo "dashboard phones tests passed\n";
