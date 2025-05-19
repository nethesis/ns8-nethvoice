#!/usr/bin/env php
<?php
//
// Copyright (C) 2010-2015 Nethesis s.r.l. - All rights reserved.
//

define("AGIBIN_DIR", "/var/lib/asterisk/agi-bin");
define("AMPORTAL_CONF", "/etc/amportal.conf");
define("MAX_TRIES",3);
define("TODAY",'1');
define("TOMORROW",'2');


require_once('/var/www/html/freepbx/hotel/functions.inc.php');
include_once(AGIBIN_DIR."/phpagi.php");

$debug=true;

function neth_debug($text) {
    global $agi;
    global $debug;
    if ($debug)
    	@$agi->verbose($text);
}


function exitError()
{
  global $agi;
  neth_debug("exitError()");
  @$agi->answer();
  @$agi->stream_file("alarm/contattare-reception");
  @$agi->exec("Macro","hangupcall");
  exit(0);
}

/******************************************************/

global $amp_conf;
$agi = new AGI();

$target = $argv[1];
$numtocall = $argv[2];

//Setup database connection:
$db_user = $amp_conf["AMPDBUSER"];
$db_pass = $amp_conf["AMPDBPASS"];
$db_host = 'localhost';
$db_name = 'asterisk';
$db_engine = 'mysql';
$datasource = $db_engine.'://'.$db_user.':'.$db_pass.'@'.$db_host.'/'.$db_name;
$db = @DB::connect($datasource); // attempt connection
$registerd=false;


if(@DB::isError($db)) {
        @$agi->verbose("Error conecting to asterisk database, skipped");
        exitError();
} else {
        $cdidsql="SELECT COUNT(*) FROM roomsdb.rooms WHERE extension=$target and clean !='1';";
	$cdidresult=@$db->getRow($cdidsql);
	$registered=$cdidresult[0][0];
}
neth_debug("registered=$registered");
$options = getOptions();
$rates = getAllRates();
$codes = getAllCodes();
$hcodes = getHotelCodes();

$group = getGroupOptions($target);
$same_group_ext = getSameGroupExt($target);

if (isset($group['groupcalls']))
{
    $groupcalls = $group['groupcalls'];
} else {
    $groupcalls = $options['groupcalls'];
}

if (isset($group['roomscalls']))
{
    $roomscalls = $group['roomscalls'];
} else {
    $roomscalls = $options['internal_call'];
}

if (isset($group['externalcalls']))
{
    $externalcalls = $group['externalcalls'];
} else {
    $externalcalls = $options['externalcalls'];
}

$codecall = false;

@$agi->exec('ResetCDR');
@$agi->set_variable("CHANNEL(accountcode)", $target);

@$agi->exec('Set',"toCall=$numtocall");

$quickcall = false;
foreach($codes as $code)
{
 neth_debug("code=$code[code] tocall=$numtocall");

  if($numtocall==$code['code'])
  {
    $quickcall = true;
    @$agi->exec('Set',"toCall=".$code[falsegoto]);
    $details = getTimeDetailsFromIdGroupsArray($code['id_timegroups_groups']);
    foreach($details as $detail)
    {
     $time_range=str_replace("|",",",$detail["time"]);
     @$agi ->exec("ExecIfTime","$time_range?Set(toCall=".$code['number'].")");
    }
  }
}

if($quickcall)
{
  neth_debug("Quickcall");
  $quicktocall = @$agi->get_variable("toCall");
  @$agi->exec("Goto","from-internal,$quicktocall[data],1");
  exit(0);
}

if($numtocall[0] == $options['prefix']) //check if call is internal or external
{
    //external call
    neth_debug("External call to $numtocall");
    if($registered)
    {
        //room checkin
        if ($externalcalls){
            //external call allowed
            $rate = findRate(substr($numtocall,1),$rates);  // cut the prefix
            if($rate && $rate['enabled'] == '1'){
                //Rate found. Call allowed
                neth_debug("external call allowed to ".$numtocall);
                @$agi->set_variable("CDR(cnum)",$target);
                @$agi->exec("Goto","hotel,".$numtocall.",3");
                exit(0);
            } else {
                neth_debug("Rate not found. Call not allowed");
                exitError();
            }
        } else {
            //external call not allowed
            neth_debug("external call not allowed");
            exitError();
        }
    } else {
        //room not in checkin
        neth_debug("room not in checkin");
        exitError();
    }
} else {
    //Internal call
    neth_debug("Internal call to $numtocall");
    foreach($hcodes as $hcode){
        neth_debug("Nome Codice $hcode[name] --- Codice $hcode[code]");
        if($numtocall== $hcode["code"] && $hcode["name"]=="configalarm"){
            $codecall = true;
        }
        if($numtocall== $hcode["code"] && $hcode["name"]=="cleanroom"){
            $codecall = true;
            $registered = true;
        }
        if($hcode["name"]=="extra" && strncmp($numtocall,$hcode["code"],3)=== 0){
            $codecall = true;
        }
        if(strncmp($numtocall,$hcode["code"],3)=== 0 && ($hcode["name"]=="dnd_on" || $hcode["name"]=="dnd_off" || $hcode["name"]=="dnd_toggle")) {
            $codecall = true;
        }
    }
    if($codecall){
        //Code call
        neth_debug("Code call allowed");
        exit(0);
    }

    if($registered)
    {
        //checkin room
        if(checkPattern($numtocall,$options['ext_pattern'])){
            //internal call
            neth_debug("internal call");
            if ($roomscalls) {
                //calls between rooms allowed
                neth_debug("calls between rooms allowed");
		@$agi->exec("Goto","ext-local,".$numtocall.",1");
                exit(0);
            } else {
                if ($groupcalls && in_array($numtocall, $same_group_ext)){
                    //calls between rooms of the same group allowed
                    neth_debug("calls between rooms of the same group allowed");
		    @$agi->exec("Goto","ext-local,".$numtocall.",1");
                    exit(0);
                } else {
                    //Call between rooms of the same group not allowed or rooms aren't in the same group
                    neth_debug("Call between rooms of the same group not allowed or rooms aren't in the same group");
                    exitError();
                }
            }
        } else {
            //not an allowed call pattern
            neth_debug("not an allowed call pattern");
            exitError();
        }
    } else {
        //checkout room
        if (checkPattern($numtocall,$options['ext_pattern']) && $options['internal_call_nocheckin']) {
            //internal calls from checkout rooms allowed
            neth_debug("internal calls from checkout rooms allowed");
	    @$agi->exec("Goto","ext-local,".$numtocall.",1");
            exit(0);
        } else {
            //internal calls from checkout rooms not allowed or not an internal pattern
            neth_debug("internal calls from checkout rooms not allowed or not an internal pattern");
            exitError();
        }
    }
}

exit(0);

?>
