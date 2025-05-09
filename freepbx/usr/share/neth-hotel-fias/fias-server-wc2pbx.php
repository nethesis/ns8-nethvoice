#!/usr/bin/env php
<?php

require_once dirname(__FILE__) . '/functions.inc.php';
require_once dirname(__FILE__) . '/fias-server-functions.inc.php';
$section = getServerSection(dirname(__FILE__).'/'.basename($argv[0]));
$arguments = getArguments($section,$argv);

/*  WC - Wakeup clear
 *  DA          Date
 *  TI          Time
 *  RN          Room Number
 */

if (!isset($arguments['RN'])) {
    logMessage("Error: missing room number",ERROR,str_replace('.php','',basename($argv[0])));
    exit(1);
}

if (!insertMessageIntoServerDB($section,$arguments)) {
    exit(1);
}
