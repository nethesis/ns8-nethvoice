<?php /* $Id */
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2013 Schmooze Com Inc.
//
function timeconditions_getdest($exten) {
	return array('timeconditions,'.$exten.',1');
}

function timeconditions_getdestinfo($dest) {
	global $active_modules;

	if (substr(trim($dest),0,15) == 'timeconditions,') {
		$exten = explode(',',$dest);
		$exten = $exten[1];
		$thisexten = timeconditions_get($exten);
		if (empty($thisexten)) {
			return array();
		} else {
			//$type = isset($active_modules['announcement']['type'])?$active_modules['announcement']['type']:'setup';
			return array('description' => sprintf(_("Time Condition: %s"),$thisexten['displayname']),
			             'edit_url' => 'config.php?display=timeconditions&view=form&itemid='.urlencode($exten),
			            );
		}
	} else {
		return false;
	}
}

// returns a associative arrays with keys 'destination' and 'description'
function timeconditions_destinations() {
	//get the list of timeconditions
	$results = timeconditions_list(true);

	$extens = array();

	// return an associative array with destination and description
	if (isset($results)) {
		foreach($results as $result){
				$extens[] = array('destination' => 'timeconditions,'.$result['timeconditions_id'].',1', 'description' => $result['displayname']);
		}
		return $extens;
	} else {
		return null;
	}
}

