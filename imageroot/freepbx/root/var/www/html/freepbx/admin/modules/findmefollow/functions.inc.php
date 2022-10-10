<?php
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2013 Schmooze Com Inc.
//

/* 	Generates dialplan for findmefollow
	We call this with retrieve_conf
*/

function findmefollow_destinations($index) {
	global $display;
	global $extdisplay;
	global $followme_exten;
	global $db;

	$extdisplay = ltrim($extdisplay,'GRP-');
	$followme_exten = $extdisplay;

	if ($display == 'findmefollow' && $followme_exten != '') {
		$extens[] = array('destination' => 'ext-local,'.$followme_exten.',dest', 'description' => _("Normal Extension Behavior"));
		return $extens;
	}
	if(($display == "extensions" || $display == "users") && $index == "fmfm") {
		$extens[] = array('destination' => 'ext-local,'.$extdisplay.',dest', 'description' => _("Normal Extension Behavior"));
		return $extens;
	}
	if (($display != 'extensions' && $display != 'users') || !isset($extdisplay) || $extdisplay == '') {
		return null;
	}

	//TODO: need to do a join with user to get the displayname also

	//TODO: if extdisplay is set, sort such that this extension's follow-me is at the top of the list if they have one
	//      alternatively, only put this extension's follow-me since you should not be able to force to others and you can use their extension
	//$results = findmefollow_list();
	$grpnum = sql("SELECT grpnum FROM findmefollow WHERE grpnum = '".$db->escapeSimple($extdisplay)."'","getOne");

	// return an associative array with destination and description
	if ($grpnum != '') {
		$extens[] = array('destination' => 'ext-findmefollow,FM'.$grpnum.',1', 'description' => _("Force Follow Me"));
		return $extens;
	} else {
		return null;
	}
}

