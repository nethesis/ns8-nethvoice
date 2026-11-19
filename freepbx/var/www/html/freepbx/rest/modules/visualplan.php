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

include_once(__DIR__. '/../lib/libVisualPlan.php');

/**
 * @api {get} /visualplan  Read every call flow object the visual plan can show and edit
 */
$app->get('/visualplan', function (Request $request, Response $response, $args) {
    try {
        visualplan_include_modules();
        $data = visualplan_load();
    } catch (Throwable $e) {
        error_log('Visualplan: request failed (' . get_class($e) . ')');
        return jsonResponse($response, ['error' => 'Internal server error'], 500);
    }

    return jsonResponse($response, $data, 200);
});

/**
 * @api {post} /visualplan  Create and update call flow objects, then reload the dialplan
 */
$app->post('/visualplan', function (Request $request, Response $response, $args) {
    try {
        visualplan_include_modules();
        $result = visualplan_save($request->getParsedBody());
    } catch (Throwable $e) {
        error_log('Visualplan: request failed (' . get_class($e) . ')');
        return jsonResponse($response, ['error' => 'Internal server error'], 500);
    }

    if ($result['reload']) {
        system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
    }
    return jsonResponse($response, $result['body'], $result['status']);
});

/**
 * @api {post} /visualplan/layout  Replace the canvas layout of one inbound route
 */
$app->post('/visualplan/layout', function (Request $request, Response $response, $args) {
    try {
        $result = visualplan_save_layout($request->getParsedBody());
    } catch (Throwable $e) {
        error_log('Visualplan: request failed (' . get_class($e) . ')');
        return jsonResponse($response, ['error' => 'Internal server error'], 500);
    }

    if ($result['status'] === 204) {
        return $response->withStatus(204);
    }
    return jsonResponse($response, $result['body'], $result['status']);
});

/**
 * @api {post} /visualplan/recordings  Upload a wav or mp3 file as a new system recording
 */
$app->post('/visualplan/recordings', function (Request $request, Response $response, $args) {
    $params = $request->getParsedBody();
    $files = $request->getUploadedFiles();
    try {
        visualplan_include_modules();
        $result = visualplan_upload_recording($files['file'] ?? null, is_array($params) ? ($params['name'] ?? null) : null);
    } catch (Throwable $e) {
        error_log('Visualplan: request failed (' . get_class($e) . ')');
        return jsonResponse($response, ['error' => 'Internal server error'], 500);
    }

    return jsonResponse($response, $result['body'], $result['status']);
});
