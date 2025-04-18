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
$tslow = mktime()-120;
$tshigh = mktime()+30;
$sql = 'SELECT * FROM roomsdb.alarmcalls WHERE enabled = 1 AND timestamp > ? AND timestamp < ?';
$sth = $dbh->prepare($sql);
$sth->execute(array($tslow,$tshigh));

$res = $sth->fetchAll();

//get reception number
$sql = 'SELECT value FROM roomsdb.options WHERE variable = ?';
$sth = $dbh->prepare($sql);
$sth->execute(array("reception"));
$reception = $sth->fetchAll()[0][0];

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
    $openfile = fopen($fname,"w");
    fwrite($openfile,$file);
    fclose($openfile);

    // move file into asterisk dir
    chown($fname,'asterisk');
    chgrp($fname,'asterisk');
    $res = rename($fname,"/var/spool/asterisk/outgoing/".$filename);
    if ($res == FALSE) {
        print("Error moving call file! $fname -> /var/spool/asterisk/outgoing/".$filename);
    }

    // mark enabled = 0 to avoid more ringing
    $sql = 'UPDATE roomsdb.alarmcalls SET enabled = 0 WHERE enabled = 1 AND extension = ? AND timestamp > ? AND timestamp < ?';
    $sth = $dbh->prepare($sql);
    $sth->execute(array($alarm['extension'],$tslow,$tshigh));
}

