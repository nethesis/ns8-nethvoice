<?php /* $Id$ */
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2013 Schmooze Com Inc.
//
// The destinations this module provides
// returns a associative arrays with keys 'destination' and 'description'
function ringgroups_destinations() {
	//get the list of ringgroups
	$results = ringgroups_list();

	// return an associative array with destination and description
	if (isset($results)) {
		foreach($results as $result){
				$extens[] = array('destination' => 'ext-group,'.$result['grpnum'].',1', 'description' => $result['grpnum'].' '.$result['description']);
		}
	}

	if (isset($extens))
		return $extens;
	else
		return null;
}

function ringgroups_getdest($exten) {
	return array("ext-group,$exten,1");
}

function ringgroups_getdestinfo($dest) {
	if (substr(trim($dest),0,10) == 'ext-group,') {
		$grp = explode(',',$dest);
		$grp = $grp[1];
		$thisgrp = ringgroups_get($grp);
		if (empty($thisgrp)) {
			return array();
		} else {
			return array('description' => sprintf(_("Ring Group %s: "),$grp).$thisgrp['description'],
									 'edit_url' => 'config.php?display=ringgroups&view=form&extdisplay=GRP-'.urlencode($grp),
									);
		}
	} else {
		return false;
	}
}

function ringgroups_recordings_usage($recording_id) {
	global $active_modules;

	$results = sql("SELECT `grpnum`, `description` FROM `ringgroups` WHERE `annmsg_id` = '$recording_id' OR `remotealert_id` = '$recording_id' OR `toolate_id` = '$recording_id'","getAll",DB_FETCHMODE_ASSOC);
	if (empty($results)) {
		return array();
	} else {
		//$type = isset($active_modules['ivr']['type'])?$active_modules['ivr']['type']:'setup';
		foreach ($results as $result) {
			$usage_arr[] = array(
				'url_query' => 'config.php?display=ringgroups&view=form&extdisplay=GRP-'.urlencode($result['grpnum']),
				'description' => sprintf(_("Ring Group: %s"),$result['description']),
			);
		}
		return $usage_arr;
	}
}

