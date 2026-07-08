<?php namespace upgrade6;

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
// Add expansion key modules to Snom
//
$scopes = [
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

$variables = [
    'cap_expkey_count' => 18,
    'cap_expkey_type_blacklist' => "direct_pickup,hold,ldap,phone_lock,prefix,recall,voice_mail",
    'cap_expmodule_count' => '3'
];

foreach ($scopes as $model_id) {
    $scope = new \Tancredi\Entity\Scope($model_id, $container->get('storage'), $container->get('logger'));
    if(isset($scope->metadata['version']) && $scope->metadata['version'] >= 6) {
        continue;
    }
    $scope->metadata['version'] = 6;
    $scope->setVariables($variables);
    $container->get('logger')->info("Added expansion module in model $model_id");
}