/* 	Generates dialplan for conferences
	We call this with retrieve_conf
*/
function timeconditions_get_config($engine) {
	global $ext;  // is this the best way to pass this?
	global $conferences_conf;
	global $amp_conf;
	global $astman;
	$nt = FreePBX::Notifications();
	$rawname = 'timeconditionscal';
	//Cleanup... only look at "notice"
	foreach ($nt->list_all(600) as $notification) {
		if(isset($notification['module']) && $notification['module'] == $rawname){
			$nt->delete($rawname,$notification['id']);
		}
	}
	switch($engine) {
		case "asterisk":
			$DEVSTATE = $amp_conf['AST_FUNC_DEVICE_STATE'];
			$timelist = timeconditions_list(true);

			if(is_array($timelist)) {
				$context = 'timeconditions';
				$fc_context = 'timeconditions-toggles';
				$got_code_autoreset = false;
				$need_maint = false;

				foreach($timelist as $item) {
					// add dialplan
					// note we don't need to add 2nd optional option of true, gotoiftime will convert '|' to ',' for 1.6+
					$time_id = $item['timeconditions_id'];
					$invert_hint = (isset($item['invert_hint']) && ($item['invert_hint'] == '1')) ? true : false;
					$fcc_password = isset($item['fcc_password']) ? trim($item['fcc_password']) : '';

					$ext->add($context, $time_id, '', new ext_set("DB(TC/".$time_id."/INUSESTATE)", ($invert_hint)?"NOT_INUSE":"INUSE"));
					$ext->add($context, $time_id, '', new ext_set("DB(TC/".$time_id."/NOT_INUSESTATE)", ($invert_hint)?"INUSE":"NOT_INUSE"));

					if($item['mode'] == 'time-group') {
						$times = timeconditions_timegroups_get_times($item['time'],null,$item['timeconditions_id']);
						if (is_array($times)) {
							foreach ($times as $time) {
								$ext->add($context, $time_id, '', new ext_noop('TIMENOW: ${STRFTIME(${EPOCH},'.$time[2].',%H:%M,%a,%e,%b)}'.(!empty($time[2]) ? ','.$time[2] : '')));
								$ext->add($context, $time_id, '', new ext_noop('TIMEMATCHED: ${IFTIME('.str_replace("|",",",$time[1]).'?TRUE:FALSE)}'));
								$ext->add($context, $time_id, '', new ext_gotoiftime($time[1],'truestate'));
							}
						}
					} else {
						if(!empty($item['calendar_id'])) {
							try {
								 $val = FreePBX::Calendar()->ext_calendar_goto($item['calendar_id'],$item['timezone'],'truestate','falsestate');
								 $ext->add($context, $time_id, '', $val);
							} catch (Exception $e) {
								$uid = 'CAL-'.$item['calendar_group_id'];
								if(!$nt->exists($rawname, $uid)) {
									$nt->add_notice($rawname, $uid, _("Calendar Not found"), _("Your timecondition is linked to a non-existant calendar"), '?display=timeconditions&view=form&itemid='.$item['timeconditions_id'], true, false);
								}
								dbug($e->getMessage());
							}
						} elseif($item['calendar_group_id']) {
							try {
								$val = FreePBX::Calendar()->ext_calendar_group_goto($item['calendar_group_id'],$item['timezone'],'truestate','falsestate');
								$ext->add($context, $time_id, '', $val);
							} catch (Exception $e) {
								$uid = 'CALG-'.$item['calendar_group_id'];
								if(!$nt->exists($rawname, $uid)) {
									$nt->add_notice($rawname, $uid, _("Calendar Not found"), _("Your timecondition is linked to a non-existant calendar group"), '?display=timeconditions&view=form&itemid='.$item['timeconditions_id'], true, false);
								}
								dbug($e->getMessage());
							}
						}
					}

					$ext->add($context, $time_id, 'falsestate', new ext_gotoif('$["${DB(TC/'.$time_id.'):0:4}" = "true"]','truegoto'));
					$ext->add($context, $time_id, '', new ext_execif('$["${DB(TC/'.$time_id.')}" = "false"]','Set',"DB(TC/$time_id)="));
					$skip_dest = 'falsegoto';
					//Formerly part of USEDEVSTATE
					//Modifications by namezero111111 follow (FREEPBX-6415)
					$ext->add($context, $time_id, $skip_dest, new ext_set("$DEVSTATE(Custom:TC$time_id)",($invert_hint)?"NOT_INUSE":"INUSE"));
					//End USEDEVSTATE case
					//end modifications by namezero111111
					$ext->add($context, $time_id, '', new ext_execif('$["${DB(TC/'.$time_id.')}" = "false_sticky"]','Set',$DEVSTATE.'(Custom:TCSTICKY${ARG1})='.(($invert_hint)?"NOT_INUSE":"INUSE")));
					$ext->add($context, $time_id, '', new ext_gotoif('$["${TCRETURN}"!="RETURN"]',$item['falsegoto']));
					$ext->add($context, $time_id, '', new ext_set("TCSTATE",'false'));
					$ext->add($context, $time_id, '', new ext_set("TCOVERRIDE",'${IF($["${DB(TC/'.$time_id.'):0:5}" = "false"]?true:false)}'));
					$ext->add($context, $time_id, '', new ext_return(''));

					$ext->add($context, $time_id, 'truestate', new ext_gotoif('$["${DB(TC/'.$time_id.'):0:5}" = "false"]','falsegoto'));
					$ext->add($context, $time_id, '', new ext_execif('$["${DB(TC/'.$time_id.')}" = "true"]','Set',"DB(TC/$time_id)="));
					$skip_dest = 'truegoto';
					//Formerly part of USEDEVSTATE
					//Modifications by namezero111111 follow (FREEPBX-6415)
					$ext->add($context, $time_id, $skip_dest, new ext_set("$DEVSTATE(Custom:TC$time_id)",($invert_hint)?"INUSE":"NOT_INUSE"));
					//End USEDEVSTATE case
					//end modifications by namezero111111
					$ext->add($context, $time_id, '', new ext_execif('$["${DB(TC/'.$time_id.')}" = "true_sticky"]','Set',$DEVSTATE.'(Custom:TCSTICKY${ARG1})='.(($invert_hint)?"NOT_INUSE":"INUSE")));
					$ext->add($context, $time_id, '', new ext_gotoif('$["${TCRETURN}"!="RETURN"]',$item['truegoto']));
					$ext->add($context, $time_id, '', new ext_set("TCSTATE",'true'));
					$ext->add($context, $time_id, '', new ext_set("TCOVERRIDE",'${IF($["${DB(TC/'.$time_id.'):0:4}" = "true"]?true:false)}'));
					$ext->add($context, $time_id, '', new ext_return(''));

					$fcc = new featurecode('timeconditions', 'toggle-mode-'.$time_id);
					$c = $fcc->getCodeActive();
					unset($fcc);
					if ($c != '') {
						$got_code_autoreset = true;
						//Formerly part of USEDEVSTATE
						$ext->addHint($fc_context, $c, 'Custom:TC'.$time_id);
						//End USEDEVSTATE
						//Modifications by namezero111111 follow (FREEPBX-6415)
						$fcccode_macro_call = (!empty($fcc_password)) ? ','.$fcc_password:'';
						$ext->add($fc_context, $c, '', new ext_macro('user-callerid'));
						$ext->add($fc_context, $c, '', new ext_macro('toggle-tc', $time_id.$fcccode_macro_call));
						//end modifications by namezero111111
						$ext->add($fc_context, $c, '', new ext_hangup());

						// If using hints then we want to keep the current, if not, then we only need to update if it is
						// currently overridden
						//
						// If there are no times then this is purely manual and does not need to be updated
						//
						if ($amp_conf['TCMAINT'] && is_array($times) && count($times)) {
							$need_maint = true;
						}

					}
				}

				if ($got_code_autoreset) {
					$ext->add($fc_context, 'h', '', new ext_hangup());

					$ext->addInclude('from-internal-additional', $fc_context); // Add the include from from-internal
					$m_context = 'macro-toggle-tc';
					// for i18n playback in multiple languages
					$ext->add($m_context, 'lang-playback', '', new ext_gosubif('$[${DIALPLAN_EXISTS('.$m_context.',${CHANNEL(language)})}]', $m_context.',${CHANNEL(language)},${ARG1}', $m_context.',en,${ARG1}'));
					$ext->add($m_context, 'lang-playback', '', new ext_return());

					$ext->add($m_context, 's', '', new ext_gotoif('$[${ARG2} > 0]', 'hasauth','toggle'));
					$ext->add($m_context, 's', 'hasauth', new ext_authenticate('${ARG2}'));


					$ext->add($m_context, 's', 'toggle', new ext_setvar('INDEXES', '${ARG1}'));
					$ext->add($m_context, 's', '', new ext_setvar('TCRETURN','RETURN'));
					$ext->add($m_context, 's', '', new ext_setvar('TCSTATE', 'false'));

					$ext->add($m_context, 's', '', new ext_set("TCINUSE",'${DB(TC/${ARG1}/INUSESTATE)}'));
					$ext->add($m_context, 's', '', new ext_set("TCNOTINUSE",'${DB(TC/${ARG1}/NOT_INUSESTATE)}'));

					$ext->add($m_context, 's', '', new ext_setvar('LOOPCNT', '${FIELDQTY(INDEXES,&)}'));
					$ext->add($m_context, 's', '', new ext_setvar('ITER', '1'));
					$ext->add($m_context, 's', 'begin1', new ext_setvar('INDEX', '${CUT(INDEXES,&,${ITER})}'));

					$ext->add($m_context, 's', '', new ext_gosub('1', '${INDEX}', $context));
					$ext->add($m_context, 's', '', new ext_setvar('TCSTATE_${INDEX}', '${TCSTATE}'));
					$ext->add($m_context, 's', '', new ext_execif('$["${TCOVERRIDE}" = "true"]','Set','OVERRIDE=true'));

					$ext->add($m_context, 's', 'end1', new ext_setvar('ITER', '$[${ITER} + 1]'));
					$ext->add($m_context, 's', '', new ext_gotoif('$[${ITER} <= ${LOOPCNT}]', 'begin1'));

					$ext->add($m_context, 's', '', new ext_setvar('LOOPCNT', '${FIELDQTY(INDEXES,&)}'));
					$ext->add($m_context, 's', '', new ext_setvar('ITER', '1'));
					$ext->add($m_context, 's', 'begin2', new ext_setvar('INDEX', '${CUT(INDEXES,&,${ITER})}'));

					$ext->add($m_context, 's', '', new ext_set('DB(TC/${INDEX})', '${IF($["${OVERRIDE}" = "true"]?:${IF($["${TCSTATE_${INDEX}}" == "true"]?false:true)})}'));
					$ext->add($m_context, 's', '', new ext_gosub('1', '${INDEX}', $context));

					$ext->add($m_context, 's', 'end2', new ext_setvar('ITER', '$[${ITER} + 1]'));
					$ext->add($m_context, 's', '', new ext_gotoif('$[${ITER} <= ${LOOPCNT}]', 'begin2'));

					if ($amp_conf['FCBEEPONLY']) {
						$ext->add($m_context, 's', 'playback', new ext_playback('beep'));
					} else {
						$ext->add($m_context, 's', 'playback', new ext_gosub('1', 'lang-playback', $m_context, 'hook_0'));
					}
					$lang = 'en'; //English
					$ext->add($m_context, $lang, 'hook_0', new ext_playback('beep&silence/1&time&${IF($["${TCSTATE}" = "true"]?de-activated:activated)}'));
					$lang = 'ja'; //Japanese
					$ext->add($m_context, $lang, 'hook_0', new ext_playback('beep&silence/1&time-change&${IF($["${TCSTATE}" = "true"]?de-activated:activated)}'));
				}

				\FreePBX::Timeconditions()->updateCron();
			}
		break;
	}
}

