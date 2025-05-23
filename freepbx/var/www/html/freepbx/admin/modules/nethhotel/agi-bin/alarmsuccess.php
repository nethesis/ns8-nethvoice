#!/usr/bin/env php
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

include_once '/etc/freepbx.conf';
require_once '/var/www/html/freepbx/hotel/functions.inc.php';

$room = $argv[1];
$alarm = $argv[2];

fias('WA2PMS', array(
    'RN' => $room,
    'AS'  => 'OK',
    'DA'  => date('ymd',$alarm),
    'TI'  => date('His',$alarm),
    ));

