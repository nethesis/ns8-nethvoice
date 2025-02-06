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
 *   This sample page is called by NethCTI ParamURL.
 *
 * - It retrieve the customer code from $customercode_api_url
 * - replace same variables as parameterized URL
 *   ($CALLER_NUMBER, $CALLER_NAME, $CALLED, $UNIQUEID)
 * - read it in answer variable $customercode_api_variable
 * - redirect user to $final_url using replacing "$CUSTOMER_CODE"
 *   with the customer code retrieved from the API
 *
 *   HOW TO USE
 * - copy this sample to /var/www/html/customercode_proxy.php
 * - configure a Parametrized URL with this url:
 *   https://nethvoice_hostname/customercode_proxy.php?CALLER_NUMBER=$CALLER_NUMBER
 * - change $customercode_api_url with url of API that give customercode from number
 * - change $customercode_api_variable with the name of the customercode variable in the response
 * - change $final_url with the url of the page that CTI should open
 *
 * *************************************************/

$customercode_api_url = 'https://example.com/id_from_number.php?phonenumber=$CALLER_NUMBER';
$customercode_api_variable = 'customercode';
$final_url = 'https://www.example.com/customer.php?id=$CUSTOMER_CODE';

// Replace input variables in API URL
foreach (['CALLER_NUMBER', 'CALLER_NAME', 'CALLED', 'UNIQUEID'] as $key) {
	$value = (isset($_GET[$key])) ? $_GET[$key] : '';
	$customercode_api_url = str_replace('$'.$key,$value,$customercode_api_url);
	$final_url= str_replace('$'.$key,$value,$final_url);
}

// use curl to get customer code from the external service
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $customercode_api_url);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'GET');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 4);
//
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
if ($httpCode == 200) {
	$result = json_decode($response, TRUE);
	$customer_code = $result[$customercode_api_variable];
} else {
	$customer_code = '';
}
// Reaplace "$CUSTOMER_CODE" in final_url URL with the customer code retrieved from the API or ''
$final_url= str_replace('$CUSTOMER_CODE',$customer_code,$final_url);

// Redirect to the final_url
header("Location: $final_url");
