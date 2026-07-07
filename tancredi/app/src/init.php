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

if( ! ini_get('date.timezone')) {
    ini_set('date.timezone', 'UTC');
}

// Default configuration
$default_config = array(
    'logfile' => "",
    'loglevel' => "DEBUG",
    'ro_dir' => __DIR__ . "/../data/",
    'rw_dir' => __DIR__ . "/../data/"
);

// Read configuration from file
$cfg_file = getenv("tancredi_conf") ?: '/etc/tancredi.conf';
$ini_config = false;

if (file_exists($cfg_file)) {
    $ini_config = parse_ini_file($cfg_file,true);
}

if($ini_config === false) {
    http_response_code(500);
    header("Content-Type: text/plain ;charset=UTF-8");
    echo("Bad configuration\n\nCould not parse $cfg_file\n");
    exit(1);
}

$GLOBALS['config'] = array_merge($default_config, isset($ini_config['config']) ? $ini_config['config'] : array());
$GLOBALS['macvendors'] = isset($ini_config['macvendors']) ? $ini_config['macvendors'] : array();
