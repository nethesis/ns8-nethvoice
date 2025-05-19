#!/usr/bin/env php
<?php
//PHPLICENSE 

define("AGIBIN_DIR", "/var/lib/asterisk/agi-bin");
define("AMPORTAL_CONF", "/etc/amportal.conf");
define("MAX_TRIES",3);
define("TODAY",'1');
define("TOMORROW",'2');


require_once('/var/www/html/freepbx/hotel/functions.inc.php');
include_once(AGIBIN_DIR."/phpagi.php");

$debug=false;

function neth_debug($text) {
    global $agi;
    global $debug;
    if ($debug)
    	@$agi->verbose($text);
}

function salvato($file='') {
    global $agi;
    @$agi->exec("wait","1");
    @$agi->stream_file("beep");
    if ($file!='')
    	@$agi->stream_file($file);
    @$agi->exec("wait","2");
}

function exitError()
{
  @$agi->stream_file("alarm/arrivederci-errore");
  exit(1);
}


/******************************************************/

global $amp_conf;
$agi = new AGI();

$target = $argv[1];

//Setup database connection:
$db_user = $amp_conf["AMPDBUSER"];
$db_pass = $amp_conf["AMPDBPASS"];
$db_host = 'localhost';
$db_name = 'asterisk';
$db_engine = 'mysql';
$datasource = $db_engine.'://'.$db_user.':'.$db_pass.'@'.$db_host.'/'.$db_name;
$db = @DB::connect($datasource); // attempt connection


if(@DB::isError($db)) {
        @$agi->verbose("Error conecting to asterisk database, skipped");
        @$agi->stream_file("alarm/arrivederci-errore");
} else {
	$cdidsql="SELECT * FROM roomsdb.rooms WHERE  extension=$target";
	$res=@$db->getAll($cdidsql);
	neth_debug($cdidsql);
	if(count($res))
	{
          cleanRoom($target);
	  @$agi->stream_file("ascending-2tone");
	  @$agi->stream_file("activated");
	} else {
	    // Room wasn't in dirty state, just send FIAS Clean/Vacant
            fias('RE2PMS', array(
                'RN' => $target,
                'RS' => 3
                )
	    );

	  @$agi->stream_file("ascending-2tone");
	  @$agi->stream_file("activated");
  	}
	  neth_debug("PULIZIA: $target");
	}

exit(0);

