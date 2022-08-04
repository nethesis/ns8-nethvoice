<?php

#
# Copyright (C) 2021 Nethesis S.r.l.
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

require_once '/etc/freepbx_db.conf';
require_once '/var/www/html/freepbx/rest/lib/libCTI.php';
require_once '/var/www/html/freepbx/rest/lib/libUsers.php';

try {
    // Create or edit contexts for each CTI profile
    $profiles = getCTIPermissionProfiles(false,false,false);
    foreach ($profiles as $profile) {
        setCustomContextPermissions($profile['id']);
    }
    $users = getAllUsers();
    foreach ($users as $user) {
        // Skip users with hotel context
        $sql = "SELECT `data` FROM `sip` WHERE `keyword`='context' AND `id` IN (SELECT extension COLLATE utf8mb4_unicode_ci FROM rest_devices_phones WHERE user_id = ?)";
        $sth = $db->prepare($sql);
        $sth->execute([$user['id']]);
        $res = $sth->fetchAll();
        $skip = false;
        foreach ($res as $row) {
            if ($row['data'] === 'hotel') {
                $skip = True;
                break;
            }
        }
        if ($skip) {
            continue;
        }

        // Assign context to extension for each CTI profile
        setCTIUserProfile($user['id'],$user['profile']);
    }
    system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
} catch (Exception $e) {
    error_log($e->getMessage());
    exit (1);
}

