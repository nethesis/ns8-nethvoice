#!/usr/bin/env php
<?php
//PHPLICENSE 

define("AGIBIN_DIR", "/var/lib/asterisk/agi-bin");
define("AMPORTAL_CONF", "/etc/amportal.conf");
define("MAX_TRIES",3);
define("TODAY",'1');
define("TOMORROW",'2');


require_once('/var/www/html/freepbx/hotel/functions.inc.php');
include_once(AGIBIN_DIR."/phpagi.php");

$debug=false;

function requestTarget($tries)
{
        global $agi;
        for($i=0; $i<$tries; $i++)
        {
                $pinchr = '';
                $target = '';
                $pin=@$agi->stream_file("alarm/numero-camera",'1234567890#');
                #$pin=@$agi->stream_file("hours",'1234567890#');

                if ($pin['result'] >0)
                        $target=chr($pin['result']);
                // ciclo in attesa di numeri (codcli) fino a che non viene messo #
    
                while($pinchr!='#') {
                        $pin = @$agi->wait_for_digit("10000");
                        $pinchr=chr($pin['result']);
                        if ($pin['code'] != AGIRES_OK || $pin['result'] <= 0 ) { #non funziona dtmf, vado avanti
                                break;
                        } elseif ($pinchr >= "0" and $pinchr <= "9") {
                                $target = $target.$pinchr;
                        }
                }

                if($target)
                {
                  neth_debug("TARGET: $target");
                  return $target;
                }
        }

        exit(1);
}

function neth_menu($file,$options,$tries=3) {
    global $agi;
    $choice = NULL;
    $nt=0;
    while(is_null($choice) && $nt < $tries) {
        $ret = @$agi->stream_file($file,'1 2 3 4 5 0');
	//neth_debug(print_r($ret,true));
        if($ret['code'] != AGIRES_OK || $ret['result'] == -1)
           $choice = -1;
        elseif($ret['result'] and chr($ret['result'])<=$options)
	{
           $choice = $ret['result'];
	}
        $nt++;

    }
     if ($choice >=48 and $choice<=($options+48))
	     return chr($choice);
     else
     	     return -1;
}

function neth_debug($text) {
    global $agi;
    global $debug;
    if ($debug)
    	@$agi->verbose($text);
}

function set_lamp($stato,$interno) {
    global $agi;
        @$agi->verbose("CHIAMO SET_LAM");
    if ($stato=='on')
        @$agi->set_variable("statuslamp","INUSE");
    if ($stato=='off')
        @$agi->set_variable("statuslamp","NOT_INUSE");
    neth_debug("set lamp $interno,$stato");
}


function exitError()
{
    global $agi;
    @$agi->stream_file("alarm/arrivederci-errore");
    exit(1);
}


/******************************************************/

global $amp_conf;
$agi = new AGI();

$target = $argv[1];

//Setup database connection:
$db_user = $amp_conf["AMPDBUSER"];
$db_pass = $amp_conf["AMPDBPASS"];
$db_host = 'localhost';
$db_name = 'asterisk';
$db_engine = 'mysql';
$datasource = $db_engine.'://'.$db_user.':'.$db_pass.'@'.$db_host.'/'.$db_name;
$db = @DB::connect($datasource); // attempt connection


if(@DB::isError($db)) {
        @$agi->verbose("Error conecting to asterisk database, skipped");
} else {
	$cdidsql="SELECT * FROM roomsdb.rooms WHERE  extension=$target";
	$res=@$db->getAll($cdidsql);
	neth_debug($cdidsql);
	$cdidsql2="SELECT value FROM roomsdb.options WHERE variable='clean'";
	$res2=@$db->getAll($cdidsql2);
	neth_debug($cdidsql2);
	if(count($res))
	{
          $tot = getTotalCost($target);
          if ($tot!= 0) { # se ci sono extra chiedo conferma del checkout

                $num = explode('.', $tot);
                $i= true;

                while ($i == true)
                {
                   @$agi->stream_file("alarm/attenzione_checkout");
                   if($num[0]) @$agi->say_number("$num[0]");
                   else @$agi->say_number("0");
                   @$agi->stream_file("alarm/euro");
                   @$agi->stream_file("alarm/e");
                   if($num[1]) @$agi->say_number("$num[1]");
                   else  @$agi->say_number("0");
                   @$agi->stream_file("alarm/centesimi");
                   $choice=neth_menu("alarm/ivr_checkout",4);# 1 per confermare 2 per annullare 3 per addebitare ad altra camera 4 ripete       

                   if ($choice==1) {    $i= false; }
                   if ($choice==2) {
                                        neth_debug("Addebito trovato. chiudo");
                                        exit(0);
                                   }
                   if ($choice==3) {
                                        $room=requestTarget(MAX_TRIES);
                                        $result=assignExtra($tot,$room);
                                        if ($result==true) {
                                                @$agi->stream_file("alarm/assign_extra_ok");
                                                $i= false;  }
                                        else {
                                                @$agi->stream_file("alarm/assign_extra_ko");
                                             }

                                   }
                }
          }

	  checkOut($target);
          if($res2[0][0]!="1") { # se non gestisco il clean faccio automaticamente il clean
			neth_debug("Clean != 1 ".$res2[0]);
          	cleanRoom($target);
          } 
	  set_lamp('off',$target);
	  @$agi->stream_file("alarm/camera");
	  @$agi->say_digits("$target");
	  @$agi->stream_file("alarm/checkout_ok");
	  neth_debug("CHECK-OUT: $target");
	}
	else 
	{
	  checkIn($target);
	  set_lamp('on',$target);
	  @$agi->stream_file("alarm/camera");
	  @$agi->say_digits("$target");
	  @$agi->stream_file("alarm/checkin_ok");
	  neth_debug("CHECK-IN: $target");
	}
}


exit(0);

?>
