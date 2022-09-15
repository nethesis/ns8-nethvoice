<?php

#
# Copyright (C) 2018 Nethesis S.r.l.
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

include_once ("/etc/freepbx.conf");
include_once('/var/www/html/freepbx/rest/lib/libCTI.php');
include_once('/var/www/html/freepbx/rest/lib/libExtensions.php');

class OldDB {
    private static $db;

    public static function Init() {
        //get password
        $pass=exec('/usr/bin/sudo /usr/bin/cat /var/lib/nethserver/secrets/asteriskOldDB');
        self::$db = new PDO(
            'mysql:host=localhost;dbname=asterisk11',
            'migration',
            $pass);
    }

    public static function Database() {
        if (!isset(self::$db)) {
            global $config;
            self::Init();
        }
        return self::$db;
    }
}

class OldCDRDB {
    private static $db;

    public static function Init() {
        //get password
        $pass=exec('/usr/bin/sudo /usr/bin/cat /var/lib/nethserver/secrets/asteriskOldDB');
        self::$db = new PDO(
            'mysql:host=localhost;dbname=asteriskcdrdb11',
            'migration',
            $pass);
    }

    public static function Database() {
        if (!isset(self::$db)) {
            global $config;
            self::Init();
        }
        return self::$db;
    }
}

class NewCDRDB {
    private static $db;

    public static function Init() {
        global $amp_conf;
        $db_host = !empty($amp_conf['CDRDBHOST']) ? $amp_conf["CDRDBHOST"] : 'localhost';
        $db_port = empty($amp_conf["CDRDBPORT"]) ? '' :  ':' . $amp_conf["CDRDBPORT"];
        $db_user = empty($amp_conf["CDRDBUSER"]) ? $amp_conf["AMPDBUSER"] : $amp_conf["CDRDBUSER"];
        $db_pass = empty($amp_conf["CDRDBPASS"]) ? $amp_conf["AMPDBPASS"] : $amp_conf["CDRDBPASS"];

        self::$db = new PDO(
            "mysql:host=$db_host$db_port;dbname=asteriskcdrdb",
            $db_user,
            $db_pass);
    }

    public static function Database() {
        if (!isset(self::$db)) {
            global $config;
            self::Init();
        }
        return self::$db;
    }
}

function isMigration(){
    try {
        $oldDb = OldDB::Database();
    } catch (Exception $e) {
        return false;
    }
    $dbh = FreePBX::Database();
    $sql = 'SELECT `value` FROM `admin` WHERE `variable`="migration_status"';
    $sth = $dbh->prepare($sql);
    $sth->execute(array());
    $res = $sth->fetchAll()[0][0];
    if ($res === 'done') {
        return false;
    }
    return true;
}

function setMigration($status = 'done') {
    try {
        $dbh = FreePBX::Database();
        $sql = 'DELETE IGNORE FROM `admin` WHERE `variable`="migration_status"; INSERT IGNORE INTO `admin` (`variable`,`value`) VALUES ("migration_status",?)';
        $sth = $dbh->prepare($sql);
        $sth->execute(array($status));
        return array('status' => true, 'errors' => array(), 'infos' => array('migration_status changed'), 'warnings' => array());
    } catch (Exception $e) {
        error_log($e->getMessage());
        return array('status' => false, 'errors' => array($e->getMessage()), 'infos' => array(), 'warnings' => array());
    }
}

function getMigrationStatus() {
    try {
        $dbh = FreePBX::Database();
        $sql = 'SELECT `value` FROM `admin` WHERE `variable`="migration_status"';
        $sth = $dbh->prepare($sql);
        $sth->execute(array());
        $res = $sth->fetchAll()[0][0];
        if (empty($res)) {
            return 'ready';
        }
        return $res;
    } catch (Exception $e) {
        error_log($e->getMessage());
        return false;
    }
}

function getOldSecret($extension){
    try {
        $oldDb = OldDB::Database();
        $sql = 'SELECT `data` FROM `sip` WHERE `id` = ? AND `keyword` = "secret"';
        $sth = $oldDb->prepare($sql);
        $sth->execute(array($extension));
        $res = $sth->fetchAll()[0][0];
        return $res;
    } catch (Exception $e) {
        error_log($e->getMessage());
        return false;
    }
}

function storeMigrationReport($object,$message,$type = 'info') {
    try {
        $dbh = FreePBX::Database();
        $sql = 'INSERT INTO rest_migration_report (`type`,`object`,`message`) VALUES (?,?,?)';
        $sth = $dbh->prepare($sql);
        $sth->execute(array($type,$object,$message));
        return true;
    } catch (Exception $e) {
        error_log($e->getMessage());
        return false;
    }
}

function getMigrationReport(){
    try {
        $dbh = FreePBX::Database();
        $sql = 'SELECT `object`,`type`,`message` FROM rest_migration_report';
        $sth = $dbh->prepare($sql);
        $sth->execute(array());
        $results = $sth->fetchAll(\PDO::FETCH_ASSOC);
        $res = array();
        foreach ($results as $row) {
            if (!isset($res[$row['object']])) {
                $res[$row['object']] = array();
            }
            if (!isset($res[$row['object']][$row['type']])) {
                $res[$row['object']][$row['type']] = array();
            }
            $res[$row['object']][$row['type']][] = $row['message'];
        }
        return $res;
    } catch (Exception $e) {
        error_log($e->getMessage());
        return false;
    }

}

function getOldUsers(){
    try {
        $oldDb = OldDB::Database();
        $sql = 'SELECT `extension`, `username`, `secret`, `users`.`name`, `cellphone`, `email`, `voicemail`, `outboundcid`,`profile_id` FROM users LEFT JOIN (SELECT id,data AS secret FROM sip WHERE keyword="secret") AS sip ON users.extension = sip.id LEFT JOIN (SELECT `username`, `cellphone`, `email`, `profile_id`, SUBSTRING_INDEX(`extensions`,",",1) AS ext FROM nethcti_users ) AS nethcti_users ON users.extension = nethcti_users.ext'; 
        $sth = $oldDb->prepare($sql);
        $sth->execute(array());
        $result = $sth->fetchAll(\PDO::FETCH_ASSOC);
        if (empty($result)) {
            $sql = 'SELECT `extension`, "" as `username`, `secret`, `users`.`name`, "" as `cellphone`, "" as `email`, `voicemail`, `outboundcid`,"" as `profile_id` FROM users LEFT JOIN (SELECT id,data AS secret FROM sip WHERE keyword="secret") AS sip ON users.extension = sip.id';
            $sth = $oldDb->prepare($sql);
            $sth->execute(array());
            $result = $sth->fetchAll(\PDO::FETCH_ASSOC);
        }
        return $result;
    } catch (Exception $e) {
        error_log($e->getMessage());
        return array('error' => true, 'error_message' => $e->getMessage());
    }

}

function checkDestination($tocheck) {
    // known destinations
    $destinations = array(
        'app-announcement',
        'ext-group',
        'ext-queues',
        'app-blackhole',
        'ivr',
        'nethcqr',
        'timeconditions',
        'app-daynight'
    );
    foreach ($destinations as $destination) {
        if (strpos($tocheck,$destination) !== FALSE) {
            return true;
        }
    }
    $allusers = FreePBX::Core()->getAllUsers();
    // check if ext-local exists
    if (strpos($tocheck,'ext-local,vm') !== FALSE) {
        $ext = preg_replace('/ext-local,vm[b,i,s,u]([0-9]+),[0-9]/','$1',$tocheck);
        if ($allusers[$ext]['voicemail'] != 'novm') {
            return true;
        }
    }
    // check if from-did-direct extension exists
    if (strpos($tocheck,'from-did-direct') !== FALSE) {
        $ext = preg_replace('/from-did-direct,([0-9]+),[0-9]/','$1',$tocheck);
        if (isset($allusers[$ext])) {
            return true;
        }
    }
    return false;
}