function findmefollow_get_config($engine) {
	global $ext;  // is this the best way to pass this?
	global $amp_conf;
	global $astman;
	$nt = FreePBX::Notifications();
	$rawname = 'followmecal';
	//Cleanup... only look at "notice"
	foreach ($nt->list_all(600) as $notification) {
		if(isset($notification['module']) && $notification['module'] == $rawname){
			$nt->delete($rawname,$notification['id']);
		}
	}
	switch($engine) {
		case "asterisk":
			if ($amp_conf['USEDEVSTATE']) {
				$ext->addGlobal('FMDEVSTATE','TRUE');
			}

			$fcc = new featurecode('findmefollow', 'fmf_toggle');
			$fmf_code = $fcc->getCodeActive();
			unset($fcc);

			if ($fmf_code != '') {
				findmefollow_fmf_toggle($fmf_code);
			}

			$ext->addInclude('from-internal-additional','ext-findmefollow');
			$ext->addInclude('from-internal-additional','fmgrps');
			$contextname = 'ext-findmefollow';
			$grpcontextname = 'fmgrps';

			// Before creating all the contexts, let's make a list of hints if needed
			//
			if ($amp_conf['USEDEVSTATE'] && $fmf_code != '') {
				$ext->add($contextname, "_".$fmf_code.'X.', '', new ext_goto("1",$fmf_code,"app-fmf-toggle"));
				$ext->addHint($contextname, "_".$fmf_code.'X.', "Custom:FOLLOWME".'${EXTEN:'.strlen($fmf_code).'}');
			}

			$iscal = FreePBX::Modules()->checkStatus('calendar');
			$groups = FreePBX::Findmefollow()->getAllFollowmes();
			$dial_options = FreePBX::Config()->get("DIAL_OPTIONS");
			foreach($groups as $grp) {
				$grpnum = $grp['grpnum'];
				$strategy = $grp['strategy'];
				$grptime = $grp['grptime'];
				$grplist = $grp['grplist'];
				$postdest = $grp['postdest'];
				$grppre = (isset($grp['grppre'])?$grp['grppre']:'');
				$annmsg_id = $grp['annmsg_id'];
				$dring = $grp['dring'];
				$user = FreePBX::Userman()->getUserByDefaultExtension($grpnum);
				$timezone = (isset($user['timezone']) && !empty($user['timezone']))?$user['timezone']:FreePBX::View()->getTimezone();
				$rvolume = (isset($grp['rvolume'])?$grp['rvolume']:'');
				$needsconf = $grp['needsconf'];
				$remotealert_id = $grp['remotealert_id'];
				$toolate_id = $grp['toolate_id'];
				$ringing = $grp['ringing'];
				$pre_ring = $grp['pre_ring'];
				$calendar_enable = !empty($grp['calendar_enable']) ?true:false;
				$calendar_id = !empty($grp['calendar_id'])?$grp['calendar_id']:false;
				$calendar_group_id = !empty($grp['calendar_group_id'])?$grp['calendar_group_id']:false;
				$calendar_match = !empty($grp['calendar_match'])?$grp['calendar_match']:'yes';

				$astman->database_put("AMPUSER",$grpnum."/followme/grppre",isset($grppre)?$grppre:'');
				$astman->database_put("AMPUSER",$grpnum."/followme/dring",isset($dring)?$dring:'');
				$astman->database_put("AMPUSER",$grpnum."/followme/rvolume",isset($rvolume)?$rvolume:'');
				$astman->database_put("AMPUSER",$grpnum."/followme/strategy",isset($strategy)?$strategy:'');
				$astman->database_put("AMPUSER",$grpnum."/followme/annmsg",(!empty($annmsg_id) ? recordings_get_file($annmsg_id) : ''));
				$astman->database_put("AMPUSER",$grpnum."/followme/remotealertmsg",(!empty($remotealert_id) ? recordings_get_file($remotealert_id) : ''));
				$astman->database_put("AMPUSER",$grpnum."/followme/toolatemsg",(!empty($toolate_id) ? recordings_get_file($toolate_id) : ''));
				$astman->database_put("AMPUSER",$grpnum."/followme/postdest",$postdest);
				$astman->database_put("AMPUSER",$grpnum."/followme/ringing",$ringing);

				// Create the confirm target
				$len=strlen($grpnum)+4;
				$remotealert = empty($remotealert_id) ? '' : recordings_get_file($remotealert_id);
				$toolate = empty($toolate_id) ? '' : recordings_get_file($toolate_id);

				if($ringing == 'Ring' || empty($ringing) ) {
					$dialopts = '${DIAL_OPTIONS}';
				} else {
					// We need the DIAL_OPTIONS variable
					$dialopts = "m(${ringing})".str_replace('r', '', $dial_options);
				}

				//These two have to be here because of how they function in the dialplan.
				//Dont try to make them dynamic, we really can't do that
				$len = strlen($grpnum)+5;
				$ext->add($grpcontextname, "_RG-".$grpnum."*.", '', new ext_macro('dial','${DB(AMPUSER/'.$grpnum.'/followme/grptime)},' .$dialopts. 'M(confirm^'.$remotealert.'^'.$toolate.'^'.$grpnum.'),${EXTEN:'.$len.'}'),1,1);
				if($calendar_enable && $iscal && (!empty($calendar_id) || !empty($calendar_group_id))){
					if(!empty($calendar_group_id)) {
						try {
							$val = FreePBX::Calendar()->ext_calendar_group_variable($calendar_group_id,$timezone,true);
							$ext->add($contextname, $grpnum, '', $val);
						} catch (Exception $e) {
							$uid = 'CALG-'.$calendar_group_id;
							if(!$nt->exists($rawname, $uid)) {
								$nt->add_notice($rawname, $uid, _("Calendar Not found"), _("Your followme is linked to a non-existant calendar group"), '?display=findmefollow&view=form&extdisplay='.$grpnum, true, false);
							}
							dbug($e->getMessage());
						}
					} else {
						try {
							$val = FreePBX::Calendar()->ext_calendar_variable($calendar_id,$timezone,true);
							$ext->add($contextname, $grpnum, '', $val);
						} catch (Exception $e) {
							$uid = 'CAL-'.$calendar_group_id;
							if(!$nt->exists($rawname, $uid)) {
								$nt->add_notice($rawname, $uid, _("Calendar Not found"), _("Your followme is linked to a non-existant calendar"), '?display=findmefollow&view=form&extdisplay='.$grpnum, true, false);
							}
							dbug($e->getMessage());
						}
					}

					$ext->add($contextname, $grpnum, '', new ext_gotoif('$[${DB_EXISTS(AMPUSER/${EXTEN}/followme/ddial)} != 1 | "${DB(AMPUSER/${EXTEN}/followme/ddial)}" = "EXTENSION"]', 'ext-local,${EXTEN},1'));
					if($calendar_match === 'yes'){
						$ext->add($contextname, $grpnum, '', new ext_gotoif('$[${CALENDAR} = 0]', 'ext-local,${EXTEN},1','followme-check,${EXTEN},1'));
					}else{
						$ext->add($contextname, $grpnum, '', new ext_gotoif('$[${CALENDAR} = 1]', 'ext-local,${EXTEN},1','followme-check,${EXTEN},1'));
					}
				}else{
					$ext->add($contextname, $grpnum, '', new ext_gotoif('$[${DB_EXISTS(AMPUSER/${EXTEN}/followme/ddial)} != 1 | "${DB(AMPUSER/${EXTEN}/followme/ddial)}" = "EXTENSION"]', 'ext-local,${EXTEN},1','followme-check,${EXTEN},1'));
				}
			}

			$ext->add($grpcontextname, "_RG-X.", '', new ext_nocdr(''));

			// Direct target to Follow-Me come here bypassing the followme/ddial conditional check
			//
			$ext->add($contextname, '_FMX.', '', new ext_goto('FMCID','${EXTEN:2}','followme-check'));

			$contextname = 'followme-check';
			$ext->add($contextname, '_X.', 'FMCID', new ext_gosub('1','${EXTEN}','followme-sub'));
			$ext->add($contextname, '_X.', '', new ext_noop('Should never get here'));
			$ext->add($contextname, '_X.', '', new ext_hangup());

			$contextname = 'followme-sub';
			$ext->add($contextname, '_X.', '', new ext_macro('user-callerid'));
			$ext->add($contextname, '_X.', '', new ext_set('DIAL_OPTIONS','${DIAL_OPTIONS}I'));
			$ext->add($contextname, '_X.', '', new ext_set('CONNECTEDLINE(num,i)', '${EXTEN}'));
			$cidnameval = '${DB(AMPUSER/${EXTEN}/cidname)}';
			if ($amp_conf['AST_FUNC_PRESENCE_STATE'] && $amp_conf['CONNECTEDLINE_PRESENCESTATE']) {
				$ext->add($contextname, '_X.', '', new ext_gosub('1', 's', 'sub-presencestate-display', '${EXTEN}'));
				$cidnameval.= '${PRESENCESTATE_DISPLAY}';
			}
			$ext->add($contextname, '_X.', '', new ext_set('CONNECTEDLINE(name)', $cidnameval));
			$ext->add($contextname, '_X.', '', new ext_set('FM_DIALSTATUS','${EXTENSION_STATE(${EXTEN}@ext-local)}'));
			$ext->add($contextname, '_X.', '', new ext_set('__EXTTOCALL','${EXTEN}'));
			$ext->add($contextname, '_X.', '', new ext_set('__PICKUPMARK','${EXTEN}'));

			// block voicemail until phone is answered at which point a macro should be called on the answering
			// line to clear this flag so that subsequent transfers can occur, if already set by a the caller
			// then don't change.
			//
			$ext->add($contextname, '_X.', '', new ext_macro('blkvm-setifempty'));
			$ext->add($contextname, '_X.', '', new ext_gotoif('$["${GOSUB_RETVAL}" = "TRUE"]', 'skipov'));
			$ext->add($contextname, '_X.', '', new ext_macro('blkvm-set','reset'));
			$ext->add($contextname, '_X.', '', new ext_setvar('__NODEST', ''));

			// Remember if NODEST was set later, but clear it in case the call is answered so that subsequent
			// transfers work.
			//
			$ext->add($contextname, '_X.', 'skipov', new ext_setvar('RRNODEST', '${NODEST}'));
			$ext->add($contextname, '_X.', 'skipvmblk', new ext_setvar('__NODEST', '${EXTEN}'));

			$ext->add($contextname, '_X.', '', new ext_gosubif('$[${DB_EXISTS(AMPUSER/${EXTEN}/followme/changecid)} = 1 & "${DB(AMPUSER/${EXTEN}/followme/changecid)}" != "default" & "${DB(AMPUSER/${EXTEN}/followme/changecid)}" != ""]', 'sub-fmsetcid,s,1'));

			// deal with group CID prefix
			$ext->add($contextname, '_X.', '', new ext_gotoif('$[ "${DB(AMPUSER/${EXTEN}/followme/grppre)}" = "" ]', 'skipprepend'));
			$ext->add($contextname, '_X.', '', new ext_macro('prepend-cid', '${DB(AMPUSER/${EXTEN}/followme/grppre)}'));

			// recording stuff
			$ext->add($contextname, '_X.', 'skipprepend', new ext_setvar('RecordMethod','Group'));

			// Note there is no cancel later as the special case of follow-me, if they say record, it should stick
			$ext->add($contextname, '_X.', 'checkrecord', new ext_gosub('1','s','sub-record-check','exten,${EXTEN},'));

			// MODIFIED (PL)
			// Add Alert Info if set but don't override and already set value (could be from ringgroup, directdid, etc.)
			//
			$ext->add($contextname, '_X.', '', new ext_gotoif('$[ $["${DB(AMPUSER/${EXTEN}/followme/dring)}" = ""] | $["${ALERT_INFO}"!=""] ]', 'skipdring'));
			$ext->add($contextname, '_X.', '', new ext_setvar('DRING','${DB(AMPUSER/${EXTEN}/followme/dring)}'));
			$ext->add($contextname, '_X.', '', new ext_setvar("__ALERT_INFO", '${STRREPLACE(DRING,\\;,\\\;)}'));

			// If pre_ring is set, then ring this number of seconds prior to moving on
			$ext->add($contextname, '_X.', 'skipdring', new ext_setvar('STRATEGY','${DB(AMPUSER/${EXTEN}/followme/strategy)}'));
			$ext->add($contextname, '_X.', '', new ext_setvar('__RVOL','${DB(AMPUSER/${EXTEN}/followme/rvolume)}'));
			$ext->add($contextname, '_X.', '', new ext_gotoif('$["${CUT(STRATEGY,-,1)}"="ringallv2"]','skipsimple'));
			$ext->add($contextname, '_X.', '', new ext_gotoif('$[$[ "${DB(AMPUSER/${EXTEN}/followme/prering)}" = "0" ] | $[ "${DB(AMPUSER/${EXTEN}/followme/prering)}" = "" ]] ', 'skipsimple'));
			$ext->add($contextname, '_X.', '', new ext_macro('simple-dial','${EXTEN},${DB(AMPUSER/${EXTEN}/followme/prering)}'));

			// group dial
			$ext->add($contextname, '_X.', 'skipsimple', new ext_setvar('RingGroupMethod','${STRATEGY}'));
			$ext->add($contextname, '_X.', '', new ext_setvar('_FMGRP','${EXTEN}'));

			// should always answer before playing anything, shouldn't we ?
			$ext->add($contextname, '_X.', '', new ext_gotoif('$[$["${DB(AMPUSER/${EXTEN}/followme/annmsg)}" = ""] | $["${DIALSTATUS}" = "ANSWER"] | $["foo${RRNODEST}" != "foo"]]','DIALGRP'));
			$ext->add($contextname, '_X.', '', new ext_answer(''));
			$ext->add($contextname, '_X.', '', new ext_wait(1));
			$ext->add($contextname, '_X.', '', new ext_playback('${DB(AMPUSER/${EXTEN}/followme/annmsg)}'));

			// If grpconf == ENABLED call with confirmation ELSE call normal
			$ext->add($contextname, '_X.', 'DIALGRP', new ext_execif('$[$["${DB(AMPUSER/${EXTEN}/followme/ringing)}"="Ring"] | $["${DB(AMPUSER/${EXTEN}/followme/ringing)}"=""]]','Set','DOPTS=${DIAL_OPTIONS}','Set','DOPTS=m(${DB(AMPUSER/${EXTEN}/followme/ringing)})${STRREPLACE(DIAL_OPTIONS,r)}'));
			//FREEPBX 14945 Call Confirm Announcement under Virtual Queue module is broken.
			 $ext->add($contextname, '_X.', '', new ext_set('__ALT_CONFIRM_MSG', '${IF($["${ALT_CONFIRM_MSG}"!=""]?${ALT_CONFIRM_MSG}:${IF($[${LEN(${VQ_CONFIRMMSG})}>1]?${VQ_CONFIRMMSG}:)})}'));
			//FREEPBX-17789 if the call is from RG and confirm is enabled , we dont want to do one more confirm from FMFM.
			$ext->add($contextname, '_X.', '', new ext_gotoif('$[(("${DB(AMPUSER/${EXTEN}/followme/grpconf)}"="ENABLED") | ("${FORCE_CONFIRM}"!="") | ($[${LEN(${VQ_CONFIRMMSG})}>1])) & ("${RG_CONFIRM}" != "1")]', 'doconfirm'));

			// Normal call
			$ext->add($contextname, '_X.', '', new ext_gotoif('$["${CUT(STRATEGY,-,1)}"="ringallv2"]','ringallv21'));
			$ext->add($contextname, '_X.', '', new ext_macro('dial','${DB(AMPUSER/${EXTEN}/followme/grptime)},${DOPTS},'.'${DB(AMPUSER/${EXTEN}/followme/grplist)}'));
			$ext->add($contextname, '_X.', '', new ext_goto('nextstep'));
			$ext->add($contextname, '_X.', 'ringallv21', new ext_macro('dial','$[ ${DB(AMPUSER/${EXTEN}/followme/grptime)} + ${DB(AMPUSER/${EXTEN}/followme/prering)} ],${DOPTS},${DB(AMPUSER/${EXTEN}/followme/grplist)}'));
			$ext->add($contextname, '_X.', '', new ext_goto('nextstep'));

			// Call Confirm call
			$ext->add($contextname, '_X.', 'doconfirm', new ext_gotoif('$["${CUT(STRATEGY,-,1)}"="ringallv2"]','ringallv22'));
			$ext->add($contextname, '_X.', '', new ext_macro('dial-confirm','${DB(AMPUSER/${EXTEN}/followme/grptime)},${DOPTS},'.'${DB(AMPUSER/${EXTEN}/followme/grplist)},${EXTEN}'));
			$ext->add($contextname, '_X.', '', new ext_goto('nextstep'));
			$ext->add($contextname, '_X.', 'ringallv22', new ext_macro('dial-confirm','$[ ${DB(AMPUSER/${EXTEN}/followme/grptime)} + ${DB(AMPUSER/${EXTEN}/followme/prering)} ],${DOPTS},${DB(AMPUSER/${EXTEN}/followme/grplist)},${EXTEN}'));

			$ext->add($contextname, '_X.', 'nextstep', new ext_setvar('RingGroupMethod',''));

			// Did the call come from a queue or ringgroup, if so, don't go to the destination, just end and let
			// the queue or ringgroup decide what to do next
			//
			$ext->add($contextname, '_X.', '', new ext_gotoif('$["foo${RRNODEST}" != "foo"]', 'nodest'));
			$ext->add($contextname, '_X.', '', new ext_setvar('__NODEST', ''));
			$ext->add($contextname, '_X.', '', new ext_set('__PICKUPMARK',''));
			$ext->add($contextname, '_X.', '', new ext_macro('blkvm-clr'));

			/* NOANSWER:    NOT_INUSE
			 * CHANUNAVAIL: UNAVAILABLE, UNKNOWN, INVALID (or DIALSTATUS=CHANUNAVAIL)
			 * BUSY:        BUSY, INUSE, RINGING, RINGINUSE, HOLDINUSE, ONHOLD
			 */
			$ext->add($contextname, '_X.', '', new ext_noop_trace('FM_DIALSTATUS: ${FM_DIALSTATUS} DIALSTATUS: ${DIALSTATUS}'));
			$ext->add($contextname, '_X.', '', new ext_set('DIALSTATUS',
				'${IF($["${FM_DIALSTATUS}"="NOT_INUSE"&"${DIALSTATUS}"!="CHANUNAVAIL"]?NOANSWER:'
				. '${IF($["${DIALSTATUS}"="CHANUNAVAIL"|"${FM_DIALSTATUS}"="UNAVAILABLE"|"${FM_DIALSTATUS}"="UNKNOWN"|"${FM_DIALSTATUS}"="INVALID"]?'
				. 'CHANUNAVAIL:BUSY)})}'));

			// where next?
			$ext->add($contextname, '_X.', '', new ext_gotoif('$["${DB(AMPUSER/${EXTEN}/followme/postdest)}"=""]', 'dohangup'));
			$ext->add($contextname, '_X.', '', new ext_goto('${DB(AMPUSER/${EXTEN}/followme/postdest)}'));
			$ext->add($contextname, '_X.', 'dohangup', new ext_hangup(''));
			$ext->add($contextname, '_X.', 'nodest', new ext_noop('SKIPPING DEST, CALL CAME FROM Q/RG: ${RRNODEST}'));
			$ext->add($contextname, '_X.', '', new ext_return());

			/*
				ASTDB Settings:
				AMPUSER/nnn/followme/changecid default | did | fixed | extern
				AMPUSER/nnn/followme/fixedcid XXXXXXXX

				changecid:
					default   - works as always, same as if not present
					fixed     - set to the fixedcid
					extern    - set to the fixedcid if the call is from the outside only
					did       - set to the DID that the call came in on or leave alone, treated as foreign
					forcedid  - set to the DID that the call came in on or leave alone, not treated as foreign

				EXTTOCALL   - has the exten num called, hoaky if that goes away but for now use it
			*/
			$contextname = 'sub-fmsetcid';
			$exten = 's';
			$ext->add($contextname, $exten, '', new ext_goto('1','s-${DB(AMPUSER/${EXTTOCALL}/followme/changecid)}'));

			$exten = 's-fixed';
			$ext->add($contextname, $exten, '', new ext_execif('$["${REGEX("^[\+]?[0-9]+$" ${DB(AMPUSER/${EXTTOCALL}/followme/fixedcid)})}" = "1"]', 'Set', '__TRUNKCIDOVERRIDE=${DB(AMPUSER/${EXTTOCALL}/followme/fixedcid)}'));
			$ext->add($contextname, $exten, '', new ext_return(''));

			$exten = 's-extern';
			$ext->add($contextname, $exten, '', new ext_execif('$["${REGEX("^[\+]?[0-9]+$" ${DB(AMPUSER/${EXTTOCALL}/followme/fixedcid)})}" == "1" & "${FROM_DID}" != ""]', 'Set', '__TRUNKCIDOVERRIDE=${DB(AMPUSER/${EXTTOCALL}/followme/fixedcid)}'));
			$ext->add($contextname, $exten, '', new ext_return(''));

			$exten = 's-did';
			$ext->add($contextname, $exten, '', new ext_execif('$["${REGEX("^[\+]?[0-9]+$" ${FROM_DID})}" = "1"]', 'Set', '__REALCALLERIDNUM=${FROM_DID}'));
			$ext->add($contextname, $exten, '', new ext_return(''));

			$exten = 's-forcedid';
			$ext->add($contextname, $exten, '', new ext_execif('$["${REGEX("^[\+]?[0-9]+$" ${FROM_DID})}" = "1"]', 'Set', '__TRUNKCIDOVERRIDE=${FROM_DID}'));
			$ext->add($contextname, $exten, '', new ext_return(''));

			$exten = '_s-.';
			$ext->add($contextname, $exten, '', new ext_noop('Unknown value for AMPUSER/${EXTTOCALL}/followme/changecid of ${DB(AMPUSER/${EXTTOCALL}/followme/changecid)} set to "default"'));
			$ext->add($contextname, $exten, '', new ext_setvar('DB(AMPUSER/${EXTTOCALL}/followme/changecid)', 'default'));
			$ext->add($contextname, $exten, '', new ext_return(''));

		break;
	}
}

