#!/usr/bin/env php
<?php
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright (C) 2012 HEHE Enterprises, LLC d.b.a. i9 Technologies
//	Copyright 2013,2014 Schmooze Com Inc.

//Bootstrap FreePBX
$bootstrap_settings['freepbx_auth'] = false;
include '/etc/freepbx.conf';

$ot_debug = true;
$channel = $argv[1];

setVariable($channel, "ONETOUCH_REC_SCRIPT_STATUS", "STARTED");

// Who is the person pushing Record?
$pickupExten = getVariable($channel, "PICKUP_EXTEN");
$thisExtension = getVariable($channel, "THISEXTEN");

$realCallerIdNum = getVariable($channel, "REALCALLERIDNUM");

$dst = getVariable($channel, "DIALEDPEERNUMBER");
$bpeer = getVariable($channel, "BRIDGEPEER");
if(!$dst){
	$dst = $bpeer;
}
if (strpos($dst, '@') !== false) {
	$dstNum = $dst;
	$dstValue = explode('@',$dstNum);
	$dstData = $dstValue[0];
	if (strpos($dstData, '-') !== false){
		$dstExp = explode('-',$dstData);
	}
	if (strpos($dstData, '/') !== false){
		$dstExp = explode('/',$dstData);
	}
	$dst = trim($dstExp[1]);

}
if (strpos($dst, '/') !== false){
	$dstVal = explode('/',$dst);
	$dst = trim($dstVal[1]);
}
// Set $fromExten to be SOMETHING sane.
$fromExten = false;
// Go through these in order.
$f = array("FROMEXTEN", "FROM_DID", "REALCALLERIDNUM");
foreach ($f as $var) {
	$chanvar = $var;
	$check = getVariable($channel, $var);
	if ($check) {
		$fromExten = $check;
		break;
	}
}

if ($chanvar == "FROM_DID") {
	$bchannel = getVariable($channel, "BRIDGEPEER");
	if(strlen($bchannel) > 1) {
		 $check = getVariable($bchannel, "REALCALLERIDNUM");
		 if ($check) {
		          $fromExten = $check;
		 }
	}
}
// Was it set?
if (!$fromExten) {
	// Sigh.
	$fromExten = $thisExtension;
}

$mixmonid = getVariable($channel, "MIXMON_ID");
$bridgePeer = getVariable($channel, "BRIDGEPEER");

ot_debug("Checking pickup extension");
if($pickupExten != "") {
	ot_debug("Setting THISEXTEN to {$pickupExten}");
	setVariable($channel, "THISEXTEN", $pickupExten);
	$thisExtension = $pickupExten;
}

ot_debug("Checking this extension");
if($thisExtension == "") {
	ot_debug("Don't know what this exten is");
	// We don't know who we are. Let's figure it out.
	// There isn't, really, any sensible way to do this APART from just
	// looking through the DEVICE database.

	// Our device is whatever's before the - in the channl name.
	list($dev, )  = explode('-', $channel);
	ot_debug("Device is $dev");

	// However, before we look through all of them, we may (but not guaranteed
	// to be) the DIALEDPEERNUMBER.
	$dpn = getVariable($channel, "DIALEDPEERNUMBER");
	if ($astman->database_get("DEVICE/{$dpn}", "dial") == $dev) {
		// Woo! We found it!
		ot_debug("Found $dev from DIALEDPEERNUMBER as $dpn");
		$user = $astman->database_get("DEVICE/{$dpn}", "user");
		if (!$user) {
			// HOW DID THIS EVEN HAPPEN?!
			setVariable($channel, "ONETOUCH_REC_SCRIPT_STATUS", "DENIED-NOUSER");
			exit(0);
		}
		setVariable($channel, "THISEXTEN", $user);
		$thisExtension = $user;
	} else {
		// Well crap. OK. Fine. Let's get all of them then.
		$all_devices = $astman->database_show('DEVICE');
		foreach ($all_devices as $key => $dial) {
			$myvar = explode('/',trim($key,'/'));
			if (!empty($myvar[2]) && $myvar[2] == 'dial') {
				if ($dial == $dev) {
					// We found the DEVICE!
					$user = $astman->database_get("DEVICE/{$myvar[1]}", "user");
					ot_debug("We found device {$myvar[1]} to match our channel with user: $user");
					if ($user != '') {
						$thisExtension = $user;
						setVariable($channel, "THISEXTEN", $user);
						ot_debug("Changed thisExtension to $thisExtension");
						break;
					} else {
						ot_debug("No user specified, unable to track a better user to this device");
						setVariable($channel, "ONETOUCH_REC_SCRIPT_STATUS", "DENIED-NOT_LOGGED_IN");
						exit(0);
					}
				}
			}
		}
	}
}
ot_debug("This exten is $thisExtension");

