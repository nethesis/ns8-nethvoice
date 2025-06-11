#!/usr/bin/env php
<?php
//
// Copyright (C) 2010-2015 Nethesis s.r.l. - All rights reserved. 
//
define("AGIBIN_DIR", "/var/lib/asterisk/agi-bin");
define("AMPORTAL_CONF", "/etc/amportal.conf");


require_once('/var/www/html/freepbx/hotel/functions.inc.php');
include_once(AGIBIN_DIR."/phpagi.php");
include_once('/etc/freepbx_db.conf');
$agi = new AGI();

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

$sql="SELECT value FROM roomsdb.options WHERE variable=?;";
$stmt = $db->prepare($sql);
$stmt->execute(['reception_lang']);
$res = $stmt->fetchAll();
$dblang = $res[0][0] ?? null;

if (!isset($dblang))
	$dblang = "en";

@$agi->exec("Set", "CHANNEL(language)=$dblang");