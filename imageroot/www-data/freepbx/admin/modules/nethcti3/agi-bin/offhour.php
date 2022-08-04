#!/usr/bin/env php
<?php

#
# Copyright (C) 2017 Nethesis S.r.l.
# http://www.nethesis.it - nethserver@nethesis.it
#
# This script is part of NethServer.
#
# NethServer is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License,
# or any later version.
#
# NethServer is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with NethServer.  If not, see COPYING.
#

include_once('/etc/freepbx.conf');
define("AGIBIN_DIR", "/var/lib/asterisk/agi-bin");
include(AGIBIN_DIR."/phpagi.php");

global $db;
global $amp_conf;

$agi = new AGI();

try {
    $tz=$amp_conf['PHPTIMEZONE'];
    $dtz = new DateTimeZone($tz);
    $dt = new DateTime("now", $dtz);
} catch (Exception $e){
    $tz = date_default_timezone_get();
    $dtz = new DateTimeZone($tz);
    $dt = new DateTime("now", $dtz);
}
$utc_dtz = new DateTimeZone("UTC");
$utc_dt = new DateTime("now", $utc_dtz);

$offset = $dtz->getOffset($dt) - $utc_dtz->getOffset($utc_dt);

@$agi->verbose("[offhour] TimeZone=".$tz,4);

$didcidnum = $argv[1];
$didextension = $argv[2];

$sql="SELECT * FROM offhour WHERE didcidnum='$didcidnum' AND didextension='$didextension'";
$res=@$db->getRow($sql,DB_FETCHMODE_ASSOC);
if (@$db->isError($res)) {
    @$agi->verbose("[offhour] MySQL ERROR! ".$sql.$res->getMessage(),1);
    exit(0);
}

if (empty($res)) {
    @$agi->verbose("[offhour] No Off-Hours setting for this route",3);
    exit(0);
}

$time = time()+$offset;
$tbegin=$res['tsbegin']+$offset;
$tend=$res['tsend']+$offset;
   
@$agi->verbose("[offhour] Off-Hour {$res['displayname']} ($id)  -> enabled={$res['enabled']}, begin: $tbegin, now: $time, end: $tend",4);


//Decide if this condition is enabled or not
if ($res['enabled']==0) {
    @$agi->verbose("[offhour] Off-Hour disabled",2);
    $agi->noop();
    exit(0);
}
if ($res['enabled']==1) {
    @$agi->verbose("[offhour] Off-Hour always enable",2);
}
if ($res['enabled']==2) {
    if (($time >= $tbegin) and ($time <=$tend)) {
        @$agi->verbose("[offhour] Off-Hour enable in this period: $tbegin < $time < $tend",2);
    } else {
        @$agi->verbose("[offhour] Off-Hour disabled in this period",2);
        $agi->noop();
        exit(0);
    }
} 

//NethCTI type
@$agi->verbose("[offhour] Off-Hour active",2);
switch ($res['action']) {
    case "0":
        //Message and hangup
        @$agi->verbose("[offhour] message and hangup",3);
        $agi->answer();
        $agi->stream_file($res['message']);
        $agi->stream_file($res['message']);
        $agi->stream_file($res['message']);
        $agi->exec("Macro","hangupcall");
    break;
    case "1":
        //Message and voicemail
        @$agi->verbose("[offhour] message and voicemail",3);
        $agi->answer();
        $agi->stream_file($res['message']);
        if ($res['param'] != '') {
            @$agi->verbose("[offhour] Message on Voicemail: ".$res['param'],4);
            $agi->exec("Macro","vm,{$res['param']},NOMESSAGE");
        } 
        $agi->exec("Macro","hangupcall");
    break;
    case "2":
        //Call forward
        if ($res['param'] != '') {
            @$agi->verbose("[offhour] call forward to {$res['param']}",4);
            $agi->answer();
            $agi->stream_file('silence/1');
            # Dial Local/$param...
            $agi->exec_dial("Local",$res['param']."@from-internal");
        } else {
            @$agi->verbose("[offhour] Off-Hour NethCTI mode: call forward ERROR! MISSING DESTINATION!",1);
        }
        $agi->exec("Macro","hangupcall");
     break;
     default:
         @$agi->verbose("[offhour] Unknow action: ".$res['action'],1);
     break;
}

exit(0);