function timeconditions_check_destinations($dest=true) {
	global $active_modules;

	$destlist = array();
	if (is_array($dest) && empty($dest)) {
		return $destlist;
	}
	$sql = "SELECT timeconditions_id, displayname, truegoto, falsegoto FROM timeconditions ";
	if ($dest !== true) {
		$sql .= "WHERE (truegoto in ('".implode("','",$dest)."') ) OR (falsegoto in ('".implode("','",$dest)."') )";
	}
	$results = sql($sql,"getAll",DB_FETCHMODE_ASSOC);

	$type = isset($active_modules['timeconditions']['type'])?$active_modules['timeconditions']['type']:'setup';

	foreach ($results as $result) {
		$thisdest    = $result['truegoto'];
		$thisid      = $result['timeconditions_id'];
		$description = sprintf(_("Time Condition: %s"),$result['displayname']);
		$thisurl     = 'config.php?display=timeconditions&view=form&itemid='.urlencode($thisid);
		if ($dest === true || $dest[0] == $thisdest) {
			$destlist[] = array(
				'dest' => $thisdest,
				'description' => $description . '('._('true goto').')',
				'edit_url' => $thisurl,
			);
		}
		$thisdest = $result['falsegoto'];
		if ($dest === true || $dest[0] == $thisdest) {
			$destlist[] = array(
				'dest' => $thisdest,
				'description' => $description . '('._('false goto').')',
				'edit_url' => $thisurl,
			);
		}
	}
	return $destlist;
}

