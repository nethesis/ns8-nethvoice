#!/usr/bin/env php
<?php
/**
 * This executable allow to reset the phones for provisioning again.
 * It uses Tancredi and Falconieri APIs to:
 * 
 * - create a new tok1 on Tancredi
 * - update the provisioning URL on Falconieri
 * 
 * 
 * Copyright (C) 2025 Nethesis S.r.l.
 * http://www.nethesis.it - nethserver@nethesis.it
 *
 * This script is part of NethServer.
 *
 * NethServer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License,
 * or any later version.
 *
 * NethServer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with NethServer.  If not, see COPYING.
 *
 */

// Check that a mac address or "--all" is provided
if ($argc != 2) {
    echo "usage: $argv[0] [MAC_ADDRESS | --all]\n";
    exit(127);
}

require_once '/etc/freepbx.conf';
require_once '/var/www/html/freepbx/rest/lib/libExtensions.php';

if ($argv[1] == "--all") {
    // Get all phones from rest_devices_phones table
    $sql = "SELECT mac FROM rest_devices_phones WHERE mac IS NOT NULL AND type = 'physical'";
    $sth = $db->prepare($sql);
    $sth->execute();
    $mac_addresses = array_column($sth->fetchAll(\PDO::FETCH_ASSOC), 'mac');
} else {
    $mac_addresses = array($argv[1]);
}

// get FreePBX admin password hash
$sql = "SELECT `password_sha1` FROM `ampusers` WHERE `username` = 'admin'";
$sth = $db->prepare($sql);
$sth->execute();
$fpbxPasswordHash = $sth->fetchAll(\PDO::FETCH_ASSOC)[0]['password_sha1'];
$secretKey = sha1("admin{$fpbxPasswordHash}{$_ENV['NETHVOICESECRETKEY']}");

foreach ($mac_addresses as $mac_address) {
    $mac_address = strtr(strtoupper($mac_address), ':', '-'); // MAC format sanitization
    
    // Call Tancredi API to create a new tok1
    $queryUrl = "http://{$_ENV['NETHVOICE_HOST']}/tancredi/api/v1/phones/{$mac_address}/tok1";
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $queryUrl);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'POST');

    curl_setopt($ch, CURLOPT_HEADER, FALSE);
    curl_setopt($ch, CURLOPT_HTTPHEADER, array(
        "Content-Type: application/json;charset=utf-8",
        "Accept: application/json;charset=utf-8",
        "user: admin",
        "secretkey: $secretKey"
    ));

    $response = curl_exec($ch);
    if (curl_errno($ch)) {
        error_log(__FILE__.':'.__LINE__.' curl error: '.curl_error($ch));
    }
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode != 204) {
        error_log(__FILE__.':'.__LINE__." curl error. Expected code 204, got $httpCode");
        continue;
    }

    // Call Tancredi API to get provisioning url for the phone
    $queryUrl = "http://{$_ENV['NETHVOICE_HOST']}/tancredi/api/v1/phones/{$mac_address}";
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $queryUrl);
    curl_setopt($ch, CURLOPT_HEADER, FALSE);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);
    curl_setopt($ch, CURLOPT_HTTPHEADER, array(
        "Content-Type: application/json;charset=utf-8",
        "Accept: application/json;charset=utf-8",
        "user: admin",
        "secretkey: $secretKey"
    ));

    $response = curl_exec($ch);
    if (curl_errno($ch)) {
        error_log(__FILE__.':'.__LINE__.' curl error: '.curl_error($ch));
    }
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode != 200) {
        error_log(__FILE__.':'.__LINE__." curl error. Expected code 200, got $httpCode");
        continue;
    }

    $response = (array) json_decode($response, TRUE);
    $provisioningUrl = $response['provisioning_url1'];

    // Call Falconieri to set new provisioning url for phone
    $result = setFalconieriRPS($mac_address, $provisioningUrl);
    if ($result['httpCode'] != 200) {
        error_log(__FILE__.':'.__LINE__." Failed to set RPS for $mac_address. HTTP code: {$result['httpCode']}");
        continue;
    }
    echo "Configured new provisioning url for $mac_address";
}