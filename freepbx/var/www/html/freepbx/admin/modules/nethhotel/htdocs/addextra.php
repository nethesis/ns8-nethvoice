<?php
require_once("functions.inc.php");
require_once("session.inc.php");
require("translations.php");

$ext = $_POST['ext'];
$id = $_POST['name'];
$number = $_POST['num'];
$less = $_POST['less'];
$ntabs = $_REQUEST['ntab'];

if(addExtra($ext,$id,$number,$less))
return;
