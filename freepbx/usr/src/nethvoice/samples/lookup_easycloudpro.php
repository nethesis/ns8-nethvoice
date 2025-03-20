#!/usr/bin/env php
<?php

#
# Copyright (C) 2025 Nethesis S.r.l.
# http://www.nethesis.it - nethserver@nethesis.it
#
# You should have received a copy of the GNU General Public License
# along with NethServer.  If not, see COPYING.
#


/***************************************************
 *
 *   Use EasyCloudPro REST API to resolve call numbers
 *   HOW TO USE:
 *   - copy this script in /usr/src/nethvoice/lookup.d/ directory
 *   - Change $url with your API URL
 *   - Put your authorization token into $authorization_token
 *
 * *************************************************/

// URL of the API
// Example: https://easycloudpro.nethesis.org/Web/Api/Service/GetContatto
$url = '';

// Authorization token used for authentication
$authorization_token = '';

// Get the number to resolve
$number = $argv[1];

// Remove international prefix
$number = preg_replace('/^(\+|00)(\d{1,3})/', '', $number);

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url.'?numero='.$number.'&token='.$authorization_token);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'GET');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 4);
curl_setopt($ch, CURLOPT_HTTPHEADER, array(
	"Content-Type: application/json;charset=utf-8",
	"Accept: application/json;charset=utf-8"
));

$res = json_decode(curl_exec($ch),TRUE);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode != 200) {
	error_log("Error resolving name for $number");
	exit(1);
}

$output = array();
if (!empty($res['Company'])) {
	$output['company'] = $res['Company'];
}
if (!empty($res['Name'])) {
	$output['name'] = $res['Name'];
}
if (!empty($res['Number'])) {
	$output['number'] = $res['Number'];
}

echo json_encode($output);