function getOldCTIUsers() {
    //get old users
    $oldDb = OldDB::Database();
    // get all CTI 2 users
    $sql = 'SELECT `username`,`name`,`cellphone`,`extensions`,`voicemails`,`profile_id` FROM `nethcti_users`';
    $sth = $oldDb->prepare($sql);
    $sth->execute(array());
    $res = $sth->fetchAll(\PDO::FETCH_ASSOC);
    return $res;
}

function getOldCTIUsersGroups() {
    $oldDb = OldDB::Database();
    $sql = 'SELECT `user`,`group` from `nethcti_users_groups`';
    $sth = $oldDb->prepare($sql);
    $sth->execute(array());
    $res = $sth->fetchAll(\PDO::FETCH_ASSOC);
    $users = array();
    foreach ($res as $row) {
        if (!isset($users[$row['user']])) {
            $users[$row['user']] = array();
        }
        $users[$row['user']][] = $row['group'];
    }
    return $users;
}

function getOldCTIProfiles() {
    $oldDb = OldDB::Database();
    $sql = 'SELECT `profile_id`,`name` from `nethcti_profiles`';
    $sth = $oldDb->prepare($sql);
    $sth->execute(array());
    $res = $sth->fetchAll(\PDO::FETCH_ASSOC);
    $profiles = array();
    foreach ($res as $profile) {
        $profiles[$profile['profile_id']] = $profile['name'];
    }
    return $profiles;
}

