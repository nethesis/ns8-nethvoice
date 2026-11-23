<?php namespace upgrade3;

/*
 * Copyright (C) 2020 Nethesis S.r.l.
 * http://www.nethesis.it - nethserver@nethesis.it
 *
 * This script is part of NethServer.
 *
 * NethServer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License,
 * or any later version.
 *
 * NethServer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with NethServer.  If not, see COPYING.
 */

$models = $container->get('storage')->listScopes('model');
foreach ($models as $id) {
    if(substr($id, 0, 6) == 'fanvil') {
        $scope = new \Tancredi\Entity\Scope($id, $container->get('storage'), $container->get('logger'));
        if(isset($scope->metadata['version']) && $scope->metadata['version'] >= 3) {
            continue;
        }
        $scope->metadata['version'] = 3;
        $scope->setVariables([
            'cap_ringtone_blacklist' => '-1',
        ]);
        $container->get('logger')->info("Fixed cap_ringtone_blacklist for model $id");

    } elseif(substr($id, 0, 7) == 'yealink') {
        $scope = new \Tancredi\Entity\Scope($id, $container->get('storage'), $container->get('logger'));
        if(isset($scope->metadata['version']) && $scope->metadata['version'] >= 3) {
            continue;
        }
        $scope->metadata['version'] = 3;
        $scope->setVariables([
            'cap_ringtone_count' => '10',
        ]);
        $container->get('logger')->info("Fixed cap_ringtone_count for model $id");

    } elseif(substr($id, 0, 7) == 'gigaset') {
        $scope = new \Tancredi\Entity\Scope($id, $container->get('storage'), $container->get('logger'));
        if(isset($scope->metadata['version']) && $scope->metadata['version'] >= 3) {
            continue;
        }
        $scope->metadata['version'] = 3;
        $scope->setVariables([
            'cap_ringtone_blacklist' => '"-1,0"',
        ]);
        $container->get('logger')->info("Fixed cap_ringtone_blacklist for model $id");
    }
}
