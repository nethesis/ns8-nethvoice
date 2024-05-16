<?php
#
# Copyright (C) 2017 Nethesis S.r.l.
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

function deleteQueuePermissionsForDeletedQueue($permissions) {
    $queues = FreePBX::Queues()->listQueues();
    foreach ($permissions as $permission) {
        if (!strstr($permission['name'],'qmanager_')) {
            continue;
        }
        $exists = false;
        foreach ($queues as $queue) {
            if ($permission['name'] == 'qmanager_'.$queue[0]) {
                $exists = true;
                break;
            }
        }
        if (!$exists) {
            // Delete queue permission
            $dbh = FreePBX::Database();
            $sql = 'DELETE FROM `rest_cti_permissions` WHERE `id` = ?';
            $sth = $dbh->prepare($sql);
            $sth->execute(array($permission['id']));
        }
    }
}

function addQueueManagerDisabledQueues($profile) {
    $queues = FreePBX::Queues()->listQueues();
    foreach ($queues as $queue) {
        $queue_displayname = $queue[1].' ('.$queue[0].')';
        $queue_description = 'Manage Queue "'.$queue[1].'" ('.$queue[0].')';
        //check if this queue is already in permissions array of qmanager macro permission
        $exists = false;
        if (!empty($profile['macro_permissions']['qmanager']['permissions'])){
            foreach ($profile['macro_permissions']['qmanager']['permissions'] as $qpermission) {
                if ($qpermission['name'] === 'qmanager_'.$queue[0]) {
                    $exists = true;
                    break;
                }
            }
        }
        // Add queue to permissions
        if (!$exists) {
            $profile['macro_permissions']['qmanager']['permissions'][] = array('id'=>null,'name'=>'qmanager_'.$queue[0],'displayname'=>$queue_displayname,'description'=>$queue_description,'value'=>false);
        }
    }
    return $profile;
}

