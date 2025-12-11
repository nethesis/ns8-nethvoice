<?php

#
# Copyright (C) 2025 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#


/***************************************************
 *
 *   This sample page is called by node-crm package (https://github.com/nethesis/node-crm).
 *
 *   - Change $base_url with your vte API base URL 
 *   - Put your authorization info into $username and $accesskey variables
 *   - Copy this script in /var/lib/asterisk/agi-bin/ directory and set proper ownership and permissions
 *   - Set in environment NETHCTI_CDR_SCRIPT_CALL_IN=/var/lib/asterisk/agi-bin/vte_incoming_call.php
 *   - Restart freepbx
 * 
 *  Test:
 *  /var/lib/asterisk/agi-bin/vte_incoming_call.php dummy1 dummy2 dummy3 dummy4 dummy5 1234567 dummy7 $(date +%s) dummy9 dummy10 dummy11 dummy12 dummy13 dummy14 dummy15 '+391234567890' 'Stefano Fancello (Nethesis)' dummy18 dummy19 300
 *
 * *************************************************/

// URL of the API
$base_url = 'https://vtecrm.example.com/restapi/v1/vtews/';

$username  = '';
$accesskey = '';


// Authorization token used for authentication
$authorization_token = base64_encode($username.':'.$accesskey);

$uid     = $argv[6];
$time    = $argv[8];
$cidnum  = $argv[16];
$cidname = $argv[17];
$extnum  = $argv[20];

$curl_data = [
	"uniqueid"     => $uid,
	"extension"    => $extnum,
	"callerNumber" => $cidnum,
	"callerName"   => $cidname,
];

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $base_url.'notify_incoming_call');
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
	error_log("cURL error while notifying incoming call: (".curl_errno($ch).") ".curl_error($ch));
	exit(1);
}
elseif ($httpCode != 200) {
	error_log("Error while notifying incoming call: (HTTP ".$httpCode.") ".($data['message'] ?? ''));
	exit(1);
}
elseif ($data === null) {
	error_log("Error while decoding notify incoming call response: (".json_last_error().") ".json_last_error_msg());
	exit(1);
}
curl_close($ch);