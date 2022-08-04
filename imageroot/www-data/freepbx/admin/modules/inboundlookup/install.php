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

if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }

global $db;
global $amp_conf;

/*Create table if not exists*/
$sql="CREATE TABLE IF NOT EXISTS inboundlookup (
    `mysql_host` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `mysql_dbname` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `mysql_query` varchar(1024) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `mysql_username` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `mysql_password` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `mysql_charset` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

$check = $db->query($sql);
if(DB::IsError($check)) {
    die_freepbx("Can not create inboundlookup table\n");
}



$db_name = FreePBX::Config()->get('CDRDBNAME');
$db_host = FreePBX::Config()->get('CDRDBHOST');
$db_port = FreePBX::Config()->get('CDRDBPORT');
$db_user = FreePBX::Config()->get('CDRDBUSER');
$db_pass = FreePBX::Config()->get('CDRDBPASS');
$db_table = FreePBX::Config()->get('CDRDBTABLENAME');
$dbt = FreePBX::Config()->get('CDRDBTYPE');

$db_hash = array('mysql' => 'mysql', 'postgres' => 'pgsql');
$dbt = !empty($dbt) ? $dbt : 'mysql';
$db_type = $db_hash[$dbt];
$db_table_name = !empty($db_table) ? $db_table : "cdr";
$db_name = !empty($db_name) ? $db_name : "asteriskcdrdb";
$db_host = !empty($db_host) ? $db_host : "localhost";
$db_port = empty($db_port) ? '' :  ';port=' . $db_port;
$db_user = empty($db_user) ? $amp_conf['AMPDBUSER'] : $db_user;
$db_pass = empty($db_pass) ? $amp_conf['AMPDBPASS'] : $db_pass;
$pdo = new \Database($db_type.':host='.$db_host.$db_port.';dbname='.$db_name,$db_user,$db_pass);

/*make sure cdr has inbound_cnum and inbound_cnam*/
foreach(array("cnam","cnum","ccompany") as $name) {
    outn(_("Checking if field $name is present in cdr table.."));
    try {
        $sql = "SELECT $name FROM `$db_name`.`$db_table_name` limit 1";
        $confs = $pdo->query($sql, DB_FETCHMODE_ASSOC);
        out(_("OK!"));
        continue;
    } catch (\Exception $e) {
        out(_("Adding!"));
        $sql = "ALTER TABLE `$db_name`.`$db_table_name` ADD $name VARCHAR ( 80 ) NOT NULL default ''";
        $pdo->query($sql);
    }
}
