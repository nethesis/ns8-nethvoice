#!/usr/bin/env php
<?php

#
# Copyright (C) 2022 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

/***************************************************
 *
 *   Use VTE REST API to popolate phonebook
 *   HOW TO USE:
 *   - copy this script in /usr/share/phonebooks/scripts/ directory
 *   - Change $url with your API URL
 *   - Put your authorization token into $authorization_token
 *
 * *************************************************/

// URL of the API
$url = 'https://trial01.vtecrm.net/40182/restapi/v1/vtews/query';

// Authorization token used for authentication
$authorization_token = '';

//Count the number of results
$query = 'SELECT count(*) FROM Contacts;';
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'POST');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 4);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['query'=>$query]));
curl_setopt($ch, CURLOPT_HTTPHEADER, array(
        "Content-Type: application/json;charset=utf-8",
        "Accept: application/json;charset=utf-8",
        "Authorization: Basic ".$authorization_token,
));

$res = json_decode(curl_exec($ch),TRUE);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($res['status'] != 200 || $httpCode != 200) {
        error_log("Error contacting phonebook download API: ".$res['status']);
        exit(1);
}

if ($res['data'] != false && !empty($res['data'][0]['count'])) {
	$limit = 1000;
	$count = $res['data'][0]['count'];
	// Connect to phonebook database using PDO
	$phonebookdb = new PDO(
        'mysql:host='.getenv('PHONEBOOK_DB_HOST').';port='.getenv('PHONEBOOK_DB_PORT').';dbname='.getenv('PHONEBOOK_DB_NAME'),
        getenv('PHONEBOOK_DB_USER'),
	getenv('PHONEBOOK_DB_PASS'));

	// Delete old contacts
	$phonebookdb->exec('DELETE FROM phonebook WHERE sid_imported = "vte"');

	for ($offset = 0; $offset < $count; $offset+=$limit) {
		$query = "SELECT * FROM Contacts limit $offset,$limit;";
		$ch = curl_init();
		curl_setopt($ch, CURLOPT_URL, $url);
		curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'POST');
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
		curl_setopt($ch, CURLOPT_HEADER, false);
		curl_setopt($ch, CURLOPT_TIMEOUT, 4);
		curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['query'=>$query]));
		curl_setopt($ch, CURLOPT_HTTPHEADER, array(
		        "Content-Type: application/json;charset=utf-8",
		        "Accept: application/json;charset=utf-8",
		        "Authorization: Basic ".$authorization_token,
		));

		$res = json_decode(curl_exec($ch),TRUE);
		$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
		curl_close($ch);

		// DEBUG
		//print_r($res);

		if ($res['status'] != 200 || $httpCode != 200) {
		        error_log("Error contacting phonebook download API: ".$res['status']);
 	       		exit(1);
		}
		// Write result to phonebook database
		if (!empty($res['data']) && is_array($res['data'])) {
			$query_insert = 'INSERT INTO phonebook (name,company,title,workphone,cellphone,homephone,workemail,fax,workstreet,workpob,workcity,workprovince,workpostalcode,workcountry,type,sid_imported) VALUES ';
			$questionmarks = [];
			$query_data = [];
			foreach ($res['data'] as $record) {
				//Extract company and name from firstname and lastname
				$pattern = '/^(.*) \(([^)]*)\)$/';
				preg_match($pattern,$record['firstname'].' '.$record['lastname'],$matches);
				if (empty($matches)) {
			                $name = $record['firstname'].' '.$record['lastname'];
			                $company = "";
			        } else {
			                $name = $matches[1];
			                $company = $matches[2];
				}

				$questionmarks[] = '(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
				$query_data[] = $name;
				$query_data[] = $company;
				$query_data[] = isset($record['title']) ? $record['title'] : '' ;
				$query_data[] = isset($record['phone']) ? $record['phone'] : '' ;
				$query_data[] = isset($record['mobile']) ? $record['mobile'] : '' ;
				$query_data[] = isset($record['homephone']) ? $record['homephone'] : '' ;
				$query_data[] = isset($record['email']) ? $record['email'] : '' ;
				$query_data[] = isset($record['fax']) ? $record['fax'] : '' ;
				$query_data[] = isset($record['mailingstreet']) ? $record['mailingstreet'] : '' ;
				$query_data[] = isset($record['mailingpobox']) ? $record['mailingpobox'] : '' ;
				$query_data[] = isset($record['mailingcity']) ? $record['mailingcity'] : '' ;
				$query_data[] = isset($record['mailingstate']) ? $record['mailingstate'] : '' ;
				$query_data[] = isset($record['mailingzip']) ? $record['mailingzip'] : '' ;
				$query_data[] = isset($record['mailingcountry']) ? $record['mailingcountry'] : '' ;
				$query_data[] = 'vte';
				$query_data[] = 'vte';
			}
			$query_insert .= implode(',',$questionmarks);
			
			$sth = $phonebookdb->prepare($query_insert);
			$sth->execute($query_data);
		}
	}
}
