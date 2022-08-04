<?php
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
global $db;

$sql = "CREATE TABLE IF NOT EXISTS `vmblast` (
	`grpnum` BIGINT( 20 ) NOT NULL ,
	`description` VARCHAR( 35 ) NOT NULL ,
	`audio_label` INT( 11 ) NOT NULL DEFAULT -1 ,
	`password` VARCHAR( 20 ) NOT NULL ,
	PRIMARY KEY  (`grpnum`)
); ";

$result = $db->query($sql);
if (DB::IsError($result)) {
	die_freepbx($result->getDebugInfo());
}
unset($result);

$sql = "CREATE TABLE IF NOT EXISTS vmblast_groups (
	grpnum  BIGINT(20) NOT NULL,
	ext VARCHAR(25),
	PRIMARY KEY (grpnum , ext)
);";

$result = $db->query($sql);
if (DB::IsError($result)) {
	die_freepbx($result->getDebugInfo());
}
unset($result);

$info = $db->getRow('SHOW COLUMNS FROM vmblast WHERE FIELD = "grpnum"', DB_FETCHMODE_ASSOC);
if($info['type'] !== "bigint(20)") {
	$sql = "ALTER TABLE `vmblast` CHANGE COLUMN `grpnum` `grpnum` BIGINT NOT NULL";
	$result = $db->query($sql);
	if (DB::IsError($result)) {
		die_freepbx($result->getDebugInfo());
	}
}

$info = $db->getRow('SHOW COLUMNS FROM vmblast_groups WHERE FIELD = "grpnum"', DB_FETCHMODE_ASSOC);
if($info['type'] !== "bigint(20)") {
	$sql = "ALTER TABLE `vmblast_groups` CHANGE COLUMN `grpnum` `grpnum` BIGINT NOT NULL";
	$result = $db->query($sql);
	if (DB::IsError($result)) {
		die_freepbx($result->getDebugInfo());
	}
}

outn(_("Upgrading vmblast to add audio_label field.."));
$sql = "SELECT audio_label FROM vmblast";
$confs = $db->getRow($sql, DB_FETCHMODE_ASSOC);
if (!DB::IsError($confs)) { // no error... Already done
	out(_("Not Required"));
} else {
	$sql = "ALTER TABLE vmblast ADD audio_label INT ( 11 ) NOT NULL DEFAULT -1";
	$results = $db->query($sql);
	if(DB::IsError($results)) {
	        die_freepbx($results->getMessage());
	}
	out(_("Done"));
}

outn(_("Upgrading vmblast to add password field.."));
$sql = "SELECT password FROM vmblast";
$confs = $db->getRow($sql, DB_FETCHMODE_ASSOC);
if (!DB::IsError($confs)) { // no error... Already done
	out(_("Not Required"));
} else {
	$sql = "ALTER TABLE vmblast ADD password VARCHAR ( 20 ) NOT NULL";
	$results = $db->query($sql);
	if(DB::IsError($results)) {
	        die_freepbx($results->getMessage());
	}
	out(_("Done"));
}

// Drop grplist field but first pull it's data and put in new table
//
outn(_("Dropping grplist.."));
$sql = 'SELECT grpnum, grplist FROM vmblast';
$confs = $db->getAll($sql, DB_FETCHMODE_ASSOC);
if (!DB::IsError($confs)) {
	$list = array();
	foreach ($confs as $group) {
		$grplist = explode('&',$group['grplist']);
		foreach ($grplist as $exten) {
			$list[] = array($group['grpnum'],addslashes(trim($exten)));
		}
	}
	$compiled = $db->prepare("INSERT INTO vmblast_groups (grpnum, ext) values (?,?)");
	$result   = $db->executeMultiple($compiled, $list);
	if(DB::IsError($result)) {
		out(_("error populating vmblast_groups table"));
		return false;
	} else {
		out(_("populated new table"));
		outn(_("Dropping old grplist field.."));
		$sql = "ALTER TABLE `vmblast` DROP `grplist`";
		$results = $db->query($sql);
		if(DB::IsError($results)) {
			out(_("failed to drop field"));
		} else {
			out(_("OK"));
		}
	}
} else {
	out(_("Not Needed"));
}

?>
