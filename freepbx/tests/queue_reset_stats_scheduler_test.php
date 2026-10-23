#!/usr/bin/env php
<?php

/**
 * Regression tests for queue_reset_stats_scheduler.php.
 *
 * Copyright (C) 2026 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

ob_start();
require_once __DIR__ . '/../var/lib/asterisk/bin/queue_reset_stats_scheduler.php';
ob_end_clean();

function queue_stats_test_assert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function queue_stats_test_assert_schedule_exception(callable $callback, string $message): void
{
    try {
        $callback();
    } catch (QueueStatsScheduleException $exception) {
        return;
    }

    throw new RuntimeException($message);
}

function queue_stats_test_schedule(array $overrides = []): array
{
    return array_merge(
        [
            'id' => '608',
            'cron_schedule' => 'daily',
            'cron_random' => 'false',
            'cron_minute' => '59',
            'cron_hour' => '23',
            'cron_dom' => '*',
            'cron_month' => '*',
            'cron_dow' => '*',
        ],
        $overrides
    );
}

final class QueueStatsTestAstman
{
    public array $requests = [];

    public function send_request(string $action, array $parameters): array
    {
        $this->requests[] = [$action, $parameters];
        return ['Response' => 'Success'];
    }
}

$rome = new DateTimeZone('Europe/Rome');
$tests = [];

$tests['daily schedule'] = static function () use ($rome): void {
    $due = new DateTimeImmutable('2026-08-07 23:59:00', $rome);
    $notDue = new DateTimeImmutable('2026-08-07 23:58:00', $rome);
    $schedule = queue_stats_test_schedule();

    queue_stats_test_assert(queue_stats_schedule_is_due($schedule, $due), 'daily schedule is not due');
    queue_stats_test_assert(!queue_stats_schedule_is_due($schedule, $notDue), 'daily schedule is due early');
};

$tests['hourly schedule'] = static function () use ($rome): void {
    $schedule = queue_stats_test_schedule([
        'cron_schedule' => 'hourly',
        'cron_minute' => '15',
        'cron_hour' => '*',
    ]);

    queue_stats_test_assert(
        queue_stats_schedule_is_due($schedule, new DateTimeImmutable('2026-08-07 06:15:00', $rome)),
        'hourly schedule is not due'
    );
};

$tests['weekly Sunday schedule'] = static function () use ($rome): void {
    $schedule = queue_stats_test_schedule([
        'cron_schedule' => 'weekly',
        'cron_minute' => '30',
        'cron_hour' => '8',
        'cron_dow' => '7',
    ]);

    queue_stats_test_assert(
        queue_stats_schedule_is_due($schedule, new DateTimeImmutable('2026-08-09 08:30:00', $rome)),
        'Sunday expressed as 7 does not match'
    );
    queue_stats_test_assert(
        !queue_stats_schedule_is_due($schedule, new DateTimeImmutable('2026-08-10 08:30:00', $rome)),
        'weekly schedule matches the wrong weekday'
    );
};

$tests['monthly schedule'] = static function () use ($rome): void {
    $schedule = queue_stats_test_schedule([
        'cron_schedule' => 'monthly',
        'cron_minute' => '0',
        'cron_hour' => '1',
        'cron_dom' => '15',
    ]);

    queue_stats_test_assert(
        queue_stats_schedule_is_due($schedule, new DateTimeImmutable('2026-08-15 01:00:00', $rome)),
        'monthly schedule is not due'
    );
};

$tests['annual schedule'] = static function () use ($rome): void {
    $schedule = queue_stats_test_schedule([
        'cron_schedule' => 'annually',
        'cron_minute' => '5',
        'cron_hour' => '2',
        'cron_dom' => '3',
        'cron_month' => '4',
    ]);

    queue_stats_test_assert(
        queue_stats_schedule_is_due($schedule, new DateTimeImmutable('2026-04-03 02:05:00', $rome)),
        'annual schedule is not due'
    );
};

$tests['custom day fields use cron OR semantics'] = static function () use ($rome): void {
    $schedule = queue_stats_test_schedule([
        'cron_schedule' => 'custom',
        'cron_minute' => '0',
        'cron_hour' => '12',
        'cron_dom' => '8',
        'cron_dow' => '5',
    ]);

    queue_stats_test_assert(
        queue_stats_schedule_is_due($schedule, new DateTimeImmutable('2026-08-07 12:00:00', $rome)),
        'custom schedule does not match its weekday'
    );
    queue_stats_test_assert(
        queue_stats_schedule_is_due($schedule, new DateTimeImmutable('2026-08-08 12:00:00', $rome)),
        'custom schedule does not match its day of month'
    );
};

$tests['disabled schedule'] = static function () use ($rome): void {
    queue_stats_test_assert(
        !queue_stats_schedule_is_due(
            queue_stats_test_schedule(['cron_schedule' => 'never']),
            new DateTimeImmutable('2026-08-07 23:59:00', $rome)
        ),
        'disabled schedule is due'
    );
};

$tests['random schedule is rejected'] = static function () use ($rome): void {
    queue_stats_test_assert_schedule_exception(
        static function () use ($rome): void {
            queue_stats_schedule_is_due(
                queue_stats_test_schedule(['cron_random' => 'true']),
                new DateTimeImmutable('2026-08-07 23:59:00', $rome)
            );
        },
        'random schedule was accepted'
    );
};

$tests['invalid cron field is rejected'] = static function () use ($rome): void {
    queue_stats_test_assert_schedule_exception(
        static function () use ($rome): void {
            queue_stats_schedule_is_due(
                queue_stats_test_schedule(['cron_minute' => '60']),
                new DateTimeImmutable('2026-08-07 23:59:00', $rome)
            );
        },
        'out-of-range minute was accepted'
    );
    queue_stats_test_assert_schedule_exception(
        static function () use ($rome): void {
            queue_stats_schedule_is_due(
                queue_stats_test_schedule(['cron_hour' => '1-5']),
                new DateTimeImmutable('2026-08-07 23:59:00', $rome)
            );
        },
        'non-UI cron syntax was accepted'
    );
};

$tests['processor resets only due queues'] = static function () use ($rome): void {
    $resets = [];
    $warnings = [];
    $info = [];
    $errors = [];
    $status = queue_stats_process_schedules(
        [
            queue_stats_test_schedule(['id' => '608']),
            queue_stats_test_schedule(['id' => '609', 'cron_minute' => '58']),
            queue_stats_test_schedule(['id' => '610', 'cron_random' => 'true']),
        ],
        new DateTimeImmutable('2026-08-07 23:59:00', $rome),
        static function (string $queueId) use (&$resets): void {
            $resets[] = $queueId;
        },
        static function (string $key, string $message) use (&$warnings): void {
            $warnings[] = [$key, $message];
        },
        static function (string $message) use (&$info): void {
            $info[] = $message;
        },
        static function (string $message) use (&$errors): void {
            $errors[] = $message;
        }
    );

    queue_stats_test_assert($status === 0, 'processor reported a false failure');
    queue_stats_test_assert($resets === ['608'], 'processor reset the wrong queues');
    queue_stats_test_assert(count($warnings) === 1, 'processor did not report the random schedule once');
    queue_stats_test_assert(count($info) === 1, 'processor did not report the successful reset');
    queue_stats_test_assert($errors === [], 'processor reported an unexpected reset failure');
};

$tests['processor reports reset failures'] = static function () use ($rome): void {
    $errors = [];
    $status = queue_stats_process_schedules(
        [queue_stats_test_schedule()],
        new DateTimeImmutable('2026-08-07 23:59:00', $rome),
        static function (): void {
            throw new RuntimeException('test failure');
        },
        static function (): void {
        },
        static function (): void {
        },
        static function (string $message) use (&$errors): void {
            $errors[] = $message;
        }
    );

    queue_stats_test_assert($status === 1, 'processor did not fail after a reset error');
    queue_stats_test_assert(count($errors) === 1, 'processor did not report the reset error');
};

$tests['AMI reset command and event'] = static function (): void {
    $astman = new QueueStatsTestAstman();
    queue_stats_reset_queue($astman, '608');

    queue_stats_test_assert(
        $astman->requests === [
            ['Command', ['Command' => 'queue reset stats 608']],
            ['UserEvent', ['userEvent' => 'reset-queue-stats', 'queueId' => '608']],
        ],
        'scheduler emitted unexpected AMI requests'
    );
};

$failures = 0;
foreach ($tests as $name => $test) {
    try {
        $test();
        echo "PASS: $name\n";
    } catch (Throwable $exception) {
        $failures++;
        fwrite(STDERR, "FAIL: $name: {$exception->getMessage()}\n");
    }
}

exit($failures === 0 ? 0 : 1);
