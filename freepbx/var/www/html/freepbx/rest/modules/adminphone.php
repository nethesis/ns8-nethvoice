<?php

#
# Copyright (C) 2026 Nethesis S.r.l.
# http://www.nethesis.it - nethserver@nethesis.it
#
# This script is part of NethServer.
#
# NethServer is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License,
# or any later version.
#
# NethServer is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with NethServer.  If not, see COPYING.
#

use \Psr\Http\Message\ServerRequestInterface as Request;
use \Psr\Http\Message\ResponseInterface as Response;

include_once('lib/libAdminPhone.php');

function adminPhoneLocked(callable $callback) {
    $lock = fopen('/var/run/nethvoice/adminphone.lock', 'c');
    if ($lock === false || !flock($lock, LOCK_EX)) {
        throw new RuntimeException('Cannot lock the administrator phone');
    }
    try {
        return $callback();
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

function adminPhoneReload() {
    system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
}

$app->get('/adminphone', function (Request $request, Response $response, $args) {
    try {
        return jsonResponse($response, adminPhoneStatus(), 200);
    } catch (Throwable $e) {
        error_log('adminphone status: '.$e->getMessage());
        return jsonResponse($response, array('message' => 'Cannot read the administrator phone'), 500);
    }
});

$app->post('/adminphone/session', function (Request $request, Response $response, $args) {
    $params = $request->getParsedBody();
    $name = is_array($params) && array_key_exists('display_name', $params) ? $params['display_name'] : null;
    try {
        adminPhoneNormalizeName($name);
    } catch (InvalidArgumentException $e) {
        return jsonResponse($response, array('message' => $e->getMessage()), 422);
    }
    try {
        $result = adminPhoneLocked(fn() => adminPhoneSession($_ENV, $name));
        if ($result['changed']) {
            adminPhoneReload();
        }
        return jsonResponse($response, $result['session'], 200);
    } catch (Throwable $e) {
        error_log('adminphone session: '.$e->getMessage());
        return jsonResponse($response, array('message' => 'Cannot prepare the administrator phone'), 500);
    }
});

$app->post('/adminphone/rotate', function (Request $request, Response $response, $args) {
    try {
        if (!adminPhoneLocked(fn() => adminPhoneRotate())) {
            return jsonResponse($response, array('message' => 'Administrator phone not configured'), 404);
        }
        adminPhoneReload();
        return $response->withStatus(204);
    } catch (Throwable $e) {
        error_log('adminphone rotate: '.$e->getMessage());
        return jsonResponse($response, array('message' => 'Cannot rotate the administrator phone secret'), 500);
    }
});

$app->delete('/adminphone', function (Request $request, Response $response, $args) {
    try {
        if (adminPhoneLocked(fn() => adminPhoneDelete())) {
            adminPhoneReload();
        }
        return $response->withStatus(204);
    } catch (Throwable $e) {
        error_log('adminphone delete: '.$e->getMessage());
        return jsonResponse($response, array('message' => 'Cannot remove the administrator phone'), 500);
    }
});
