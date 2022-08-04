<?php
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
//for translation only
if (false) {
_("Findme Follow Toggle");
}

$fcc = new featurecode('findmefollow', 'fmf_toggle');
$fcc->setDescription('Findme Follow Toggle');
$fcc->setDefault('*21');
$fcc->update();
unset($fcc);


$sql = "SELECT * FROM findmefollow";
$stmt = FreePBX::Database()->prepare($sql);
$stmt->execute();
$userresults = $stmt->fetchAll(\PDO::FETCH_ASSOC);
global $astman;
//add details to astdb
if ($astman) {
	foreach($userresults as $usr) {
		extract($usr);
		$astman->database_put("AMPUSER",$grpnum."/followme/prering",isset($pre_ring)?$pre_ring:'');
		$astman->database_put("AMPUSER",$grpnum."/followme/grptime",isset($grptime)?$grptime:'');
		$astman->database_put("AMPUSER",$grpnum."/followme/grplist",isset($grplist)?$grplist:'');
		$confvalue = ($needsconf == 'CHECKED')?'ENABLED':'DISABLED';
		$astman->database_put("AMPUSER",$grpnum."/followme/grpconf",isset($needsconf)?$confvalue:'');
		$ddial = $astman->database_get("AMPUSER",$grpnum."/followme/ddial");
		$ddial = ($ddial == 'EXTENSION' || $ddial == 'DIRECT')?$ddial:'DIRECT';
		$astman->database_put("AMPUSER",$grpnum."/followme/ddial",$ddial);
	}
} else {
	echo _("Cannot connect to Asterisk Manager with ").$amp_conf["AMPMGRUSER"]."/".$amp_conf["AMPMGRPASS"];
}

$freepbx_conf =& freepbx_conf::create();

// FOLLOWME_AUTO_CREATE
//
$set['value'] = false;
$set['defaultval'] =& $set['value'];
$set['readonly'] = 0;
$set['hidden'] = 0;
$set['level'] = 1;
$set['module'] = 'findmefollow';
$set['category'] = 'Follow Me Module';
$set['emptyok'] = 0;
$set['sortorder'] = 30;
$set['name'] = 'Create Follow Me at Extension Creation Time';
$set['description'] = 'When creating a new user or extension, setting this to true will automatically create a new Follow Me for that user using the default settings listed below';
$set['type'] = CONF_TYPE_BOOL;
$freepbx_conf->define_conf_setting('FOLLOWME_AUTO_CREATE',$set);

// FOLLOWME_DISABLED
//
$set['value'] = true;
$set['defaultval'] =& $set['value'];
$set['readonly'] = 0;
$set['hidden'] = 0;
$set['level'] = 1;
$set['module'] = 'findmefollow';
$set['category'] = 'Follow Me Module';
$set['emptyok'] = 0;
$set['sortorder'] = 40;
$set['name'] = 'Disable Follow Me Upon Creation';
$set['description'] = 'This is the default value for the Follow Me "Disable" setting. When first creating a Follow Me or if auto-created with a new extension, setting this to true will disable the Follow Me setting which can be changed by the user or admin in multiple locations.';
$set['type'] = CONF_TYPE_BOOL;
$freepbx_conf->define_conf_setting('FOLLOWME_DISABLED',$set);

// FOLLOWME_TIME
//
unset($options);
for ($i=5;$i<=120;$i++) {
  $options[] = $i;
}
$set['value'] = '20';
$set['defaultval'] =& $set['value'];
$set['options'] = $options;
$set['readonly'] = 0;
$set['hidden'] = 0;
$set['level'] = 1;
$set['module'] = 'findmefollow';
$set['category'] = 'Follow Me Module';
$set['emptyok'] = 0;
$set['sortorder'] = 50;
$set['name'] = "Default Follow Me Ring Time";
$set['description'] = "The default Ring Time for a Follow Me set upon creation and used if auto-created with a new extension.";
$set['type'] = CONF_TYPE_SELECT;
$freepbx_conf->define_conf_setting('FOLLOWME_TIME',$set);

// FOLLOWME_PRERING
//
unset($options);
for ($i=5;$i<=60;$i++) {
  $options[] = $i;
}
$set['value'] = '7';
$set['defaultval'] =& $set['value'];
$set['options'] = $options;
$set['readonly'] = 0;
$set['hidden'] = 0;
$set['level'] = 1;
$set['module'] = 'findmefollow';
$set['category'] = 'Follow Me Module';
$set['emptyok'] = 0;
$set['sortorder'] = 60;
$set['name'] = "Default Follow Me Initial Ring Time";
$set['description'] = "The default Initial Ring Time for a Follow Me set upon creation and used if auto-created with a new extension.";
$set['type'] = CONF_TYPE_SELECT;
$freepbx_conf->define_conf_setting('FOLLOWME_PRERING',$set);

// FOLLOWME_RG_STRATEGY
//
$set['value'] = 'ringallv2-prim';
$set['defaultval'] =& $set['value'];
$set['options'] = array('ringallv2','ringallv2-prim','ringall','ringall-prim','hunt','hunt-prim','memoryhunt','memoryhunt-prim','firstavailable','firstnotonphone');
$set['readonly'] = 0;
$set['hidden'] = 0;
$set['level'] = 1;
$set['module'] = 'findmefollow';
$set['category'] = 'Follow Me Module';
$set['emptyok'] = 0;
$set['sortorder'] = 70;
$set['name'] = 'Default Follow Me Ring Strategy';
$set['description'] = "The default Ring Strategy selected for a Follow Me set upon creation and used if auto-created with an extension.";
$set['type'] = CONF_TYPE_SELECT;
$freepbx_conf->define_conf_setting('FOLLOWME_RG_STRATEGY',$set);

$freepbx_conf->commit_conf_settings();