/* 	Generates dialplan for ringgroups
	We call this with retrieve_conf
*/
function ringgroups_get_config($engine) {
	global $ext;	// is this the best way to pass this?
	global $amp_conf;
	switch($engine) {
		case "asterisk":
			$ext->addInclude('from-internal-additional','ext-group');
			$ext->addInclude('from-internal-additional','grps');
			$contextname = 'ext-group';
			$ringlist = ringgroups_list(true);
			if (is_array($ringlist)) {
				foreach($ringlist as $item) {
					$grpnum = ltrim($item['0']);
					$grp = ringgroups_get($grpnum);
					$ae = ($grp['elsewhere'] == 'yes')?'c':'';
					$strategy = $grp['strategy'];
					$grptime = $grp['grptime'];
					$grplist = $grp['grplist'];
					$postdest = $grp['postdest'];
					$grppre = (isset($grp['grppre'])?$grp['grppre']:'');
					$progress = (isset($grp['progress'])?$grp['progress']:'yes');
					$annmsg_id = (isset($grp['annmsg_id'])?$grp['annmsg_id']:'');
					$alertinfo = $grp['alertinfo'];
					$rvolume = $grp['rvolume'];
					$needsconf = $grp['needsconf'];
					$cwignore = $grp['cwignore'];
					$cpickup = $grp['cpickup'];
					$cfignore = $grp['cfignore'];
					$remotealert_id = $grp['remotealert_id'];
					$toolate_id = $grp['toolate_id'];
					$ringing = $grp['ringing'];
					$recording = $grp['recording'] == '' ? 'dontcare' : $grp['recording'];

					// TODO: this looks potentially problematic given the new per-user DIAL_OPTIONS. Need to further
					//			 evaluate/understand if there are implications. The issue may be that we are trying to
					//			 avoid getting a 'polluted' version of the DIAL_OPTIONS in which case we may need to modify
					//			 macro-user-callerid (where it is set) to preserve the version we should be using.
					//
					if($ringing == 'Ring' || empty($ringing) ) {
						$dialopts = '${DIAL_OPTIONS}'.$ae;
					} elseif($ringing == "inherit") {
						$dialopts = 'm(${CHANNEL(musicclass)})${REPLACE(DIAL_OPTIONS,r'.$ae.')}';
					} else {
						$dialopts = 'm(' . $ringing . ')${REPLACE(DIAL_OPTIONS,r'.$ae.')}';
					}
					if ($progress == 'yes') {
						$ext->add($contextname, $grpnum, '', new ext_gotoif('$["${__RINGINGSENT}" = "TRUE"]', 'cid'));
						if($ringing == 'Ring' || empty($ringing) ) {
							$ext->add($contextname, $grpnum, '', new ext_playtones("ring"));
						}
						$ext->add($contextname, $grpnum, '', new ext_progress());
					}

					$ext->add($contextname, $grpnum, 'cid', new ext_macro('user-callerid'));

					// block voicemail until phone is answered at which point a macro should be called on the answering
					// line to clear this flag so that subsequent transfers can occur, if already set by a the caller
					// then don't change.
					//
					$ext->add($contextname, $grpnum, '', new ext_macro('blkvm-setifempty'));
					$ext->add($contextname, $grpnum, '', new ext_gotoif('$["${GOSUB_RETVAL}" = "TRUE"]', 'skipov'));
					$ext->add($contextname, $grpnum, '', new ext_macro('blkvm-set','reset'));
					$ext->add($contextname, $grpnum, '', new ext_setvar('__NODEST', ''));

					// Remember if NODEST was set later, but clear it in case the call is answered so that subsequent
					// transfers work.
					//
					$ext->add($contextname, $grpnum, 'skipov', new ext_setvar('RRNODEST', '${NODEST}'));
					$ext->add($contextname, $grpnum, 'skipvmblk', new ext_setvar('__NODEST', '${EXTEN}'));

					$ext->add($contextname, $grpnum, '', new ext_gosubif('$[${DB_EXISTS(RINGGROUP/'.$grpnum.'/changecid)} = 1 & "${DB(RINGGROUP/'.$grpnum.'/changecid)}" != "default" & "${DB(RINGGROUP/'.$grpnum.'/changecid)}" != ""]', 'sub-rgsetcid,s,1'));

					// deal with group CID prefix
					if ($grppre != '') {
						$ext->add($contextname, $grpnum, '', new ext_macro('prepend-cid', $grppre));
					}

					// Set Alert_Info
					if ($alertinfo != '') {
						$ext->add($contextname, $grpnum, '', new ext_setvar('__ALERT_INFO', str_replace(';', '\;', $alertinfo)));
					}
					if (!empty($rvolume)) {
						$ext->add($contextname, $grpnum, '', new ext_setvar('__RVOL', $rvolume));
					}
					if ($cwignore != '') {
						$ext->add($contextname, $grpnum, '', new ext_setvar('__CWIGNORE', 'TRUE'));
					}
					if ($cfignore != '') {
						$ext->add($contextname, $grpnum, '', new ext_setvar('_CFIGNORE', 'TRUE'));
						$ext->add($contextname, $grpnum, '', new ext_setvar('_FORWARD_CONTEXT', 'block-cf'));
					}
					if ($cpickup != '') {
						$ext->add($contextname, $grpnum, '', new ext_set('__PICKUPMARK','${EXTEN}'));
					}else {
					//need to add **grpnum in context pickup to allow this
						$pickupcont='app-pickup';

						$fcc = new featurecode('core', 'pickup');
						$fc_code = $fcc->getCodeActive();
						$pickup_code = $fc_code.$grpnum;

						$ext->add($pickupcont,$pickup_code, '', new ext_set('ALLOWEDMEM',$grplist));
						$ext->add($pickupcont,$pickup_code, '', new ext_macro('user-callerid'));
						$ext->add($pickupcont,$pickup_code, '', new ext_setvar('EXTENS','${FIELDQTY(ALLOWEDMEM,-)}'));
						$ext->add($pickupcont,$pickup_code, '', new ext_setvar('ITER','1'));
						$ext->add($pickupcont,$pickup_code, '', new ext_noop('$["${AMPUSER}" == "${CUT(ALLOWEDMEM,-,${ITER})}"]','pickup'));
						$ext->add($pickupcont,$pickup_code, 'extloop', new ext_gotoif('$["${AMPUSER}" == "${CUT(ALLOWEDMEM,-,${ITER})}"]','pickup'));
						$ext->add($pickupcont,$pickup_code, '', new ext_set('ITER','$[${ITER}+1]'));
						$ext->add($pickupcont,$pickup_code, '', new ext_gotoif('$["${ITER}" <= "${EXTENS}"]','extloop'));
						$ext->add($pickupcont,$pickup_code, '', new ext_playback('im-sorry&access-denied'));
						$ext->add($pickupcont,$pickup_code, '', new ext_hangup());
						$ext->add($pickupcont,$pickup_code, 'pickup', new ext_setvar('PICKUP_EXTEN','${AMPUSER}'));
						$ext->add($pickupcont,$pickup_code, '', new ext_pickup('${EXTEN:2}&${EXTEN:2}@PICKUPMARK'));
						$ext->add($pickupcont,$pickup_code, '', new ext_hangup());
					}

					// recording stuff
					//$ext->add($contextname, $grpnum, '', new ext_setvar('RecordMethod','Group'));
					//$ext->add($contextname, $grpnum, '', new ext_macro('record-enable',$grplist.',${RecordMethod}'));

					//TODO: hardcoded needs to be configurable in the ringgroup
					$ext->add($contextname, $grpnum, '', new ext_gosub('1','s','sub-record-check',"rg,$grpnum,$recording"));

					// group dial
					$ext->add($contextname, $grpnum, '', new ext_setvar('RingGroupMethod',$strategy));
					if ($annmsg_id) {
						$annmsg = recordings_get_file($annmsg_id);
						$ext->add($contextname, $grpnum, '', new ext_gotoif('$["foo${RRNODEST}" != "foo"]','DIALGRP'));
						$ext->add($contextname, $grpnum, '', new ext_answer(''));
						$ext->add($contextname, $grpnum, '', new ext_wait(1));
						$ext->add($contextname, $grpnum, '', new ext_playback($annmsg));
					}
					//FREPBX-14945 Call Confirm Announcement under Virtual Queue module is broken.
					if ($needsconf == "CHECKED") {
						$ext->add($contextname, $grpnum, '', new ext_set('__RG_CONFIRM',1));

					}
					//set the VQ varible to ALT_CONFIRM_MSG
					$ext->add($contextname, $grpnum, '', new ext_set('__ALT_CONFIRM_MSG', '${IF($[${LEN(${VQ_CONFIRMMSG})}>1]?${IF($["${VQ_CONFIRMMSG}"!="0"]?${VQ_CONFIRMMSG}: )}:)}'));
					$remotealert = recordings_get_file($remotealert_id);
					$toolate = recordings_get_file($toolate_id);
					$len=strlen($grpnum)+4;
					$ext->add("grps", "_RG-${grpnum}-.", '', new ext_nocdr(''));
					$ext->add("grps", "_RG-${grpnum}-.", '', new ext_macro('dial', "$grptime,$dialopts" . "M(confirm^${remotealert}^${toolate}^${grpnum})" . ',${EXTEN:' . $len . '}'));

					 $ext->add($contextname, $grpnum, '', new ext_gotoif('$[$["${RG_CONFIRM}"="1"] | $[${LEN(${VQ_CONFIRMMSG})}>1]]','RGVQANNOUNCE','NORGVQANNOUNCE'));
					$ext->add($contextname, $grpnum, 'RGVQANNOUNCE', new ext_macro('dial-confirm',"$grptime,$dialopts,$grplist,$grpnum"));
					//FREEPBX-15547	ring groups - timeout with external number ignores call confirmation on second attempt
					$ext->add($contextname, $grpnum, '', new ext_goto('gosubhere'));
					$ext->add($contextname, $grpnum, 'NORGVQANNOUNCE', new ext_macro('dial',$grptime.",$dialopts,".$grplist));
					$ext->add($contextname, $grpnum, 'gosubhere', new ext_gosub('1','s','sub-record-cancel'));
					$ext->add($contextname, $grpnum, '', new ext_setvar('RingGroupMethod',''));


					// Now if we were told to skip the destination, do so now. Otherwise reset NODEST and proceed to our destination.
					//
					$ext->add($contextname, $grpnum, '', new ext_gotoif('$["foo${RRNODEST}" != "foo"]', 'nodest'));
					if ($cwignore != '') {
						$ext->add($contextname, $grpnum, '', new ext_setvar('__CWIGNORE', ''));
					}
					if ($cpickup != '') {
						$ext->add($contextname, $grpnum, '', new ext_set('__PICKUPMARK',''));
					}
					// TODO: Asterisk uses a blank FORWARD_CONTEXT as a literal at the time of this change. A better solution would be
					//			 if it would ignore blank, since it is possible in a customcontext setup you would not want this set to
					//			 from-internal
					//
					if ($cfignore != '') {
						$ext->add($contextname, $grpnum, '', new ext_setvar('_CFIGNORE', ''));
						$ext->add($contextname, $grpnum, '', new ext_setvar('_FORWARD_CONTEXT', 'from-internal'));
					}
					$ext->add($contextname, $grpnum, '', new ext_setvar('__NODEST', ''));
					$ext->add($contextname, $grpnum, '', new ext_macro('blkvm-clr'));

					// where next?
					if ((isset($postdest) ? $postdest : '') != '') {
						$ext->add($contextname, $grpnum, '', new ext_goto($postdest));
					} else {
						$ext->add($contextname, $grpnum, '', new ext_hangup(''));
					}
					$ext->add($contextname, $grpnum, 'nodest', new ext_noop('SKIPPING DEST, CALL CAME FROM Q/RG: ${RRNODEST}'));
				}
				// We need to have a hangup here, if call is ended by the caller during Playback it will end in the
				// h context and do a proper hangup and clean the blkvm keys if set, see #4671
				$ext->add($contextname, 'h', '', new ext_macro('hangupcall'));
				/*
					ASTDB Settings:
					RINGGROUP/nnn/changecid default | did | fixed | extern
					RINGGROUP/nnn/fixedcid XXXXXXXX

					changecid:
						default	 - works as always, same as if not present
						fixed		 - set to the fixedcid
						extern		- set to the fixedcid if the call is from the outside only
						did			 - set to the DID that the call came in on or leave alone, treated as foreign
						forcedid	- set to the DID that the call came in on or leave alone, not treated as foreign

					NODEST			- has the exten num called, hoaky if that goes away but for now use it
				*/
				if (count($ringlist)) {
					$contextname = 'sub-rgsetcid';
					$exten = 's';
					$ext->add($contextname, $exten, '', new ext_goto('1','s-${DB(RINGGROUP/${NODEST}/changecid)}'));

					$exten = 's-fixed';
					$ext->add($contextname, $exten, '', new ext_execif('$["${REGEX("^[\+]?[0-9]+$" ${DB(RINGGROUP/${NODEST}/fixedcid)})}" = "1"]', 'Set', '__TRUNKCIDOVERRIDE=${DB(RINGGROUP/${NODEST}/fixedcid)}'));
					$ext->add($contextname, $exten, '', new ext_return(''));

					$exten = 's-extern';
					$ext->add($contextname, $exten, '', new ext_execif('$["${REGEX("^[\+]?[0-9]+$" ${DB(RINGGROUP/${NODEST}/fixedcid)})}" == "1" & "${FROM_DID}" != ""]', 'Set', '__TRUNKCIDOVERRIDE=${DB(RINGGROUP/${NODEST}/fixedcid)}'));
					$ext->add($contextname, $exten, '', new ext_return(''));

					$exten = 's-did';
					$ext->add($contextname, $exten, '', new ext_execif('$["${REGEX("^[\+]?[0-9]+$" ${FROM_DID})}" = "1"]', 'Set', '__REALCALLERIDNUM=${FROM_DID}'));
					$ext->add($contextname, $exten, '', new ext_return(''));

					$exten = 's-forcedid';
					$ext->add($contextname, $exten, '', new ext_execif('$["${REGEX("^[\+]?[0-9]+$" ${FROM_DID})}" = "1"]', 'Set', '__TRUNKCIDOVERRIDE=${FROM_DID}'));
					$ext->add($contextname, $exten, '', new ext_return(''));

					$exten = '_s-.';
					$ext->add($contextname, $exten, '', new ext_noop('Unknown value for RINGGROUP/${NODEST}/changecid of ${DB(RINGGROUP/${NODEST}/changecid)} set to "default"'));
					$ext->add($contextname, $exten, '', new ext_setvar('DB(RINGGROUP/${NODEST}/changecid)', 'default'));
					$ext->add($contextname, $exten, '', new ext_return(''));
				}
			}
			break;
	}
}

