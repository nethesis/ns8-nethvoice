#!/usr/bin/env php
<?php

require_once dirname(__FILE__) . '/functions.inc.php';
require_once '/var/www/html/freepbx/hotel/functions.inc.php';
$section = getSection(dirname(__FILE__).'/'.basename($argv[0]));
$arguments = getArguments($section,$argv);

/*  WR - Wakeup request
 *  DA          Date
 *  RN          Room Number
 *  TI          Time
 */

if (!empty($arguments['RN'])) {
    $room_number = $arguments['RN'];
} else {
    logMessage($section ." ERROR: missing room number",ERROR,str_replace('.php','',basename($argv[0])));
    exit(1);
}

if (!empty($arguments['DA']) && !empty($arguments['TI'])) {
    $time = substr($arguments['TI'],0,2).":".substr($arguments['TI'],2,2);
    $timestamp = strtotime(substr($arguments['DA'],0,2)."-".substr($arguments['DA'],2,2)."-".substr($arguments['DA'],4,2)." ".substr($arguments['TI'],0,2).":".substr($arguments['TI'],2,2).":00");
} else {
    logMessage($section ." ERROR: missing date and time",ERROR,str_replace('.php','',basename($argv[0])));
    exit(1);
}

# externalCreateAlarm($ext,$hour,$start,$end,$enabled,$days)
$res = externalCreateAlarm($room_number,$time,$timestamp,$timestamp+(24*60*60),1,1);
if (!$res) {
    logMessage($section ." ERROR: failed to create alarm for room $room_number",ERROR,str_replace('.php','',basename($argv[0])));
    exit(1);
} else {
    logMessage($section ." room $room_number alarm created at $time",INFO,str_replace('.php','',basename($argv[0])));
}
