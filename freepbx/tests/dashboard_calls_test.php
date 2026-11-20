<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Check the summary of today's calls and the calls per hour from the CDR shown by the dashboard.

namespace Psr\Http\Message {
    interface ServerRequestInterface {}
    interface ResponseInterface {}
}

namespace {
    use Psr\Http\Message\ResponseInterface;
    use Psr\Http\Message\ServerRequestInterface;

    function check($condition, $message) {
        if (!$condition) throw new RuntimeException($message);
    }

    class RouteCollector {
        public array $routes = [];
        public array $handlers = [];
        public function get($pattern, $handler) {
            $this->routes[] = "GET $pattern";
            $this->handlers["GET $pattern"] = $handler;
        }
    }

    class FakeRequest implements ServerRequestInterface {
        public function __construct(private array $query) {}
        public function getQueryParams() { return $this->query; }
    }

    class FakeResponse implements ResponseInterface {
        public int $status = 200;
        public $body = null;
    }

    function jsonResponse($response, $body, $status) {
        $response->status = $status;
        $response->body = $body;
        return $response;
    }

    class FakeStatement {
        public function __construct(private string $sql, private array $rows, private $column = null) {}
        public function execute($parameters = []) { FakeDatabase::$executed[] = [$this->sql, $parameters]; return true; }
        public function fetchAll($mode = null) {
            check($mode === (str_contains($this->sql, 'DATE_FORMAT') ? PDO::FETCH_KEY_PAIR : PDO::FETCH_ASSOC), 'unexpected fetch mode');
            return $this->rows;
        }
        public function fetchColumn() { return $this->column; }
    }

    class FakeDatabase {
        public static array $perHour = [];
        public static $oldest = null;
        public static array $executed = [];
        public function prepare($sql) {
            return new FakeStatement($sql, $sql === DASHBOARD_CALLS_PER_HOUR_QUERY ? self::$perHour : []);
        }
        public function query($sql) {
            check($sql === DASHBOARD_CALLS_OLDEST_QUERY, 'unexpected query');
            return new FakeStatement($sql, [], self::$oldest);
        }
    }

    class FreePBX {
        public static function Database() { return new FakeDatabase(); }
    }

    $temporary = rtrim(getenv('TMPDIR') ?: '/tmp', '/') . '/dashboard_calls_test_' . getmypid();
    mkdir($temporary, 0700);
    putenv("TMPDIR=$temporary");

    define('ADMINPHONE_ACCOUNTCODE', 'nv-admin');

    $app = new RouteCollector();
    require __DIR__ . '/../var/www/html/freepbx/rest/modules/dashboard.php';

    check(in_array('GET /dashboard/calls', $app->routes, true), 'the module must register GET /dashboard/calls');
    check(str_contains(DASHBOARD_CALLS_QUERY, "dst NOT LIKE '*%'"), 'feature codes must not be counted');
    check(str_contains(DASHBOARD_CALLS_QUERY, 'GROUP BY COALESCE(NULLIF(linkedid'), 'the legs of a call must be counted once');
    check(str_contains(DASHBOARD_CALLS_QUERY, 'HAVING MAX(accountcode = ? OR peeraccount = ?) = 0'), 'the calls of the administrator phone must not be counted');
    check(str_contains(DASHBOARD_CALLS_PER_HOUR_QUERY, "SELECT COALESCE(NULLIF(linkedid, ''), uniqueid) AS id, MIN(calldate) AS started"), 'a call must start with its first leg');
    check(substr_count(DASHBOARD_CALLS_PER_HOUR_QUERY, "dst NOT LIKE '*%'") === 3, 'the legs of feature codes must not start, delay or exclude a call');
    check(substr_count(DASHBOARD_CALLS_PER_HOUR_QUERY, 'accountcode = ? OR') === 3, 'a leg of the administrator phone anywhere in the CDR must exclude its call');
    check(str_contains(DASHBOARD_CALLS_PER_HOUR_QUERY, "WHERE leg.linkedid = calls.id AND leg.linkedid <> ''") && str_contains(DASHBOARD_CALLS_PER_HOUR_QUERY, "WHERE leg.uniqueid = calls.id AND leg.linkedid = ''"), 'the legs outside the read period must be found with and without linkedid');
    check(str_contains(DASHBOARD_CALLS_PER_HOUR_QUERY, "DATE_FORMAT(started, '%Y-%m-%d %H') AS local_hour"), 'a call must belong to the hour of its first leg');
    check(str_ends_with(DASHBOARD_CALLS_PER_HOUR_QUERY, 'GROUP BY local_hour') && !preg_match('/\bAS local_hour\b/', DASHBOARD_CALLS_QUERY), 'the calls must be grouped by the local hour, not by a column of the summary query');
    check(substr_count(DASHBOARD_CALLS_PER_HOUR_QUERY, '?') === 16, 'the calls per hour query must have the read period and the administrator phone parameters');

    $call = fn($answered, $missed, $hour) => compact('answered', 'missed', 'hour');

    $empty = dashboardSummarizeCalls([], 3);
    check($empty === ['total' => 0, 'answered' => 0, 'missed' => 0, 'invalid' => 0, 'calls_by_hour' => [0, 0, 0]], 'no calls must give zeros up to the current hour');

    $summary = dashboardSummarizeCalls([
        $call('1', '0', '0'),
        $call('1', '1', '2'),
        $call('0', '1', '2'),
        $call('0', '1', '1'),
        $call('0', '0', '1'),
        $call('0', '0', '9'),
    ], 3);
    check($summary['total'] === 6, 'every call must be counted');
    check($summary['answered'] === 2, 'a call answered on any leg must be answered');
    check($summary['missed'] === 2, 'a call not answered nor failed must be missed');
    check($summary['invalid'] === 2, 'a call neither answered nor missed must be invalid');
    check($summary['calls_by_hour'] === [1, 2, 2], 'every call up to the current hour must be distributed');

    check(dashboardCallsRange([]) === null, 'without range the history must not be computed');
    foreach (['24h', '7d', '15d'] as $range) {
        check(dashboardCallsRange(['range' => $range]) === $range, "$range must be a valid range");
    }
    foreach (['', '1h', '30d', '24H', ['24h']] as $invalid) {
        $rejected = false;
        try {
            dashboardCallsRange(['range' => $invalid]);
        } catch (InvalidArgumentException $e) {
            $rejected = true;
        }
        check($rejected, 'an unknown range must be rejected: ' . json_encode($invalid));
    }
    check(DASHBOARD_CALLS_RANGES === ['24h' => 24, '7d' => 168, '15d' => 360], 'the ranges must have one point per hour');

