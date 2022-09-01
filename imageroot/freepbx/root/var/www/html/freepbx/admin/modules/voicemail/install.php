<?php
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2006-2013 Schmooze Com Inc.s
//
//for translation only
if (false) {
_("Voicemail");
_("My Voicemail");
_("Dial Voicemail");
_("Voicemail Admin");
_("Direct Dial Prefix");
_("The Feature Code used to direct dial a users voicemail from their own extension");
_("The Feature Code used to dial any voicemail");
}

global $astman;
global $amp_conf;
global $db;

$fcc = new featurecode('voicemail', 'myvoicemail');
$fcc->setDescription('My Voicemail');
$fcc->setHelpText('The Feature Code used to direct dial a users voicemail from their own extension');
$fcc->setDefault('*97');
$fcc->update();
unset($fcc);

$fcc = new featurecode('voicemail', 'dialvoicemail');
$fcc->setDescription('Dial Voicemail');
$fcc->setHelpText('The Feature Code used to dial any voicemail');
$fcc->setDefault('*98');
$fcc->setProvideDest();
$fcc->update();
unset($fcc);

$sql = " CREATE TABLE IF NOT EXISTS `voicemail_admin` (
  `variable` varchar(30) NOT NULL DEFAULT '',
  `value` varchar(80) NOT NULL DEFAULT '',
  PRIMARY KEY (`variable`)
);";
sql($sql);

$globals_convert['OPERATOR_XTN'] = '';
$globals_convert['VM_OPTS'] = '';
$globals_convert['VM_GAIN'] = '';
$globals_convert['VM_DDTYPE'] = 'u';

$globals_convert['VMX_OPTS_TIMEOUT'] = '';

$globals_convert['VMX_OPTS_LOOP'] = '';
$globals_convert['VMX_OPTS_DOVM'] = '';
$globals_convert['VMX_TIMEOUT'] = '2';
$globals_convert['VMX_REPEAT'] = '1';
$globals_convert['VMX_LOOPS'] = '1';

// Migrate the global settings now being managed here
//
$sql = "SELECT `variable`, `value`";
$sql_where = " FROM globals WHERE `variable` IN ('".implode("','",array_keys($globals_convert))."')";
$sql .= $sql_where;
$globals = $db->getAll($sql,DB_FETCHMODE_ASSOC);
if(DB::IsError($globals)) {
  die_freepbx($globals->getMessage());
}
outn(_("Checking for General Setting migrations.."));
if (count($globals)) {
  out(_("preparing"));
  foreach ($globals as $global) {
		unset($globals_convert[$global['variable']]);
		switch ($global['variable']) {
		case 'VMX_OPTS_TIMEOUT':
    	out(sprintf(_("%s no longer used"),$global['variable']));
		break;
		case 'VM_GAIN':
			if (is_numeric($global['value']) && $global['value'] >= 15) {
    		out(sprintf(_("%s changed from %s to max value 15"),$global['variable'], $global['value']));
				$global['value'] = 15;
			} else if (is_numeric($global['value'])) {
				$gain = ceil(round($global['value']) / 3) * 3;
				if ($gain != $global['value']) {
    			out(sprintf(_("%s adjusted from %s to %s"),$global['variable'], $global['value'], $gain));
					$global['value'] = $gain;
				}
			} else if ($global['value'] != '') {
   			out(sprintf(_("%s adjusted from bad value %s to default no gain"), $global['variable'], $global['value']));
				$global['value'] = '';
			}
			// FALL THROUGH TO SAVE
		default:
			$sql = 'INSERT INTO `voicemail_admin` (`variable`, `value`) VALUES ("' . $global['variable'] . '","' . $global['value'] . '")';;
			$result = $db->query($sql);
			if(DB::IsError($result)) {
				out(sprintf(_("ERROR inserting %s into voicemail_admin during migration, it may alreayd exist"), $global['variable']));
			} else {
 				out(sprintf(_("%s migrated"),$global['variable']));
			}
		break;
		}
	}
} else {
  out(_("not needed"));
}

