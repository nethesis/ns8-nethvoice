<?php
//
// Copyright (C) 2010-2015 Nethesis s.r.l. - All rights reserved.
//
require_once("config.inc.php");
require_once("utils.inc.php");

function nethhotel_log($msg, $function=''){
    $out = fopen('php://stdout', 'w');
    fputs ($out, date('M d H:i:s')."$function: ".print_r($msg,true));
    fclose ($out);
}

function loadRates()
{
  $rates = getAllRates();
  if(!count($rates))
  {
    echo "<div style='padding: 5px; font-style: italic; margin-left: 10px'>". _("None price configured")."</div>";//Nessuna tariffa configurata
    return;
  }
  echo '<table class="noborder">
	  <tr><th>'. _("Name").'</th><th>'. _("Duration connection fee").'</th><th>'. _("Cost connection fee").'</th><th>'. _("Fee duration").'</th>
	  <th>'. _("Fee cost").'</th><th>'. _("Pattern").'</th><th>'. _("Enable caller").'</th><th/></tr>';

	  $i=0;
	  foreach($rates as $rate)
	  {
	    if($i%2)
	      $altrow = ' class="altrow" ';
	    else
	      $altrow = '';
	    if($rate['enabled'])
	      $img = 'images/enabled.png';
	    else
	      $img = 'images/disabled.png';

	    echo "<tr $altrow><td>{$rate['name']}</td><td>{$rate['answer_duration']} sec</td><td>{$rate['answer_price']} cent</td>
	    <td>{$rate['duration']} sec</td><td>{$rate['price']} cent</td><td>{$rate['pattern']}</td><td style='text-align: center'><img src='$img'/></td>
	    <td style='text-align: center'><a href='#ajax-editRate-{$rate['id']}'><img src='images/edit.png' title=". _('Modify rate')." label='Modifica tariffa'/></a>
	    <a href='#ajax-deleteRate-{$rate['id']}'><img src='images/disable.png' title=". _('Delete rate')." label='Elimina tariffa'/></a>
	    </td></tr>";
	    $i++;
	  }
  echo '</table>';
}

function loadExtra()
{
  $extras = getAllExtra();
  if(!count($extras))
  {
    echo "<div style='padding: 5px; font-style: italic; margin-left: 10px'>". _("No extra set")."</div>";//Nessun extra configurato
    return;
  }
  echo '<table class="noborder">
          <tr><th>'. _("Name").'</th><th>'. _("Cost").'</th><th>'. _("Code").'</th>
          <th>'. _("Habilitation").'</th><th/></tr>';//Abilitazione
          $i=0;
          foreach($extras as $extra)
          {
            if($i%2)
              $altrow = ' class="altrow" ';
            else
              $altrow = '';
            if($extra['enabled'])
              $img = 'images/enabled.png';
            else
              $img = 'images/disabled.png';

	    echo "<tr $altrow><td>{$extra['name']}</td><td>".number_format($extra['price'],"2",",",".")." euro</td>
	    <td>{$extra['code']}</td><td style='text-align: center'><img src='$img'/></td>
	    <td style='text-align: center'><a href='#ajax-editExtra-{$extra['id']}'><img src='images/edit.png' title=". _('Modify rate')." label='Modifica tariffa'/></a>
	    <a href='#ajax-deleteExtra-{$extra['id']}'><img src='images/disable.png' title=". _('Delete rate')." label='Elimina tariffa'/></a>
	    </td></tr>";
            $i++;OOB;
          }
  echo '</table>';
}

function loadCodes()
{
  $codes = getAllCodes();

  if(!count($codes))
  {
    echo "<div style='padding: 5px; font-style: italic; margin-left: 10px'>". _("No Number Short configured")."</div>";//Nessuna Numero Breve configurato
    return;
  }
  echo '<table class="noborder">
	  <tr><th>'. _("Code").'</th><th>'. _("Description").'</th><th>'. _("Temporal group").'</th><th>'. _("Details").'</th><th>'. _("Destination").'</th><th>'. _("Otherwise").'</th><th></th></tr>';
	  $i=0;
	  foreach($codes as $code)
	  {
	    $defined[] = $code['code'];
	    if($i%2)
	      $altrow = ' class="altrow" ';
	    else
	      $altrow = '';

          $timegroup = getTimeGroupsFromId($code['id_timegroups_groups']);

	  echo "<tr $altrow><td>{$code['code']}</td></td><td>{$code['note']}</td><td>{$timegroup[0]}</td><td>{$timegroup[1]}</td><td>{$code['number']}</td><td>{$code['falsegoto']}</td>
	    <td style='text-align: center'><a href='#ajax-editCode-{$code['id']}'><img src='images/edit.png' title='Modifica' label='Modifica'/></a>
	    <a href='#ajax-deleteCode-{$code['id']}'><img src='images/disable.png' title='Elimina' label='Elimina'/></a>
	    </td></tr>";
          $i++;
	  }
  echo '</table>';
  echo "<script type='text/javascript'>\ncodes=new Array();\n";
  $i=0;
  foreach($defined as $def)
  {
    echo "codes[$i]=$def;\n";
    $i++;
  }
  echo "</script>";
}

function getTimeGroups()
{
  global $db;
  $results = sql("SELECT id,description from asterisk.timegroups_groups order by description;","getAll",DB_FETCHMODE_ASSOC);
  return $results;
}

function getTimeGroupsDetails()
{
  global $db;
  $details = sql("SELECT timegroupid,time from asterisk.timegroups_details;","getAll",DB_FETCHMODE_ASSOC);
  return $details;
}

function createOptionTimeGroups($id)
{
  global $db;
  $timegroups = getTimeGroups();
  $id_group = '';
  if( $id!='0') $id_group = sql("SELECT id_timegroups_groups from roomsdb.codes where id='$id';","getRow", DB_FETCHMODE_ASSOC);

  echo "<select name='groupname' id='groupname'>";
  if(!isset($id_group['id_timegroups_groups']) || $id_group['id_timegroups_groups'] == '0') {
      echo "<option value='0' selected='selected'>". _('Always')."</option>\n";
  } else {
      echo "<option value='0'>". _('Always')."</option>\n";//Sempre
  }

  foreach($timegroups as $timegroup)
  {
      if(!isset($id_group['id_timegroups_groups']) || $timegroup['id']!= $id_group['id_timegroups_groups']) {
          echo "<option value='{$timegroup['id']}'>{$timegroup['description']}</option>\n";
      } else {
          echo "<option value='{$timegroup['id']}' selected='selected'>{$timegroup['description']}</option>\n";
      }
  }
  echo "</select>";
}

function getTimeGroupsDetailsFromId($id)
{
  global $db;

  if($id!= '0')
  {
   $group = '';
   $id_group = sql("SELECT id_timegroups_groups from roomsdb.codes where id='$id';","getRow", DB_FETCHMODE_ASSOC);
   $details = sql("SELECT time from asterisk.timegroups_details where timegroupid='$id_group[id_timegroups_groups]';","getAll",DB_FETCHMODE_ASSOC);
   foreach($details as $detail)
   {
    if($group== '') $group = $detail[time];
    else $group.="<br>".$detail[time];
   }
   echo $group;
  }
  else echo " ";
}

function getTimeGroupsDetailsFromIdGroups($id)
{
  global $db;
  if($id!= '0')
  {
   $group = '';
   $details = sql("SELECT time from asterisk.timegroups_details where timegroupid='$id';","getAll",DB_FETCHMODE_ASSOC);
   foreach($details as $detail)
   {
    if($group== '') $group = $detail[time];
    else $group.="<br>".$detail[time];
   }
   echo $group;
  }
  else echo " ";
}

function getTimeDetailsFromIdGroupsArray($id)
{
  global $db;
  $details = array();
  if($id!= '0') $details = sql("SELECT time from asterisk.timegroups_details where timegroupid='$id';","getAll",DB_FETCHMODE_ASSOC);
  else $details[0]= '*';
  return $details;
}

function getTimeGroupsFromId($id)
{
  global $db;
  $result = array();
  $timegroups = getTimeGroups();
  $groupsdetails = getTimeGroupsDetails();
  $name_group = '';
  $details_group = '';

  if($id == 0)
  {
   $result[0] = _('Always');
   $result[1] = '';
  }
  else
  {
   foreach($timegroups as $timegroup)
   {
    if($id == $timegroup['id'])
    {
     $name_group = $timegroup['description'];
     foreach($groupsdetails as $groupsdetail)
     {
      if($id == $groupsdetail['timegroupid'])
      {
       if($details_group == '') $details_group = $groupsdetail['time'];
       else $details_group.= "<br>".$groupsdetail['time'];
      }
     }
    }
   }
   $result[0] = $name_group;
   $result[1] = $details_group;
  }
  return $result;
}

function getAllRates()
{
  global $db;
  $ret = sql("SELECT * from roomsdb.rates order by name","getAll",DB_FETCHMODE_ASSOC);

  if(count($ret))
    return $ret;
  else
    return array();
}

function getAllExtra()
{
  global $db;
  $ret = sql("SELECT * from roomsdb.extra order by name","getAll",DB_FETCHMODE_ASSOC);

  if(count($ret))
    return $ret;
  else
    return array();
}

function getAllCodes()
{
  global $db;
  $ret = sql("SELECT * from roomsdb.codes order by code","getAll",DB_FETCHMODE_ASSOC);

  if(count($ret))
    return $ret;
  else
    return array();
}

function delRate($id)
{
  global $db;
  $res = $db->query("DELETE FROM roomsdb.rates WHERE id=$id");
  echo "DELETE FROM roomsdb.rates WHERE id=$id";
  if (@DB::isError($res))
    return false;
  else
    return true;
}

function delExtra($id)
{
  global $db;
  $res = $db->query("DELETE FROM roomsdb.extra WHERE id=$id");
  echo "DELETE FROM roomsdb.extra WHERE id=$id";
  if (@DB::isError($res))
    return false;
  else
    return true;
}