function timeconditions_change_destination($old_dest, $new_dest) {
	$sql = 'UPDATE timeconditions SET truegoto = "' . $new_dest . '" WHERE truegoto = "' . $old_dest . '"';
	sql($sql, "query");

	$sql = 'UPDATE timeconditions SET falsegoto = "' . $new_dest . '" WHERE falsegoto = "' . $old_dest . '"';
	sql($sql, "query");
}


function timeconditions_list($getall=false) {
	return \FreePBX::Timeconditions()->listTimeconditions($getall);
}

function timeconditions_get($id){
	_timeconditions_backtrace();
	return FreePBX::Timeconditions()->getTimeCondition($id);
}

function timeconditions_del($id){
	_timeconditions_backtrace();
	return FreePBX::Timeconditions()->delTimeCondition($id);
}

//obsolete handled in timegroups module
function timeconditions_get_time( $hour_start, $minute_start, $hour_finish, $minute_finish, $wday_start, $wday_finish, $mday_start, $mday_finish, $month_start, $month_finish) {

	//----- Time Hour Interval proccess ----
	//
	if ($minute_start == '-') {
		$time_minute_start = "*";
	} else {
		$time_minute_start = sprintf("%02d",$minute_start);
	}
	if ($minute_finish == '-') {
		$time_minute_finish = "*";
	} else {
		$time_minute_finish = sprintf("%02d",$minute_finish);
	}
	if ($hour_start == '-') {
		$time_hour_start = '*';
	} else {
		$time_hour_start = sprintf("%02d",$hour_start) . ':' . $time_minute_start;
	}
	if ($hour_finish == '-') {
		$time_hour_finish = '*';
	} else {
		$time_hour_finish = sprintf("%02d",$hour_finish) . ':' . $time_minute_finish;
	}
	if ($time_hour_start == $time_hour_finish) {
		$time_hour = $time_hour_start;
	} else {
		$time_hour = $time_hour_start . '-' . $time_hour_finish;
	}

	//----- Time Week Day Interval proccess -----
	//
	if ($wday_start == '-') {
		$time_wday_start = '*';
	} else {
		$time_wday_start = $wday_start;
	}
	if ($wday_finish == '-') {
		$time_wday_finish = '*';
	} else {
		$time_wday_finish = $wday_finish;
	}
	if ($time_wday_start == $time_wday_finish) {
		$time_wday = $time_wday_start;
	} else {
		$time_wday = $time_wday_start . '-' . $time_wday_finish;
	}

	//----- Time Month Day Interval proccess -----
	//
	if ($mday_start == '-') {
		$time_mday_start = '*';
	} else {
		$time_mday_start = $mday_start;
	}
	if ($mday_finish == '-') {
		$time_mday_finish = '*';
	} else {
		$time_mday_finish = $mday_finish;
	}
	if ($time_mday_start == $time_mday_finish) {
		$time_mday = $time_mday_start;
	} else {
		$time_mday = $time_mday_start . '-' . $time_mday_finish;
	}

	//----- Time Month Interval proccess -----
	//
	if ($month_start == '-') {
		$time_month_start = '*';
	} else {
		$time_month_start = $month_start;
	}
	if ($month_finish == '-') {
		$time_month_finish = '*';
	} else {
		$time_month_finish = $month_finish;
	}
	if ($time_month_start == $time_month_finish) {
		$time_month = $time_month_start;
	} else {
		$time_month = $time_month_start . '-' . $time_month_finish;
	}
	$time = $time_hour . '|' . $time_wday . '|' . $time_mday . '|' . $time_month;
	return $time;
}

