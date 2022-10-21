<?php
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2013 Schmooze Com Inc.
//  Copyright 2008 by Moshe Brevda mbrevda=>gmail[com]

function setcid_get_config($engine) {
	global $ext;
	switch ($engine) {
		case 'asterisk':
			//Below removed in FREEPBX-6740, Please reference before adding it back
			//$ext->addInclude('from-internal-additional', 'app-setcid');
			foreach (setcid_list() as $row) {
					$ext->add('app-setcid',$row['cid_id'], '', new ext_noop('('.$row['description'].') Changing cid to '.$row['cid_name'].' <'. $row['cid_num'].'>'));
					$ext->add('app-setcid',$row['cid_id'], '', new ext_set('CALLERID(name)', $row['cid_name']));
					$ext->add('app-setcid',$row['cid_id'], '', new ext_set('CALLERID(num)', $row['cid_num']));
					$ext->add('app-setcid',$row['cid_id'], '', new ext_goto($row['dest']));
			}
		break;
	}
}

/**  Get a list of all cid
 */
function setcid_list() {
	return FreePBX::Setcid()->getAll();
}

function setcid_destinations() {
	global $module_page;
	$extens = array();

	// it makes no sense to point at another callerid (and it can be an infinite loop)
	if ($module_page == 'setcid') {
		return false;
	}

	// return an associative array with destination and description
	foreach (setcid_list() as $row) {
		$extens[] = array('destination' => 'app-setcid,' . $row['cid_id'] . ',1', 'description' => $row['description']);
	}
	return $extens;
}

function setcid_get($cid_id) {
	return FreePBX::Setcid()->get($cid_id);
}

function setcid_add($description, $cid_name, $cid_num, $dest) {
	return FreePBX::Setcid()->update(null, $description, $cid_name, $cid_num, $dest);
}

function setcid_delete($cid_id) {
	return FreePBX::Setcid()->delete($cid_id);
}

function setcid_edit($cid_id, $description, $cid_name, $cid_num, $dest) {
	return FreePBX::Setcid()->update($cid_id, $description, $cid_name, $cid_num, $dest);
}

//----------------------------------------------------------------------------
// Dynamic Destination Registry and Recordings Registry Functions

function setcid_check_destinations($dest=true) {
	global $active_modules;

	$destlist = array();
	if (is_array($dest) && empty($dest)) {
		return $destlist;
	}
	$sql = "SELECT cid_id, description, dest FROM setcid ";
	if ($dest !== true) {
		$sql .= "WHERE dest in ('".implode("','",$dest)."')";
	}
	$results = sql($sql,"getAll",DB_FETCHMODE_ASSOC);

	$type = isset($active_modules['setcid']['type'])?$active_modules['setcid']['type']:'setup';

	foreach ($results as $result) {
		$thisdest = $result['dest'];
		$thisid   = $result['cid_id'];
		$destlist[] = array(
			'dest' => $thisdest,
			'description' => 'Set CallerID: '.$result['description'],
			'edit_url' => 'config.php?display=setcid&type=tool&id='.urlencode($thisid),
		);
	}
	return $destlist;
}

function setcid_getdest($id) {
	return array("app-setcid,$id,1");
}

function setcid_getdestinfo($dest) {
	if (substr(trim($dest),0,11) == 'app-setcid,') {
		$grp = explode(',',$dest);
		$id = $grp[1];
		$thiscid = setcid_get($id);
		if (empty($thiscid)) {
			return array();
		} else {
			return array('description' => sprintf(_("Set CallerID %s: "),$thiscid['description']),
			             'edit_url' => 'config.php?display=setcid&view=form&id='.urlencode($id),
								  );
		}
	} else {
		return false;
	}
}

?>
