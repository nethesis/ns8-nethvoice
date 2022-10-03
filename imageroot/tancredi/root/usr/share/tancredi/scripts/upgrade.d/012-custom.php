<?php namespace upgrade12;

/*
 * Copyright (C) 2021 Nethesis S.r.l.
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
// Fix Snom LDAP default filters https://github.com/nethesis/dev/issues/6058
//

$models = [
    'snom-D120',
    'snom-D305',
    'snom-D315',
    'snom-D345',
    'snom-D375',
    'snom-D385',
    'snom-D710',
    'snom-D712',
    'snom-D715',
    'snom-D717',
    'snom-D725',
    'snom-D735',
    'snom-D745',
    'snom-D765',
    'snom-D785'
];

// Get al custom scopes derived from scopes that needs to be fixed
$scopes = $container['storage']->listScopes();
$custom_scopes = array();
foreach ($models as $model ) {
    foreach ($scopes as $scope_name) {
        if (strpos($scope_name,$model."-") === 0) {
            $custom_scopes[] = $scope_name;
        }
    }
}

foreach ($custom_scopes as $custom_scope_name) {
    $scope = new \Tancredi\Entity\Scope($custom_scope_name, $container['storage'], $container['logger']);
    if(isset($scope->metadata['version']) && $scope->metadata['version'] >= 12) {
        continue;
    }
    $scope->metadata['version'] = 12;
    $scope->setVariables();
    $scope_data = $scope->getVariables();
    if ($scope_data['ldap_number_filter'] === '(|(telephoneNumber=%)(mobile=%)(homePhone=%))') {
        $scope->setVariables(['ldap_number_filter' => '(|(telephoneNumber=%*)(mobile=%*)(homePhone=%*))']);
    }
    if ($scope_data['ldap_name_filter'] === '(|(cn=%)(o=%))') {
        $scope->setVariables(['ldap_name_filter' => '(|(cn=%*)(o=%*))']);
    }
    $container['logger']->info("Fix ".basename(__FILE__)." applied to scope $custom_scope_name");
}