    $hour = 1699999200;
    check(dashboardFirstBucket($hour + 200, 0, 24) === $hour - 23 * 3600, 'the last point must be the current hour');
    check(dashboardFirstBucket($hour, 0, 1) === $hour, 'a time on the hour must start its own hour');
    check(dashboardFirstBucket($hour + 2000, 1800, 1) === $hour + 1800, 'hours must start on the hour of the PBX time zone');
    check(dashboardFirstBucket($hour + 1000, -12600, 1) === $hour - 1800, 'negative half hour offsets must start on the local hour');

    $utc = new DateTimeZone('UTC');
    $rome = new DateTimeZone('Europe/Rome');
    $kolkata = new DateTimeZone('Asia/Kolkata');
    $at = fn($local, $zone) => (new DateTimeImmutable($local, $zone))->getTimestamp();

    $recorder = function (array $rows) {
        $query = new class($rows) {
            public array $asked = [];
            public function __construct(private array $rows) {}
            public function __invoke($since, $until) {
                $this->asked[] = [$since, $until];
                return $this->rows;
            }
        };
        return [$query, $query];
    };

    $first = $at('2026-11-18 08:00', $rome);
    [$query, $recorded] = $recorder([
        '2026-11-18 07' => '9',
        '2026-11-18 08' => '2',
        '2026-11-18 10' => 5,
        '2026-11-18 11' => '1',
        '2026-11-18 13' => '4',
    ]);
    $buckets = dashboardCountCallsPerHour($query, $first, $first, $first + 3 * 3600, $rome);
    check($recorded->asked === [['2026-11-18 08:00:00', '2026-11-18 13:00:00']], 'the CDR must be read from the first counted hour, in the PBX local time');
    check($buckets === [$first => 2, $first + 3600 => 0, $first + 7200 => 5, $first + 10800 => 1], 'every hour must have its calls, hours without calls must be 0, other hours must be ignored');
    [$query, $recorded] = $recorder(['2026-11-18 08' => '2', '2026-11-18 10' => '5']);
    $buckets = dashboardCountCallsPerHour($query, $first, $first + 7200, $first + 3 * 3600, $rome);
    check($recorded->asked === [['2026-11-18 10:00:00', '2026-11-18 13:00:00']], 'an incremental count must start from its first hour');
    check($buckets === [$first + 7200 => 5, $first + 10800 => 0], 'an incremental count must not return the hours before its start');

    $first = $at('2026-11-18 08:00', $kolkata);
    check($first % 3600 === 1800, 'an hour of a half hour time zone must start at half past in UTC');
    check(dashboardFirstBucket($first + 3 * 3600 + 120, $kolkata->getOffset(new DateTimeImmutable()), 4) === $first, 'the first hour must follow the PBX time zone');
    [$query, $recorded] = $recorder(['2026-11-18 09' => '3']);
    $buckets = dashboardCountCallsPerHour($query, $first, $first, $first + 3600, $kolkata);
    check($recorded->asked[0][0] === '2026-11-18 08:00:00' && $buckets === [$first => 0, $first + 3600 => 3], 'the local hours of a half hour time zone must be counted');

    $first = $at('2026-03-29 00:00', $rome);
    [$query, $recorded] = $recorder(['2026-03-29 01' => '1', '2026-03-29 02' => '7', '2026-03-29 03' => '2']);
    $buckets = dashboardCountCallsPerHour($query, $first, $first, $first + 3 * 3600, $rome);
    check(array_keys($buckets) === [$first, $first + 3600, $first + 7200, $first + 10800], 'the spring forward day must have one point per real hour');
    check($buckets === [$first => 0, $first + 3600 => 1, $first + 7200 => 2, $first + 10800 => 0], 'the hour skipped by the spring forward must not exist');
    check(dashboardLocalTime($first + 7200, $rome, 'H') === '03', 'the hour after 01 must be 03 on the spring forward day');

    $first = $at('2026-10-25 01:00', $rome);
    [$query, $recorded] = $recorder(['2026-10-25 01' => '1', '2026-10-25 02' => '6', '2026-10-25 03' => '2']);
    $buckets = dashboardCountCallsPerHour($query, $first, $first, $first + 3 * 3600, $rome);
    check(array_keys($buckets) === [$first, $first + 3600, $first + 7200, $first + 10800], 'the fall back day must have one point per real hour');
    check($buckets === [$first => 1, $first + 3600 => 6, $first + 7200 => 0, $first + 10800 => 2], 'the repeated hour of the fall back must be counted once, in its first occurrence');
    [$query, $recorded] = $recorder(['2026-10-25 02' => '6', '2026-10-25 03' => '2']);
    $buckets = dashboardCountCallsPerHour($query, $first, $first + 7200, $first + 3 * 3600, $rome);
    check($buckets === [$first + 7200 => 0, $first + 10800 => 2], 'an incremental count from the repeated hour must not count it again');
    check(DASHBOARD_CALLS_MARGIN === 6 * 3600, 'a refresh must read again the last six hours');
    check(dashboardRefreshStart(['current' => $first + 10800 + 21600], $first - 86400, $rome) === $first + 10800, 'a refresh must start six hours before the hour of the cache');
    check(dashboardRefreshStart(['current' => $first + 7200 + 21600], $first - 86400, $rome) === $first + 3600, 'a refresh starting in the repeated hour must read again its first occurrence');
    check(dashboardRefreshStart(['current' => $first + 7200 + 21600], $first + 7200, $rome) === $first + 7200, 'a refresh must not start before the range');
    check(dashboardRefreshStart(['current' => $first + 3600], $first, $rome) === $first, 'a refresh of a cache younger than six hours must start at the first hour');

