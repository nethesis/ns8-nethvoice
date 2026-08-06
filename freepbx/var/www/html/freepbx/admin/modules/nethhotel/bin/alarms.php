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
global $amp_conf;

$dbh = \FreePBX::Database();
$tslow = time()-120;
$tshigh = time()+30;
$sql = 'SELECT * FROM roomsdb.alarmcalls WHERE enabled = 1 AND timestamp > ? AND timestamp < ?';
$sth = $dbh->prepare($sql);
$sth->execute(array($tslow,$tshigh));

$res = $sth->fetchAll();
if (count($res) === 0) {
    exit(0);
}

//get reception number
$sql = 'SELECT value FROM roomsdb.options WHERE variable = ?';
$sth = $dbh->prepare($sql);
$sth->execute(array("reception"));
$reception = $sth->fetchColumn();
if ($reception === false || $reception === '') {
    error_log('Unable to create hotel alarms: reception is not configured');
    exit(1);
}

foreach ($res as $alarm){
    //create call file
    $file = '';
    if ($alarm['alarmtype'] == 0) {
        $file .= "Channel: Local/{$alarm['extension']}@from-internal\n";
        $file .= "MaxRetries: 2\n";
        $file .= "RetryTime: 60\n";
        $file .= "WaitTime: 30\n";
        $file .= "CallerID: \"Sveglia\" <$reception>\n";
        $file .= "Set: CAMERA={$alarm['extension']}\n";
        $file .= "Set: RECEPTION=$reception\n";
        $file .= "Set: ALARM={$alarm['timestamp']}\n";
        $file .= "Set: CALLERID(name)=SVEGLIA\n";
        $file .= "Context: sveglia\n";
        $file .= "Priority: 1\n";
        $file .= "Extension: s\n";
        $filename = $alarm['extension'].'-'.$alarm['timestamp'].".call";
    } else {
        $file .= "Channel: Local/$reception@from-internal\n";
        $file .= "MaxRetries: 5\n";
        $file .= "RetryTime: 60\n";
        $file .= "WaitTime: 30\n";
        $file .= "CallerID: \"Allarme Sveglia {$alarm['extension']}\" <{$alarm['extension']}>\n";
        $file .= "Set: CAMERA={$alarm['extension']}\n";
        $file .= "Set: RECEPTION=$reception\n";
        $file .= "Set: ALARM={$alarm['timestamp']}\n";
        $file .= "Set: CALLERID(name)=SVEGLIA\n";
        $file .= "Context: allarmesveglia\n";
        $file .= "Priority: 1\n";
        $file .= "Extension: s\n";
        $filename = $reception.'-'.$alarm['timestamp'].".call";
    }
    $fname = tempnam("/tmp", 'alarm');
    if ($fname === false) {
        error_log('Unable to create a temporary hotel alarm file');
        continue;
    }
    $openfile = fopen($fname,"w");
    if ($openfile === false) {
        error_log('Unable to open temporary hotel alarm file '.$fname);
        unlink($fname);
        continue;
    }
    fwrite($openfile,$file);
    fclose($openfile);

    // move file into asterisk dir
    chown($fname,'asterisk');
    chgrp($fname,'asterisk');
    $moved = rename($fname,"/var/spool/asterisk/outgoing/".$filename);
    if ($moved === false) {
        error_log("Error moving call file! $fname -> /var/spool/asterisk/outgoing/".$filename);
        unlink($fname);
        continue;
    }

    // mark enabled = 0 to avoid more ringing
    $sql = 'UPDATE roomsdb.alarmcalls SET enabled = 0 WHERE enabled = 1 AND extension = ? AND timestamp > ? AND timestamp < ?';
    $sth = $dbh->prepare($sql);
    $sth->execute(array($alarm['extension'],$tslow,$tshigh));
}