function timeconditions_get_state($id) {
	_timeconditions_backtrace();
	return FreePBX::Timeconditions()->getState($id);
}

function timeconditions_set_state($id, $state,$invert=false) {
	_timeconditions_backtrace();
	return FreePBX::Timeconditions()->setState($id, $state,$invert);
}

function timeconditions_create_fc($id, $displayname='') {
	_timeconditions_backtrace();
	return FreePBX::Timeconditions()->createFeatureCode($id, $displayname);
}

function timeconditions_add($post){
	_timeconditions_backtrace();
	return FreePBX::Timeconditions()->addTimeCondition($post);
}

function timeconditions_edit($id,$post){
	_timeconditions_backtrace();
	return FreePBX::Timeconditions()->editTimeCondition($id,$post);
}

function timeconditions_timegroups_usage($group_id) {

	$results = sql("SELECT timeconditions_id, displayname FROM timeconditions WHERE time = '$group_id'","getAll",DB_FETCHMODE_ASSOC);
	if (empty($results)) {
		return array();
	} else {
		foreach ($results as $result) {
			$usage_arr[] = array(
				"url_query" => "config.php?display=timeconditions&view=form&itemid=".$result['timeconditions_id'],
				"description" => $result['displayname'],
			);
		}
		return $usage_arr;
	}
}


function timeconditions_timegroups_list_usage($timegroup_id) {
	global $active_modules;
	$full_usage_arr = array();

	foreach(array_keys($active_modules) as $mod) {
		$function = $mod."_timegroups_usage";
		if (function_exists($function)) {
			$timegroup_usage = $function($timegroup_id);
			if (!empty($timegroup_usage)) {
				$full_usage_arr = array_merge($full_usage_arr, $timegroup_usage);
			}
		}
	}
	return $full_usage_arr;
}


function timeconditions_timegroups_list_groups() {
	_timeconditions_backtrace();
	return \FreePBX::Timeconditions()->listTimegroups(false, true);
}


//these are the users time selections for the current timegroup
function timeconditions_timegroups_get_times($timegroup, $convert=false, $timecondition_id=null) {
	global $db, $version;
	$tmparray = array();

	if ($convert && (!isset($version) || $version == '')) {
		$engineinfo = engine_getinfo();
		$version =  $engineinfo['version'];
	}
	if ($convert) {
		$ast_ge_16 = version_compare($version,'1.6','ge');
	}
	$sql = "SELECT id, time FROM timegroups_details WHERE timegroupid = $timegroup";
	$results = $db->getAll($sql);
	if(DB::IsError($results) || !is_array($results)) {
		$results = array();
	}
	$tz='';
	if ($timecondition_id>0) {
		$timezone = $db->getOne("SELECT timezone FROM timeconditions WHERE timeconditions_id = $timecondition_id");
		//If timezone is empty or "default" we use the current system tz
		$tz = (empty($timezone) || ($timezone == 'default')) ? "" : "|$timezone";
	}
	foreach ($results as $val) {
		$val[1].=$tz;
		$times = ($convert && $ast_ge_16) ? strtr($val[1],'|',',') : $val[1];
		$tmparray[] = array($val[0], $times, str_replace("|","",$tz));
	}
	return $tmparray;
}

//retrieve a single timegroup for the timegroups page
function timeconditions_timegroups_get_group($timegroup) {
	_timeconditions_backtrace();
	return FreePBX::Timeconditions()->getTimeGroup($timegroup);
}

//add a new timegroup for timegroups page
//expects an array of times, each an associative array
//Array ( [0] => Array ( [hour_start] => - [minute_start] => - [hour_finish] => -
//[minute_finish] => - [wday_start] => - [wday_finish] => - [mday_start] => -
//[mday_finish] => - [month_start] => - [month_finish] => - ) )
function timeconditions_timegroups_add_group($description,$times=null) {
	_timeconditions_backtrace();
	return FreePBX::Timeconditions()->addTimeGroup($description,$times);
}

function timeconditions_timegroups_add_group_timestrings($description,$timestrings) {
	global $db;
	global $amp_conf;

	$description = $db->escapeSimple($description);
	$sql = "insert timegroups_groups(description) VALUES ('$description')";
	$db->query($sql);
	if(method_exists($db,'insert_id')) {
		$timegroup = $db->insert_id();
	} else {
		$timegroup = $amp_conf["AMPDBENGINE"] == "sqlite3" ? sqlite_last_insert_rowid($db->connection) : mysql_insert_id($db->connection);
	}
	timeconditions_timegroups_edit_timestrings($timegroup,$timestrings);
	needreload();
	return $timegroup;
}

