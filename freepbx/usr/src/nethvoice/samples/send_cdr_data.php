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
 *   This sample page is called by NethCTI CdrScript at the end of the call
 *
 *   CDR values are in arguments
 *
 * *************************************************/


$ext_url = 'https://www.mycrm.com';

$data = array();
$data['src'] = $argv[1];
$data['channel'] = $argv[2];
$data['uniqueid'] = $argv[6];
$data['linkedid'] = $argv[6];
$data['clid'] = $argv[7];
$data['calldate'] = $argv[8];
$data['dst'] = $argv[10];
$data['disposition'] = $argv[11];
$data['lastapp'] = $argv[12];
$data['duration'] = $argv[13];
$data['dcontext'] = $argv[14];
$data['accountcode'] = $argv[16];
$data['cnum'] = $argv[16];
//use curl to send CDR data to $ext_url
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $ext_url);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, false);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, array(
	"Content-Type: application/json;charset=utf-8",
	"Accept: application/json;charset=utf-8",
));
//
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode != 200) {
	error_log('Error sending CDR data: ' . print_r($response,1));
	exit(1);
}

