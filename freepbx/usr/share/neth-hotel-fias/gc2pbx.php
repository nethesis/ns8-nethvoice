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

$guest_name = '';
if (!empty($arguments['GT'])) {
    $guest_name .= $arguments['GT']." ";
}
if (!empty($arguments['GF'])) {
    $guest_name .= $arguments['GF']." ";
}
if (!empty($arguments['GN'])) {
    $guest_name .= $arguments['GN'];
}
$guest_name = trim($guest_name);

if (!empty($arguments['RN'])) {
    $room_number = $arguments['RN'];
} else {
    logMessage($section . " ERROR: missing room number", ERROR, str_replace('.php','',basename($argv[0])));
    exit(1);
}

if (!empty($arguments['RO'])) {
    $old_room_number = $arguments['RO'];
} else {
    $old_room_number = $room_number;
}

if (!empty($arguments['G#'])) {
    $reservation_number = $arguments['G#'];
}

if (!empty($arguments['GL'])) {
    /*convert fias language code to normal language code*/
    switch ($arguments['GL']){
        case "FR":
            $guest_language="fr";
        break;
        case "GE":
            $guest_language="de";
        break;
        case "IT":
            $guest_language="it";
        break;
        case "SP":
            $guest_language="es";
        break;
        case "RU":
             $guest_language="ru";
        break;
        default:
            $guest_language="en";
    }
} else {
    $guest_language="en";
}

if (!empty($arguments['SF'])) {
    $swap_flag = $arguments['SF'];
} else {
    $swap_flag = '';
}

if (!empty($arguments['GS'])) {
    $share_flag = $arguments['GS'];
} else {
    $share_flag = 'N';
}

// Exec custom commands
$custom_fields = $ini_file['custom_fields'];
foreach (['A0','A1','A2','A3'] as $record_id) {
    if (!empty($arguments[$record_id]) && !empty($custom_fields[$record_id])) {
        // replace argument in custom command
        $custom_command = str_replace('%ARG%',$arguments[$record_id],$custom_fields[$record_id]);
        // replace %ROOM%, %RESERVATION%, %GUESTNAME%, %GUESTLANGUAGE%
        $custom_command = str_replace('%ROOM%',$room_number,$custom_command);
        $custom_command = str_replace('%RESERVATION%',$reservation_number,$custom_command);
        $custom_command = str_replace('%GUESTNAME%',$guest_name,$custom_command);
        $custom_command = str_replace('%GUESTLANGUAGE%',$guest_language,$custom_command);
        exec($custom_command, $output, $exit_val);
        logMessage("Executed custom command: $custom_command. Result: $exit_val",DEBUG,str_replace('.php','',basename($argv[0])));
    }
}

try {
    # check if old room was shared
    $query = "SELECT * FROM `reservations` WHERE `room_number`= ?";
    $sth = $fiasdb->prepare($query);
    $sth->execute(array($old_room_number));
    $res = $sth->fetchAll();
    if (count($res) === 1) {
        externalCheckOut($old_room_number);
    }

    # check if new room is shared
    $query = "SELECT * FROM `reservations` WHERE `room_number`= ?";
    $sth = $fiasdb->prepare($query);
    $sth->execute(array($room_number));
    $res = $sth->fetchAll();
    if  ($share_flag === 'N' && count($res) > 0 && $old_room_number !== $room_number ) {
       throw new Exception("Error: $room_number is already reserved but share flag isn't enabled");
    }
    if ( (count($res) === 0 && $old_room_number !== $room_number) || ( count($res) === 1 && $old_room_number === $room_number) ) {
        externalCheckIn($room_number, $reservation_number, $guest_name, $guest_language);
    }

    $query = "UPDATE `reservations` SET `room_number` = ?, `guest_name` = ?, `guest_language` = ?, `share_flag` = ? WHERE `reservation_number` = ?";
    $sth = $fiasdb->prepare($query);
    $sth->execute(array($room_number,$guest_name,$guest_language,$share_flag,$reservation_number));
} catch (Exception $e){
    logMessage($section ." ERROR ". $e->getMessage(),ERROR,str_replace('.php','',basename($argv[0])));
    exit(1);
}