    $cdr = function (array $legs) {
        return function ($since, $until) use ($legs) {
            $calls = [];
            foreach ($legs as [$calldate, $id, $dst, $account, $peer]) {
                if (str_starts_with($dst, '*')) {
                    continue;
                }
                $inside = strcmp($calldate, $since) >= 0 && strcmp($calldate, $until) < 0;
                $call = $calls[$id] ?? [null, false];
                $calls[$id] = [
                    $inside ? min($call[0] ?? $calldate, $calldate) : $call[0],
                    $call[1] || strcmp($calldate, $since) < 0 || $account === 'nv-admin' || $peer === 'nv-admin',
                ];
            }
            $hours = [];
            foreach ($calls as [$started, $excluded]) {
                if ($started !== null && !$excluded) {
                    $hours[substr($started, 0, 13)] = ($hours[substr($started, 0, 13)] ?? 0) + 1;
                }
            }
            return array_map('strval', $hours);
        };
    };
    $reference = function (array $legs, int $first, int $current, DateTimeZone $zone) {
        $calls = [];
        foreach ($legs as [$calldate, $id, $dst, $account, $peer]) {
            if (!str_starts_with($dst, '*')) {
                $call = $calls[$id] ?? [$calldate, false];
                $calls[$id] = [min($call[0], $calldate), $call[1] || $account === 'nv-admin' || $peer === 'nv-admin'];
            }
        }
        $owner = [];
        for ($time = $current; $time >= $first; $time -= 3600) {
            $owner[dashboardLocalTime($time, $zone, 'Y-m-d H')] = $time;
        }
        $buckets = array_fill_keys(range($first, $current, 3600), 0);
        foreach ($calls as [$started, $admin]) {
            $time = $owner[substr($started, 0, 13)] ?? null;
            if (!$admin && $time !== null) {
                $buckets[$time]++;
            }
        }
        return $buckets;
    };
    $counting = function (callable $query) {
        return new class($query) {
            public int $count = 0;
            public function __construct(private $query) {}
            public function __invoke($since, $until) {
                $this->count++;
                return ($this->query)($since, $until);
            }
        };
    };

    $first = $at('2026-11-11 13:00', $rome);
    $windows = dashboardCallsWindows($first, $first + 167 * 3600, $rome);
    check(count($windows) === 8, 'a week must be read in one query per day');
    check($windows[0] === ['2026-11-11 13:00:00', '2026-11-12 00:00:00'], 'the first day must start at the first counted hour');
    check($windows[1] === ['2026-11-12 00:00:00', '2026-11-13 00:00:00'], 'a day must read its local day');
    check($windows[7] === ['2026-11-18 00:00:00', '2026-11-18 14:00:00'], 'the last day must read up to the end of the single query');
    check(array_column(array_slice($windows, 1), 0) === array_column(array_slice($windows, 0, -1), 1), 'the days must follow each other without overlap');
    check(dashboardCallsWindows($first, $first + 23 * 3600, $rome) === [['2026-11-11 13:00:00', '2026-11-12 14:00:00']], 'one day must be read with one query');
    check(count(dashboardCallsWindows($first + 3600, $first + 2 * 3600, $rome)) === 1, 'an incremental count must be read with one query');
    $windows = dashboardCallsWindows($at('2026-11-17 00:00', $rome), $at('2026-11-18 00:00', $rome), $rome);
    check($windows === [['2026-11-17 00:00:00', '2026-11-18 00:00:00'], ['2026-11-18 00:00:00', '2026-11-18 02:00:00']], 'a current hour at midnight must be its own day');

    $legs = [
        ['2026-10-20 23:50:00', 'midnight', '201', '', ''],
        ['2026-10-21 00:10:00', 'midnight', '202', '', ''],
        ['2026-10-21 23:30:00', 'midnight-admin', '201', '', ''],
        ['2026-10-22 00:20:00', 'midnight-admin', '202', '', 'nv-admin'],
        ['2026-10-22 23:59:59', 'last-second', '201', '', ''],
        ['2026-10-23 00:00:00', 'last-second', '202', '', ''],
        ['2026-10-23 00:00:00', 'first-second', '201', '', ''],
        ['2026-10-23 23:10:00', 'hour-long', '201', '', ''],
        ['2026-10-24 00:10:00', 'hour-long', '202', '', ''],
        ['2026-10-23 23:40:00', 'feature', '*72', '', ''],
        ['2026-10-24 00:05:00', 'feature', '203', '', ''],
        ['2026-10-25 02:50:00', 'fall-back', '201', '', ''],
        ['2026-10-25 02:10:00', 'fall-back', '202', '', ''],
        ['2026-10-25 02:30:00', 'repeated', '201', '', ''],
    ];
    mt_srand(7);
    foreach ([[$at('2026-10-12 00:00', $rome), 'autumn'], [$at('2026-03-20 00:00', $rome), 'spring']] as [$start, $name]) {
        for ($index = 0; $index < 4000; $index++) {
            $time = $start + mt_rand(0, 20 * 86400);
            $id = "$name-$index";
            $legs[] = [dashboardLocalTime($time, $rome, 'Y-m-d H:i:s'), $id, mt_rand(0, 30) ? '201' : '*8', mt_rand(0, 40) ? '' : 'nv-admin', ''];
            for ($leg = mt_rand(0, 3); $leg > 0; $leg--) {
                $legs[] = [dashboardLocalTime($time + mt_rand(0, 3600), $rome, 'Y-m-d H:i:s'), $id, '202', '', mt_rand(0, 40) ? '' : 'nv-admin'];
            }
        }
    }
    shuffle($legs);
    $query = $cdr($legs);
    foreach ([
        ['2026-10-23 10:40', 360, 'a call crossing midnight'],
        ['2026-10-27 18:10', 360, 'the fall back day'],
        ['2026-10-25 03:20', 168, 'a week ending on the fall back day'],
        ['2026-10-25 02:20', 168, 'a week ending in the first repeated hour'],
        ['2026-10-29 00:05', 168, 'a week ending at midnight'],
        ['2026-04-02 09:30', 360, 'the spring forward day'],
        ['2026-03-29 03:10', 168, 'a week ending on the spring forward day'],
    ] as [$local, $hours, $message]) {
        $now = $at($local, $rome);
        $first = dashboardFirstBucket($now, $rome->getOffset(new DateTimeImmutable("@$now")), $hours);
        $current = $first + ($hours - 1) * 3600;
        $chunked = $counting($query);
        $buckets = dashboardCountCallsPerHour($chunked, $first, $first, $current, $rome);
        check($chunked->count >= 7, "the period must be read in days: $message");
        check($buckets === $reference($legs, $first, $current, $rome), "the days must count as the whole CDR: $message");
    }
    $first = $at('2026-10-20 00:00', $rome);
    $named = array_filter($legs, fn($leg) => !preg_match('/^(autumn|spring)-/', $leg[1]));
    $buckets = dashboardCountCallsPerHour($cdr($named), $first, $first, $first + 167 * 3600, $rome);
    check($buckets[$at('2026-10-20 23:00', $rome)] === 1 && $buckets[$at('2026-10-21 00:00', $rome)] === 0, 'a call crossing midnight must be counted once, in the hour of its first leg');
    check($buckets[$at('2026-10-21 23:00', $rome)] === 0 && $buckets[$at('2026-10-22 00:00', $rome)] === 0, 'a call of the administrator phone crossing midnight must not be counted');
    check($buckets[$at('2026-10-22 23:00', $rome)] === 1 && $buckets[$at('2026-10-23 00:00', $rome)] === 1, 'calls on both sides of midnight must be counted in their own day');
    check($buckets[$at('2026-10-23 23:00', $rome)] === 1, 'a call lasting one hour across midnight must be counted once');
    check($buckets[$at('2026-10-24 00:00', $rome)] === 1, 'a call must start with its first leg that is not a feature code');
    $fallBack = $at('2026-10-25 01:00', $rome) + 3600;
    check($buckets[$fallBack] === 2 && $buckets[$fallBack + 3600] === 0, 'the calls of the repeated hour must be counted in its first occurrence');
    check(array_sum($buckets) === 7, 'every call must be counted once');

