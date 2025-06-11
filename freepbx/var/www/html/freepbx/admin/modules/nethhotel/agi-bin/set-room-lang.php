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

/******************************************************/
$agi = new AGI();

$target = $argv[1]; // extension room

$langsql = "SELECT lang FROM rooms WHERE extension=?";
$stmt = $db->prepare($langsql);
$stmt->execute([$target]);
$res = $stmt->fetchAll();
$dblang = $res[0][0] ?? null;

if (!isset($dblang)){
	$langsql = "SELECT value FROM options WHERE variable=?";
	$stmt = $db->prepare($langsql);
	$stmt->execute(["reception_lang"]);
	$res = $stmt->fetchAll();
	$dblang = $res[0][0] ?? null;
	
	if (!isset($dblang)){ 
		$dblang = "en";
	}
}

@$agi->exec("Set", "CHANNEL(language)=$dblang");