// Now add any defaults not found in the globals table even though that should not happen
// if already there we just ignore
if (isset($globals_convert['VMX_OPTS_TIMEOUT'])) {
	unset($globals_convert['VMX_OPTS_TIMEOUT']);
}
if(!empty($globals_convert)) {
  foreach ($globals_convert as $key => $value) {
  	$sql = 'INSERT INTO `voicemail_admin` (`variable`, `value`) VALUES ("' . $key . '","' . $value . '")';;
  	$result = $db->query($sql);
  	if(!DB::IsError($result)) {
  		out(sprintf(_("%s added"),$key));
  	}
  }
}

if (count($globals)) {
	out(_("General Settings migrated"));
	outn(_("Deleting migrated settings.."));
  $sql = "DELETE".$sql_where;
  $globals = $db->query($sql);
  if(DB::IsError($globals)) {
	  out(_("Fatal DB error trying to delete globals, trying to carry on"));
  } else {
	  out(_("done"));
  }
}

// Migrate VM_PREFIX from globals if needed
//
$current_prefix = $default_prefix = '*';
$sql = "SELECT `value` FROM globals WHERE `variable` = 'VM_PREFIX'";
$globals = $db->getAll($sql,DB_FETCHMODE_ASSOC);
if(!DB::IsError($globals)) {
	if (count($globals)) {
		$current_prefix = trim($globals[0]['value']);
		$sql = "DELETE FROM globals WHERE `variable` = 'VM_PREFIX'";
		out(_("migrated VM_PREFIX to feature codes"));
		outn(_("deleting VM_PREFIX from globals.."));
		$res = $db->query($sql);
		if(!DB::IsError($globals)) {
			out(_("done"));
		} else {
			out(_("could not delete"));
		}
	}
}

// Now setup the new feature code, if blank then disable
//
$fcc = new featurecode('voicemail', 'directdialvoicemail');
$fcc->setDescription('Direct Dial Prefix');
$fcc->setDefault($default_prefix);
if ($current_prefix != $default_prefix) {
	if ($current_prefix != '') {
		$fcc->setCode($current_prefix);
	} else {
		$fcc->setEnabled(false);
	}
}
$fcc->update();
unset($fcc);

//1.6.2
$ver = modules_getversion('voicemail');
if ($ver !== null && version_compare($ver,'1.6.2','lt')) { //we have to fix existing users with wrong values for vm ticket #1697
	if ($astman) {
		$sql = "select * from users where voicemail='disabled' or voicemail='';";
		$users = sql($sql,"getAll",DB_FETCHMODE_ASSOC);
		foreach($users as $user) {
			$astman->database_put("AMPUSER",$user['extension']."/voicemail","\"novm\"");
		}
	} else {
		echo _("Cannot connect to Asterisk Manager with ").$amp_conf["AMPMGRUSER"]."/".$amp_conf["AMPMGRPASS"];
		return false;
	}
	sql("update users set voicemail='novm' where voicemail='disabled' or voicemail='';");
}

// vmailadmin module functionality has been fully incporporated into this module
// so if it is installed we remove and delete it from the repository.
//
outn(_("checking if Voicemail Admin (vmailadmin) is installed.."));
$modules = module_getinfo('vmailadmin');
if (!isset($modules['vmailadmin'])) {
  out(_("not installed, ok"));
} else {
  out(_("installed."));
  out(_("Voicemail Admin being removed and merged with Voicemail"));
  outn(_("Attempting to delete.."));
  $result = module_delete('vmailadmin');
  if ($result === true) {
    out(_("ok"));
  } else {
    out($result);
  }
}

$freepbx_conf =& freepbx_conf::create();

// VM_SHOW_IMAP
//
$set['value'] = false;
$set['defaultval'] =& $set['value'];
$set['readonly'] = 0;
$set['hidden'] = 0;
$set['level'] = 3;
$set['module'] = 'voicemail';
$set['category'] = 'Voicemail Module';
$set['emptyok'] = 0;
$set['sortorder'] = 100;
$set['name'] = 'Provide IMAP Voicemail Fields';
$set['description'] = 'Installations that have configured Voicemail with IMAP should set this to true so that the IMAP username and password fields are provided in the Voicemail setup screen for extensions. If an extension alread has these fields populated, they will be displayed even if this is set to false.';
$set['type'] = CONF_TYPE_BOOL;
$freepbx_conf->define_conf_setting('VM_SHOW_IMAP',$set,true);

