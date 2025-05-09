#!/usr/bin/env php
<?php

require_once dirname(__FILE__) . '/functions.inc.php';
$section = getSection(dirname(__FILE__).'/'.basename($argv[0]));
$arguments = getArguments($section,$argv);

/*  WC - Wakeup clear
 *  DA          Date
 *  RN          Room Number
 *  TI          Wake up Time
*/

if (!insertMessageIntoDB($section,$arguments)) {
    exit(1);
}
