#!/usr/bin/env php
<?php
//
// Copyright (C) 2010-2015 Nethesis s.r.l. - All rights reserved. 
//
define("AGIBIN_DIR", "/var/lib/asterisk/agi-bin");
define("AMPORTAL_CONF", "/etc/amportal.conf");


require_once('/var/www/html/freepbx/hotel/functions.inc.php');
include_once(AGIBIN_DIR."/phpagi.php");

/******************************************************/

global $amp_conf;
$agi = new AGI();

$target = $argv[1]; // extension room

// Setup database connection
$db_user = $amp_conf["AMPDBUSER"];
$db_pass = $amp_conf["AMPDBPASS"];
$db_host = 'localhost';
$db_name = 'roomsdb';
$db_engine = 'mysql';
$datasource = $db_engine.'://'.$db_user.':'.$db_pass.'@'.$db_host.'/'.$db_name;
$db = @DB::connect($datasource); // attempt connection

if(@DB::isError($db)) {
    @$agi->verbose("Error connecting to asterisk database, skipped");
    @$agi->exec("Set", "CHANNEL(language)=en");
    @$agi->answer();
    @$agi->stream_file("alarm/contattare-reception");
    @$agi->exec("Macro","hangupcall");
    exit(0);
} else {
    $langsql="SELECT lang FROM rooms WHERE extension=\"$target\";";
    $dblang=@$db->getRow($langsql);
    $dblang=$dblang[0];
    if (!isset($dblang)){
        $langsql="SELECT value FROM options WHERE variable=\"reception_lang\";";
        $dblang=@$db->getRow($langsql);
        $dblang=$dblang[0];
        if (!isset($dblang)){ 
            $dblang = "en";
        }
    }
}

@$agi->exec("Set", "CHANNEL(language)=$dblang");

exit(0);

