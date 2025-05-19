#!/usr/bin/env php
<?php

require_once dirname(__FILE__) . '/functions.inc.php';
require_once '/var/www/html/freepbx/hotel/functions.inc.php';
$section = getSection(dirname(__FILE__).'/'.basename($argv[0]));
$arguments = getArguments($section,$argv);

/*  WA - Wakeup answer
 *  DA          Date
 *  RN          Room Number
 *  TI          Time
 */

logMessage($section ." [not implemented]",INFO,str_replace('.php','',basename($argv[0])));
