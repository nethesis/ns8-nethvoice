<?php
require_once("functions.inc.php");
require_once("session.inc.php");
require("translations.php");

$ext = $_REQUEST['ext'];
$group = $_REQUEST['group'];
$ntabs = $_REQUEST['ntab'];

switch($_REQUEST['action']) 
{
    case "set":
        if (setGroup($ext,$group))
            return loadRooms($ntabs);
        break;
    case "detail";
        header('Content-type: text/xml');
        echo "<response>";
        echo getGroup($ext);
        echo "</response>";
        break;

}