// USERESMWIBLF
//
$set['value'] = (file_exists($amp_conf['ASTMODDIR']."/res_mwi_blf.so") || file_exists($amp_conf['ASTMODDIR']."/res_mwi_devstate.so"));
$set['defaultval'] =& $set['value'];
$set['readonly'] = 0;
$set['hidden'] = 0;
$set['level'] = 3;
$set['module'] = 'voicemail';
$set['category'] = 'Voicemail Module';
$set['emptyok'] = 0;
$set['sortorder'] = 100;
$set['name'] = 'Create Voicemail Hints';
$set['description'] = 'Setting this flag with generate the required dialplan to integrate with res_mwi_devstate (res_mwi_blf) which is included with the Official FreePBX Distro. It allows users to subscribe to other voicemail box and be notified via BLF of changes.';
$set['type'] = CONF_TYPE_BOOL;
$freepbx_conf->define_conf_setting('USERESMWIBLF',$set,true);

//UCP_MESSAGE_LIMIT
$set['value'] = 3000;
$set['defaultval'] =& $set['value'];
$set['options'] = array(1,100000);
$set['readonly'] = 0;
$set['hidden'] = 0;
$set['level'] = 3;
$set['module'] = 'voicemail';
$set['category'] = 'Voicemail Module';
$set['emptyok'] = 0;
$set['sortorder'] = 100;
$set['name'] = 'UCP Message Limit';
$set['description'] = 'Limit the Messages to be Displayed in UCP. If your device has more processing power you can increase this otherwise lower it if you find your system not responsive';
$set['type'] = CONF_TYPE_INT;
$freepbx_conf->define_conf_setting('UCP_MESSAGE_LIMIT',$set,true);

/*
  update modules.conf to make sure it preloads res_mwi_blf.so if they have it
  This makes sure that the modules.conf has been updated for older systems
  which assures that mwi blf events are captured when Asterisk first starts
*/
$amd = FreePBX::create()->Config->get_conf_setting('ASTMODDIR');
if(file_exists($amd.'/res_mwi_blf.so')) {
	FreePBX::create()->ModulesConf->preload('res_mwi_blf.so');
}

/** FREEPBX-8130 Migrate email body into GUI **/
$aed = FreePBX::create()->Config->get_conf_setting('ASTETCDIR');
global $gen_settings;
if(file_exists($aed.'/vm_email.inc')) {
  $contents = FreePBX::LoadConfig()->getConfig('vm_email.inc');
  $final = array();
  if(!empty($contents['HEADER']) && is_array($contents['HEADER'])) {
    foreach($contents['HEADER'] as $key => $val) {
      $final["gen__".$key] = $val;
      $gen_settings[$key] = "";
    }
  }
  if(!empty($final)) {
    if(!function_exists('voicemail_update_settings')) {
      include(__DIR__.'/functions.inc.php');
    }
    voicemail_update_settings("settings", "", "", $final);
  }
  unlink($aed.'/vm_email.inc');
}
if(file_exists($aed.'/vm_general.inc')) {
  $contents = FreePBX::LoadConfig()->getConfig('vm_general.inc');
  $final = array();
  if(!empty($contents['HEADER']) && is_array($contents['HEADER'])) {
    foreach($contents['HEADER'] as $key => $val) {
      $final["gen__".$key] = $val;
      $gen_settings[$key] = "";
    }
  }
  if(!empty($final)) {
    if(!function_exists('voicemail_update_settings')) {
      include(__DIR__.'/functions.inc.php');
    }
    voicemail_update_settings("settings", "", "", $final);
  }
  unlink($aed.'/vm_general.inc');
}


$vmconf = \FreePBX::Voicemail()->getVoicemail(false);
if(!empty($vmconf)) {
	$dsettings = $settings = \FreePBX::Voicemail()->constructSettings("general");
	foreach($dsettings as $data) {
		foreach($data['settings'] as $key => $items) {
			if($items['default'] !== '' && !isset($vmconf['general'][$key])) {
				$vmconf['general'][$key] = $items['default'];
			}
		}
	}
	\FreePBX::Voicemail()->saveVoicemail($vmconf);
}
