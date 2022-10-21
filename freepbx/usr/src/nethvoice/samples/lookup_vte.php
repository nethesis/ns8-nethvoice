#!/usr/bin/env php
<?php

#
# Copyright (C) 2022 Nethesis S.r.l.
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
 *   Use VTE REST API to resolve call numbers
 *   HOW TO USE:
 *   - copy this script in /usr/src/nethvoice/lookup.d/ directory
 *   - Change $url with your API URL
 *   - Put your authorization token into $authorization_token
 *
 * *************************************************/

// URL of the API
$url = 'https://trial01.vtecrm.net/40182/restapi/v1/vtews/get_caller_info';

// Authorization token used for authentication
$authorization_token = '';


$number = $argv[1];

$data = ['callerNumber'=>$number];

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'POST');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 4);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, array(
	"Content-Type: application/json;charset=utf-8",
	"Accept: application/json;charset=utf-8",
	"Authorization: Basic ".$authorization_token,
));

$res = json_decode(curl_exec($ch),TRUE);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($res['status'] != 200 || $httpCode != 200) {
	error_log("Error resolving name for $number: ".$res['status']);
	exit(1);
}

if ($res['data'] != false && !empty($res['data']['name'])) {
	// Try to extract company name from received string
	$pattern = '/^(.*) \(([^)]*)\)$/';
	preg_match($pattern,$res['data']['name'],$matches);

	if (empty($matches)) {
		$name = $res['data']['name'];
		$company = "";
	} else {
		$name = $matches[1];
		$company = $matches[2];
	}

	echo json_encode(
		[
			"company" => $company,
			"name" => $name,
			"number" => $number,
		]
	);
}