    $distant = [
        ['2026-10-20 22:50:00', 'ninety-minutes', '201', '', ''],
        ['2026-10-21 00:20:00', 'ninety-minutes', '202', '', ''],
        ['2026-10-21 08:30:00', 'refresh-border', '201', '', ''],
        ['2026-10-21 10:10:00', 'refresh-border', '202', '', ''],
        ['2026-10-21 23:30:00', 'thirty-hours', '201', '', ''],
        ['2026-10-23 05:30:00', 'thirty-hours', '202', '', ''],
        ['2026-10-22 22:00:00', 'late-admin', '201', '', ''],
        ['2026-10-23 18:00:00', 'late-admin', '202', '', 'nv-admin'],
        ['2026-10-22 03:00:00', 'early-feature', '*72', '', ''],
        ['2026-10-23 04:00:00', 'early-feature', '203', '', ''],
        ['2026-10-22 03:30:00', 'feature-admin', '*72', 'nv-admin', ''],
        ['2026-10-23 05:00:00', 'feature-admin', '203', '', ''],
    ];
    $first = $at('2026-10-20 00:00', $rome);
    $buckets = dashboardCountCallsPerHour($cdr($distant), $first, $first, $first + 167 * 3600, $rome);
    check(array_filter($buckets) === [
        $at('2026-10-20 22:00', $rome) => 1,
        $at('2026-10-21 08:00', $rome) => 1,
        $at('2026-10-21 23:00', $rome) => 1,
        $at('2026-10-23 04:00', $rome) => 1,
        $at('2026-10-23 05:00', $rome) => 1,
    ], 'a call with legs hours or days apart must be counted once, in the hour of its first leg, and not when a later leg is of the administrator phone');
    foreach ([
        ['2026-10-21 10:20', '2026-10-21 11:30', '2026-10-21 12:05'],
        ['2026-10-23 05:40', '2026-10-23 08:00', '2026-10-23 20:10'],
    ] as $moments) {
        $cacheFile = "$temporary/distant.json";
        foreach ($moments as $local) {
            $result = dashboardCallsHistory('24h', $at($local, $rome), $rome, $cdr($distant), fn() => '2026-01-01 00:00:00', $cacheFile);
            check(array_column($result['series'], 'calls') === array_values($reference($distant, $result['series'][0]['time'], end($result['series'])['time'], $rome)), "a refresh must not count again a call whose first leg is before the refresh: $local");
        }
        unlink($cacheFile);
    }

    mt_srand(11);
    $spread = [];
    $times = [];
    $start = $at('2026-10-10 00:00', $rome);
    for ($index = 0; $index < 1500; $index++) {
        $time = $start + mt_rand(0, 24 * 86400);
        $id = "spread-$index";
        $spread[] = [dashboardLocalTime($time, $rome, 'Y-m-d H:i:s'), $id, mt_rand(0, 15) ? '201' : '*8', '', ''];
        $times[] = $time;
        for ($leg = mt_rand(1, 3); $leg > 0; $leg--) {
            $later = $time + mt_rand(3600, 30 * 3600);
            $spread[] = [dashboardLocalTime($later, $rome, 'Y-m-d H:i:s'), $id, mt_rand(0, 15) ? '202' : '*9', '', mt_rand(0, 30) ? '' : 'nv-admin'];
            $times[] = $later;
        }
    }
    foreach ([['2026-10-27 18:10', '15d'], ['2026-11-02 00:05', '15d'], ['2026-10-25 02:20', '7d'], ['2026-10-26 09:40', '24h']] as [$local, $range]) {
        $now = $at($local, $rome);
        $first = dashboardFirstBucket($now, $rome->getOffset(new DateTimeImmutable("@$now")), DASHBOARD_CALLS_RANGES[$range]);
        $current = $first + (DASHBOARD_CALLS_RANGES[$range] - 1) * 3600;
        $buckets = dashboardCountCallsPerHour($cdr($spread), $first, $first, $current, $rome);
        check($buckets === $reference($spread, $first, $current, $rome), "calls with legs 1 to 30 hours apart must be counted as in the whole CDR: $range at $local");
    }

    $simulate = function (array $all, array $visible, string $range, int $from, int $to) use ($cdr, $reference, $rome, $temporary) {
        $cacheFile = "$temporary/simulated-$range.json";
        $steps = 0;
        $mismatches = 0;
        for ($now = $from; $now <= $to; $now += DASHBOARD_CALLS_HISTORY_TTL) {
            $legs = array_values(array_filter($all, fn($index) => $visible[$index] <= $now, ARRAY_FILTER_USE_KEY));
            $result = dashboardCallsHistory($range, $now, $rome, $cdr($legs), fn() => '2026-01-01 00:00:00', $cacheFile);
            $expected = $reference($legs, $result['series'][0]['time'], end($result['series'])['time'], $rome);
            $mismatches += array_column($result['series'], 'calls') === array_values($expected) ? 0 : 1;
            $steps++;
        }
        unlink($cacheFile);
        return [$steps, $mismatches];
    };
    $from = $at('2026-10-24 00:02', $rome);
    $to = $from + 2 * 86400;
    $always = array_fill(0, count($spread), 0);
    $hangup = array_map(fn($time) => $time + mt_rand(0, DASHBOARD_CALLS_MARGIN - 1), $times);
    $withoutAdmin = array_map(fn($leg) => [$leg[0], $leg[1], $leg[2], '', ''], $spread);
    foreach (['24h', '15d'] as $range) {
        check($simulate($spread, $always, $range, $from, $to) === [577, 0], "a refresh every 5 minutes for two days must count as the whole CDR: $range");
        check($simulate($withoutAdmin, $hangup, $range, $from, $to) === [577, 0], "a refresh every 5 minutes must count the legs written at hangup up to six hours late: $range");
    }