function delCode($id)
{
  global $db;
  $res = $db->query("DELETE FROM roomsdb.codes WHERE id=$id");
  echo "DELETE FROM roomsdb.codes WHERE id=$id";
  if (@DB::isError($res))
    return false;
  else
    return true;
}

function addRate($duration,$price,$answer_duration,$answer_price,$pattern,$enabled,$name='default')
{
  global $db;
  $price = str_replace(',','.',$price);
  $qry = "INSERT INTO roomsdb.rates (name,duration,price,answer_duration,answer_price,pattern,enabled) VALUES ('$name','$duration','$price','$answer_duration','$answer_price','$pattern','$enabled')";
  //echo $qry;
  $res = $db->query($qry);
  if (@DB::isError($res))
    return false;
  else
    return true;
}

function newExtra($price,$code,$enabled,$name='default')
{
  global $db;
  $price = str_replace(',','.',$price);
  $qry = "INSERT INTO roomsdb.extra (name,price,code,enabled) VALUES ('$name','$price','$code','$enabled')";
  //echo $qry;
  $res = $db->query($qry);
  if (@DB::isError($res))
    return false;
  else
    return true;
}


function addCode($code,$number,$note,$id_timegroups_groups,$falsegoto)
{
  global $db;
  $qry = "INSERT INTO roomsdb.codes (code,number,note,id_timegroups_groups,falsegoto) VALUES ($code,$number,'$note','$id_timegroups_groups','$falsegoto')";
  $res = $db->query($qry);
  if (@DB::isError($res))
    return false;
  else
    return true;
}


function getRate($id)
{
  global $db;
  $result = sql("SELECT * FROM roomsdb.rates WHERE id=$id","getRow", DB_FETCHMODE_ASSOC);

  return "<duration>{$result['duration']}</duration><price>{$result['price']}</price><enabled>{$result['enabled']}</enabled>
  <answer_duration>{$result['answer_duration']}</answer_duration><answer_price>{$result['answer_price']}</answer_price>
  <name>{$result['name']}</name><pattern>{$result['pattern']}</pattern>";

}

function getExtra($id)
{
  global $db;
  $result = sql("SELECT * FROM roomsdb.extra WHERE id=$id","getRow", DB_FETCHMODE_ASSOC);
  $price = str_replace('.',',',$result['price']);
  return "<price>{$price}</price><enabled>{$result['enabled']}</enabled>
  <name>{$result['name']}</name><code>{$result['code']}</code>";

}

function getCode($id)
{
  global $db;
  $result = sql("SELECT * FROM roomsdb.codes WHERE id=$id","getRow", DB_FETCHMODE_ASSOC);
  $time_group = getTimeGroupsFromId($result['id_timegroups_groups']);

  return "<code>{$result['code']}</code><note>{$result['note']}</note><number>{$result['number']}</number><falsegoto>{$result['falsegoto']}</falsegoto>";
}

function getGroup($ext)
{
  global $db;
  $result = sql("SELECT `group` FROM roomsdb.rooms WHERE extension=$ext","getRow", DB_FETCHMODE_ASSOC);
  if(!$result['group'])
    return "<group>-1</group>";
  else
    return "<group>{$result['group']}</group>";

}

function getHistoryRooms()
{
  global $db;
  $extens = array();
  $results = sql("SELECT distinct extension FROM roomsdb.history ORDER BY extension","getAll");

  foreach($results as $result)
    $extens[] = $result[0];

  return $extens;
}

function editAlarm($ext,$hour,$enabled,$start,$days=1,$group=0)
{
  global $db;
  $ret = true;
  $from = explode("/",$start);
  $h = explode(":",$hour);
  $start = mktime($h[0],$h[1],0,$from[1],$from[0],$from[2]);

  if($days>1)
    $end =  $start + (86400*$days); //aggiungo i giorni
  else
    $end = $start;

  if($group)
  {
    $res = sql("SELECT `group` from roomsdb.rooms WHERE extension=$ext","getRow"); //determino il gruppo della camera
    $group = $res[0];
    $rooms = sql("SELECT extension from roomsdb.rooms WHERE `group`=$group","getAll"); //seleziono tutte le camere del gruppo
    foreach($rooms as $ext) //sostituisco tutte le sveglie del gruppo
    {
	deleteCallFile($ext[0]);
        $ret = $ret && createAlarm($ext[0],$hour,$start,$end,$enabled,$days);
    }
  }
  else
  {
    deleteCallFile($ext);
    $ret = $ret && createAlarm($ext,$hour,$start,$end,$enabled,$days);
  }

  return $ret;
}

function editSurname($ext,$name)
{
   global $db;
   global $astman;
   if ($astman) {
    $cidname = (empty($name) ? "Room $ext" : "<$ext> ".$db->escapeSimple($name));
    $astman->database_put("AMPUSER",$ext."/cidname",$cidname);
   } else {
    nethhotel_log ("Astman failed",__FUNCTION__);
    return false;
   }
   $stmt = $db->prepare("UPDATE roomsdb.rooms set text=? where extension=?");
   $stmt->execute([$name,$ext]);
   return true;
}

function externalCreateAlarm($ext,$hour,$start,$end,$enabled,$days)
{
    return _createAlarm($ext,$hour,$start,$end,$enabled,$days);
}

function createAlarm($ext,$hour,$start,$end,$enabled,$days){
     if (_createAlarm($ext,$hour,$start,$end,$enabled,$days)) {
        //fias feedback
        for ($i=0; $i<$days; $i++) {
            $da=date('ymd',$start+(86400*$i));
            fias('WR2PMS', array(
                'DA' => date('ymd',$start+(86400*$i)),
                'TI' => str_replace(":","",$hour."00"),
                'RN' => $ext
                )
            );
        }
        return true;
    }else{
        return false;
    }

}

function _createAlarm($ext,$hour,$start,$end,$enabled,$days)
{
   global $db;
   $res = $db->query("REPLACE INTO roomsdb.alarms (extension,hour,start,end,enabled) VALUES ($ext,'$hour:00',from_unixtime($start),from_unixtime($end),$enabled)");
   for($i=0; $i<$days; $i++)
   {
      $time = $start + (86400*$i); //aggiungo i secondi di un giorno
      createCallFile($ext,$time);
      nethhotel_log("Created alarm for room $ext at $time",__FUNCTION__);
   }
   if (@DB::isError($res))
   {
       nethhotel_log("Error!: ".$res->getMessage() );
   }
   return true;
}


function disableAlarm($ext,$disableGroup=0)
{
  global $db;
  $ret = true;
  if($disableGroup)
  {
    $res = sql("SELECT `group` from roomsdb.rooms WHERE extension=$ext","getRow"); //determino il gruppo della camera
    $group = $res[0];
    $rooms = sql("SELECT extension from roomsdb.rooms WHERE `group`=$group","getAll"); //seleziono tutte le camere del gruppo
    foreach($rooms as $ext) //sostituisco tutte le sveglie del gruppo
        $ret = $ret && deleteAlarm($ext[0]);
  }
  else
    $ret = $ret && deleteAlarm($ext);

  return $ret;
}

function deleteAlarm($ext)
{
    global $db;
    $res = $db->query("UPDATE roomsdb.alarms SET enabled=0 WHERE extension=$ext");
    deleteCallFile($ext);
    nethhotel_log("Deleted alarm for room $ext",__FUNCTION__);
    return !@DB::isError($res);
}

function getAlarm($ext)
{
  global $db;
  $result = sql("SELECT TIME_FORMAT(hour, '%H:%i') as hour,date_format(start,'%d/%m/%Y') as start,date_format(end,'%d/%m/%Y') as end,enabled,to_days(end)-to_days(start) as days FROM roomsdb.alarms WHERE extension=$ext","getRow");

  if($result[1]!="00/00/0000")
    $start = $result[1];

  return "<hour>$result[0]</hour><start>$start</start><days>$result[4]</days><enabled>$result[3]</enabled>";

}

function getAlarmList()
{
  global $db;
  $extens = array();
  $results = sql("SELECT extension FROM roomsdb.alarms ","getAll");

  foreach($results as $result)
    $extens[] = $result[0];

  return $extens;
}

function getEnabledAlarmList()
{
  global $db;
  $extens = array();
  $results = sql("SELECT extension,hour,date_format(start,'%d/%m/%Y') as start,to_days(end)-to_days(start)+1 as days,date_format(end,'%d/%m/%Y') as end FROM roomsdb.alarms WHERE enabled=1 and addtime(end,hour)>now()","getAll");

  foreach($results as $result)
    $extens[$result[0]] = array($result[1],$result[2],$result[3],$result[4]);

  return $extens;
}

function getEnabledAlarmsFailed()
{
  global $db;
  $extens = array();
  $results = sql("SELECT extension,from_unixtime(alarm,'%d/%m/%Y %H:%i') from roomsdb.alarms_history where retry=99 and from_unixtime(alarm,'%d/%m/%Y') = date_format(now(),'%d/%m/%Y')","getAll");

  foreach($results as $result)
    $extens[$result[0]] = $result[1];

  return $extens;
}


function checkPattern($number,$pattern)
{
    $pattern = str_replace("X","[0-9]",$pattern);
    $pattern = str_replace("N","[2-9]",$pattern);
    $pattern = str_replace("Z","[1-9]",$pattern);
    $pattern = str_replace(".","\d+",$pattern);

    return preg_match("/^$pattern$/",$number);
}

function findRate($number,$rates)
{
  foreach($rates as $rate)
  {
    if(checkPattern($number,$rate['pattern']))
      return $rate;
  }
  return false;
}

