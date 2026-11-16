<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Check the summary of today's calls shown by the dashboard.

function check($condition, $message) {
    if (!$condition) throw new RuntimeException($message);
}

class RouteCollector {
    public array $routes = [];
    public function get($pattern, $handler) { $this->routes[] = "GET $pattern"; }
}

$app = new RouteCollector();
require __DIR__ . '/../var/www/html/freepbx/rest/modules/dashboard.php';

check($app->routes === ['GET /dashboard/calls'], 'the module must register GET /dashboard/calls');
check(str_contains(DASHBOARD_CALLS_QUERY, "dst NOT LIKE '*%'"), 'feature codes must not be counted');
check(str_contains(DASHBOARD_CALLS_QUERY, 'GROUP BY COALESCE(NULLIF(linkedid'), 'the legs of a call must be counted once');

$call = fn($answered, $missed, $incoming, $hour) => compact('answered', 'missed', 'incoming', 'hour');

$empty = dashboardSummarizeCalls([], 3);
check($empty === ['total' => 0, 'answered' => 0, 'missed' => 0, 'invalid' => 0, 'incoming_by_hour' => [0, 0, 0]], 'no calls must give zeros up to the current hour');

$summary = dashboardSummarizeCalls([
    $call('1', '0', '1', '0'),
    $call('1', '1', '1', '2'),
    $call('0', '1', '1', '2'),
    $call('0', '1', '0', '1'),
    $call('0', '0', '0', '1'),
    $call('0', '0', '1', '9'),
], 3);
check($summary['total'] === 6, 'every call must be counted');
check($summary['answered'] === 2, 'a call answered on any leg must be answered');
check($summary['missed'] === 2, 'a call not answered nor failed must be missed');
check($summary['invalid'] === 2, 'a call neither answered nor missed must be invalid');
check($summary['incoming_by_hour'] === [1, 0, 2], 'only incoming calls up to the current hour must be distributed');

echo "dashboard calls tests passed\n";
