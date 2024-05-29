<?php
#
# Copyright (C) 2017 Nethesis S.r.l.
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

include_once('lib/libExtensions.php');
include_once('lib/libUsers.php');

use \Psr\Http\Message\ServerRequestInterface as Request;
use \Psr\Http\Message\ResponseInterface as Response;

$app->get('/mainextensions', function (Request $request, Response $response, $args) {
    $mainextensions = FreePBX::create()->Core->getAllUsersByDeviceType('virtual');
    return $response->withJson($mainextensions, 200);
});

$app->get('/mainextensions/{extension}', function (Request $request, Response $response, $args) {
    $route = $request->getAttribute('route');
    $extension = $route->getArgument('extension');
    $mainextensions = FreePBX::create()->Core->getAllUsersByDeviceType('virtual');
    foreach ($mainextensions as $e) {
        if ($e['extension'] == $extension) {
            return $response->withJson($e, 200);
        }
    }
    return $response->withStatus(404);
});

$app->post('/mainextensions', function (Request $request, Response $response, $args) {
    $params = $request->getParsedBody();
    $username = $params['username'];
    $mainextension = $params['extension'];
    $outboundcid = $params['outboundcid'];

    if (checkUsermanIsUnlocked()) {
        if (
            configuredUsersCount() >= communityUsersLimit() && // check if there are more configured users than the allowed limit
            (empty($_ENV['SUBSCRIPTION_SYSTEMID']) || empty($_ENV['SUBSCRIPTION_SECRET'])) && // it isn't registered as enterprise
            !empty($mainextension) // the user is trying to create a new extension
        ) {
            return $response->withJson(array("status"=>'ERROR: community version is limited to 8 users'), 403);
        }
        $ret = createMainExtensionForUser($username,$mainextension,$outboundcid);
    } else {
        return $response->withJson(array("status"=>'ERROR: directory is locked'), 500);
    }

    system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');

    if ($ret === true) {
        return $response->withStatus(201);
    }
    return $response->withJson($ret[0],$ret[1]);
});

/**
 * Retrieves configurable user limits.
 *
 * This endpoint returns the user limits for the main extensions in the system.
 * It checks if the system is running the community version or the enterprise version
 * and returns the appropriate limits and configurable counts accordingly.
 */
$app->get('/mainextensions/userlimits', function (Request $request, Response $response, $args) {
    $limits = array(
        'configured' => configuredUsersCount(),
    );
    if (empty($_ENV['SUBSCRIPTION_SYSTEMID']) || empty($_ENV['SUBSCRIPTION_SECRET'])) {
        # community version
        $limits['limit'] = communityUsersLimit();
        $limits['configurable'] = configuredUsersCount()-communityUsersLimit();
    } else {
        # enterprise version
        $limits['limit'] = false;
        $limits['configurable'] = false;
    }
    $limits['limit'] = communityUsersLimit();
    return $response->withJson(array("limit"=>communityUsersLimit()), 200);
});