function setExtra($ext)
{
  global $db;
    $extras_list = getextraList();
    $extras = sql ("SELECT date_format(date,'%d/%m/%Y %H:%i') as data,name,number,price,extension,UNIX_TIMESTAMP(date) as date from roomsdb.extra_history where extension='$ext' and checkout!='1' order by date desc","getAll");

    echo "<tr><th colspan='2'>". _("Add Extra")."</th><td colspan='3'><label for='name'>". _("Name")."</label>&nbsp;&nbsp;<select name=\"name\" id=\"name\">"; //Aggiungi Extra; Nome
    foreach($extras_list as $extra_list)
     {
      echo "<option value='{$extra_list['id']}'>{$extra_list['name']}</option>\n";
     }
    echo "</select>&nbsp;&nbsp;<label for=\"number\">". _("Number")."</label>&nbsp;&nbsp;<input type=\"text\" name=\"number\" size=\"3\" id=\"number\" class=\"text ui-widget-content ui-corner-all\"></td><td><button class='ButtonClass' id='ButtonSave'>". _("Save")."</button></td></tr>"; //Salva
    echo "<tr><th colspan='6' style='border-top: 1px solid #CCCCCC;'></th></tr>";
    echo "<tr><th colspan='6' style='border-top: 1px solid #CCCCCC;'></th></tr>";
    echo "<tr><th colspan='6' style='border-top: 1px solid #CCCCCC;'></th></tr>";
    if (count($extras)>0)
      {
        echo "<tr><th>". _("Date and time")."</th><th>". _("Name")."</th><th>". _("Unit cost")."</th><th>". _("Number")." </th><th>". _("Total cost")."</th><th>". _("Delete")."</th></tr>";

        $value= 0;
        $i=0;
        foreach($extras as $extra)
        {
         $altrow='';
         if($i%2)
         $altrow=' class="altrow" ';
         $value=$extra[2]*$extra[3];
         echo "<tr $altrow><td>$extra[0]</td><td>$extra[1]</td><td>$extra[3]</td><td>$extra[2]</td><td>".number_format($value,"2",",",".")." </td><td><input type=\"checkbox\" id=\"$extra[4]-$extra[5]\"/></td></tr>\n";
         $i++;
        }
      }
    else { echo "<tr><td colspan='6'>". _("None extra for this room.")." </td></tr>"; } //Nessuna extra per questa camera.

}

function addExtra($ext,$id,$number,$less)
{
      global $db;
      $error = 0;
      if($less)
      {

       $delete = explode("/", $less);

       foreach($delete as $del)
       {
         $tmp = explode("-", $del);
         if($tmp[1]) {
                      $out = $db->query("DELETE FROM roomsdb.extra_history WHERE extension='$tmp[0]' and date=FROM_UNIXTIME($tmp[1])");
                      if (@DB::isError($out)) $error = 1;
                    }
       }

      }
      if($number)
      {
       $extras = sql ("SELECT name,price,code from roomsdb.extra where id='$id'","getAll");
       foreach($extras as $extra)
       {
        $res = $db->query("INSERT INTO roomsdb.extra_history (extension,id,date,name,price,number) VALUES ('$ext','$id',now(),'$extra[0]','$extra[1]','$number')");
        fias('MINIBAR2PMS', array(
            'DA' => date('ymd'),
            'TI' => date('His'),
            'RN' => $ext,
	    'TA' => $extra[1]*$number,
	    'MA' => $extra[2],
            'M#' => $number
            )
        );
        if (@DB::isError($res)) $error = 1;
       }
      }

      if ($error==1) return false;
      else return true;
}

function getReport($ext,$start="",$end="")
{
  global $db;
  if($start && $end) {
      $results = sql("SELECT date_format(calldate,'%d/%m/%Y %H:%i') as calldate,dst,billsec from asteriskcdrdb.cdr where accountcode='$ext' and disposition='ANSWERED' and billsec!=0 and calldate >= from_unixtime('$start') and calldate <= from_unixtime('$end')","getAll");
      $extras = sql ("SELECT date_format(date,'%d/%m/%Y %H:%i') as date,name,number,price from roomsdb.extra_history where extension='$ext' and date >= from_unixtime('$start') and date <= from_unixtime('$end')","getAll");
  }
  else {
      $results = sql("SELECT date_format(calldate,'%d/%m/%Y %H:%i') as calldate,dst,billsec from asteriskcdrdb.cdr join roomsdb.rooms on cdr.accountcode=roomsdb.rooms.extension where accountcode='$ext' and disposition='ANSWERED' and billsec!=0 and calldate >= roomsdb.rooms.start","getAll");

      $extras = sql ("SELECT date_format(date,'%d/%m/%Y %H:%i') as date,name,number,price from roomsdb.extra_history where extension='$ext' and checkout!='1'","getAll");
  }
  if (count($results)>0)
  {
    echo "<tr><th>". _("Date and time")."</th><th>". _("Destination")."</th><th>". _("Duration (sec)")."</th><th>". _("Billable (sec)")."</th><th>". _("Cost (€)")."</th></tr>";

    $tot_billsec = 0;
    $tot_amount = 0;
    $i=0;
    $rates = getAllRates();
    $options = getOptions();
    foreach($results as $result)
    {
      $amount = 0;
      $billsec = 0;
      $ticks = 0;

      $altrow='';
      if($i%2)
        $altrow=' class="altrow" ';

      $dst_n= substr($result[1],count($options['prefix']));
      $dst = $result[1];
      if(strlen($dst)>5) $dst=substr($dst, 0, -4)."XXXX";
      if(!isInternalCall($result[1]))
      {
	$rate = findRate($dst_n,$rates);
	if($rate)
	{
	  $dst .= ' ('.$rate['name'].')';
	  $duration = (int)$rate['duration'];
	  $price = (float)$rate['price'];
	  $answer_duration = (int)$rate['answer_duration'];
	  $answer_price = (float)$rate['answer_price'];
	}
        else continue;


	$secs = $result[2];
	if($secs > $answer_duration) //se la durata e' maggiore del singolo scatto, faccio il calcolo completo
	{
	  $billsec = $secs - $answer_duration; //tolgo la durata dello scatto alla risposta
          if ($duration == 0) {
              $ticks = 0;
          } else {
              $ticks = floor($billsec/$duration);
          }
          if ($billsec % $duration) {
              $ticks++;
          }
	  $amount = ($answer_price+($ticks*$price))/100; //converto da centesimi a euro
	}
	else //altrimenti aggiungo solo lo scatto alla risposta
	{
	  $billsec = $sec;
	  $amount = $answer_price/100; //converto da centesimi a euro

	}
      }
      else
      {
        $amount = 0;
        $billsec = 0;
      }


      echo "<tr $altrow><td>$result[0]</td><td>$dst</td><td>$result[2]</td><td>$billsec ($ticks ". _("ticks").")</td><td>".number_format($amount,"2",",",".")."</td></tr>\n";
      $tot_billsec += $result[2];
      $tot_amount += $amount;
      $i++;
    }
    echo "<tr><th colspan='4'  style='border-top: 1px solid #CCCCCC;'>". _("Total duration: ")."</th><th style='border-top: 1px solid #CCCCCC;'>$tot_billsec ". _("seconds")."</th></tr>";
    echo "<tr style='border-top: 1px solid #eee;'><th colspan='4'>". _("Total cost calls: ")."</th><th>".number_format($tot_amount,"2",",",".")." €</th></tr>";
  }

  else
     echo "<tr><td>". _("No call for this room. ")."</td></tr>";//Nessuna chiamata per questa camera.

  if (count($extras)>0)
  {
    echo "<tr><th colspan='5' style='border-top: 1px solid #CCCCCC;'></th></tr>";
    echo "<tr><th colspan='5' style='border-top: 1px solid #CCCCCC;'></th></tr>";
    echo "<tr><th colspan='5' style='border-top: 1px solid #CCCCCC;'></th></tr>";
    echo "<tr><th colspan='5' style='border-top: 1px solid #CCCCCC;'>Extra</th></tr>";
    echo "<tr><th>". _("Date and time")."</th><th>". _("Name")."</th><th>". _("Unit cost")."</th><th>". _("Number ")."</th><th>". _("Total cost")."</th></tr>";

    $extra_amount = 0;
    $tot= 0;
    $value= 0;
    $i=0;
    foreach($extras as $extra)
    {
      $altrow='';
      if($i%2)
      $altrow=' class="altrow" ';
      $value=$extra[2]*$extra[3];
      echo "<tr $altrow><td>$extra[0]</td><td>$extra[1]</td><td>$extra[3]</td><td>$extra[2]</td><td>".number_format($value,"2",",",".")." </td></tr>\n";
      $extra_amount += $value;
      $i++;
    }
    echo "<tr><th colspan='4'  style='border-top: 1px solid #CCCCCC;'>". _("Total cost extra: ")."</th><th style='border-top: 1px solid #CCCCCC;'>".number_format($extra_amount,"2",",",".")."</th></tr>";
    $tot=$extra_amount+$tot_amount; //Costo extra totale:
    echo "<tr><th colspan='5' style='border-top: 1px solid #CCCCCC;'></th></tr>";
    echo "<tr><th colspan='5' style='border-top: 1px solid #CCCCCC;'></th></tr>";
    echo "<tr><th colspan='5' style='border-top: 1px solid #CCCCCC;'></th></tr>";
    echo "<tr style='border-top: 1px solid #eee;'><th colspan='4'>". _("Total cost: ")."</th><th>".number_format($tot,"2",",",".")." </th></tr>";
  }
  else
     echo "<tr><td colspan='5'>". _("None extra for this room.")."</td></tr>"; //Nessuna extra per questa camera.
}