function findmefollow_full_list() {
	$results = sql("SELECT grpnum FROM findmefollow ORDER BY CAST(grpnum as UNSIGNED)","getAll",DB_FETCHMODE_ASSOC);
	foreach ($results as $result) {
		if (isset($result['grpnum']) && checkRange($result['grpnum'])) {
			$grps[] = array($result['grpnum']);
		}
	}
	if (isset($grps))
		return $grps;
	else
		return null;
}

function findmefollow_list($get_all=false) {
	global $db;
	$sql = "SELECT grpnum FROM findmefollow ORDER BY CAST(grpnum as UNSIGNED)";
	$results = $db->getCol($sql);
	if(\DB::IsError($results)) {
		$results = null;
	}
	if (isset($results)) {
		foreach($results as $result) {
			if ($get_all || checkRange($result)){
				$grps[] = $result;
			}
		}
	}
	if (isset($grps)) {
		return $grps;
	}
	else {
		return null;
	}
}

// This gets the list of all active users so that the Find Me Follow display can limit the options to only created users.
// the returned arrays contain [0]:extension [1]:name
//
// This was pulled straight out of previous 1.x version, might need cleanup laster
//
function findmefollow_allusers() {
	global $db;
	$sql = "SELECT extension,name FROM users ORDER BY extension";
	$results = $db->getAll($sql);
	if(\DB::IsError($results)) {
		$results = null;
	}
	foreach($results as $result){
		if (checkRange($result[0])){
			$users[] = array($result[0],$result[1]);
		}
	}
	if (isset($users)) sort($users);
		return $users;
}

