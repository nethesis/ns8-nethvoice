<?php namespace upgrade5;

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
// Fix the cap_linekey_count in models with fanvil_sidekey_count
//
$fixes = [
    'fanvil-X3U'  => ['cap_linekey_count' => 3],
    'fanvil-X4U'  => ['cap_linekey_count' => 33],
    'fanvil-X6U'  => ['cap_linekey_count' => 65],
    'fanvil-X210' => ['cap_linekey_count' => 106],
];

foreach ($fixes as $model_id => $variables) {
    $scope = new \Tancredi\Entity\Scope($model_id, $container->get('storage'), $container->get('logger'));
    if(isset($scope->metadata['version']) && $scope->metadata['version'] >= 5) {
        continue;
    }
    $scope->metadata['version'] = 5;
    $scope->setVariables($variables);
    $container->get('logger')->info("Fixed cap_linekey_count in model $model_id");
}