function getTotalCost($ext)
{
  global $db;
      $results = sql("SELECT date_format(calldate,'%d/%m/%Y %H:%i') as calldate,dst,billsec from asteriskcdrdb.cdr join roomsdb.rooms on cdr.accountcode=roomsdb.rooms.extension where accountcode='$ext' and disposition='ANSWERED' and billsec!=0 and calldate >= roomsdb.rooms.start","getAll");

      $extras = sql ("SELECT date_format(date,'%d/%m/%Y %H:%i') as date,name,number,price from roomsdb.extra_history where extension='$ext' and checkout!='1'","getAll");

  if (count($results)>0)
  {
    $tot_billsec = 0;
    $tot_amount = 0;
    $i=0;
    $rates = getAllRates();
    $options = getOptions();
    foreach($results as $result)
    {
      $amount = 0;
      $billsec = 0;
      $ticks = 0;

      $dst_n= substr($result[1],count($options['prefix']));
      $dst = $result[1];
      if(strlen($dst)>5) $dst=substr($dst, 0, -4)."XXXX";
      if(!isInternalCall($result[1]))
      {
	$rate = findRate($dst_n,$rates);
	if($rate)
	{
	  $dst .= ' ('.$rate['name'].')';
	  $duration = (int)$rate['duration'];
	  $price = (float)$rate['price'];
	  $answer_duration = (int)$rate['answer_duration'];
	  $answer_price = (float)$rate['answer_price'];
	}
        else continue;


	$secs = $result[2];
	if($secs > $answer_duration) //se la durata e' maggiore del singolo scatto, faccio il calcolo completo
	{
	  $billsec = $secs - $answer_duration; //tolgo la durata dello scatto alla risposta
	  $ticks = floor($billsec/$duration);
	  if($billsec % $duration)
	  $ticks++;
	  $amount = ($answer_price+($ticks*$price))/100; //converto da centesimi a euro
	}
	else //altrimenti aggiungo solo lo scatto alla risposta
	{
	  $billsec = $sec;
	  $amount = $answer_price/100; //converto da centesimi a euro

	}
      }
      else
      {
        $amount = 0;
        $billsec = 0;
      }

      $tot_billsec += $result[2];
      $tot_amount += $amount;
      $i++;
    }
  }
  else
     $tot_amount= 0;

  if (count($extras)>0)
  {
    $extra_amount = 0;
    $tot= 0;
    $value= 0;
    foreach($extras as $extra)
    {
      $value=$extra[2]*$extra[3];
      $extra_amount += $value;
    }
    $tot=$extra_amount+$tot_amount;
  }
  else
    $tot=$extra_amount+$tot_amount;


  return $tot;
}

function assignExtra($tot,$ext)
{
  global $db;
      $res = $db->query("INSERT INTO roomsdb.extra_history (extension,id,date,name,price,number) VALUES ('$ext','9999',now(),'Cabina','$tot','1')");

      if (@DB::isError($res))
      return false;
      else
      return true;
}


function getList($query)
{
  global $db;
  $list = array();
  $results = sql($query,"getAll");

  foreach($results as $result)
    $list[] = array($result[0],$result[1]);

  return $list;

}

function getDisabledRoomList()
{
  return getList("SELECT id,data FROM asterisk.sip WHERE keyword='context' AND data='".ROOMS_CONTEXT."' AND id NOT IN (SELECT extension FROM roomsdb.rooms)");
}

function getHotelCodes()
{
  $ret = sql("SELECT if(customcode='',defaultcode,customcode) as code, featurename as name from featurecodes where (modulename='nethhotel' or modulename='donotdisturb') and featurename in ('extra','configalarm','cleanroom','dnd_on','dnd_off','dnd_toggle','inspected_occupied','inspected_vacant')","getAll",DB_FETCHMODE_ASSOC);

  if(count($ret))
    return $ret;
  else
    return array();
}

function getEnabledRoomList()
{
  return getList("SELECT extension,date_format(start, '%d-%m-%Y %H:%i') as start FROM roomsdb.rooms JOIN asterisk.sip ON asterisk.sip.id=roomsdb.rooms.extension WHERE keyword='context' AND data='".ROOMS_CONTEXT."'");
}

function getRoomList()
{
  global $db;
  $group= array();
  $host= array();
  $results = sql("SELECT id,data,start,`group`,clean,text,lang FROM asterisk.sip left join roomsdb.rooms on extension=id  WHERE keyword='context' AND data='".ROOMS_CONTEXT."' order by id","getAll");
  $callgroups = sql("SELECT id,data from asterisk.sip where keyword='namedcallgroup'","getAll");


## metto in un array i callgroup di tutti gli interni del centralino

  foreach($callgroups as $callgroup) {
        $group[$callgroup[0]]=$callgroup[1];
   }

## Aggiungo callgroup all'array camere
  foreach($results as $result) {

        // $result["7"] is the room language. It has been added in this manner
        // to not change the existing code that use $result["6"] element
        $result["7"]=$result["6"];
        $result["6"]=$group[$result["0"]];
        if (!isset($result["7"]))
            $result["7"] = "en";
        $host[]=$result;
     }
  return $host;

}

// get value of variable="reception_lang" from roomsdb.options
// It is the language used for audio messages to be listened from the reception
function getReceptionAudioLang()
{
  global $db;
  $results = sql("SELECT value FROM roomsdb.options WHERE variable=\"reception_lang\"","getAll");
  $lang=$results[0][0];
  if (!isset($lang))
    $lang = "en";

  return $lang;
}

function getExtraList()
{
  global $db;
  return sql("SELECT * FROM roomsdb.extra ORDER BY name","getAll",DB_FETCHMODE_ASSOC);
}

function getGroupList()
{
  global $db;
  return sql("SELECT * FROM roomsdb.room_groups ORDER BY name","getAll",DB_FETCHMODE_ASSOC);
}

function isInternalCall($numtocall)
{
  $options = getOptions();
  return ($numtocall[0] != $options['prefix']);
}

function getOptions()
{
  global $db;
  $opts = array();
  $results = sql("SELECT * FROM roomsdb.options","getAll");

  foreach($results as $result)
    $opts[$result[0]] = $result[1];

  return $opts;

}

function saveOptions($prefix,$ext_pattern,$internal_call,$groupcalls,$externalcalls,$internal_call_nocheckin,$reception,$enableclean,$clean,$reception_lang="en")
{
  global $db;
  $db->query("DELETE FROM roomsdb.options WHERE variable='prefix' OR variable='ext_pattern' OR variable='internal_call' OR variable='enableclean' OR variable='groupcalls' OR variable='externalcalls' OR variable='internal_call_nocheckin' OR variable='reception' OR variable='clean' OR variable='reception_lang'");
  $qry = "REPLACE INTO roomsdb.options (variable,value) VALUES ('prefix','$prefix')";
  $res = $db->query($qry);
  $qry = "REPLACE INTO roomsdb.options (variable,value) VALUES ('ext_pattern','$ext_pattern')";
  $res2 = $db->query($qry);

  if($internal_call=='true')
    $internal_call='1';
  else
    $internal_call='0';

  $qry = "REPLACE INTO roomsdb.options (variable,value) VALUES ('internal_call','$internal_call')";
  $res3 = $db->query($qry);

  if($groupcalls=='true')
    $groupcalls='1';
  else
    $groupcalls='0';

  $qry = "REPLACE INTO roomsdb.options (variable,value) VALUES ('groupcalls','$groupcalls')";
  $res9 = $db->query($qry);

  if($externalcalls=='true')
    $externalcalls='1';
  else
    $externalcalls='0';

  $qry = "REPLACE INTO roomsdb.options (variable,value) VALUES ('externalcalls','$externalcalls')";
  $res10= $db->query($qry);

  if($internal_call_nocheckin=='true')
    $internal_call_nocheckin='1';
  else
    $internal_call_nocheckin='0';

  $qry = "REPLACE INTO roomsdb.options (variable,value) VALUES ('internal_call_nocheckin','$internal_call_nocheckin')";
  $res4 = $db->query($qry);

  $qry = "REPLACE INTO roomsdb.options (variable,value) VALUES ('reception','$reception')";
  $res5 = $db->query($qry);

  if($enableclean=='true')
    $enableclean='1';
  else
    $enableclean='0';
  $db->query("DELETE FROM roomsdb.options WHERE variable = 'enableclean'");
  $qry = "REPLACE INTO roomsdb.options (variable,value) VALUES ('enableclean','$enableclean')";
  $res6 = $db->query($qry);

  if($clean=='true')
    $clean='1';
  else
    $clean='0';
  $qry = "REPLACE INTO roomsdb.options (variable,value) VALUES ('clean','$clean')";
  $res7 = $db->query($qry);

  $qry = "REPLACE INTO roomsdb.options (variable,value) VALUES ('reception_lang','$reception_lang')";
  $res8 = $db->query($qry);

  if (@DB::isError($res) || @DB::isError($res2) || @DB::isError($res3) || @DB::isError($res4) || @DB::isError($res5) || @DB::isError($res6) || @DB::isError($res7)|| @DB::isError($res8) || @DB::isError($res9)|| @DB::isError($res10))
    return false;
  else
    return true;
}

function setRoomLang($ext, $lang)
{
  global $db;
  $res = $db->query("UPDATE roomsdb.rooms SET lang=\"$lang\" where extension=\"$ext\"");

  if (@DB::isError($res))
    return false;
  else
    return true;
}

function checkCost($ext)
{
    $call = sql("SELECT date_format(calldate,'%d/%m/%Y %H:%i') as calldate,dst,billsec from asteriskcdrdb.cdr join roomsdb.rooms on cdr.accountcode=roomsdb.rooms.extension where accountcode='$ext' and disposition='ANSWERED' and billsec!=0 and calldate >= roomsdb.rooms.start","getAll");
    $extra = sql ("SELECT date_format(date,'%d/%m/%Y %H:%i') as date,name,number,price from roomsdb.extra_history where extension='$ext' and checkout!='1'","getAll");

    if (count($call)>0 || count($extra)>0)
        return true;
    else
        return false;
}