function findmefollow_users_configpageinit($pagename) {
	global $currentcomponent;

	$display = isset($_REQUEST['display'])?$_REQUEST['display']:null;
	$action = isset($_REQUEST['action'])?$_REQUEST['action']:null;
	$extdisplay = isset($_REQUEST['extdisplay'])?$_REQUEST['extdisplay']:null;
	$extension = isset($_REQUEST['extension'])?$_REQUEST['extension']:null;
	$tech_hardware = isset($_REQUEST['tech_hardware'])?$_REQUEST['tech_hardware']:null;

	// We only want to hook the 'extensions' pages.
	if ($pagename != 'extensions' && $pagename != 'users')  {
		return true;
	}

	// On a 'new' user, 'tech_hardware' is set, and there's no extension. Hook into the page.
	if ($tech_hardware != null || $pagename == 'users') {
		$currentcomponent->addguifunc('findmefollow_users_configpageload');
		$currentcomponent->addprocessfunc('findmefollow_users_configprocess', 8);
	} elseif ($action=="add") {
		// We don't need to display anything on an 'add', but we do need to handle returned data.
		$currentcomponent->addprocessfunc('findmefollow_users_configprocess', 8);
	} elseif ($extdisplay != '') {
		// We're now viewing an extension, so we need to display _and_ process.
		$currentcomponent->addguifunc('findmefollow_users_configpageload');
		$currentcomponent->addprocessfunc('findmefollow_users_configprocess', 8);
	}
}

function findmefollow_users_configpageload($pagename) {
	global $currentcomponent;
	global $amp_conf;
	global $extdisplay;

	$action			= isset($_REQUEST['action'])		? $_REQUEST['action']			: null;
	$extdisplay		= isset($_REQUEST['extdisplay'])	? $_REQUEST['extdisplay']		: null;
	$extension		= isset($_REQUEST['extension'])		? $_REQUEST['extension']		: null;
	$tech_hardware	= isset($_REQUEST['tech_hardware'])	? $_REQUEST['tech_hardware']	: null;
	$fmfm = (isset($extdisplay) && trim($extdisplay) != '') ? FreePBX::Findmefollow()->get($extdisplay, 1) : array();

	if(empty($fmfm) && (!isset($extdisplay) || trim($extdisplay) == '')) {
		$fmfm = array(
			"ddial" => ($amp_conf['FOLLOWME_DISABLED'] && !$amp_conf['FOLLOWME_AUTO_CREATE'] ? "CHECKED" : ""),
			"strategy" => $amp_conf['FOLLOWME_RG_STRATEGY'],
			"grptime" => $amp_conf['FOLLOWME_TIME'],
			"pre_ring" => $amp_conf['FOLLOWME_PRERING'],
		);
	} elseif(empty($fmfm) && isset($extdisplay) && trim($extdisplay) != '') {
		$fmfm = array(
			"ddial" => ($amp_conf['FOLLOWME_DISABLED'] && !$amp_conf['FOLLOWME_AUTO_CREATE'] ? "CHECKED" : ""),
			'grplist' => $extdisplay,
			'postdest' => "ext-local,".$extdisplay.",dest",
			"strategy" => $amp_conf['FOLLOWME_RG_STRATEGY'],
			"grptime" => $amp_conf['FOLLOWME_TIME'],
			"pre_ring" => $amp_conf['FOLLOWME_PRERING'],
		);
	}

	$moh = array();
	if (function_exists('music_list')) {
		$moh = music_list();
	}
	$recordings = recordings_list();
	$recordingslist = array();
	$recordingslist[] = array(
		"value" => "",
		"text" => _("None")
	);
	if (!empty($recordings)) {
		foreach ($recordings as $recording) {
			$recordingslist[] = array(
				"value" => $recording['id'],
				"text" => $recording['displayname']
			);
		}
	}

	$disabled = ($fmfm['ddial'] == "CHECKED");
	$category = "findmefollow";

	$currentcomponent->addTabTranslation($category, _("Find Me/Follow Me"));
	findmefollow_draw_general($fmfm,$currentcomponent,$category,$disabled,$recordingslist,$moh);
	findmefollow_draw_confirm($fmfm,$currentcomponent,$category,$disabled,$recordingslist,$moh);
	findmefollow_draw_cid($fmfm,$currentcomponent,$category,$disabled,$recordingslist,$moh);
	findmefollow_draw_destinations($fmfm,$currentcomponent,$category,$disabled,$recordingslist,$moh);
}

