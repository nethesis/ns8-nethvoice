#!/usr/bin/env php
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

include_once ("/etc/freepbx.conf");
define("AGIBIN_DIR", "/var/lib/asterisk/agi-bin");
include(AGIBIN_DIR."/phpagi.php");
$DEBUG = false;
error_reporting(0);


global $db;
/**********************************************************************************************************************/
function outboundlookup_debug($text) {
    global $DEBUG;
    if ($DEBUG) {
        return outboundlookup_error($text,'DEBUG');
    }
}
function outboundlookup_error($text,$tag='ERROR') {
    global $agi;
    if (is_array($text))
    {
        @$agi->verbose("outboundlookup [".$tag."] ".print_r($text,true));
    } else {
        @$agi->verbose("outboundlookup [".$tag."] ".$text);
    }
}
/******************************************************/

$agi = new AGI();
$number =  $argv[1];
$cnam =  $argv[2];
$name = '';
$company = '';

if (strlen($number)> 4) {
    //get database data
    $results = $db->getAll("SELECT * FROM outboundlookup","getRow",DB_FETCHMODE_ASSOC);
    if (DB::isError($results) || empty($results)) {
        outboundlookup_error ('Error getting outboundlookup data');
        exit(1);
    }

    //Setup database connection:
    $db_user = $results[0]['mysql_username'];
    $db_pass = $results[0]['mysql_password'];
    $db_host = $results[0]['mysql_host'];
    $db_name = $results[0]['mysql_dbname'];
    $db_engine = 'mysql';
    $name = '';
    $userfield = '';
    $datasource = $db_engine.'://'.$db_user.':'.$db_pass.'@'.$db_host.'/'.$db_name;
    $lookupdb = @DB::connect($datasource); // attempt connection
    if($lookupdb instanceof DB_Error) {
        outboundlookup_error("Error conecting to asterisk database, skipped");
        exit(1);
    } 
    $sql=preg_replace('/\[NUMBER\]/',$number,$results[0]['mysql_query']);
    outboundlookup_debug ($sql);

    $res = @$lookupdb->getAll($sql,DB_FETCHMODE_ORDERED);
    outboundlookup_debug ($res);

    if ($lookupdb->isError($res)){
        outboundlookup_debug("$sql\nERROR: ".$res->getMessage());
        exit(1);
    }

    $name = '';
    $company = '';
    $namecount = 0;

    if (!empty($res)) {
        //get company
        foreach ($res as $row) {
            if (isset($row[1]) && !is_null($row[1]) && !empty($row[1])) {
                $company = $row[1];
                outboundlookup_debug("Company = $company");
                break; //company setted, no need to continue
            }
        }
        //get name
        foreach ($res as $row) {
            if (isset($row[0]) && !is_null($row[0]) && !empty($row[0])) {
                $name = $row[0];
                //if company is setted, make sure that there is only one name that correspond to this number, clear name if there are more than one
                if ($company != '') {
                    $namecount++;
                    if ( $namecount > 1) {
                        $name = '';
                        break;
                    }
                } else {
                    break;
                }
            }
        }
    }

    outboundlookup_debug("Name = $name, Company = $company, Number = $number");
}

if ($name === '' && $company !== '') $displayname = $company;
elseif ($name !== '' && $company !== '') $displayname = "$name ($company)";
elseif ($name !== '' && $company === '') $displayname = $name;
else $displayname = $number;

@$agi->set_variable("CONNECTEDLINE(name,i)","$displayname");
if ($cnam !== '' ) @$agi->set_variable("CDR(cnam)","$cnam");
if ($name !== '' ) @$agi->set_variable("CDR(dst_cnam)","$name");
if ($company !== '' ) @$agi->set_variable("CDR(dst_ccompany)","$company");
@$agi->verbose("Name = \"$name\", Company = \"$company\" Number = \"$number\"");

exit(0);
