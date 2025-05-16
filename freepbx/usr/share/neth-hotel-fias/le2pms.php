#!/usr/bin/env php
<?php

require_once dirname(__FILE__) . '/functions.inc.php';
$section = getSection(dirname(__FILE__).'/'.basename($argv[0]));
$arguments = getArguments($section,$argv);

/*  LE - Link End
*/

if (!insertMessageIntoDB($section,$arguments)) {
    exit(1);
}

// Wait for message to be sent to pms
try {
    $query = "SELECT COUNT(*) FROM messages WHERE cmd = 'LE' AND dir = 'PMS' AND elaborationtime IS NULL";
    $sth = $fiasdb->prepare($query);
    for ($i = 0 ; $i <= 60 ; $i++) {
        sleep(1);
        $sth->execute();
        $res = $sth->fetchAll()[0][0];
        if ($res == 0) {
            exit(0);
        }
    }
} catch (Exception $e){
    logMessage($section ." ERROR ". $e->getMessage(),ERROR,str_replace('.php','',basename($argv[0])));
    exit(1);
}

