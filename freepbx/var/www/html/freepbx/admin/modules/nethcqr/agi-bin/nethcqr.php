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
include(AGIBIN_DIR."/phpagi.php");

$agi = new AGI();

//Get cqr id, passed as an argument and check that it isn't empty
$id_cqr = $argv[1];
if (empty($id_cqr)) {
    $agi->verbose("ERROR: id_cqr cannot be empty!");
    exit (1);
}

//connetct to asterisk database and retrieve cqr details
$sql = "SELECT * FROM nethcqr_details WHERE `id_cqr`= ?";
$stmt = $db->prepare($sql);
$stmt->execute(array($id_cqr));
$cqr_details = $stmt->fetch(\PDO::FETCH_ASSOC);

$variables = array (
    'DATE' => date("Y-m-d G:i:s"),
    'CID' => $agi->request['agi_callerid']
);

try {
    $cqrdb = new PDO($cqr_details['db_type'].':host='.$cqr_details['db_url'].';dbname='.$cqr_details['db_name'],
            $cqr_details['db_user'],
            $cqr_details['db_pass']
        );
} catch (PDOException $e) {
    $agi->verbose("ERROR: can't connect to database ".$cqr_details['db_name']." -> ".$e->getMessage());
    exit(1);
}

if (empty($cqr_details['use_code'])) {
    if (!empty($variables['CID'])) {
        //make destination query using only CID
        $agi->verbose("INFO: CQR id: $id_cqr, use_code: ".$cqr_details['use_code'].", CID: is empty");
        $query = nethcqr_evaluate($cqr_details['query'],$variables);
        $agi->verbose("INFO: executing CQR query: $query");
        $stmt = $cqrdb->prepare($query);
        $stmt->execute();
        $cqr_query_results = $stmt->fetchAll(\PDO::FETCH_ASSOC);
        $agi->verbose("INFO: results: ".print_r($cqr_query_results,true));
        nethcqr_goto($cqr_query_results);
    } else {
        $agi->verbose("INFO: CQR id: $id_cqr, use_code: ".$cqr_details['use_code'].", CID: ".$variables['CID']);
        nethcqr_goto_destination($cqr_details['default_destination']);
    }
} else {
    //try to get CUSTOMERCODE from CID
    if (!empty($variables['CID']) && $cqr_details['use_workphone']) {
        try {
            //search if there is a workphone to use as CID in phonebook
            $phonebookdb = new PDO('mysql:host='.$_ENV['PHONEBOOK_DB_HOST'].':'.$_ENV['PHONEBOOK_DB_PORT'].';dbname='.$_ENV['PHONEBOOK_DB_NAME'],
                $_ENV['PHONEBOOK_DB_USER'],
                $_ENV['PHONEBOOK_DB_PASS']
            );
            $number=$variables['CID'];
            $sql="SELECT `workphone` FROM `phonebook` WHERE (`homephone` LIKE ? OR `cellphone` LIKE ?) AND `workphone` <> '' AND `workphone` IS NOT NULL";
            $stmt = $phonebookdb->prepare($sql);
            $stmt->execute(["%$number","%$number"]);
            $res = $stmt->fetchAll(\PDO::FETCH_ASSOC);
            if (!empty($workphones) && count($res)>=1){
                $variables['CID'] = $res[0]['workphone'];
            }
        } catch (PDOException $e) {
            $agi->verbose("ERROR getting workphone from CID: ".$e->getMessage());
        }
	}
    if ($cqr_details['cc_db_type'] == 'mssql') {
        $url = explode(":",$cqr_details['cc_db_url']);
        if (count($url) == 1) {
            $url[1] = 1433;
        }
        $dsn = "odbc:Driver=FreeTDS;Server={$url[0]},{$url[1]};Database={$cqr_details['cc_db_name']};";
    } else {
        $dsn = $cqr_details['cc_db_type'].':host='.$cqr_details['cc_db_url'].';dbname='.$cqr_details['cc_db_name'];
    }
    $cqr_cc_db = new PDO($dsn,
        $cqr_details['cc_db_user'],
        $cqr_details['cc_db_pass']
    );
    $cc_query = nethcqr_evaluate($cqr_details['cc_query'],$variables);
    $stmt = $cqr_cc_db->prepare($cc_query);
    $stmt->execute();
    $cqr_query_results = $stmt->fetchAll(\PDO::FETCH_ASSOC);
    if (is_array($cqr_query_results)) {
        if (is_array($cqr_query_results[0])) {
            $variables['CUSTOMERCODE'] = array_pop($cqr_query_results[0]);
        } else {
            $variables['CUSTOMERCODE'] = $cqr_query_results[0];
        }
    } else {
        $variables['CUSTOMERCODE'] = $cqr_query_results;
    }

    if (!empty($variables['CUSTOMERCODE'])) {
        //make destination query using CUSTOMERCODE
        $agi->verbose("INFO: CQR id: $id_cqr, use_code: ".$cqr_details['use_code'].", CID: ".$variables['CID'].", customercode: ".$variables['CUSTOMERCODE']);
	    $query = nethcqr_evaluate($cqr_details['query'],$variables);
	    $agi->verbose ($query);
        $stmt = $cqrdb->prepare($query);
        $stmt->execute();
        $cqr_query_results = $stmt->fetchAll(\PDO::FETCH_ASSOC);
        $agi->verbose("INFO: results: ".print_r($cqr_query_results,true));
	    nethcqr_goto($cqr_query_results);
    } elseif ($cqr_details['manual_code']=='1') {
        //ask for manual code
        $try=1;
        $agi->verbose("Asking user for manual customer code");
        $welcome_audio_file = recordings_get_file($cqr_details["cod_cli_announcement"]);
        if ($cqr_details['code_retries']==0) $infinite = true;
        else $infinite = false;
        while($try <= $cqr_details['code_retries'] || $infinite) {
            unset($buf);
            $pinchr='';
            $codcli='';
            unset($pin);
            $agi->answer();
            $agi->verbose("Getting manual customer code, try: $try");
            $pin = $agi->fastpass_stream_file($buf,$welcome_audio_file,'1234567890#');
            $agi->verbose($pin);
            $agi->verbose($buf);
            if ($pin['result'] >0) {
                $codcli=chr($pin['result']);
		    }
            # ciclo in attesa di numeri (codcli) fino a che non viene messo # o il numero di caratteri è < $cqr_details['code_length']
            while($pinchr != "#" && strlen($codcli) < $cqr_details['code_length']) {
                $pin = $agi->wait_for_digit("6000");
                $pinchr=chr($pin['result']);
                $agi->verbose($pin);
                if ($pin['code'] != AGIRES_OK || $pin['result'] <= 0 ) {
                    #non funziona dtmf, vado avanti 
                    $agi->verbose("dtmf isn't working");
			        $codcli = -1;
                } elseif ($pinchr >= "0" and $pinchr <= "9") {
                    $codcli = $codcli.$pinchr;
                }
                $agi->verbose("Codcli: ".$pin['result']."-".$pin['code']."-".$codcli,1);
		        if ($codcli == -1) break; //exit from asking digit loop if someone press # without any digit 	
            }

		    if ($codcli == -1) {
			    //if someone pressed # without digit, go to next try. 
			    $try++;
			    $agi->verbose ("Invalid code");
			    $err_msg = recordings_get_file($cqr_details["err_announcement"]);
			    $agi->stream_file($err_msg);
			    continue;
		    }

	        //CHECK MANUAL CUSTOMER CODE
		    if (isset($cqr_details['ccc_query']) && $cqr_details['ccc_query'] != '') {
                // Use the customer code control query to check if the manually inserted customer code is correct
                $query = nethcqr_evaluate($cqr_details['ccc_query'],array("CODCLI"=>$codcli));
                $agi->verbose($query);
                $stmt = $cqr_cc_db->prepare($query);
                $stmt->execute();
                $res = $stmt->fetchAll(\PDO::FETCH_ASSOC);
                if (empty($res)) {
		            //Manual inserted customer code isn't correct
                    $err_msg = recordings_get_file($cqr_details["err_announcement"]);
                    $agi->stream_file($err_msg); # codice errato o inesistente
			        $agi->verbose ("Manually provided customer code is wrong!");
                } else {
		            //Manual inserted customer code is correct
                    $variables['CUSTOMERCODE']=$codcli;
		            $agi->verbose("breakpoint 4 CQR id: $id_cqr, use_code: ".$cqr_details['use_code'].", CID: ".$variables['CID'].", customercode: ".$variables['CUSTOMERCODE']."" );
                    $query = nethcqr_evaluate($cqr_details['query'],$variables);
                    $agi->verbose($query);
                    $stmt = $cqrdb->prepare($query);        
                    $stmt->execute();
                    $cqr_query_results = $stmt->fetchAll(\PDO::FETCH_ASSOC);
                    $agi->verbose("INFO: results: ".print_r($cqr_query_results,true));
                    nethcqr_goto($cqr_query_results);
		        }
		    } else {
		        //Don't check manual customer code. It's correct 
		        $agi->verbose("breakpoint 5 CQR id: $id_cqr, use_code: ".$cqr_details['use_code'].", CID: ".$variables['CID'].", customercode: ".$variables['CUSTOMERCODE']."" );
                $query = nethcqr_evaluate($cqr_details['query'],$variables);
                $agi->verbose($query);
                $stmt = $cqrdb->prepare($query);        
                $stmt->execute();
                $cqr_query_results = $stmt->fetchAll(\PDO::FETCH_ASSOC);
                $agi->verbose("INFO: results: ".print_r($cqr_query_results,true));
                nethcqr_goto($cqr_query_results);
  		    }
            $try++;
        }
	    //manually provided customer code was always wrong, goto default destination
	    $agi->verbose("breakpoint 6 CQR id: $id_cqr, use_code: ".$cqr_details['use_code'].", CID: ".$variables['CID'].", customercode: ".$variables['CUSTOMERCODE']."" );
        nethcqr_goto_destination($cqr_details['default_destination']);
	} else {
	    //got default destination
	    $agi->verbose("breakpoint 7 CQR id: $id_cqr, use_code: ".$cqr_details['use_code'].", CID: ".$variables['CID'].", customercode: ".$variables['CUSTOMERCODE']."" );
        nethcqr_goto_destination($cqr_details['default_destination']);
	}
}

