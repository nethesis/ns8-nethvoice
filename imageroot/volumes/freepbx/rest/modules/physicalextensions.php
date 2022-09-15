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

require_once(__DIR__. '/../../admin/modules/endpointman/includes/functions.inc');
require_once(__DIR__. '/../lib/freepbxFwConsole.php');

use \Psr\Http\Message\ServerRequestInterface as Request;
use \Psr\Http\Message\ResponseInterface as Response;

include_once('lib/libExtensions.php');

$app->get('/physicalextensions', function (Request $request, Response $response, $args) {
    $physicalextensions = FreePBX::create()->Core->getAllUsersByDeviceType('pjsip');
    return $response->withJson($physicalextensions, 200);
});

$app->get('/physicalextensions/{extension}', function (Request $request, Response $response, $args) {
    $route = $request->getAttribute('route');
    $extension = $route->getArgument('extension');
    $physicalextensions = FreePBX::create()->Core->getAllUsersByDeviceType('pjsip');
    foreach ($physicalextensions as $e) {
        if ($e['extension'] == $extension) {
            return $response->withJson($e, 200);
        }
    }
    return $response->withStatus(404);
});

$app->post('/physicalextensions', function (Request $request, Response $response, $args) {
    try {
        $params = $request->getParsedBody();
        $mac = str_replace('-',':',$params['mac']);
        $model = $params['model'];
        $web_user = $params['web_user'];
        $web_password = $params['web_password'];
        $line = $params['line'];
        $line = $params['line'];
        $clear_temporary = $params['clear_temporary'];

        $delete = false;
        if (isset($clear_temporary)) {
            $delete = true;
        }

        if (empty($params['mainextension'])) {
            $vendors = json_decode(file_get_contents(__DIR__. '/../lib/macAddressMap.json'), true);
            $vendor = $vendors[substr($mac,0,8)];
            if (!empty($mac) && addPhone($mac, $vendor, $model)) {
                return $response->withStatus(200);
            } else {
                return $response->withJson(array("status"=>"Error adding phone"), 500);
            }
        }

        $extension = createExtension($params['mainextension'],$delete);
        if ($extension === false ) {
            return $response->withJson(array("status"=>"Error creating extension"), 500);
        }

        if (!empty($mac) && !empty($model)) {
            if ($model === 'GS Wave') {
                if (useExtensionAsGSWaveApp($extension,$mac,$model) === false) {
                    return $response->withJson(array("status"=>"Error associating app extension"), 500);
                }
            } else {
                if (useExtensionAsPhysical($extension,$mac,$model,$line,$web_user,$web_password) === false) {
                    return $response->withJson(array("status"=>"Error associating physical extension"), 500);
                }
            }
        } else {
            if (!empty($mac) && getProvisioningEngine() === 'tancredi') {
                if (useExtensionAsPhysical($extension,$mac,$model,$line) === false) {
                    return $response->withJson(array("status"=>"Error associating physical extension without model"), 500);
                }
            } elseif (useExtensionAsCustomPhysical($extension,false,'physical',$web_user,$web_password) === false) {
                return $response->withJson(array("status"=>"Error creating custom extension"), 500);
            }
        }
        system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
        return $response->withJson(array('extension' => $extension), 200);
   } catch (Exception $e) {
       error_log($e->getMessage());
       return $response->withJson(array("status"=>$e->getMessage()), 500);
   }
});

$app->delete('/physicalextensions/{id}', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $id = $route->getArgument('id');
        $extension = $id;
        if (preg_match('/[A-F0-9]{2}-[A-F0-9]{2}-[A-F0-9]{2}-[A-F0-9]{2}-[A-F0-9]{2}-[A-F0-9]{2}/', $id) === 1) {
            // $id provided is a mac address, get extension from rest_devices_phone
            $dbh = FreePBX::Database();
            $id = str_replace('-',':',$id);
            $sql = 'SELECT `extension` FROM `rest_devices_phones` WHERE `mac` = ? LIMIT 1';
            $stmt = $dbh->prepare($sql);
            $stmt->execute(array($id));
	    $res = $stmt->fetchAll(\PDO::FETCH_ASSOC)[0]['extension'];
	    $sql = 'DELETE FROM `rest_devices_phones` WHERE `mac` = ?';
	    $stmt = $dbh->prepare($sql);
	    $stmt->execute(array($id));
            if (is_null($res)) {
                system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
                return $response->withStatus(200);
            } else {
                $extension = $res;
            }
        }
        if (deletePhysicalExtension($extension) && deleteExtension($extension)) {
            system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
            return $response->withStatus(200);
        } else {
            throw new Exception("Error deleting extension");
        }
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

$app->post('/physicalextensions/adminpw', function (Request $request, Response $response, $args) {
    $params = $request->getParsedBody();
    $adminpw = $params['password'];
    $dbh = FreePBX::Database();
    $sql = 'UPDATE rest_devices_phones SET web_user = "admin", web_password = ? WHERE type = "physical" AND mac IS NOT NULL';
    $stmt = $dbh->prepare($sql);
    $stmt->execute(array($adminpw));
    system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
    return $response->withStatus(200);
});

$app->patch('/physicalextensions/{mac}', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $params = $request->getParsedBody();
        $mac = $route->getArgument('mac');
        $model = $params['model'];

        if (preg_match('/[A-F0-9]{2}-[A-F0-9]{2}-[A-F0-9]{2}-[A-F0-9]{2}-[A-F0-9]{2}-[A-F0-9]{2}/', $mac) !== 1) {
            return $response->withJson(array("status"=>"Invalid MAC address"), 500);
        }

        if (empty($model)) {
            $model = NULL;
        }

        $mac = str_replace('-',':',$mac);
        $dbh = FreePBX::Database();
        $sql = 'UPDATE `rest_devices_phones` SET `model` = ? WHERE `mac` = ?';
        $stmt = $dbh->prepare($sql);
        $stmt->execute(array($model, $mac));
        return $response->withStatus(200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withJson(array("status"=>$e->getMessage()), 500);
    }
});

$app->post('/mobileapp', function (Request $request, Response $response, $args) {
    try {
        $params = $request->getParsedBody();
        $mainextension = $params['mainextension'];
        $fpbx = FreePBX::create();

        $extension = createExtension($mainextension,false);

        if ($extension === false ) {
            return $response->withJson(array("status"=>"Error creating extension"), 500);
        }

        if (useExtensionAsMobileApp($extension) === false) {
            return $response->withJson(array("status"=>"Error associating mobile app extension"), 500);
        }

        system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
        return $response->withJson(array('extension'=>$extension), 201);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

$app->get('/mobileapp/{mainextension}', function (Request $request, Response $response, $args) {
    $route = $request->getAttribute('route');
    $mainextension = $route->getArgument('mainextension');

    $extension = getMobileAppExtension($mainextension);
    if (!empty($extension)) {
        return $response->withJson($extension, 200);
    } else {
        return $response->withStatus(404);
    }
});

$app->delete('/mobileapp/{extension}', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $extension = $route->getArgument('extension');
        if (deleteExtension($extension)) {
            system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
            return $response->withStatus(204);
        } else {
            throw new Exception ("Error deleting extension");
        }
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});