function ringgroups_add($grpnum,$strategy,$grptime,$grplist,$postdest,$desc,$grppre='',$annmsg_id='0',$alertinfo,$needsconf,$remotealert_id,$toolate_id,$ringing,$cwignore,$cfignore,$changecid='default',$fixedcid='',$cpickup='', $recording='dontcare',$progress='yes',$elsewhere,$rvolume='') {
	_ringgroups_backtrace();
	return \FreePBX::Ringgroups()->add($grpnum,$strategy,$grptime,$grplist,$postdest,$desc,$grppre,$annmsg_id,$alertinfo,$needsconf,$remotealert_id,$toolate_id,$ringing,$cwignore,$cfignore,$changecid,$fixedcid,$cpickup, $recording,$progress,$elsewhere,$rvolume);
}

function ringgroups_del($grpnum) {
	global $db;
	global $astman;
	global $amp_conf;

	$results = sql("DELETE FROM ringgroups WHERE grpnum = '".$db->escapeSimple($grpnum)."'","query");
	if ($astman) {
		$astman->database_deltree("RINGGROUP/".$grpnum);
	} else {
		die_freepbx("Cannot connect to Asterisk Manager with ".$amp_conf["AMPMGRUSER"]."/".$amp_conf["AMPMGRPASS"]);
	}
}