/**
 * Function to process the query results and determine the destination based on the conditions.
 *
 * @param array $cqr_query_results The query results to process.
 * @return void
 */
function nethcqr_goto($cqr_query_results) {
    global $db;
    global $id_cqr;
    global $agi;
    global $cqr_details;
    
    // Get entries from the database
    $sql = "SELECT * FROM nethcqr_entries WHERE `id_cqr`= ? ORDER BY `position` ASC";
    $stmt = $db->prepare($sql);
    $stmt->execute(array($id_cqr));
    $entries = $stmt->fetchAll(\PDO::FETCH_ASSOC);
    
    foreach ($cqr_query_results as $cqr_query_result) {
        if (is_array($cqr_query_result)) {
            $cqr_query_result = array_pop($cqr_query_result);
            $agi->verbose ("query result ".$cqr_query_result);
            foreach ($entries as $entry) {
                if ($cqr_query_result == $entry['condition']){
                    // Query result matches an entry condition
                    $agi->verbose("'$cqr_query_result' == '".$entry['condition']."' -> '".$entry['destination']."'");
                    nethcqr_goto_destination($entry['destination']);
                } else {
                    $agi->verbose("'$cqr_query_result' != '".$entry['condition']."' -> '".$entry['destination']."'");
                }
            }
        }
    }
    
    // No entry matches the query results, go to the default destination
    $agi->verbose("No entry matches with query results, going to default destination ".$cqr_details['default_destination']);
    nethcqr_goto_destination($cqr_details['default_destination']);
}

/**
 * Function to go to a specified dialplan destination.
 *
 * @param string $destination The destination to go to.
 * @return void
 */
function nethcqr_goto_destination($destination) {
    global $agi;
    @$agi->exec("Goto", $destination);
    exit(0);
}

/**
 * Evaluates a message by replacing variable placeholders with their corresponding values.
 *
 * @param string $msg The message to be evaluated.
 * @param array $variables An associative array of variable names and their values.
 * @return string The evaluated message with variable placeholders replaced.
 */
function nethcqr_evaluate($msg, $variables) {
    //$variables = array ('VAR_NAME_IN_MSG' => var_value, ....)
    //VAR_NAME_IN_MSG : NAME, PIPPO,FOOBAR
    //$msg example: "SELECT * FROM '%TABLE%'"
    //var_value : 'foo'
    //expected return: "SELECT * FROM foo"
    foreach ($variables as $variable_name => $variable_value) {
        $msg = preg_replace('/%' . $variable_name . '%/', $variable_value, $msg);
    }
    return $msg;
}