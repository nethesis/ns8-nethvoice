<?php namespace upgrade1;

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

# Upgrade only if current version isn't set
$defaults = $container->get('storage')->storageRead('defaults', false);
if (!empty($defaults['metadata']['version'])) {
    return;
}

$config = $container->get('config');

# Rename models
$names = array(
    "yealink-T19P_E2" => "yealink-T19",
    "yealink-T21P_E2" => "yealink-T19",
    "yealink-T21P_E2" => "yealink-T21",
    "yealink-T23G" => "yealink-T23",
    "yealink-T27G" => "yealink-T27",
    "yealink-T29G" => "yealink-T29",
    "yealink-T40PG" => "yealink-T40",
    "yealink-T41PS" => "yealink-T41",
    "yealink-T42GS" => "yealink-T42",
    "yealink-T43U" => "yealink-T43",
    "yealink-T46GS" => "yealink-T46",
    "yealink-T48GS" => "yealink-T48",
    "yealink-T49G" => "yealink-T49"
);

# Rename scope files
foreach ($names as $oldname => $newname) {
    $container->get('logger')->info("Renaming $oldname => $newname");
    if (file_exists($config['rw_dir'] . 'scopes/' . $oldname . '.ini')) {
        rename ($config['rw_dir'] . 'scopes/' . $oldname . '.ini' , $config['rw_dir'] . 'scopes/' . $newname . '.ini');
    }
}

# Rename scope parents
foreach ($container->get('storage')->listScopes($typeFilter = 'phone') as $id) {
    $scope = new \Tancredi\Entity\Scope($id, $container->get('storage'), $container->get('logger'));
    if (array_key_exists($scope->metadata['inheritFrom'], $names)) {
        $container->get('logger')->info("Set inheritFrom to $id");
        $scope->metadata['inheritFrom'] = $names[$scope->metadata['inheritFrom']];
        $scope->setVariables();
    }
}

# Fix display names
$displaynames = array(
    "fanvil-X3" => "Fanvil X3S/SP/G",
    "fanvil-X4" => "Fanvil X4/G",
    "fanvil-X5" => "Fanvil X5S",
    "yealink-T23" => "Yealink T23P/G",
    "yealink-T27" => "Yealink T27P/G",
    "yealink-T41" => "Yealink T41P/S/U",
    "yealink-T42" => "Yealink T42G/S/U",
    "yealink-T46" => "Yealink T46G/S/U",
    "yealink-T48" => "Yealink T48G/S/U",
    "yealink-T53" => "Yealink T53/W",
    "yealink-T54" => "Yealink T54/W",
    "yealink-T56" => "Yealink T56A",
    "yealink-T57" => "Yealink T57W",
    "yealink-T58" => "Yealink T58V/A"
);

# Fix display name
foreach ($displaynames as $id => $new_displayname) {
    $scope = new \Tancredi\Entity\Scope($id, $container->get('storage'), $container->get('logger'));
    if (empty($scope->metadata['version']) && $scope->metadata['displayName'] != $new_displayname) {
        $container->get('logger')->info("Set displayName to $id");
        $scope->metadata['displayName'] = $new_displayname;
        $scope->metadata['version'] = 1;
        $scope->setVariables();
    }
}

# Increment defaults version
$scope = new \Tancredi\Entity\Scope('defaults', $container->get('storage'), $container->get('logger'));
$scope->metadata['version'] = 1;
$scope->setVariables();
$container->get('logger')->info("Set version 1 to defaults");
