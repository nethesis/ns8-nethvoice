<?php
#
# Copyright (C) 2024 Nethesis S.r.l.
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

include_once('lib/libExtensions.php');
include_once('lib/libCTI.php');

$app->get('/nethlink/{mainextension}', function (Request $request, Response $response, $args) {
    $route = $request->getAttribute('route');
    $mainextension = $route->getArgument('mainextension');

    $extension = getNethLinkExtension($mainextension);
    if (!empty($extension)) {
        return $response->withJson($extension, 200);
    } else {
        return $response->withJson(null,200);
    }
});

$app->get('/nethlink/info/{username}', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $username = $route->getArgument('username');

        $dbh = NethCTI::Database();
        $sql = 'SELECT `user`, `extension`, `timestamp`, `nethlink_version`, `os_type`, `os_release`, `arch`'.
               ' FROM `user_nethlink` WHERE `user` = ?';
        $stmt = $dbh->prepare($sql);
        $stmt->execute(array($username));
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);

        if (!empty($row)) {
            return $response->withJson($row, 200);
        } else {
            return $response->withJson(null, 200);
        }
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

$app->post('/nethlink', function (Request $request, Response $response, $args) {
    try {
        $params = $request->getParsedBody();
        $extensionnumber = $params['extension'];
        $fpbx = FreePBX::create();

        $extension = createExtension($extensionnumber,false);

        if ($extension === false ) {
            $response->withJson(array("status"=>"Error creating extension"), 500);
        }

        if (useExtensionAsNethLink($extension) === false) {
            $response->withJson(array("status"=>"Error associating nethlink extension"), 500);
        }

        system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
        return $response->withJson(array('extension'=>$extension,'mobile_extension'=>$extensionm), 200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

$app->delete('/nethlink/{mainextension}', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $mainextension = $route->getArgument('mainextension');
        $extension = getNethLinkExtension($mainextension);
        $mobile_extension = getNethLinkMobileExtension($mainextension);
        if (deleteExtension($extension) && (empty($mobile_extension) || deleteExtension($mobile_extension))) {
            system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
            return $response->withStatus(200);
        } else {
            throw new Exception ("Error deleting extension");
        }
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});
