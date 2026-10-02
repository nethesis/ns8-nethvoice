#!/usr/bin/env php
<?php

require_once dirname(__FILE__) . '/functions.inc.php';
require_once dirname(__FILE__) . '/fias-server-functions.inc.php';
$section = 'LE2PBX';
$arguments = array();

/*  LE - Link End
*/

if (!insertMessageIntoServerDB($section,$arguments)) {
    exit(1);
}
