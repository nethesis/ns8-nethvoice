<?php
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }

class manager_conf {

	private static $obj;

	var $_managers = array();

	// FreePBX magic ::create() call
	public static function create() {
		if (!isset(self::$obj))
			self::$obj = new manager_conf();
		return self::$obj;
	}

	// return the filename to write
	function get_filename() {
		return "manager_additional.conf";
	}
	function addManager($name, $secret, $deny, $permit, $read, $write, $writetimeout=100) {
		$this->_managers[$name]['secret'] = $secret;
		$this->_managers[$name]['deny'] = $deny;
		$this->_managers[$name]['permit'] = $permit;
		$this->_managers[$name]['read'] = $read;
		$this->_managers[$name]['write'] = $write;
		$this->_managers[$name]['writetimeout'] = $writetimeout;
	}
	// return the output that goes in the file
	function generateConf() {
		$output = "";
		foreach ($this->_managers as $name => $settings) {
			$output .= "[".$name."]\n";
			foreach ($settings as $key => $value) {
				switch ($key) {
				case 'secret':
				case 'read':
				case 'write':
					$output .= $key . " = " . $value . "\n";
					break;
				case 'writetimeout':
					$value = !empty($value)?$value:'100';
					$output .= $key . " = " . $value . "\n";
					break;
				case 'permit':
				case 'deny':
					$tmp = explode("&", $value);
					foreach ($tmp as $addr) {
						if ($addr != '') {
							$output .= $key . "=" . $addr . "\n";
						}
					}
					break;
				}
			}
		}
		$output .= "\n";
		return $output;
	}
}

function manager_get_config($engine) {
	$mc = manager_conf::create();

	switch($engine) {
	case "asterisk":
		$managers = manager_list();
		if (is_array($managers)) {
			foreach ($managers as $manager) {
				$m = manager_get($manager['name']);
				$mc->addManager($m['name'], $m['secret'], $m['deny'], $m['permit'], $m['read'], $m['write'],$m['writetimeout']);
			}
		}
		break;
	}
}

// Get the manager list
function manager_list() {
	global $db;
	$sql = "SELECT name, secret FROM manager ORDER BY name";
	$res = $db->getAll($sql, DB_FETCHMODE_ASSOC);
	if(DB::IsError($res)) {
		return null;
	}
	return $res;
}

// Get manager infos
function manager_get($p_name) {
	global $db;
	$sql = "SELECT name,secret,deny,permit,`read`,`write`, writetimeout FROM manager WHERE name = '$p_name'";
	$res = $db->getRow($sql, DB_FETCHMODE_ASSOC);
	if(DB::IsError($res)) {
		return array();
	}
	return $res;
}

// Used to set the correct values for the html checkboxes
function manager_format_out($p_tab) {
	$res['name'] = $p_tab['name'];
	$res['secret'] = $p_tab['secret'];
	$res['deny'] = $p_tab['deny'];
	$res['permit'] = $p_tab['permit'];

	$tmp = explode(',', $p_tab['read']);
	foreach($tmp as $item) {
		$res['r'.$item] = true;
	}

	$tmp = explode(',', $p_tab['write']);
	foreach($tmp as $item) {
		$res['w'.$item] = true;
	}
	$res['writetimeout'] = $p_tab['writetimeout'];
	return $res;
}

// Delete a manager
function manager_del($p_name) {
	$results = sql("DELETE FROM manager WHERE name = \"$p_name\"","query");
}

