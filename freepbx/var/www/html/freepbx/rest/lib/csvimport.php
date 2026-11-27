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

require_once(__DIR__ . '/libCsvImport.php');

$statusfile = '/var/run/nethvoice/csvimport.code';
$arguments = csvImportArguments(array_slice($argv, 1));
$statusBase = $arguments['id'] === null ? array() : array('id' => $arguments['id'], 'pid' => getmypid());
if ($arguments['id'] !== null) {
    csvImportWriteStatus($statusfile, $statusBase + array('progress' => 0));
}

include_once('/var/www/html/freepbx/rest/lib/libUsers.php');
include_once('/var/www/html/freepbx/rest/lib/libExtensions.php');
include_once('/var/www/html/freepbx/rest/lib/libCTI.php');
include_once('/var/www/html/freepbx/rest/lib/libMiddleware.php');
include_once('/var/www/html/freepbx/rest/lib/libUsersAdmin.php');
include_once('/var/www/html/freepbx/rest/lib/libCTIGroups.php');
if (file_exists('/var/www/html/freepbx/rest/lib/libMigration.php')) {
    include_once('/var/www/html/freepbx/rest/lib/libMigration.php');
}

$err = '';
$problems = array();
$progress = 0;

function csvImportProblem($code, array $details = array()) {
    $GLOBALS['problems'][] = array('code' => $code) + $details;
}

function csvImportGroupIssue($name) {
    $groups = FreePBX::Database()->query('SELECT id, name FROM rest_cti_groups')->fetchAll(\PDO::FETCH_ASSOC);
    foreach ($groups as $group) {
        if (mb_strtolower(trim((string) $group['name'])) === mb_strtolower(trim((string) $name))) {
            return null;
        }
    }
    return ctiGroupNameIssue($groups, null, $name);
}

