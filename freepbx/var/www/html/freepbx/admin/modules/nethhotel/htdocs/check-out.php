<?php
 require_once("functions.inc.php");
 require_once("session.inc.php");
 require("translations.php");

$ntabs = $_REQUEST['ntab'];

if (checkOut($_REQUEST['ext']))
  return loadRooms($ntabs);
