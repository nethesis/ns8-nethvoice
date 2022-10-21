<?php

/*
 * Copyright (C) 2020 Nethesis S.r.l.
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
 */

require_once __DIR__.'/../vendor/autoload.php';
require_once '/etc/freepbx_db.conf';
include_once '/var/www/html/freepbx/rest/lib/libExtensions.php';

$logger = new \Monolog\Logger('migration');
$logger->pushProcessor(new \Monolog\Processor\PsrLogMessageProcessor());
if( ! empty($config['logfile'])) {
    $handler = new \Monolog\Handler\StreamHandler($config['logfile']);
    $formatter = new \Monolog\Formatter\LineFormatter("[%datetime%] %channel%.%level_name%: %message%\n");
    ini_set('error_log',$config['logfile']);
} else {
    $handler = new \Monolog\Handler\ErrorLogHandler();
    // We assume the error_log already adds a time stamp to log messages:
    $formatter = new \Monolog\Formatter\LineFormatter("%channel%.%level_name%: %message%");
}

$handler->setFormatter($formatter);
$handler->setLevel($logger::INFO);
$logger->pushHandler($handler);
$logger->pushHandler(new \Monolog\Handler\StreamHandler("php://stdout",$logger::INFO));

\Monolog\ErrorHandler::register($logger);


if ($argc != 3) {
    $logger->error("Wrong argument count $argc. ({$argv[0]} <LK> <secret> expected)");
    echo "Usage: {$argv[0]} <LK> <secret>\n";
    exit(1);
}

$lk = $argv[1];
$secret = $argv[2];

$storage = new \Tancredi\Entity\FileStorage($logger,$config);

$logger->info("Migrating phones from old provisioning");

# Get all Tancredi supported models
$tancredi_models = $storage->listScopes('model');

# Get old phones
$sql = "SELECT 
        CONCAT(SUBSTRING(mac,1,2),'-',SUBSTRING(mac,3,2),'-',SUBSTRING(mac,5,2),'-',SUBSTRING(mac,7,2),'-',SUBSTRING(mac,9,2),'-',SUBSTRING(mac,11,2)) as mac,
        CONCAT(LOWER(REPLACE(endpointman_brand_list.name, 'Yealink/Dreamwave', 'Yealink')),'-',endpointman_model_list.model) as oldmodel,
        REPLACE(endpointman_brand_list.name, 'Yealink/Dreamwave', 'Yealink') as brand
        FROM endpointman_mac_list JOIN endpointman_model_list ON endpointman_model_list.id = endpointman_mac_list.model
        JOIN endpointman_brand_list ON endpointman_brand_list.id = endpointman_model_list.brand
        WHERE SUBSTRING(endpointman_mac_list.mac,1,6) IN ('00A859','0C383E','7C2F80','589EC6','005058','000413','001565','805E0C','805EC0','9C7514')";
$sth = $db->prepare($sql);
$sth->execute(array());
$res = $sth->fetchAll(\PDO::FETCH_ASSOC);
$logger->debug(json_encode($res));