//delete a single timegroup from the timegroups page
function timeconditions_timegroups_del_group($timegroup) {
	_timeconditions_backtrace();
	return FreePBX::Timeconditions()->delTimeGroup($timegroup);
}

//update a single timegroup from the timegroups page
function timeconditions_timegroups_edit_group($timegroup,$description) {
	_timeconditions_backtrace();
	return FreePBX::Timeconditions()->editTimeGroup($timegroup,$description);
}

//update the timegroup_detail under a single timegroup from the timegroups page
function timeconditions_timegroups_edit_times($timegroup,$times) {
	_timeconditions_backtrace();
	return FreePBX::Timeconditions()->editTimes($timegroup,$times);
}

//update the timegroup_detail under a single timegroup
function timeconditions_timegroups_edit_timestrings($timegroup,$timestrings) {
	global $db;

	$timegroup = $db->escapeSimple($timegroup);
	$sql = "DELETE FROM timegroups_details WHERE timegroupid = $timegroup";
	$db->query($sql);
	foreach ($timestrings as $key=>$val) {
		$time = $val;
		if (isset($time) && $time != '' && $time <> '*|*|*|*') {
			$sql = "INSERT timegroups_details (timegroupid, time) VALUES ($timegroup, '$time')";
			$db->query($sql);
		}
	}
	needreload();
}

function timeconditions_timegroups_drawgroupselect($elemname, $currentvalue = '', $canbeempty = true, $onchange = '', $default_option = '') {
	global $tabindex;
	$output = '';
	$onchange = ($onchange != '') ? " onchange=\"$onchange\"" : '';

	$output .= "\n\t\t\t<select name=\"$elemname\" class=\"form-control\" tabindex=\"".++$tabindex."\" id=\"$elemname\"$onchange>\n";
	// include blank option if required
	if ($canbeempty) {
		$output .= '<option value="">'.($default_option == '' ? _("--Select a Group--") : $default_option).'</option>';
	}
	// build the options
	$valarray = timeconditions_timegroups_list_groups();
	foreach ($valarray as $item) {
		$itemvalue = (isset($item['value']) ? $item['value'] : '');
		$itemtext = (isset($item['text']) ? _($item['text']) : '');
		$itemselected = ($currentvalue == $itemvalue) ? ' selected' : '';

		$output .= "\t\t\t\t<option value='$itemvalue' $itemselected>$itemtext</option>\n";
	}
	if(!isset($_REQUEST['fw_popover'])) {
		$output .= "\t\t\t\t<option value='popover'>"._("Add New Time Group...")."</option>\n";
	}

	$output .= "\t\t\t</select>\n\t\t";
	return $output;
}

//---------------------------------stolen from time conditions and heavily modified------------------------------------------

/**
 * Generates options for a select list
 * @param  string $selected what hour should be marked selected
 * @return string           generated html
 */
function timeconditions_timegroups_hour_opts($selected=''){
	if($selected != '-'){
		$selected = sprintf("%02d", $selected);
	}
	$html = '<option value="-">-</option>';
	for ($i = 0 ; $i < 24 ; $i++) {
		$default = "";
		if ( sprintf("%02d", $i) === $selected ) {
			$default = ' selected';
		}
		$html .= "<option value=\"$i\" $default> ".sprintf("%02d", $i);
	}
	return $html;
}
/**
 * Generates options for a select list
 * @param  string $selected what minute should be marked selected
 * @return string           generated html
 */
function timeconditions_timegroups_minute_opts($selected=''){
	if($selected != '-'){
		$selected = sprintf("%02d", $selected);
	}
	$html = '<option value="-">-</option>';
	for ($i = 0 ; $i < 60 ; $i++) {
		$default = "";
		if ( sprintf("%02d", $i) === $selected ) {
			$default = ' selected';
		}
		$html .= "<option value=\"$i\" $default> ".sprintf("%02d", $i);
	}
	return $html;
}
/**
 * Generates options for a select list
 * @param  string $selected what Weekday should be marked selected
 * @return string           generated html
 */
function timeconditions_timegroups_weekday_opts($selected=''){
	$days = array(
		'sun' => _("Sunday"),
		'mon' => _("Monday"),
		'tue' => _("Tuesday"),
		'wed' => _("Wednesday"),
		'thu' => _("Thursday"),
		'fri' => _("Friday"),
		'sat' => _("Saturday")
	);
	$html = '<option value="-">-</option>';
	foreach ($days as $key => $value) {
		if ( $selected == $key ) {
			$default = ' selected';
		} else {
			$default = '';
		}
		$html .= '<option value="'.$key.'" '.$default.'>'.$value.'</option>';
	}
	return $html;
}
/**
 * Generates options for a select list
 * @param  string $selected what Month should be marked selected
 * @return string           generated html
 */
