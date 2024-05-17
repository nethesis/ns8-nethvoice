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

require_once(__DIR__. '/../../admin/modules/core/functions.inc.php');

/**
 * @api {get} /inboundroutes/count  Retrieve inbound routes (incoming) count
 */
$app->get('/inboundroutes/count', function (Request $request, Response $response, $args) {
    try {
      $routes = FreePBX::Core()->getAllDIDs('extension');
      $destinations = FreePBX::Modules()->getDestinations();
    } catch (Exception $e) {
      error_log($e->getMessage());
      return $response->withJson('An error occurred', 500);
    }

    return $response->withJson(count($routes), 200);
});

/**
 * @api {get} /inboundroutes  Retrieve inbound routes (incoming)
 */
$app->get('/inboundroutes', function (Request $request, Response $response, $args) {
    try {
      $routes = FreePBX::Core()->getAllDIDs('extension');
      $destinations = FreePBX::Modules()->getDestinations();
    } catch (Exception $e) {
      error_log($e->getMessage());
      return $response->withJson('An error occurred', 500);
    }

    return $response->withJson(array("destinations" => $destinations, "routes" => $routes), 200);
});

/**
 * @api {post} /inboundroutes  Create an inbound routes (incoming)
 */
$app->post('/inboundroutes', function (Request $request, Response $response, $args) {
    $params = $request->getParsedBody();

    try {
      $res = FreePBX::Core()->addDID($params);
    } catch (Exception $e) {
      error_log($e->getMessage());
      return $response->withJson('An error occurred', 500);
    }

    system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
    return $response->withStatus(200);
});

/**
 * @api {post} /inboundroutes/delete Delete an inbound route
 */
$app->post('/inboundroutes/delete', function (Request $request, Response $response, $args) {
  $params = $request->getParsedBody();
  $extension = $params['extension'];
  $cidnum = $params['cid'];

  try {
    $res = FreePBX::Core()->getDID($extension, $cidnum ? $cidnum : '');

    if ($res === false)
      return $response->withStatus(404);

    FreePBX::Core()->delDID($extension, $cidnum ? $cidnum : '');
  } catch (Exception $e) {
    error_log($e->getMessage());
    return $response->withJson('An error occurred', 500);
  }

  system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
  return $response;
});

/**
 * @api {get} /outboundroutes/count  Retrieve inbound routes (incoming) count
 */
$app->get('/outboundroutes/count', function (Request $request, Response $response, $args) {
    try {
      $routes = FreePBX::Core()->getAllRoutes();
    } catch (Exception $e) {
      error_log($e->getMessage());
      return $response->withJson('An error occurred', 500);
    }

    return $response->withJson(count($routes), 200);
});

/**
 * @api {get} /outboundroutes  Retrieve outbound routes.
 */
 $app->get('/outboundroutes', function (Request $request, Response $response, $args) {
     $routes = [];
     try {
       $allRoutes = FreePBX::Core()->getAllRoutes();
       foreach($allRoutes as $route) {
           $routing = new \FreePBX\modules\Core\Components\Outboundrouting();
	   $route_trunks = $routing->getRouteTrunksById($route['route_id']);
           $route['trunks'] = [];
           foreach($route_trunks as $trunkID) {
               $trunk = core_trunks_getDetails($trunkID);
               $route['trunks'][] = array("trunkid" => $trunkID, "name" => $trunk['name']);
           }
           $routes[] = $route;
       }
     } catch (Exception $e) {
       error_log($e->getMessage());
       return $response->withJson('An error occurred', 500);
     }
     return $response->withJson($routes, 200);
 });