try {
    // prepare a file for saving results
    $base64csv = (string) ($arguments['payload'] ?? '');
    $restricted = $arguments['restricted'];
    $rfc4180 = $arguments['rfc4180'];
    $caller = array('username' => $arguments['caller'], 'superadmin' => false);
    $usersAdmin = null;
    $str = base64_decode($base64csv, true);
    if ($str === false || trim($str) === '') {
        throw new InvalidArgumentException('Invalid or empty CSV input');
    }
    $rowarr = preg_split('/\R/', trim($str));
    $csv = array();

    foreach ($rowarr as $r) {
        if (trim($r) !== '') {
            $csv[] = array_map('csvImportCell', $rfc4180 ? str_getcsv($r, ',', '"', '') : str_getcsv($r));
        }
    }

    # create users
    $result = 0;
    // calculate step/progress/total
    $numusers = count($csv);
    if ($numusers === 0) {
        throw new InvalidArgumentException('CSV input has no rows');
    }
    $step = 100/$numusers/2; //use /2 because we use 2 for cicle
    $progress = -$step; //start with negative progress because
    $token = getToken();

    foreach ($csv as $k => $row) {
        $progress += $step;
        csvImportWriteStatus($statusfile, $statusBase + array('progress'=>round($progress)));
        # Skip comments
        if (isset($row[0]) && substr($row[0],0,1) === '#') {
            unset($csv[$k]);
            continue;
        }

        if ($restricted && preg_grep('/[\x00-\x1F\x7F]/', $row)) {
            $result += 1;
            $err .= "Error creating user: control characters are not allowed at CSV line ".($k + 1)."\n";
            csvImportProblem('control_characters', array('line' => $k + 1));
            unset($csv[$k]);
            continue;
        }

        # trim fields
        foreach ($row as $index => $field) {
            $row[$index] = trim($field);
        }

        # check that row has username and fullname field
        if (empty($row[0]) || empty($row[1])) {
            $result += 1;
            $err .= "Error creating user: username and fullname can't be empty at CSV line ".($k + 1)."\n";
            csvImportProblem('missing_name', array('line' => $k + 1));
            unset($csv[$k]);
            continue;
        }

        #lowercase username
        $row[0] = strtolower($row[0]);

        if (empty($token)) {
            $result += 1;
            $err .= "Error creating user ".$row[0].": users-admin is unavailable\n";
            csvImportProblem('provider_unavailable', array('line' => $k + 1, 'username' => $row[0]));
            unset($csv[$k]);
            continue;
        }

        $exists = userExists($row[0], $token);
        if ($restricted && $exists) {
            $usersAdmin = $usersAdmin ?? usersAdminDefaultClient();
            $refusal = usersAdminTargetError($row[0], $caller, true) ?? usersAdminProtectedTargetError($usersAdmin, $row[0], $caller);
            if ($refusal !== null) {
                $result += 1;
                $err .= "Error importing user ".$row[0].": this account cannot be managed here\n";
                csvImportProblem('protected_account', array('line' => $k + 1, 'username' => $row[0]));
                unset($csv[$k]);
                continue;
            }
        }

        # create user
        if (!$exists) {
            $header = array();
            $header[] = 'Content-type: application/json';
            $header[] = 'Authorization: Bearer '. $token;

            # Set password
            if ( ! isset($row[3]) || empty($row[3]) ){
                $row[3] = generateRandomPassword();
            }

            $post = [
                "user" => $row[0],
                "display_name" => $row[1],
                "password" => $row[3],
                "locked" => false,
                "groups" => []
            ];

            $ch = curl_init(getUserPortalUrl() . '/add-user');
            setUserPortalCurlDefaults($ch, $header);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($post));

            // execute!
            $response = curl_exec($ch);
            $curlError = curl_error($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

            // close the connection, release resources used
            curl_close($ch);

            if ($response === false || $httpCode < 200 || $httpCode >= 300) {
                $result += 1;
                $message = $curlError !== '' ? $curlError : 'HTTP '.$httpCode;
                $err .= "Error creating user ".$row[0].": ".$message."\n";
                csvImportProblem('create_failed', array('line' => $k + 1, 'username' => $row[0]));
                unset($csv[$k]);
                continue;
            }

            $resJSON = json_decode($response);
            if (!is_object($resJSON)) {
                $result += 1;
                $err .= "Error creating user ".$row[0].": invalid user portal response\n";
                csvImportProblem('create_failed', array('line' => $k + 1, 'username' => $row[0]));
                unset($csv[$k]);
                continue;
            }
            if (($resJSON->status ?? 'failure') != "success") {
                $result += 1;
                $message = $resJSON->error[0]->error ?? 'unknown user portal error';
                $err .= "Error creating user ".$row[0].": ".$message."\n";
                csvImportProblem('create_failed', array('line' => $k + 1, 'username' => $row[0]));
                unset($csv[$k]);
                continue;
            }
        }
        $csv[$k] = $row;
    }

    # sync users
    if (!usersAdminSynchronize()) {
        csvImportProblem('sync_failed');
        throw new RuntimeException('FreePBX user synchronization failed');
    }

    foreach ($csv as $k => $row) {
        $progress += $step;
        if (round($progress)>99) $progress = 99;
        csvImportWriteStatus($statusfile, $statusBase + array('progress'=>round($progress)));

        $user_id = getUserID($row[0]);
        $username = $row[0];
        $mainextension = $row[2] ?? null;
        $hasExtension = is_string($mainextension) && preg_match('/^[0-9]+$/',$mainextension);
        if (empty($user_id)) {
            $result += 1;
            $err .= "Error retrieving user ID for ".$username."\n";
            csvImportProblem('user_not_found', array('line' => $k + 1, 'username' => $username));
            continue;
        }

        # create extension
        if ($hasExtension) {
            $create = createMainExtensionForUser($username,$mainextension);
            if ($create !== true) {
                $result += 1;
                $message = is_array($create) ? ($create['message'] ?? 'unknown error') : 'unknown error';
                $err .= "Error adding main extension ".$mainextension." to user ".$username.": ".$message."\n";
                csvImportProblem('extension_failed', array('line' => $k + 1, 'username' => $username, 'extension' => $mainextension));
            } else {
                // assign physical device to user if it is a migration
                if (function_exists('isMigration') && isMigration()) {
                    $secret = getOldSecret($mainextension);
                    $extension = createExtension($mainextension,false);
                    if ($extension === false || useExtensionAsCustomPhysical($extension,$secret,'temporaryphysical') === false) {
                        $result += 1;
                        $err .= "Error assigning temporary device to ".$username."\n";
                        csvImportProblem('device_failed', array('line' => $k + 1, 'username' => $username));
                    }
                }
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
            $result += 1;
            $error = "Error setting mobile to user {$username}: ".$e->getMessage();
            error_log($error);
            $err .= $error;
            csvImportProblem('mobile_failed', array('line' => $k + 1, 'username' => $username));
        }

        # add Voicemail
        try {
            if (isset($row[5]) && !empty($row[5])) {
                $enableVoicemail = in_array(strtolower((string) $row[5]), array('true', '1'), true);
                if ($enableVoicemail) {
                    if (!$hasExtension) {
                        throw new Exception('A numeric extension is required');
                    }
                    $data = array();
                    $data['name'] = $row[1];
                    $data['vmpwd'] = rand(0, 9).rand(0, 9).rand(0, 9).rand(0, 9);
                    $data['email'] = '';
                    $data['vm'] = 'yes';
                    FreePBX::create()->Voicemail->processQuickCreate('pjsip', $mainextension, $data);
                } elseif ($hasExtension) {
                    FreePBX::create()->Voicemail->delMailbox($mainextension);
                }
            }
        } catch (Exception $e) {
            $result += 1;
            $error = "Error setting voicemail to user {$username}: ".$e->getMessage();
            error_log($error);
            $err .= $error;
            csvImportProblem('voicemail_failed', array('line' => $k + 1, 'username' => $username));
        }

        # add WebRTC
        try {
            if (isset($row[6]) && !empty($row[6])) {
                $enableWebRTC = in_array(strtolower((string) $row[6]), array('true', '1'), true);
                if ($enableWebRTC) {
                    if (!$hasExtension) {
                        throw new Exception('A numeric extension is required');
                    }
                    # enable WebRTC
                    $extension = createExtension($mainextension,false);
                    if ($extension === false ) {
                        throw new Exception('Error creating extension');
                    }

                    if (useExtensionAsWebRTC($extension) === false) {
                        throw new Exception('Error associating webrtc extension');
                    }

                } elseif ($hasExtension) {
                    # disable WebRTC
                    $extension = getWebRTCExtension($mainextension);
                    $mobile_extension = getWebRTCMobileExtension($mainextension);
                    if (!empty($extension) && !deleteExtension($extension)) {
                        throw new Exception('Error deleting extension');
                    }
                    if (!empty($mobile_extension) && !deleteExtension($mobile_extension)) {
                        throw new Exception('Error deleting extension');
                    }
                }
            }
        } catch (Exception $e) {
            $result += 1;
            $error = "Error setting WebRTC to user {$username}: ".$e->getMessage();
            error_log($error);
            $err .= $error;
            csvImportProblem('webrtc_failed', array('line' => $k + 1, 'username' => $username));
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
                        if ($restricted && ($issue = csvImportGroupIssue($group_name)) !== null) {
                            $result += 1;
                            $err .= "Error setting CTI Groups to user {$username}: ".$issue[1]."\n";
                            csvImportProblem('group_name_invalid', array('line' => $k + 1, 'username' => $username, 'group' => (string) $group_name));
                            continue;
                        }
                        $group_id = ctiCreateGroup($group_name);
                        $sql = 'INSERT INTO rest_cti_users_groups VALUES (NULL, ?, ?)';
                        $sth = $dbh->prepare($sql);
                        $sth->execute(array($user_id, $group_id));
                    }
                }
            }
        } catch (Exception $e) {
            $result += 1;
            $error = "Error setting CTI Groups to user {$username}: ".$e->getMessage();
            error_log($error);
            $err .= $error;
            csvImportProblem('groups_failed', array('line' => $k + 1, 'username' => $username));
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
            $result += 1;
            $error = "Error setting CTI profile to user {$row[8]}: ".$e->getMessage();
            error_log($error);
            $err .= $error;
            csvImportProblem('profile_failed', array('line' => $k + 1, 'username' => $username, 'profile' => (string) $row[8]));
        }
        # add NethLink
        try {
            if (isset($row[9]) && !empty($row[9])) {
                $enableNethLink = in_array(strtolower((string) $row[9]), array('true', '1'), true);
                if ($enableNethLink) {
                    if (!$hasExtension) {
                        throw new Exception('A numeric extension is required');
                    }
                    # enable NethLink
                    $extension = createExtension($mainextension,false);
                    if ($extension === false ) {
                        throw new Exception('Error creating extension');
                    }

                    if (useExtensionAsNethLink($extension) === false) {
                        throw new Exception('Error associating nethlink extension');
                    }

                } elseif ($hasExtension) {
                    # disable NethLink
                    $extension = getNethLinkExtension($mainextension);
                    $mobile_extension = getNethLinkMobileExtension($mainextension);
                    if (!empty($extension) && !deleteExtension($extension)) {
                        throw new Exception('Error deleting extension');
                    }
                    if (!empty($mobile_extension) && !deleteExtension($mobile_extension)) {
                        throw new Exception('Error deleting extension');
                    }
                }
            }
        } catch (Exception $e) {
            $result += 1;
            $error = "Error setting NethLink to user {$username}: ".$e->getMessage();
            error_log($error);
            $err .= $error;
            csvImportProblem('nethlink_failed', array('line' => $k + 1, 'username' => $username));
        }
    }

    system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');

    if ($result > 0) {
        throw new Exception("Something went wrong: \n".$err);
    }
    csvImportWriteStatus($statusfile, $statusBase + array('exitcode'=>0,'errors'=>$err,'progress'=>100));
    exit(0);
} catch (Throwable $e) {
    error_log($e->getMessage());
    if ($err === '') {
        $err = $e->getMessage();
    }
    if ($problems === array()) {
        csvImportProblem($e instanceof InvalidArgumentException ? 'invalid_input' : 'import_failed');
    }
    csvImportWriteStatus($statusfile, $statusBase + array('exitcode'=>1,'errors'=>$err,'progress'=>-1,'problems'=>$problems));
    exit (1);
}
