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
 *   This sample page is called by node-crm package (https://github.com/nethesis/node-crm).
 *
 *   - change API URL in $url variable and Authorization token in $authorization_token
 *   - configure node-crm configuration file (/usr/lib/node-crm/config.json) 
 *     with "execute":"local" and "local" -> "path": with this file path (/usr/src/nethvoice/samples/vte_incoming_call.php)
 * 
 *  Test:
 *  php /usr/src/nethvoice/samples/vte_incoming_call.php 1234567 $(date +%s) '+391234567890' 'Stefano Fancello (Nethesis)' 300
 *
 * *************************************************/

// API URL
$url = 'https://HOST/40182/restapi/v1/vtews/notify_incoming_call';
// Authorization token used for authentication
$authorization_token = '';

$uid = $argv[1];
$time = $argv[2];
$cidnum = $argv[3];
$cidname = $argv[4];
$extnum = $argv[5];

$data = [
		"uniqueid"=>$uid,
		"extension"=>$extnum,
		"callerNumber"=>$cidnum,
		"callerName"=>$extnum,
	];

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
	error_log("Error calling external API: ".$res['status']);
	exit(1);
}
