#!/usr/bin/env php
<?php

#
# Copyright (C) 2025 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#


/***************************************************
 *
 *   Use VTE REST API to resolve call numbers
 *   HOW TO USE:
 *   - copy this script in /usr/src/nethvoice/lookup.d/ directory
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

$name    = '';
$company = '';
$number  = $argv[1] ?? 'NONUMBER';

// Lookup number passed as argument
$curl_data = ['query'=>'SELECT * FROM Contacts WHERE phone = \''.$number.'\' OR homephone = \''.$number.'\' OR otherphone = \''.$number.'\' OR mobile = \''.$number.'\' LIMIT 1;'];

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
	error_log("cURL error while resolving phone number ".$number.": (".curl_errno($ch).") ".curl_error($ch));
	exit(1);
}
elseif ($httpCode != 200) {
	error_log("Error while resolving phone number ".$number.": (HTTP ".$httpCode.") ".($data['message'] ?? ''));
	exit(1);
}
elseif ($data === null) {
	error_log("Error while decoding phone lookup response: (".json_last_error().") ".json_last_error_msg());
	exit(1);
}
curl_close($ch);

// Get name and company
if (!empty($data['data'][0]['firstname']))
{
	$name = $data['data'][0]['firstname'];
}
if (!empty($data['data'][0]['lastname']))
{
	$name .= ($name ? ' ' : '').$data['data'][0]['lastname'];
}
if (!empty($data['data'][0]['account_id']))
{
	$company_id = $data['data'][0]['account_id'];

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
	curl_close($ch);

	if (!empty($data['data'][0]['accountname'])) {
		$company = $data['data'][0]['accountname'];
	}
}


echo json_encode(
	[
		"company" => $company,
		"name"    => $name,
		"number"  => $number,
	]
);