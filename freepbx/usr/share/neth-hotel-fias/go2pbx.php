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
        $reservation_deleted = false;
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
            logMessage($section ." Room $room_number checked out successfully.",INFO,str_replace('.php','',basename($argv[0])));
        } else {
            $query = "DELETE FROM `reservations` WHERE `reservation_number`= ?";
            $sth = $fiasdb->prepare($query);
            $sth->execute(array($reservation_number));
            $reservation_deleted = true;

            $query = "SELECT guest_name FROM `reservations` WHERE `room_number`= ? ORDER BY `reservation_number`";
            $sth = $fiasdb->prepare($query);
            $sth->execute(array($room_number));
            $remaining_reservations = $sth->fetchAll(PDO::FETCH_ASSOC);

            $remaining_guests = array();
            foreach ($remaining_reservations as $reservation) {
                if (!empty($reservation['guest_name'])) {
                    $remaining_guests[] = trim($reservation['guest_name']);
                }
            }

            $query = 'UPDATE roomsdb.rooms SET text = ? WHERE extension = ?';
            $sth = $fiasdb->prepare($query);
            $sth->execute(array(implode(' - ', $remaining_guests), $room_number));
            logMessage($section ." Room $room_number is shared. Reservation $reservation_number removed from room.",INFO,str_replace('.php','',basename($argv[0])));
        }
        # Delete reservation
        if (!$reservation_deleted) {
            $query = "DELETE FROM `reservations` WHERE `reservation_number`= ?";
            $sth = $fiasdb->prepare($query);
	        $sth->execute(array($reservation_number));
        }
    } else {
        if (!externalCheckOut($room_number)) {
            throw new Exception("Error checking out room $room_number");
        }
        logMessage($section ." Room $room_number checked out successfully.",INFO,str_replace('.php','',basename($argv[0])));
    }
} catch (Exception $e){
    logMessage($section ." ERROR ". $e->getMessage(),ERROR,str_replace('.php','',basename($argv[0])));
    exit(1);
}
