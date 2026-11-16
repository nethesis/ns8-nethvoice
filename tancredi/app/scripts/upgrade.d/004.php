<?php namespace upgrade4;

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
        if(isset($scope->metadata['version']) && $scope->metadata['version'] >= 4) {
            continue;
        }
        $model = substr($id, 8, 1);
        $is_second_generation = $model == '5' || $model == '6' || substr($id, 10, 2) == 'SG';
        $scope->metadata['version'] = 4;
        $scope->setVariables([
            'cap_background_file' => '1',
            'cap_screensaver_file' => '',
            'screensaver_time' => '600',
            'backlight_time' => '30',
            'cap_contrast' => '1',
            'contrast' => '4',
            'cap_brightness' => $is_second_generation ? '1' : '',
            'brightness' => $is_second_generation ? '5' : '',
            'cap_backlight_time_blacklist' => '',
            'cap_screensaver_time_blacklist' => '',
        ]);
        $container->get('logger')->info("Fixed background and screensaver settings for model $id");

    } elseif(substr($id, 0,7) == 'yealink') {
        $model = preg_replace('/yealink-([A-Z0-9]*)$/','$1',$id);
        $scope = new \Tancredi\Entity\Scope($id, $container->get('storage'), $container->get('logger'));
        if(isset($scope->metadata['version']) && $scope->metadata['version'] >= 4) {
            continue;
        }
        $scope->metadata['version'] = 4;
        $scope->setVariables([
            'cap_background_file' => in_array($model, ['T29', 'T46', 'T48', 'T54', 'T56', 'T57', 'T57', 'VP59']) ? '1' : '',
            'cap_screensaver_file' => in_array($model, ['T29', 'T46', 'T48', 'T54', 'T56', 'T57', 'T57', 'VP59']) ? '1' : '',
            'screensaver_time'  => '600',
            'backlight_time' => in_array($model, ['T21', 'T23', 'T27', 'T40', '41', '42']) ? '30' : '0',
            'cap_contrast' => in_array($model, ['T40', 'T43', 'T49', 'T52', 'T53']) ? '1' : '',
            'contrast' => in_array($model, ['T40', 'T43', 'T49', 'T52', 'T53']) ? '6' : '',
            'cap_brightness' => in_array($model, ['T27', 'T29', 'T43', 'T46', 'T48', 'T53', 'T54', 'T57', 'T58', 'VP59']) ? '1' : '',
            'brightness' => in_array($model, ['T27', 'T29', 'T43', 'T46', 'T48', 'T53', 'T54', 'T57', 'T58', 'VP59']) ? '8' : '',
            'cap_backlight_time_blacklist' => $model == 'T19' ? '0,3,5,7,10,15,30,60,120,300,600,1200,1800,2400,3000,3600' : '3,5,7,10,1200,2400,3000,3600',
            'cap_screensaver_time_blacklist' => $model == 'T19' ? '0,3,5,7,10,15,30,60,120,300,600,1200,1800,2400,3000,3600' : '3,5,7,10,1200,2400,3000,3600',
        ]);
        $container->get('logger')->info("Fixed background and screensaver settings for model $id");

    } elseif(substr($id, 0, 15) == 'gigaset-Maxwell') {
        $model = substr($id, 15, 1);
        $scope = new \Tancredi\Entity\Scope($id, $container->get('storage'), $container->get('logger'));
        if(isset($scope->metadata['version']) && $scope->metadata['version'] >= 4) {
            continue;
        }
        $scope->metadata['version'] = 4;
        $scope->setVariables([
            'cap_background_file' => ($model == '4') ? '1' : '',
            'cap_screensaver_file' => ($model == '3' || $model == '4') ? '1' : '',
            'screensaver_time'  => ($model == '2' || $model == 'B') ? '600' : '',
            'backlight_time' => '60',
            'cap_contrast' => $model == 'B' ? '1' : '',
            'contrast' => $model == 'B' ? '5' : '',
            'cap_brightness' => '1',
            'brightness' => '5',
            'cap_backlight_time_blacklist' => '3,5,7,10,15,30',
            'cap_screensaver_time_blacklist' => '3,5,7,10,1200,2400,3000,3600',
        ]);
        $container->get('logger')->info("Fixed background and screensaver settings for model $id");

    } elseif(substr($id, 0, 7) == 'sangoma') {
        $model = substr($id, 9, 1);
        $scope = new \Tancredi\Entity\Scope($id, $container->get('storage'), $container->get('logger'));
        if(isset($scope->metadata['version']) && $scope->metadata['version'] >= 4) {
            continue;
        }
        $scope->metadata['version'] = 4;
        $scope->setVariables([
            'cap_background_file' => ($model == '5' || $model == '7') ? '1' : '',
            'cap_screensaver_file' => ($model == '5' || $model == '7') ? '1' : '',
            'screensaver_time'  => '600',
            'cap_screensaver_time_blacklist' => "3,5,7,10,15,30,1200,2400,3000,3600",
            'backlight_time' => ($model == '5' || $model == '7') ? '60' : '',
            'cap_backlight_time_blacklist' => ($model == '5' || $model == '7') ? "" : "0,3,5,7,10,15,30,60,120,300,600,1200,1800,2400,3000,3600",
            'cap_contrast' => ($model == '4' || $model == '3' || $model == '2') ? '1' : '',
            'contrast' => ($model == '4' || $model == '3' || $model == '2') ? '6' : '',
            'cap_brightness' => '1',
            'brightness' => '8',
            'linekey_type_1' => 'line',
            'linekey_type_2' => 'line',
            'softkey_type_1' => 'history',
            'softkey_type_2' => 'ldap',
            'softkey_type_3' => 'pickup',
            'softkey_type_4' => ($model == '2' || $model == '3') ? 'menu' : 'dnd',
        ]);
        $container->get('logger')->info("Fixed display and line keys settings for model $id");

    } elseif(substr($id, 0, 4) == 'snom') {
        $model = substr($id, 5, 4);
        $scope = new \Tancredi\Entity\Scope($id, $container->get('storage'), $container->get('logger'));
        if(isset($scope->metadata['version']) && $scope->metadata['version'] >= 4) {
            continue;
        }
        $scope->metadata['version'] = 4;
        $scope->setVariables([
            'cap_background_file' => in_array($model, ['D375', 'D385', 'D717', 'D735', 'D765', 'D785']) ? '1' : '',
            'cap_screensaver_file' => '',
            'screensaver_time'  => '',
            'cap_screensaver_time_blacklist' => '0,3,5,7,10,15,30,60,120,300,600,1200,1800,2400,3000,3600',
            'backlight_time' => '30',
            'cap_backlight_time_blacklist' => '',
            'cap_contrast' => '',
            'contrast' =>  '',
            'cap_brightness' => '1',
            'brightness' => '9',
        ]);
        $container->get('logger')->info("Fixed background and screensaver settings for model $id");

    }
}

$defaults = new \Tancredi\Entity\Scope('defaults', $container->get('storage'), $container->get('logger'));
if($defaults->metadata['version'] < 4) {
    $defaults->metadata['version'] = 4;
    $defaults->setVariables([
        'cap_ringtone_count' => "1",
        'cap_ringtone_blacklist' => "-1,0",
        'background_file' => "",
        'screensaver_file' => "",
        'screensaver_time' => '600',
        'cap_background_file' => "",
        'cap_screensaver_file' => "",
        'backlight_time' => '30',
        'cap_brightness' => '',
        'cap_contrast' => '',
        'brightness' => '5',
        'contrast' => '5',
        'cap_backlight_time_blacklist' => '',
        'cap_screensaver_time_blacklist' => '',
    ]);
    $container->get('logger')->info("Fixed display and ringtone variables in defaults scope");
}