function findmefollow_draw_general($fmfm,&$currentcomponent,$category,$fmfmdisabled,$recordingslist,$moh) {
	global $display;
	$js = "
	if($('#extension').val().trim().length === 0) {
		$('#fmfm_ddial1').prop('checked', true);
		warnInvalid($('#extension'),'".sprintf(_("Please enter a valid %s number"),($display == "extensions" ? _("extension") : _("device")))."');
		return false;
	}
	var curval = $('#fmfm_grplist').val();
	if(curval.trim().length === 0){
		$('#fmfm_grplist').val($('#extension').val()+'\\n');
	}
	return true;
	";
	$currentcomponent->addjsfunc('fmfmEnabled(notused)', $js);

	$js = "
		var ext = $('#fmfm_quickpick').val(),
				fml = $('#fmfm_grplist').val().trim()
		if(fml.length > 0) {
			$('#fmfm_grplist').val(fml + '\\n' + ext).trigger('autosize.resize');;
		} else {
			$('#fmfm_grplist').val(ext).trigger('autosize.resize');;
		}
	";
	$currentcomponent->addjsfunc('fmfmQuickPick(notused)', $js);

	$section = _("General Settings");
	$guidefaults = array(
		"elemname" => "",
		"prompttext" => "",
		"helptext" => "",
		"currentvalue" => "",
		"valarray" => array(),
		"jsonclick" => '',
		"jsvalidation" => "",
		"failvalidationmsg" => "",
		"canbeempty" => true,
		"maxchars" => 0,
		"disable" => false,
		"inputgroup" => false,
		"class" => "",
		"cblabel" => 'Enable',
		"disabled_value" => 'DEFAULT',
		"check_enables" => 'true',
		"cbdisable" => false,
		"cbclass" => ''
	);

	$el = array(
		"elemname" => "fmfm_ddial",
		"prompttext" => _('Enabled'),
		"helptext" => _('By default (Yes) any call to this extension will go to this Follow-Me instead, including directory calls by name from IVRs. If set to "No", calls will go only to the extension. Destinations that directly specify FollowMe will come here regardless. Setting this to "No" is often used in conjunction with VmX Locater, where you want a call to ring the extension, and then only if the caller chooses to find you do you want the call to go through FollowMe.'),
		"currentvalue" => (($fmfmdisabled) ? 'disabled' : 'enabled'),
		"valarray" => array(
			array(
				"value" => "enabled",
				"text" => _("Yes")
			),
			array(
				"value" => "disabled",
				"text" => _("No")
			)
		),
		"jsonclick" => "frm_${display}_fmfmEnabled() && frm_${display}_fmfmConfirmEnabled() && frm_${display}_fmfmCIDMode()",
		"class" => "",
		"disable" => "",
		"pairedvalues" => false
	);
	$currentcomponent->addguielem($section, new gui_radio(array_merge($guidefaults,$el)), $category);

	if(FreePBX::Modules()->checkStatus('calendar')) {
		$el = array(
			"elemname" => "fmfm_calendar_enable",
			"prompttext" => _('Enable Calendar Matching'),
			"helptext" => _('Link this Follow Me to a Calendar or Calendar group to automatically Enable/Disable based on a schedule'),
			"currentvalue" => $fmfm['calendar_enable'],
			"valarray" => array(
				array(
					"value" => "1",
					"text" => _("Yes")
				),
				array(
					"value" => "0",
					"text" => _("No")
				)
			),
			"jsonclick" => "frm_${display}_fmfmCalChange(this)",
			"class" => "",
			"disable" => "",
			"pairedvalues" => false
		);
		$currentcomponent->addguielem($section, new gui_radio(array_merge($guidefaults,$el)), $category);

		$calendars = FreePBX::Calendar()->listCalendars();
		$selects = array(
			array(
				"text" => _("--Not Calendar Controlled--"),
				"value" => ""
			)
		);
		foreach($calendars as $id => $cal) {
			$selects[] = array(
				"text" => $cal['name'],
				"value" => $id
			);
		}
		$el = array(
			"elemname" => "fmfm_calendar_id",
			"prompttext" => _('Calendar'),
			"helptext" => _("If set the followme will only be active when the calendar has an event."),
			"currentvalue" => $fmfm['calendar_id'],
			"valarray" => $selects,
			"class" => "calendar-element",
			"canbeempty" => false,
			"jsvalidation" => "",
			"disable" => !$fmfm['calendar_enable'],
			"onchange" => "frm_${display}_fmfmCalSelect(this)"
		);
		$currentcomponent->addguielem($section, new gui_selectbox(array_merge($guidefaults,$el)), $category);

		$groups = FreePBX::Calendar()->listGroups();
		$selects = array(
			array(
				"text" => _("--Not Calendar Group Controlled--"),
				"value" => ""
			)
		);
		foreach($groups as $id => $gr) {
			$selects[] = array(
				"text" => $gr['name'],
				"value" => $id
			);
		}
		$el = array(
			"elemname" => "fmfm_calendar_group_id",
			"prompttext" => _('Calendar Group'),
			"helptext" => _("If set the followme will only be active when the calendar group has an event."),
			"currentvalue" => $fmfm['calendar_group_id'],
			"valarray" => $selects,
			"class" => "calendar-element",
			"canbeempty" => false,
			"jsvalidation" => "",
			"disable" => !$fmfm['calendar_enable'],
			"onchange" => "frm_${display}_fmfmCalSelect(this)"
		);
		$currentcomponent->addguielem($section, new gui_selectbox(array_merge($guidefaults,$el)), $category);

		$el = array(
			"elemname" => "fmfm_calendar_match",
			"prompttext" => _('Calendar Match Inverse'),
			"helptext" => _('When set to yes follow me will match (be enabled) whenever there is an event. When set to no followme will match (be enabled) whenever no event is present'),
			"currentvalue" => $fmfm['calendar_match'],
			"valarray" => array(
				array(
					"value" => "yes",
					"text" => _("Yes")
				),
				array(
					"value" => "no",
					"text" => _("No")
				)
			),
			"jsonclick" => "",
			"class" => "calendar-element",
			"disable" => !$fmfm['calendar_enable'],
			"pairedvalues" => false
		);
		$currentcomponent->addguielem($section, new gui_radio(array_merge($guidefaults,$el)), $category);

		$js = "
			if($('#fmfm_calendar_id').val() !== '' && $('#fmfm_calendar_group_id').val() !== '') {
				$(self).val('');
				warnInvalid($(self),'"._("You can not set both a group and a calendar")."');
			}
		";
		$currentcomponent->addjsfunc('fmfmCalSelect(self)', $js);

		$js = "
			if($(self).val() == '1') {
				$('.calendar-element').prop('disabled',false);
			} else {
				$('.calendar-element').prop('disabled',true);
			}
		";
		$currentcomponent->addjsfunc('fmfmCalChange(self)', $js);
	}

	$sixtey = array();
	for ($i=0; $i <= 60; $i++) {
		$sixtey[] = array(
			"value" => $i,
			"text" => $i
		);
	}
	$el = array(
		"elemname" => "fmfm_pre_ring",
		"prompttext" => _('Initial Ring Time'),
		"helptext" => _("This is the number of seconds to ring the primary extension prior to proceeding to the follow-me list. The extension can also be included in the follow-me list. A 0 setting will bypass this."),
		"currentvalue" => $fmfm['pre_ring'],
		"valarray" => $sixtey,
		"class" => "fpbx-fmfm",
		"canbeempty" => false,
		"jsvalidation" => "frm_${display}_fmfmCheckFixed()",
	);
	$currentcomponent->addguielem($section, new gui_selectbox(array_merge($guidefaults,$el)), $category);

	$helptext = '<b>'. _("ringallv2") .'</b>: '._("ring Extension for duration set in Initial Ring Time, and then, while continuing call to extension, ring Follow-Me List for duration set in Ring Time.").'<br>'.
	'<b>'. _("ringall"). '</b>:  '. _("ring Extension for duration set in Initial Ring Time, and then terminate call to Extension and ring Follow-Me List for duration set in Ring Time."). '<br>'.
	'<b>'. _("hunt"). '</b>: '. _("take turns ringing each available extension"). '<br>'.
	'<b>'. _("memoryhunt"). '</b>: '. _("ring first extension in the list, then ring the 1st and 2nd extension, then ring 1st 2nd and 3rd extension in the list.... etc."). '<br>'.
	'<b>'. _("*-prim"). '</b>:  '. _("these modes act as described above. However, if the primary extension (first in list) is occupied, the other extensions will not be rung. If the primary is FreePBX DND, it won't be rung. If the primary is FreePBX CF unconditional, then all will be rung"). '<br>'.
	'<b>'. _("firstavailable"). '</b>:  '. _("ring only the first available channel"). '<br>'.
	'<b>'. _("firstnotonphone"). '</b>:  '. _("ring only the first channel which is not off hook - ignore CW"). '';
	$items = array('ringallv2','ringallv2-prim','ringall','ringall-prim','hunt','hunt-prim','memoryhunt','memoryhunt-prim','firstavailable','firstnotonphone');
	$optlist = array();
	foreach ($items as $item) {
		$optlist[] = array(
			"value" => $item,
			"text" => $item
		);
	}
	$el = array(
		"elemname" => "fmfm_strategy",
		"prompttext" => _("Ring Strategy"),
		"helptext" => $helptext,
		"currentvalue" => $fmfm['strategy'],
		"valarray" => $optlist,
		"class" => "fpbx-fmfm",
		"canbeempty" => false
	);
	$currentcomponent->addguielem($section, new gui_selectbox(array_merge($guidefaults,$el)), $category);

	$el = array(
		"elemname" => "fmfm_grptime",
		"prompttext" => _('Ring Time'),
		"helptext" => _("Time in seconds that the phones will ring. For all hunt style ring strategies, this is the time for each iteration of phone(s) that are rung"),
		"currentvalue" => $fmfm['grptime'],
		"valarray" => $sixtey,
		"class" => "fpbx-fmfm",
		"canbeempty" => false
	);
	$currentcomponent->addguielem($section, new gui_selectbox(array_merge($guidefaults,$el)), $category);

	$el = array(
		"elemname" => "fmfm_grplist",
		"prompttext" => _('Follow-Me List'),
		"helptext" => _("List extensions to ring, one per line, or use the Extension Quick Pick below.<br><br>You can include an extension on a remote system, or an external number by suffixing a number with a pound (#).  ex:  2448089# would dial 2448089 on the appropriate trunk (see Outbound Routing).<br><br>Note: Any local extension added will skip that local extension's FindMe/FollowMe, if you wish the system to use another extension's FindMe/FollowMe append a # onto that extension, eg 105#"),
		"currentvalue" => str_replace("-","\n",$fmfm['grplist']),
		"canbeempty" => false,
		"class" => "fpbx-fmfm",
		"jsvalidation" => "frm_${display}_fmfmListEmpty()",
		"failvalidationmsg" => _('Follow-Me List can not be empty if Follow-Me is enabled'),
	);
	foreach (core_users_list() as $result) {
		$el['select'][] = array(
			"value" => $result[0],
			"text" => $result[0]." (".$result[1].")"
		);
	}
	$currentcomponent->addguielem($section, new gui_textarea_select(array_merge($guidefaults,$el)),$category);

	$el = array(
		"elemname" => "fmfm_annmsg_id",
		"prompttext" => _('Announcement'),
		"helptext" => _("Message to be played to the caller before dialing this group.<br><br>To add additional recordings please use the \"System Recordings\" MENU to the left"),
		"currentvalue" => $fmfm['annmsg_id'],
		"valarray" => $recordingslist,
		"class" => "fpbx-fmfm",
		"canbeempty" => false
	);
	$currentcomponent->addguielem($section, new gui_selectbox(array_merge($guidefaults,$el)), $category);

	$optlist = array();
	$optlist[] = array(
		"value" => "Ring",
		"text" => _("Ring")
	);
	if (!empty($moh)) {
		foreach ($moh as $music) {
			$optlist[] = array(
				"value" => $music,
				"text" => $music
			);
		}
	}
	$el = array(
		"elemname" => "fmfm_ringing",
		"prompttext" => _('Play Music On Hold'),
		"helptext" => _("If you select a Music on Hold class to play, instead of 'Ring', they will hear that instead of Ringing while they are waiting for someone to pick up."),
		"currentvalue" => $fmfm['ringing'],
		"valarray" => $optlist,
		"class" => "fpbx-fmfm",
		"canbeempty" => false
	);
	$currentcomponent->addguielem($section, new gui_selectbox(array_merge($guidefaults,$el)), $category);

	$el = array(
		"elemname" => "fmfm_grppre",
		"prompttext" => _('CID Name Prefix'),
		"helptext" => _('You can optionally prefix the Caller ID name when ringing extensions in this group. ie: If you prefix with "Sales:", a call from John Doe would display as "Sales:John Doe" on the extensions that ring.'),
		"currentvalue" => $fmfm['grppre'],
		"canbeempty" => true,
		"class" => "fpbx-fmfm",
	);
	$currentcomponent->addguielem($section, new gui_textbox(array_merge($guidefaults,$el)),$category);

	$el = array(
		"elemname" => "fmfm_dring",
		"prompttext" => _('Alert Info'),
		"helptext" => _('You can optionally include an Alert Info which can create distinctive rings on SIP phones.'),
		"currentvalue" => $fmfm['dring'],
		"canbeempty" => true,
		"class" => "fpbx-fmfm",
	);
	$currentcomponent->addguielem($section, new gui_alertinfodrawselects(array_merge($guidefaults,$el)),$category);

	$rvollist = array(
		array(
			"text" => _("None"),
			"value" => ""
		)
	);

	for($i=1;$i<=14;$i++) {
		$rvollist[] = array(
			"text" => $i,
			"value" => $i
		);
	}

	$el = array(
		"elemname" => "fmfm_rvolume",
		"prompttext" => _('Ringer Volume Override'),
		"helptext" => _("Override the ringer volume. Note: This is only valid for Sangoma phones at this time"),
		"currentvalue" => $fmfm['rvolume'],
		"valarray" => $rvollist,
		"class" => "fpbx-fmfm",
		"canbeempty" => false
	);
	$currentcomponent->addguielem($section, new gui_selectbox(array_merge($guidefaults,$el)), $category);
}

