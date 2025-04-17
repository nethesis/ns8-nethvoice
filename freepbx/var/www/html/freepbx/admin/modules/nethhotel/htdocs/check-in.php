<?php
require_once("functions.inc.php");
require_once("session.inc.php");
require("translations.php");

$ext = $_REQUEST['ext'];
$ntabs = $_REQUEST['ntab'];
$lang = $_REQUEST['lang'];

if (! in_array($lang, $supported_audio_langs)) {
    $lang = "en";
}

if (checkIn($ext, "", "", $lang))
  return loadRooms($ntabs);

