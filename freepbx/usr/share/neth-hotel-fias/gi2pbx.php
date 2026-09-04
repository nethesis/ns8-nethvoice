#!/usr/bin/env php
<?php

require_once dirname(__FILE__) . '/functions.inc.php';
require_once '/var/www/html/freepbx/hotel/functions.inc.php';
$section = getSection(dirname(__FILE__).'/'.basename($argv[0]));
$arguments = getArguments($section,$argv);

/*  GI - Guest Check-in
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
 *  SF          Swap Flag
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

$guest_group_configured = array_key_exists('GG', $arguments);
if ($guest_group_configured) {
    # NethHotel stores group names in a varchar(100). Normalize once so group
    # lookup and creation always use the same bounded value.
    $guest_group_number = substr(trim($arguments['GG']), 0, 100);
} else {
    $guest_group_number = '';
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

# check reservations for this room
try {
    $query = "SELECT * FROM `reservations` WHERE `room_number`= ?";
    $sth = $fiasdb->prepare($query);
    $sth->execute(array($room_number));
    $res = $sth->fetchAll();
    if (count($res) === 0) {
        # no reservation for this room
        if (!externalCheckIn($room_number, $reservation_number, $guest_name, $guest_language)) {
            throw new Exception("Error checking in room $room_number");
        }
    } else {
        # room already reserved
        if  ($share_flag === 'N') {
            logMessage($section ." WARNING: $room_number is reserved but share flag isn't enabled", ERROR,str_replace('.php','',basename($argv[0])));
            if (!externalCheckIn($room_number, $reservation_number, $guest_name, $guest_language)) {
                throw new Exception("Error checking in room $room_number");
            }
        } else {
            # Keep the existing occupancy and add the shared guest to its label.
            # externalCheckIn() must not be used here because it force-checks out
            # an already occupied room before checking it in again.
            $query = "SELECT text FROM roomsdb.rooms WHERE extension = ? AND clean = 0";
            $sth = $db->prepare($query);
            $sth->execute(array($room_number));
            $old_name = $sth->fetchColumn();
            if ($old_name === false) {
                # FIAS still has a reservation, but NethHotel does not have an
                # active occupancy (for example, after a manual check-out).
                if (!externalCheckIn($room_number, $reservation_number, $guest_name, $guest_language)) {
                    throw new Exception("Error restoring check-in for shared room $room_number");
                }
            } else {
                $room_guest_name = empty($old_name) ? $guest_name : $old_name . " - " . $guest_name;
                if (!editSurname($room_number, $room_guest_name)) {
                    throw new Exception("Error adding shared guest to room $room_number");
                }
            }
        }
    }
    $query = "INSERT INTO `reservations` (`room_number`,`reservation_number`,`guest_name`,`guest_language`,`share_flag`,`checkindate`) VALUES (?,?,?,?,?,?)";
    $sth = $fiasdb->prepare($query);
    $sth->execute(array($room_number,$reservation_number,$guest_name,$guest_language,$share_flag,date('Y-m-d G:i:s')));

    if ($guest_group_configured && $guest_group_number === '') {
        # An empty GG explicitly means that this room is not in a guest group.
        if (!setGroup($room_number, 0)) {
            throw new Exception("Error removing room $room_number from its guest group");
        }
    } elseif ($guest_group_configured) {
        # FIAS GG is alphanumeric, while NethHotel uses an internal numeric ID.
        # Use the FIAS group number as the NethHotel group name so all rooms with
        # the same GG value are assigned to the same group.
        $group_note = "Created from FIAS guest group $guest_group_number";
        $options = getOptions();
        $query = "INSERT INTO roomsdb.room_groups (`name`,`note`,`fias_guest_group_number`,`groupcalls`,`roomscalls`,`externalcalls`) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE `id` = LAST_INSERT_ID(`id`)";
        $sth = $db->prepare($query);
        if (!$sth->execute(array(
            $guest_group_number,
            $group_note,
            $guest_group_number,
            (int)($options['groupcalls'] ?? 0),
            (int)($options['internal_call'] ?? 0),
            (int)($options['externalcalls'] ?? 0)
        ))) {
            throw new Exception("Error creating or reusing guest group $guest_group_number");
        }
        $group_id = (int)$db->lastInsertId();
        if ($group_id <= 0) {
            throw new Exception("Error resolving guest group $guest_group_number");
        }

        if (!setGroup($room_number, $group_id)) {
            throw new Exception("Error assigning room $room_number to guest group $guest_group_number");
        }
    }
} catch (Exception $e){
    logMessage($section ." Error: ". $e->getMessage(),ERROR,str_replace('.php','',basename($argv[0])));
    exit(1);
}
