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

require_once(__DIR__. '/../lib/freepbxFwConsole.php');

use \Psr\Http\Message\ServerRequestInterface as Request;
use \Psr\Http\Message\ResponseInterface as Response;

/**
 * @api {get} /trunks/count  Retrieve count of all trunks
 */
$app->get('/trunks/count', function (Request $request, Response $response, $args) {
    try {
        $result = array();
        $trunks = FreePBX::Core()->listTrunks();
        foreach($trunks as $trunk) {
            array_push($result, $trunk);
        }
        return $response->withJson(count($result),200);
    }
    catch (Exception $e) {
      error_log($e->getMessage());
      return $response->withJson('An error occurred', 500);
    }
});

/**
 * @api {get} /trunks  Retrieve all trunks
 */
$app->get('/trunks', function (Request $request, Response $response, $args) {
    try {
        $result = array();
        $trunks = FreePBX::Core()->listTrunks();
        foreach($trunks as $trunk) {
            // Get trunk username
            $details = FreePBX::Core()->getTrunkDetails($trunk['trunkid']);
            $trunk['username'] = $details['username'];
            array_push($result, $trunk);
        }
        return $response->withJson($result,200);
    }
    catch (Exception $e) {
      error_log($e->getMessage());
      return $response->withJson('An error occurred', 500);
    }
});

/**
 * @api {get} /trunks/{tech}  Retrieve all trunks by technology
 */
$app->get('/trunks/{tech}', function (Request $request, Response $response, $args) {
    try {
        $result = array();
        $trunks = FreePBX::Core()->listTrunks();
        $tech = $request->getAttribute('tech');
        $tech = strtolower($tech);

        foreach($trunks as $trunk) {
            if (strtolower($trunk['tech']) == $tech) {
                // Get trunk username
                $details = FreePBX::Core()->getTrunkDetails($trunk['trunkid']);
                $trunk['username'] = $details['username'];
                array_push($result, $trunk);
            }
        }
        return $response->withJson($result,200);
    }
    catch (Exception $e) {
      error_log($e->getMessage());
      return $response->withJson('An error occurred', 500);
    }
});

/**
 * @api {delete} /trunks/{trunkid} Delete a trunk
 */
$app->delete('/trunks/{trunkid}', function (Request $request, Response $response, $args) {
  $route = $request->getAttribute('route');
  $trunkid = $route->getArgument('trunkid');
  try {
    FreePBX::Core()->deleteTrunk($trunkid);
    system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
    return $response->withStatus(200);
  } catch (Exception $e) {
    error_log($e->getMessage());
    return $response->withStatus(500);
  }
});

/**
 * @api {patch} /trunks/{trunkid} Change trunk parameters
 * parameters:
 * {
 *    "username":"foobar",		# Trunk username
 *    "password":"53cr37",		# Trunk secret
 *    "phone":"0123456789",		# Phone number
 *    "codecs":["ulaw","g729"],		# Favourite codecs
 *    "forceCodec":true			# Boolean, if true allows only favourite codecs
 * }
 */