    check(dashboardUnixTime(null, $rome) === null, 'an empty CDR has no start');
    check(dashboardUnixTime('2026-11-18 08:30:00', $rome) === $at('2026-11-18 08:30', $rome), 'the oldest call must be read in the PBX time zone');
    check(dashboardUnixTime('1000-01-01 00:00:00', $rome) === 0, 'a call without date must not give a negative start');
    check(dashboardUnixTime('not a date', $rome) === null, 'an invalid date must be no start');

    $first = $at('2026-11-18 08:00', $utc);
    $buckets = [$first => 3, $first + 3600 => 0, $first + 7200 => 4, $first + 10800 => 1];
    $series = dashboardCallsSeries($buckets, $first, 4, null);
    check(array_column($series, 'time') === [$first, $first + 3600, $first + 7200, $first + 10800], 'each point must be the start of its hour, oldest first');
    check(array_column($series, 'calls') === [3, 0, 4, 1], 'without a start every hour must have its calls');
    check(array_column(dashboardCallsSeries($buckets, $first, 4, $first + 3600 + 1200), 'calls') === [null, 0, 4, 1], 'hours ended before the oldest call must be null, the hour of the oldest call must be counted');
    check(array_column(dashboardCallsSeries($buckets, $first, 4, $first + 3600), 'calls') === [null, 0, 4, 1], 'an hour ending at the oldest call must be null');
    check(array_column(dashboardCallsSeries([], $first, 2, null), 'calls') === [0, 0], 'an empty CDR must give zeros');

    $cacheFile = "$temporary/calls-cache.json";
    $oldest = '2026-11-01 09:12:00';
    $rows = [];
    $asked = [];
    $oldestReads = 0;
    $query = function ($since, $until) use (&$asked, &$rows) {
        $asked[] = $since;
        return $rows;
    };
    $oldestCall = function () use (&$oldestReads, &$oldest) {
        $oldestReads++;
        return $oldest;
    };
    $history = fn($now, $zone = null, $range = '24h') => dashboardCallsHistory($range, $now, $zone ?? $rome, $query, $oldestCall, $cacheFile);

    $now = $at('2026-11-18 10:20', $rome);
    $first = $at('2026-11-17 11:00', $rome);
    $rows = ['2026-11-17 11' => '2', '2026-11-18 02' => '5', '2026-11-18 09' => '3', '2026-11-18 10' => '1'];
    $result = $history($now);
    check($asked === ['2026-11-17 11:00:00'], 'the first request of a range must read the whole period');
    check($oldestReads === 1, 'the oldest call must be read with the CDR');
    check(array_keys($result) === ['source', 'history_start', 'series'], 'the history must have its source, start and series');
    check($result['source'] === 'cdr', 'the source must be the CDR');
    check($result['history_start'] === $at($oldest, $rome), 'the history must start at the oldest call');
    check(count($result['series']) === 24 && $result['series'][0]['time'] === $first && $result['series'][23]['time'] === $at('2026-11-18 10:00', $rome), 'the 24 hours range must end with the current hour');
    check($result['series'][0]['calls'] === 2 && $result['series'][15]['calls'] === 5 && $result['series'][22]['calls'] === 3 && $result['series'][23]['calls'] === 1, 'the hours must have their calls');
    check(array_sum(array_column($result['series'], 'calls')) === 11, 'hours without calls must be 0');
    check(array_filter(array_column($result['series'], 'calls'), 'is_int') === array_column($result['series'], 'calls'), 'calls must be integers');
    check(is_file($cacheFile), 'the history must be cached');

    $rows = ['2026-11-18 10' => '9'];
    $cached = $history($now + 299);
    check($asked === ['2026-11-17 11:00:00'] && $oldestReads === 1 && $cached === $result, 'the history must be cached for 5 minutes');

    $rows = ['2026-11-18 02' => '50', '2026-11-18 05' => '6', '2026-11-18 09' => '4', '2026-11-18 10' => '2'];
    $refreshed = $history($now + 300);
    check(array_slice($asked, 1) === ['2026-11-18 04:00:00'], 'a refresh in the same hour must read the last six completed hours and the current one');
    check($oldestReads === 2, 'a refresh must read the oldest call again');
    check($refreshed['series'][15]['calls'] === 5, 'a refresh must keep the cached hours before the last six');
    check($refreshed['series'][18]['calls'] === 6 && $refreshed['series'][21]['calls'] === 0, 'a refresh must count again the last six completed hours');
    check($refreshed['series'][22]['calls'] === 4 && $refreshed['series'][23]['calls'] === 2, 'a refresh must replace the last completed hour and the current one');

    $rows = ['2026-11-17 11' => '99', '2026-11-18 02' => '50', '2026-11-18 09' => '4', '2026-11-18 10' => '7', '2026-11-18 11' => '1', '2026-11-18 12' => '3'];
    $later = $history($at('2026-11-18 12:05', $rome));
    check(array_slice($asked, 2) === ['2026-11-18 04:00:00'], 'a refresh after some hours must read from six hours before the hour of the cache');
    check($later['series'][0]['time'] === $at('2026-11-17 13:00', $rome), 'the range must move with the current hour');
    check($later['series'][13]['calls'] === 5 && $later['series'][16]['calls'] === 0, 'the hours before the last six of the cache must be kept, the others counted again');
    check($later['series'][19]['calls'] === 0 && $later['series'][20]['calls'] === 4 && $later['series'][21]['calls'] === 7 && $later['series'][22]['calls'] === 1 && $later['series'][23]['calls'] === 3, 'the new hours must be counted');
    check(!in_array(99, array_column($later['series'], 'calls'), true), 'hours older than the range must fall out of it');

    $oldest = null;
    $rows = [];
    $empty = $history($at('2026-11-18 12:20', $rome));
    check(array_slice($asked, 3) === ['2026-11-18 06:00:00'], 'a refresh of an emptied CDR must read the last six hours');
    check($empty['history_start'] === null, 'an emptied CDR must have no start');
    check(array_column(array_slice($empty['series'], 0, 17), 'calls') === array_column(array_slice($later['series'], 0, 17), 'calls') && $empty['series'][13]['calls'] === 5, 'an emptied CDR must keep the cached hours before the last six');
    check(array_column(array_slice($empty['series'], 17), 'calls') === array_fill(0, 7, 0), 'an emptied CDR must give 0 in the last six hours and the current one');
    $oldest = '2026-11-18 11:30:00';
    $rows = ['2026-11-18 11' => '1'];
    $cleaned = $history($at('2026-11-18 12:30', $rome));
    check(array_column(array_slice($cleaned['series'], 0, 22), 'calls') === array_fill(0, 22, null), 'hours before a CDR cleanup must be null');
    check($cleaned['series'][22]['calls'] === 1, 'the hour of the oldest call after a cleanup must be counted');
    $oldest = '2026-11-01 09:12:00';