# Cycle through old phones
foreach ($res as $phone) {
    # Old model - Tancredi model map
    $model_map = array(
        'fanvil-X3S' => 'fanvil-X3SG',
        'fanvil-X5S' => 'fanvil-X5',
        'gigaset-Maxwell-2' => 'gigaset-Maxwell2',
        'gigaset-Maxwell-3' => 'gigaset-Maxwell3',
        'gigaset-Maxwell-Basic' => 'gigaset-MaxwellBasic',
        'yealink-T19P_E2' => 'yealink-T19',
        'yealink-T21P' => 'yealink-T21',
        'yealink-T21P_E2' => 'yealink-T21',
        'yealink-T23P_G' => 'yealink-T23',
        'yealink-T27G' => 'yealink-T27',
        'yealink-T27P' => 'yealink-T27',
        'yealink-T29G' => 'yealink-T29',
        'yealink-T40G' => 'yealink-T40',
        'yealink-T40P' => 'yealink-T40',
        'yealink-T41P' => 'yealink-T41',
        'yealink-T41S' => 'yealink-T41',
        'yealink-T42G' => 'yealink-T42',
        'yealink-T42S' => 'yealink-T42',
        'yealink-T46G' => 'yealink-T46',
        'yealink-T46S' => 'yealink-T46',
        'yealink-T48G' => 'yealink-T48',
        'yealink-T48S' => 'yealink-T48',
        'yealink-T49G' => 'yealink-T49',
        'yealink-T52S' => 'yealink-T52',
        'yealink-T53W' => 'yealink-T53',
        'yealink-T54S' => 'yealink-T54',
        'yealink-T54W' => 'yealink-T54',
        'yealink-T56A' => 'yealink-T56',
        'yealink-T57W' => 'yealink-T57',
        'yealink-T58A' => 'yealink-T58'
    );

    unset($model);
    if (isset($model_map[$phone['oldmodel']])) {
        $model = $model_map[$phone['oldmodel']];
    } elseif (array_search($phone['oldmodel'],$tancredi_models)) {
        $model = $phone['oldmodel'];
    }

    # Add phones to tancredi
    $scope = new \Tancredi\Entity\Scope($phone['mac'], $storage, $logger);
    $scope->metadata['displayName'] = $phone['brand'];
    $scope->metadata['inheritFrom'] = isset($model) ? $model : null ;
    $scope->metadata['scopeType'] = 'phone';
    $scope->setVariables();
    \Tancredi\Entity\TokenManager::createToken(uniqid($prefix = rand(), $more_entropy = TRUE), $phone['mac'] , TRUE); // create first time access token
    \Tancredi\Entity\TokenManager::createToken(uniqid($prefix = rand(), $more_entropy = TRUE), $phone['mac'] , FALSE); // create token
    $phone_scope = \Tancredi\Entity\Scope::getPhoneScope($phone['mac'], $storage, $logger);
    @$logger->info("Added {$phone['brand']} model {$model} ({$phone['mac']}) from model {$phone['oldmodel']}.");
    # Configure RPS with Falconieri
    $falconieri_result = setFalconieriRPS($phone['mac'], $phone_scope['provisioning_url1'], $lk, $secret);
    if ($falconieri_result['httpCode'] != 200) {
        $logger->error("Error adding {$phone['mac']} phone to RPS. See logs for details.");
    }

    // Update model into rest_devices_phones
    $sql = "UPDATE rest_devices_phones SET model = ? WHERE mac = ?";
    $sth = $db->prepare($sql);
    $sth->execute(array($model,preg_replace('/-/',':',$phone['mac'])));
}

# Set default hostname and scheme
$patch_data['hostname'] = gethostname();
$check = connectivitycheck($patch_data['hostname'],'https');

if ($check !== false && $check['is_reachable'] && $check['valid_certificate']) {
    $patch_data['provisioning_url_scheme'] = 'https';
    $logger->notice("A valid SSL certificate for HTTPS was found. Encryption is enabled.");
} elseif ($check !== false && $check['is_reachable']) {
    $patch_data['provisioning_url_scheme'] = 'http';
    $logger->warning("Cannot find a valid SSL certificate. Encryption is disabled.");
} else {
    $patch_data['provisioning_url_scheme'] = 'http';
    unset($patch_data['hostname']);
    $logger->error("Hostname and SSL settings cannot be set automatically!");
}

$logger->notice('Review the Default settings in the NethVoice administrative interface');
$scope = new \Tancredi\Entity\Scope('defaults', $storage, $logger);
foreach ($patch_data as $patch_key => $patch_value) {
    if (is_null($patch_value)) {
        unset($scope->data[$patch_key]);
        unset($patch_data[$patch_key]);
    }
}
$scope->setVariables($patch_data);