function findmefollow_draw_confirm($fmfm,&$currentcomponent,$category,$fmfmdisabled,$recordingslist,$moh) {
	global $display;

	$js = "
	var dval = $('#fmfm_needsconf0').prop('checked') && !$('#fmfm_needsconf0').prop('disabled') ? false : true;
	$('.fpbx-fmfm-confirm-opts').prop('disabled',dval);
	return true;
	";
	$currentcomponent->addjsfunc('fmfmConfirmEnabled(notused)', $js);

	$confimDisabled = ($fmfm['needsconf'] != 'CHECKED' || $fmfmdisabled);
	$section = _("Call Confirmation Configuration");
	$guidefaults = array(
		"elemname" => "",
		"prompttext" => "",
		"helptext" => "",
		"currentvalue" => "",
		"valarray" => array(),
		"jsonclick" => '',
		"jsvalidation" => "",
		"failvalidationmsg" => "",
		"canbeempty" => true,
		"maxchars" => 0,
		"disable" => false,
		"inputgroup" => false,
		"class" => "",
		"cblabel" => 'Enable',
		"disabled_value" => 'DEFAULT',
		"check_enables" => 'true',
		"cbdisable" => false,
		"cbclass" => ''
	);
	$el = array(
		"elemname" => "fmfm_needsconf",
		"prompttext" => _('Confirm Calls'),
		"helptext" => _('Enable this if you\'re calling external numbers that need confirmation - eg, a mobile phone may go to voicemail which will pick up the call. Enabling this requires the remote side push 1 on their phone before the call is put through. This feature only works with the ringall/ringall-prim  ring strategy'),
		"currentvalue" => (($fmfm['needsconf'] != 'CHECKED') ? 'disabled' : 'enabled'),
		"valarray" => array(
			array(
				"value" => "enabled",
				"text" => _("Yes")
			),
			array(
				"value" => "disabled",
				"text" => _("No")
			)
		),
		"jsonclick" => "frm_${display}_fmfmConfirmEnabled()",
		"class" => "fpbx-fmfm",
		"pairedvalues" => false
	);
	$currentcomponent->addguielem($section, new gui_radio(array_merge($guidefaults,$el)), $category);

	$recordingslist[0] = array(
		"value" => "",
		"text" => _("Default")
	);
	$el = array(
		"elemname" => "fmfm_remotealert_id",
		"prompttext" => _('Remote Announce'),
		"helptext" => _("Message to be played to the person RECEIVING the call, if 'Confirm Calls' is enabled.<br><br>To add additional recordings use the \"System Recordings\" MENU to the left"),
		"currentvalue" => $fmfm['remotealert_id'],
		"valarray" => $recordingslist,
		"class" => "fpbx-fmfm-confirm-opts",
		"disable" => $confimDisabled,
		"canbeempty" => false
	);
	$currentcomponent->addguielem($section, new gui_selectbox(array_merge($guidefaults,$el)), $category);

	$el = array(
		"elemname" => "fmfm_toolate_id",
		"prompttext" => _('Too-Late Announce'),
		"helptext" => _("Message to be played to the person RECEIVING the call, if the call has already been accepted before they push 1.<br><br>To add additional recordings use the \"System Recordings\" MENU to the left"),
		"currentvalue" => $fmfm['toolate_id'],
		"valarray" => $recordingslist,
		"class" => "fpbx-fmfm-confirm-opts",
		"disable" => $confimDisabled,
		"canbeempty" => false
	);
	$currentcomponent->addguielem($section, new gui_selectbox(array_merge($guidefaults,$el)), $category);
}

