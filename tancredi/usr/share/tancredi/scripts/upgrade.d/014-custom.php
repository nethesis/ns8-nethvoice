<?php namespace upgrade14;

//
// Remove shipped firmware copies from the writable volume now that they are
// provided from the read-only Tancredi data directory.
//

$logger = $container->get('logger');
$rwFirmwareDir = '/var/lib/tancredi/data/firmware';
$roFirmwareDir = '/usr/share/tancredi/data/firmware';

if (!is_dir($rwFirmwareDir) || !is_dir($roFirmwareDir)) {
    $logger->info('Skip '.basename(__FILE__).' because firmware directories are unavailable');
    return;
}

$shippedFirmware = array();
$roFirmwareFiles = scandir($roFirmwareDir);
if ($roFirmwareFiles === false) {
    $logger->warning('Skip '.basename(__FILE__).' because shipped firmware cannot be listed');
    return;
}

foreach ($roFirmwareFiles as $filename) {
    if ($filename === '.' || $filename === '..') {
        continue;
    }

    $path = $roFirmwareDir.'/'.$filename;
    if (is_file($path)) {
        $shippedFirmware[$filename] = true;
    }
}

$rwFirmwareFiles = scandir($rwFirmwareDir);
if ($rwFirmwareFiles === false) {
    $logger->warning('Skip '.basename(__FILE__).' because writable firmware cannot be listed');
    return;
}

foreach ($rwFirmwareFiles as $filename) {
    if (!isset($shippedFirmware[$filename])) {
        continue;
    }

    $path = $rwFirmwareDir.'/'.$filename;
    if (!is_file($path)) {
        continue;
    }

    if (@unlink($path)) {
        $logger->info('Removed shipped firmware from writable volume: '.$filename);
        continue;
    }

    $logger->warning('Failed to remove shipped firmware from writable volume: '.$filename);
}