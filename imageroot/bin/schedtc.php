#!/usr/bin/env php
<?php

//include bootstrap
$restrict_mods = array('timeconditions' => true);
$bootstrap_settings['freepbx_auth'] = false;
include '/etc/freepbx.conf';
$tc = \FreePBX::Timeconditions();
$calendar = FreePBX::Calendar();
$conditions = $tc->listTimeconditions();
$groups = $tc->listTimeGroups();
$debug = false;
if(isset($argv[1]) && $argv[1] == "--debug") {
	$debug = true;
	print_r("Time Now:" . date("H:i|D|j|M|e")."\n\n");
}
foreach($conditions as $item){
	tcout($debug, "==Working with TimeCondition:".$item['displayname']."==");
	if(!$item['invert_hint']) {
		$not_inuse = 'NOT_INUSE'; //true && deactivated
		$inuse = 'INUSE'; //false && activated
		tcout($debug, "INVERTED BLF: false (NOT_INUSE = ".$not_inuse." & INUSE = ".$inuse.")");
	} else {
		$not_inuse = 'INUSE'; //true && deactivated
		$inuse = 'NOT_INUSE'; //false && activated
		tcout($debug, "INVERTED BLF: true (NOT_INUSE = ".$not_inuse." & INUSE = ".$inuse.")");
	}
	$tco = $astman->database_get("TC",$item['timeconditions_id']);
	$sticky = false;
	switch($tco) {
		case "true_sticky":
			$sticky = true;
		case "true":
			$override = true;
			tcout($debug, "OVERRIDE MODE: True (".$not_inuse.")");
		break;
		case "false_sticky":
			$sticky = true;
		case "false":
			$override = false;
			tcout($debug, "OVERRIDE MODE: False (".$inuse.")");
		break;
		default:
			$override = null;
			tcout($debug, "OVERRIDE MODE: not set");
		break;
	}
	$timeMatch = false;
	if($item['mode'] == 'time-group') {
		$tctimes = timeconditions_timegroups_get_times($item['time'],null,$item['timeconditions_id']);
		foreach($tctimes as $tctime){
			if($tc->checkTime($tctime[1])){
				$timeMatch = true;
				if(!$debug) {
					//no need to check other times if we matched
					//if debug is true run through all of them
					break;
				}
				tcout($debug, "=>".$tctime[1]. " is now");
			} else {
				tcout($debug, "=>".$tctime[1]. " is not now");
			}
		}
	} else {
		$item['timezone'] = ($item['timezone'] !== 'default') ? $item['timezone'] : \FreePBX::View()->getTimezone();
		if(!empty($item['calendar_group_id'])) {
			$timeMatch = $calendar->matchGroup($item['calendar_group_id'],null,$item['timezone']);
			$next = $calendar->getNextEventByGroup($item['calendar_group_id'],null,$item['timezone']);
		} else {
			$timeMatch = $calendar->matchCalendar($item['calendar_id'],null,$item['timezone']);
			$next = $calendar->getNextEvent($item['calendar_id'],null,$item['timezone']);
		}
		if($timeMatch) {
			tcout($debug, "=>".$next['startdate']." ".$next['starttime']." is now");
		} else {
			tcout($debug, "=>".$next['startdate']." ".$next['starttime']." is not now");
		}
	}
	tcout($debug, "TIME MATCHED: ".(($timeMatch)?"True":"False")." (".(($timeMatch)?$not_inuse:$inuse).")");

	if(!is_null($override)) {
		if($sticky || ($timeMatch !== $override)) {
			tcout($debug, "BLF MODE: Overridden to ".(($override)?"True":"False")." (".(($override)?$not_inuse:$inuse).")");
		} else {
			tcout($debug, "BLF MODE: ".(($timeMatch)?"True":"False")." [Reset Override as time match is the same as override mode]");
			$astman->database_put("TC",$item['timeconditions_id'],"");
		}
		$timeMatch = $override;
	} elseif($timeMatch) {
		tcout($debug, "BLF MODE: True (".$not_inuse.")");
	} else {
		tcout($debug, "BLF MODE: False (".$inuse.")");
	}
	if($timeMatch) {
		$response = $astman->send_request('Command',array('Command'=>"devstate change Custom:TC".$item['timeconditions_id']." ".$not_inuse));
	} else {
		$response = $astman->send_request('Command',array('Command'=>"devstate change Custom:TC".$item['timeconditions_id']." ".$inuse));
	}
	tcout($debug, $response['data']);
	tcout($debug, "");
}
$tc->updateCron();
function tcout($debug, $message) {
	if($debug) {
		print_r($message);
		print_r("\n");
	}
}
exit(0);
