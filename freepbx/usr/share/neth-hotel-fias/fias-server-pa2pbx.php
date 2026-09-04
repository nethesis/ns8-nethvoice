#!/usr/bin/env php
<?php

require_once dirname(__FILE__) . '/functions.inc.php';
require_once dirname(__FILE__) . '/fias-server-functions.inc.php';
$section = 'PA2PBX';
$arguments = getArguments($section, $argv);

/* PA - Posting Answer (the PBX-side handler currently logs "not implemented"). */

if (!insertMessageIntoServerDB($section, $arguments)) {
    exit(1);
}