function externalCheckIn($room, $reservation='', $name='',$language='')
{
    global $db;
    $res = $db->query('DELETE IGNORE FROM roomsdb.options WHERE `variable`="needReload"');
    $res = $db->query('INSERT INTO roomsdb.options SET `variable`="needReload",`value`="true"');
    $res = $db->getRow('SELECT * FROM roomsdb.rooms WHERE extension='.$room, DB_FETCHMODE_ASSOC);
    if (DB::IsError($res)) {
	//log error here
	nethhotel_log ($res->getMessage(),__FUNCTION__);
	return false;
    }
    if (!empty($res)){
	//room is already in database
	if ($res['clean'] == 1)
            nethhotel_log ("Forcing check-in for dirty room ".$room,__FUNCTION__ );
	else
	    nethhotel_log ("Forcing check-in for already checked in room ".$room,__FUNCTION__ );
	$res = sql("SELECT start from roomsdb.rooms WHERE extension=$room","getRow");
	if (@DB::IsError($res)) {
            //log error here
            nethhotel_log ($res->getMessage(),__FUNCTION__);
        }
  	$res = $db->query("INSERT INTO roomsdb.history (extension,start,end) VALUES ($room,'$res[0]',now())");
        if (@DB::IsError($res)) {
            nethhotel_log ($res->getMessage(),__FUNCTION__);
        }
  	$res = $db->query("UPDATE roomsdb.extra_history SET checkout='1' WHERE extension=$room");
        if (@DB::IsError($res)) {
            nethhotel_log ($res->getMessage(),__FUNCTION__);
        }
  	$res = $db->query("DELETE FROM roomsdb.alarms WHERE extension=$room");
        if (@DB::IsError($res)) {
            nethhotel_log ($res->getMessage(),__FUNCTION__);
        }
	$res = $db->query("DELETE FROM roomsdb.rooms WHERE extension=$room");
	if (@DB::IsError($res)) {
            //log error here
            nethhotel_log ($res->getMessage(),__FUNCTION__);
        }
    }
    return _checkIn($room, $reservation, $name,$language);
}

function _checkIn($room,$reservation='', $name='',$language='')
{
  global $db;
  global $astman;
  if($language=='') $language= getReceptionAudioLang();
  if ($astman) {
  $cidname = (empty($name) ? "Room $room" : "<$room> ".$db->escapeSimple($name));
  $astman->database_put("AMPUSER",$room."/cidname",$cidname);
  } else {
    nethhotel_log ("Astman failed",__FUNCTION__);
    return false;
  }
  $sql="INSERT INTO roomsdb.rooms SET extension=?,start=now(),text=?,lang=?";
  try {
        $sth = $db->prepare($sql);
        $sth->execute(array($room,$name,$language));
  } catch (Exception $e){
        nethhotel_log (__FUNCTION__." Error during $room checkin: ".$e->getMessage());
        return false;
  }
  nethhotel_log ("check-in room $room, reservation \"$reservation\", name \"$name\", language \"$language\"",__FUNCTION__);
  return true;
}

function checkIn($room,$reservation='', $name='',$language='')
{
    if (_checkIn($room,$reservation, $name,$language)){
        //fias feedback
        fias('RE2PMS', array(
            'RN' => $room,
            'RS' => 4
            )
        );
        return true;
    }else{
        return false;
    }
}

function externalCheckOut($room)
{
    global $db;
    $res = $db->query('DELETE IGNORE FROM roomsdb.options WHERE `variable`="needReload"');
    $res = $db->query('INSERT INTO roomsdb.options SET `variable`="needReload",`value`="true"');
    return _checkOut($room);
}

function checkOut($room)
{
    if (_checkOut($room)){
        //fias feedback
        fias('RE2PMS', array(
            'RN' => $room,
            'RS' => 1
            )
        );
        return true;
    }else{
        return false;
    }
}

function _checkOut($room)
{
  global $db;
  global $astman;

  try {
        $sql = "SELECT start from roomsdb.rooms WHERE extension=?";
        $sth = $db->prepare($sql);
        $sth->execute(array($room));
        $start = $sth->fetchAll()[0][0];
        $sql = "INSERT IGNORE INTO roomsdb.history (extension,start,end) VALUES (?,?,now())";
        $sth = $db->prepare($sql);
        $sth->execute(array($room,$start));
        if ($astman) {
                $astman->database_put("AMPUSER",$room."/cidname","Room $room");
        } else {
                nethhotel_log ("Astman failed",__FUNCTION__);
        }
        $sql = "UPDATE roomsdb.rooms SET clean='1',text='' WHERE extension=?";
        $sth = $db->prepare($sql);
        $sth->execute(array($room));
        $sql = "UPDATE roomsdb.extra_history SET checkout='1' WHERE extension=?";
        $sth = $db->prepare($sql);
        $sth->execute(array($room));
        $sql = "DELETE FROM roomsdb.alarms WHERE extension=?";
        $sth = $db->prepare($sql);
        $sth->execute(array($room));
        //Clean room automatically if enableclean option isn't selected
        $options = getOptions();
        if (isset($options['enableclean']) && $options['enableclean']==0) _cleanRoom($room);
        nethhotel_log ("check-out room $room",__FUNCTION__);
        return true;
  } catch (Exception $e){
        nethhotel_log("Error during checkout of room $room: " . $e->getMessage(),__FUNCTION__);
        return false;
  }
}

function externalCleanRoom($room)
{
    global $db;
    $res = $db->query('DELETE IGNORE FROM roomsdb.options WHERE `variable`="needReload"');
    $res = $db->query('INSERT INTO roomsdb.options SET `variable`="needReload",`value`="true"');
    return _cleanRoom($room);
}

function cleanRoom($room)
{
    global $db;
    /*
    FIAS feedback is sent BEFORE actually cleaning the room, because PMS status is more important than NethHotel one,
    and if something in NethHotel fails, room should be considered clean from PMS in any case.
    */
    //fias feedback
    fias('RE2PMS', array(
        'RN' => $room,
        'RS' => 4
        )
    );
    /*Clean room on neth-hotel only if it is in checkout and need to be cleand. Refs #3982*/
    $res = $db->getOne("SELECT clean FROM roomsdb.rooms WHERE extension=$room");
    if ($res == 1) {
        /*room checkout and free*/
        fias('RE2PMS', array(
            'RN' => $room,
            'RS' => 3
            )
        );
        return _cleanRoom($room);
    } else {
        /*room still in check in*/
        fias('RE2PMS', array(
            'RN' => $room,
            'RS' => 4
            )
        );
        return true;
    }
}

function _cleanRoom($room)
{
  global $db;
  $res = $db->query("DELETE FROM roomsdb.rooms WHERE extension=$room");
  if (@DB::isError($res))
  {
    nethhotel_log ($res->getMessage(),__FUNCTION__);
    return false;
  }else{
    nethhotel_log ("clean room $room",__FUNCTION__);
    return true;
  }
}


function getGroupName($extension)
{
  global $db;
  //get group id
  $gid = sql("SELECT group_id FROM roomsdb.groups_rooms WHERE extension = $extension LIMIT 1","getOne");
  if (empty($gid)) return _("No Group");
  $res = sql("SELECT name from roomsdb.room_groups WHERE id=$gid","getRow");
  return $res[0];
}

function setGroup($ext,$group)
{
  global $db;
  nethhotel_log ("$ext $group");
  $sql = "DELETE FROM roomsdb.groups_rooms WHERE `extension` = ".$db->escapeSimple($ext);
  $res = $db->query($sql);
  if (@DB::IsError($res)) {
      nethhotel_log ($sql." ".$res->getMessage(),__FUNCTION__);
      die($sql." ".$res->getMessage());
  }
  if ($group>0){
      $sql = "INSERT INTO roomsdb.groups_rooms SET `group_id` = ".$db->escapeSimple($group).", `extension` = ".$db->escapeSimple($ext);
      $res = $db->query($sql);
      if (@DB::IsError($res)) {
          nethhotel_log ($sql." ".$res->getMessage(),__FUNCTION__);
          die($sql." ".$res->getMessage());
      }
      nethhotel_log ("Added room $ext to group $group");
  } else {
      nethhotel_log ("Removed room $ext from groups");
  }
  return true;
}


function getHistory($start='',$to='',$ext='')
{
  global $db;
  $where = "";

  if($start)
  {
     $tmp = explode("/",$start);
     $where.=" AND start>='$tmp[2]-$tmp[1]-$tmp[0]' "; //formato data: Y-m-d
  }
  if($end)
  {
     $tmp = explode("/",$end);
     $where.=" AND end<='$tmp[2]-$tmp[1]-$tmp[0]' ";
  }
  if($ext)
     $where.=" AND extension=$ext ";

  $results = sql("SELECT extension,date_format(start,'%d/%m/%Y %H:%i') as start,date_format(end,'%d/%m/%Y %H:%i') as end, unix_timestamp(start), unix_timestamp(end) FROM roomsdb.history WHERE true $where","getAll");


  echo "<table><tbody id='history'>";
  if (count($results)>0)
  {
    echo "<tr><th>". _("Room")."</th><th>Check-in</th><th>Check-out</th><th>". _("Actions")."</th></tr>";
    $i=0;
    foreach($results as $result)
    {
      $altrow=0;
      if($i%2)
        $altrow=' class="altrow" ';

      echo "<tr $altrow id='tr$result[0]' $altrow><td>$result[0]</td><td>$result[1]</td><td>$result[2]</td><td><a href='#ajax-report-$result[0]-$result[3]-$result[4]' ><img src='images/show.png' title='Visualizza report' label='Visualizza report'/></a></td></tr>\n";
      $i++;
    }

  }
  else
     echo "<tr><td>". _("No historic present.")."</td></tr>";//Nessuno storico presente.
  echo "</tbody></table>";
}

function isAlarmEnabled($ext,$alarms)
{
  if(!$alarms || count($alarms) == 0)
    return false;
  else
    return  in_array($ext,$alarms);
}

