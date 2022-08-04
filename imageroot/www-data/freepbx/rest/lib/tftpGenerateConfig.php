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

include_once(__DIR__. '/gateway/functions.inc.php');
require_once('/etc/freepbx.conf');

try {
    # Initialize FreePBX environment
    $bootstrap_settings['freepbx_error_handler'] = false;
    define('FREEPBX_IS_AUTH',1);

    #create configuration files
    $name = $argv[1];
    if (isset($argv[2])) {
        $mac=$argv[2];
    } else {
        $mac = false;
    }
    $tftpdir = "/var/lib/tftpboot";
    $config = gateway_get_configuration($name,$mac);
    if (!isset($config['mac'])|| $config['mac']==''){
        $config['mac'] = 'AAAAAAAAAAAA';
    }
    if ($config['manufacturer'] == 'Sangoma'){
        $filename = preg_replace('/:/','',$config['mac'])."config.txt";
        $scriptname = preg_replace('/:/','',$config['mac'])."script.txt";
        copy("/var/www/html/freepbx/rest/lib/gateway/templates/Sangoma/script.txt","$tftpdir/$scriptname");
    } else {
        $filename = preg_replace('/:/','',$config['mac']).".cfg";
    }
    file_put_contents($tftpdir."/".$filename,gateway_generate_configuration_file($name,$mac), LOCK_EX);
} catch (Exception $e){
        error_log($e->getMessage());
        exit(1);
}
