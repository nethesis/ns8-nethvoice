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

try {
    # Initialize FreePBX environment
    $bootstrap_settings['freepbx_error_handler'] = false;
    define('FREEPBX_IS_AUTH',1);
    $tftpdir = "/var/lib/tftpboot";
    $name = $argv[1];

    $sql = "SELECT `id`,`model_id`,`ipv4`,`ipv4_new`,`gateway`,`mac` FROM `gateway_config` WHERE `name` = ?";
    $prep = array($name);
    if (isset($argv[2])) {
        $mac=$argv[2];
        $sql .= " AND `mac` = ?";
        $prep[] = $mac;
    } else {
        $mac = false;
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

    if (!isset($config['mac'])|| $config['mac']==''){
        $config['mac'] = 'AAAAAAAAAAAA';
    }
    if ($config['manufacturer'] == 'Sangoma'){
        unlink($tftpdir."/".preg_replace('/:/','',$config['mac'])."config.txt");
        unlink($tftpdir."/".preg_replace('/:/','',$config['mac'])."script.txt");
    } else {
        unlink($tftpdir."/".preg_replace('/:/','',$config['mac']).".cfg");
    }
} catch (Exception $e){
        error_log($e->getMessage());
        exit(1);

}
