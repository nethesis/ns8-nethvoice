<?php
require_once("functions.inc.php");
require_once("session.inc.php");
require("translations.php");

echo getReport($_REQUEST['ext'],$_REQUEST['start'],$_REQUEST['end']);
?>
