#!/usr/bin/env php
<?php

require_once dirname(__FILE__) . '/functions.inc.php';
require_once '/var/www/html/freepbx/hotel/functions.inc.php';
$section = getSection(dirname(__FILE__).'/'.basename($argv[0]));
$arguments = getArguments($section,$argv);

/*  PA - Posting Answer
 *  AS          Answer Status
 *  CT          Clear Text
 *  P#          Posting Sequence Number
 *  RN          Room Number
 *  C#          Check Number
 *  G#          Reservation Number
 *  GN          Guest Name
 *  ID          User ID
 *  SO          Sales Outlet
 */

logMessage($section ." [not implemented]",INFO,str_replace('.php','',basename($argv[0])));
