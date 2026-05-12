#!/usr/bin/env php
<?php

require_once dirname(__FILE__) . '/functions.inc.php';
require_once dirname(__FILE__) . '/fias-server-functions.inc.php';
$section = getServerSection(dirname(__FILE__).'/'.basename($argv[0]));
$arguments = getArguments($section,$argv);

/*  LE - Link End
*/

if (!insertMessageIntoServerDB($section,$arguments)) {
    exit(1);
}
