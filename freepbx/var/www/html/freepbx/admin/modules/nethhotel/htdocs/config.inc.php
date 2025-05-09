<?php
require("translations.php");
include_once('/etc/freepbx.conf');

define('ROOMS',0);
define('RATES',1);
define('EXTRA',2);
define('OPTIONS',3);
define('CODES',4);
define('HISTORY',5);
define('GROUPS',6);
define('ASTERISK_OUTGOING','/var/spool/asterisk/outgoing');
define('ROOT_DIR','/var/www/html/freepbx/hotel');
define('ROOMS_CONTEXT','hotel');

date_default_timezone_set('Europe/Rome');

$sections = array(
  ROOMS => array(_('Rooms'),'rooms.php'),//Camere
  GROUPS => array(_('Groups'),'groups.php'),//Gruppi di camere
  RATES => array(_('Rates'),'rates.php'),//Tariffe
  EXTRA => array('Extra','extra.php'),
  OPTIONS => array(_('Options'),'options.php'),//Opzioni
  CODES => array(_('Short Numbers'),'codes.php'),//Numeri Brevi
  HISTORY => array(_('History'),'history.php')//Storico
);
?>
