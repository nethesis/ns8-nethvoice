<?php
#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

// Restore only the rows that iaxsettings/sipsettings module installation can
// delete or replace. PJSIP transport rows are deliberately not touched here:
// they are seeded before Asterisk starts and cannot be rebound by a reload.

$requestedModules = array_unique(array_slice($argv, 1));
$supportedModules = ['iaxsettings', 'sipsettings'];
foreach ($requestedModules as $module) {
    if (!in_array($module, $supportedModules, true)) {
        fwrite(STDERR, "Unsupported port-repair module: {$module}\n");
        exit(2);
    }
}

$portVariables = [
    'ASTERISK_IAX_PORT',
    'ASTERISK_SIP_UDP_PORT',
    'ASTERISK_RTPSTART',
    'ASTERISK_RTPEND',
];
foreach ($portVariables as $name) {
    $value = $_ENV[$name] ?? '';
    if (!ctype_digit($value) || (int)$value < 1 || (int)$value > 65535) {
        fwrite(STDERR, "{$name} must be a port number between 1 and 65535\n");
        exit(2);
    }
}

require '/etc/freepbx_db.conf';
$db->beginTransaction();

// The primary key includes keyword, seq and type. Delete by keyword first so
// an installer-created row with different metadata cannot coexist with ours.
if (in_array('iaxsettings', $requestedModules, true)) {
    $db->exec('DELETE FROM iaxsettings WHERE keyword = "bindport"');
    $stmt = $db->prepare(
        'INSERT INTO iaxsettings (keyword, data, seq, type)
         VALUES ("bindport", ?, 1, 0)'
    );
    $stmt->execute([$_ENV['ASTERISK_IAX_PORT']]);
}

if (in_array('sipsettings', $requestedModules, true)) {
    $db->exec(
        'DELETE FROM sipsettings
         WHERE keyword IN ("bindport", "rtpstart", "rtpend")'
    );
    $stmt = $db->prepare(
        'INSERT INTO sipsettings (keyword, data, seq, type) VALUES
             ("bindport", ?, 1, 0),
             ("rtpstart", ?, 0, 0),
             ("rtpend", ?, 0, 0)'
    );
    $stmt->execute([
        $_ENV['ASTERISK_SIP_UDP_PORT'],
        $_ENV['ASTERISK_RTPSTART'],
        $_ENV['ASTERISK_RTPEND'],
    ]);
}

$db->commit();
