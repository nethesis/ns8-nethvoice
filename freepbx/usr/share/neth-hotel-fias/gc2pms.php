#!/usr/bin/env php
<?php

require_once dirname(__FILE__) . '/functions.inc.php';
require_once '/var/www/html/freepbx/hotel/functions.inc.php';
$section = getSection(dirname(__FILE__).'/'.basename($argv[0]));
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

if (empty($arguments['RN'])) {
    logMessage($section . " ERROR: missing room number", ERROR, str_replace('.php','',basename($argv[0])));
    exit(1);
}

if (empty($arguments['RO'])) {
    $arguments['RO'] = $arguments['RN'];
}

if (empty($arguments['G#'])) {
    $query = "SELECT reservation_number FROM `reservations` WHERE `room_number`= ?";
    $sth = $fiasdb->prepare($query);
    $sth->execute(array($old_room_number));
    $arguments['G#'] = $sth->fetchAll()[0][0];
}

if (!insertMessageIntoDB($section,$arguments)) {
    exit(1);
}
