#!/usr/bin/env php
<?php
//PHPLICENSE 

define("AGIBIN_DIR", "/var/lib/asterisk/agi-bin");
define("AMPORTAL_CONF", "/etc/amportal.conf");
define("MAX_TRIES",3);
define("TODAY",'1');
define("TOMORROW",'2');

include_once('/etc/freepbx_db.conf');
require_once('/var/www/html/freepbx/hotel/functions.inc.php');
include_once(AGIBIN_DIR."/phpagi.php");

$debug=false;

function neth_debug($text) {
    	global $agi;
    	global $debug;
    	if ($debug)
    		@$agi->verbose($text);
}

function exitError()
{
   	global $agi;
  	@$agi->stream_file("alarm/errore-extra");
  	exit(1);
}

/******************************************************/

$agi = new AGI();

$target = $argv[1];

$dati = explode("#",$target);
if (count($dati)<2) 
	exitError();
elseif (count($dati)==2)
	$num=1;
else
	$num=$dati[2];

$camera=$dati[0];
$extra=$dati[1];

neth_debug(" $target $camera $extra $num");

$sql="SELECT roomsdb.rooms.extension FROM roomsdb.rooms WHERE roomsdb.rooms.extension=?";
$stmt = $db->prepare($sql);
$stmt->execute([$camera]);
$cdidresult = $stmt->fetchAll();
neth_debug($sql);
$exten=$cdidresult[0][0];

$sql="SELECT roomsdb.extra.id, roomsdb.extra.name, roomsdb.extra.price, roomsdb.extra.code FROM roomsdb.extra WHERE roomsdb.extra.code=? and roomsdb.extra.enabled=1";
$stmt = $db->prepare($sql);
$stmt->execute([$extra]);
$cdidresult = $stmt->fetchAll();
neth_debug($sql);
$extra_id=$cdidresult[0][0];
$extra_name=$cdidresult[0][1];
$extra_price=$cdidresult[0][2];
$extra_code=$cdidresult[0][3];

neth_debug(" $camera - $extra - $num - $exten - $extra_id - $extra_name - $extra_code");

if (($camera==$exten) and ($extra==$extra_code)) {
# camera e codice ok, inserisco
	$data= @date("Y-m-d H:i:s");
    	$sql="insert into roomsdb.extra_history (extension,id,date,name,price,number,checkout) values (?,?,?,?,?,?,0)";
   	neth_debug($sql);
    	$stmt = $db->prepare($sql);
    	$res=$stmt->execute([$camera,$extra_id,$data,$extra_name,$extra_price,$num]);
      	@$agi->stream_file("alarm/extra");
      	@$agi->say_digits("$extra_code");
      	@$agi->stream_file("alarm/camera");
      	@$agi->say_digits("$camera");
      	@$agi->stream_file("alarm/quantita");
      	@$agi->say_digits("$num");

} else {
	exitError();
	# messaggio errore codice o num
}
