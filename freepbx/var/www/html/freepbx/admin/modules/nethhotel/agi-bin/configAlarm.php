#!/usr/bin/env php
<?php
//PHPLICENSE 

define("AGIBIN_DIR", "/var/lib/asterisk/agi-bin");
define("MAX_TRIES",3);
define("TODAY",'1');
define("TOMORROW",'2');

include_once('/etc/freepbx_db.conf');
require_once('/var/www/html/freepbx/hotel/functions.inc.php');
include_once(AGIBIN_DIR."/phpagi.php");
$agi = new AGI();

$debug=false;

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

function salvato($file='') {
    global $agi;
    @$agi->exec("wait","1");
    @$agi->stream_file("beep");
    if ($file!='')
    	@$agi->stream_file($file);
    @$agi->exec("wait","2");
}

function set_lamp($stato,$interno) {
    global $agi;
    @$agi->set_variable("devlamp","100$interno");
    if ($stato=='on')
        @$agi->set_variable("statuslamp","INUSE");
    if ($stato=='off')
        @$agi->set_variable("statuslamp","NOT_INUSE");
    if ($stato=='blink')
        @$agi->set_variable("statuslamp","RINGING");
    neth_debug("set lamp 100$interno,$stato");
}

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

function requestHour($tries)
{
        global $agi;
        for($i=0; $i<$tries; $i++)
        {
                $pinchr = '';
		$hour = '';
                #$pin=@$agi->stream_file("vm-password",'1234567890#');
                $pin=@$agi->stream_file("alarm/ora",'1234567890#');

                if ($pin['result'] >0)
                        $hour=chr($pin['result']);
                // ciclo in attesa di numeri (codcli) fino a che non viene messo #
		
                while(strlen($hour)<4) {
                        $pin = @$agi->wait_for_digit("10000");
                        $pinchr=chr($pin['result']);
                        if ($pin['code'] != AGIRES_OK || $pin['result'] <= 0 ) { #non funziona dtmf, vado avanti
                                break;
                        } elseif ($pinchr >= "0" and $pinchr <= "9") {
                                $hour = $hour.$pinchr;
                        }
                }

                if($hour)
		{
		  neth_debug("HOUR: $hour");
		  return $hour;
		}
        }

        exit(1);
}

function requestStart($tries)
{
        global $agi;
        for($i=0; $i<$tries; $i++)
        {
                $pinchr = '';
                $pin=@$agi->stream_file("alarm/oggi-domani",'12');

		//neth_debug(print_r($pin,true));
                if ($pin['result'] > 0)
		{
                    $pinchr=chr($pin['result']);
		    if ($pinchr == TODAY || $pinchr == TOMORROW) 
                       return $pinchr;
		}
                // ciclo in attesa di numeri (codcli) fino a che non viene messo #
                while(!$pinchr) {
                        $pin = @$agi->wait_for_digit("10000");
                        $pinchr=chr($pin['result']);
			//neth_debug("in2=$pinchr");
                        if ($pin['code'] != AGIRES_OK || $pin['result'] <= 0 ) { #non funziona dtmf, vado avanti
                                 exit(1);
                        } elseif ($pinchr == TODAY || $pinchr == TOMORROW) {
                                return $pinchr;
                        }
                }
        }
}
function disable($ext)
{
    deleteCallFile($ext);
    
    global $db;
    $update="UPDATE roomsdb.alarms set enabled=0 WHERE extension=?";
    neth_debug($update);
    $sth=$db->prepare($update);
    $res=$sth->execute([$ext]);
}

function enable($ext,$hour,$start)
{
    
    deleteCallFile($ext);
 
    $h = explode(":",$hour);
    global $db;
    if($start==TODAY)
    {
      $start = @date("Y-m-d");
      $tstamp =  mktime($h[0],$h[1],0,date("m"),date("d"),date("Y"));
    }
    else
    {
      $tomorrow = mktime(0,0,0,date("m"),date("d")+1,date("Y"));
      $start = @date('Y-m-d',$tomorrow);
      $tstamp = mktime($h[0],$h[1],0,date("m"),date("d")+1,date("Y"));;
    }
    
    $end = $start;
    
    $update="UPDATE roomsdb.alarms set enabled=1,hour=?,start=?,end=? WHERE extension=?";
    neth_debug($update);
    $sth = $db->prepare($update);
    $res = $sth->execute(["$hour:00", $start, $end, $ext]);

    
    createCallFile($ext,$tstamp);
}


