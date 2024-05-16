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

require_once(__DIR__. '/../lib/modelRetrieve.php');
require_once(__DIR__. '/../../admin/modules/core/functions.inc.php');
include_once(__DIR__. '/../lib/gateway/functions.inc.php');
include_once(__DIR__. '/../lib/libExtensions.php');

/*
*  Launch a scan: POST/devices/scan
*  Parameter: { "network": "192.168.0.0/24"}
*/

$app->post('/devices/scan', function (Request $request, Response $response, $args) {
	// TODO
	return $response->withStatus(500);
});

$app->get('/devices/{mac}/brand', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $mac = $route->getArgument('mac');
        $brand = json_decode(file_get_contents(__DIR__. '/../lib/macAddressMap.json'), true);
        return $response->withJson($brand[$mac], 200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

$app->get('/devices/phones/list/{id}', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $id = $route->getArgument('id');
        $basedir='/var/run/nethvoice';
        $res=array();
        $filename = "$basedir/$id.phones.scan";
        if (!file_exists($filename)) {
            return $response->withJson(array("status"=>"Scan for network $id doesn't exist!"), 404);
        }

        // dhcp names
        exec('/bin/sudo /usr/libexec/nethserver/read-dhcp-leases', $out, $ret);
        $dhcp_map = array();
        if ($ret==0) {
            $dhcp_arr = json_decode($out[0], true);
            foreach ($dhcp_arr as $key => $value) {
                $dhcp_map[$value['mac']] = $value['name'];
            }
        }

        $phones = json_decode(file_get_contents($filename), true);

        // Read known MAC addresses from /var/log/messages
        $knownMacAddresses = json_decode(file_get_contents(__DIR__. '/../lib/macAddressMap.json'), true);
        $macs = array();
        foreach ($knownMacAddresses as $mac => $manufacturer) {
            if ($manufacturer === 'Patton' || $manufacturer === 'Mediatrix') {
                continue;
            }
            $macs[] = '^'.str_replace(':','',$mac).'[0-9a-fA-F]\{6\}';
        }

        $matchString = implode('\|',$macs);
        // do match in shell because is faster
        $cmd = '/usr/bin/sudo /usr/bin/grep dnsmasq-tftp /var/log/messages ';
        // exclude family files, reset files ...
        $cmd .= ' | grep -v \'/y[0-9]\{12\}\.cfg\|/y[0-9]\{12\}\.boot\|/[0-9]\{12\}-license\.cfg\|/[0-9a-fA-F]\{12\}script.txt\' ';
        // get only MAC addresses of string
        $cmd .= ' | sed \'s/^.*\([0-9a-fA-F]\{12\}\).*$/\1/\' ';
        // MAC to uppercase
        $cmd .= ' | tr \'[a-z]\' \'[A-Z]\' ';
        // take only known MACs
        $cmd .= " | grep '$matchString' ";
        // sort unique
        $cmd .= " | sort -u ";

        $fp=popen($cmd,'r');
        while (!feof($fp)) {
            $mac = trim(fgets($fp));
            if ($mac == '') {
                continue;
            }
            $mac = preg_replace('/(..)(..)(..)(..)(..)(..)/', '$1:$2:$3:$4:$5:$6',$mac);
            $manufacturer = $knownMacAddresses[substr($mac,0,8)];
            // check if phone is already in array
            $present = false;
            $phone_index = false;
            foreach ($phones as $index => $phone) {
                if ($phone['mac'] === $mac) {
                    $present = true;
                    $phone_index = $index;
                    break;
                }
            }
            if ($present) {
                // phone already present and already requested configuration to tftp
                $phones[$phone_index]['tftp-requested'] = true;
            } else {
                // Add phone to output
                $phones[] = array('mac' => $mac, 'type' => 'phone', 'ipv4' => '', 'manufacturer' => $manufacturer, 'tftp-requested' => true);
            }
        }
        fclose($fp);

        foreach ($phones as $key => $value) {
            // get model from db
            $model = sql('SELECT model FROM `rest_devices_phones` WHERE mac = "' . $phones[$key]['mac'] . '"', "getOne");
            if ($model) {
                $phones[$key]['model'] = $model;
            } else {
                // read from other sources
                $modelNew = retrieveModel($phones[$key]['manufacturer'], $dhcp_map[strtolower($phones[$key]['mac'])], $phones[$key]['ipv4']);
                $phones[$key]['model'] = $modelNew;
                if ($modelNew) {
                    addPhone($phones[$key]['mac'], $phones[$key]['manufacturer'], $modelNew);
                }
            }
        }

        $macs = array();
        foreach ($knownMacAddresses as $mac => $manufacturer) {
            $macs[] = 'cfg'.str_replace(':','',$mac).'[0-9a-fA-F]\{6\}';
        }
        $matchString = implode('\|',$macs);
        // Scan messages for GS Wave devices
        $cmd = '/usr/bin/sudo /usr/bin/grep dnsmasq-tftp /var/log/messages ';
        $cmd .= ' | grep \'\/var\/lib\/tftpboot\/cfg[0-9a-fA-F]\{12\}\.xml not found\' ';
        // take only UNKNOWN MACs
        $cmd .= " | grep -vi '$matchString' ";
        // get only MAC addresses of string
        $cmd .= ' | sed \'s/^.*tftpboot\/cfg\([0-9a-fA-F]\{12\}\)\.xml.*$/\1/\' ';
        // MAC to uppercase
        $cmd .= ' | tr \'[a-z]\' \'[A-Z]\' ';
        // sort unique
        $cmd .= " | sort -u ";

        $fp=popen($cmd,'r');
        while (!feof($fp)) {
            $mac = trim(fgets($fp));
            if ($mac == '') {
                continue;
            }
            $mac = preg_replace('/(..)(..)(..)(..)(..)(..)/', '$1:$2:$3:$4:$5:$6',$mac);
            $phones[] = array('mac' => $mac, 'type' => 'phone', 'ipv4' => '', 'manufacturer' => 'CTI App', 'model' => 'GS Wave', 'tftp-requested' => true);
            $model = sql('SELECT model FROM `rest_devices_phones` WHERE mac = "' . $mac . '"', "getOne");
            if (!$model) {
                addPhone($mac, 'CTI App', 'GS Wave');
            }
        }
        fclose($fp);


        return $response->withJson($phones, 200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

$app->get('/devices/gateways/list/{id}', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $id = $route->getArgument('id');

        $gateways = array();

        // Retrieve scanned gateways
        $basedir='/var/run/nethvoice';
        $res=array();
        $filename = "$basedir/$id.gateways.scan";
        if (file_exists($filename)) {
            $scannedGateways = json_decode(file_get_contents($filename), true);
            foreach ($scannedGateways as $val) {
                $val['isConnected'] = true;
                $val['isConfigured'] = false;
                $gateways[$val['mac']] = $val;
            }
        }

        // Retrieve configured gateways
        $query = 'SELECT `gateway_config`.*,'.
          ' `gateway_config`.model_id AS model,'.
          ' `gateway_models`.manufacturer'.
          ' FROM `gateway_config`'.
          ' LEFT JOIN `gateway_models` ON `gateway_models`.id = `gateway_config`.model_id';
        $res = sql($query, "getAll", \PDO::FETCH_ASSOC);

        if ($res) {
            foreach ($res as $gateway) {
                $gateway['isConfigured'] = true;

            // Add trunks info
            $trunksMeta = array(
              'fxo' => array('`gateway_config_fxo`.trunk AS linked_trunk', '`gateway_config_fxo`.number'),
              'fxs' => array('`gateway_config_fxs`.extension AS linked_extension'),
              'pri' => array('`gateway_config_pri`.trunk AS linked_trunk'),
              'isdn' => array('`gateway_config_isdn`.trunk AS name', '`gateway_config_isdn`.protocol AS type'),
            );

                foreach ($trunksMeta as $trunkPrefix=>$trunkAttr) {
                    $sql = 'SELECT '. implode(',', $trunksMeta[$trunkPrefix]).
                           ' FROM `gateway_config`'.
                           ' JOIN `gateway_config_'. $trunkPrefix. '` ON `gateway_config_'. $trunkPrefix. '`.config_id = `gateway_config`.id'.
                           ' WHERE `gateway_config`.mac = "' . $gateway['mac'] . '"';
                    $obj = sql($sql, "getAll", \PDO::FETCH_ASSOC);

                    if ($obj) {
                        $gateway['trunks_'. $trunkPrefix] = $obj;
                    }
                }

                $gateway['isConnected'] = array_key_exists($gateway['mac'], $gateways);

            // Merge results in list
            $gateways[$gateway['mac']] = $gateway['isConnected'] ?
              array_merge($gateways[$gateway['mac']], $gateway) :
              $gateway;
            }
        }

        return $response->withJson(array_values($gateways), 200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

$app->get('/devices/phones/list', function (Request $request, Response $response, $args) {
    try {
        global $astman;
        $basedir='/var/run/nethvoice';
        $files = scandir($basedir);
        $res=array();
        $dbh = FreePBX::Database();
        /*Get custom extensions*/
        $sql = 'SELECT userman_users.default_extension, userman_users.username, userman_users.displayname'.
            ' , rest_devices_phones.model, rest_devices_phones.extension, rest_devices_phones.line, rest_devices_phones.secret, rest_devices_phones.web_user, rest_devices_phones.web_password'.
            ' FROM `rest_devices_phones`'.
            ' LEFT JOIN userman_users ON userman_users.id = rest_devices_phones.user_id'.
            ' WHERE mac IS NULL AND ( `type` = "physical" OR `type` = "temporaryphysical")';
        $objs = $dbh->sql($sql,"getAll",\PDO::FETCH_ASSOC);
        foreach ($objs as $obj){

            $phone = array();
            $phone['model'] = "custom";
            $phone['manufacturer'] = " _";
            $phone['lines'][] = (object)array(
                "extension"=>$obj['extension'],
                "mainextension"=>$obj['default_extension'],
                "line"=>$obj['line'],
                "secret"=>$obj['secret'],
                "web_user"=>$obj['web_user'],
                "web_password"=>$obj['web_password'],
                "username"=>$obj['username'],
                "displayname"=>$obj['displayname']
            );
            $res[] = $phone;
        }
        /*Get scanned phones*/
        foreach ($files as $file) {
            if (preg_match('/\.phones\.scan$/', $file)) {
                if (file_exists($basedir."/".$file)) {
                    $phones = json_decode(file_get_contents($basedir."/".$file), true);
                    foreach ($phones as $key => $value) {
                        $sql = 'SELECT userman_users.default_extension, userman_users.username, userman_users.displayname'.
                            ' , rest_devices_phones.model, rest_devices_phones.extension, rest_devices_phones.line, rest_devices_phones.secret'.
                          ' FROM `rest_devices_phones`'.
                          ' LEFT JOIN userman_users ON userman_users.id = rest_devices_phones.user_id'.
                          ' WHERE mac = "' . $phones[$key]['mac'] . '"';
                        $objs = $dbh->sql($sql,"getAll",\PDO::FETCH_ASSOC);
                        $phones[$key]['lines'] = array();
                        foreach ($objs as $obj){

                            $phones[$key]['model'] = $obj['model'];
                            $phones[$key]['lines'][] = (object)array(
                                "extension"=>$obj['extension'],
                                "mainextension"=>$obj['default_extension'],
                                "line"=>$obj['line'],
                                "secret"=>$obj['secret'],
                                "username"=>$obj['username'],
                                "displayname"=>$obj['displayname']
                            );
                        }
                        if($phones[$key]['model']) {
                            $res[]=$phones[$key];
                        }
                    }
                }
            }
        }

        //get only one phone in $res array https://stackoverflow.com/questions/2561248/how-do-i-use-array-unique-on-an-array-of-arrays
        $res = array_values(array_intersect_key($res, array_unique(array_map('serialize', $res))));

        /*Get phones from db not in scanned phone list*/
        $sql = 'SELECT userman_users.default_extension, userman_users.username, userman_users.displayname'.
            ' , rest_devices_phones.model, rest_devices_phones.extension, rest_devices_phones.line, rest_devices_phones.secret, rest_devices_phones.mac, rest_devices_phones.vendor'.
            ' FROM `rest_devices_phones`'.
            ' LEFT JOIN userman_users ON userman_users.id = rest_devices_phones.user_id'.
            ' WHERE rest_devices_phones.type="physical" AND rest_devices_phones.mac IS NOT NULL';
        $objs = $dbh->sql($sql,"getAll",\PDO::FETCH_ASSOC);
        foreach ($objs as $obj){
            // check if mac is already in list
            $exists = false;
            foreach ($res as $r) {
                if ($r['mac'] == $obj['mac']) {
                    $exists = true;
                    continue;
                }
            }
            if ($exists) {
                continue;
            }

            $state = $astman->ExtensionState($obj['extension'],'ext-local');
            $phone['mac'] = $obj['mac'];
            $phone['model'] = $obj['model'];
            $phone['manufacturer'] = $obj['vendor'];
            $phone['lines'] = array();
            $phone['lines'][] = (object)array(
                "extension"=>$obj['extension'],
                "mainextension"=>$obj['default_extension'],
                "line"=>$obj['line'],
                "secret"=>$obj['secret'],
                "username"=>$obj['username'],
                "displayname"=>$obj['displayname'],
                "status"=>$state['Status'],
                "statusText"=>$state['StatusText'],
            );
            $res[] = $phone;
        }
        return $response->withJson($res,200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

$app->get('/devices/gateways/list', function (Request $request, Response $response, $args) {
    try {
        $basedir='/var/run/nethvoice';
        $files = scandir($basedir);
        $res=array();
        foreach ($files as $file) {
            if (preg_match('/\.gateways\.scan$/', $file)) {
                if (file_exists($basedir."/".$file)) {
                    $decoded = json_decode(file_get_contents($basedir."/".$file));
                    foreach ($decoded as $element) {
                        $res[]=$element;
                    }
                }
            }
        }
        return $response->withJson(array_unique($res, SORT_REGULAR), 200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

$app->get('/devices/phones/manufacturers', function (Request $request, Response $response, $args) {
    $dbh = FreePBX::Database();
    $sql = "select bl.name,ml.model from endpointman_brand_list bl join endpointman_model_list ml on bl.id=ml.brand";
    $models = $dbh->sql($sql, "getAll", \PDO::FETCH_ASSOC);
    $res=array();
    foreach ($models as $model) {
        if (!array_key_exists($model['name'], $res)) {
            $res[$model['name']] = array();
        }
        array_push($res[$model['name']], $model['model']);
    }
    return $response->withJson($res, 200);
});

$app->get('/devices/gateways/manufacturers', function (Request $request, Response $response, $args) {
    $dbh = FreePBX::Database();
    $sql = "SELECT * FROM gateway_models";
    $models = $dbh->sql($sql, "getAll", \PDO::FETCH_ASSOC);
    $res=array();
    foreach ($models as $model) {
        if (!array_key_exists($model['manufacturer'], $res)) {
            $res[$model['manufacturer']] = array();
        }
        $model['proxy'] = 'sip:'.$_ENV['PROXY_IP'].':'.$_ENV['PROXY_PORT'].';lr';
        $model['ipv4_green'] = $_ENV['NETHVOICE_HOST'];
        array_push($res[$model['manufacturer']], $model);
    }
    return $response->withJson($res, 200);
});

$app->post('/devices/phones/reload/{extension:[0-9]+}', function (Request $request, Response $response, $args) {
    global $astman;
    if (getProvisioningEngine() === 'freepbx') {
        return $response->withStatus(501);
    }
    $route = $request->getAttribute('route');
    $extension = $route->getArgument('extension');
    $dbh = FreePBX::Database();
    $stmt = $dbh->prepare('SELECT `vendor` FROM `rest_devices_phones` WHERE `extension` LIKE ? AND `mac` IS NOT NULL AND `vendor` IS NOT NULL AND `type` = "physical"');
    $stmt->execute([$extension]);
    $vendor = $stmt->fetchAll()[0][0];
    if (empty($vendor)) {
        return $response->withStatus(403);
    }
    $res = $astman->send_request('Command',array('Command'=>"pjsip send notify generic-reload endpoint $extension"));
    if ($res['Response'] !== 'Success' || preg_match('/failed.$/m', $res['data']) || preg_match('/^Unable/m', $res['data'])) {
        return $response->withStatus(500);
    }
    return $response->withStatus(202);
});

$app->post('/devices/phones/model', function (Request $request, Response $response, $args) {
    try {
        $params = $request->getParsedBody();
        $mac = $params['mac'];
        $vendor = $params['vendor'];
        $model = $params['model'];

        $dbh = FreePBX::Database();
        $dbh->query('DELETE IGNORE FROM `rest_devices_phones` WHERE `mac` = "'.$mac.'"');
        $sql = 'INSERT INTO `rest_devices_phones` (`mac`,`vendor`, `model`) VALUES (?,?,?)';
        $stmt = $dbh->prepare($sql);
        if ($res = $stmt->execute(array($mac,$vendor,$model))) {
            return $response->withStatus(200);
        } else {
            return $response->withStatus(500);
        }
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

/*
* Create or update a gateway configuration
*/

$app->post('/devices/gateways', function (Request $request, Response $response, $args) {
    try {
        $fpbx = FreePBX::create();
        $params = $request->getParsedBody();
        $result = addEditGateway($params);
        if ($result['status']) {
            return $response->withJson($result,200);
        }
        return $response->withJson($result,500);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withJson($result,500);
    }
});

/*
* Send gateway configuration to the device
*/
$app->post('/devices/gateways/push', function (Request $request, Response $response, $args) {
    try {
        #create configuration files
        $params = $request->getParsedBody();
        $name = $params['name'];
        $mac = $params['mac'];

        #Launch configuration push
        system("php /var/www/html/freepbx/rest/lib/tftpPushConfig.php ".escapeshellarg($name)." ".escapeshellarg(strtoupper($mac)));
        return $response->withJson(array('status'=>true), 200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withJson(array("status"=>$e->getMessage()), 500);
    }
});


/*
* Delete a gateway configuration
*/

$app->delete('/devices/gateways/{id}', function (Request $request, Response $response, $args) {
    try {
        $route = $request->getAttribute('route');
        $id = $route->getArgument('id');
        $sql = "SELECT `name`,`mac` FROM `gateway_config` WHERE `id` = ?";
        $fpbx = FreePBX::create();
        $sth = FreePBX::Database()->prepare($sql);
        $sth->execute(array($id));
        $res = $sth->fetch(\PDO::FETCH_ASSOC);
        system("php /var/www/html/freepbx/rest/lib/tftpDeleteConfig.php ".escapeshellarg($res['name'])." ".escapeshellarg($res['mac']), $ret);
        //get all trunks for this gateway
        $sql = "SELECT `trunk` FROM `gateway_config_fxo` WHERE `config_id` = ? UNION SELECT `physical_extension` FROM `gateway_config_fxs` WHERE `config_id` = ? UNION SELECT `trunk` FROM `gateway_config_isdn` WHERE `config_id` = ? UNION SELECT `trunk` FROM `gateway_config_pri` WHERE `config_id` = ?";
        $sth = FreePBX::Database()->prepare($sql);
        $sth->execute(array($id,$id,$id,$id));
        while ($row = $sth->fetch(\PDO::FETCH_ASSOC)) {
            \FreePBX::Core()->deleteTrunk($row['trunk']);
	    \FreePBX::Core()->deleteTrunkDialRulesByID($row['trunk']);
	    $routing = new \FreePBX\modules\Core\Components\Outboundrouting();
	    $routing->deleteTrunkRouteById($row['trunk']);
            deletePhysicalExtension($row['trunk']);
            deleteExtension($row['trunk']);
        }

        $sql = "DELETE IGNORE FROM `gateway_config` WHERE `id` = ?";
        $sth = FreePBX::Database()->prepare($sql);
        $sth->execute(array($id));
        system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
        return $response->withJson(array('status' => true), 200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withJson(array("status"=>$e->getMessage()), 500);
    }
});

/**
 * Download gateway configuration
 *
 * @api devices/gateways/download/:name
 */
 $app->get('/devices/gateways/download/{name}[/{mac}]', function (Request $request, Response $response, $args) {
     $route = $request->getAttribute('route');
     $name = $route->getArgument('name');
     $mac = $route->getArgument('mac');
     try {
         if (!isset($mac)) {
             $mac = false;
         }
         $config = gateway_generate_configuration_file($name,$mac);
         return $response->withJson(base64_encode($config),200);
     } catch (Exception $e) {
         error_log($e->getMessage());
         return $response->withStatus(500);
     }
 });

/*
* Provision phone (using FreePBX endpointman https://github.com/FreePBX-ContributedModules/endpointman)
*/
$app->post('/devices/phones/provision', function (Request $request, Response $response, $args) {
    try {
        $body = $request->getParsedBody();

        $mac = $body['mac'];

        $endpoint = FreePBX::endpointmanager();

        $mac_id = $endpoint->eda->sql('SELECT id FROM endpointman_mac_list WHERE mac = \''. str_replace(':', '', $mac) .'\'', 'getOne');
        if ($mac_id) {
            $phone_info = $endpoint->get_phone_info($mac_id);
            $res = $endpoint->prepare_configs($phone_info, false);

            // Copy provisioning file to correct destination
            system('/usr/bin/sudo /usr/bin/scl enable rh-php56 -- php /var/www/html/freepbx/rest/lib/moveProvisionFiles.php');
        } else {
            throw new Exception('device not found');
        }

        return $response->withStatus(200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withJson(array('message' => $e->getMessage()), 500);
    }
});

/*
* Reboot phone (using FreePBX endpointman https://github.com/FreePBX-ContributedModules/endpointman)
*/
$app->post('/devices/phones/reboot', function (Request $request, Response $response, $args) {
    try {
        $body = $request->getParsedBody();

        $mac = $body['mac'];
        $phoneIp = $body['ip'];

        $endpoint = FreePBX::endpointmanager();

        $mac_id = $endpoint->eda->sql('SELECT id FROM endpointman_mac_list WHERE mac = \''. str_replace(':', '', $mac) .'\'', 'getOne');
        if ($mac_id) {
            $phone_info = $endpoint->get_phone_info($mac_id);

          // define('PROVISIONER_BASE', PHONE_MODULES_PATH);
          if (file_exists(PHONE_MODULES_PATH . 'autoload.php')) {
              if (!class_exists('ProvisionerConfig')) {
                  require(PHONE_MODULES_PATH . 'autoload.php');
              }

            //Load Provisioner
            $class = "endpoint_" . $phone_info['directory'] . "_" . $phone_info['cfg_dir'] . '_phone';
              $base_class = "endpoint_" . $phone_info['directory'] . '_base';
              $master_class = "endpoint_base";
              if (!class_exists($master_class)) {
                  ProvisionerConfig::endpointsAutoload($master_class);
              }
              if (!class_exists($base_class)) {
                  ProvisionerConfig::endpointsAutoload($base_class);
              }
              if (!class_exists($class)) {
                  ProvisionerConfig::endpointsAutoload($class);
              }

              if (class_exists($class)) {
                  $provisioner_lib = new $class();
                  $provisioner_lib->reboot($phoneIp);
              }
          }
        } else {
            throw new Exception('device not found');
        }

        return $response->withStatus(200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withJson(array('message' => $e->getMessage()), 500);
    }
});
