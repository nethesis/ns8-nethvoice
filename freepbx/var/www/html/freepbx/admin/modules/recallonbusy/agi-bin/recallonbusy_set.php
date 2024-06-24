#!/usr/bin/env php
<?php
//Copyright (C) nethesis srl. (info@nethesis.it)
//
//This program is free software; you can redistribute it and/or
//modify it under the terms of the GNU General Public License
//as published by the Free Software Foundation; either version 2
//of the License, or (at your option) any later version.
//
//This program is distributed in the hope that it will be useful,
//but WITHOUT ANY WARRANTY; without even the implied warranty of
//MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//GNU General Public License for more details.

include_once '/etc/freepbx.conf';
include_once '/var/www/html/freepbx/rest/lib/libExtensions.php';

define("AGIBIN_DIR", "/var/lib/asterisk/agi-bin");
include(AGIBIN_DIR."/phpagi.php");
$agi = new AGI();

// Get caller
$callerid = getMainExtension( $agi->request['agi_callerid']);
$agi->verbose("Caller ID = $callerid");

global $astman;
// Check if extension has recall on busy enabled
$status = $astman->database_get("ROBconfig",$callerid);
$default_status = \FreePBX::Recallonbusy()->getConfig("default");
$agi->verbose("status: ". $status);
$agi->verbose("default status: ". $default_status);
if ($status == "disabled" || ( empty($status) && $default_status == 'disabled' )) {
    $agi->verbose("Recall On Busy DISABLED for extension ".$callerid);
    exit(0);
}
$agi->verbose("Recall On Busy ENABLED for extension ".$callerid);

// Get called id
$calledid = getMainExtension($argv[1]);
$agi->verbose("Called ID = $calledid");
if (empty($calledid) || empty($callerid) || !isMainExtension($callerid) ) {
    $agi->verbose("Wrong extension");
    exit(1);
}

// Play press 5 key to recall message
$digit = \FreePBX::Recallonbusy()->getConfig("digit");
$digit = (!empty($digit)) ? $digit : 5;
$agi->answer();
for ($i = 0; $i <2; $i++) {
    $res = $agi->stream_file('recall-on-busy-service-press',$digit);
    if($res['code'] == AGIRES_OK && $res['result'] > 0 && chr($res['result']) == $digit) {
        book_callback($callerid,$calledid);
    }
    $res = $agi->stream_file('press-'.$digit,$digit);
    if($res['code'] == AGIRES_OK && $res['result'] > 0 && chr($res['result']) == $digit) {
        book_callback($callerid,$calledid);
    }
    $res = $agi->stream_file('book-callback',$digit);
    if($res['code'] == AGIRES_OK && $res['result'] > 0 && chr($res['result']) == $digit) {
        book_callback($callerid,$calledid);
    }
    $res = $agi->stream_file('silence/3',$digit);
    if($res['code'] == AGIRES_OK && $res['result'] > 0 && chr($res['result']) == $digit) {
        book_callback($callerid,$calledid);
    }
}

function book_callback($callerid,$calledid) {
    global $agi;
    global $astman;
    //Create db entry for wating queue
    $recall_string = trim($astman->database_get("ROB",$calledid));
    $extensions_waiting = empty($recall_string) ? array() : explode('&',$recall_string);

    if (in_array($callerid,$extensions_waiting)) {
        $agi->verbose("Extension ".$callerid." already waiting for ".$calledid." to become available");
    } else {
        $extensions_waiting[] = $callerid;
        $astman->database_put("ROB", $calledid, implode('&',$extensions_waiting));
        $agi->verbose("Recall on Busy booked for extension ".$calledid);
    }
    $agi->stream_file('callback-booked');
    $agi->exec("Macro","hangupcall");
    exit(0);
}

