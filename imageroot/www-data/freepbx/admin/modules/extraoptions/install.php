<?php
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }

global $db;
global $amp_conf;

$sqls = array();
$sqls[] = "INSERT IGNORE INTO `featurecodes` VALUES ('extraoptions','transferdigittimeout','Seconds to wait between digits when transferring','In-Call. Number of seconds to wait between digits when transferring a call','3',NULL,1,0)";
$sqls[] = "INSERT IGNORE INTO `featurecodes` VALUES ('extraoptions','featuredigittimeout','Max time between digits for feature activation','In-Call. Max time (ms) between digits for feature activation (default is 1000 ms)','1000',NULL,1,0)";
$sqls[] = "INSERT IGNORE INTO `featurecodes` VALUES ('extraoptions','atxfernoanswertimeout','Attended transfer timeout','In-Call. Timeout for answer on attended transfer default is 15 seconds.','15',NULL,1,0)";
$sqls[] = "INSERT IGNORE INTO `featurecodes` VALUES ('extraoptions','atxferloopdelay','Number of seconds to sleep between retries','In-Call. Number of seconds to sleep between retries (if atxferdropcall = no)','10',NULL,1,0)";
$sqls[] = "INSERT IGNORE INTO `featurecodes` VALUES ('extraoptions','atxfercallbackretries','Call back retries','In-Call. Number of times to attempt to send the call back to the transferer.','2',NULL,1,0)";

$errors = array();
foreach ($sqls as $sql) {
    $check = $db->query($sql);
    if(DB::IsError($check)) {
        $errors[] = 'Failed to execute query: '.$sql;
    }
}

if (!empty($errors)) {
    die_freepbx("Can not add default optioncodes:\n".implode("\n",$errors));
}
