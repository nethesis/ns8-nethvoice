#!/usr/bin/env php
<?php

require_once dirname(__FILE__) . '/functions.inc.php';
require_once dirname(__FILE__) . '/fias-server-functions.inc.php';
$section = getServerSection(dirname(__FILE__).'/'.basename($argv[0]));
$arguments = getArguments($section,$argv);

/*  GC Guest Data Change notification
 *  G#          Reservation Number
 *  RN          Room Number
 *  GS          Share Flag
 *  A0 - A9     User Definable Fields
 *  CS          Class of Service
 *  DA          Date
 *  G+          Profile Number
 *  GA          Guest Arrival Date
 *  GD          Guest Departure Date
 *  GF          Guest First Name
 *  GG          Guest Group Number
 *  GL          Guest Language
 *  GN          Guest Name
 *  GT          Guest Title
 *  GV          Guest VIP Status
 *  MR          Minibar Rights
 *  NP          No Post Status
 *  RO          Old Room Number
 *  TI          Time
 *  TV          TV Rights
 *  VR          Video Rights
 *  WS          Workstation ID
 */

if (!isset($arguments['RN'])) {
    logMessage("Error: missing room number",ERROR,str_replace('.php','',basename($argv[0])));
    exit(1);
}

if (!insertMessageIntoServerDB($section,$arguments)) {
    exit(1);
}
