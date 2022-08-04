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

$app->get('/mobiles', function (Request $request, Response $response, $args) {
    try {
        $dbh = FreePBX::Database();
        $sql = 'SELECT rest_users.mobile, userman_users.username'.
          ' FROM rest_users'.
          ' JOIN userman_users ON userman_users.id = rest_users.user_id';
        $mobiles = $dbh->sql($sql, 'getAll', \PDO::FETCH_ASSOC);

        return $response->withJson($mobiles, 200);
    } catch (Exception $e) {
        error_log($e->getMessage());

        return $response->withStatus(500);
    }
});

$app->get('/mobiles/{username}', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $username = $route->getArgument('username');
        $dbh = FreePBX::Database();
        $sql = 'SELECT rest_users.mobile'.
          ' FROM rest_users'.
          ' JOIN userman_users ON userman_users.id = rest_users.user_id'.
          ' WHERE userman_users.username = \''. $username. '\'';
        $mobile = $dbh->sql($sql, 'getOne', \PDO::FETCH_ASSOC);
        if ($mobile == false) {
            return $response->withStatus(404);
        }

        return $response->withJson($mobile, 200);
    } catch (Exception $e) {
        error_log($e->getMessage());

        return $response->withStatus(500);
    }
});

$app->post('/mobiles', function (Request $request, Response $response, $args) {
    try {
        $params = $request->getParsedBody();
        $dbh = FreePBX::Database();
        $sql =  'INSERT INTO rest_users (user_id,mobile)'.
                ' SELECT id, ?'.
                ' FROM userman_users'.
                ' WHERE username = ?'.
                ' ON DUPLICATE KEY UPDATE mobile = ?';

        $stmt = $dbh->prepare($sql);
        $mobile = preg_replace('/^\+/', '00', $params['mobile']);
        $mobile = preg_replace('/[^0-9]/', '', $mobile);
        if ($mobile == "") {
            $mobile = NULL;
        }
        $stmt->execute(array($mobile, $params['username'], $mobile));
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
    system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
    return $response->withStatus(200);
});
