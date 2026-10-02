#!/usr/bin/env php
<?php

function processUserTestFail($message)
{
    fwrite(STDERR, "not ok - {$message}\n");
    exit(1);
}

$asteriskUid = null;
foreach (file('/etc/passwd', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $entry) {
    $fields = explode(':', $entry);
    if (isset($fields[0], $fields[2]) && $fields[0] === 'asterisk') {
        $asteriskUid = (int) $fields[2];
        break;
    }
}
if ($asteriskUid === null) {
    processUserTestFail('asterisk user is not defined');
}

$expectedProcesses = array(
    '/usr/share/neth-hotel-fias/fiasd.php' => false,
    '/usr/share/neth-hotel-fias/dispatcher.php' => false,
);

foreach (glob('/proc/[0-9]*/cmdline') as $commandLinePath) {
    $commandLine = @file_get_contents($commandLinePath);
    if ($commandLine === false) {
        continue;
    }
    $processArguments = explode("\0", rtrim($commandLine, "\0"));
    foreach ($expectedProcesses as $script => $found) {
        if (!in_array($script, $processArguments, true)) {
            continue;
        }

        $status = @file_get_contents(dirname($commandLinePath) . '/status');
        if ($status === false || !preg_match('/^Uid:\s+(\d+)/m', $status, $matches)) {
            processUserTestFail("unable to read the owner of {$script}");
        }
        if ((int) $matches[1] !== $asteriskUid) {
            processUserTestFail("{$script} is not running as asterisk");
        }
        $expectedProcesses[$script] = true;
    }
}

foreach ($expectedProcesses as $script => $found) {
    if (!$found) {
        processUserTestFail("{$script} is not running");
    }
}

fwrite(STDOUT, "ok - FIAS processes run as asterisk\n");