/*
* This function display groups page
*/
function loadGroups(){
    global $db;

    //TODO draw contourn
    //Read all available groups
    $sql = "SELECT * FROM roomsdb.room_groups";
    $res = sql($sql,"getAll");
    if (@DB::IsError($res)) {
        nethhotel_log ($sql." ".$res->getMessage(),__FUNCTION__);
        die($sql." ".$res->getMessage());
    }
    $groups = $res;
    $out = '<h3 style="clear: both">'._("Groups").'</h3>
        <div style="padding: 10px;">';

    //Draw groups
    foreach ($groups as $group){
        //Get group status (check-in/check-out/clean)
        $class = '';
        $needclean = false;
        $group_id = $group[0];
        $sql = "SELECT extension FROM roomsdb.groups_rooms WHERE group_id = ".$db->escapeSimple($group_id);
        $rooms = $db->getAll($sql,DB_FETCHMODE_ASSOC);
        if (@DB::IsError($rooms)) {
            nethhotel_log ($sql." ".$rooms->getMessage(),__FUNCTION__);
            die($sql." ".$rooms->getMessage());
        }
        if (empty($rooms))
        {
            //empty group
            $class .= ' empty-group ';
        } else {
            //there are rooms in this group
            $rooms_checkin = '';
            $rooms_clean = '';
            foreach ($rooms as $room){
                $sql = "SELECT * from roomsdb.rooms WHERE  extension = ".$db->escapeSimple($room['extension']);
                $res = $db->getRow($sql,DB_FETCHMODE_ASSOC);
                if (@DB::IsError($res)) {
                    nethhotel_log ($sql." ".$res->getMessage(),__FUNCTION__);
                    die($sql." ".$res->getMessage());
                }
                if (empty($res))
                {
                    //room is in check-out/cleanstate
                    if ($rooms_checkin === '') $rooms_checkin = 'checkout';
                    if ($rooms_checkin === 'checkin') $rooms_checkin = 'mixed';
                    if ($rooms_clean === 'dirty') $rooms_clean = 'mixed';
                    if ($rooms_clean === '') $rooms_clean = 'clean';
                } elseif ($res['clean'] === '0'){
                    //room is in check-in
                    if ($rooms_checkin === '') $rooms_checkin = 'checkin';
                    if ($rooms_checkin === 'checkout') $rooms_checkin = 'mixed';
                } elseif ($res['clean'] === '1'){
                    //room is in check-out/dirty
                    if ($rooms_checkin === '') $rooms_checkin = 'checkout';
                    if ($rooms_checkin === 'checkin') $rooms_checkin = 'mixed';
                    $needclean = true;
                }
            }
            if ($rooms_checkin === 'checkin') $class .= ' checkingroup ';
            if ($rooms_checkin === 'mixed') $class .= ' mixedcheckingroup ';
            if ($rooms_checkin === 'checkout' && $needclean)
                $class .= ' needcleangroup ';
            elseif ($rooms_checkin === 'checkout') $class .= ' checkoutgroup ';
        }
        $out .= "<div class='group $class' id='$group[0]'>";
        $out .= "<h3 style='margin-top: -10px'>$group[1]</h3>";

        /* Alarms */
        $out .= "<div class='groupactions' style='color: #000; font-size: 90%'><hr/><a href='#'><img class='action edit-group-alarm' data-group-id='$group[0]' src='images/edit-alarm.png' title='";
        $out .= sprintf(_("Edit group %s alarms"),$group[1]);
        $out .= "' label='";
        $out .= sprintf(_("Edit group %s alarms"),$group[1]);
        $out .= "'/></a>  <a href='#' ><img class='action delete-group-alarm' data-group-id='$group[0]' src='images/disable-alarm.png' title='";
        $out .= sprintf(_("Delete group %s alarms"),$group[1]);
        $out .= "' label='";
        $out .= sprintf(_("Delete group %s alarms"),$group[1]);
        $out .= "'/></a>";

        /* TODO Add costs report*/
        $out .= "<hr/>";
        /* Add clean button */
        $options = getOptions();
        if (isset($options['enableclean']) && $options['enableclean']==1 && $needclean){
            $out .= "<a href='#'><img class='action clean-group' data-group-id='$group[0]' src='images/clean.png' title='";
            $out .= sprintf(_("Clean group %s"),$group[1]);
            $out .= "' label='";
            $out .= sprintf(_("Clean group %s"),$group[1]);
            $out .= "'/></a>";
        }
        /* Add checkout*/
        $out .= "<a href='#'><img class='action check-out-group' data-group-id='$group[0]' src='images/check-out.png' title='";
        $out .= sprintf(_("Check Out group %s"),$group[1]);
        $out .= "' label='";
        $out .= sprintf(_("Check Out group %s"),$group[1]);
        $out .= "'/></a>";
        /* Add checkin*/
        $out .= "<a href='#'><img class='action check-in-group' data-group-id='$group[0]' src='images/check-in.png' title='";
        $out .= sprintf(_("Check In group %s"),$group[1]);
        $out .= "' label='";
        $out .= sprintf(_("Check In group %s"),$group[1]);
        $out .= "'/></a></div>";
        /* TODO Add language selector*/
        /*edit*/
        $out .= "<div class='groupactions'>";
        $out .= "  <div id='edit-group'>";
        $out .= "  <a href='#'><img class='action edit-group-img' data-group-id='$group[0]' src='images/group.png' title='".sprintf(_("Edit group %s"),$group[1])."' label='".sprintf(_("Edit group %s"),$group[1])."'/></a>";
        $out .= "  </div>";
        /*Remove group*/
        $out .= "  <div id='delete-group'>";
        $out .= "  <a href='#'><img class='action delete-group-img' data-group-id='$group[0]' src='images/disable.png' title='".sprintf(_("Delete group %s"),$group[1])."' label='".sprintf(_("Delete group %s"),$group[1])."'/></a>";
        $out .= "  </div>";
        $out .= "</div>";
        $out .= "</div>";

    }
    /*Add new group button*/
    $out .= "<div id='add-new-group'>";
    $out .= "<img class='action' id='add-new-group-img' src='images/add.png' title='"._("Add a new group")."' label='"._("Add a new group")."'/>";
    $out .= "</div>";
    return $out;
}

/*Group Action Dialogs*/
function setAlarmGroupDialog($group_id){
    $out .= '<div data-group-id='.$group_id.' id="setAlarmGroupDialog" title="'._('Group Alarms').'">';
    $out .= '
<form>
        <p style="margin-top: 10px; margin-bottom: 10px;">'._("Enter the time for the alarm in the format hh:mm.").'</p>
        <label for="hour">'._("Hour ").'</label>
        <input type="text" name="hour" size="6" id="hour" class="text ui-widget-content ui-corner-all" />
        <br/><br/>
        <label for="start">'._("Day ").'</label><input type="text" name="start" size="10" id="start" class="text ui-widget-content ui-corner-all"><br/><br/>
        <label for="alarmRepeat">'._("Repeat ").'</label> <input type="checkbox" name="alarmRepeat" id="alarmRepeat"/>
        <div id="interval" style="display: none">
            <p style="margin-top: 5px; margin-left: 5px;">'._(" for  ").'<input type="text" size="2" name="days" id="days" value="1" class="text ui-widget-content ui-corner-all" />'._(" day ").'</p>
        </div>
</form>';


    $out .= '</div>';
    return $out;
}
function deleteAlarmGroupDialog($group_id){
    $out .= '<div data-group-id='.$group_id.' id="deleteAlarmGroupDialog" title="'._('Group Alarms').'">';
    $out .= '<span class="ui-icon ui-icon-alert" style="float:left; margin:0 7px 20px 0;"></span>';
    $out .= _('Delete all group alarms?');
    $out .= '</div>';
    return $out;
}
function checkInGroupDialog($group_id){
    global $supported_audio_langs;
    $options = getOptions();
    $out .= '<div data-group-id='.$group_id.' id="checkInGroupDialog" title="'._('Group Check In').'">';
    $out .= '<span class="ui-icon ui-icon-alert" style="float:left; margin:0 7px 20px 0;"></span>';
    $out .= _('Do Check In for all rooms in group?');
    $out .= '<div></br><p>'._("Customer language").'</p>';
    $out .= '<select id="customer_lang">';
    foreach ($supported_audio_langs as $lang) {
        $selected='';
        if ($options['reception_lang'] == $lang) {
            $selected = 'selected';
        }
        $out .= '<option value="'.$lang.'" '.$selected.'>'.$lang.'</option>';
    }
    $out .= '</select></div>';
    $out .= '</div>';
    return $out;
}
function checkOutGroupDialog($group_id){
    $out .= '<div data-group-id='.$group_id.' id="checkOutGroupDialog" title="'._('Group Check Out').'">';
    $out .= '<span class="ui-icon ui-icon-alert" style="float:left; margin:0 7px 20px 0;"></span>';
    $out .= _('Do Check Out for all rooms in group?');
    $out .= '</div>';
    return $out;
}
function cleanGroupDialog($group_id){
    $out .= '<div data-group-id='.$group_id.' id="cleanGroupDialog" title="'._('Group Clean').'">';
    $out .= '<span class="ui-icon ui-icon-alert" style="float:left; margin:0 7px 20px 0;"></span>';
    $out .= _('Clean all rooms?');
    $out .= '</div>';
    return $out;
}

