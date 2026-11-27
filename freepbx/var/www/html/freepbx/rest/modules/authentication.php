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

require_once __DIR__ . '/../lib/libDomainAdmins.php';

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
    @session_regenerate_id(true);
    return jsonResponse($response, ['success' => true]);
});

$app->get('/logout', function (Request $request, Response $response) {
    session_start();
    unset($_SESSION['AMP_user']);
    domainAdminsDefault()->signOut((string) $request->getAttribute(NETHVOICE_USERNAME_ATTRIBUTE, ''));
    return jsonResponse($response, ['success' => true]);
});

$app->post('/testauth', function (Request $request, Response $response, $args) { 
    $params = $request->getParsedBody();
    $username = $params['username'];
    $password = $params['password'];

    if(!empty($username)) {
        if (!is_string($username)) {
            return $response->withStatus(401);
        }
        $throttle = domainAdminsSignInThrottle();
        if (!$throttle->available()) {
            return jsonResponse($response, ['code' => 'throttle_unavailable', 'message' => DOMAIN_ADMINS_SIGNIN_MESSAGES['throttle_unavailable']], 503);
        }
        $address = domainAdminsClientAddress($request);
        $account = domainAdminsAccountKey(FreePBX::Database(), $username);
        $retry = $throttle->retryAfter($address, $account);
        if ($retry !== null) {
            return jsonResponse($response->withHeader('Retry-After', (string) $retry), ['code' => 'too_many_attempts', 'message' => DOMAIN_ADMINS_SIGNIN_MESSAGES['too_many_attempts']], 429);
        }
        // not logged in, and have provided a user/pass
        include_once(__DIR__.'/../../admin/libraries/ampuser.class.php');
        session_start();
        $_SESSION['AMP_user'] = new ampuser($username);
        if ($_SESSION['AMP_user']->checkPassword($password) && ($_SESSION['AMP_user']->checkSection('*') || nethvoiceParseSections($_SESSION['AMP_user']->getSections()))) {
            $throttle->succeed($address, $account);
            if (!$_SESSION['AMP_user']->checkSection('*') && !nethvoiceKeepsFreepbxSession($_SESSION['AMP_user']->getSections())) {
                unset($_SESSION['AMP_user']);
                return $response->withStatus(401);
            }
            @session_regenerate_id(true);
            unset($no_auth);
            require(__DIR__.'/../config.inc.php');
            $secret = $config['settings']['secretkey'];
            return jsonResponse($response, ['result' => $secret], 200);
        }
        $throttle->fail($address, $account);
    }
    unset($_SESSION['AMP_user']);
    $no_auth = true;
    return $response->withStatus(401);
});

$app->get('/me', function (Request $request, Response $response) {
    return jsonResponse($response, [
        'username' => $request->getAttribute(NETHVOICE_USERNAME_ATTRIBUTE),
        'permissions' => $request->getAttribute(NETHVOICE_PERMISSIONS_ATTRIBUTE),
    ]);
});
