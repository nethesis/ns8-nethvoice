<?php
//Copyright (C) nethesis srl. (info@nethesis.it)
//
//This program is free software; you can redistribute it and/or
//modify it under the terms of the GNU General Public License
//as published by the Free Software Foundation; either version 2
//of the License, or (at your option) any later version.
//
//This program is distributed in the hope that it will be useful,
//but WITHOUT ANY WARRANTY; without even the implied warranty of
//MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//GNU General Public License for more details.

if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }

function outboundlookup_hookGet_config($engine) {
    global $ext;
    switch($engine) {
        case "asterisk":
            /* Make sure that there are routes, and that at least one of them has a trunk*/
            $routes = core_routing_list();
            if (!empty($routes) && !is_null(outboundlookup_get())) {
                foreach (core_routing_list() as $route) {
                    $routetrunks = core_routing_getroutetrunksbyid($route['route_id']);
                    if (!empty($routetrunks)) {
                        $ext->splice('macro-dialout-trunk', 's','customtrunk', new ext_agi('/var/lib/asterisk/agi-bin/outboundlookup.php,${DIAL_NUMBER},${DB(AMPUSER/${AMPUSER}/cidname)}'),"",-4);
                        break;
                    }
                }
            }
            /*Add name resolution between extensions*/
            $userlist = core_users_list();
            if (is_array($userlist)) {
                foreach($userlist as $item) {
                    $exten = \FreePBX::Core()->getUser($item[0]);
                    $ext->splice('ext-local', $exten['extension'], '', new ext_set('CDR(cnam)','${IF($["${CDR(cnam)}" = ""]?${DB(AMPUSER/${AMPUSER}/cidname)}:${CDR(cnam)})}'));
                    $ext->splice('ext-local', $exten['extension'], '', new ext_set('AMPUSER','${IF($["${AMPUSER}" = ""]?${CALLERID(number)}:${AMPUSER})}'));
                    $ext->splice('ext-local', $exten['extension'], '', new ext_set('CDR(dst_cnam)','${DB(AMPUSER/'.$exten['extension'].'/cidname)}'));
                }
            }
        break;
    }
}

function outboundlookup_get(){
        $results = sql("SELECT * FROM outboundlookup ","getRow",DB_FETCHMODE_ASSOC);
        return isset($results)?$results:null;
}

function outboundlookup_del(){
    global $db;
    sql('TRUNCATE outboundlookup');
}

function outboundlookup_add($post){
    global $db;
    $mysql_host = $db->escapeSimple($post['mysql_host']);
    $mysql_dbname = $db->escapeSimple($post['mysql_dbname']);
    $mysql_query = $db->escapeSimple($post['mysql_query']);
    $mysql_username = $db->escapeSimple($post['mysql_username']);
    $mysql_password = $db->escapeSimple($post['mysql_password']);
    $mysql_charset = $db->escapeSimple($post['mysql_charset']);
    sql('TRUNCATE outboundlookup');
    $sql = "INSERT INTO outboundlookup
        (mysql_host, mysql_dbname, mysql_query, mysql_username, mysql_password, mysql_charset)
        VALUES
        ('$mysql_host', '$mysql_dbname', '$mysql_query', '$mysql_username', '$mysql_password', '$mysql_charset')";
    error_log($sql);
    $results = sql($sql);
}

