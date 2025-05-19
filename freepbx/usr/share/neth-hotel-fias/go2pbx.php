#!/usr/bin/env php
<?php

require_once dirname(__FILE__) . '/functions.inc.php';
require_once '/var/www/html/freepbx/hotel/functions.inc.php';
$section = getSection(dirname(__FILE__).'/'.basename($argv[0]));
$arguments = getArguments($section,$argv);

// GO - Guest Check-Out
// GO ->RN G# GS SF

/*  GO - Guest Check-Out
 *  G#          Reservation Number
 *  RN          Room Number
 *  GS          Share Flag
 *  DA          Date
 *  SF          Swap Flag
 *  TI          Time
 *  WS          Workstation ID
 */

if (!empty($arguments['RN'])) {
    $room_number = $arguments['RN'];
} else {
    logMessage($section ." ERROR: missing room number",ERROR,str_replace('.php','',basename($argv[0])));
    exit(1);
}

if (!empty($arguments['G#'])) {
    $reservation_number = $arguments['G#'];
}

# Allow shared rooms
try {
    if (!empty($reservation_number)) {
        # Check if room is shared and there are other reservation for this room
        $query = "SELECT * FROM `reservations` WHERE `room_number`= ?";
        $sth = $fiasdb->prepare($query);
        $sth->execute(array($room_number));
	$res = $sth->fetchAll();
        if (count($res) <= 1) {
            # There is only one guest with this reservation
            if (!externalCheckOut($room_number)) {
                throw new Exception("Error checking out room $room_number");
            }
        } else {
            # Shared room. Remove guest name from room
            $query = 'UPDATE roomsdb.rooms SET text = TRIM(REPLACE(text,(SELECT guest_name FROM fias.reservations WHERE room_number = ?), "")) WHERE extension = ?';
            $sth = $fiasdb->prepare($query);
            $sth->execute(array($room_number,$room_number));
        }
        # Delete reservation
        $query = "DELETE FROM `reservations` WHERE `reservation_number`= ?";
        $sth = $fiasdb->prepare($query);
	$sth->execute(array($reservation_number));
    } else {
        if (!externalCheckOut($room_number)) {
            throw new Exception("Error checking out room $room_number");
        }
    }
} catch (Exception $e){
    logMessage($section ." ERROR ". $e->getMessage(),ERROR,str_replace('.php','',basename($argv[0])));
    exit(1);
}
