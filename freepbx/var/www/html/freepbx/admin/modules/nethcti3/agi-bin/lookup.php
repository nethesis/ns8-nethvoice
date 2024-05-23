#!/usr/bin/env php
<?php

#
# Copyright (C) 2024 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

set_time_limit(10);
define("AGIBIN_DIR", "/var/lib/asterisk/agi-bin");
include(AGIBIN_DIR."/phpagi.php");

global $db;

$agi = new AGI();
$direction = $argv[1];
$number =  $argv[2];
if ($direction == 'out') {
    $cnam =  $argv[3];
}
$name = '';
$company = '';
$apiFlag = false;
$apiDir = '/usr/src/nethvoice/lookup.d';
$apiFile = '';

if (strlen($number)> 4) {
    //search into dir custom API script(s)
    if (is_dir($apiDir)) {
        foreach (scandir($apiDir) as $file) {
            //check if it's a file also it's executable
            $apiFile = $apiDir . '/' . $file;
            if (is_file($apiFile)) {
                if (is_executable($apiFile)) {
                    //call the exe file and check if it returns any valid json
                    $shellCmd = escapeshellcmd($apiFile . ' ' . $number);
                    $apiResult = shell_exec($shellCmd);
                    //expects a json obj
                    if ($apiResult != '') {
                        $jsonData = json_decode($apiResult);
                        $name = $jsonData->name;
                        $company = $jsonData->company;
                        if ($name == '' && $company == '') {
                            //continue with the next exe file
                            continue;
                        }
                        //almost one exe file returns valid info
                        @$agi->verbose("Name = $name, Company = $company, Number = $number, source = API");
                        $apiFlag = true;
                        break;
                    }
                }
            }
        }
    }
    //look up $name and $company via Mysql query
    if (!$apiFlag) {
        $lookupdb = new PDO(
            'mysql:host=127.0.0.1:'.$_ENV['PHONEBOOK_DB_PORT'].';dbname='.$_ENV['PHONEBOOK_DB_NAME'],
            $_ENV['PHONEBOOK_DB_USER'],
            $_ENV['PHONEBOOK_DB_PASS'],
        );
        // check for errors
        if($lookupdb instanceof PDOException) {
            @$agi->verbose("Error conecting to asterisk database, skipped");
            exit(1);
        }
        $lookup_query = "SELECT `name`,`company` FROM `phonebook` WHERE `homephone` LIKE '%[NUMBER]%' OR `workphone` LIKE '%[NUMBER]%' OR `cellphone` LIKE '%[NUMBER]%' OR `fax` LIKE '%[NUMBER]%'";
        $sql=preg_replace('/\[NUMBER\]/',$number,$lookup_query);
        @$agi->verbose($sql);

        $stmt = $lookupdb->prepare($sql);
        $stmt->execute();
        $res = $stmt->fetchAll();

        if (empty($res) && $direction == 'in') {
            //remove international prefix from number
            if (substr($number,0,1) === '+' ) {
                $mod_number = substr($number,3);
                $sql=preg_replace('/\[NUMBER\]/',$mod_number,$lookup_query);
                @$agi->verbose($sql);
                $stmt = $lookupdb->prepare($sql);
                $stmt->execute();
                $res = $stmt->fetchAll();
            } elseif ( substr($number,0,2) === '00') {
                $mod_number = substr($number,4);
                $sql=preg_replace('/\[NUMBER\]/',$mod_number,$lookup_query);
                @$agi->verbose($sql);
                $stmt = $lookupdb->prepare($sql);
                $stmt->execute();
                $res = $stmt->fetchAll();
            }
        }

        if ($stmt->errorCode() != 0) {
            @$agi->verbose("Error: ".$stmt->errorInfo()[2]);
            exit(1);
        }

        $namecount = 0;

        if (!empty($res)) {
            //get company
            foreach ($res as $row) {
                if (!empty($row[1])) {
                    $company = $row[1];
                    @$agi->verbose("Company = $company");
                    break; //company setted, no need to continue
                }
            }
            //get name
            foreach ($res as $row) {
                if (!empty($row[0])) {
                    $name = $row[0];
                    //if company is setted, make sure that there is only one name that correspond to this number, clear name if there are more than one
                    if ($company != '') {
                        $namecount++;
                        if ( $namecount > 1) {
                            $name = '';
                            break;
                        }
                    } else {
                        break;
                    }
                }
            }
        }
        @$agi->verbose("Name = $name, Company = $company, Number = $number, source = Mysql");
    }
}

if ($name === '' && $company !== '') $displayname = $company;
elseif ($name !== '' && $company !== '') $displayname = "$name ($company)";
elseif ($name !== '' && $company === '') $displayname = $name;
else $displayname = $number;

@$agi->set_variable("CONNECTEDLINE(name,i)","$displayname");
if ($direction == 'out') {
    if ($cnam !== '' ) @$agi->set_variable("CDR(cnam)","$cnam");
    if ($name !== '' ) @$agi->set_variable("CDR(dst_cnam)","$name");
    if ($company !== '' ) @$agi->set_variable("CDR(dst_ccompany)","$company");
} else {
    @$agi->set_variable("CALLERID(name)","$displayname");
    if ($name !== '' ) @$agi->set_variable("CDR(cnam)","$name");
    if ($company !== '' ) @$agi->set_variable("CDR(ccompany)","$company");
}
@$agi->verbose("Name = \"$name\", Company = \"$company\", Number = \"$number\"");
