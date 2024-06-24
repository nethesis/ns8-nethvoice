<?php
#
# Copyright (C) 2017 Nethesis S.r.l.
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

require_once('/etc/freepbx.conf');

try{
    $name = $argv[1];
    if (isset($argv[2])) {
        $mac=$argv[2];
    } else {
        $mac = false;
    }

    $tftpdir = "/var/lib/tftpboot";

    $bootstrap_settings['freepbx_error_handler'] = false;
    define('FREEPBX_IS_AUTH',1);

    $dbh = FreePBX::Database();
    /*Check if config exists*/
    $sql = "SELECT `id`,`model_id`,`ipv4`,`ipv4_new`,`gateway`,`ipv4_green`,`netmask_green`,`mac` FROM `gateway_config` WHERE `name` = ?";
    $prep = array($name);
    if (isset($mac) && !empty($mac)) {
        $sql .= " AND `mac` = ?";
        $prep[] = $mac;
    }
    $sth = FreePBX::Database()->prepare($sql);
    $sth->execute($prep);
    $config = $sth->fetch(\PDO::FETCH_ASSOC);
    if ($config === false){
        /*Configuration doesn't exist*/
        error_log("Configuration not found");
        exit(1);
    }
    $sql = "SELECT `model`,`manufacturer` FROM `gateway_models` WHERE `id` = ?";
    $sth = FreePBX::Database()->prepare($sql);
    $sth->execute(array($config['model_id']));
    $res = $sth->fetch(\PDO::FETCH_ASSOC);
    $config['model'] = $res['model'];
    $config['manufacturer'] = $res['manufacturer'];

    if ($config['manufacturer'] == 'Sangoma'){
        $filename = preg_replace('/:/','',$config['mac'])."config.txt";
        $scriptname = preg_replace('/:/','',$config['mac'])."script.txt";
        $script = "sangoma-tftp";
        $deviceUsername = 'admin';
        $devicePassword = 'admin';
    } elseif ($config['manufacturer'] == 'Patton' && !preg_match ('/^TRI_/', $config['model'])){
        $filename = preg_replace('/:/','',$config['mac']).".cfg";
        $script = "patton-tftp";
        $deviceUsername = '.';
        $devicePassword = '';
    } elseif ($config['manufacturer'] == 'Patton' && preg_match ('/^TRI_/', $config['model'])){
        $filename = preg_replace('/:/','',$config['mac']).".cfg";
        $script = "trinity-tftp";
        $deviceUsername = '.';
        $devicePassword = '';
    } elseif ($config['manufacturer'] == 'Mediatrix'){
        $filename = preg_replace('/:/','',$config['mac']).".cfg";
        $script = "mediatrix-tftp";
        $deviceUsername = 'admin';
        $devicePassword = 'administrator';
    }

    $cmd='/var/www/html/freepbx/rest/lib/gateway/pushtftp/'.$script.' '.escapeshellarg($config['ipv4']).' '.escapeshellarg($config['ipv4_green']).' '.escapeshellarg($filename).' '.escapeshellarg($deviceUsername).' '.escapeshellarg($devicePassword);
    exec($cmd,$return);
} catch (Exception $e){
    error_log($e->getMessage());
    exit(1);
}