function findmefollow_draw_cid($fmfm,&$currentcomponent,$category,$fmfmdisabled,$recordingslist,$moh) {
	global $display;
	$js = "
		var val = $('#fmfm_changecid').val();
		if(!$('#fmfm_changecid').prop('disabled') && (val == 'extern' || val == 'fixed')) {
			$('#fmfm_fixedcid').prop('disabled',false);
		} else {
			$('#fmfm_fixedcid').prop('disabled',true);
		}
	";
	$currentcomponent->addjsfunc('fmfmCIDMode(notused)', $js);

	$js = "
	var dval = $('#fmfm_ddial0').prop('checked') ? false : true;
	if(!dval && $('#fmfm_grplist').val().trim() === '') {
		return true;
	}
	return false;
	";
	$currentcomponent->addjsfunc('fmfmListEmpty(notused)', $js);

	$js = "
	if(!$('#fmfm_fixedcid').prop('disabled')) {
		var cid = $('#fmfm_fixedcid').val();
		return !(/^\+?\d+$/.test(cid));
	}
	return false;
	";
	$currentcomponent->addjsfunc('fmfmCheckFixed(notused)', $js);

	$section = _("Change External CID Configuration");
	$guidefaults = array(
		"elemname" => "",
		"prompttext" => "",
		"helptext" => "",
		"currentvalue" => "",
		"valarray" => array(),
		"jsonclick" => '',
		"jsvalidation" => "",
		"failvalidationmsg" => "",
		"canbeempty" => true,
		"maxchars" => 0,
		"disable" => false,
		"inputgroup" => false,
		"class" => "",
		"cblabel" => 'Enable',
		"disabled_value" => 'DEFAULT',
		"check_enables" => 'true',
		"cbdisable" => false,
		"cbclass" => ''
	);

	$helptext = '<b>'. _("Default") .'</b>: '._("Transmits the Callers CID if allowed by the trunk.").'<br>'.
	'<b>'. _("Fixed CID Value"). '</b>:  '. _("Always transmit the Fixed CID Value below."). '<br>'.
	'<b>'. _("Outside Calls Fixed CID Value"). '</b>: '. _("Transmit the Fixed CID Value below on calls that come in from outside only. Internal extension to extension calls will continue to operate in default mode."). '<br>'.
	'<b>'. _("Use Dialed Number"). '</b>: '. _("Transmit the number that was dialed as the CID for calls coming from outside. Internal extension to extension calls will continue to operate in default mode. There must be a DID on the inbound route for this. This will be BLOCKED on trunks that block foreign CallerID"). '<br>'.
	'<b>'. _("Force Dialed Number"). '</b>:  '. _("Transmit the number that was dialed as the CID for calls coming from outside. Internal extension to extension calls will continue to operate in default mode. There must be a DID on the inbound route for this. This WILL be transmitted on trunks that block foreign CallerID");
	$el = array(
		"elemname" => "fmfm_changecid",
		"prompttext" => _('Mode'),
		"helptext" => $helptext,
		"currentvalue" => $fmfm['changecid'],
		"valarray" => array(
			array(
				"value" => "default",
				"text" => _("Default")
			),
			array(
				"value" => "fixed",
				"text" => _("Fixed CID Value")
			),
			array(
				"value" => "extern",
				"text" => _("Outside Calls Fixed CID Value")
			),
			array(
				"value" => "did",
				"text" => _("Use Dialed Number")
			),
			array(
				"value" => "forcedid",
				"text" => _("Force Dialed Number")
			)
		),
		"onchange" => "frm_${display}_fmfmCIDMode()",
		"class" => "fpbx-fmfm",
		"canbeempty" => false
	);
	$currentcomponent->addguielem($section, new gui_selectbox(array_merge($guidefaults,$el)), $category);

	$el = array(
		"elemname" => "fmfm_fixedcid",
		"prompttext" => _('Fixed CID Value'),
		"helptext" => _('Fixed value to replace the CID with used with some of the modes above. Should be in a format of digits only with an option of E164 format using a leading "+".'),
		"currentvalue" => $fmfm['fixedcid'],
		"canbeempty" => true,
		"class" => "fpbx-fmfm-cid",
		"disable" => ($fmfm['changecid'] != "fixed" && $fmfm['changecid'] != "extern"),
		"jsvalidation" => "frm_${display}_fmfmCheckFixed()",
		"failvalidationmsg" => _('Fixed CID Value should be in a format of digits only with an option of E164 format using a leading "+"'),
	);
	$currentcomponent->addguielem($section, new gui_textbox(array_merge($guidefaults,$el)),$category);
}

function findmefollow_draw_destinations($fmfm,&$currentcomponent,$category,$fmfmdisabled,$recordingslist,$moh) {
	global $extdisplay;
	if(empty($extdisplay)) {
		//return;
	}
	$section = _("Destinations");
	$guidefaults = array(
		"elemname" => "",
		"prompttext" => "",
		"helptext" => "",
		"currentvalue" => "",
		"valarray" => array(),
		"jsonclick" => '',
		"jsvalidation" => "",
		"failvalidationmsg" => "",
		"canbeempty" => true,
		"maxchars" => 0,
		"disable" => false,
		"inputgroup" => false,
		"class" => "",
		"cblabel" => 'Enable',
		"disabled_value" => 'DEFAULT',
		"check_enables" => 'true',
		"cbdisable" => false,
		"cbclass" => ''
	);

	$el = array(
		"elemname" => "fmfm_goto",
		"prompttext" => _('No Answer'),
		"helptext" => _('Optional destination call is routed to when the call is not answered on an otherwise idle phone. If the phone is in use and the call is simply ignored, then the busy destination will be used.'),
		"canbeempty" => true,
		"class" => "fpbx-fmfm",
		"index" => "fmfm",
		"required" => true,
		"dest" => !empty($fmfm['postdest']) ? $fmfm['postdest'] : 'ext-local,,dest',
		"nodest_msg" => "",
		"reset" => true
	);
	$currentcomponent->addguielem($section, new gui_drawselects(array_merge($guidefaults,$el)),$category);
}

function findmefollow_users_configprocess() {
	global $currentcomponent;
	global $amp_conf;

	//create vars from the request
	$action = isset($_REQUEST['action'])?$_REQUEST['action']:null;
	$ext = isset($_REQUEST['extdisplay'])?$_REQUEST['extdisplay']:null;
	$extn = isset($_REQUEST['extension'])?$_REQUEST['extension']:null;

	if ($ext=='') {
		$extdisplay = $extn;
	} else {
		$extdisplay = $ext;
	}
	$settings = array();

	if(!empty($_REQUEST)) {
		foreach($_REQUEST as $key => $value) {
			if(preg_match("/^fmfm_(.*)/",$key,$matches)) {
				$settings[$matches[1]] = $value;
			}
		}
	}

	if(!empty($settings)) {
		$settings['ddial'] = ($settings['ddial'] == "enabled") ? "" : "CHECKED";
		if(isset($settings['needsconf'])) {
			$settings['needsconf'] = ($settings['needsconf'] == "enabled") ? "CHECKED" : "";
		}

		if(isset($_REQUEST[$_REQUEST[$settings['goto']]."fmfm"])) {
			$settings['postdest'] = $_REQUEST[$_REQUEST[$settings['goto']]."fmfm"];
		} else {
			$settings['postdest'] = "ext-local,$extdisplay,dest";
		}
		unset($settings['quickpick']);

		if (!isset($settings['fixedcid'])) {
			$settings['fixedcid'] = '';
		}
	}

	switch($action) {
		case "add":
			if (!isset($GLOBALS['abort']) || $GLOBALS['abort'] !== true) {
				if(!empty($settings)) {
					//check destination. make sure it is valid
					$settings['postdest'] = ($settings['postdest'] == 'ext-local,,dest') ? 'ext-local,'.$extdisplay.',dest' : $settings['postdest'];
					//dont let group list be empty. ever.
					$settings['grplist'] = empty($settings['grplist']) ? $extdisplay : $settings['grplist'];
					$settings['grplist'] = explode("\n",$settings['grplist']);

					FreePBX::Findmefollow()->add($extdisplay,$settings);
				} elseif($amp_conf['FOLLOWME_AUTO_CREATE']) {
					FreePBX::Findmefollow()->add($extdisplay);
				}
			}
		break;
		case "edit":
			if(!empty($settings)) {
				//Dont let group list be empty. Ever
				$settings['grplist'] = empty($settings['grplist']) ? $extdisplay : $settings['grplist'];
				$settings['grplist'] = explode("\n",$settings['grplist']);
				FreePBX::Findmefollow()->update($extdisplay,$settings);
			}
		break;
	}
}

