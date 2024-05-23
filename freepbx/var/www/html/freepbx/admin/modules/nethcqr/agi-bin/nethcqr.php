#!/usr/bin/env php
<?php

#
#    Copyright (C) 2017 Nethesis S.r.l.
#    http://www.nethesis.it - support@nethesis.it
#
#    This file is part of CQR.
#
#    CQR is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or any 
#    later version.
#
#    CQR is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with CQR.  If not, see <http://www.gnu.org/licenses/>.
#

include_once ("/etc/freepbx.conf");

define("AGIBIN_DIR", "/var/lib/asterisk/agi-bin");
define("DEBUG", "FALSE");
include(AGIBIN_DIR."/phpagi.php");

global $db;
global $amp_conf;

$agi = new AGI();

//Get cqr id, passed as an argument and check that it isn't empty
global $id_cqr;
$id_cqr = $argv[1];
if ($id_cqr == '') 
{
    nethcqr_debug("ERROR: id_cqr cannot be empty!");
    exit (1);
} else {
    nethcqr_debug("Starting cqr id ".$id_cqr.".");
}

//connetct to asterisk database and retrieve cqr details
$sql = "SELECT * FROM nethcqr_details WHERE `id_cqr`='$id_cqr'";
global $cqr;
$cqr_tmp = nethcqr_query($sql,$db,'mysql');
$cqr = $cqr_tmp[0];
if (!is_array($cqr))
{
    nethcqr_debug ("ERROR: cqr object seems wrong");
    exit(1);
} else {
    nethcqr_debug($cqr);
}

$variables = array (
    'DATE' => date("Y-m-d G:i:s"),
    'CID' => $agi->request['agi_callerid']
);

