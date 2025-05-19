<?php
 require_once("functions.inc.php");
 require_once("session.inc.php");
 require("translations.php");

$ntabs = $_REQUEST['ntab'];

switch($_REQUEST['action'])
{
  case 'addRate':
    if (addRate($_REQUEST['duration'],$_REQUEST['price'],$_REQUEST['answer_duration'],$_REQUEST['answer_price'],$_REQUEST['pattern'],$_REQUEST['enabled'],$_REQUEST['name']))
      echo "<ok/>";
  break;

  case 'checkCost':
    if ( checkCost($_REQUEST['ext']))
      echo "true";
  break;

  case 'newExtra':
    if (newExtra($_REQUEST['price'],$_REQUEST['code'],$_REQUEST['enabled'],$_REQUEST['name']))
      echo "<ok/>";
  break;

  case 'loadRate':
    loadRates();
  break;

  case 'loadExtra':
    loadExtra();
  break;

  case 'loadRooms':
    loadRooms($ntabs);
  break;

  case 'deleteRate':
    delRate($_REQUEST['id']);
  break;

  case 'deleteExtra':
    delExtra($_REQUEST['id']);
  break;

  case 'detailRate':
    header('Content-type: text/xml');
    echo "<response>";
    echo getRate($_REQUEST['id']);
    echo "</response>";
    return;

  case 'detailExtra':
    header('Content-type: text/xml');
    echo "<response>";
    echo getExtra($_REQUEST['id']);
    echo "</response>";
    return;

  case 'editRate':
    delRate($_REQUEST['id']);
    if (addRate($_REQUEST['duration'],$_REQUEST['price'],$_REQUEST['answer_duration'],$_REQUEST['answer_price'],$_REQUEST['pattern'],$_REQUEST['enabled'],$_REQUEST['name']))
      echo "<ok/>";
  break;

  case 'editExtra':
    delExtra($_REQUEST['id']);
    if (newExtra($_REQUEST['price'],$_REQUEST['code'],$_REQUEST['enabled'],$_REQUEST['name']))
      echo "<ok/>";
  break;

 case 'addCode':
    if (addCode($_REQUEST['code'],$_REQUEST['number'],$_REQUEST['note'],$_REQUEST['id_timegroups_groups'],$_REQUEST['falsegoto']))
      echo "<ok/>";
  break;

  case 'loadCode':
    loadCodes();
  break;

  case 'deleteCode':
    delCode($_REQUEST['id']);
  break;

  case 'detailCode':
    header('Content-type: text/xml');
    echo "<response>";
    echo getCode($_REQUEST['id']);
    echo "</response>";
    return;

  case 'editCode':
    delCode($_REQUEST['id']);
    if (addCode($_REQUEST['code'],$_REQUEST['number'],$_REQUEST['note'],$_REQUEST['id_timegroups_groups'],$_REQUEST['falsegoto']))
      echo "<ok/>";
  break;

  case "saveOptions":
    saveOptions($_REQUEST['prefix'],$_REQUEST['ext_pattern'],$_REQUEST['internal_call'],$_REQUEST['groupcalls'],$_REQUEST['externalcalls'],$_REQUEST['internal_call_nocheckin'],$_REQUEST['reception'],$_REQUEST['enableclean'],$_REQUEST['clean'],$_REQUEST['reception_lang']);
  break;

  case "createOptionTimeGroups":
   createOptionTimeGroups($_REQUEST['id']);
  break;

  case "getTimeGroupsDetailsFromId":
   getTimeGroupsDetailsFromId($_REQUEST['id']);
  break;

  case "getTimeGroupsDetailsFromIdGroups":
   getTimeGroupsDetailsFromIdGroups($_REQUEST['id']);
  break;

  case "getTranslation":
   echo _($_REQUEST['string']);
  break;

  case "getGroupsDialog":
   echo getGroupsDialog($_REQUEST['group_id']);
  break;

  case "saveGroupsDialog":
   echo saveGroupsDialog($_REQUEST['group_name'],$_REQUEST['groupcalls'],$_REQUEST['roomscalls'],$_REQUEST['externalcalls'],$_REQUEST['group_note'],$_REQUEST['rooms_in_group'],$_REQUEST['group_id']);
  break;

  case "deleteGroup":
   deleteGroup($_REQUEST['group_id']);
  break;

  case "deleteAlarmGroupDialog":
   echo deleteAlarmGroupDialog($_REQUEST['group_id']);
  break;

  case "setAlarmGroupDialog":
    echo setAlarmGroupDialog($_REQUEST['group_id']);
  break;

  case "checkInGroupDialog":
    echo checkInGroupDialog($_REQUEST['group_id']);
  break;

  case "checkOutGroupDialog":
    echo checkOutGroupDialog($_REQUEST['group_id']);
  break;

  case "cleanGroupDialog":
    echo cleanGroupDialog($_REQUEST['group_id']);
  break;

  case "deleteAlarmGroup":
   echo deleteAlarmGroup($_REQUEST['group_id']);
  break;

  case "setAlarmGroup":
    echo setAlarmGroup($_REQUEST['group_id'],$_REQUEST['hour'],$_REQUEST['date'],$_REQUEST['days']);
  break;

  case "checkInGroup":
    echo checkInGroup($_REQUEST['group_id'],$_REQUEST['lang']);
  break;

  case "checkOutGroup":
    echo checkOutGroup($_REQUEST['group_id']);
  break;

  case "cleanGroup":
    echo cleanGroup($_REQUEST['group_id']);
  break;

 case "loadGroups":
    echo loadGroups();
 break;

}

if ($_REQUEST['action']==='gettext'){
    header ('Content-Type: application/json');

    $untranslated = json_decode(stripslashes($_REQUEST['untranslated']));
    foreach ($untranslated as $msgid){
        $translated[$msgid] = _($msgid);
    }
    echo json_encode($translated);
}