function isValidHour($hour)
{
  $h = $hour[0].$hour[1];
  $m = $hour[2].$hour[3];
  
  //neth_debug("h=$h,m=$m");
  if($h>=0 && $h<=24 && $m>=0 && $m<=60)
    return $h.":".$m;
  else
    return false;
}


function edit($ext)
{
  global $agi;
  $hour = requestHour(MAX_TRIES);
  for($i=0; $i<MAX_TRIES; $i++)
  {
    if($hour = isValidHour($hour))
      break;
    else 
    {
      @$agi->stream_file("beeperr");
      $hour = requestHour(MAX_TRIES);
    }
  }
  if(!$hour)
    exitError();
  
  $start = requestStart(MAX_TRIES);
  neth_debug("START: $start");
  
  if(!$start)
    exitError();
  
  enable($ext,$hour,$start); 
}


function exitError()
{
  @$agi->stream_file("alarm/arrivederci-errore");
  exit(1);
}

/******************************************************/

if($mode == 1)
{
  $target=requestTarget(MAX_TRIES); //chiedo il centralino da modificare
  @$agi->say_number($target);
//   neth_debug("TARGET: $target"); 
}

$target = $argv[1];

$cdidsql="SELECT roomsdb.alarms.extension,hour, roomsdb.alarms.start,end,roomsdb.alarms.enabled FROM roomsdb.alarms WHERE roomsdb.alarms.extension=?";
$stmt = $db->prepare($cdidsql);
$stmt->execute([$target]);
$cdidresult = $stmt->fetchAll();
neth_debug($cdidsql);

if(!$cdidresult[0][0]) {
        $insert="INSERT into roomsdb.alarms set extension=?, enabled='0'";
        neth_debug($insert);
        $sth = $db->prepare($insert);
        $res = $sth->execute([$target]);
        $ext=$target;
        $hour= null;
        $start=null;
        $end=null;
        $enabled='0';
} else {
        $ext=$cdidresult[0][0];
        $hour=$cdidresult[0][1];
        $start=$cdidresult[0][2];
        $end=$cdidresult[0][3];
        $enabled=(int)$cdidresult[0][4];
}

//comunichiamo l'impostazione attuale
if($enabled)
{
  $tomorrow = mktime(0,0,0,date("m"),date("d")+1,date("Y"));
  neth_debug("oggi: ".date('Y-m-d')." start=$start, domani=".date('Y-m-d',$tomorrow));
  if(date('Y-m-d')==$start) //start == oggi
    @$agi->stream_file("alarm/attivata-oggi");
  else if(date('Y-m-d',$tomorrow)==$start) //domani
    @$agi->stream_file("alarm/attivata-domani");
   else
     @$agi->stream_file("alarm/attiva"); 
  
  @$agi->say_number($hour[0].$hour[1]);
  @$agi->say_number($hour[3].$hour[4]);
  
}
else 
  @$agi->stream_file("alarm/disattivata");
 
@$agi->exec("wait","1");
 
while (true) {
    if(!$enabled) //propone di uscire, abilitare (configurare)
    {
      neth_debug("Menu per abilitare");
      $choice=neth_menu("alarm/menu_abilita",2,MAX_TRIES); 
    }
    else {
      neth_debug("Menu per DISabilitare");
      $choice=neth_menu("alarm/menu_disabilita",2,MAX_TRIES); //propone di uscire, disabilitare, modificare

    }
    neth_debug("Scelta $choice");
    switch($choice)
    {
       case 0:
            @$agi->exec("wait","1");
	    exit(0);
       break;
	
       
       case 1:
           if($enabled)
	    {
	      neth_debug("Disattiva");
	      @$agi->stream_file("beep");
	      disable($target);
 	      salvato("alarm/disattivata");
	      exit(0);
	    }
	    else //altrimenti richiedo i parametri
	    {
	      edit($target);
	      salvato("alarm/attivata");
	    }
	     //@$agi->stream_file("alarm/arrivederci");
	     exit(0);
	    break;
	
       case 2:
              edit($target);
	      @$agi->stream_file("alarm/arrivederci");
	      exit(0);
	break;
    }
   
   
    sleep(4);
}

exit(1);