if (!isset($cqr['use_code']) || $cqr['use_code'] == 0)
{
    if (isset($variables['CID']) && $variables['CID'] != '' && $variables['CID'] != 0 )
    {
        //make destination query using only CID
        nethcqr_debug("breakpoint 1 CQR id: $id_cqr, use_code: ".$cqr['use_code'].", CID: ".$variables['CID'].", customercode: not yet definded" );
        $handler = nethcqr_db_connect($cqr['db_type'],$cqr['db_name'],$cqr['db_user'],$cqr['db_pass'],$cqr['db_url']);
        nethcqr_debug (var_dump($cqr['query']));
        $query = nethcqr_evaluate($cqr['query'],$variables);
        nethcqr_debug ($query);
        $query_results = nethcqr_query($query,$handler,$cqr['db_type']);
        nethcqr_debug ($query_results);
        nethcqr_goto ($query_results);    
    }
    else
    {
        nethcqr_debug("breakpoint 2 CQR id: $id_cqr, use_code: ".$cqr['use_code'].", CID: ".$variables['CID'].", customercode: not yet definded" );
        nethcqr_goto_destination($cqr['default_destination']);
    }
} 
else 
{
    //try to get CUSTOMERCODE from CID
    if (isset($variables['CID']) && $variables['CID'] != '' && $variables['CID'] != 0 ){
	if ($cqr['use_workphone']) {
	    //search if there is a workphone to use as CID 
            $pb_user = $amp_conf["AMPDBUSER"];
            $pb_pass = $amp_conf["AMPDBPASS"];
            $pb_host = 'localhost';
            $pb_name = 'phonebook';
            $pb_engine = 'mysql';
            $pb_datasource = $pb_engine.'://'.$pb_user.':'.$pb_pass.'@'.$pb_host.'/'.$pb_name;
            $pb = @DB::connect($pb_datasource); // attempt connection
            if(!$pb instanceof DB_Error) {
                $number=$variables['CID'];
	        $sql="SELECT `workphone` FROM `phonebook` WHERE (`homephone` LIKE '%$number' OR `cellphone` LIKE '%$number') AND `workphone` <> '' AND `workphone` IS NOT NULL";
                $workphone = @$pb->getAll($sql,DB_FETCHMODE_ORDERED);
                if ($pb->isError($workphone)){
                    if (!empty($workphone) && count($workphone)==1){
                         $variables['CID']=$workphone[0][0];
                    }
                }
	    }
   	    $pb->disconnect();
	}
        $handler = nethcqr_db_connect($cqr['cc_db_type'],$cqr['cc_db_name'],$cqr['cc_db_user'],$cqr['cc_db_pass'],$cqr['cc_db_url']);
        nethcqr_debug ($cqr['cc_query']);	
        $cc_query = nethcqr_evaluate($cqr['cc_query'],$variables);
        $cqr_query_results = nethcqr_query($cc_query,$handler,$cqr['cc_db_type']);
    }
    if (is_array($cqr_query_results)) {
        if (is_array($cqr_query_results[0])) {
             $variables['CUSTOMERCODE'] = array_pop($cqr_query_results[0]);
	} else {
             $variables['CUSTOMERCODE'] = $cqr_query_results[0];
        }
    }
    else $variables['CUSTOMERCODE'] = $cqr_query_results;

    if (isset($variables['CUSTOMERCODE']) && $variables['CUSTOMERCODE'] != 0 && $variables['CUSTOMERCODE'] != '')
    {
        //make destination query using CUSTOMERCODE
	nethcqr_debug("breakpoint 3 CQR id: $id_cqr, use_code: ".$cqr['use_code'].", CID: ".$variables['CID'].", customercode: ".$variables['CUSTOMERCODE']."" );
	$handler = nethcqr_db_connect($cqr['db_type'],$cqr['db_name'],$cqr['db_user'],$cqr['db_pass'],$cqr['db_url']);
	$query = nethcqr_evaluate($cqr['query'],$variables);
	nethcqr_debug ($query);
	$cqr_query_results = nethcqr_query($query,$handler,$cqr['db_type']);
	nethcqr_debug ($cqr_query_results);
	nethcqr_goto ($cqr_query_results);
    } 
    else 
    {
	if ($cqr['manual_code']=='1')
	{
            //ask for manual code
            $try=1;
            nethcqr_debug("Asking user for manual customer code");
            $welcome_audio_file = recordings_get_file($cqr["cod_cli_announcement"]);
            if ($cqr['code_retries']==0) $infinite = true;
            else $infinite = false;
            while($try <= $cqr['code_retries'] || $infinite)
	    {
                unset($buf);
                $pinchr='';
                $codcli='';
                unset($pin);
                nethcqr_debug("Getting manual customer code, try: $try");
                $pin = $agi->fastpass_stream_file($buf,$welcome_audio_file,'1234567890#');
                nethcqr_debug($pin);
                nethcqr_debug($buf);
                if ($pin['result'] >0)
		{
                    $codcli=chr($pin['result']);
		}
                # ciclo in attesa di numeri (codcli) fino a che non viene messo # o il numero di caratteri è < $cqr['code_length']
                while($pinchr != "#" && strlen($codcli) < $cqr['code_length']) 
		{
                    $pin = $agi->wait_for_digit("6000");
                    $pinchr=chr($pin['result']);
                    nethcqr_debug($pin);
                    if ($pin['code'] != AGIRES_OK || $pin['result'] <= 0 ) 
 		    { #non funziona dtmf, vado avanti 
                        nethcqr_debug("dtmf isn't working");
			$codcli = -1;
                    } elseif ($pinchr >= "0" and $pinchr <= "9") {
                        $codcli = $codcli.$pinchr;
                    }
                    nethcqr_debug("Codcli: ".$pin['result']."-".$pin['code']."-".$codcli,1);
		    if ($codcli == -1) break; //exit from asking digit loop if someone press # without any digit 	
                }
		if ($codcli == -1) 
		{
			//if someone pressed # without digit, go to next try. 
			$try++;
			nethcqr_debug ("Invalid code");
			$err_msg = recordings_get_file($cqr["err_announcement"]);
			$agi->stream_file($err_msg);
			continue;
		}
	        //CHECK MANUAL CUSTOMER CODE
		if (isset($cqr['ccc_query']) && $cqr['ccc_query'] != '')
		{
		    $handler = nethcqr_db_connect($cqr['cc_db_type'],$cqr['cc_db_name'],$cqr['cc_db_user'],$cqr['cc_db_pass'],$cqr['cc_db_url']);
		    $ccc_query = nethcqr_evaluate($cqr['ccc_query'],array("CODCLI"=>$codcli));
                    nethcqr_debug ($ccc_query);
                    $cqr_query_results = nethcqr_query($ccc_query,$handler,$cqr['cc_db_type']);
                    if (empty($cqr_query_results))
		    {
		        //Manual inserted customer code isn't correct
                        $err_msg = recordings_get_file($cqr["err_announcement"]);
                        $agi->stream_file($err_msg); # codice errato o inesistente
			nethcqr_debug ("Manually provided customer code is wrong!");
                    }
		    else
	 	    {
		        //Manual inserted customer code is correct
                        $variables['CUSTOMERCODE']=$codcli;
		        nethcqr_debug("breakpoint 4 CQR id: $id_cqr, use_code: ".$cqr['use_code'].", CID: ".$variables['CID'].", customercode: ".$variables['CUSTOMERCODE']."" );
                        $handler = nethcqr_db_connect($cqr['db_type'],$cqr['db_name'],$cqr['db_user'],$cqr['db_pass'],$cqr['db_url']);
                        $query = nethcqr_evaluate($cqr['query'],$variables);
                        nethcqr_debug ($query);
                        $cqr_query_results = nethcqr_query($query,$handler,$cqr['db_type']);
                        nethcqr_debug ($cqr_query_results);
                        nethcqr_goto ($cqr_query_results);
		    }
		} 
		else
		{
		    //Don't check manual customer code. It's correct 
		    nethcqr_debug("breakpoint 5 CQR id: $id_cqr, use_code: ".$cqr['use_code'].", CID: ".$variables['CID'].", customercode: ".$variables['CUSTOMERCODE']."" );
                    $handler = nethcqr_db_connect($cqr['db_type'],$cqr['db_name'],$cqr['db_user'],$cqr['db_pass'],$cqr['db_url']);
                    $query = nethcqr_evaluate($cqr['query'],$variables);
                    nethcqr_debug ($query);
                    $cqr_query_results = nethcqr_query($query,$handler,$cqr['db_type']);
                    nethcqr_debug ($cqr_query_results);
                    nethcqr_goto ($cqr_query_results);
  		}
                $try++;
            }
	    //manually provided customer code was always wrong, goto default destination
	    nethcqr_debug("breakpoint 6 CQR id: $id_cqr, use_code: ".$cqr['use_code'].", CID: ".$variables['CID'].", customercode: ".$variables['CUSTOMERCODE']."" );
            nethcqr_goto_destination($cqr['default_destination']);
	} 
	else 
	{
	    //got default destination
	    nethcqr_debug("breakpoint 7 CQR id: $id_cqr, use_code: ".$cqr['use_code'].", CID: ".$variables['CID'].", customercode: ".$variables['CUSTOMERCODE']."" );
            nethcqr_goto_destination($cqr['default_destination']);
	}
    }
}

