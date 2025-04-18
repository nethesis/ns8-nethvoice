<?php
require_once("functions.inc.php");
require_once("session.inc.php");
require("translations.php");

$ntabs = $_REQUEST['ntab'];
switch($_REQUEST['action']) {

  case "edit":
    if(editAlarm($_REQUEST['ext'],$_REQUEST['hour'],$_REQUEST['enabled'],$_REQUEST['start'],$_REQUEST['days'],$_REQUEST['group']))
      return loadRooms($ntabs);
    break;
    
  case "disable":
      if(disableAlarm($_REQUEST['ext'],$_REQUEST['disableGroup']))
        return loadRooms($ntabs);
      break;

  case "disableAlarmAlert":
     global $db;
     $sql = "UPDATE roomsdb.alarms_history SET retry = 98 WHERE retry = 99 AND extension = {$_REQUEST['ext']}";
     $db->query($sql);
     return true;
     break;
  case "detail":
    header('Content-type: text/xml');
    echo "<response>";
    echo getAlarm($_REQUEST['ext']);
    echo "</response>";
    return;
}

