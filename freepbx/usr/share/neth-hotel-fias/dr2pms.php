#!/usr/bin/env php
<?php

require_once dirname(__FILE__) . '/functions.inc.php';
require_once '/var/www/html/freepbx/hotel/functions.inc.php';
$section = getSection(dirname(__FILE__).'/'.basename($argv[0]));
$arguments = getArguments($section,$argv);

/*  DR - Database Resync request
 *  DA          Date
 *  TI          Time
 */

if (!isset($arguments['DA'])) {
    $arguments['DA'] = date('ymd');
}

if (!isset($arguments['TI'])) {
    $arguments['TI'] = date('His');
}

if (!insertMessageIntoDB($section,$arguments)) {
    exit(1);
}