    $full = function ($message, $now = null, $zone = null) use (&$asked, $history, $at, $rome) {
        $before = count($asked);
        $result = $history($now ?? $at('2026-11-18 12:40', $rome), $zone);
        check(count($asked) === $before + 1 && $asked[$before] === dashboardLocalTime($result['series'][0]['time'], $zone ?? $rome), $message);
        return $result;
    };

    unlink($cacheFile);
    $full('a missing cache must read the whole period');
    file_put_contents($cacheFile, '{');
    $full('a corrupted cache must read the whole period');
    $history($at('2026-11-18 12:40', $rome));
    $valid = json_decode(file_get_contents($cacheFile), true);
    foreach ([
        'a cache from the future must read the whole period' => ['time' => $valid['time'] + 3600],
        'a cache of a future hour must read the whole period' => ['current' => $valid['current'] + 3600],
        'a cache of another time zone must read the whole period' => ['zone' => 'Europe/London'],
        'a cache with another hour alignment must read the whole period' => ['current' => $valid['current'] - 1800, 'time' => $valid['time'] - 3600],
        'a cache with a missing hour must read the whole period' => ['buckets' => array_slice($valid['buckets'], 1, null, true), 'time' => $valid['time'] - 300],
        'a cache with an invalid hour must read the whole period' => ['buckets' => array_replace($valid['buckets'], [$valid['current'] - 7200 => 'x']), 'time' => $valid['time'] - 300],
        'a cache with an invalid start must read the whole period' => ['history_start' => 'x', 'time' => $valid['time'] - 300],
        'a cache without start must read the whole period' => ['time' => $valid['time'] - 300, 'history_start' => false],
    ] as $message => $change) {
        $broken = array_replace($valid, $change);
        if (($change['history_start'] ?? null) === false) {
            unset($broken['history_start']);
        }
        file_put_contents($cacheFile, json_encode($broken));
        $full($message);
    }
    $history($at('2026-11-18 12:40', $rome));
    $full('a cache older than the range must read the whole period', $at('2026-11-20 12:40', $rome));
    $full('a change of time zone must read the whole period', $at('2026-11-20 12:40', $rome), $kolkata);
    check(json_decode(file_get_contents($cacheFile), true)['zone'] === 'Asia/Kolkata', 'the cache must store the time zone of its hours');

    unlink($cacheFile);
    $oldest = '2026-10-01 00:00:00';
    $rows = ['2026-10-25 01' => '1', '2026-10-25 02' => '6', '2026-10-25 03' => '2'];
    $dst = $history($at('2026-10-25 01:30', $rome) + 2 * 3600 + 600);
    check(array_slice(array_column($dst['series'], 'calls'), -3) === [1, 6, 0], 'the fall back day must keep one point per real hour');
    check($dst['series'][23]['time'] - $dst['series'][22]['time'] === 3600, 'the fall back day points must be one hour apart');
    $rows = ['2026-10-25 01' => '1', '2026-10-25 02' => '8', '2026-10-25 03' => '2'];
    $after = $history($at('2026-10-25 03:10', $rome));
    check(array_slice($asked, -1) === ['2026-10-24 21:00:00'], 'a refresh across the fall back must read the last six hours');
    check(array_slice(array_column($after['series'], 'calls'), -4) === [1, 8, 0, 2], 'a refresh across the fall back must count the repeated hour once, in its first occurrence');
    $rows = ['2026-10-25 02' => '9'];
    $history($at('2026-10-25 08:10', $rome));
    $rows = ['2026-10-25 02' => '10'];
    $margin = $history($at('2026-10-25 08:20', $rome));
    check(array_slice($asked, -1) === ['2026-10-25 02:00:00'], 'a refresh six hours after the repeated hour must read it from its first occurrence');
    check(array_slice(array_column($margin['series'], 'calls'), -8, 2) === [10, 0], 'a refresh six hours after the repeated hour must count it again in its first occurrence');

    unlink($cacheFile);
    $rows = [];
    $before = count($asked);
    $week = $history($at('2026-11-18 12:40', $rome), null, '15d');
    check(count($week['series']) === 360 && $asked[$before] === '2026-11-03 13:00:00', 'the 15 days range must read 360 hours');
    check(array_slice($asked, $before + 1) === array_map(fn($day) => sprintf('2026-11-%02d 00:00:00', $day), range(4, 18)), 'the first request of 15 days must read one day per query');
    $before = count($asked);
    $history($at('2026-11-18 12:45', $rome) + 300, null, '15d');
    check(array_slice($asked, $before) === ['2026-11-18 06:00:00'], 'a refresh of 15 days must read the last hours with one query');

    $late = [['2026-11-01 08:00:00', 'old', '201', '', '']];
    $lateCache = "$temporary/late.json";
    for ($now = $at('2026-11-18 09:00', $rome); $now <= $at('2026-11-18 10:45', $rome); $now += 300) {
        dashboardCallsHistory('24h', $now, $rome, $cdr($late), fn() => '2026-11-01 08:00:00', $lateCache);
    }
    $late[] = ['2026-11-18 08:55:00', 'long', '201', '', ''];
    $late[] = ['2026-11-18 10:40:00', 'moved', '202', '', ''];
    $result = dashboardCallsHistory('24h', $at('2026-11-18 10:50', $rome), $rome, $cdr($late), fn() => '2026-11-01 08:00:00', $lateCache);
    check($result['series'][21]['calls'] === 1, 'a call written to the CDR at hangup within six hours must be counted after a refresh');
    $late[] = ['2026-11-18 07:30:00', 'moved', '201', '', ''];
    $result = dashboardCallsHistory('24h', $at('2026-11-18 10:55', $rome), $rome, $cdr($late), fn() => '2026-11-01 08:00:00', $lateCache);
    check(array_column($result['series'], 'calls') === array_values($reference($late, $result['series'][0]['time'], end($result['series'])['time'], $rome)), 'a call whose first leg is written late must move to the hour of its first leg, once');
    check($result['series'][20]['calls'] === 1 && $result['series'][23]['calls'] === 0, 'a late first leg within six hours must move its call');
    $late[] = ['2026-11-18 11:10:00', 'beyond', '202', '', ''];
    dashboardCallsHistory('24h', $at('2026-11-18 11:15', $rome), $rome, $cdr($late), fn() => '2026-11-01 08:00:00', $lateCache);
    $late[] = ['2026-11-18 03:00:00', 'beyond', '201', '', ''];
    $result = dashboardCallsHistory('24h', $at('2026-11-18 11:20', $rome), $rome, $cdr($late), fn() => '2026-11-01 08:00:00', $lateCache);
    check($result['series'][15]['calls'] === 0 && $result['series'][23]['calls'] === 0, 'a first leg written more than six hours late must not count its call twice');
    unlink($lateCache);

