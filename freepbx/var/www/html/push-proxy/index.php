<?php
#
# Copyright (C) 2020 Nethesis S.r.l.
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

#
# Push notification local proxy
# To enable debug output, call the script with 'debug' parameter (GET or POST)
#



include_once '/etc/freepbx_db.conf';

# Parse extension from format: sip:xxx@xx.xx.xx.xx;fs-conn-id=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx=tls:host.publicname.com#012
$extension = substr($_REQUEST['to'], 4, strpos($_REQUEST['to'], '@')-4);
$callid = $_REQUEST['callid'];
$from = $_REQUEST['from'];
$caller = $_REQUEST['caller'];
$debug = false;
if (isset($_REQUEST['loglevel']) && ($_REQUEST['loglevel'] == "debug") ) {
    $debug = true;
}

# Debug received parameters
if ($debug) {
    syslog(LOG_INFO, "push-proxy: extension => $extension");
    syslog(LOG_INFO, "push-proxy: callid => $callid");
    syslog(LOG_INFO, "push-proxy: from => $from");
    syslog(LOG_INFO, "push-proxy: caller => $caller");
}


# Get credentials for notification server
try {
    $serverCredentials = json_decode(file_get_contents('/etc/asterisk/nethcti_push_configuration.json'),TRUE);
    if (is_null($serverCredentials) && $debug) {
        syslog(LOG_INFO, "push-proxy: no configuration file");
    }
} catch (Exception $e) {
    exit(1);
}


// Get users for the extensions
$query = 'SELECT DISTINCT userman_users.username,rest_devices_phones.extension FROM userman_users JOIN rest_devices_phones on userman_users.id = rest_devices_phones.user_id WHERE rest_devices_phones.extension = ? AND rest_devices_phones.type = "mobile"';
$sth = $db->prepare($query);
$sth->execute(array($extension));
$results = $sth->fetchAll(\PDO::FETCH_ASSOC);
if (empty($results)) {
    if ($debug) {
       syslog(LOG_INFO, "push-proxy: no device to wakeup");
    }
    exit(0);
}

// Wake up extensions
$errors = 0;
foreach ($results as $result) {
    $username = $result['username'];
    $extension = $result['extension'];
    if ($debug) {
        syslog(LOG_INFO, "push-proxy: waking up $username@{$serverCredentials['Host']}");
    }

    // Call notification service
    $data = array(
        "Message" => "",
        "TypeMessage" => 2,
        "UserName" => $username.'@'.$serverCredentials['Host'],
        "Sound" => "",
        "Badge" => 0,
        "CustomField1" => "IC_MSG",
        "CustomField2" => $callid
    );
    $data = json_encode($data);
    $ch = curl_init();
    $headers = array(
        "Content-Type: application/json",
        "X-HTTP-Method-Override: SendPushAuth",
        "Content-length: ".strlen($data),
        );
    if (!empty($serverCredentials['AppBrandingID'])) {
        $headers[] = 'X-BrandID: '. $serverCredentials['AppBrandingID'];
    }
    curl_setopt($ch, CURLOPT_URL, $serverCredentials['NotificationServerURL']);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'POST');
    curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
    curl_setopt($ch, CURLOPT_USERPWD, $serverCredentials['SystemId'] . ':' . $serverCredentials['Secret']);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if ($httpCode >= 400) {
        $errors++;
        syslog(LOG_WARNING, "push-proxy: waking up $username@{$serverCredentials['Host']} failed");
    }
    curl_close($ch);
}

if ($errors > 0) {
    http_response_code(500);
    exit(1);
} else {
    http_response_code(200);
    exit(0);
}