$app->patch('/trunks/{trunkid}', function (Request $request, Response $response, $args) {
    try {
        $params = $request->getParsedBody();
        $route = $request->getAttribute('route');
        $trunkid = $route->getArgument('trunkid');

        if (empty($trunkid)) {
            error_log("missing argument $trunkid");
            return $response->withJson(['error'=>"missing argument $trunkid"],400);
        }

        // Make sure that trunk to patch is a pjsip trunk
        $dbh = FreePBX::Database();
        $sql = 'SELECT COUNT(*) AS n FROM `trunks` WHERE `trunkid` = ? AND `tech` = "pjsip"';
        $sth = $dbh->prepare($sql);
        $res = $sth->execute([$trunkid]);
        $n = $sth->fetchAll(\PDO::FETCH_ASSOC)[0]['n'];
        if (!$res || $n != 1) {
            throw new Exception("Can't patch trunk $trunkid");
        }

        // Change username
        if (isset($params['username'])) {
            $sql = 'UPDATE `pjsip` SET `data` = ? WHERE `id` = ? AND `keyword` = ?';
            $sth = $dbh->prepare($sql);
            $res = $sth->execute([$params['username'],$trunkid,'username']);
            if (!$res) {
                throw new Exception("Error updating username for $trunkid");
            }
        }

        // Change seccret
        if (isset($params['password'])) {
            $sql = 'UPDATE `pjsip` SET `data` = ? WHERE `id` = ? AND `keyword` = ?';
            $sth = $dbh->prepare($sql);
            $res = $sth->execute([$params['password'],$trunkid,'secret']);
            if (!$res) {
                throw new Exception("Error updating secret for $trunkid");
            }
        }

        // Set Outbound CallerID
        if (isset($params['phone'])) {
            $sql = 'UPDATE `pjsip` SET `data` = ? WHERE `id` = ? AND ( `keyword` = ? OR `keyword` = ? )';
            $sth = $dbh->prepare($sql);
            $res = $sth->execute([$params['phone'],$trunkid,'contact_user','from_user']);
            if (!$res) {
                throw new Exception("Error updating contact_user and from_user for $trunkid");
            }
            $sql = 'UPDATE `trunks` SET `outcid` = ? WHERE `trunkid` = ?';
            $sth = $dbh->prepare($sql);
            $res = $sth->execute([$params['phone'],$trunkid]);
            if (!$res) {
                throw new Exception("Error updating outcid for trunk $trunkid");
            }
        }

        // Set codecs
        if (!isset($params['forceCodec']) && !$params['forceCodec'] && isset($params['codecs'])) {
            // Get default codecs
            $sql = 'SELECT `data` FROM `rest_pjsip_trunks_defaults` WHERE `keyword` = "codecs" AND `provider_id` IN ( SELECT `provider_id` FROM `rest_pjsip_trunks_defaults` WHERE `keyword` = "sip_server" AND `data` IN ( SELECT `data` FROM `pjsip` WHERE `keyword` = "sip_server" AND `id` = 2))';
            $sth = $dbh->prepare($sql);
            $res = $sth->execute([$trunkid]);
            if (!$res) {
                throw new Exception('Error getting default codecs for privider');
            }
            $default_codecs = $sth->fetchAll(\PDO::FETCH_ASSOC)[0]['data'];
            $newcodecs = implode(',',array_unique(array_merge($params['codecs'],explode(',',$default_codecs))));
        } elseif (isset($params['forceCodec']) && $params['forceCodec'] && isset($params['codecs'])) {
            $newcodecs = implode(',',$params['codecs']);
        }
        if (!empty($newcodecs)) {
            $sql = 'UPDATE `pjsip` SET `data` = ? WHERE `id` = ? AND `keyword` = "codecs"';
            $sth = $dbh->prepare($sql);
            $res = $sth->execute([$newcodecs,$trunkid]);
            if (!$res) {
                throw new Exception('Error updating codecs');
            }
        }
        system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
        return $response->withStatus(204);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withJson(['error'=>$e->getMessage()],500);
    }
});

/**
 * @api {post} /trunks Create a new trunks
 * parameters:
 * {
 *    "provider":"vivavox",		# provider name
 *    "name":"trunk name",		# User defined trunk name
 *    "username":"foobar",		# Trunk username
 *    "password":"53cr37",		# Trunk secret
 *    "phone":"0123456789",		# Phone number
 *    "codecs":["ulaw","g729"],		# Favourite codecs
 *    "forceCodec":true			# Boolean, if true allows only favourite codecs
 * }
 */
