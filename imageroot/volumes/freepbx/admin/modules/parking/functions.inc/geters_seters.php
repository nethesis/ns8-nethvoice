<?php
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }

/* Parking APIs
 */

/** parking_get
 * Short get parking settings
 * Long get the parking lot settings
 *
 * @author Philippe Lindheimer
 * @param mixed $id
 * @return array
 */
function parking_get($id = 'default') {
    return \FreePBX::Parking()->parkingGet($id);
}

/** parking_save
 * Short insert or update parking settings
 * Long takes array of settings to update, missing settings will
 * get default values, if id not present it will insert a new row.
 * Returns the id of the current or newly inserted record or
 * boolean false upon a failure.
 *
 * @author Philippe Lindheimer
 * @param array $parms
 * @return mixed
 */
function parking_save($parms=array()) {
	global $db, $amp_conf;

	if (!empty($parms['id'])) {
		$var['id'] = $db->escapeSimple($parms['id']);
	}
	if (!function_exists('parkpro_get')) {
		$var['id'] = 1;
	}
	$var['name'] = "Parking Lot";
	$var['type'] = 'public';
	$var['parkext'] = '';
	$var['parkpos'] = '';
	$var['numslots'] = 4;
	$var['parkingtime'] = 45;
	$var['parkedmusicclass'] = 'default';
	$var['generatefc'] = 'yes';
	$var['findslot'] = 'first';
	$var['parkedplay'] = 'both';
	$var['parkedcalltransfers'] = 'caller';
	$var['parkedcallreparking'] = 'caller';
	$var['alertinfo'] = '';
	$var['cidpp'] = '';
	$var['autocidpp'] = 'none';
	$var['announcement_id'] = null;
	$var['comebacktoorigin'] = 'yes';
	$var['dest'] = '';
	$var['defaultlot'] = 'yes';
	$var['rvolume'] = '';

	foreach ($var as $k => $v) {
		if (isset($parms[$k])) {
			$var[$k] = $db->escapeSimple($parms[$k]);
		}
	}
	$var['defaultlot'] = isset($var['id']) && $var['id'] == 1 ? 'yes' : 'no';

	$fields = "name, type, parkext, parkpos, numslots, parkingtime, parkedmusicclass, generatefc, findslot, parkedplay,
		parkedcalltransfers, parkedcallreparking, alertinfo, cidpp, autocidpp, announcement_id, comebacktoorigin, dest, defaultlot, rvolume";
	$holders = "?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?";

	if (empty($var['id'])) {
		$sql = "INSERT INTO parkplus ($fields) VALUES ($holders)";
	} else {
		$sql = "REPLACE INTO parkplus (id, $fields) VALUES (?,$holders)";
	}

	$res = $db->query($sql,array_values($var));
	if (DB::IsError($res)) {
		$id = false;
		// TODO log error
	} elseif (empty($var['id'])) {
		if(method_exists($db,'insert_id')) {
			$id = $db->insert_id();
		} else {
			$id = $amp_conf["AMPDBENGINE"] == "sqlite3" ? sqlite_last_insert_rowid($db->connection) : mysql_insert_id($db->connection);
		}
        needreload();
	} else {
		$id = $var['id'];
        needreload();
	}
	return $id;
}