#FUNCTIONS#
function nethcqr_debug($text) {
    global $agi;
    if (is_array($text))
    {
        $text=print_r($text,true);
    }
    {
        $agi->verbose($text);
    }
}

function nethcqr_goto($cqr_query_results)
{
    global $id_cqr;
    global $db;
    global $cqr;
    //get entries 
    $sql = "SELECT * FROM nethcqr_entries WHERE `id_cqr`='$id_cqr' ORDER BY `position` ASC";
    $entries = nethcqr_query($sql,$db,'mysql');
    foreach ($cqr_query_results as $cqr_query_result)
    {
        $cqr_query_result = array_values ($cqr_query_result);
        $cqr_query_result = $cqr_query_result[0];
	nethcqr_debug ("query result ".$cqr_query_result);
        foreach ($entries as $entrie)
	{
	    if ($cqr_query_result == $entrie['condition']) 
	    {//WIN
                nethcqr_debug("'$cqr_query_result' == '".$entrie['condition']."' -> '".$entrie['destination']."'");
                nethcqr_goto_destination($entrie['destination']);
            } else {
                nethcqr_debug("'$cqr_query_result' != '".$entrie['condition']."' -> '".$entrie['destination']."'");
            }
	}
    }
    nethcqr_debug("No entry match with query results, going to default destination...");
    nethcqr_goto_destination($cqr['default_destination']);
}

function nethcqr_goto_destination($destination,$exit=0)
{
        global $agi;
        nethcqr_debug(__FUNCTION__.": goto $destination");
        @$agi->exec("Goto","$destination");
        exit($exit);
}

function nethcqr_evaluate($msg,$variables){
        //$variables = array ('VAR_NAME_IN_MSG' => var_value, ....)
        //VAR_NAME_IN_MSG : NAME, PIPPO,FOOBAR
        //$msg example: "SELECT * FROM '%TABLE%'"
        //var_value : 'pippo'
        //expected return: "SELECT * FROM pippo"
        nethcqr_debug('nethcqr_evaluate 1 '.$msg);
        nethcqr_debug ($variables);
        foreach ($variables as $variable_name => $variable_value ){
                $msg = preg_replace('/%'.$variable_name.'%/',$variable_value,$msg);
        }
        nethcqr_debug('nethcqr_evaluate 2 '.$msg);
        return $msg;

}

function nethcqr_db_connect($db_type,$db_name,$db_user,$db_pass,$db_url='localhost')
{
    if ($db_type=='mysql')
    {
        $datasource = 'mysql://'.$db_user.':'.$db_pass.'@'.$db_url.'/'.$db_name;
        @$handle =& DB::connect($datasource);
        if ($handle instanceof DB_Error)
	{
	    nethcqr_debug("ERROR: can't connect to database $db_name -> ". $handle->getMessage());
	    return false;
	}
    }
    elseif ($db_type=='mssql')
    {
        $handle = odbc_connect($db_name,$db_user,$db_pass);
        if (!isset($handle))
	{
	    //ERROR
	    nethcqr_debug("ERROR: can't connect to database $db_name -> ". odbc_errormsg());
	    return false;
	}    
    }
    return $handle;
}

function nethcqr_query($sql,$handle,$db_type='mysql')
{
    if ($db_type=='mysql')
    {
        $results = @$handle->getAll($sql, DB_FETCHMODE_ASSOC);
	if($handle->isError($results))
	{
	    nethcqr_debug ("ERROR: $sql -> ".$results->getMessage());
	    return false;
	}
    } 
    elseif ($db_type=='mssql')
    {
	$result = odbc_exec($handle,$sql);
	while ($row = odbc_fetch_array($result))
	{
            $results[] = $row;
        }
	    odbc_close($handle);
    }
    nethcqr_debug("query $sql  -> ".print_r($results,true));
    return $results;
}










