#!/usr/bin/env php
<?php

require_once dirname(__FILE__) . '/functions.inc.php';
$section = getSection(dirname(__FILE__).'/'.basename($argv[0]));
$arguments = getArguments($section,$argv);

/*  MINIBAR
 *  DA          Date
 *  TI          Wake up Time
 *  RN          Room Number
 *  MA          Minibar Article
 *  M#          Number of Articles
 *  TA		Total Aount
 */

if (empty($arguments['MA'])) {
    logMessage("Missing minibar article ID",ERROR, "minibar");
    exit(1);
}
if (empty($arguments['RN'])) {
    logMessage("Missin room number",ERROR, "minibar");
    exit(1);
}
if (empty($arguments['DA'])) {
    $arguments['DA'] = date("ymd");
}
if (empty($arguments['TI'])) {
    $arguments['TI'] = date("His");
}
if (empty($arguments['M#'])) {
    $arguments['M#'] = 1;
}

if (!empty($ini_file['minibar']) && !empty($ini_file['minibar']['psmode']) && $ini_file['minibar']['psmode'] === 'C' && !empty($arguments['TA'])) {
    $arguments['PT'] = 'C';
    if (empty($arguments['SO'])) {
        $arguments['SO'] = $arguments['MA'];
    }
    unset($arguments['MA']);
    unset($arguments['M#']);
} else {
    $arguments['PT'] = 'M';
    unset($arguments['TA']);
}

// Get posting sequence number
try {
    $query = "SELECT COUNT(*) as num FROM messages WHERE `cmd` = 'PS' AND `dir` = 'PMS'";
    $sth = $fiasdb->prepare($query);
    $rs = $sth->execute();
    $res = $sth->fetchAll(PDO::FETCH_ASSOC)[0]['num'];
    $psn = (int) $res + 1;
    // P# max length is 8 byte
    $psn = $psn % 99999999;
    $arguments['P#'] = $psn;
} catch (Exception $e) {
    logMessage("Error getting posting sequence number: ". $e->getMessage(),WARNING, "minibar");
}

if (!insertMessageIntoDB('PS2PMS',$arguments)) {
    exit(1);
}
