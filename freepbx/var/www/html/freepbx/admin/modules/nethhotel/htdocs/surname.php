<?php
require_once("functions.inc.php");
require_once("session.inc.php");
require("translations.php");

$ntabs = $_REQUEST['ntab'];

switch($_REQUEST['action']) {

  case "edit":
    if(editSurname($_REQUEST['ext'], stripcslashes($_REQUEST['name'])))
      return loadRooms($ntabs);
    break;
}