//Check on demand setting for the extension
ot_debug("Checking on demand setting");
$onDemand = $astman->database_get("AMPUSER/{$thisExtension}/recording", "ondemand");
if($onDemand == "disabled") {
	ot_debug("Disabled");
	setVariable($channel, "ONETOUCH_REC_SCRIPT_STATUS", "DENIED-ASTDB");
	exit(0);
}

// Figure out who is the master channel, by looking for a RECORD_ID.
// This is created when a channel has started to record, and links
// to the master channel that is doing the recording.
$myMaster = getVariable($channel, "MASTER_CHANNEL(CHANNEL(name))");
$theirMaster = getVariable($bridgePeer, "MASTER_CHANNEL(CHANNEL(name))");
$masterChannel = false;
foreach (array($channel, $myMaster, $bridgePeer, $theirMaster) as $c) {
	$rid = getVariable($c, "RECORD_ID");
	if (!empty($rid)) {
		ot_debug("Found Master channel $rid");
		// Found it!
		$masterChannel = $rid;
		break;
	}
}

// Now, it's possible that that channel may not actually exist. If it was
// recording previously in a bridge, and recording was turned off, that
// bridge may have been removed./ Let's see if it's still there.
if ($masterChannel) {
	$test = getVariable($masterChannel, "CALLFILENAME");
	if (!$test) {
		// That channel doesn't exist. *flip tables*
		$masterChannel = false;
	}
}

if (!$masterChannel) {
	// We didn't find one. Well, I guess that means it's us.
	$masterChannel = $channel;
	foreach (array($channel, $myMaster, $bridgePeer, $theirMaster) as $c) {
		if (!empty($c)) {
			setVariable($c, "RECORD_ID", $masterChannel);
		}
	}
}

// Set default Record Policy Mode
$rpm = "NO";

ot_debug("Checking if channel $masterChannel is already recording");
$rid = getVariable($masterChannel, 'RECORD_ID');
if (!empty($rid)) {
	// This channel, previously, has been recording things.
	$recStatus = getVariable($rid, 'REC_STATUS');
	if ($recStatus == "RECORDING") {
		ot_debug("Found $rid as RECORDING");
		// We're recording. Are we allowed to stop it? The CURRENT channel will have the
		// latest, correct, policy mode.
		$rpm = getVariable($channel, "REC_POLICY_MODE");
		ot_debug("RPM is $rpm in $channel");
		if ($rpm == "FORCE" && $onDemand != "override") {
			ot_debug("Denied policymode - $onDemand and $rpm");
			setVariable($channel, "ONETOUCH_REC_SCRIPT_STATUS", "DENIED-POLICYMODE");
			exit(0);
		}

		ot_debug("Stopping");
		$astman->stopmixmonitor($rid, rand());
		setVariable($rid, "REC_STATUS", "STOPPED");
		setVariable($channel, "REC_STATUS", "STOPPED");
		setVariable($bridgePeer, "REC_STATUS", "STOPPED");
		setVariable($channel, "ONETOUCH_REC_SCRIPT_STATUS", "RECORDING_STOPPED");
		exit(0);
	}
	// Ah, it's not recording. So we just want to keep that Recording ID, as we're
	// going to use it later as our master channel. However, we do know what the
	// filename should be, so we'll update that
	ot_debug("Found $rid, but it's not recording");
	$masterChannel = $rid;
	$cfn = getVariable($masterChannel, "CALLFILENAME");
	if (!empty($cfn)) {
		$callFileName = $cfn;
	}
}