/*Group Action Exec*/
function setAlarmGroup($group_id,$hour,$date,$days){
    global $db;
    nethhotel_log($group_id,__FUNCTION__);
    $sql = "SELECT extension FROM roomsdb.groups_rooms WHERE group_id = ".$db->escapeSimple($group_id);
    $rooms = $db->getAll($sql,DB_FETCHMODE_ASSOC);
    if (@DB::IsError($rooms)) {
        nethhotel_log ($sql." ".$rooms->getMessage(),__FUNCTION__);
        die($sql." ".$rooms->getMessage());
    }
    foreach ($rooms as $room){
        editAlarm($room['extension'],$hour,1,$date,$days);
    }
    return $ret;
}
function deleteAlarmGroup($group_id){
    global $db;
    nethhotel_log($group_id,__FUNCTION__);
    $sql = "SELECT extension FROM roomsdb.groups_rooms WHERE group_id = ".$db->escapeSimple($group_id);
    $rooms = $db->getAll($sql,DB_FETCHMODE_ASSOC);
    if (@DB::IsError($rooms)) {
        nethhotel_log ($sql." ".$rooms->getMessage(),__FUNCTION__);
        die($sql." ".$rooms->getMessage());
    }

    foreach ($rooms as $room){
        deleteAlarm($room['extension']);
    }
    return $true;
}
function checkInGroup($group_id,$lang){
    global $db;
    nethhotel_log($group_id." ".$lang,__FUNCTION__);
    $sql = "SELECT extension FROM roomsdb.groups_rooms WHERE group_id = ".$db->escapeSimple($group_id);
    $rooms = $db->getAll($sql,DB_FETCHMODE_ASSOC);
    if (@DB::IsError($rooms)) {
        nethhotel_log ($sql." ".$rooms->getMessage(),__FUNCTION__);
        die($sql." ".$rooms->getMessage());
    }
    $group_name = $db->getOne("SELECT name from roomsdb.room_groups WHERE id = ".$db->escapeSimple($group_id));
    foreach ($rooms as $room){
        externalCheckIn($room['extension'], '', $group_name,$lang);
    }
    return $true;
}
function checkOutGroup($group_id){
    global $db;
    nethhotel_log($group_id,__FUNCTION__);
    $sql = "SELECT extension FROM roomsdb.groups_rooms WHERE group_id = ".$db->escapeSimple($group_id);
    $rooms = $db->getAll($sql,DB_FETCHMODE_ASSOC);
    if (@DB::IsError($rooms)) {
        nethhotel_log ($sql." ".$rooms->getMessage(),__FUNCTION__);
        die($sql." ".$rooms->getMessage());
    }
    foreach ($rooms as $room){
        externalCheckOut($room['extension']);
    }
    return $true;
}
function cleanGroup($group_id){
    global $db;
    nethhotel_log($group_id,__FUNCTION__);
    $sql = "SELECT extension FROM roomsdb.groups_rooms WHERE group_id = ".$db->escapeSimple($group_id);
    $rooms = $db->getAll($sql,DB_FETCHMODE_ASSOC);
    if (@DB::IsError($rooms)) {
        nethhotel_log ($sql." ".$rooms->getMessage(),__FUNCTION__);
        die($sql." ".$rooms->getMessage());
    }
    foreach ($rooms as $room){
        cleanRoom($room['extension']);
    }
    return $true;
}

function getGroupOptions($extension){
    global $db;
    $sql = "SELECT group_id from roomsdb.groups_rooms WHERE extension = ".$db->escapeSimple($extension);
    $group_id = $db->getOne($sql);
    if (@DB::IsError($group_id)){
        nethhotel_log ($sql." ".$group_id->getMessage(),__FUNCTION__);
        die($sql." ".$group_id->getMessage());
    }
    if (empty($group_id)) return array(); //No group
    $sql = "SELECT * FROM roomsdb.room_groups WHERE id = $group_id";
    $res = $db->getRow($sql,DB_FETCHMODE_ASSOC);
    if (@DB::IsError($res)) {
        nethhotel_log ($sql." ".$res->getMessage(),__FUNCTION__);
        die($sql." ".$res->getMessage());
    }
    return $res;
}

function getSameGroupExt($ext){
    global $db;
    $sql = "SELECT extension FROM roomsdb.groups_rooms WHERE group_id = (SELECT group_id FROM roomsdb.groups_rooms WHERE extension = ".$db->escapeSimple($ext)." LIMIT 1)";
    $res = $db->getAll($sql,DB_FETCHMODE_ASSOC);
    if (@DB::IsError($res)) {
        nethhotel_log ($sql." ".$res->getMessage(),__FUNCTION__);
        die($sql." ".$res->getMessage());
    }
    $extensions = array();
    foreach ($res as $extension){
        $extensions[]=$extension['extension'];
    }
    return $extensions;
}

function getGroupsDialog($group_id=false){
    global $db;
    $options = getOptions();
    if ($group_id===false || $group_id==''){
        $new = true;
        $title = _('Add a new group');
        $group=array();
        $group['name']=_("New Group");
        $group['id']=false;
        $rooms_in_group = array();
        $group['groupcalls'] = $options['groupcalls'];
        $group['roomscalls'] = $options['internal_call'];
        $group['externalcalls'] = $options['externalcalls'];
    } else {
        $new = false;
        $sql = "SELECT * from roomsdb.room_groups WHERE  id = ".$db->escapeSimple($group_id);
        $res = $db->getRow($sql,DB_FETCHMODE_ASSOC);
        if (@DB::IsError($res)) {
            nethhotel_log ($sql." ".$res->getMessage(),__FUNCTION__);
            die($sql." ".$res->getMessage());
        }
        $group = $res;
        $title = sprintf(_('Edit group %s'),$group['name']);

        //get rooms in group
        $sql = 'SELECT extension FROM roomsdb.groups_rooms WHERE group_id ='.$db->escapeSimple($group['id']);
        $res = $db->getAll($sql,DB_FETCHMODE_ASSOC);
        if (@DB::IsError($res)) {
            nethhotel_log ($sql." ".$res->getMessage(),__FUNCTION__);
            die($sql." ".$res->getMessage());
        }
        $rooms_in_group = array();
        if (!empty($res)){
            foreach ($res as $ext){
                $rooms_in_group[] = $ext['extension'];
            }
        }

    }
    //get rooms in any group
    $sql = 'SELECT extension FROM roomsdb.groups_rooms';
    $res = $db->getAll($sql,DB_FETCHMODE_ASSOC);
    if (@DB::IsError($res)) {
        nethhotel_log ($sql." ".$res->getMessage(),__FUNCTION__);
        die($sql." ".$res->getMessage());
    }
    $rooms_in_any_group = array();
    if (!empty($res)){
        foreach ($res as $ext){
            $rooms_in_any_group[] = $ext['extension'];
        }
    }

 
    if ($group['groupcalls']) $groupcalls_check = 'checked';
    if ($group['roomscalls']) $roomscalls_check = 'checked';
    if ($group['externalcalls']) $externalcalls_check = 'checked';
    $out='
<div id="add-group-dialog" data-gid="'.$group['id'].'" title="'.$title.'">
  <form>
      <div><label for="group_name_dial">'._('Group Name').'</label></div>
      <div><input type="text" name="group_name_dial" id="group_name_dial" value="'.$group['name'].'" class="text ui-widget-content ui-corner-all" /></div>

      <div><label for="group_groupcalls_dial">'._('Enable calls between member of this group').'</label></div>
      <div><input type="checkbox" name="group_groupcalls_dial" id="group_groupcalls_dial" class="ui-widget-content ui-corner-all" '.$groupcalls_check.'/></div>

      <div><label for="group_roomscalls_dial">'._('Enable calls between rooms').'</label></div>
      <div><input type="checkbox" name="group_roomscalls_dial" id="group_roomscalls_dial" class="ui-widget-content ui-corner-all" '.$roomscalls_check.'/></div>

      <div><label for="group_externalcalls_dial">'._('Enable external calls').'</label></div>
      <div><input type="checkbox" name="group_externalcalls_dial" id="group_externalcalls_dial" class="ui-widget-content ui-corner-all" '.$externalcalls_check.'/></div>

      <div><label for="group_note_dial">'._('Notes').'</label></div>
      <div><textarea rows="4" cols="30" name="group_note_dial" id="group_note_dial" class="ui-widget-content ui-corner-all" >'.htmlspecialchars($group['note']).'</textarea></div>
  </form>';

    //get rooms not in group
    $sql = "SELECT id FROM asterisk.sip WHERE keyword='context' AND data='".ROOMS_CONTEXT."' order by id";
    $res = $db->getAll($sql,DB_FETCHMODE_ASSOC);
    if (@DB::IsError($res)) {
        nethhotel_log ($sql." ".$res->getMessage(),__FUNCTION__);
        die($sql." ".$res->getMessage());
    }


    $out.='
<div><label for="multiselect">'._('Rooms').'</label></div>
<div class="multiselect">
';

    foreach ($res as $ext){
        $enabled = true;
        if (!in_array($ext['id'],$rooms_in_group) and in_array($ext['id'],$rooms_in_any_group)) {
            $enabled = false;
        }
        $out.='<label';
        if (!$enabled) $out.=' style="color: lightgrey; text-decoration: line-through;"';
        $out.='><input type="checkbox" name="option[]" value="'.$ext['id'].'" ';
        if (in_array($ext['id'],$rooms_in_group)) {
            $out.='checked';
        }
        if (!$enabled) $out.=' disabled="disabled" ';
        $out.='/>'.$ext['id'].'</label>';
    }

    $out.='</div>';
    return $out;
}

function deleteGroup($group_id){
    global $db;
    $sql = 'DELETE FROM roomsdb.room_groups WHERE `id` = '.$db->escapeSimple($group_id);
    $sql2 = 'DELETE FROM roomsdb.groups_rooms WHERE `group_id` = '.$db->escapeSimple($group_id);
    $res = $db->query($sql);
    $res2 = $db->query($sql2);
    if (@DB::IsError($res)) {
        nethhotel_log ($sql." ".$res->getMessage(),__FUNCTION__);
        die($sql." ".$res->getMessage());
    }
    if (@DB::IsError($res2)) {
        nethhotel_log ($sql2." ".$res2->getMessage(),__FUNCTION__);
        die($sql2." ".$res2->getMessage());
    }

    return true;
}