    $late = [['2026-10-01 08:00:00', 'old', '201', '', ''], ['2026-10-25 02:10:00', 'first', '201', '', '']];
    for ($now = $at('2026-10-25 01:00', $rome); $now <= $at('2026-10-25 03:05', $rome); $now += 300) {
        dashboardCallsHistory('24h', $now, $rome, $cdr($late), fn() => '2026-10-01 08:00:00', $lateCache);
    }
    $late[] = ['2026-10-25 02:55:00', 'late', '201', '', ''];
    $result = dashboardCallsHistory('24h', $at('2026-10-25 03:15', $rome), $rome, $cdr($late), fn() => '2026-10-01 08:00:00', $lateCache);
    check(array_slice(array_column($result['series'], 'calls'), -4) === [0, 2, 0, 0], 'a call of the repeated hour written late must be counted in its first occurrence');
    unlink($lateCache);

    check(DASHBOARD_CALLS_FULL_REFRESH === 86400, 'the whole range must be counted again once a day');
    $recountCache = "$temporary/recount.json";
    $recount = [['2026-10-01 08:00:00', 'old', '201', '', '']];
    $recountAsked = [];
    $recountQuery = function ($since, $until) use (&$recount, &$recountAsked, $cdr) {
        $recountAsked[] = $since;
        return $cdr($recount)($since, $until);
    };
    $recountHistory = fn($now, $range = '24h') => dashboardCallsHistory($range, $now, $rome, $recountQuery, fn() => '2026-10-01 08:00:00', $recountCache);
    $imported = $at('2026-11-19 00:00', $rome);
    $importedCalls = fn($result) => array_column($result['series'], 'calls', 'time')[$imported];
    for ($now = $at('2026-11-18 10:20', $rome); $now <= $at('2026-11-19 07:20', $rome); $now += 3600) {
        $recountHistory($now);
    }
    $recount[] = ['2026-11-19 00:20:00', 'imported', '201', '', ''];
    $recountAsked = [];
    $result = $recountHistory($at('2026-11-19 10:15', $rome));
    check($recountAsked === ['2026-11-19 01:00:00'] && $importedCalls($result) === 0, 'a call written later for an hour older than six hours must not be counted by a refresh');
    $recountAsked = [];
    $result = $recountHistory($at('2026-11-19 10:20', $rome));
    check($recountAsked === ['2026-11-18 11:00:00'], 'a cache counted in full 24 hours ago must count the whole range again');
    check($importedCalls($result) === 1 && array_sum(array_column($result['series'], 'calls')) === 1, 'the count of the whole range must add the calls written later');
    check(json_decode(file_get_contents($recountCache), true)['full_time'] === $at('2026-11-19 10:20', $rome), 'the cache must store the time of the last count of the whole range');
    $recountAsked = [];
    $result = $recountHistory($at('2026-11-19 10:25', $rome));
    check($recountAsked === ['2026-11-19 04:00:00'] && $importedCalls($result) === 1, 'the refresh after a count of the whole range must read only the last hours');
    $legacy = json_decode(file_get_contents($recountCache), true);
    unset($legacy['full_time']);
    file_put_contents($recountCache, json_encode($legacy));
    $recountAsked = [];
    $recountHistory($at('2026-11-19 10:30', $rome));
    check($recountAsked === ['2026-11-18 11:00:00'], 'a cache without the time of the last full count must count the whole range again');
    check(json_decode(file_get_contents($recountCache), true)['full_time'] === $at('2026-11-19 10:30', $rome), 'a cache without the time of the last full count must store it');
    unlink($recountCache);
    $recountHistory($at('2026-11-19 10:30', $rome), '15d');
    $legacy = json_decode(file_get_contents($recountCache), true);
    $legacy['full_time'] = $legacy['time'] - 86400;
    $legacy['time'] -= DASHBOARD_CALLS_HISTORY_TTL;
    file_put_contents($recountCache, json_encode($legacy));
    $recountAsked = [];
    $recountHistory($at('2026-11-19 10:30', $rome), '15d');
    check($recountAsked === ['2026-11-04 11:00:00', ...array_map(fn($day) => sprintf('2026-11-%02d 00:00:00', $day), range(5, 19))], 'the count of the whole 15 days must read one day per query');
    $legacy['time'] = $at('2026-11-19 10:30', $rome) - DASHBOARD_CALLS_HISTORY_TTL;
    file_put_contents($recountCache, json_encode($legacy));
    $failed = false;
    try {
        dashboardCallsHistory('15d', $at('2026-11-19 10:30', $rome), $rome, fn($since, $until) => throw new RuntimeException('database unavailable'), fn() => null, $recountCache);
    } catch (RuntimeException $e) {
        $failed = true;
    }
    $probe = fopen("$recountCache.lock", 'c');
    check($failed && flock($probe, LOCK_EX | LOCK_NB), 'a failed count of the whole range must release the lock');
    flock($probe, LOCK_UN);
    fclose($probe);
    check(json_decode(file_get_contents($recountCache), true) === $legacy, 'a failed count of the whole range must keep the cache');
    unlink($recountCache);
    unlink("$recountCache.lock");

    $blocked = "$temporary/blocked";
    mkdir($blocked);
    mkdir("$blocked/nethvoice-dashboard-calls-24h.json");
    $result = dashboardCallsHistory('24h', $at('2026-11-18 10:20', $rome), $rome, fn($since, $until) => ['2026-11-18 10' => '3'], fn() => null, "$blocked/nethvoice-dashboard-calls-24h.json");
    check(end($result['series'])['calls'] === 3, 'a cache that cannot be replaced must not fail the request');
    check(glob("$blocked/calls*") === [], 'a cache that cannot be replaced must not leave its temporary file');
    mkdir("$blocked/nethvoice-dashboard-phones.json");
    $phones = ['provisioned' => 1, 'pending' => 0, 'unassigned' => 0, 'failed' => 0, 'unknown' => 0, 'total' => 1];
    check(dashboardCachedPhoneSummary(fn() => $phones, "$blocked/nethvoice-dashboard-phones.json", 30) === $phones, 'a phones cache that cannot be replaced must not fail the request');
    check(glob("$blocked/phones*") === [], 'a phones cache that cannot be replaced must not leave its temporary file');

