#!/usr/bin/env php
<?php

require_once dirname(__FILE__) . '/functions.inc.php';
$section = getSection(dirname(__FILE__).'/'.basename($argv[0]));
$arguments = getArguments($section,$argv);

/*  RE - Room equipment status
 *  RN          Room Number
 *  CS          Class of Service
 *  CT          Clear Text
 *  DN          Do-not-Disturb
 *  ID          UserId
 *  ML          Message Light Status
 *  MR          Minibar Rights
 *  PP          Printer Port
 *  PU          Number of Persons
 *  RS          Room Status
 *  TV          TV Rights
 *  VM          Voice Mail
 */

if (!insertMessageIntoDB($section,$arguments)) {
    exit(1);
}
