#!/usr/bin/env php
<?php
#
# Copyright (C) 2018 Nethesis S.r.l.
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

include_once ("/etc/freepbx.conf");
global $db;
global $amp_conf;

define("AGIBIN_DIR", "/var/lib/asterisk/agi-bin");

require_once('/var/www/html/freepbx/hotel/functions.inc.php');
include_once(AGIBIN_DIR."/phpagi.php");
include_once('/etc/freepbx_db.conf');

$debug=true;

$calldate= @date("Y-m-d H:i:s");

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

$agi = new AGI();

$extension = $argv[1];
$alarm = $argv[2];
$reception = $argv[3];

$sql = "SELECT max(retry) FROM roomsdb.alarms_history WHERE extension=? and alarm=?";
$stmt = $db->prepare($sql);
$stmt->execute([$extension, $alarm]);
$res = $stmt->fetchAll();
$cdidresult = $res[0] ?? [];
neth_debug("$qrymaxretry Retry=" . ($cdidresult[0] ?? ''));

if (empty($cdidresult[0])) {
    $retry=0; # array vuoto, allora è la prima chiamata
} else {
    $retry=$cdidresult[0];
}

$allarme=false;

if ($retry == 2) {
    $retry=99;
    $allarme=true;
} else {
    $retry++;
}

$sql="INSERT INTO roomsdb.alarms_history (calldate,extension,alarm,retry) values (?,?,?,?)";
neth_debug($sql);
$stmt = $db->prepare($sql);
$stmt->execute([$calldate, $extension, $alarm, $retry]);

if ($allarme) {
    $time = mktime()+30;
    $sql = "INSERT INTO roomsdb.alarmcalls SET timestamp = ?, extension = ?, enabled = 1, alarmtype = 1";
    $stmt = $db->prepare($sql);
    $stmt->execute([$time, $extension]);
    neth_debug($sql);
    fias('WA2PMS', array(
        'RN' => $extension,
        'AS'  => 'NR', # No response
        'DA'  => date('ymd',$alarm),
        'TI'  => date('His',$alarm),
        ));
} else {
    fias('WA2PMS', array(
        'RN' => $extension,
        'AS'  => 'RY', # Retry
        'DA'  => date('ymd',$alarm),
        'TI'  => date('His',$alarm),
        ));
}

exit(0);