function ringgroups_list($get_all=false) {
	_ringgroups_backtrace();
	return \FreePBX::Ringgroups()->listRinggroups($get_all);
}

function ringgroups_check_extensions($exten=true) {
	$extenlist = array();
	if (is_array($exten) && empty($exten)) {
		return $extenlist;
	}
	$sql = "SELECT grpnum ,description FROM ringgroups ";
	if (is_array($exten)) {
		$sql .= "WHERE grpnum in ('".implode("','",$exten)."')";
	}
	$sql .= " ORDER BY CAST(grpnum AS UNSIGNED)";
	$results = sql($sql,"getAll",DB_FETCHMODE_ASSOC);

	foreach ($results as $result) {
		$thisexten = $result['grpnum'];
		$extenlist[$thisexten]['description'] = sprintf(_("Ring Group: %s"),$result['description']);
		$extenlist[$thisexten]['status'] = _('INUSE');
		$extenlist[$thisexten]['edit_url'] = 'config.php?display=ringgroups&view=form&extdisplay=GRP-'.urlencode($thisexten);
	}
	return $extenlist;
}

function ringgroups_check_destinations($dest=true) {
	global $active_modules;

	$destlist = array();
	if (is_array($dest) && empty($dest)) {
		return $destlist;
	}
	$sql = "SELECT grpnum, postdest, description FROM ringgroups ";
	if ($dest !== true) {
		$sql .= "WHERE postdest in ('".implode("','",$dest)."')";
	}
	$results = sql($sql,"getAll",DB_FETCHMODE_ASSOC);

	//$type = isset($active_modules['announcement']['type'])?$active_modules['announcement']['type']:'setup';

	foreach ($results as $result) {
		$thisdest = $result['postdest'];
		$thisid	 = $result['grpnum'];
		$destlist[] = array(
			'dest' => $thisdest,
			'description' => sprintf(_("Ring Group: %s (%s)"),$result['description'],$thisid),
			'edit_url' => 'config.php?display=ringgroups&view=form&extdisplay=GRP-'.urlencode($thisid),
		);
	}
	return $destlist;
}

