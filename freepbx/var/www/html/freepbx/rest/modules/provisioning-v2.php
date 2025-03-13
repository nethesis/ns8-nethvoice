<?php
#
# Copyright (C) 2019 Nethesis S.r.l.
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
#

require_once '/var/www/html/freepbx/rest/vendor/autoload.php';

define('REBOOT_HELPER_SCRIPT','/var/www/html/freepbx/rest/lib/phonesRebootHelper.php');
define("JSON_FLAGS",JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);

use \Psr\Http\Message\ServerRequestInterface as Request;
use \Psr\Http\Message\ResponseInterface as Response;

include_once 'lib/CronHelper.php';
include_once 'lib/libExtensions.php';
include_once 'lib/libCTI.php';

//$app = new \Slim\App;
$container = $app->getContainer();
$container['cron'] = function ($container) {
    return new CronHelper();
};

/**
 * Endpoint to reconfigure a phone extension.
 *
 * This endpoint accepts a POST request to reconfigure a phone extension by sending a PJSIP notify command.
 *
 * @param Request $request The HTTP request object.
 * @param Response $response The HTTP response object.
 * @param array $args The route's arguments.
 *
 * @return Response The HTTP response with status 200 on success, or 500 on failure.
 *
 * @throws Exception If there is an error reconfiguring the extension.
 */
$app->post('/phones/reconfigure', function (Request $request, Response $response, $args) {
	try {
		global $astman;
		$extension = $request->getParsedBody()['extension'];
		$res = $astman->send_request('Command',array('Command'=>"pjsip send notify generic-reload endpoint $extension"));
		if ($res['Response'] !== 'Success' || preg_match('/failed.$/m', $res['data']) || preg_match('/^Unable/m', $res['data'])) {
			throw new Exception('Error reconfiguring extension '.$extension.': '.$res['data']);
		}
	} catch (Exception $e) {
		return $response->withStatus(500);
	}
	return $response->withStatus(200);
});

$app->post('/phones/rps/{mac}', function (Request $request, Response $response, $args) {
    $body = $request->getParsedBody();
    if(!$body['url']) {
        return $response->withStatus(400);
    }
    $result = setFalconieriRPS($args['mac'], $body['url']);
    return $response->withStatus($result['httpCode']);
});

$app->get('/phones/account/{mac}', function (Request $request, Response $response, $args) {
    $dbh = FreePBX::Database();
    $stmt = $dbh->prepare('SELECT `extension`,`secret` FROM `rest_devices_phones` WHERE `mac` = ?');
    $stmt->execute(array(str_replace('-',':',$args['mac'])));
    $res = $stmt->fetch(\PDO::FETCH_ASSOC);
    return $response->withJson((object) $res , 200, JSON_FLAGS);
});

$app->get('/provisioning/engine', function (Request $request, Response $response, $args) {
    return $response->withJson(getProvisioningEngine(), 200, JSON_FLAGS);
});

$app->get('/phones/state', function (Request $request, Response $response, $args) {
    global $astman;
    $res = array();
    foreach (FreePBX::Core()->getAllUsersByDeviceType() as $extension) {
        $ext = $extension['extension'];
        $state = $astman->ExtensionState($ext,'');
        $res[$ext] = $state;
    }
    return $response->withJson($res, 200, JSON_FLAGS);
});

$app->get('/extensions/{extension}/srtp', function (Request $request, Response $response, $args) {
    $dbh = FreePBX::Database();
    $sql = 'SELECT srtp FROM rest_devices_phones WHERE extension = ?';
    $stmt = $dbh->prepare($sql);
    $stmt->execute(array($args['extension']));
    $res = $stmt->fetch(\PDO::FETCH_ASSOC);
    if ($res['srtp'] == '1') {
        return $response->withJson(TRUE, 200, JSON_FLAGS);
    }
    return $response->withJson(FALSE, 200, JSON_FLAGS);
});

$app->post('/extensions/{extension}/srtp/{enabled}', function (Request $request, Response $response, $args) {
    $media_encryption = ($args['enabled'] == 'true') ? 1 : 0;
    $dbh = FreePBX::Database();
    $sql = 'UPDATE rest_devices_phones SET srtp = ? WHERE extension = ?';
    $stmt = $dbh->prepare($sql);
    $stmt->execute(array($media_encryption,$args['extension']));
    return $response->withStatus(200);
});

$app->post('/provisioning/connectivitycheck', function (Request $request, Response $response, $args) {
    // TODO remove
    return $response->withJson(["valid_certificate"=>TRUE,"host_type"=>"FQDN","is_reachable"=>TRUE],200);
});

function getFeaturcodes(){
    $dbh = FreePBX::Database();
    $sql = 'SELECT modulename,featurename,defaultcode,customcode FROM featurecodes';
    $stmt = $dbh->prepare($sql);
    $stmt->execute(array());
    $res = $stmt->fetchAll(\PDO::FETCH_ASSOC);
    $featurecodes = array();
    foreach ($res as $featurecode) {
        $featurecodes[$featurecode['modulename'].$featurecode['featurename']] = (!empty($featurecode['customcode'])?$featurecode['customcode']:$featurecode['defaultcode']);
    }
    return $featurecodes;
}