    $lockCache = "$temporary/locked.json";
    $now = $at('2026-11-18 10:20', $rome);
    $expected = dashboardCallsHistory('24h', $now, $rome, fn($since, $until) => ['2026-11-18 09' => '4'], fn() => '2026-11-01 00:00:00', $lockCache);
    $fresh = file_get_contents($lockCache);
    $stale = json_decode($fresh, true);
    $stale['time'] -= DASHBOARD_CALLS_HISTORY_TTL;
    file_put_contents($lockCache, json_encode($stale));
    $holder = proc_open([PHP_BINARY, '-r', '$lock = fopen($argv[1], "c"); flock($lock, LOCK_EX); echo "locked\n"; usleep(300000); file_put_contents($argv[2], $argv[3]); flock($lock, LOCK_UN);', '--', "$lockCache.lock", $lockCache, $fresh], [1 => ['pipe', 'w']], $pipes);
    check(fgets($pipes[1]) === "locked\n", 'another request must hold the lock');
    $counted = 0;
    $started = hrtime(true);
    $reused = dashboardCallsHistory('24h', $now, $rome, function ($since, $until) use (&$counted) {
        $counted++;
        return [];
    }, fn() => '2026-11-01 00:00:00', $lockCache);
    $waited = (hrtime(true) - $started) / 1e9;
    fclose($pipes[1]);
    check(proc_close($holder) === 0, 'the request holding the lock must end');
    check($counted === 0 && $reused === $expected, 'a request waiting for the lock must answer with the cache written by the request holding it');
    check($waited >= 0.2, 'a request must wait for the request holding the lock');
    $failing = fn($since, $until) => throw new RuntimeException('database unavailable');
    file_put_contents($lockCache, json_encode($stale));
    $failed = false;
    try {
        dashboardCallsHistory('24h', $now, $rome, $failing, fn() => null, $lockCache);
    } catch (RuntimeException $e) {
        $failed = true;
    }
    $probe = fopen("$lockCache.lock", 'c');
    check($failed && flock($probe, LOCK_EX | LOCK_NB), 'a failed count must release the lock');
    flock($probe, LOCK_UN);
    fclose($probe);
    unlink("$lockCache.lock");
    mkdir("$lockCache.lock");
    $unlocked = dashboardCallsHistory('24h', $now, $rome, fn($since, $until) => ['2026-11-18 10' => '5'], fn() => null, $lockCache);
    check(end($unlocked['series'])['calls'] === 5 && json_decode(file_get_contents($lockCache), true)['time'] === $now, 'a request that cannot lock the cache must count and cache the calls');

    $handler = $app->handlers['GET /dashboard/calls'];
    $invalid = $handler(new FakeRequest(['range' => '1y']), new FakeResponse());
    check($invalid->status === 400 && str_contains($invalid->body['message'], '24h, 7d, 15d'), 'an invalid range must be a bad request');

    FakeDatabase::$executed = [];
    $plain = $handler(new FakeRequest([]), new FakeResponse());
    check($plain->status === 200, 'the calls without range must be read');
    check(array_keys($plain->body) === ['total', 'answered', 'missed', 'invalid', 'calls_by_hour'], 'without range the response must not change');
    check(count(FakeDatabase::$executed) === 1 && FakeDatabase::$executed[0][0] === DASHBOARD_CALLS_QUERY, 'without range only the calls of today must be read');

    $current = (new DateTimeImmutable())->format('Y-m-d H');
    $next = (new DateTimeImmutable('+1 hour'))->format('Y-m-d H');
    FakeDatabase::$perHour = [$current => '2', $next => '2'];
    FakeDatabase::$oldest = '2026-01-01 00:00:00';
    FakeDatabase::$executed = [];
    $ranged = $handler(new FakeRequest(['range' => '24h']), new FakeResponse());
    check($ranged->status === 200, 'the calls with range must be read');
    check(array_keys($ranged->body) === ['total', 'answered', 'missed', 'invalid', 'calls_by_hour', 'range', 'source', 'history_start', 'series'], 'the range must add the history to the summary');
    check($ranged->body['range'] === '24h' && $ranged->body['source'] === 'cdr' && count($ranged->body['series']) === 24, 'the 24 hours range must have 24 points from the CDR');
    check(array_keys($ranged->body['series'][0]) === ['time', 'calls'], 'a point must have its time and calls');
    $last = end($ranged->body['series']);
    check(in_array(date('Y-m-d H', $last['time']), [$current, $next], true) && $last['calls'] === 2, 'the current hour must have its calls');
    check($ranged->body['history_start'] === (new DateTimeImmutable('2026-01-01 00:00:00'))->getTimestamp(), 'the history must start at the oldest call');
    [$sql, $parameters] = FakeDatabase::$executed[1];
    check($sql === DASHBOARD_CALLS_PER_HOUR_QUERY, 'the calls per hour must be read from the CDR');
    check(count($parameters) === substr_count($sql, '?'), 'every parameter of the calls per hour must be bound');
    $since = date('Y-m-d H:00:00', $ranged->body['series'][0]['time']);
    $until = date('Y-m-d H:00:00', $last['time'] + 7200);
    $bound = preg_replace_callback('/\?/', function () use (&$parameters) {
        return "'" . array_shift($parameters) . "'";
    }, $sql);
    check(str_contains($bound, "WHERE calldate >= '$since' AND calldate < '$until'"), 'the calls per hour must read the CDR of the range');
    check(substr_count($bound, "(leg.calldate < '$since' OR leg.calldate >= '$until')") === 3, 'the legs outside the range must be read in the whole CDR');
    check(substr_count($bound, "accountcode = 'nv-admin' OR") === 3 && substr_count($bound, "(leg.calldate < '$since' OR leg.accountcode = 'nv-admin'") === 2, 'the calls of the administrator phone and the calls started before the range must not be counted per hour');
    check(is_file("$temporary/nethvoice-dashboard-calls-24h.json"), 'the history must be cached per range');

    rmdir("$lockCache.lock");
    rmdir("$blocked/nethvoice-dashboard-calls-24h.json");
    rmdir("$blocked/nethvoice-dashboard-phones.json");
    array_map('unlink', glob("$blocked/*"));
    rmdir($blocked);
    array_map('unlink', glob("$temporary/*"));
    rmdir($temporary);

    echo "dashboard calls tests passed\n";
}