$year = getVariable($channel, "YEAR");
$month = getVariable($channel, "MONTH");
$day = getVariable($channel, "DAY");
$timestr = getVariable($channel, "TIMESTR");
// It's possible that ymd may not be set. Check them all.
if (!$year) {
	$year = date("Y");
	setVariable($channel, "YEAR", $year);
}

if (!$month) {
	$month = date("m");
	setVariable($channel, "MONTH", $month);
}

if (!$day) {
	$day = date("d");
	setVariable($channel, "DAY", $day);
}

if (!$timestr) {
	$timestr = "$year$month$day-".date("His");
	setVariable($channel, "TIMESTR", $day);
}

if (!$callFileName) {
	// We need to create the filename for this call.
	$uniqueid = getVariable($channel, "UNIQUEID");
	if (strpos($dst, '-') !== false) { // it has - in the dst
		$dest = explode('-', $dst);
		$dst = $dest[0];
	}
	$callFileName = "ondemand-$dst-$fromExten-$timestr-$uniqueid";
	ot_debug("CFN UPDATED ::$callFileName::");
}

// It's not recording
ot_debug("Checking recording polcy {$rpm}");
if($rpm == "NEVER" && $ondemand != "override") {
	ot_debug("Recording polcy is 'never', no override, exiting");
	setVariable($channel, "ONETOUCH_REC_SCRIPT_STATUS", "DENIED-NEVER_NO_OVERRIDE");
	exit(0);
}

//Start recording the channel
ot_debug("Recording Channel");
$mixMonDir = getVariable($channel, "MIXMON_DIR");
$mixMonFormat = getVariable($channel, "MIXMON_FORMAT");
$mixMonPost = getVariable($channel, "MIXMON_POST");

// Setting in both channels in case a subsequent park or attended transfer of one
setVariable($bridgePeer, "REC_STATUS", "RECORDING");
setVariable($channel, "REC_STATUS", "RECORDING");
global $version;
if(version_compare($version, "12.0", "lt")) {
	setVariable($channel, "AUDIOHOOK_INHERIT(MixMonitor)", "yes");
	setVariable($bridgePeer, "AUDIOHOOK_INHERIT(MixMonitor)", "yes");
}

$beep = getVariable($channel, 'MIXMON_BEEP');
//We originally removed this as we moved to handling mix monitor through dialplan in FREEPBX-14292 however
// if this is called elsewhere it causes an issue, so try to account for other people using this script
$currentContext = getVariable($channel, 'CONTEXT');
if ($currentContext != 'macro-one-touch-record') {
	$astman->mixmonitor($masterChannel, "{$mixMonDir}{$year}/{$month}/{$day}/{$callFileName}.{$mixMonFormat}", "ai(LOCAL_MIXMON_ID)$beep", $mixMonPost, rand());
}
$mixmonid = getVariable($channel, "LOCAL_MIXMON_ID");
setVariable($channel, "__MIXMON_ID", $mixmonid);
$channame = getVariable($channel, "CHANNEL(name)");
setVariable($channel, "__RECORD_ID", $channame);

//Set the monitor format and file name for the cdr entry
ot_debug("Setting CDR info");
$monFmt = ($mixMonFormat != "" ? $mixMonFormat : "wav");
setVariable($channel, "MON_FMT", $monFmt);
setVariable($bridgePeer, "CDR(recordingfile)", "{$callFileName}.{$monFmt}");
setVariable($channel, "CDR(recordingfile)", "{$callFileName}.{$monFmt}");

setVariable($bridgePeer, "CALLFILENAME", "{$callFileName}");
setVariable($channel, "CALLFILENAME", "{$callFileName}");

setVariable($channel, "ONETOUCH_REC_SCRIPT_STATUS", "RECORDING_STARTED");

//Get variable function
function getVariable($channel, $varName) {
	global $astman;

	$results = $astman->GetVar($channel, $varName, rand());

	if($results["Response"] != "Success"){
		return '';
	}

	return $results["Value"];
}

function ot_debug($string) {
	global $ot_debug;
	if ($ot_debug) {
		dbug($string);
		echo "$string\n";
	}
}


// Make sure we never set a global variable by
// checking thet the channel is not blank.
function setVariable($channel = false, $key, $val) {
	global $astman;

	if (!$channel) {
		return false;
	}
	$astman->SetVar($channel, $key, $val);
	return true;
}

