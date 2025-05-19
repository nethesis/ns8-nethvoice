#!/usr/bin/env php
<?php

require_once dirname(__FILE__) . '/functions.inc.php';
require_once dirname(__FILE__) . '/fias-server-functions.inc.php';
$section = getServerSection(dirname(__FILE__).'/'.basename($argv[0]));
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

/*  RS - Room Maid Statuses
 *  1  Dirty/Vacant
 *  2  Dirty/Occupied
 *  3  Clean/Vacan
 *  4  Clean/Occupied
 *  5  Inspected/Vacant
 *  6  Inspected/Occupied
 */ 

if (!isset($arguments['RN'])) {
    logMessage("Error: missing room number",ERROR,str_replace('.php','',basename($argv[0])));
    exit(1);
}

if (!insertMessageIntoServerDB($section,$arguments)) {
    exit(1);
}
