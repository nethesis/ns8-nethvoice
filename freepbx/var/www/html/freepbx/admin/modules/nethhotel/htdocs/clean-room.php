<?php
require_once("functions.inc.php");
require_once("session.inc.php");
require("translations.php");

$ext = $_REQUEST['ext'];
$ntabs = $_REQUEST['ntab'];

if (cleanRoom($ext))
  return loadRooms($ntabs);

