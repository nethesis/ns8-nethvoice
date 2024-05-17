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

include_once '/etc/freepbx.conf';
define('FREEPBX_IS_AUTH',False);
include_once '/var/www/html/freepbx/admin/modules/customcontexts/functions.inc.php';
include_once '/var/www/html/freepbx/rest/config.inc.php';
if (file_exists('/var/www/html/freepbx/rest/lib/libQueueManager.php')) {
    include_once '/var/www/html/freepbx/rest/lib/libQueueManager.php';
}
include_once '/var/www/html/freepbx/rest/lib/context_default_permissions.php';

class NethCTI {
    private static $db;

    public static function Init($config) {
        self::$db = new PDO(
            'mysql:host='. $config['host']. ';port='.(isset($config['port']) ? $config['port'] : '3306').';dbname='. $config['name'],
            $config['user'],
            $config['pass']);
    }

    public static function Database() {
        if (!isset(self::$db)) {
            global $config;
            self::Init($config['nethctidb']);
        }
        return self::$db;
    }
}


/*Get All Available macro permissions*/
function getAllAvailableMacroPermissions() {
    try {
        $dbh = FreePBX::Database();
        $sql = 'SELECT * FROM `rest_cti_macro_permissions`';
        return $dbh->sql($sql,"getAll",\PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return false;
    }
}

/*Get All permissions*/
function getAllAvailablePermissions($minified=false) {
    try {
        $dbh = FreePBX::Database();

        // Add operator panel queues permissions if needed
        $macropermissionid = 11; // Operator panel macro permission id is defined in /var/www/html/freepbx/rest/sql/rest_cti.sql
        $query = 'SELECT * from rest_cti_permissions WHERE name LIKE "in_queue_%"';
        $sth = $dbh->prepare($query);
        $sth->execute(array());
        $qpermissions = $sth->fetchAll(\PDO::FETCH_ASSOC);

        // Get existing queues
        $queues = FreePBX::Queues()->listQueues(false);
        if (!empty($queues)) {
            foreach ($queues as $queue) {
                $add = true;
                if (!empty($qpermissions)) {
                    foreach ($qpermissions as $qpermission) {
                        if ($qpermission['name'] === 'in_queue_'.$queue[0]) {
                            //don't add permission
                            $add = false;
                            break;
                        }
                    }
                }
                if ($add) {
                    // insert into permissions
                    $sql = 'INSERT INTO rest_cti_permissions VALUES (NULL, ?, ?, ?)';
                    $sth = $dbh->prepare($sql);
                    $sth->execute(array('in_queue_'.$queue[0], 'Queue '.$queue[1].' ('.$queue[0].')','Use this queue for Operator Panel incoming calls'));
                    // get permission id
                    $sql = 'SELECT id FROM rest_cti_permissions WHERE name = ?';
                    $sth = $dbh->prepare($sql);
                    $sth->execute(array('in_queue_'.$queue[0]));
                    $pid = $sth->fetchAll()[0][0];
                    // Insert into macro permissions permissions
                    $sql = 'INSERT INTO rest_cti_macro_permissions_permissions (macro_permission_id,permission_id) VALUES (?,?)';
                    $sth = $dbh->prepare($sql);
                    $sth->execute(array($macropermissionid,$pid));
                }
            }
        }
        // remove permissions for queues that don't exist
        if (!empty($qpermissions)) {
            foreach ($qpermissions as $qpermission){
                $remove = true;
                if (!empty($queues)) {
                    foreach ($queues as $queue) {
                        if ($qpermission['name'] === 'in_queue_'.$queue[0]) {
                            //don't remove permission
                            $remove = false;
                            break;
                        }
                    }
                }
                if ($remove) {
                    $sql = 'DELETE FROM rest_cti_permissions WHERE id = ?';
                    $sth = $dbh->prepare($sql);
                    $sth->execute(array($qpermission['id']));
                }
            }
        }

        // Rename queues if it's needed
        foreach ($queues as $queue) {
            $sql = 'UPDATE rest_cti_permissions SET displayname = ? WHERE name = ? AND displayname != ?';
            $sth = $dbh->prepare($sql);
            $sth->execute(['Queue '.$queue[1].' ('.$queue[0].')','in_queue_'.$queue[0],'Queue '.$queue[1].' ('.$queue[0].')']);

            $sql = 'UPDATE rest_cti_permissions SET displayname = ?, description = ? WHERE name = ? AND displayname != ?';
            $sth = $dbh->prepare($sql);
            $sth->execute([$queue[1].' ('.$queue[0].')','Manage Queue "'.$queue[1].'" ('.$queue[0].')','qmanager_'.$queue[0],$queue[1].' ('.$queue[0].')']);
        }

        if ($minified) {
            $sql = 'SELECT `id`,`name` FROM `rest_cti_permissions`';
        } else {
            $sql = 'SELECT * FROM `rest_cti_permissions`';
        }

        $permissions = array();
        foreach ($dbh->sql($sql,"getAll",\PDO::FETCH_ASSOC) as $perm) {
            $permissions[$perm['id']] = $perm;
        }

        return $permissions;
    } catch (Exception $e) {
        error_log($e->getMessage());
        return false;
    }
}

/*Get all available permissions for all available macro permissions*/
function getAllAvailableMacroPermissionsPermissions() {
    try {
        $dbh = FreePBX::Database();
        foreach (getAllAvailableMacroPermissions() as $macro_permission) {
            $sql = 'SELECT `permission_id` FROM `rest_cti_macro_permissions_permissions` WHERE `macro_permission_id` = '.$macro_permission['id'];
            $macro_permissions_permissions[$macro_permission['id']] = $dbh->sql($sql,"getAll",\PDO::FETCH_COLUMN);
        }
        return $macro_permissions_permissions;
    } catch (Exception $e) {
        error_log($e->getMessage());
        return false;
    }

}

function getCTIGroups() {
    try {
        $dbh = FreePBX::Database();
        $sql = 'SELECT uu.username, cg.name FROM rest_cti_users_groups ug'.
               ' JOIN rest_cti_groups cg ON ug.group_id = cg.id'.
               ' JOIN userman_users uu on uu.id = ug.user_id;';
        $result = $dbh->sql($sql,"getAll",\PDO::FETCH_ASSOC);
        return $result;
    } catch (Exception $e) {
        error_log($e->getMessage());
        return false;
    }
}

function getCTIPermissionProfiles($profileId=false, $minified=false, $printnull=false){
    try {
        $dbh = FreePBX::Database();

        // Get all profiles
        $sql = 'SELECT * FROM `rest_cti_profiles`';
        $profiles = $dbh->sql($sql,"getAll",\PDO::FETCH_ASSOC);

        // Get all available macro permissions
        $macro_permissions = getAllAvailableMacroPermissions();

        // Get all available permissions
        $permissions = getAllAvailablePermissions($minified);

        // Get all available permissions for all available macro permissions
        $macro_permissions_permissions = getAllAvailableMacroPermissionsPermissions();

        // Delete queue permissions for queue that has been deleted
        if(function_exists('deleteQueuePermissionsForDeletedQueue')) {
            deleteQueuePermissionsForDeletedQueue($permissions);
        }

        // Get all available outbound routes
        $outbound_routes = $dbh->sql('SELECT * FROM outbound_routes',"getAll",\PDO::FETCH_ASSOC);

        foreach ($profiles as $profile) {
            $id = $profile['id'];
            // Get profile macro permissions
            $sql = 'SELECT `macro_permission_id` FROM `rest_cti_profiles_macro_permissions` WHERE `profile_id` = '.$id;
            $profile_macro_permissions = $dbh->sql($sql,"getAll",\PDO::FETCH_COLUMN);
            $results[$id] = array('id' => $id, 'name' => $profile['name'], 'macro_permissions' => array());
            foreach ($macro_permissions as $macro_permission) {
                // Write macro permission name
                $results[$id]['macro_permissions'][$macro_permission['name']] = array();
                // Write macro permission state for this profile
                if (in_array($macro_permission['id'], $profile_macro_permissions)) {
                    $results[$id]['macro_permissions'][$macro_permission['name']]['value'] = true;
                } else {
                    $results[$id]['macro_permissions'][$macro_permission['name']]['value'] = false;
		}
                if (!$minified) {
                    // Write macro permission displayname
                    $results[$id]['macro_permissions'][$macro_permission['name']]['displayname'] = $macro_permission['displayname'];
		    // Write macro permission description
		    $results[$id]['macro_permissions'][$macro_permission['name']]['description'] = $macro_permission['description'];
                }
                // write permissions in this macro permission
                $sql = 'SELECT `permission_id` FROM `rest_cti_profiles_permissions` WHERE `profile_id` = '.$id;
                $enabled_permissions = $dbh->sql($sql,"getAll",\PDO::FETCH_COLUMN);

                foreach ($macro_permissions_permissions[$macro_permission['id']] as $macro_permissions_permission) {
                    $results[$id]['macro_permissions'][$macro_permission['name']]['permissions'][$macro_permissions_permission] = $permissions[$macro_permissions_permission];
                    if (in_array($macro_permissions_permission, $enabled_permissions)) {
                        $results[$id]['macro_permissions'][$macro_permission['name']]['permissions'][$macro_permissions_permission]['value'] = true;
                    } else {
                        $results[$id]['macro_permissions'][$macro_permission['name']]['permissions'][$macro_permissions_permission]['value'] = false;
                    }
                }
                //Convert permissions into an array
                if (isset($results[$id]['macro_permissions'][$macro_permission['name']]['permissions'])) {
                    $results[$id]['macro_permissions'][$macro_permission['name']]['permissions'] = array_values($results[$id]['macro_permissions'][$macro_permission['name']]['permissions']);
                } else {
                    $results[$id]['macro_permissions'][$macro_permission['name']]['permissions'] = array();
                }
            }

            // Sort operator panel queues
            usort($results[$id]['macro_permissions']['operator_panel']['permissions'], function($a, $b) {
                return strcmp($a['displayname'], $b['displayname']);
            });

            // add Queue manager disabled queue
            if (function_exists('addQueueManagerDisabledQueues')) {
                if ($printnull) {
                    $results[$id] = addQueueManagerDisabledQueues($results[$id]);

                    // Sort Queue manager queues
                    usort($results[$id]['macro_permissions']['qmanager']['permissions'], function($a, $b) {
                        return strcmp($a['displayname'], $b['displayname']);
                    });
                }
            } else {
                unset($results[$id]['macro_permissions']['qmanager']);
            }

            // Get all outbound routes with profile permission
            $sql = 'SELECT outbound_routes.route_id AS route_id,outbound_routes.name AS name FROM outbound_routes';
            $sth = $dbh->prepare($sql);
            $sth->execute(array($id));
            $all_outbound_routes = $sth->fetchAll(\PDO::FETCH_ASSOC);

            // Get context name for this profile
            if ($profile['name'] === 'Hotel') {
                $context_name = 'hotel';
            } else {
                $context_name = 'cti-profile-'.$id;
            }

            // make sure context exists
            $customcontexts_contexts = customcontexts_getcontexts();
            if (!empty($customcontexts_contexts) && in_array($context_name, array_column($customcontexts_contexts,0))){

                // get all context permissions
                $context_permissions = customcontexts_getincludes($context_name);

                // get context id for the "all route" permission
                if (!empty($context_permissions)) {
                    $outbound_allroutes_id = array_search('outbound-allroutes', array_column($context_permissions,2));
                }

                // get the context "all route" permission
                $context_all_route_permission = null;
                if (isset($outbound_allroutes_id) && isset($context_permissions[$outbound_allroutes_id])) {
                    if ($context_permissions[$outbound_allroutes_id][4] === 'no') {
                        $context_all_route_permission = false;
                    } else {
                        $context_all_route_permission = true;
                    }
                }
            }

            // Get routes context permissions
            $context_route_permissions = array();
            foreach ($all_outbound_routes as $outbound_route) {
                // get context id foreach route
                if (!empty($context_permissions)) {
                    $outbound_route_context_id = array_search('outrt-'.$outbound_route['route_id'],array_column($context_permissions,2));
                }
                // get the context permission for the route
                $context_route_permissions[$outbound_route['route_id']] = null;
                if (isset($outbound_route_context_id) && $outbound_route_context_id !== false && isset($context_permissions[$outbound_route_context_id])) {
                    if ($context_permissions[$outbound_route_context_id][4] === 'no') {
                        $context_route_permissions[$outbound_route['route_id']] = false;
                    } else {
                        $context_route_permissions[$outbound_route['route_id']] = true;
                    }
                }

                if ($context_all_route_permission === true) {
                    // Enable route if context has "allroute" permission enabled
                    $route_permission = true;
                } else if ($context_route_permissions[$outbound_route['route_id']] === true) {
                    // Enable route if context has it explicitly enabled
                    $route_permission = true;
                } else if ($context_route_permissions[$outbound_route['route_id']] === false) {
                    // Disable route if context has it explicitly disabled
                    $route_permission = false;
                } else if ($context_all_route_permission === false) {
                    // Disable route if context has "allroute" permission disabled
                    $route_permission = false;
                } else {
                    // Enable route if none of previous conditions are meet
                    $route_permission = true;
                }

                // Add the route to permissions
                $results[$id]['outbound_routes_permissions'][] = array(
                    'route_id' => $outbound_route['route_id'],
                    'name' => $outbound_route['name'],
                    'permission' => (boolean) $route_permission
                );
            }
        }

        if (!$profileId) {
            return array_values($results);
        } else {
            return $results[$profileId];
        }
    } catch (Exception $e) {
        error_log($e->getMessage());
        return false;
    }
}

function getCTIPermissions(){
    try {
        $dbh = FreePBX::Database();

        // Get all profiles
        $sql = 'SELECT * FROM `rest_cti_profiles`';
        $profiles = $dbh->sql($sql,"getAll",\PDO::FETCH_ASSOC);

        // Get all available macro permissions
        $macro_permissions = getAllAvailableMacroPermissions();

        // Get all available permissions
        $permissions = getAllAvailablePermissions();

        // Get all available permissions for all available macro permissions
        foreach ($macro_permissions as $macro_permission) {
            $results[$macro_permission['name']] = $macro_permission;
        }

        foreach ($macro_permissions as $macro_permission) {
            $sql = 'SELECT `permission_id` FROM `rest_cti_macro_permissions_permissions` WHERE `macro_permission_id` = '.$macro_permission['id'];
            $macro_permissions_permissions[$macro_permission['id']] = $dbh->sql($sql,"getAll",\PDO::FETCH_COLUMN);

            // Write macro permission name
            $results[$macro_permission['name']] = array();

            // Write macro permission state as false
            $results[$macro_permission['name']]['value'] = false;

            // write permissions in this macro permission
            $sql = 'SELECT `permission_id` FROM `rest_cti_profiles_permissions` WHERE `profile_id` = '.$id;

            foreach ($macro_permissions_permissions[$macro_permission['id']] as $macro_permissions_permission) {
                $results[$macro_permission['name']]['permissions'][$macro_permissions_permission] = $permissions[$macro_permissions_permission];
                $results[$macro_permission['name']]['permissions'][$macro_permissions_permission]['value'] = false;

                //Convert permissions into an array
                if (isset($results[$macro_permission['name']]['permissions'])) {
                    $results[$macro_permission['name']]['permissions'] = array_values($results[$macro_permission['name']]['permissions']);
                } else {
                    $results[$macro_permission['name']]['permissions'] = array();
                }
            }
        }

        $results['outbound_routes'] = array();
        foreach ($dbh->sql('SELECT route_id,name FROM outbound_routes',"getAll",\PDO::FETCH_ASSOC) as $outbound_route) {
            $results['outbound_routes'][] = array('route_id' => $outbound_route['route_id'], 'name' => $outbound_route['name']);
        }
        return $results;
    } catch (Exception $e) {
        error_log($e->getMessage());
        return false;
    }
}

function postCTIProfile($profile, $id=false){
    try {
        $dbh = FreePBX::Database();

        if (!$id){
            //Creating a new profile
            $sql = 'INSERT INTO `rest_cti_profiles` VALUES (NULL, ?)';
            $sth = $dbh->prepare($sql);
            $sth->execute(array($profile['name']));

            //Get id
            $sql = 'SELECT LAST_INSERT_ID()';
            $id = $dbh->sql($sql,"getOne");
        }

        $profile['id'] = $id;

        //set macro_permissions
        foreach (getAllAvailableMacroPermissions() as $macro_permission) {
            if (!$profile['macro_permissions'][$macro_permission['name']]['value']) {
                $sql = 'DELETE IGNORE FROM `rest_cti_profiles_macro_permissions` WHERE `profile_id` = ? AND `macro_permission_id` = ?';
                $sth = $dbh->prepare($sql);
                $sth->execute(array($id, $macro_permission['id']));
            } else {
                $sql = 'INSERT IGNORE INTO `rest_cti_profiles_macro_permissions` VALUES (?, ?)';
                $sth = $dbh->prepare($sql);
                $sth->execute(array($id, $macro_permission['id']));
            }
            if (!empty($profile['macro_permissions'][$macro_permission['name']]['permissions'])) {
                foreach ($profile['macro_permissions'][$macro_permission['name']]['permissions'] as $permission ) {
                    if ($permission['value']) {
                        // Create new permission here if don't exists
                        if (is_null($permission['id'])) {
                            // Check if the permission already exists
                            $sql = 'SELECT `id` FROM `rest_cti_permissions` WHERE `name` = ? AND `displayname` = ? AND `description` = ?';
                            $sth = $dbh->prepare($sql);
                            $sth->execute(array($permission['name'],$permission['displayname'],$permission['description']));
                            $res = $sth->fetchAll()[0][0];
                            if (!empty($res)) {
                                // it exists
                                $permission['id'] = $res;
                            } else {
                                // Create a new permission
                                $sql = 'INSERT INTO `rest_cti_permissions` VALUES (NULL, ?, ?, ?)';
                                $sth = $dbh->prepare($sql);
                                $sth->execute(array($permission['name'],$permission['displayname'],$permission['description']));

                                //Get id
                                $sql = 'SELECT LAST_INSERT_ID()';
                                $permission['id'] = $dbh->sql($sql,"getOne");

                                // Save permission into macro permission
                                $sql = 'INSERT INTO `rest_cti_macro_permissions_permissions` VALUES (?,?)';
                                $sth = $dbh->prepare($sql);
                                $sth->execute(array($macro_permission['id'],$permission['id']));
                            }
                        }
                        $sql = 'INSERT IGNORE INTO `rest_cti_profiles_permissions` VALUES (?, ?)';
                        $sth = $dbh->prepare($sql);
                        $sth->execute(array($id, $permission['id']));
                    } else {
                        if (!is_null($permission['id'])) {
                            $sql = 'DELETE IGNORE FROM `rest_cti_profiles_permissions` WHERE `profile_id` = ? AND `permission_id` = ?';
                            $sth = $dbh->prepare($sql);
                            $sth->execute(array($id, $permission['id']));
                        } else {
                            $sql = 'DELETE IGNORE FROM `rest_cti_profiles_permissions` WHERE `profile_id` = ? AND `permission_id` = (SELECT `id` FROM `rest_cti_permissions` WHERE `name` = ?)';
                            $sth = $dbh->prepare($sql);
                            $sth->execute(array($id, $permission['name']));
                        }
                    }
                }
            }
            // Add outbound routes permissions
            $sql = 'DELETE FROM rest_cti_profiles_routes_permission WHERE profile_id = ?';
            $sth = $dbh->prepare($sql);
            $sth->execute([$id]);
            if (!empty($profile['outbound_routes_permissions'])) {
                $sql = 'INSERT INTO rest_cti_profiles_routes_permission (profile_id,route_id,permission) VALUES ';
                $qm = [];
                $values = [];
                foreach ($profile['outbound_routes_permissions'] as $outbound_route) {
                    $qm[] = '(?,?,?)';
                    $values = array_merge($values,[$id,$outbound_route['route_id'],(int) $outbound_route['permission']]);
                }
                $sql .= implode(',',$qm);
                $sth = $dbh->prepare($sql);
                $sth->execute($values);
            }
        }

        setCustomContextPermissions($profile);
        return $id;
    } catch (Exception $e) {
        error_log($e->getMessage());
        return false;
    }
}

function setCustomContextPermissions($profile){
    global $context_default_permissions;
    global $context_permission_map;
    /* Create custom context if needed */
    $contexts = customcontexts_getcontexts();
    $context_exists = False;

    if ($profile['name'] === 'Hotel') {
        $context_name = 'hotel';
    } else {
        $context_name = 'cti-profile-'.$profile['id'];
    }

    foreach ($contexts as $context) {
        if ($context['0'] === $context_name ) {
            $context_exists = True;
        }
    }
    if (!$context_exists) {
        // Create customcontext for this profile
        customcontexts_customcontexts_add($context_name, 'CTI Profile '.addslashes($profile['name']),null,null,null,null,null);
        /* set default permission for context*/
        $context_permissions = array();
        foreach (customcontexts_getincludes($context_name) as $val) {
            if (isset($context_default_permissions[$val[2]])) {
                 $context_permissions[$val[2]] = array("allow" => $context_default_permissions[$val[2]]["allow"], "sort" => $val[5]);
            } else {
                // Set default permission to yes for not specified permissions
                $context_permissions[$val[2]] = array("allow" => "yes", "sort" => $val[5]);
            }
        }
    } else {
        foreach (customcontexts_getincludes($context_name) as $val) {
            $context_permissions[$val[2]] = array("allow" => $val[4], "sort" => $val[5]);
        }
    }

    /* Set context permissions according to CTI permissions */
    foreach ($profile['macro_permissions'] as $macro_permission) {
        foreach ($macro_permission['permissions'] as $permission) {
            if (isset($context_permission_map[$permission['name']])) {
                foreach ($context_permission_map[$permission['name']] as $context_permission_name) {
                    if ($permission['value'] == True) {
                        $context_permissions[$context_permission_name]['allow'] = "yes";
                    } else {
                        $context_permissions[$context_permission_name]['allow'] = "no";
                    }
                }
            }
        }
    }

    /* Set outbound routes permissions */
    $dbh = FreePBX::Database();
    $outbound_routes = $dbh->sql('SELECT * FROM outbound_routes',"getAll",\PDO::FETCH_ASSOC);
    if (!isset($profile['outbound_routes_permissions']) || empty($outbound_routes)) {
        // Enable "all outbound routes" permission for profiles backward compatibility
        $context_permissions['outbound-allroutes']['allow'] = "yes";
    } else {
        // Disable "all outbound routes" permission
        $context_permissions['outbound-allroutes']['allow'] = "no";

        // Add permissions for each route
        // Get all available outbound routes
        foreach ($outbound_routes as $outbound_route) {
            $index = array_search($outbound_route['route_id'], array_column($profile['outbound_routes_permissions'],'route_id'));
            if ($index !== false && $profile['outbound_routes_permissions'][$index]['permission'] == false) {
                $context_permissions['outrt-'.$outbound_route['route_id']]['allow'] = "no";
            } else {
                $context_permissions['outrt-'.$outbound_route['route_id']]['allow'] = "yes";
            }
        }
    }

    // Get context data
    $context = customcontexts_customcontexts_get($context_name);
    // Set permissions
    customcontexts_customcontexts_edit($context[0],$context[0],$context[1],$context[2],$context[3],$context[4],$context[5],$context[6]);
    uasort($context_permissions,'context_permission_compare');
    customcontexts_customcontexts_editincludes($context[0],$context_permissions,$context[0]);
}

function context_permission_compare($a,$b) {
    if ($a['sort'] == $b['sort']) {
        return 0;
    }
    return ($a['sort'] < $b['sort']) ? -1 : 1;
}

function deleteCTIProfile($id){
    try {
        $profile = getCTIPermissionProfiles($profile_id);
        $dbh = FreePBX::Database();
        $sql = 'DELETE FROM `rest_cti_profiles` WHERE `id` = ?';
        $sth = $dbh->prepare($sql);
        $sth->execute(array($id));
        if ($profile['name'] !== 'Hotel') {
            $sql = 'UPDATE sip SET `data` = "from-internal" WHERE `data` = ?';
            $sth = $dbh->prepare($sql);
            $sth->execute(array('cti-profile-'.$id));
            customcontexts_customcontexts_del('cti-profile-'.$id);
        }
        system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
        return True;
    } catch (Exception $e) {
        error_log($e->getMessage());
        return False;
    }
}

function getProfileID($profilename) {
    $dbh = FreePBX::Database();
    $sql = 'SELECT `id` FROM `rest_cti_profiles` WHERE `name` = ?';
    $sth = $dbh->prepare($sql);
    $sth->execute(array($profilename));
    $data = $sth->fetchAll()[0][0];
    return $data;
}

function setCTIUserProfile($user_id,$profile_id){
    try {
        $dbh = FreePBX::Database();
        $sql =  'INSERT INTO rest_users (user_id,profile_id)'.
                ' VALUES (?,?)'.
                ' ON DUPLICATE KEY UPDATE profile_id = ?';
        $stmt = $dbh->prepare($sql);
        $stmt->execute(array($user_id, $profile_id, $profile_id));

        /*Configure user defaults*/
        //get username
        $sql =  'SELECT username ' .
                ' FROM rest_users JOIN userman_users ON rest_users.user_id = userman_users.id ' .
                ' WHERE userman_users.id = ?';
        $sth = $dbh->prepare($sql);
        $sth->execute(array($user_id));
        $username = $sth->fetchAll()[0][0];
        $dbhcti = NethCTI::Database();
        $sql =  'INSERT IGNORE INTO user_settings (username,key_name,value) ' .
                ' VALUES (?,"desktop_notifications","true")';
        $stmt = $dbhcti->prepare($sql);
        $stmt->execute(array($username));
        $sql =  'INSERT IGNORE INTO user_settings (username,key_name,value) ' .
                ' VALUES (?,"open_ccard","connected")';
        $stmt = $dbhcti->prepare($sql);
        $stmt->execute(array($username));
        $sql =  'INSERT IGNORE INTO user_settings (username,key_name,value) ' .
                ' VALUES (?,"chat_notifications","true")';
        $stmt = $dbhcti->prepare($sql);
        $stmt->execute(array($username));

        // Set user extensions context based on cti profile
        if (!empty($profile_id)) {
            $profile = getCTIPermissionProfiles($profile_id);
            if ($profile['name'] === 'Hotel') {
                $context_name = 'hotel';
            } else {
                $context_name = 'cti-profile-'.$profile_id;
            }
            $sql = 'UPDATE sip SET `data` = ? WHERE ' .
                   ' `id` IN ( '.
                   ' SELECT extension COLLATE utf8mb4_unicode_ci FROM rest_devices_phones WHERE user_id = ? ' .
                   '  UNION ALL ' .
                   ' SELECT default_extension COLLATE utf8mb4_unicode_ci FROM userman_users WHERE id = ?' .
                   ' ) AND `keyword` = "context"' .
                   ' AND (`data` LIKE "cti-profile-%" OR `data` = "from-internal" OR `data` = "hotel")';
            $stmt = $dbh->prepare($sql);
            $stmt->execute(array($context_name,$user_id,$user_id));
        }
        return TRUE;
    } catch (Exception $e) {
        error_log($e->getMessage());
        return array('error' => $e->getMessage());
    }
}

function ctiCreateGroup($name){
try {
        $dbh = FreePBX::Database();

        $query = 'SELECT id FROM rest_cti_groups WHERE name = ?';
        $sth = $dbh->prepare($query);
        $sth->execute(array($name));
        $res = $sth->fetchAll()[0][0];
        if (!empty($res)) {
            return $res;
        }

        $sql = 'INSERT INTO rest_cti_groups VALUES (NULL, ?)';
        $sth = $dbh->prepare($sql);
        $sth->execute(array($name));

        $sql = 'INSERT INTO rest_cti_permissions VALUES (NULL, ?, ?, ?)';
        $sth = $dbh->prepare($sql);
        $sth->execute(array("grp_".trim(strtolower(preg_replace('/[^a-zA-Z0-9]/','',$name))), "Group: ".trim($name), "Group: ".trim($name).": of presence panel"));

        $query = 'SELECT id FROM rest_cti_macro_permissions WHERE name = "presence_panel"';
        $sth = $dbh->prepare($query);
        $sth->execute();
        $macro_group_id = $sth->fetchObject();

        $query = 'SELECT id FROM rest_cti_permissions WHERE name = ?';
        $sth = $dbh->prepare($query);
        $sth->execute(array("grp_".trim(strtolower(preg_replace('/[^a-zA-Z0-9]/','',$name)))));
        $perm_id = $sth->fetchObject();

        $sql = 'INSERT INTO rest_cti_macro_permissions_permissions VALUES (?, ?)';
        $sth = $dbh->prepare($sql);
        $sth->execute(array($macro_group_id->id, $perm_id->id));

        $query = 'SELECT id FROM rest_cti_groups WHERE name = ?';
        $sth = $dbh->prepare($query);
        $sth->execute(array($name));
        $group_id = $sth->fetchObject()->id;
        return $group_id;
     } catch (Exception $e) {
        error_log($e->getMessage());
        return false;
     }
}