function manager_format_in($p_tab) {
	if (!isset($res['read'])) {
		$res['read'] = "";
	}
	if (!isset($res['write'])) {
		$res['write'] = "";
	}
	if (isset($p_tab['rsystem']) && $p_tab['rsystem'] == 1)
		$res['read'] .= "system,";
	if (isset($p_tab['rcall']) && $p_tab['rcall'] == 1)
		$res['read'] .= "call,";
	if (isset($p_tab['rlog']) && $p_tab['rlog'] == 1)
		$res['read'] .= "log,";
	if (isset($p_tab['rverbose']) && $p_tab['rverbose'] == 1)
		$res['read'] .= "verbose,";
	if (isset($p_tab['rcommand']) && $p_tab['rcommand'] == 1)
		$res['read'] .= "command,";
	if (isset($p_tab['ragent']) && $p_tab['ragent'] == 1)
		$res['read'] .= "agent,";
	if (isset($p_tab['ruser']) && $p_tab['ruser'] == 1)
		$res['read'] .= "user,";

  // Added for 1.6+
	if (isset($p_tab['rconfig']) && $p_tab['rconfig'] == 1)
		$res['read'] .= "config,";
	if (isset($p_tab['rdtmf']) && $p_tab['rdtmf'] == 1)
		$res['read'] .= "dtmf,";
	if (isset($p_tab['rreporting']) && $p_tab['rreporting'] == 1)
		$res['read'] .= "reporting,";
	if (isset($p_tab['rcdr']) && $p_tab['rcdr'] == 1)
		$res['read'] .= "cdr,";
	if (isset($p_tab['rdialplan']) && $p_tab['rdialplan'] == 1)
		$res['read'] .= "dialplan,";
	if (isset($p_tab['roriginate']) && $p_tab['roriginate'] == 1)
		$res['read'] .= "originate,";

	if (isset($p_tab['wsystem']) && $p_tab['wsystem'] == 1)
		$res['write'] .= "system,";
	if (isset($p_tab['wcall']) && $p_tab['wcall'] == 1)
		$res['write'] .= "call,";
	if (isset($p_tab['wlog']) && $p_tab['wlog'] == 1)
		$res['write'] .= "log,";
	if (isset($p_tab['wverbose']) && $p_tab['wverbose'] == 1)
		$res['write'] .= "verbose,";
	if (isset($p_tab['wcommand']) && $p_tab['wcommand'] == 1)
		$res['write'] .= "command,";
	if (isset($p_tab['wagent']) && $p_tab['wagent'] == 1)
		$res['write'] .= "agent,";
	if (isset($p_tab['wuser']) && $p_tab['wuser'] == 1)
		$res['write'] .= "user,";

  // Added for 1.6+
	if (isset($p_tab['wconfig']) && $p_tab['wconfig'] == 1)
		$res['write'] .= "config,";
	if (isset($p_tab['wdtmf']) && $p_tab['wdtmf'] == 1)
		$res['write'] .= "dtmf,";
	if (isset($p_tab['wreporting']) && $p_tab['wreporting'] == 1)
		$res['write'] .= "reporting,";
	if (isset($p_tab['wcdr']) && $p_tab['wcdr'] == 1)
		$res['write'] .= "cdr,";
	if (isset($p_tab['wdialplan']) && $p_tab['wdialplan'] == 1)
		$res['write'] .= "dialplan,";
	if (isset($p_tab['woriginate']) && $p_tab['woriginate'] == 1)
		$res['write'] .= "originate,";

  $res['read'] = rtrim($res['read'],',');
  $res['write'] = rtrim($res['write'],',');
	return $res;
}

// Add a manager
function manager_add($p_name, $p_secret, $p_deny, $p_permit, $p_read, $p_write, $p_writetimeout=100) {
	global $amp_conf;
	$managers = manager_list();
	$ampuser = $amp_conf['AMPMGRUSER'];
	if($p_name == $ampuser) {
		echo "<script>javascript:alert('"._("This manager already exists")."');</script>";
		return false;
	}
	if (is_array($managers)) {
		foreach ($managers as $manager) {
			if ($manager['name'] === $p_name) {
				echo "<script>javascript:alert('"._("This manager already exists")."');</script>";
				return false;
			}
		}
	}
	$results = sql("INSERT INTO manager set name='$p_name' , secret='$p_secret' , deny='$p_deny' , permit='$p_permit' , `read`='$p_read' , `write`='$p_write' , `writetimeout`='$p_writetimeout'");
}


// Asterisk API Module hooking
// Input:
//   $p_manager = default selected user
//   $dummy = unused
// $viewing_itemid, $target_menuid
function manager_hook_phpagiconf($viewing_itemid, $target_menuid) {
        global $db;

	switch($target_menuid) {
		case 'phpagiconf':
			$sql = "SELECT asman_user FROM phpagiconf";
			$res = $db->getRow($sql, DB_FETCHMODE_ASSOC);
			if(DB::IsError($res)) {
				return null;
			}
			$selectedmanager = $res['asman_user'];
		break;
	}
	$output = "<tr><td><a href=\"#\" class=\"info\">"._("Choose Manager:")."<span>"._("Choose the user that PHPAGI will use to connect the Asterisk API.")."</span></a></td><td><select name=\"asmanager\">";
	$selected = "";
	$managers = manager_list();
	foreach ($managers as $manager) {
		($manager['name'] === $selectedmanager) ? $selected="selected=\"selected\"" : $selected="";
		$output .= "<option value=\"".$manager['name']."/".$manager['secret']."\" $selected>".$manager['name'];
	}
	$output .="</select></td></tr>";
	return $output;
}

?>
