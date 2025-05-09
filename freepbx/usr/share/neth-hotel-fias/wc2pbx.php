#!/usr/bin/env php
<?php

require_once dirname(__FILE__) . '/functions.inc.php';
require_once '/var/www/html/freepbx/hotel/functions.inc.php';
$section = getSection(dirname(__FILE__).'/'.basename($argv[0]));
$arguments = getArguments($section,$argv);

/*  WC - Wakeup clear
 *  DA          Date
 *  RN          Room Number
 *  TI          Time
 */

if (!empty($arguments['RN'])) {
    $room_number = $arguments['RN'];
} else {
    logMessage($section ." ERROR: missing room number",ERROR,str_replace('.php','',basename($argv[0])));
}

$res = deleteAlarm($room_number);
if (!$res) {
    logMessage($section ." ERROR: failed to remove alarm for room $room_number",ERROR,str_replace('.php','',basename($argv[0])));
    exit(1);
} else {
    logMessage($section ." room $room_number alarm deleted",INFO,str_replace('.php','',basename($argv[0])));
}

