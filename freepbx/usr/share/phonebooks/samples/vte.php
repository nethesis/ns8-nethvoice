#!/usr/bin/env php
<?php

#
# Copyright (C) 2025 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

/***************************************************
 *
 *   Use VTE REST API to popolate phonebook
 *   HOW TO USE:
 *   - copy this script in /usr/share/phonebooks/scripts/ directory
 *   - Change $base_url with your vte API base URL
 *   - Put your authorization info into $username and $accesskey
 *     variables
 *
 * *************************************************/

// URL of the API
$base_url = 'https://vtecrm.example.com/restapi/v1/vtews/';

$username  = '';
$accesskey = '';


// Authorization token used for authentication
$authorization_token = base64_encode($username.':'.$accesskey);

//Count the number of contacts
$query = 'SELECT count(*) FROM Contacts;';
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $base_url.'query');
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'POST');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 4);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['query'=>$query]));
curl_setopt($ch, CURLOPT_HTTPHEADER, array(
		"Content-Type: application/json",
		"Authorization: Basic ".$authorization_token,
));

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$data = json_decode($response, true);

if ($response === false) {
	error_log("cURL error while counting contacts: (".curl_errno($ch).") ".curl_error($ch));
	exit(1);
}
elseif ($httpCode != 200) {
	error_log("Error while counting contacts: (HTTP ".$httpCode.") ".($data['message'] ?? ''));
	exit(1);
}
elseif ($data === null) {
	error_log("Error while decoding count contacts response: (".json_last_error().") ".json_last_error_msg());
	exit(1);
}
curl_close($ch);

if (!empty($data['data'][0]['count'])) {
	$limit = 1000;
	$count = $data['data'][0]['count'];

	// Connect to phonebook database using PDO
	$phonebookdb = new PDO(
		'mysql:host='.getenv('PHONEBOOK_DB_HOST').';port='.getenv('PHONEBOOK_DB_PORT').';dbname='.getenv('PHONEBOOK_DB_NAME'),
		getenv('PHONEBOOK_DB_USER'),
		getenv('PHONEBOOK_DB_PASS')
	);

	// Delete old contacts
	$phonebookdb->exec('DELETE FROM phonebook WHERE sid_imported = "vte"');

	// Get contacts in batches
	for ($offset = 0; $offset < $count; $offset+=$limit) {
		$query = "SELECT * FROM Contacts limit $offset,$limit;";
		$ch = curl_init();
		curl_setopt($ch, CURLOPT_URL, $base_url.'query');
		curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'POST');
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
		curl_setopt($ch, CURLOPT_HEADER, false);
		curl_setopt($ch, CURLOPT_TIMEOUT, 4);
		curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['query'=>$query]));
		curl_setopt($ch, CURLOPT_HTTPHEADER, array(
				"Content-Type: application/json",
				"Authorization: Basic ".$authorization_token,
		));

		$response = curl_exec($ch);
		$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
		$data = json_decode($response, true);

		// DEBUG
		//print_r($response);

		if ($response === false) {
			error_log("cURL error while getting contacts: (".curl_errno($ch).") ".curl_error($ch));
			exit(1);
		}
		elseif ($httpCode != 200) {
			error_log("Error while getting contacts: (HTTP ".$httpCode.") ".($data['message'] ?? ''));
			exit(1);
		}
		elseif ($data === null) {
			error_log("Error while decoding download contacts response: (".json_last_error().") ".json_last_error_msg());
			exit(1);
		}
		curl_close($ch);

		// Write result to phonebook database
		if (!empty($data['data']) && is_array($data['data'])) {
			$query_insert = 'INSERT INTO phonebook (name,company,title,workphone,cellphone,homephone,workemail,fax,workstreet,workpob,workcity,workprovince,workpostalcode,workcountry,type,sid_imported) VALUES ';
			$questionmarks = [];
			$query_data = [];
			foreach ($data['data'] as $record) {
				// Get name and company
				$name = '';
				$company = '';

				if (!empty($record['firstname']))
				{
					$name = $record['firstname'];
				}
				if (!empty($record['lastname']))
				{
					$name .= ($name ? ' ' : '').$record['lastname'];
				}
				if (!empty($record['account_id']))
				{
					$company_id = $record['account_id'];

					// Get company info
					$curl_data = [ 'query' => 'SELECT * FROM Accounts WHERE id=\''.$company_id.'\' LIMIT 1;' ];

					$ch = curl_init();
					curl_setopt($ch, CURLOPT_URL, $base_url.'query');
					curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'POST');
					curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
					curl_setopt($ch, CURLOPT_HEADER, false);
					curl_setopt($ch, CURLOPT_TIMEOUT, 4);
					curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($curl_data));
					curl_setopt($ch, CURLOPT_HTTPHEADER, array(
						"Content-Type: application/json",
						"Authorization: Basic ".$authorization_token,
					));

					$response = curl_exec($ch);
					$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
					$data = json_decode($response, true);

					if ($response === false) {
						error_log("cURL error while looking up company info: (".curl_errno($ch).") ".curl_error($ch));
						exit(1);
					}
					elseif ($httpCode != 200) {
						error_log("Error while looking up company info: (HTTP ".$httpCode.") ".($data['message'] ?? ''));
						exit(1);
					}
					elseif ($data === null) {
						error_log("Error while decoding company lookup response: (".json_last_error().") ".json_last_error_msg());
						exit(1);
					}

					if (!empty($data['data'][0]['accountname'])) {
						$company = $data['data'][0]['accountname'];
					}
					curl_close($ch);
				}

				$questionmarks[] = '(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
				$query_data[] = $name;
				$query_data[] = $company;
				$query_data[] = (($record['salutationtype'] ?? '') == '--None--') ? '' : ($record['salutationtype'] ?? '') ;
				$query_data[] = $record['phone'] ?? '' ;
				$query_data[] = $record['mobile'] ?? '' ;
				$query_data[] = $record['homephone'] ?? '' ;
				$query_data[] = $record['email'] ?? '' ;
				$query_data[] = $record['fax'] ?? '' ;
				$query_data[] = $record['mailingstreet'] ?? '' ;
				$query_data[] = $record['mailingpobox'] ?? '' ;
				$query_data[] = $record['mailingcity'] ?? '' ;
				$query_data[] = $record['mailingstate'] ?? '' ;
				$query_data[] = $record['mailingzip'] ?? '' ;
				$query_data[] = $record['mailingcountry'] ?? '' ;
				$query_data[] = 'vte';
				$query_data[] = 'vte';
			}
			$query_insert .= implode(',',$questionmarks);
			
			$sth = $phonebookdb->prepare($query_insert);
			$sth->execute($query_data);
		}
	}
}

