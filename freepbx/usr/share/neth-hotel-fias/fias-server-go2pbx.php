#!/usr/bin/env php
<?php

require_once dirname(__FILE__) . '/functions.inc.php';
require_once dirname(__FILE__) . '/fias-server-functions.inc.php';
$section = getServerSection(dirname(__FILE__).'/'.basename($argv[0]));
$arguments = getArguments($section,$argv);

// GO - Guest Check-Out
// GO ->RN G# GS SF

/*  GO - Guest Check-Out
 *  G#          Reservation Number
 *  RN          Room Number
 *  GS          Share Flag
 *  DA          Date
 *  SF          Swap Flag
 *  TI          Time
 *  WS          Workstation ID
 */

if (!isset($arguments['RN'])) {
    logMessage("Error: missing room number",ERROR,str_replace('.php','',basename($argv[0])));
    exit(1);
}
if (!insertMessageIntoServerDB($section,$arguments)) {
    exit(1);
}