function cloneOldCTIProfile($name) {
    // Skip if there is already a profile with this name
    $errors = array(); $warnings = array(); $infos = array();
    $dbh = FreePBX::Database();
    $sql = 'SELECT COUNT(*) FROM `rest_cti_profiles` WHERE `name` = ?';
    $sth = $dbh->prepare($sql);
    try {
        $sth->execute(array($name));
        $num = $sth->fetchAll()[0][0];
    } catch (Exception $e) {
        error_log($sql . ' ERROR: ' . $e->getMessage());
        storeMigrationReport(__FUNCTION__,$e->getMessage(),'errors');
        $errors[] = $sql . ' ERROR: ' . $e->getMessage();
    }
    if ($num >= 1) {
        $warnings[] = "Profile \"$name\" already migrated";
        storeMigrationReport(__FUNCTION__,"Profile \"$name\" already migrated",'warnings');
        return array('status' => false, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    }
    //read old cti permissions
    $oldDb = OldDB::Database();
    $sql = 'SELECT `permission` FROM `nethcti_profiles` AS a JOIN `nethcti_profile_permissions` AS b ON a.profile_id = b.profile_id WHERE `name` = ?';
    $sth = $oldDb->prepare($sql);
    try {
        $sth->execute(array($name));
        $res = $sth->fetchAll(\PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        storeMigrationReport(__FUNCTION__,$e->getMessage(),'errors');
        error_log($sql . ' ERROR: ' . $e->getMessage());
        $errors[] = $sql . ' ERROR: ' . $e->getMessage();
    }

    $oldpermissions = array();
    foreach ($res as $p) {
        $oldpermissions[] = $p['permission'];
    }
    //old permissions mapped to new macro permissions
    $old_permissions_macropermissions_map = array(
        'phonebook' => 'phonebook',
        'cdr' => 'cdr',
        'queues' => 'queue_agent',
        'offhour' => 'off_hour'
    );

    //old permissions mapped to new ones
    $old_permissions_permissions_map = array(
        'admin_answer' => 'ad_phone',
        'admin_call' => 'ad_phone',
        'admin_cdr' => 'ad_cdr',
        'admin_hangup' => 'hanghup',
        'admin_offhour' => 'advanced_off_hour',
        'admin_parkings' => 'ad_parking',
        'admin_pickup' => 'ad_phone',
        'admin_queues' => 'ad_queue_agent',
        'admin_recording' => 'ad_recording',
        'admin_sms' => 'ad_sms',
        'admin_transfer' => 'ad_phone',
        'attended_transfer' => 'transfer',
        'chat' => 'chat',
        'dnd' => 'dnd',
        'intrude' => 'intrude',
        'lost_queue_calls' => 'lost_queue_call',
        'parkings' => 'parkings',
        'phone_redirect' => 'call_forward',
        'pickup'  => 'pickup',
        'recording' => 'recording',
        'sms' => 'sms',
        'spy' => 'spy',
        'trunks' => 'trunks'
    );

    //macro permissions not mapped and given by default
    $default_new_macro_permissions = array(
        'settings',
        'customer_card',
        'presence_panel',
    );

    //permissions not mapped and given by default
    $default_new_permissions = array(
        'call_waiting'
    );

    $profile = array();
    $profile['name'] = $name;
    $profile['macro_permissions'] = array();

    //add default macro permissions
    foreach ($default_new_macro_permissions as $p) {
        $profile['macro_permissions'][$p]['value'] = true;
        $profile['macro_permissions'][$p]['permissions'] = array();
    }

    //add macro permissions from old permissions
    foreach ($oldpermissions as $oldpermission) {
        if (isset($old_permissions_macropermissions_map[$oldpermission])) {
            $profile['macro_permissions'][$old_permissions_macropermissions_map[$oldpermission]]['value'] = true;
            $profile['macro_permissions'][$old_permissions_macropermissions_map[$oldpermission]]['permissions'] = array();
        }
    }

    //add default permissions to profile
    foreach ($default_new_permissions as $permission_name) {
        $macro_permission = getMacroPermissionFromPermissionName($permission_name);
        if (isset($macro_permission['name']) && !empty($macro_permission['name'])) {
            $profile['macro_permissions'][$macro_permission['name']]['value'] = TRUE;
            if (!isset($profile['macro_permissions'][$macro_permission['name']]['permissions'])) {
                $profile['macro_permissions'][$macro_permission['name']]['permissions'] = array();
            }
            $permission = getPermissionByName($permission_name);
            $permission['value'] = true;
            $profile['macro_permissions'][$macro_permission['name']]['permissions'][] = $permission;;
        }
    }

    //add permissions from old permissions
    foreach ($oldpermissions as $old_permission_name) {
        if (isset($old_permissions_permissions_map[$old_permission_name])) {
            $permission_name = $old_permissions_permissions_map[$old_permission_name];
            $macro_permission = getMacroPermissionFromPermissionName($permission_name);
            if (isset($macro_permission['name']) && !empty($macro_permission['name'])) {
                $profile['macro_permissions'][$macro_permission['name']]['value'] = TRUE;
                if (!isset($profile['macro_permissions'][$macro_permission['name']]['permissions'])) {
                    $profile['macro_permissions'][$macro_permission['name']]['permissions'] = array();
                }
                $permission = getPermissionByName($permission_name);
                $permission['value'] = true;
                $profile['macro_permissions'][$macro_permission['name']]['permissions'][] = $permission;
            }
        }
    }

    //guess permissions - guess some permission missing from old permissions but that would likely be enabled
    //enable conference and oppanel if profile has more than 10 permissions
    if (count($oldpermissions)>10) {
        foreach (array('conference','oppanel') as $permission_name) {
            $macro_permission = getMacroPermissionFromPermissionName($permission_name);
            $permission = getPermissionByName($permission_name);
            $permission['value'] = true;
            $profile['macro_permissions'][$macro_permission['name']]['permissions'][] = $permission;
        }
    }  
    $res = postCTIProfile($profile);
    if ($res === false) {
        $errors[] = 'Error saving profile '.$profile['name'];
        return array('status' => false, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    }
    return array('status' => true, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
}




function getMacroPermissionFromPermissionName($permission_name) {
    try {
        $dbh = FreePBX::Database();
        $query = 'SELECT rest_cti_macro_permissions.name,rest_cti_macro_permissions.id FROM rest_cti_macro_permissions_permissions JOIN rest_cti_permissions ON rest_cti_macro_permissions_permissions.permission_id = rest_cti_permissions.id JOIN rest_cti_macro_permissions ON rest_cti_macro_permissions.id = rest_cti_macro_permissions_permissions.macro_permission_id WHERE rest_cti_permissions.name = ?';
        $sth = $dbh->prepare($query);
        $sth->execute(array($permission_name));
        return $sth->fetchAll(\PDO::FETCH_ASSOC)[0];
    } catch (Exception $e) {
        error_log(__FUNCTION__ . ' : ' .$e->getMessage());
    }
}

function getPermissionByName($permission_name) {
    try {
        $dbh = FreePBX::Database();
        $query = 'SELECT * FROM rest_cti_permissions WHERE `name` = ?';
        $sth = $dbh->prepare($query);
        $sth->execute(array($permission_name));
        return $sth->fetchAll(\PDO::FETCH_ASSOC)[0];
    } catch (Exception $e) {
        error_log(__FUNCTION__ . ' : ' .$e->getMessage());
    }
}

function copyOldTrunks() {
    try {
        // get old trunks
        $dbh = FreePBX::Database();
        $oldDb = OldDB::Database();
        $errors = array(); $warnings = array(); $infos = array();

        $sql = 'SELECT * FROM `sip` WHERE `id` LIKE "tr-peer-%"';
        $sth = $oldDb->prepare($sql);
        $sth->execute(array());
        $res = $sth->fetchAll(\PDO::FETCH_ASSOC);
        $trunks = array();
        foreach ($res as $row) {
            $trunks[$row['id']][$row['keyword']]= $row['data'];
        }

        $trunkIdToCopy = array();
        foreach ($trunks as $identifier => $trunk) {
            if ($trunk['host'] == 'dynamic') continue;
            if (preg_match('/^[2-9]0[0-9][0-9]$/',$trunk['username'])) continue;
            $trunkIdToCopy[] = preg_replace('/^tr-peer-([0-9]*)$/','$1',$identifier);
        }

        foreach ($trunkIdToCopy as $oldid) {
            //Get new id for the trunk
            $sql = 'SELECT max(trunkid) FROM `trunks`';
            $sth = $dbh->prepare($sql);
            $sth->execute(array());
            $res = $sth->fetchAll()[0];
            $lastid = $res[0];
            if (is_null($lastid)) {
                $newid = 1;
                $lastid = 1;
            } else {
                $newid = $lastid+1;
            }
            $sql = 'SELECT * FROM `sip` WHERE `id` LIKE ?';
            $sth = $oldDb->prepare($sql);
            $sth->execute(array("tr-%-$oldid"));
            $trunks_data = $sth->fetchAll(\PDO::FETCH_ASSOC);
            // Writes trunks data into new db
            foreach ($trunks_data as $row) {
                $sql = 'INSERT INTO `sip` (`id`,`keyword`,`data`,`flags`) VALUES (?,?,?,?)';
                $sth = $dbh->prepare($sql);
                $row['id'] = preg_replace("/^(tr\-[a-z]*\-)$oldid$/",'${1}'.$newid,$row['id']);
                $sth->execute(array_values($row));
            }
            // migrate trunks table data
            $migrated = array();
            $sql = 'SELECT * FROM `trunks` WHERE `trunkid` = ?';
            $sth = $oldDb->prepare($sql);
            $sth->execute(array($oldid));
            $trunk = $sth->fetchAll(\PDO::FETCH_ASSOC)[0];
            $sql = 'INSERT INTO `trunks` (`trunkid`,`tech`,`channelid`,`name`,`outcid`,`keepcid`,`maxchans`,`failscript`,`dialoutprefix`,`usercontext`,`provider`,`disabled`,`continue`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)';
            try {
                $sth = $dbh->prepare($sql);
                $sth->execute(array(
                    $newid,
                    $trunk['tech'],
                    $trunk['channelid'],
                    $trunk['name'],
                    $trunk['outcid'],
                    $trunk['keepcid'],
                    $trunk['maxchans'],
                    $trunk['failscript'],
                    $trunk['dialoutprefix'],
                    $trunk['usercontext'],
                    $trunk['provider'],
                    $trunk['disabled'],
                    'off'
                ));
                $migrated[] = $trunk;
            } catch (Exception $e) {
                error_log($sql . ' ERROR: ' . $e->getMessage());
                storeMigrationReport(__FUNCTION__,$e->getMessage(),'errors');
                $errors[] = $sql . ' ERROR: ' . $e->getMessage();
            }
        }
        return array('status' => true, 'trunks' => $migrated, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    } catch (Exception $e) {
        error_log($e->getMessage());
        storeMigrationReport(__FUNCTION__,$e->getMessage(),'errors');
        $errors[] = $e->getMessage();
        return array('status' => false, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    }
}

function getOldGateways() {
    try{
        $db = FreePBX::Database();
        $oldDb = OldDB::Database();
        $errors = array(); $warnings = array(); $infos = array();

        $query = 'SELECT id,manufacturer,model FROM gateway_models';
        $sth = $db->prepare($query);
        $sth->execute(array());
        $new_model_list = $sth->fetchAll(\PDO::FETCH_ASSOC);
        $gateways = array();
        $query = 'SELECT * FROM `nethgateway_config` JOIN `nethgateway_models` ON `nethgateway_models`.name = `nethgateway_config`.model';
        $sth = $oldDb->prepare($query);
        $sth->execute(array());
        $res = $sth->fetchAll(\PDO::FETCH_ASSOC);

        //get green ip
        $query = 'SELECT value FROM endpointman_global_vars WHERE var_name = "srvip"';
        $sth = $db->prepare($query);
        $sth->execute(array());
        $green_ip = $sth->fetchAll()[0][0];

        if ($res) {
            foreach ($res as $gateway) {
                $gateway['isConfigured'] = true;

                // Add trunks info
                $trunksMeta = array(
                  'fxo' => array('`nethgateway_config_fxo`.trunk AS linked_trunk', '`nethgateway_config_fxo`.number'),
                  'fxs' => array('`nethgateway_config_fxs`.extension AS linked_extension'),
                  'pri' => array('`nethgateway_config_pri`.trunk AS linked_trunk'),
                  'isdn' => array('`nethgateway_config_isdn`.trunk AS name', '`nethgateway_config_isdn`.protocol AS type'),
                );

                foreach ($trunksMeta as $trunkPrefix=>$trunkAttr) {
                    $query = 'SELECT '. implode(',', $trunksMeta[$trunkPrefix]).
                        ' FROM `nethgateway_config`'.
                        ' JOIN `nethgateway_config_'. $trunkPrefix. '` ON `nethgateway_config_'. $trunkPrefix. '`.config_id = `nethgateway_config`.id'.
                        ' WHERE `nethgateway_config`.id = "' . $gateway['id'] . '"';
                    $sth = $oldDb->prepare($query);
                    $sth->execute(array());
                    $obj = $sth->fetchAll(\PDO::FETCH_ASSOC);
                    if ($obj) {
                        $gateway['trunks_'. $trunkPrefix] = $obj;
                    }

                }
               //add gateway only if it is configurable
               $exists = false;
               foreach ($new_model_list as $gw) {
                   if ($gw['model'] == $gateway['model'] || $gw['model'] == str_replace('Vega_50','Vega_60', $gateway['model'])) {
                       $exists = true;
                       $gateway['model_id'] = $gw['id'];
                       $gateway['manufacturer'] = $gw['manufacturer'];
                       break;
                    }
                }
                if (isset($gateway['mac_address']) && !empty($gateway['mac_address']) && $exists) {
                    $new_gateway = array(
                        'gateway' => $gateway['gateway'],
                        'ipv4' => $gateway['ip'],
                        'ipv4_new' => $gateway['ip'],
                        'ipv4_green' => $green_ip,
                        'mac' => $gateway['mac_address'],
                        'manufacturer' => $gateway['manufacturer'],
                        'model' => $gateway['model_id'],
                        'name' => $gateway['name'],
                        'netmask_green' => '255.255.255.0',
                        'trunks_fxo' => $gateway['trunks_fxo'],
                        'trunks_fxs' => $gateway['trunks_fxs'],
                        'trunks_isdn' => $gateway['trunks_isdn'],
                        'trunks_pri' => $gateway['trunks_pri']
                    );
                    $gateways[] = $new_gateway;
                }
            }
        }
        return $gateways;
    } catch (Exception $e) {
        error_log($e->getMessage());
        storeMigrationReport(__FUNCTION__,$e->getMessage(),'errors');
        $errors[] = $e->getMessage();
        return array('status' => false, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    }
}

function copyOldOutboundRoutes(){
    try {
        // Get Old Routes
        $db = FreePBX::Database();
        $oldDb = OldDB::Database();
        $errors = array(); $warnings = array(); $infos = array();

        $sql = 'SELECT * FROM outbound_routes JOIN outbound_route_sequence ON outbound_routes.route_id = outbound_route_sequence.route_id';
        $sth = $oldDb->prepare($sql);
        $sth->execute(array());
        $outbound_routes = $sth->fetchAll(\PDO::FETCH_ASSOC);
        foreach ($outbound_routes as $route) {
            //Copy route
            $sql = 'INSERT INTO outbound_routes (route_id,name,outcid,outcid_mode,password,emergency_route,intracompany_route,mohclass,time_group_id) VALUES (?,?,?,?,?,?,?,?,?)';
            $sth = $db->prepare($sql);
            // add 1 to timegroup id if it's configured to avoid conflicts with "Office Hours" default timegroup
            if (is_int($route['time_group_id'])) {
                $route['time_group_id'] += 1;
            }
            $sth->execute(array(
                $route['route_id'],
                $route['name'],
                $route['outcid'],
                $route['outcid_mode'],
                $route['password'],
                $route['emergency_route'],
                $route['intracompany_route'],
                $route['mohclass'],
                $route['time_group_id']
            ));

            //Copy sequence
            $sql = 'INSERT INTO outbound_route_sequence (route_id,seq) VALUES (?,?)';
            $sth = $db->prepare($sql);
            $sth->execute(array(
                $route['route_id'],
                $route['seq']
            ));

            // Copy patterns
            $sql = 'SELECT * FROM outbound_route_patterns WHERE route_id = ?';
            $sth = $oldDb->prepare($sql);
            $sth->execute(array($route['route_id']));
            $patterns = $sth->fetchAll(\PDO::FETCH_ASSOC);
            foreach ($patterns as $pattern) {
                $sql = 'INSERT INTO outbound_route_patterns (route_id,match_pattern_prefix,match_pattern_pass,match_cid,prepend_digits) VALUES (?,?,?,?,?)';
                $sth = $db->prepare($sql);
                $sth->execute(array(
                    $pattern['route_id'],
                    $pattern['match_pattern_prefix'],
                    $pattern['match_pattern_pass'],
                    $pattern['match_cid'],
                    $pattern['prepend_digits']
                ));
            }
        }
        return array('status' => true, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    } catch (Exception $e) {
        error_log($e->getMessage());
        storeMigrationReport(__FUNCTION__,$e->getMessage(),'errors');
        $errors[] = $e->getMessage();
        return array('status' => false, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    }
}

// 
function migrateRoutesTrunksAssignements() {
    try {
        $db = FreePBX::Database();
        $oldDb = OldDB::Database();
        $errors = array(); $warnings = array(); $infos = array();

        // get new routes name id correlation
        $sql = 'SELECT `route_id`,`name` FROM `outbound_routes`';
        $sth = $db->prepare($sql);
        $sth->execute(array());
        $routes = $sth->fetchAll(\PDO::FETCH_ASSOC);

        // get new trunks name id correlation
        $sql = 'SELECT `trunkid`,`name` FROM `trunks`';
        $sth = $db->prepare($sql);
        $sth->execute(array());
        $trunks = $sth->fetchAll(\PDO::FETCH_ASSOC);

        // get old correlation
        $sql = 'SELECT trunks.name AS trunk_name, outbound_routes.name AS route_name,seq FROM outbound_route_trunks JOIN outbound_routes ON outbound_route_trunks.route_id = outbound_routes.route_id JOIN trunks ON trunks.trunkid = outbound_route_trunks.trunk_id';
        $sth = $oldDb->prepare($sql);
        $sth->execute(array());
        $correlations = $sth->fetchAll(\PDO::FETCH_ASSOC);

        foreach ($correlations as $c) {
            // get new trunk id
            $new_trunk_id = false;
            foreach ($trunks as $t) {
                if ($t['name'] === $c['trunk_name']) {
                    $new_trunk_id = $t['trunkid'];
                    break;
                }
            }
            // try next if we don't have trunk id
            if ($new_trunk_id === false) {
                continue;
            }

            // get new route id
            $new_route_id = false;
            foreach ($routes as $r) {
                if ($r['name'] === $c['route_name']) {
                    $new_route_id = $r['route_id'];
                    break;
                }
            }
            // try next if we don't have route id
            if ($new_route_id === false) {
                continue;
            }

            // write outbound_route_trunks correlations
            $sql = 'INSERT INTO outbound_route_trunks (route_id,trunk_id,seq) VALUES (?,?,?)';
            $sth = $db->prepare($sql);
            $sth->execute(array($new_route_id,$new_trunk_id,$c['seq']));
            $infos[] = $new_trunk_id . ' used for route ' . $new_route_id;
        }
        return array('status' => true, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    } catch (Exception $e) {
        error_log($e->getMessage());
        storeMigrationReport(__FUNCTION__,$e->getMessage(),'errors');
        $errors[] = $e->getMessage();
        return array('status' => false, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    }
}

function migrateQueues() {
    try {
        $db = FreePBX::Database();
        $oldDb = OldDB::Database();
        $errors = array(); $warnings = array(); $infos = array();

        // Get old queues
        $sql = 'SELECT * FROM queues_config';
        $sth = $oldDb->prepare($sql);
        $sth->execute(array());
        $oldqueues_config = $sth->fetchAll(\PDO::FETCH_ASSOC);

        $sql = 'SELECT * FROM queues_details';
        $sth = $oldDb->prepare($sql);
        $sth->execute(array());
        $oldqueues_details = $sth->fetchAll(\PDO::FETCH_ASSOC);
        
        // get new mainextensions
        $sql = 'SELECT default_extension FROM userman_users';
        $sth = $db->prepare($sql);
        $sth->execute(array());
        $tmp = array_values($sth->fetchAll(\PDO::FETCH_ASSOC));
        $newextensions = array();
        foreach ($tmp as $t) {
            $newextensions[] = $t['default_extension'];
        }

        foreach ($oldqueues_config as $oldconfig) {
            // use hangup as destination if it is an extrange object
            if (!checkDestination($oldconfig['dest'])) {
                $warnings[] = $oldconfig['dest'] . ' destination not migrated';
                storeMigrationReport(__FUNCTION__,$oldconfig['dest'] . ' destination not migrated','warnings');
                $oldconfig['dest'] = 'app-blackhole,hangup,1';
            }

            // insert group into new db
            $sql = 'INSERT INTO queues_config (extension,descr,grppre,alertinfo,ringing,maxwait,password,ivr_id,dest,cwignore,queuewait,use_queue_context,togglehint,qnoanswer,callconfirm,callconfirm_id,qregex,agentannounce_id,joinannounce_id,monitor_type,monitor_heard,monitor_spoken) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
            try {
                $sth = $db->prepare($sql);
                $sth->execute(array($oldconfig['extension'],$oldconfig['descr'],$oldconfig['grppre'],$oldconfig['alertinfo'],$oldconfig['ringing'],$oldconfig['maxwait'],$oldconfig['password'],$oldconfig['ivr_id'],$oldconfig['dest'],$oldconfig['cwignore'],$oldconfig['queuewait'],$oldconfig['use_queue_context'],$oldconfig['togglehint'],$oldconfig['qnoanswer'],$oldconfig['callconfirm'],$oldconfig['callconfirm_id'],$oldconfig['qregex'],$oldconfig['agentannounce_id'],$oldconfig['joinannounce_id'],$oldconfig['monitor_type'],$oldconfig['monitor_heard'],$oldconfig['monitor_spoken']));
                $infos[] = 'Queue ' . $oldconfig['extension'] . ' - ' . $oldconfig['descr'] . ' migrated';
            } catch (Exception $e) {
                error_log($sql . ' ERROR: ' . $e->getMessage());
                storeMigrationReport(__FUNCTION__,$e->getMessage(),'errors');
                $errors[] = $sql . ' ERROR: ' . $e->getMessage();
            }
        }

        foreach ($oldqueues_details as $olddetails) {
            // if is a member, check that extension exists
            if ($olddetails['keyword'] === 'member') {
                $extension = preg_replace('/Local\/([0-9]+)@from-queue\/n,0/', '$1', $olddetails['data']);
                if (!in_array($extension,$newextensions)) {
                    continue;
                }
            }
            $sql = 'INSERT INTO queues_details (id,keyword,data,flags) VALUES (?,?,?,?)';
            try {
                $sth = $db->prepare($sql);
                $sth->execute(array($olddetails['id'],$olddetails['keyword'],$olddetails['data'],$olddetails['flags']));
            } catch (Exception $e) {
                error_log($sql . ' ERROR: ' . $e->getMessage());
                storeMigrationReport(__FUNCTION__,$e->getMessage(),'errors');
                $errors[] = $sql . ' ERROR: ' . $e->getMessage();
            }
        }
        return array('status' => true, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    } catch (Exception $e) {
        error_log($e->getMessage());
        storeMigrationReport(__FUNCTION__,$e->getMessage(),'errors');
        $errors[] = $e->getMessage();
        return array('status' => false, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    }
}



function migrateGroups() {
    try {
        $db = FreePBX::Database();
        $oldDb = OldDB::Database();
        $errors = array(); $warnings = array(); $infos = array();

        // Get old groups
        $sql = 'SELECT * FROM ringgroups';
        $sth = $oldDb->prepare($sql);
        $sth->execute(array());
        $oldgroups = $sth->fetchAll(\PDO::FETCH_ASSOC);
        
        // get new mainextensions
        $sql = 'SELECT default_extension FROM userman_users';
        $sth = $db->prepare($sql);
        $sth->execute(array());
        $tmp = array_values($sth->fetchAll(\PDO::FETCH_ASSOC));
        $newextensions = array();
        foreach ($tmp as $t) {
            $newextensions[] = $t['default_extension'];
        }

        foreach ($oldgroups as $oldgroup) {
            // get extensions in group
            $oldextensions = explode('-',$oldgroup['grplist']);
            $newgroupextensions = array();
            foreach ($oldextensions as $oldextension) {
                if (in_array($oldextension,$newextensions)) {
                    $newgroupextensions[] = $oldextension;
                }
            }
            $extensions = implode('-',$newgroupextensions);

            // use hangup as destination if it is an extrange object
            if (!checkDestination($oldgroup['postdest'])) {
                $warnings[] = $oldgroup['postdest'] . ' destination not migrated';
                $oldgroup['postdest'] = 'app-blackhole,hangup,1';
            }

            // insert group into new db
            $sql = 'INSERT INTO ringgroups (grpnum,strategy,grptime,grppre,grplist,annmsg_id,postdest,description,alertinfo,remotealert_id,needsconf,toolate_id,ringing,cwignore,cfignore,cpickup,recording) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
            try {
                $sth = $db->prepare($sql);
                $sth->execute(array($oldgroup['grpnum'],$oldgroup['strategy'],$oldgroup['grptime'],$oldgroup['grppre'],$extensions,$oldgroup['annmsg_id'],$oldgroup['postdest'],$oldgroup['description'],$oldgroup['alertinfo'],$oldgroup['remotealert_id'],$oldgroup['needsconf'],$oldgroup['toolate_id'],$oldgroup['ringing'],$oldgroup['cwignore'],$oldgroup['cfignore'],$oldgroup['cpickup'],$oldgroup['recording']));
                $infos[] = 'Ring group ' . $oldgroup['grpnum'] . ' - ' . $oldgroup['description'] . ' migrated';
            } catch (Exception $e) {
                error_log($sql . ' ERROR: ' . $e->getMessage());
                storeMigrationReport(__FUNCTION__,$e->getMessage(),'errors');
                $errors[] = $sql . ' ERROR: ' . $e->getMessage();
            }
        }
        return array('status' => true, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    } catch (Exception $e) {
        error_log($e->getMessage());
        storeMigrationReport(__FUNCTION__,$e->getMessage(),'errors');
        $errors[] = $e->getMessage();
        return array('status' => false, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    }
}

function migrateIVRs() {
    try {
        $db = FreePBX::Database();
        $oldDb = OldDB::Database();
        $errors = array(); $warnings = array(); $infos = array();

        // Get old IVRs
        $sql = 'SELECT * FROM ivr_details';
        $sth = $oldDb->prepare($sql);
        $sth->execute(array());
        $oldIVRs_details = $sth->fetchAll(\PDO::FETCH_ASSOC);

        $sql = 'SELECT * FROM ivr_entries';
        $sth = $oldDb->prepare($sql);
        $sth->execute(array());
        $oldIVRs_entries = $sth->fetchAll(\PDO::FETCH_ASSOC);

        foreach ($oldIVRs_details as $oldIVR) {
            if (!checkDestination($oldIVR['invalid_destination']) && !empty($oldIVR['invalid_destination'])) {
                $warnings[] =  $oldIVR['invalid_destination'] . ' destination not migrated';
                storeMigrationReport(__FUNCTION__,$oldIVR['invalid_destination'] . ' destination not migrated','warnings');
                $oldIVR['invalid_destination'] = 'app-blackhole,hangup,1';
            }
            if (!checkDestination($oldIVR['timeout_destination']) && !empty($oldIVR['invalid_destination'])) {
                $warnings[] =  $oldIVR['timeout_destination'] . ' destination not migrated';
                storeMigrationReport(__FUNCTION__,$oldIVR['timeout_destination'] . ' destination not migrated','warnings');
                $oldIVR['timeout_destination'] = 'app-blackhole,hangup,1';
            }
            $sql = 'INSERT INTO ivr_details (`id`,`name`,`description`,`announcement`,`directdial`,`invalid_loops`,`invalid_retry_recording`,`invalid_destination`,`timeout_enabled`,`invalid_recording`,`retvm`,`timeout_time`,`timeout_recording`,`timeout_retry_recording`,`timeout_destination`,`timeout_loops`,`timeout_append_announce`,`invalid_append_announce`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
            try {
                $sth = $db->prepare($sql);
                $sth->execute(array($oldIVR['id'],$oldIVR['name'],$oldIVR['description'],$oldIVR['announcement'],$oldIVR['directdial'],$oldIVR['invalid_loops'],$oldIVR['invalid_retry_recording'],$oldIVR['invalid_destination'],$oldIVR['timeout_enabled'],$oldIVR['invalid_recording'],$oldIVR['retvm'],$oldIVR['timeout_time'],$oldIVR['timeout_recording'],$oldIVR['timeout_retry_recording'],$oldIVR['timeout_destination'],$oldIVR['timeout_loops'],$oldIVR['timeout_append_announce'],$oldIVR['invalid_append_announce']));
                $infos[] = 'IVR '. $oldIVR['name']  .' migrated';
            } catch (Exception $e) {
                error_log($sql . ' ERROR: ' . $e->getMessage());
                storeMigrationReport(__FUNCTION__,$e->getMessage(),'errors');
                $errors[] = $sql . ' ERROR: ' . $e->getMessage();
            }
        }
        foreach ($oldIVRs_entries as $oldEntry) {
            if (!checkDestination($oldEntry['dest'])) {
                $warnings[] =  $oldEntry['dest'] . ' destination not migrated';
                storeMigrationReport(__FUNCTION__,$oldEntry['dest'] . ' destination not migrated','warnings');
                $oldEntry['dest'] = 'app-blackhole,hangup,1';
            }
            $sql = 'INSERT INTO ivr_entries (ivr_id,selection,dest,ivr_ret) VALUES (?,?,?,?)';
            try {
                $sth = $db->prepare($sql);
                $sth->execute(array($oldEntry['ivr_id'],$oldEntry['selection'],$oldEntry['dest'],$oldEntry['ivr_ret']));
                $infos[] = 'IVR entry migrated';
            } catch (Exception $e) {
                error_log($sql . ' ERROR: ' . $e->getMessage());
                storeMigrationReport(__FUNCTION__,$e->getMessage(),'errors');
                $errors[] = $sql . ' ERROR: ' . $e->getMessage();
            }
        }
        return array('status' => true, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    } catch (Exception $e) {
        error_log($e->getMessage());
        storeMigrationReport(__FUNCTION__,$e->getMessage(),'errors');
        $errors[] = $e->getMessage();
        return array('status' => false, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    }
}

function migrateCQRs() {
    try {
        $db = FreePBX::Database();
        $oldDb = OldDB::Database();
        $errors = array(); $warnings = array(); $infos = array();

        // Get old IVRs
        $sql = 'SELECT * FROM nethcqr_details';
        $sth = $oldDb->prepare($sql);
        $sth->execute(array());
        $oldCQRs_details = $sth->fetchAll(\PDO::FETCH_ASSOC);

        $sql = 'SELECT * FROM nethcqr_entries';
        $sth = $oldDb->prepare($sql);
        $sth->execute(array());
        $oldCQRs_entries = $sth->fetchAll(\PDO::FETCH_ASSOC);

        foreach ($oldCQRs_details as $oldCQR) {
            if (!checkDestination($oldCQR['default_destination'])) {
                $warnings[] =  $oldCQR['default_destination'] . ' destination not migrated';
                storeMigrationReport(__FUNCTION__,$oldCQR['default_destination'] . ' destination not migrated','warnings');
                $oldCQR['default_destination'] = 'app-blackhole,hangup,1';
            }
            $keys = array();
            $values = array();
            $questionmarks = array();
            foreach ($oldCQR as $key => $value) {
                $keys[] = '`'.$key.'`';
                $values[] = $value;
                $questionmarks[] = '?';
            } 
            $sql = 'INSERT INTO nethcqr_details (' . implode(',',$keys) . ') VALUES (' . implode(',',$questionmarks) . ')';
            $sth = $db->prepare($sql);
            $sth->execute($values);
            $infos[] = 'NethCQR details migrated';
        }
        foreach ($oldCQRs_entries as $oldCQR) {
            if (!checkDestination($oldCQR['destination'])) {
                $warnings[] =  $oldCQR['destination'] . ' destination not migrated';
                storeMigrationReport(__FUNCTION__,$oldCQR['destination'] . ' destination not migrated','warnings');
                $oldCQR['destination'] = 'app-blackhole,hangup,1';
            }
            $keys = array();
            $values = array();
            $questionmarks = array();
            foreach ($oldCQR as $key => $value) {
                $keys[] = '`'.$key.'`';
                $values[] = $value;
                $questionmarks[] = '?';
            } 
            $sql = 'INSERT INTO nethcqr_entries (' . implode(',',$keys) . ') VALUES (' . implode(',',$questionmarks) . ')';
            try {
                $sth = $db->prepare($sql);
                $sth->execute($values);
                $infos[] = 'NethCQR entry migrated';
            } catch (Exception $e) {
                error_log($sql . ' ERROR: ' . $e->getMessage());
                storeMigrationReport(__FUNCTION__,$e->getMessage(),'errors');
                $errors[] = $sql . ' ERROR: ' . $e->getMessage();
            }

        } 
        return array('status' => true, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    } catch (Exception $e) {
        error_log($e->getMessage());
        storeMigrationReport(__FUNCTION__,$e->getMessage(),'errors');
        $errors[] = $e->getMessage();
        return array('status' => false, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    }
}

function migrateRecordings($newlang = 'it') {
    try {
        $db = FreePBX::Database();
        $oldDb = OldDB::Database();
        $errors = array(); $warnings = array(); $infos = array();

        // Get old recordings
        $sql = 'SELECT * FROM recordings';
        $sth = $oldDb->prepare($sql);
        $sth->execute(array());
        $oldrecordings = $sth->fetchAll(\PDO::FETCH_ASSOC);
        
        foreach ($oldrecordings as $oldrecording) {
            // copy db line
            $sql = 'INSERT INTO `recordings` (`id`,`displayname`,`filename`,`description`,`fcode`,`fcode_pass`) VALUES (?,?,?,?,?,?)';
            try {
                $sth = $db->prepare($sql);
                $sth->execute(array($oldrecording['id'],$oldrecording['displayname'],$oldrecording['filename'],$oldrecording['description'],$oldrecording['fcode'],$oldrecording['fcode_pass']));
                $infos[] = 'Recording "'.$oldrecording['displayname'].'" migrated';
            } catch (Exception $e) {
                error_log($sql . ' ERROR: ' . $e->getMessage());
                storeMigrationReport(__FUNCTION__,$e->getMessage(),'errors');
                $errors[] = $sql . ' ERROR: ' . $e->getMessage();
            }
        }
        return array('status' => true, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    } catch (Exception $e) {
        error_log($e->getMessage());
        storeMigrationReport(__FUNCTION__,$e->getMessage(),'errors');
        $errors[] = $e->getMessage();
        return array('status' => false, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    }
}

function migrateAnnouncements() {
    try {
        $db = FreePBX::Database();
        $oldDb = OldDB::Database();
        $errors = array(); $warnings = array(); $infos = array();

        // Get old announcements
        $sql = 'SELECT * FROM announcement';
        $sth = $oldDb->prepare($sql);
        $sth->execute(array());
        $oldannouncements = $sth->fetchAll(\PDO::FETCH_ASSOC);

        foreach ($oldannouncements as $oldannouncement) {
            if (!checkDestination($oldannouncement['post_dest'])) {
                $warnings[] = $oldannouncement['post_dest'] . ' destination not migrated';
                storeMigrationReport(__FUNCTION__,$oldannouncement['post_dest'] . ' destination not migrated','warnings');
                $oldannouncement['post_dest'] = 'app-blackhole,hangup,1';
            }
            $sql = 'INSERT INTO `announcement` (`announcement_id`,`description`,`recording_id`,`allow_skip`,`post_dest`,`return_ivr`,`noanswer`,`repeat_msg`) VALUES (?,?,?,?,?,?,?,?)';
            try {
                $sth = $db->prepare($sql);
                $sth->execute(array($oldannouncement['announcement_id'],$oldannouncement['description'],$oldannouncement['recording_id'],$oldannouncement['allow_skip'],$oldannouncement['post_dest'],$oldannouncement['return_ivr'],$oldannouncement['noanswer'],$oldannouncement['repeat_msg']));
                $infos[] = $oldannouncement['description'] . ' announcement migrated';
            } catch (Exception $e) {
                error_log($sql . ' ERROR: ' . $e->getMessage());
                storeMigrationReport(__FUNCTION__,$e->getMessage(),'errors');
                $errors[] = $sql . ' ERROR: ' . $e->getMessage();
            }
        }
        return array('status' => true, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    } catch (Exception $e) {
        error_log($e->getMessage());
        storeMigrationReport(__FUNCTION__,$e->getMessage(),'errors');
        $errors[] = $e->getMessage();
        return array('status' => false, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    }
}

function migrateTimegroups() {
    try {
        $db = FreePBX::Database();
        $oldDb = OldDB::Database();
        $errors = array(); $warnings = array(); $infos = array();

        // Get old timegroups
        $sql = 'SELECT * FROM timegroups_groups';
        $sth = $oldDb->prepare($sql);
        $sth->execute(array());
        $old_timegroups_groups = $sth->fetchAll(\PDO::FETCH_ASSOC);

        $sql = 'SELECT * FROM timegroups_details';
        $sth = $oldDb->prepare($sql);
        $sth->execute(array());
        $old_timegroups_details = $sth->fetchAll(\PDO::FETCH_ASSOC);

        foreach ($old_timegroups_groups as $old_timegroups_group) {
            $sql = 'INSERT INTO timegroups_groups (`id`,`description`) VALUES (?,?)';
            try {
                $sth = $db->prepare($sql);

                // add 1 to timegroup id if it's configured to avoid conflicts with "Office Hours" default timegroup
                $old_timegroups_group['id'] += 1;

                $sth->execute(array($old_timegroups_group['id'],$old_timegroups_group['description']));
                $infos[] = '"'.$old_timegroups_group['description'] . '" timegroup migrated';
            } catch (Exception $e) {
                error_log($sql . ' ERROR: ' . $e->getMessage());
                storeMigrationReport(__FUNCTION__,$e->getMessage(),'errors');
                $errors[] = $sql . ' ERROR: ' . $e->getMessage();
            }
        }

        foreach ($old_timegroups_details as $old_timegroups_detail) {
            $sql = 'INSERT INTO timegroups_details (`id`,`timegroupid`,`time`) VALUES (?,?,?)';
            try {
                $sth = $db->prepare($sql);

                // add 1 to timegroup id if it's configured to avoid conflicts with "Office Hours" default timegroup
                $old_timegroups_detail['timegroupid'] += 1;

                $sth->execute(array($old_timegroups_detail['id'],$old_timegroups_detail['timegroupid'],$old_timegroups_detail['time']));
                $infos[] = $old_timegroups_detail['id'] . ' timegroup detail migrated';
            } catch (Exception $e) {
                error_log($sql . ' ERROR: ' . $e->getMessage());
                storeMigrationReport(__FUNCTION__,$e->getMessage(),'errors');
                $errors[] = $sql . ' ERROR: ' . $e->getMessage();
            }
        }
        return array('status' => true, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    } catch (Exception $e) {
        error_log($e->getMessage());
        storeMigrationReport(__FUNCTION__,$e->getMessage(),'errors');
        $errors[] = $e->getMessage();
        return array('status' => false, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    }
}

function migrateTimeconditions() {
    try {
        $db = FreePBX::Database();
        $oldDb = OldDB::Database();
        $errors = array(); $warnings = array(); $infos = array();

        $sql = 'SELECT * FROM timeconditions';
        $sth = $oldDb->prepare($sql);
        $sth->execute(array());
        $old_timeconditions = $sth->fetchAll(\PDO::FETCH_ASSOC);
        
        foreach ($old_timeconditions as $old_timecondition) {
            if (!checkDestination($old_timecondition['truegoto'])) {
                $warnings[] = $old_timecondition['truegoto'] . ' destination not migrated';
                storeMigrationReport(__FUNCTION__,$old_timecondition['truegoto'] . ' destination not migrated','warnings');
                $old_timecondition['truegoto'] = 'app-blackhole,hangup,1';
            }
            if (!checkDestination($old_timecondition['falsegoto'])) {
                $warnings[] = $old_timecondition['falsegoto'] . ' destination not migrated';
                storeMigrationReport(__FUNCTION__,$old_timecondition['falsegoto'] . ' destination not migrated','warnings');
                $old_timecondition['falsegoto'] = 'app-blackhole,hangup,1';
            }

            $sql = 'INSERT INTO timeconditions (`timeconditions_id`,`displayname`,`time`,`truegoto`,`falsegoto`,`deptname`,`generate_hint`) VALUES (?,?,?,?,?,?,?)';
            try {
                $sth = $db->prepare($sql);

                // add 1 to timegroup id if it's configured to avoid conflicts with "Office Hours" default timegroup
                $old_timecondition['time'] += 1;

                $sth->execute(array($old_timecondition['timeconditions_id'],$old_timecondition['displayname'],$old_timecondition['time'],$old_timecondition['truegoto'],$old_timecondition['falsegoto'],$old_timecondition['deptname'],$old_timecondition['generate_hint']));
                $infos[] = '"' . $old_timecondition['displayname'] . '" timecondition migrated';
            } catch (Exception $e) {
                error_log($sql . ' ERROR: ' . $e->getMessage());
                $errors[] = $sql . ' ERROR: ' . $e->getMessage();
            }
        }
        return array('status' => true, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    } catch (Exception $e) {
        error_log($e->getMessage());
        storeMigrationReport(__FUNCTION__,$e->getMessage(),'errors');
        $errors[] = $e->getMessage();
        return array('status' => false, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    }
}

function migrateInboundRoutes() {
    try {
        $db = FreePBX::Database();
        $oldDb = OldDB::Database();
        $errors = array(); $warnings = array(); $infos = array();

        $sql = 'SELECT * FROM incoming';
        $sth = $oldDb->prepare($sql);
        $sth->execute(array());
        $old_inbounds = $sth->fetchAll(\PDO::FETCH_ASSOC);

        foreach ($old_inbounds as $old_inbound) {
            // check destination
            if (!checkDestination($old_inbound['destination'])) {
                $warnings[] = $old_inbound['destination'] . ' destination not migrated';
                storeMigrationReport(__FUNCTION__,$old_inbound['destination'] . ' destination not migrated','warnings');
                $old_inbound['destination'] = 'app-blackhole,hangup,1';
            }
            $sql = 'INSERT INTO incoming (`cidnum`,`extension`,`destination`,`privacyman`,`alertinfo`,`ringing`,`mohclass`,`description`,`grppre`,`delay_answer`,`pricid`,`pmmaxretries`,`pmminlength`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)';
            try {
                $sth = $db->prepare($sql);
                $sth->execute(array($old_inbound['cidnum'],$old_inbound['extension'],$old_inbound['destination'],$old_inbound['privacyman'],$old_inbound['alertinfo'],$old_inbound['ringing'],$old_inbound['mohclass'],$old_inbound['description'],$old_inbound['grppre'],$old_inbound['delay_answer'],$old_inbound['pricid'],$old_inbound['pmmaxretries'],$old_inbound['pmminlength']));
                $infos[] = $old_inbound['description'] . ' inbound route migrated';
            } catch (Exception $e) {
                error_log($sql . ' ERROR: ' . $e->getMessage());
                $errors[] = $sql . ' ERROR: ' . $e->getMessage();
            }
        }
        return array('status' => true, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    } catch (Exception $e) {
        error_log($e->getMessage());
        storeMigrationReport(__FUNCTION__,$e->getMessage(),'errors');
        $errors[] = $e->getMessage();
        return array('status' => false, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    }
}

function getCdrRowCount(){
    try {
        $errors = array(); $warnings = array(); $infos = array();
        $oldCDRDB = OldCDRDB::Database();
        $sql = 'SELECT COUNT(*) FROM cdr';
        $sth = $oldCDRDB->prepare($sql);
        $sth->execute(array());
        $count = $sth->fetchAll()[0][0];
        return array('count' => $count, 'status' => true, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    } catch (Exception $e) {
        error_log($e->getMessage());
        $errors[] = $e->getMessage();
        return array('status' => false, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    }
}

function migrateIAX(){
    try {
        $db = FreePBX::Database();
        $oldDb = OldDB::Database();
        $errors = array(); $warnings = array(); $infos = array();

        // Get old IAX extensions
        $sql = 'SELECT `id`,`keyword`,`data`,`flags` FROM `iax`';
        $sth = $oldDb->prepare($sql);
        $sth->execute(array());
        $rows = $sth->fetchAll(\PDO::FETCH_NUM);

        if (count($rows) === 0) {
            return array('status' => true, 'errors' => $errors, 'warnings' => $warnings, 'infos' => array('No IAX extensions to migrate'));
        }

        $insert_values = array_merge(... $rows);

        // fill question marks string
        $question_marks = array();
        foreach ($rows as $row) {
            $question_marks[] = '(?,?,?,?)';
        }
        $sql = 'INSERT INTO iax (`id`,`keyword`,`data`,`flags`) VALUES ' . implode(',',$question_marks);
        $sth = $db->prepare($sql);
        $sth->execute($insert_values);

        // Get old trunks ids
        $oldids = array();
        $sql = 'SELECT DISTINCT(`id`) FROM iax WHERE `id` LIKE "tr-peer-%"';
        $sth = $oldDb->prepare($sql);
        $sth->execute(array());
        $res = $sth->fetchAll(\PDO::FETCH_NUM);
        foreach ($res as $identifier) {
              $oldids[] = preg_replace('/^tr-peer-([0-9]*)$/','$1',$identifier[0]);
        }

        // Get minimum id to use for new trunks
        $sql = 'SELECT MAX(`trunkid`) FROM `trunks`';
        $sth = $db->prepare($sql);
        $sth->execute(array());
        $maxId = $sth->fetchAll(\PDO::FETCH_NUM)[0][0];
        if (!isset($maxId)) {
            $maxId = 0;
        }
        foreach ($oldids as $oldid) {
            $maxId += 1;
            $newID = $maxId;

            // Update iax details
            $sql = 'UPDATE iax SET `id` = ? WHERE `id` = ? ; UPDATE iax SET `id` = ? WHERE `id` = ?';
            $sth = $db->prepare($sql);
            $sth->execute(array('tr-peer-'.$newID,'tr-peer-'.$oldid,'tr-user-'.$newID,'tr-user-'.$oldid));

            // Copy trunks table content
            $migrated = array();
            $sql = 'SELECT * FROM `trunks` WHERE `trunkid` = ?';
            $sth = $oldDb->prepare($sql);
            $sth->execute(array($oldid));
            $trunk = $sth->fetchAll(\PDO::FETCH_ASSOC)[0];
            $sql = 'INSERT INTO `trunks` (`trunkid`,`tech`,`channelid`,`name`,`outcid`,`keepcid`,`maxchans`,`failscript`,`dialoutprefix`,`usercontext`,`provider`,`disabled`,`continue`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)';
            try {
                $sth = $db->prepare($sql);
                $sth->execute(array(
                    $newID,
                    $trunk['tech'],
                    $trunk['channelid'],
                    $trunk['name'],
                    $trunk['outcid'],
                    $trunk['keepcid'],
                    $trunk['maxchans'],
                    $trunk['failscript'],
                    $trunk['dialoutprefix'],
                    $trunk['usercontext'],
                    $trunk['provider'],
                    $trunk['disabled'],
                    'off'
                ));
                $infos[] = 'Trunk "'. $trunk['name'] . '" migrated';
            } catch (Exception $e) {
                error_log($e->getMessage());
                $errors[] = 'Error migrating trunk "' . $trunk['name'] . '": '.$e->getMessage();
            }
        }

        // Get number of migrated IAX extensions
        $sql = 'SELECT COUNT(DISTINCT(`id`)) FROM iax WHERE `id` NOT LIKE "tr-%-%"';
        $sth = $db->prepare($sql);
        $sth->execute(array());
        $res = $sth->fetchAll(\PDO::FETCH_NUM)[0][0];
        $infos[] = $res.' IAX extensions migrated';

        return array('status' => true, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    } catch (Exception $e) {
        error_log($e->getMessage());
        $errors[] = $e->getMessage();
        return array('status' => false, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    }
}

function migrateOldTable($table,$fields,$destinationtocheck = false){
    try {
        $errors = array(); $warnings = array(); $infos = array();
        $db = FreePBX::Database();
        $oldDb = OldDB::Database();

        $sql = 'SELECT '.implode(',',$fields).' FROM '.$table;
        $sth = $oldDb->prepare($sql);
        $sth->execute(array());
        $rows = $sth->fetchAll(\PDO::FETCH_NUM);
        if (count($rows) === 0) {
            $infos[] = 'Table "' . $table . '" empty, nothing to migrate';
            return array('status' => true, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
        }
        $sql = 'SELECT COUNT(*) FROM '.$table;
        $sth = $db->prepare($sql);
        $sth->execute(array());
        $count = $sth->fetchAll(\PDO::FETCH_NUM)[0][0];
        if ($count > 0) {
            $warnings[] = 'Table "' . $table . '" not migrated: it already contains some data';
            return array('status' => true, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
        }

        $question_marks = array();
        $q = array();
        foreach ($fields as $field) {
            $q[] = '?';
        }
        foreach ($rows as $index => $row) {
            $question_marks[] = '(' . implode(',',$q) . ')';
            if ($destinationtocheck !== false) {
                foreach ($destinationtocheck as $dest) {
                    // get index of destination into $fields array
                    $i = array_search($dest,$fields);
                    if (!checkDestination($row[$i]) && $row[$i] != '') {
                        $rows[$index][$i] = 'app-blackhole,hangup,1';
                        $warnings[] = $table . ' "' . $row[$i] . '" destination not migrated';
                    }
                }
            }
        }
        $sql = 'INSERT INTO '.$table.' ('. implode(',',$fields) . ') VALUES ' . implode(',',$question_marks);
        $sth = $db->prepare($sql);
        $sth->execute(array_merge(... $rows));
        $infos[] = 'Table "' . $table . '" migrated';
        return array('status' => true, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    } catch (Exception $e) {
        $errors[] = 'Error migrating table "' . $table . '": '.$e->getMessage();
        return array('status' => false, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    }
}

function postMigration(){
    try {
        $errors = array(); $warnings = array(); $infos = array();
        $db = FreePBX::Database();
        $oldDb = OldDB::Database();
        // Migrate CTI phonebook
        exec('/usr/bin/sudo /var/www/html/freepbx/rest/lib/dbMigrationHelper.sh',$output,$return);
        if ($return === 0) {
            $status = true;
            $infos[] = 'CTI phonebook and queue_log migrated';
        } else {
            $status = false;
            $errors[] = 'Unknown error migrating CTI phonebook and queue_log';
        }

        // make sure SIP channel driver is "both" (chan_sip and pjsip)
        $sql = 'UPDATE `freepbx_settings` SET `value` = "both" WHERE `keyword` = "ASTSIPDRIVER"';
        $sth = $db->prepare($sql);
        $sth->execute(array());

        $objs = array(
            // Conference
            array(
                'table' => 'meetme',
                'fields' => array('exten','options','userpin','adminpin','description','joinmsg_id','music','users')
            ),
            // DISA
            array(
                'table' => 'disa',
                'fields' => array('disa_id','displayname','pin','cid','context','digittimeout','resptimeout','needconf','hangup')
            ),
            // Paging
            array(
                'table' => 'paging_config',
                'fields' => array('page_group','force_page','duplex','description')
            ),
            array(
                'table' => 'paging_groups',
                'fields' => array('page_number','ext')
            ),
            // Custom contexts
            array(
                'table' => 'customcontexts_contexts',
                'fields' => array('context','description','dialrules','faildestination','featurefaildestination','failpin','failpincdr','featurefailpin','featurefailpincdr'),
                'destinationtocheck' => array('faildestination','featurefaildestination')
            ),
            array(
                'table' => 'customcontexts_includes',
                'fields' => array('context','include','sort','userules')
            ),
            // Queue priority
            array(
                'table' => 'queueprio',
                'fields' => array('queueprio_id','queue_priority','description','dest'),
                'destinationtocheck' => array('dest')
            ),
            // Set CID
            array(
                'table' => 'setcid',
                'fields' => array('cid_id','cid_name','cid_num','description','dest'),
                'destinationtocheck' => array('dest')
            )
        );

        foreach ($objs as $obj) {
            if (!isset($obj['destinationtocheck'])) {
                $obj['destinationtocheck'] = false;
            }
            $res = migrateOldTable($obj['table'],$obj['fields'],$obj['destinationtocheck']);
            $infos = array_merge($infos,$res['infos']);
            $warnings = array_merge($warnings,$res['warnings']);
            $errors = array_merge($errors,$res['errors']);
        }

        return array('status' => $status, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    } catch (Exception $e) {
        error_log($e->getMessage());
        $errors[] = $e->getMessage();
        return array('status' => false, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    }
}


