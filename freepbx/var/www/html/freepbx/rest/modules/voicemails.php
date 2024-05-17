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

use \Psr\Http\Message\ServerRequestInterface as Request;
use \Psr\Http\Message\ResponseInterface as Response;

$app->get('/voicemails', function (Request $request, Response $response, $args) {
    try {
        $res = FreePBX::Voicemail()->getVoicemail();

        return $response->withJson($res['default'] ? $res['default'] : array(), 200);
    } catch (Exception $e) {
        error_log($e->getMessage());

        return $response->withStatus(500);
    }
});

$app->get('/voicemails/{extension}', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $extension = $route->getArgument('extension');
        $res = FreePBX::Voicemail()->getVoicemail();

        if (is_array($res['default']) && !array_key_exists($extension, $res['default'])) {
          return $response->withStatus(404);
        }

        return $response->withJson($res['default'][$extension], 200);
    } catch (Exception $e) {
        error_log($e->getMessage());

        return $response->withStatus(500);
    }
});

$app->post('/voicemails', function (Request $request, Response $response, $args) {
    $dbh = FreePBX::Database();
    try {
        $params = $request->getParsedBody();
        $users = FreePBX::create()->Core->getAllUsersByDeviceType();
        foreach ($users as $e) {
            if ($e['extension'] === $params['extension']) {
                $extension = $e;
                break;
            }
        }

        if (!isset($extension)) {
            return $response->withJson(array('status' => 'Extension '.$params['extension']." doesn't exist"), 400);
        }

        if($params['state'] == 'yes') {
            $user = FreePBX::create()->Userman->getUserByDefaultExtension($extension['extension']);
            $tech = $extension['tech'];
            $data = array();
            $data['name'] = $extension['name'];
            $data['vmpwd'] = rand(0, 9).rand(0, 9).rand(0, 9).rand(0, 9);
            $data['email'] = $user['email'];
            $data['vm'] = 'yes';
            FreePBX::create()->Voicemail->processQuickCreate($tech, $extension['extension'], $data);
        } else {
            FreePBX::create()->Voicemail->delMailbox($extension['extension']);
            $sql = 'UPDATE `users` SET `voicemail` = "novm" WHERE `extension` = ?';
            $sth = $dbh->prepare($sql);
            $sth->execute(array($extension['extension']));
            global $astman;
            $astman->database_put("AMPUSER",$extension['extension']."/voicemail",'novm');
        }

        system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');

        return $response->withJson(array('status' => true), 200);
    } catch (Exception $e) {
        error_log($e->getMessage());

        return $response->withStatus(500);
    }
});