function ringgroups_change_destination($old_dest, $new_dest) {
	$sql = 'UPDATE ringgroups SET postdest = "' . $new_dest . '" WHERE postdest = "' . $old_dest . '"';
	sql($sql, "query");
}

function ringgroups_get($grpnum) {
	global $db;
	global $astman;
	global $amp_conf;

	$results = sql("SELECT grpnum, strategy, grptime, grppre, grplist, annmsg_id, postdest, description, alertinfo, needsconf, remotealert_id, toolate_id, ringing, cwignore, cfignore, cpickup, recording, progress, elsewhere,rvolume FROM ringgroups WHERE grpnum = '".$db->escapeSimple($grpnum)."'","getRow",DB_FETCHMODE_ASSOC);
	if ($astman) {
		$astdb_changecid = strtolower($astman->database_get("RINGGROUP",$grpnum."/changecid"));
		switch($astdb_changecid) {
			case 'default':
			case 'did':
			case 'forcedid':
			case 'fixed':
			case 'extern':
				break;
			default:
				$astdb_changecid = 'default';
		}
		$results['changecid'] = $astdb_changecid;
		$fixedcid = $astman->database_get("RINGGROUP",$grpnum."/fixedcid");
		$results['fixedcid'] = preg_replace("/[^0-9\+]/" ,"", trim($fixedcid));
	} else {
		die_freepbx("Cannot connect to Asterisk Manager with ".$amp_conf["AMPMGRUSER"]."/".$amp_conf["AMPMGRPASS"]);
	}
	return $results;
}
/* Get a list of all extensions that belongs to a ringgroup */
function ringgroups_get_extensions($grpnum) {
	global $db;
	$results = sql("SELECT grplist FROM ringgroups WHERE grpnum = '".$db->escapeSimple($grpnum)."'","getRow",DB_FETCHMODE_ASSOC);
	return $results;
}

