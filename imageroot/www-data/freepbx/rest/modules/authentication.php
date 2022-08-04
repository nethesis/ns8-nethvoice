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

/*
* /login - POST
*
* @param user
* @param password
*
* @return { "success" : true } if authentication is valid
* @return { "success" : false } otherwise
*/
$app->get('/login', function (Request $request, Response $response) {
    /*Login success - set auth cookie*/
    include_once(__DIR__.'/../../admin/libraries/ampuser.class.php');
    session_start();
    if (!isset($_SESSION['AMP_user'])) {
        $_SESSION['AMP_user'] = new ampuser('admin');
    }
    return $response->withJson(['success' => true]);
});

$app->get('/logout', function (Request $request, Response $response) {
    session_start();
    unset($_SESSION['AMP_user']);
    return $response->withJson(['success' => true]);
});

$app->post('/testauth', function (Request $request, Response $response, $args) { 
    $params = $request->getParsedBody();
    $username = $params['username'];
    $password = $params['password'];

    if(!empty($username)) {
        // not logged in, and have provided a user/pass
        include_once(__DIR__.'/../../admin/libraries/ampuser.class.php');
        session_start();
        $_SESSION['AMP_user'] = new ampuser($username);
        if ($_SESSION['AMP_user']->checkPassword($password) && $_SESSION['AMP_user']->checkSection('*')) {
            unset($no_auth);
            require(__DIR__.'/../config.inc.php');
            $secret = $config['settings']['secretkey'];
            return $response->withJson(['result' => $secret], 200);
        }
    }
    unset($_SESSION['AMP_user']);
    $no_auth = true;
    return $response->withStatus(401);
});

