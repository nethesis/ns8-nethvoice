<?php

#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

const DASHBOARD_CALLS_QUERY = "SELECT
        MAX(disposition = 'ANSWERED') AS answered,
        MAX(disposition IN ('NO ANSWER', 'BUSY')) AS missed,
        MAX(did <> '') AS incoming,
        HOUR(MIN(calldate)) AS hour
    FROM asteriskcdrdb.cdr
    WHERE calldate >= ? AND calldate < ? AND dst NOT LIKE '*%'
    GROUP BY COALESCE(NULLIF(linkedid, ''), uniqueid)";

function dashboardSummarizeCalls(array $calls, int $hours): array
{
    $summary = [
        'total' => 0,
        'answered' => 0,
        'missed' => 0,
        'invalid' => 0,
        'incoming_by_hour' => array_fill(0, $hours, 0),
    ];

    foreach ($calls as $call) {
        $summary['total']++;
        if ((int) $call['answered']) {
            $summary['answered']++;
        } elseif ((int) $call['missed']) {
            $summary['missed']++;
        } else {
            $summary['invalid']++;
        }

        $hour = (int) $call['hour'];
        if ((int) $call['incoming'] && $hour >= 0 && $hour < $hours) {
            $summary['incoming_by_hour'][$hour]++;
        }
    }

    return $summary;
}

$app->get('/dashboard/calls', function (Request $request, Response $response) {
    try {
        $now = new DateTimeImmutable();
        $start = $now->setTime(0, 0);
        $statement = FreePBX::Database()->prepare(DASHBOARD_CALLS_QUERY);
        $statement->execute([
            $start->format('Y-m-d H:i:s'),
            $start->modify('+1 day')->format('Y-m-d H:i:s'),
        ]);
        $calls = $statement->fetchAll(PDO::FETCH_ASSOC);

        return jsonResponse($response, dashboardSummarizeCalls($calls, (int) $now->format('G') + 1), 200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return jsonResponse($response, 'An error occurred', 500);
    }
});
