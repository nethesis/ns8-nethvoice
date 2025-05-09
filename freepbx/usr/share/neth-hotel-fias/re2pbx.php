#!/usr/bin/env php
<?php

require_once dirname(__FILE__) . '/functions.inc.php';
require_once '/var/www/html/freepbx/hotel/functions.inc.php';
$section = getSection(dirname(__FILE__).'/'.basename($argv[0]));
$arguments = getArguments($section,$argv);

/*  RE - Room equipment status
 *  RN          Room Number
 *  CS          Class of Service
 *  CT          Clear Text
 *  DN          Do-not-Disturb
 *  ID          UserId
 *  ML          Message Light Status
 *  MR          Minibar Rights
 *  PP          Printer Port
 *  PU          Number of Persons
 *  RS          Room Status
 *  TV          TV Rights
 *  VM          Voice Mail
 */

if (!empty($arguments['RN'])) {
    $room_number = $arguments['RN'];
} else {
    logMessage($section ." ERROR: missing room number",ERROR,str_replace('.php','',basename($argv[0])));
    exit(1);
}

/*  RS - Room Maid Statuses
 *  1  Dirty/Vacant
 *  2  Dirty/Occupied
 *  3  Clean/Vacan
 *  4  Clean/Occupied
 *  5  Inspected/Vacant
 *  6  Inspected/Occupied
 */
if (!empty($arguments['RS'])) {
    $room_status = $arguments['RS'];

    switch ($room_status) {
        case 1:
            // Dirty/Vacant
            externalCheckIn($room_number);
            externalCheckOut($room_number);
            logMessage($section ." INFO: room $room_number status: Dirty/Vacant",INFO,str_replace('.php','',basename($argv[0])));
        break;
        case 2:
            // Dirty/Occupied
            logMessage($section ." INFO: room $room_number status: Dirty/Occupied [not implemented]",INFO,str_replace('.php','',basename($argv[0])));
        break;
        case 3:
            // Clean/Vacant
            externalCheckOut($room_number);
            externalCleanRoom($room_number);
            logMessage($section ." INFO: room $room_number status: Clean/Vacant",INFO,str_replace('.php','',basename($argv[0])));
        break;
        case 4:
            // Inspected/Vacant
            externalCheckOut($room_number);
            externalCleanRoom($room_number);
            logMessage($section ." INFO: room $room_number status: Inspected/Vacant",INFO,str_replace('.php','',basename($argv[0])));
        break;
        case 5:
            // Inspected/Occupied
            logMessage($section ." INFO: room $room_number status: Inspected/Occupied [not implemented]",INFO,str_replace('.php','',basename($argv[0])));
        break;
    }
}

if (!empty($arguments['DN'])) {
    global $astman;
    if ($arguments['DN'] == 'Y') {
        // enable DND to extension $room_number
        $astman->database_put('DND', $room_number, 'YES');
    } else {
        // disable DND to extension $room_number
        $astman->database_del('DND', $room_number);
    }
}