/**
 * @api {get} /outboundroutes/defaults Retrieves defaults outbound routes
 */
 $app->get('/outboundroutes/defaults', function (Request $request, Response $response, $args) {
     try {
        $dbh = FreePBX::Database();
        $sql = "SELECT DISTINCT `locale` FROM `outbound_routes_locales`";
        $locales = $dbh->sql($sql,"getAll",\PDO::FETCH_ASSOC);
        $sql = "SELECT DISTINCT `key` FROM `outbound_routes_locales`";
        $keys = $dbh->sql($sql,"getAll",\PDO::FETCH_ASSOC);

        $trunks = array();
        $alltrunks = FreePBX::Core()->listTrunks();
        foreach($alltrunks as $tr) {
            // this is the dahdi trunk automatically created by freepbx on the first time. So it is not added
            if ($tr["name"] == "DAHDI/g0" && $tr["trunkid"] == "1" && $tr["tech"] == "dahdi" && $tr["channelid"] == "g0") {
                continue;
            }
            array_push($trunks, array("name" => $tr["name"], "trunkid" => $tr["trunkid"]));
        }

        $res = array();
        foreach($locales as $locale) {
            if (!array_key_exists($locale["locale"], $res)) {
                $res[$locale["locale"]] = array();
            }
            foreach($keys as $key) {
                array_push($res[$locale["locale"]], array(
                        "name" => $key["key"]."_".$locale["locale"],
                        "trunks" => $trunks
                    )
                );
            }
        }
        return $response->withJson($res,200);

     } catch (Exception $e) {
       error_log($e->getMessage());
       return $response->withJson('An error occurred', 500);
     }
 });

 /**
 * @api {post} /outboundroutes Creates outbound routes. If the routes passed as argument have not the "route_id", then
 *                             default outbound route will be created into the FreePBX db tables. Otherwise it updates
 *                             the sequences of routes and their trunks.
 */
 $app->post('/outboundroutes', function (Request $request, Response $response, $args) {
    try {
        $params = $request->getParsedBody();
        reset($params);
        $locale = key($params);

        // check if the routes are present into the freepbx db
        $route_keys = array_keys($params[$locale][0]);
        $created = false;
        foreach($route_keys as $key) {
            if ($key == "route_id") {
                $created = true;
            }
        }

        $routing = new \FreePBX\modules\Core\Components\Outboundrouting();
        if ($created) {
            // update data into the freepbx db tables
            foreach($params[$locale] as $index => $route) {
                $trunks = array();
                foreach($route["trunks"] as $tr) {
                    array_push($trunks, $tr["trunkid"]);
		}
		$routing->setOrder($route["route_id"], strval($index));
		$routing->updateTrunks($route["route_id"], $trunks, true);
            }
        } else {
            // initialize data into the freepbx db tables using data of table "outbound_routes_locales"
            $dbh = FreePBX::Database();
            $sql = "SELECT * FROM `outbound_routes_locales` where locale=\"$locale\"";
            $dblocales = $dbh->sql($sql,"getAll",\PDO::FETCH_ASSOC);

            foreach($params[$locale] as $route) {

                $trunks = array();
                foreach($route["trunks"] as $tr) {
                    array_push($trunks, $tr["trunkid"]);
                }

                $patterns = array();
                foreach($dblocales as $dbloc) {
                    if ($dbloc["locale"] == $locale && $route["name"] == $dbloc["key"]."_".$locale) {
                        array_push($patterns, array(
                            "match_pattern_prefix" => $dbloc["prefix_value"],
                            "match_pattern_pass" => $dbloc["pattern_value"],
                            "match_cid" => "",
                            "prepend_digits" => ""
                        ));
                    }
                }
                $routing->add(
                    $route["name"], // name
                    "", // outcid
                    "", // outcid_mode
                    "", //password
                    "", // emergency_mode
                    "", // intracompany_route
                    "default", // mohclass
                    NULL, //time_group_id
                    $patterns, // array of patterns
                    $trunks, // array of trunks id
                    "new", // seq
                    "" // dest
                );
            }
        }
        system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
        return $response->withStatus(200);
    } catch (Exception $e) {
      error_log($e->getMessage());
      return $response->withJson('An error occurred', 500);
    }
});

 /**
  * @api {delete} /outboundroutes/:id Removes the association between the outbound route and the trunk
  */
 $app->delete('/outboundroutes/{route_id}/trunks/{id}', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $trunk_id = $route->getArgument('id');
        $route_id = $route->getArgument('route_id');
        $sql = "DELETE FROM `outbound_route_trunks` WHERE `route_id`=\"$route_id\" AND `trunk_id`=\"$trunk_id\"";
        $sth = FreePBX::Database()->prepare($sql);
        $res = $sth->execute();
   } catch (Exception $e) {
     error_log($e->getMessage());
     return $response->withJson('An error occurred', 500);
   }

   system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
   return $response;
 });

/**
* @api {get} /outboundroutes/supportedLocales
*/
$app->get('/outboundroutes/supportedLocales', function (Request $request, Response $response, $args) {
    try{
        $dbh = FreePBX::Database();
        $sql = "SELECT DISTINCT `locale` FROM `outbound_routes_locales`";
        $res = $dbh->sql($sql,"getAll",\PDO::FETCH_NUM);
        foreach ($res as $lang){
            $langs[]=$lang[0];
        }
        return $response->withJson(array_values($langs),200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withJson('An error occurred', 500);
    }
});

