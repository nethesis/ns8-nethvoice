#!/usr/bin/env php
<?php
//
// Copyright (C) 2010-2015 Nethesis s.r.l. - All rights reserved. 
//
define("AGIBIN_DIR", "/var/lib/asterisk/agi-bin");
define("AMPORTAL_CONF", "/etc/amportal.conf");


require_once('/var/www/html/freepbx/hotel/functions.inc.php');
include_once(AGIBIN_DIR."/phpagi.php");

$debug = false;

function neth_debug($text) {
    global $agi;
    global $debug;
    if ($debug)
    	@$agi->verbose($text);
}

function exitError()
{
  global $agi;
  neth_debug("exitError()");
  @$agi->answer();
  @$agi->stream_file("alarm/contattare-reception");
  @$agi->exec("Macro","hangupcall");
  exit(0);
}


/******************************************************/

global $amp_conf;
$agi = new AGI();

// Setup database connection
$db_user = $amp_conf["AMPDBUSER"];
$db_pass = $amp_conf["AMPDBPASS"];
$db_host = 'localhost';
$db_name = 'asterisk';
$db_engine = 'mysql';
$datasource = $db_engine.'://'.$db_user.':'.$db_pass.'@'.$db_host.'/'.$db_name;
$db = @DB::connect($datasource); // attempt connection
$registerd=false;


if(@DB::isError($db)) {
    @$agi->verbose("Error connecting to asterisk database, skipped");
    exitError();
} else {
    $langsql="SELECT value FROM roomsdb.options WHERE variable=\"reception_lang\";";
    $langresult=@$db->getRow($langsql);
    $dblang=$langresult[0];

    if (!isset($dblang))
        $dblang = "en";
}

@$agi->exec("Set", "CHANNEL(language)=$dblang");

exit(0);

?>