function saveGroupsDialog($group_name,$groupcalls,$roomscalls,$externalcalls,$note,$rooms_in_group,$group_id=false){
    global $db;
    if ($group_id===false || $group_id==''){
        //NEW Group
        $sql = 'INSERT INTO roomsdb.room_groups SET
            `name` = "'.$db->escapeSimple($group_name).'",
            `groupcalls` = '.$db->escapeSimple($groupcalls).',
            `roomscalls` = '.$db->escapeSimple($roomscalls).',
            `externalcalls` = '.$db->escapeSimple($externalcalls).',
            `note` = "'.$db->escapeSimple($note).'"
             ';
    } else {
        //Existing Group
         $db->query('DELETE FROM roomsdb.groups_rooms WHERE `group_id` = '.$db->escapeSimple($group_id));
         $sql = 'UPDATE roomsdb.room_groups SET
            `name` = "'.$db->escapeSimple($group_name).'",
            `groupcalls` = '.$db->escapeSimple($groupcalls).',
            `roomscalls` = '.$db->escapeSimple($roomscalls).',
            `externalcalls` = '.$db->escapeSimple($externalcalls).',
            `note` = "'.$db->escapeSimple($note).'"
             WHERE `id` = '.$db->escapeSimple($group_id);
    }
    $res = $db->query($sql);
    if (@DB::IsError($res)) {
        nethhotel_log ($sql." ".$res->getMessage(),__FUNCTION__);
        die($sql." ".$res->getMessage());
    }
    if ($group_id===false || $group_id==''){
        $res = $db->getOne('SELECT MAX(id) FROM roomsdb.room_groups LIMIT 1');
        if (@DB::IsError($res)) {
            nethhotel_log ($sql." ".$res->getMessage(),__FUNCTION__);
            die($sql." ".$res->getMessage());
        }
        $group_id = $res;
    }
    /*Add rooms to group*/
    foreach (json_decode($rooms_in_group) as $room){
        $sql = 'DELETE FROM roomsdb.groups_rooms WHERE `extension` = '.$db->escapeSimple($room).' ; INSERT INTO roomsdb.groups_rooms SET `group_id` = '.$db->escapeSimple($group_id).', `extension` = '.$db->escapeSimple($room);
        $db->query($sql);
        nethhotel_log ($sql,__FUNCTION__);
    }
    //TODO refresh page
    return true;
}

function loadRooms($ntab)
{
  $rooms = getRoomList();
  $alarms = getEnabledAlarmList();
  $alarmsfailed = getEnabledAlarmsFailed();
  $floor= array();
  $floors= array();


# Conto i callgroup configurati e li ordino
  foreach($rooms as $num)
  {
    $floors[]=$num["6"];
  }

  $floors = array_unique($floors);
  sort($floors);

# Creo i tab

  echo "<script>
        $(function() {
                $( \"#tabs\" ).tabs();
                $( \"#tabs\" ).tabs(\"select\", $ntab);
        });
        </script>";
  echo "<div id=\"tabs\" style=\"float: left; width: 100%\"><ul>";

  foreach($floors as $num)
  {
    if($num=="")  echo "<li><a href=\"#tabs-".$num."\">". _("Generic")."</a></li>";//Generico
    else echo "<li><a href=\"#tabs-".$num."\">". _("Floor ")."".$num."</a></li>";//Piano
  }

  echo "</ul>";


# Nessuna camera configurata
  global $brand_conf;
  if (!count($rooms))
  {
    echo "<div class=\"ui-state-error ui-corner-all\" style=\"padding: 10px; margin: 50px\"><span class=\"ui-icon ui-icon-alert\" style=\"float: left; margin-right: 0.3em;\"></span>".sprintf(_("No rooms configured. Add extensions to %s context from %s interface to use them as rooms"),"<span style='font-weight: bold'>".ROOMS_CONTEXT."</span>",'<a href="/'.$brand_conf['CLEANBRAND'].'/admin/config.php?display=nethhotel" >'.$brand_conf['BRAND'].'</a>') . "</div>";
    exit();
  }
# Camere configurate

  foreach($rooms as $room)
  {
   $divname= null;
   $divgroup= null;
   if(isset($room[2]) && $room[2] && $room[4]==1) //to clean room
    {
      $class = 'clean';
      $alarmstatus = '';
      $actions = '';
      $actions =  "<a href='#ajax-cleanRoom-$room[0]'><img class='action' src='images/clean.png' title='Pulizia Camera' label='Clean-room'/></a>";
    }
   else  //occupied or free room
    {
      if(isset($room[2]) && $room[2] && $room[4]!=1) $class = 'occupied';
      else $class = 'free';

      $alarmstatus = '';
      $actions = '';
      if($alarmsfailed[$room[0]]!="") {
        $class .= ' alarmFailed ';
        $alarmstatus="<img class='action' id='alarmFailed{$room[0]}' src='images/alarm-failed.png' title='Allarme Sveglia ".$alarmsfailed[$room[0]]."' label='Allarme Sveglia ".$alarmsfailed[$room[0]]."'/>" ;
        #sveglia fallita nella giornata
      }

      if(isAlarmEnabled($room[0],array_keys($alarms)))
      {
        $class .= ' alarmEnabled ';
        $int = '';
        $dal = '';
        if($alarms[$room[0]][2]>1)
        {
          $int = " => ".$alarms[$room[0]][3];
          $dal = '';
        }
        $statosveglia=" $dal ".$alarms[$room[0]][1]." $int Ore: ".$alarms[$room[0]][0];

        $actions="<a href='#ajax-editAlarm-$room[0]'><img class='action' src='images/edit-alarm.png' title='Modifica sveglia' label='Modifica sveglia'/></a>  <a href='#ajax-disableAlarm-$room[0]' ><img class='action' src='images/disable-alarm.png' title='Disattiva sveglia' label='Disattiva sveglia'/></a><br/>$statosveglia<hr/>";
      }
      else
      {
        $class .= ' alarmDisabled ';
        $actions= "<a href='#ajax-enableAlarm-$room[0]'><img class='action' src='images/enable-alarm.png' title='Abilita sveglia' label='Abilita sveglia'/></a><hr/>";

      }

      if(isset($room[2]) && $room[2] && $room[4]!=1 && $room[7]) //occupied room
      {
       $actions.="<a href='#ajax-extra-$room[0]'><img class='action' src='images/extra-small.png' title='Gestione extra' label='Gestione extra'/></a>   ";
       $actions.="<a href='#ajax-report-$room[0]'><img class='action' src='images/report.png' title='Report costi' label='Report costi'/></a>  <a href='#ajax-checkOut-$room[0]'><img class='action' src='images/check-out.png' title='Check-out' label='Check-out'/></a>";

       $actions.="<a href='#ajax-roomlang-$room[0]-$room[7]'><span class='action room-lang' title='Lingua cliente'>$room[7]</span></a>";

       $divname= "<div class='name' id='name_$room[0]' style='color: #000; font-size: 90%'><hr/><a href='#ajax-editSurname-$room[0]' style='margin-left: 5px'><img class='action' src='images/avatar.png' title=". _("Name")." label='Name'/></a>&nbsp;$room[5] </div>";
      }
      else //free room
      {
       $class = 'free';
       $actions = "<a href='#ajax-checkIn-$room[0]'><img class='action' src='images/check-in.png' title='Check-in' label='Check-in'/></a><hr/>".$actions;
      }
       $divgroup =  "<div class='actions' style='color: #000; font-size: 90%'><hr/>";
       $divgroup.= getGroupName($room[0]);
       $divgroup.="<a href='#ajax-editGroup-$room[0]' style='margin-left: 5px'><img class='action' src='images/group.png' title='Gruppo' label='Gruppo'/></a></div>";
    }
    $floor[$room[6]].= "<div class='room $class' id='$room[0]'>";
    $floor[$room[6]].= "<h3 style='margin-top: -10px'>$room[0]</h3>";
    $floor[$room[6]].= $divname."<div class='actions'><hr/>$alarmstatus $actions</div>".$divgroup;
    $floor[$room[6]].="</div>";
  }

# Scrivo i div dei tab

  foreach($floors as $num)
   {
      echo "<div id=\"tabs-".$num."\">".$floor[$num]."</div>";
   }
}

function isRoom($ext,$rooms)
{
  if(!$rooms || count($rooms) == 0)
    return false;
  else
    return  in_array($ext,$rooms);
}

function deleteCallFile($ext)
{
   global $db;
   $sql = "DELETE FROM roomsdb.alarmcalls WHERE extension = $ext";
   $db->query($sql);
}

function createCallFile($ext,$time)
{
  global $db;
  $sql = "INSERT INTO roomsdb.alarmcalls SET timestamp = $time, extension = $ext,enabled = 1, alarmtype = 0";
  $db->query($sql);
}

function printAlarms()
{
  $alarmsfailed = getEnabledAlarmsFailed();
  echo "<div id=\"clear\"> </div>\n <div id=\"footer\"><h3>". _("Alarm list").":</h3>";
  foreach($alarmsfailed as $camera => $sveglia)
  {
    echo "<div class='alarms'><img  src='images/alarm-failed-small.png' title='Allarme Sveglia $sveglia' label='Allarme Sveglia $sveglia'/> ". _("Room: ")."$camera". _(" - Alarm Clock not answer - Alarm Time ")."$sveglia</div>" ; // - Allarme Sveglia Non risposta - Orario Savegli
  }
  echo "</div>";

}

function fias($section,$arguments) {
    if (!file_exists('/etc/asterisk/fias.conf')) {
        return FALSE;
    }
    $ini_file = parse_ini_file("/etc/asterisk/fias.conf", true);
    if (isset($ini_file[$section]['command'])) {
        $command = $ini_file[$section]['command'];
    } else {
        $command = $ini_file[$section]['comando'];
    }
    if (isset($ini_file[$section]['format'])) {
        $format = explode("_", $ini_file[$section]['format']);
    } else {
        $format = explode("_", $ini_file[$section]['formato']);
    }
    foreach ($format as $label) {
        if (isset($arguments[$label])) {
            $command .= ' ' . escapeshellarg($arguments[$label]);
        } else {
            $command .= ' ""';
        }
    }
    exec($command, $output, $exit_val);
    if ($exit_val != 0) {
        nethhotel_log("ERROR executing command: $command\n".implode("\n",$output));
        return FALSE;
    }
    return TRUE;
}