/* Update the list of extensions for the specific ringgroup */
function ringgroups_update_extensions($grpnum, $extensions) {
	global $db;
	$sql = 'UPDATE ringgroups SET grplist = "' . $extensions . '" WHERE grpnum = "' . $grpnum . '"';
	sql($sql, "query");
}

function ringgroups_hook_core($viewing_itemid, $request) {
// This is empty. Need to be here for the ringgroups_hookProcess_core function to work
}

function ringgroups_hookProcess_core($viewing_itemid, $request) {
	if (!isset($request['action']))
		return;
	switch ($request['action']) {
	case 'del':
		// Get all ringgroups
		$grouplist = ringgroups_list();
		if(isset($grouplist)) {
			foreach($grouplist as $list => $group) {
				// Get the extension list for the ringgroup
				$extensionlist = ringgroups_get_extensions($group['grpnum']);
				$extensions = explode('-', $extensionlist['grplist']);
				$key = array_search($viewing_itemid, $extensions);
				if ($key !== FALSE) {
					unset($extensions[$key]);
					$new_grplist = implode('-',$extensions);
					ringgroups_update_extensions($group['grpnum'], $new_grplist);
				}
			}
		}
		break;
	}
}

global $amp_conf;
if ($amp_conf['EXTENSION_LIST_RINGGROUPS']) {

	function ringgroups_configpageinit($pagename) {
		global $currentcomponent;
		// On a 'new' user, 'tech_hardware' is set, and there's no extension.
		if (isset($_REQUEST['display']) && ($_REQUEST['display'] == 'users' || $_REQUEST['display'] == 'extensions') && isset($_REQUEST['extdisplay']) && $_REQUEST['extdisplay'] != '') {
			$currentcomponent->addprocessfunc('ringgroups_configpageload', 1);
		}
	}

	// This is called before the page is actually displayed, so we can use addguielem(). draws hook on the extensions/users page
	function ringgroups_configpageload() {
		global $currentcomponent;
		global $display;
		$extdisplay=isset($_REQUEST['extdisplay'])?$_REQUEST['extdisplay']:'';

		if ($display == 'extensions' || $display == 'users') {
			$section = _('Ring Group Membership');

			$sql = "SELECT grpnum, description FROM ringgroups WHERE grplist LIKE '$extdisplay-%' OR grplist LIKE '%-$extdisplay-%' OR grplist LIKE '%-$extdisplay' OR grplist = '$extdisplay'";
			$results = sql($sql,"getAll",DB_FETCHMODE_ASSOC);

			$ringgroup_count = 0;
			foreach($results as $result) {
				$addURL = '?display=ringgroups&view=form&extdisplay='.$result['grpnum'];
				$ringgroup_icon = 'images/email_edit.png';
				$ringgroup_label = $result['grpnum']." ".$result['description'];
				$ringgroup_label = '&nbsp;<span>
					<img width="16" height="16" border="0" title="'.$ringgroup_label.'" alt="" src="'.$ringgroup_icon.'"/> '.$ringgroup_label.
				'</span> ';
				$currentcomponent->addguielem($section, new gui_link('ringgroup_'.$ringgroup_count++, $ringgroup_label, $addURL, true, false), 9);
			}
		}
	}

} // only included if feature enabled

function _ringgroups_backtrace() {
	$trace = debug_backtrace();
	$function = $trace[1]['function'];
	$line = $trace[1]['line'];
	$file = $trace[1]['file'];
	freepbx_log(FPBX_LOG_WARNING,'Depreciated Function '.$function.' detected in '.$file.' on line '.$line);
}
