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
#
use \Psr\Http\Message\ServerRequestInterface as Request;
use \Psr\Http\Message\ResponseInterface as Response;

include_once('lib/libBulk.php');

/* GET /contexts - return all available contexts
Return: {"from-internal":"Standard","foo-bar":"Foo Bar"}
*/
$app->get('/contexts', function (Request $request, Response $response, $args) {
    require_once(__DIR__. '/../../admin/modules/customcontexts/functions.inc.php');
    $contexts = customcontexts_getcontexts();
    array_unshift($contexts , array('from-internal', 'Standard'));
    $results = array();
    foreach ($contexts as $c) {
        $results[$c[0]] = $c[1];
    }
    $results = (object) $results;
    if (!$results) {
        return $response->withStatus(500);
    }
    return $response->withJson($results,200);
});

$blkfunc = array('displayname',
    'profile',
    'callwaiting',
    'ringtime',
    'callgroup',
    'pickupgroup',
    'noanswerdest',
    'busydest',
    'notreachabledest'
);

/*GET /bulk/200,201,202,...  - return all available infos about selected extensions - empty if extensions has differents 
Return example: 
{
    "displayname":"Fooo Bar <%{EXTEN}>",
    "context":"from-internal",
    "callwaiting":true,
    "ringtime":"0",
    "callgroup":3,
    "pickupgroup",
    "noanswerdest":"",
    "busydest":"",
    "notreachabledest":""
}
*/
$app->get('/bulk/{mainextensions}', function (Request $request, Response $response, $args) {
    global $blkfunc;
    $route = $request->getAttribute('route');
    $mainextensions = explode(',',$route->getArgument('mainextensions'));
    $r = array();
    $blkfunc_get = $blkfunc;
    $blkfunc_get[] = 'outboundcid';
    foreach ($blkfunc_get as $action){
        $function = 'get_'.$action;
        unset($oldValue);
        foreach ($mainextensions as $mainextension) {
            $temp = $function($mainextension);
            if (!isset($oldValue)) {
                # first value
                $oldValue = $temp;
            } elseif ($oldValue !== $temp) {
                 # new value is different than old one, return null
                 $r[$action] = null;
                 unset($oldValue);
                 break;
            }
        }
        if (isset($oldValue)) {
            $r[$action] = $oldValue;
        }
    }
    return $response->withJson($r,200);
});

/*GET /destinations  - return FreePBX available destinations*/
$app->get('/destinations', function (Request $request, Response $response, $args) {
    include_once('/etc/freepbx.conf');
    include_once('/var/www/html/freepbx/admin/modules/announcement/functions.inc.php');
    include_once('/var/www/html/freepbx/admin/modules/daynight/functions.inc.php');
    include_once('/var/www/html/freepbx/admin/modules/queues/functions.inc.php');
    include_once('/var/www/html/freepbx/admin/modules/ringgroups/functions.inc.php');
    include_once('/var/www/html/freepbx/admin/modules/timeconditions/functions.inc.php');
    include_once('/var/www/html/freepbx/admin/modules/voicemail/functions.inc.php');
    $destinations = drawselects('app-blackhole,hangup,1','unavailable_destination',false,false,'',false,true,true);
    return $response->withJson($destinations,200);
});

/* POST /bulk/200,201,202,... 
data: '{
    "displayname":"Fooo Bar <%{EXTEN}>",
    "context":"from-internal",
    "callwaiting":true,
    "ringtime":"0",
    "callgroup":3,
    "pickupgroup":4,
    "noanswerdest":null,
    "busydest":null,
    "notreachabledest":null
}'
*/
$app->post('/bulk/{mainextensions}', function (Request $request, Response $response, $args) {
    try {
        global $blkfunc;
        $dbh = FreePBX::Database();
        $route = $request->getAttribute('route');
        $mainextensions = explode(',',$route->getArgument('mainextensions'));
        $params = $request->getParsedBody();
        $status = true;
        foreach ($params as $action => $data) {
            if (in_array($action,$blkfunc)) {
                $function = 'post_'.$action;
                $res = $function($mainextensions,$data);
                if ($res !== true) {
                    $err .= $res."\n";
                }
            }
        }
        //outboundcid
        if (isset($params['outboundcid_fixed']) && !is_null($params['outboundcid_fixed'])) {
            if (!isset($params['outboundcid_variable']) || $params['outboundcid_variable'] == 0 || $params['outboundcid_variable'] == '') {
                post_outboundcid($mainextensions,$params['outboundcid_fixed']);
            } else {
                foreach ($mainextensions as $mainextension) {
                     post_outboundcid(array($mainextension), $params['outboundcid_fixed'].substr($mainextension,-$params['outboundcid_variable']));
                }
            }
        }
        system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
        if (isset($err)) {
            throw new Exception($err);
        }
        return $response->withJson(array('status' => true), 200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withJson(array("status"=>$e->getMessage()), 500);
    }
});