$app->post('/trunks', function (Request $request, Response $response, $args) {
  $params = $request->getParsedBody();
    $params['provider'];
    $params['name'];
    $params['username'];
    $params['password'];
    $params['phone'];
    $params['codecs'];

    foreach (['provider','username','password','phone','codecs','forceCodec'] as $p) {
        if (!isset($params[$p])) {
            error_log("missing parameter $p");
            return $response->withStatus(400);
        }
    }

    $dbh = FreePBX::Database();

    // Get trunk id
    $sql = 'SELECT trunkid FROM trunks';
    $sth = $dbh->prepare($sql);
    $sth->execute();
    $trunkid = 1;
    while ($res = $sth->fetchColumn()) {
        if ($res > $trunkid) {
            break;
        }
        $trunkid++;
    }
    if ($res == $trunkid) {
        $trunkid++;
    }

    // Insert data into trunks table
    $params['name'] = (empty($params['name'])) ? $params['provider'] : $params['name'];
    $sql = "INSERT INTO `trunks` (`trunkid`,`tech`,`channelid`,`name`,`outcid`,`keepcid`,`maxchans`,`failscript`,`dialoutprefix`,`usercontext`,`provider`,`disabled`,`continue`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)";
    $sth = $dbh->prepare($sql);
    $sth->execute(array(
        $trunkid,
        'pjsip',
        $params['name'],
        $params['name'],
        $params['phone'],
        'off',
        '',
        '',
        '',
        '',
        '',
        'off',
        'off'
    ));

    // Insert data into pjsip table
    // Get static provider data
    $sql = 'SELECT `keyword`,`data` FROM `rest_pjsip_trunks_defaults` WHERE `provider_id` IN (SELECT `id` FROM `rest_pjsip_providers` WHERE `provider` = ?)';
    $sth = $dbh->prepare($sql);
    $sth->execute([$params['provider']]);
    $pjsip_data = $sth->fetchAll(\PDO::FETCH_ASSOC);

    // Add dynamic data
    $pjsip_data[] = array( "keyword" => "contact_user", "data" => $params['username']);
    $pjsip_data[] = array( "keyword" => "extdisplay", "data" => "OUT_".$trunkid);
    $pjsip_data[] = array( "keyword" => "from_user", "data" => $params['username']);
    $pjsip_data[] = array( "keyword" => "sv_channelid", "data" => $params['name']);
    $pjsip_data[] = array( "keyword" => "sv_trunk_name", "data" => $params['name']);
    $pjsip_data[] = array( "keyword" => "trunk_name", "data" => $params['name']);
    $pjsip_data[] = array( "keyword" => "username", "data" => $params['username']);
    $pjsip_data[] = array( "keyword" => "secret", "data" => $params['password']);

    // Set codecs
    if (!empty($params['codecs'])) {
        foreach ($pjsip_data as $index => $data) {
            if ($data['keyword'] !== "codecs") {
                continue;
            } else {
                $default_codecs = $data;
                unset($pjsip_data[$index]);
            }
        }
        if ($params['forceCodec']) {
            $pjsip_data[] = array( "keyword" => "codecs", "data" => implode(',',$params['codecs']));
        } else {
            $pjsip_data[] = array( "keyword" => "codecs", "data" => implode(',',array_unique(array_merge($params['codecs'],explode(',',$default_codecs)))));
        }
    }

    // Add special pjsip options
    $sql = 'SELECT `keyword`,`data` FROM `rest_pjsip_trunks_specialopts` WHERE `provider_id` IN (SELECT `id` FROM `rest_pjsip_providers` WHERE `provider` = ?)';
    $sth = $dbh->prepare($sql);
    $sth->execute([$params['provider']]);
    $dynamic_data = $sth->fetchAll(\PDO::FETCH_ASSOC);
    foreach ($dynamic_data as $d) {
        // delete parameter in $pjsip_data
        foreach ($pjsip_data as $index => $s) {
            if ($s["keyword"] === $d["keyword"]) {
                unset($pjsip_data[$index]);
            }
        }
        // use replaced string as data
        $data = $d["data"];
        $data = str_replace('$PHONE',$params['phone'],$data);
        $data = str_replace('$USERNAME',$params['username'],$data);
        $pjsip_data[] = array( "keyword" => $d["keyword"], "data" => $data);
    }

    $insert_data = array();
    $insert_qm = array();
    foreach ($pjsip_data as $data) {
        $insert_data = array_merge($insert_data,[$trunkid,$data['keyword'],$data['data'],0]);
        $insert_qm[] = '(?,?,?,?)';
    }
    $sql = 'INSERT INTO `pjsip` (`id`,`keyword`,`data`,`flags`) VALUES '.implode(',',$insert_qm);
    $sth = $dbh->prepare($sql);
    $res = $sth->execute($insert_data);
    if (!$res) {
        return $response->withStatus(500);
    }
    system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
    return $response->withStatus(200);
});
