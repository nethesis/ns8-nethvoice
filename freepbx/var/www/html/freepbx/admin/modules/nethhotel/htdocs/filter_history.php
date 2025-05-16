<?php
require_once("functions.inc.php");
require_once("session.inc.php");
require("translations.php");

return getHistory($_REQUEST['start'],$_REQUEST['end'],$_REQUEST['ext']);

