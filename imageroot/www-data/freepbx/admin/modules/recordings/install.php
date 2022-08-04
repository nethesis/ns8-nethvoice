<?php
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
//for translation only
if (false) {
_("Recordings");
_("Save Recording");
_("Check Recording");
}

global $amp_conf;
global $db;

$recordings_astsnd_path = isset($amp_conf['ASTVARLIBDIR'])?$amp_conf['ASTVARLIBDIR']:'/var/lib/asterisk';
$recordings_astsnd_path .= "/sounds/";
$autoincrement = (($amp_conf["AMPDBENGINE"] == "sqlite") || ($amp_conf["AMPDBENGINE"] == "sqlite3")) ? "AUTOINCREMENT":"AUTO_INCREMENT";

$fcc = new featurecode('recordings', 'record_save');
$fcc->delete();
unset($fcc);

$fcc = new featurecode('recordings', 'record_check');
$fcc->delete();
unset($fcc);

// Make sure table exists
$sql = "CREATE TABLE IF NOT EXISTS recordings (
	`id` INTEGER NOT NULL  PRIMARY KEY AUTO_INCREMENT,
	`displayname` VARCHAR(50) ,
	`filename` BLOB,
	`description` VARCHAR(254),
	`fcode` tinyint(1) DEFAULT '0',
	`fcode_pass` varchar(20),
	`fcode_lang` varchar(20)
);";
$result = $db->query($sql);
if(DB::IsError($result)) {
	die_freepbx($result->getDebugInfo());
}

// Version 2.5 upgrade
outn(_("checking for fcode field.."));
$sql = "SELECT `fcode` FROM recordings";
$check = $db->getRow($sql, DB_FETCHMODE_ASSOC);
if(DB::IsError($check)) {
	// add new field
	$sql = "ALTER TABLE recordings ADD `fcode` TINYINT( 1 ) DEFAULT 0 ;";
	$result = $db->query($sql);
	if(DB::IsError($result)) {
		die_freepbx($result->getDebugInfo());
	}
	out(_("OK"));
} else {
	out(_("already exists"));
}
outn(_("checking for fcode_pass field.."));
$sql = "SELECT `fcode_pass` FROM recordings";
$check = $db->getRow($sql, DB_FETCHMODE_ASSOC);
if(DB::IsError($check)) {
	// add new field
	$sql = "ALTER TABLE recordings ADD `fcode_pass` VARCHAR( 20 ) NULL ;";
	$result = $db->query($sql);
	if(DB::IsError($result)) {
		die_freepbx($result->getDebugInfo());
	}
	out(_("OK"));
} else {
	out(_("already exists"));
}

outn(_("checking for fcode_lang field.."));
$sql = "SELECT `fcode_lang` FROM recordings";
$check = $db->getRow($sql, DB_FETCHMODE_ASSOC);
if(DB::IsError($check)) {
	// add new field
	$sql = "ALTER TABLE recordings ADD `fcode_lang` VARCHAR( 20 ) NULL ;";
	$result = $db->query($sql);
	if(DB::IsError($result)) {
		die_freepbx($result->getDebugInfo());
	}
	out(_("OK"));
} else {
	out(_("already exists"));
}
sql('DELETE FROM recordings WHERE displayname = "__invalid"');
$freepbx_conf =& freepbx_conf::create();
if($freepbx_conf->conf_setting_exists('AMPPLAYKEY')) {
	$freepbx_conf->remove_conf_setting('AMPPLAYKEY');
}

$dir = FreePBX::Config()->get("ASTVARLIBDIR")."/sounds";
$sql = "SELECT * FROM recordings";
$sth = FreePBX::Database()->prepare($sql);
$sth->execute();
$recordings = $sth->fetchAll(\PDO::FETCH_ASSOC);
$default = FreePBX::Soundlang()->getLanguage();
if(!file_exists($dir."/".$default."/custom")) {
	mkdir($dir."/".$default."/custom", 0777, true);
}
foreach($recordings as $recording) {
	$files = explode("&",$recording['filename']);
	$filenames = array();
	foreach($files as $file) {
		//move all custom files to the default language first
		if(preg_match("/^custom\/(.*)/",$file,$matches)) {
			foreach(glob($dir."/custom/".$matches[1].".*") as $f) {
				$ff = basename($f);
				rename($f,$dir."/".$default."/custom/".$ff);
			}
			$filenames[] = $file;
		//if any files are using languages then remove the language since Asterisk does this for us
		} elseif(preg_match("/^(?:\w{2}\_\w{2}|\w{2}\/)/",$file)) {
			$filenames[] = preg_replace("/^(?:\w{2}\_\w{2}|\w{2}\/)/", "", $file);
		//Else just use the file as is
		} else {
			$filenames[] = $file;
		}
	}
	$sql = "UPDATE recordings SET filename = ? WHERE id = ?";
	$sth = FreePBX::Database()->prepare($sql);
	$sth->execute(array(implode('&',$filenames), $recording['id']));
}

if(file_exists($dir."/custom")) {
	$files = glob($dir."/custom/*");
	foreach($files as $file) {
		if (is_dir($file)) {
			// We don't handle directories. Ignore them, they were put
			// there by the user, and if we move them we'll break things.
			continue;
		}
		$parts = pathinfo($file);
		rename($file,$dir."/".$default."/custom/".$parts['filename']);
		FreePBX::Recordings()->addRecording($parts['filename'],"Migrated file","custom/".$parts['filename']);
	}
	$files = glob($dir."/custom/*");
	if(empty($files)) {
		rmdir($dir."/custom");
	}
}