function timeconditions_timegroups_month_opts($selected=''){
	$days = array(
		'jan' => _("January"),
		'feb' => _("February"),
		'mar' => _("March"),
		'apr' => _("April"),
		'may' => _("May"),
		'jun' => _("June"),
		'jul' => _("July"),
		'aug' => _("August"),
		'sep' => _("September"),
		'oct' => _("October"),
		'nov' => _("November"),
		'dec' => _("December")
	);
	$html = '<option value="-">-</option>';
	foreach ($days as $key => $value) {
		if ( $selected == $key ) {
			$default = ' selected';
		} else {
			$default = '';
		}
		$html .= '<option value="'.$key.'" '.$default.'>'.$value.'</option>';
	}
	return $html;
}
/**
 * Generates options for a select list
 * @param  string $selected what monthday should be marked selected
 * @return string           generated html
 */
function timeconditions_timegroups_monthday_opts($selected=''){
	if($selected != '-'){
		$selected = sprintf("%02d", $selected);
	}
	$html = '<option value="-">-</option>';
	for ($i = 1 ; $i < 32 ; $i++) {
		$default = "";
		if ( sprintf("%02d", $i) === $selected ) {
			$default = ' selected';
		}
		$html .= "<option value=\"$i\" $default> ".sprintf("%02d", $i);
	}
	return $html;
}