function findmefollow_configpageinit($dispnum) {
	global $currentcomponent;
	global $amp_conf;

	if ( ($dispnum == 'users' || $dispnum == 'extensions') ) {
		$action			= isset($_REQUEST['action'])		? $_REQUEST['action']			: null;
		$extdisplay		= isset($_REQUEST['extdisplay'])	? $_REQUEST['extdisplay']		: null;
		$extension		= isset($_REQUEST['extension'])		? $_REQUEST['extension']		: null;
		$tech_hardware	= isset($_REQUEST['tech_hardware'])	? $_REQUEST['tech_hardware']	: null;
		if ($tech_hardware != null || $action == "add" || $extdisplay != '') {
			findmefollow_users_configpageinit($dispnum);
		}
	}
}

// we only return the destination that other modules might use, e.g. extenions/users
function findmefollow_getdest($exten) {
	return array('ext-findmefollow,FM' . $exten . ',1');
}

function findmefollow_getdestinfo($dest) {
	if (substr(trim($dest),0,17) == 'ext-findmefollow,' || substr(trim($dest),0,10) == 'ext-local,' && substr(trim($dest),-4) == 'dest') {
		$grp = explode(',',$dest);
		$grp = ltrim($grp[1],'FM');
		$thisgrp = FreePBX::Findmefollow()->get($grp);
		if (empty($thisgrp)) {
			return array();
		} else {
			return array(
				'description' => sprintf(_("Follow Me: %s"),urlencode($grp)),
				'edit_url' => 'config.php?display=findmefollow&extdisplay=GRP-'.urlencode($grp),
			);
		}
	} else {
		return false;
	}
}

function findmefollow_check_destinations($dest=true) {
	global $active_modules;

	$destlist = array();
	if (is_array($dest) && empty($dest)) {
		return $destlist;
	}
	$sql = "SELECT grpnum, postdest, name FROM findmefollow INNER JOIN users ON grpnum = extension ";
	if ($dest !== true) {
		$sql .= "WHERE postdest in ('".implode("','",$dest)."')";
	}
	$results = sql($sql,"getAll",DB_FETCHMODE_ASSOC);

	//$type = isset($active_modules['announcement']['type'])?$active_modules['announcement']['type']:'setup';

	foreach ($results as $result) {
		$thisdest = $result['postdest'];
		$thisid   = $result['grpnum'];
		$destlist[] = array(
			'dest' => $thisdest,
			'description' => sprintf(_("Follow-Me: %s (%s)"),$thisid,$result['name']),
			'edit_url' => 'config.php?display=findmefollow&extdisplay=GRP-'.urlencode($thisid),
		);
	}
	return $destlist;
}

function findmefollow_change_destination($old_dest, $new_dest) {
	$sql = 'UPDATE findmefollow SET postdest = "' . $new_dest . '" WHERE postdest = "' . $old_dest . '"';
	sql($sql, "query");
}

function findmefollow_recordings_usage($recording_id) {
	global $active_modules;

	$results = sql("SELECT `grpnum` FROM `findmefollow` WHERE `annmsg_id` = '$recording_id' OR `remotealert_id` = '$recording_id' OR `toolate_id` = '$recording_id'","getAll",DB_FETCHMODE_ASSOC);
	if (empty($results)) {
		return array();
	} else {
		//$type = isset($active_modules['ivr']['type'])?$active_modules['ivr']['type']:'setup';
		foreach ($results as $result) {
			$usage_arr[] = array(
				'url_query' => 'config.php?display=findmefollow&extdisplay=GRP-'.urlencode($result['grpnum']),
				'description' => sprintf(_("Follow-Me User: %s"),$result['grpnum']),
			);
		}
		return $usage_arr;
	}
}

function findmefollow_fmf_toggle($c) {
	global $ext;
	global $amp_conf;
	global $version;

	$id = "app-fmf-toggle"; // The context to be included
	$ext->addInclude('from-internal-additional', $id); // Add the include from from-internal

	$ext->add($id, $c, '', new ext_goto('start','s',$id));
	$c = 's';

	$ext->add($id, $c, 'start', new ext_answer(''));
	$ext->add($id, $c, '', new ext_wait('1'));
	$ext->add($id, $c, '', new ext_macro('user-callerid'));

	$ext->add($id, $c, '', new ext_gotoif('$["${DB(AMPUSER/${AMPUSER}/followme/ddial)}" = "EXTENSION"]', 'activate'));
	$ext->add($id, $c, '', new ext_gotoif('$["${DB(AMPUSER/${AMPUSER}/followme/ddial)}" = "DIRECT"]', 'deactivate','end'));

	$ext->add($id, $c, 'deactivate', new ext_setvar('DB(AMPUSER/${AMPUSER}/followme/ddial)', 'EXTENSION'));
	if ($amp_conf['USEDEVSTATE']) {
		$ext->add($id, $c, '', new ext_setvar('STATE', 'NOT_INUSE'));
		$ext->add($id, $c, '', new ext_gosub('1', 'sstate', $id));
	}
	if ($amp_conf['FCBEEPONLY']) {
		$ext->add($id, $c, 'hook_off', new ext_playback('beep')); // $cmd,n,Playback(...)
	} else {
		$ext->add($id, $c, 'hook_off', new ext_playback('followme&de-activated'));
	}
	$ext->add($id, $c, 'end', new ext_macro('hangupcall'));

	$ext->add($id, $c, 'activate', new ext_setvar('DB(AMPUSER/${AMPUSER}/followme/ddial)', 'DIRECT'));
	if ($amp_conf['USEDEVSTATE']) {
		$ext->add($id, $c, '', new ext_setvar('STATE', 'INUSE'));
		$ext->add($id, $c, '', new ext_gosub('1', 'sstate', $id));
	}
	if ($amp_conf['FCBEEPONLY']) {
		$ext->add($id, $c, 'hook_on', new ext_playback('beep')); // $cmd,n,Playback(...)
	} else {
		$ext->add($id, $c, 'hook_on', new ext_playback('followme&activated'));
	}
	$ext->add($id, $c, '', new ext_macro('hangupcall'));

	if ($amp_conf['USEDEVSTATE']) {
		$c = 'sstate';
		$ext->add($id, $c, '', new ext_dbget('DEVICES','AMPUSER/${AMPUSER}/device'));
		$ext->add($id, $c, '', new ext_gotoif('$["${DEVICES}" = "" ]', 'return'));
		$ext->add($id, $c, '', new ext_setvar('LOOPCNT', '${FIELDQTY(DEVICES,&)}'));
		$ext->add($id, $c, '', new ext_setvar('ITER', '1'));
		$ext->add($id, $c, 'begin', new ext_setvar($amp_conf['AST_FUNC_DEVICE_STATE'].'(Custom:FOLLOWME${CUT(DEVICES,&,${ITER})})','${STATE}'));
		$ext->add($id, $c, '', new ext_setvar('ITER', '$[${ITER} + 1]'));
		$ext->add($id, $c, '', new ext_gotoif('$[${ITER} <= ${LOOPCNT}]', 'begin'));
		$ext->add($id, $c, 'return', new ext_return());
	}
}
