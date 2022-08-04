#!/usr/bin/env php
<?php
//Copyright (C) nethesis srl. (info@nethesis.it)
//
//This program is free software; you can redistribute it and/or
//modify it under the terms of the GNU General Public License
//as published by the Free Software Foundation; either version 2
//of the License, or (at your option) any later version.
//
//This program is distributed in the hope that it will be useful,
//but WITHOUT ANY WARRANTY; without even the implied warranty of
//MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//GNU General Public License for more details.

include_once '/etc/freepbx.conf';
include_once '/var/www/html/freepbx/rest/lib/libExtensions.php';

define("AGIBIN_DIR", "/var/lib/asterisk/agi-bin");
include(AGIBIN_DIR."/phpagi.php");
$agi = new AGI();

$mainextension = getMainExtension($argv[1]);

$dbh = FreePBX::Database();
$stmt = $dbh->prepare('SELECT `extension` FROM `rest_devices_phones` WHERE `extension` LIKE CONCAT("%",?) AND `mac` IS NOT NULL AND `vendor` IS NOT NULL AND `type` = "physical"');
$stmt->execute([$mainextension]);
$res = $stmt->fetchAll();
$notify_string = 'generic-reload';
foreach ($res as $ext) {
     $extension = $ext[0];
     $cmd = "/usr/sbin/asterisk -rx 'pjsip send notify $notify_string endpoint $extension'";
     $out = system($cmd);
}