function timeconditions_timegroups_drawtimeselects($name, $time) {
	if (isset($time)) {
		list($time_hour, $time_wday, $time_mday, $time_month) = explode('|', $time);
	} else {
		list($time_hour, $time_wday, $time_mday, $time_month) = Array('*','-','-','-');
	}
	// Hour could be *, hh:mm, hh:mm-hhmm
	if ( $time_hour === '*' ) {
		$hour_start = $hour_finish = '-';
		$minute_start = $minute_finish = '-';
	} else {
		list($hour_start_string, $hour_finish_string) = explode('-', $time_hour);
		if ($hour_start_string === '*') {
			$hour_start_string = $hour_finish_string;
		}
		if ($hour_finish_string === '*') {
			$hour_finish_string = $hour_start_string;
		}
		list($hour_start, $minute_start) = explode( ':', $hour_start_string);
		list($hour_finish, $minute_finish) = explode( ':', $hour_finish_string);
		if ( !$hour_finish) {
			$hour_finish = $hour_start;
		}
		if ( !$minute_finish) {
			$minute_finish = $minute_start;
		}
	}
	// WDay could be *, day, day1-day2
	if ( $time_wday != '*' ) {
		list($wday_start, $wday_finish) = explode('-', $time_wday);
		if ($wday_start === '*') {
			$wday_start = $wday_finish;
		}
		if ($wday_finish === '*') {
			$wday_finish = $wday_start;
		}
		if ( !$wday_finish) {
		 	$wday_finish = $wday_start;
		}
	} else {
		$wday_start = $wday_finish = '-';
	}
	if ( $time_mday != '*' ) {
		list($mday_start, $mday_finish) = explode('-', $time_mday);
		if ($mday_start === '*') {
			$mday_start = $mday_finish;
		}
		if ($mday_finish === '*') {
			$mday_finish = $mday_start;
		}
		if ( !$mday_finish) {
			$mday_finish = $mday_start;
		}
	} else {
		$mday_start = $mday_finish = '-';
	}
	// Month could be *, month, month1-month2
	if ( $time_month != '*' ) {
		list($month_start, $month_finish) = explode('-', $time_month);
		if ($month_start === '*') {
			$month_start = $month_finish;
		}
		if ($month_finish === '*') {
			$month_finish = $month_start;
		}
		if ( !$month_finish) {
		 	$month_finish = $month_start;
		}
	} else {
		$month_start = $month_finish = '-';
	}

	$html = '<span id="fs'.$name.'">';
	$html .= '<a href="#" class="delTG delAction pull-right" data-for="fs'.$name.'"><i class="fa fa-trash"></i></a>';
	$html .= '<div class="form-group row">';
	$html .= '<label for="'.$name.'hours" class="col-md-3 control-label">'._("Time to Start").'</label>
				<div class="col-md-2">
					<select name="'.$name.'[hour_start]" id="'.$name.'hours" class="form-control">
						'.timeconditions_timegroups_hour_opts($hour_start).'
					</select>
				</div>
				<div class="col-md-2">
					<select name="'.$name.'[minute_start]" id="'.$name.'minutes" class="form-control">
						'.timeconditions_timegroups_minute_opts($minute_start).'
					</select>
				</div>';
	$html .= '</div>';
	$html .= '<div class="form-group row">';
	$html .= '<label for="'.$name.'houre" class="col-md-3 control-label">'._("Time to finish").'</label>
				<div class="col-md-2">
					<select name="'.$name.'[hour_finish]" id="'.$name.'houre" class="form-control">
						'.timeconditions_timegroups_hour_opts($hour_finish).'
					</select>
				</div>
				<div class="col-md-2">
					<select name="'.$name.'[minute_finish]" id="'.$name.'minutee" class="form-control">
						'.timeconditions_timegroups_minute_opts($minute_finish).'
					</select>
				</div>';
	$html .= '</div>';
	$html .= '<div class="form-group row">';
	$html .= '<label for="'.$name.'wds" class="col-md-3 control-label">'._("Week Day Start").'</label>
				<div class="col-md-4">
					<select name="'.$name.'[wday_start]" id="'.$name.'wds" class="form-control">
						'.timeconditions_timegroups_weekday_opts($wday_start).'
					</select>
				</div>
			';
	$html .= '</div>';
	$html .= '<div class="form-group row">';
	$html .= '<label for="'.$name.'wde" class="col-md-3 control-label">'._("Week Day finish").'</label>
				<div class="col-md-4">
					<select name="'.$name.'[wday_finish]" id="'.$name.'wde" class="form-control">
						'.timeconditions_timegroups_weekday_opts($wday_finish).'
					</select>
				</div>
			';
	$html .= '</div>';
	$html .= '<div class="form-group row">';
	$html .= '<label for="'.$name.'mds" class="col-md-3 control-label">'._("Month Day start").'</label>
				<div class="col-md-4">
					<select name="'.$name.'[mday_start]" id="'.$name.'mds" class="form-control">
						'.timeconditions_timegroups_monthday_opts($mday_start).'
					</select>
				</div>
			';
	$html .= '</div>';
	$html .= '<div class="form-group row">';
	$html .= '<label for="'.$name.'mdf" class="col-md-3 control-label">'._("Month Day finish").'</label>
				<div class="col-md-4">
					<select name="'.$name.'[mday_finish]" id="'.$name.'mdf" class="form-control">
						'.timeconditions_timegroups_monthday_opts($mday_finish).'
					</select>
				</div>
			';
	$html .= '</div>';
	$html .= '<div class="form-group row">';
	$html .= '<label for="'.$name.'mons" class="col-md-3 control-label">'._("Month start").'</label>
				<div class="col-md-4">
					<select name="'.$name.'[month_start]" id="'.$name.'mons" class="form-control">
						'.timeconditions_timegroups_month_opts($month_start).'
					</select>
				</div>
			';
	$html .= '</div>';
	$html .= '<div class="form-group row">';
	$html .= '<label for="'.$name.'monf" class="col-md-3 control-label">'._("Month finish").'</label>
				<div class="col-md-4">
					<select name="'.$name.'[month_finish]" id="'.$name.'monf" class="form-control">
						'.timeconditions_timegroups_month_opts($month_finish).'
					</select>
				</div>
			';
	$html .= '</div>';
	$html .= '<br/><hr/><br/>';
	$html .= '</span>';
	return $html;

}

function timeconditions_timegroups_buildtime( $hour_start, $minute_start, $hour_finish, $minute_finish, $wday_start, $wday_finish, $mday_start, $mday_finish, $month_start, $month_finish) {
	_timeconditions_backtrace();
	return FreePBX::Timeconditions()->buildTime( $hour_start, $minute_start, $hour_finish, $minute_finish, $wday_start, $wday_finish, $mday_start, $mday_finish, $month_start, $month_finish);
}

//---------------------------end stolen from timeconditions-------------------------------------

// AJAX Handler for jQuery UI AutoComplete Time Zone field on Time Conditions page
if (isset($_REQUEST['term']) && strlen($_REQUEST['term'])>1) {
	Header('Content-Type: text/json');
	die(json_encode(array_values(preg_grep('*'.$_REQUEST['term'].'*i', DateTimeZone::listIdentifiers(DateTimeZone::ALL)))));
}

function _timeconditions_backtrace() {
	$trace = debug_backtrace();
	$function = $trace[1]['function'];
	$line = $trace[1]['line'];
	$file = $trace[1]['file'];
	freepbx_log(FPBX_LOG_WARNING,'Depreciated Function '.$function.' detected in '.$file.' on line '.$line);
}
