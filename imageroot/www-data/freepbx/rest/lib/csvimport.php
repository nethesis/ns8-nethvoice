<?php

#
# Copyright (C) 2018 Nethesis S.r.l.
# http://www.nethesis.it - nethserver@nethesis.it
#
# This script is part of NethServer.
#
# NethServer is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License,
# or any later version.
#
# NethServer is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with NethServer.  If not, see COPYING.
#

include_once('/var/www/html/freepbx/rest/lib/libUsers.php');
include_once('/var/www/html/freepbx/rest/lib/libExtensions.php');
include_once('/var/www/html/freepbx/rest/lib/libCTI.php');
if (file_exists('/var/www/html/freepbx/rest/lib/libMigration.php')) {
    include_once('/var/www/html/freepbx/rest/lib/libMigration.php');
}

try {
    // prepare a file for saving results
    $statusfile = '/var/run/nethvoice/csvimport.code';
    $base64csv = $argv[1];
    $str = base64_decode($base64csv);
    $rowarr = explode(PHP_EOL, trim($str));
    $csv = array();

    foreach ($rowarr as $r) {
         $csv[] = str_getcsv($r);
    }

    # create users
    $result = 0;
    $err = '';
    // calculate step/progress/total
    $numusers = count($csv);
    $step = 100/$numusers/2; //use /2 because we use 2 for cicle
    $progress = -$step; //start with negative progress because

    foreach ($csv as $k => $row) {
        $progress += $step;
        file_put_contents($statusfile,json_encode(array('progress'=>round($progress))));
        # Skip comments
        if (substr($row[0],0,1) === '#') {
            continue;
        }

        # trim fields
        foreach ($row as $index => $field) {
            $row[$index] = trim($field);
        }

        # check that row has username and fullname field
        if (! $row['0'] || ! $row['1']) {
            $result += 1;
            $err .= "Error creating user: username and fullname can't be empty: ".implode(",",$row) ."\n";
            unset($csv[$k]);
            continue;
        }

        #lowercase username
        $row[0] = strtolower($row[0]);

        # create user
        if (!userExists($row[0])) {
            exec("/usr/bin/sudo /sbin/e-smith/signal-event user-create ".escapeshellarg($row[0])." ".escapeshellarg($row[1])." '/bin/false'", $out, $ret);
            $result += $ret;

            if ($ret > 0 ) {
                $err .= "Error creating user ".$row[0].": ".$out."\n";
                unset($csv[$k]);
                continue;
            }

            # Set password
            if ( ! isset($row[3]) || empty($row[3]) ){
                $row[3] = generateRandomPassword();
            }
        }
        $csv[$k] = $row;
    }

    # sync users
    system("/usr/bin/scl enable rh-php56 '/usr/sbin/fwconsole userman --syncall --force' &> /dev/null");

    foreach ($csv as $k => $row) {
        $progress += $step;
        if (round($progress)>99) $progress = 99;
        file_put_contents($statusfile,json_encode(array('progress'=>round($progress))));

        $user_id = getUserID($row[0]);
        $username = $row[0];

        // Set password
        if ( isset($row[3]) && ! empty($row[3]) ){
            $tmp = tempnam("/tmp","ASTPWD");
            file_put_contents($tmp, $row[3]);
            exec("/usr/bin/sudo /sbin/e-smith/signal-event password-modify '".getUser($row[0])."' $tmp", $out, $ret);
            $result += $ret;
            if ($ret > 0 ) {
                $err .= "Error setting password for user ".$row[0].": ".$out['message']."\n";
            } else {
                setPassword($username, $row[3]);
            }
        }

        #create extension
        if (isset($row[2]) && preg_match('/^[0-9]+$/',$row[2])) {
            if (checkUsermanIsUnlocked()) {
                $create = createMainExtensionForUser($username,$row[2]);
                if ($create !== true) {
                    $result += 1;
                    $err .= "Error adding main extension ".$row[2]." to user ".$username.": ".$create['message']."\n";
                } else {
                    // assign physical device to user if it is a migration
                    if (function_exists('isMigration') && isMigration()) {
                        $secret = getOldSecret($row[2]);
                        $extension = createExtension($row[2],false);
                        useExtensionAsCustomPhysical($extension,$secret,'temporaryphysical');
                    }
                }
            } else {
                $err .= "Error adding main extension ".$row[2]." to user ".$username.": directory is locked";
                continue;
            }
        }

        # add cellphone
        try {
            if (isset($row[4])) {
                $mobile = preg_replace('/[^0-9\+]/','',$row[4]);
                $dbh = FreePBX::Database();
                $sql =  'INSERT INTO rest_users (user_id,mobile)'.
                     ' SELECT id, ?'.
                     ' FROM userman_users'.
                     ' WHERE username = ?'.
                     ' ON DUPLICATE KEY UPDATE mobile = ?';
                $stmt = $dbh->prepare($sql);
                $mobile = preg_replace('/^\+/', '00', $row[4]);
                $mobile = preg_replace('/[^0-9]/', '', $mobile);
                if ($mobile == "") {
                    $mobile = NULL;
                }
                $stmt->execute(array($mobile, $username, $mobile));
            }
        } catch (Exception $e) {
            $error = "Error setting mobile to user {$username}: ".$e->getMessage();
            error_log($error);
            $err .= $error;
        }

        # add Voicemail
        try {
            if (isset($row[5]) && !empty($row[5])) {
                if (strtolower($row[5]) == 'true' || $row[5] == 1) {
                    $data = array();
                    $data['name'] = $row[1];
                    $data['vmpwd'] = rand(0, 9).rand(0, 9).rand(0, 9).rand(0, 9);
                    $data['email'] = $user['email'];
                    $data['vm'] = 'yes';
                    FreePBX::create()->Voicemail->processQuickCreate('pjsip', $row[2], $data);
                } else {
                    FreePBX::create()->Voicemail->delMailbox($row[2]);
                }
            }
        } catch (Exception $e) {
            $error = "Error setting voicemail to user {$username}: ".$e->getMessage();
            error_log($error);
            $err .= $error;
        }

        # add WebRTC
        try {
            if (isset($row[6]) && !empty($row[6])) {
                if (strtolower($row[6]) == 'true' || $row[6] == 1) {
                    # enable WebRTC
                    $extension = createExtension($row[2],false);
                    if ($extension === false ) {
                        throw new Exception('Error creating extension');
                    }

                    if (useExtensionAsWebRTC($extension) === false) {
                        throw new Exception('Error associating webrtc extension');
                    }

                    $extensionm = createExtension($row[2],false);

                    if ($extensionm === false ) {
                        throw new Exception('Error creating webrtc mobile extension');
                    }

                } else {
                    # disable WebRTC
                    $extension = getWebRTCExtension($row[2]);
                    $mobile_extension = getWebRTCMobileExtension($mainextension);
                    if (!deleteExtension($extension) || !deleteExtension($mobile_extension)) {
                        throw new Exception('Error deleting extension');
                    }
                }
            }
        } catch (Exception $e) {
            $error = "Error setting WebRTC to user {$username}: ".$e->getMessage();
            error_log($error);
            $err .= $error;
        }

        # add CTI Groups
        try {
            if (isset($row[7])) {
                # delete groups for user
                $dbh = FreePBX::Database();
                $sql = 'DELETE FROM rest_cti_users_groups WHERE user_id = ?';
                $sth = $dbh->prepare($sql);
                $sth->execute(array($user_id));
                # Add groups for user
                if (!empty($row[7])) {
                    foreach (explode('|', $row[7]) as $group_name) {
                        $group_id = ctiCreateGroup($group_name);
                        $sql = 'INSERT INTO rest_cti_users_groups VALUES (NULL, ?, ?)';
                        $sth = $dbh->prepare($sql);
                        $sth->execute(array($user_id, $group_id));
                    }
                }
            }
        } catch (Exception $e) {
            $error = "Error setting CTI Groups to user {$username}: ".$e->getMessage();
            error_log($error);
            $err .= $error;
        }
        # add CTI Profile
        try {
            if (isset($row[8])) {
                if (empty($row[8])) {
                    $profile_id = NULL;
                } else {
                    $profile_id = getProfileID($row[8]);
                    if (empty($profile_id)) {
                        throw new Exception('Can\'t find profile '.$row[8]);
                    }
                }
                $res = setCTIUserProfile($user_id,$profile_id);
                if ($res !== TRUE) {
                    throw new Exception($res['error']);
                }
            }
        } catch (Exception $e) {
            $error = "Error setting CTI profile to user {$row[8]}: ".$e->getMessage();
            error_log($error);
            $err .= $error;
        }
    }

    system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');

    if ($result > 0) {
        throw new Exception("Something went wrong: \n".$err);
    }
    file_put_contents($statusfile,json_encode(array('exitcode'=>0,'errors'=>$err,'progress'=>100)));
    exit(0);
} catch (Exception $e) {
    error_log($e->getMessage());
    file_put_contents($statusfile,json_encode(array('exitcode'=>1,'errors'=>$err,'progress'=>-1)));
    exit (1);
}

