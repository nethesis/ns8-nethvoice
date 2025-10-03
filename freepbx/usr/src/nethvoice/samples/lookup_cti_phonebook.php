#!/usr/bin/env php
<?php

#
# Copyright (C) 2025 Nethesis S.r.l.
# http://www.nethesis.it - nethserver@nethesis.it
#
# This script is part of NethServer.
#
# NethServer is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License,
# or any later version.
#
# NethServer is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with NethServer.  If not, see COPYING.
#


/***************************************************
 *
 *   This lookup script search in cti provate phonebooks and use them to resolve the number of incoming external calls
 *   Note that everyone will see the resolved number
 *
 *   HOW TO USE
 *   Put it in /usr/src/nethvoice/lookup.d directory
 *
 * *************************************************/

$number = $argv[1];

$lookupdb = new PDO(
	'mysql:host='.$_ENV['NETHCTI_DB_HOST'].':'.$_ENV['NETHCTI_DB_PORT'].';dbname=nethcti3',
	$_ENV['NETHCTI_DB_USER'],
	$_ENV['NETHCTI_DB_PASSWORD'],
);

// check for errors
if($lookupdb instanceof PDOException) {
	error_log("Error conecting to nethcti3 database, skipped");
	exit(1);
}

$lookup_query = "SELECT `name`,`company` FROM `cti_phonebook` WHERE `type`='private' AND (`homephone` LIKE '%[NUMBER]%' OR `workphone` LIKE '%[NUMBER]%' OR `cellphone` LIKE '%[NUMBER]%' OR `fax` LIKE '%[NUMBER]%')";
$sql=preg_replace('/\[NUMBER\]/',$number,$lookup_query);

$stmt = $lookupdb->prepare($sql);
$stmt->execute();
$res = $stmt->fetchAll();

if (empty($res)) {
	//remove international prefix from number
	if (substr($number,0,1) === '+' ) {
		$mod_number = substr($number,3);
		$sql=preg_replace('/\[NUMBER\]/',$mod_number,$lookup_query);
		$stmt = $lookupdb->prepare($sql);
		$stmt->execute();
		$res = $stmt->fetchAll();
	} elseif ( substr($number,0,2) === '00') {
		$mod_number = substr($number,4);
		$sql=preg_replace('/\[NUMBER\]/',$mod_number,$lookup_query);
		$stmt = $lookupdb->prepare($sql);
		$stmt->execute();
		$res = $stmt->fetchAll();
	}
}

if ($stmt->errorCode() != 0) {
    error_log("Error: ".$stmt->errorInfo()[2]);
    exit(1);
}

$namecount = 0;

if (!empty($res)) {
    //get company
    foreach ($res as $row) {
	if (!empty($row[1])) {
	    $company = trim($row[1]);
	    break; //company setted, no need to continue
	}
    }

	//get name
	$names = [];
	foreach ($res as $row) {
		if (!empty($row[0])) {
			$names[] = trim($row[0]);
		}
	}
	$names = array_unique($names);
	// Name should be empty if there are more different names for the same company
	if (count($names) > 1) {
		$name = '';
	} else {
		$name = $names[0];
	}
	echo json_encode(
		[
			"company" => "$company",
			"name" => "$name",
			"number" => $number,
		]
	);
}

