<?php namespace upgrade8;

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

//
// Set right gigaset Maxwell3 screensaver times blacklist
//
$fixes = [
    'gigaset-Maxwell3'  => ['cap_screensaver_time_blacklist' => '3,5,7,10,15,30,60,120,300'],
];

foreach ($fixes as $model_id => $variables) {
    $scope = new \Tancredi\Entity\Scope($model_id, $container->get('storage'), $container->get('logger'));
    if(isset($scope->metadata['version']) && $scope->metadata['version'] >= 8) {
        continue;
    }
    $scope->metadata['version'] = 8;
    $scope->setVariables($variables);
    $container->get('logger')->info("Fixed cap_screensaver_time_blacklist in model $model_id");
}
