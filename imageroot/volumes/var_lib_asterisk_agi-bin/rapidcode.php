#!/usr/bin/env php
<?php

#
#    Copyright (C) 2017 Nethesis S.r.l.
#    http://www.nethesis.it - support@nethesis.it
#
#    This file is part of RapidCode FreePBX module.
#
#    RapidCode is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or any
#    later version.
#
#    RapidCode is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with RapidCode.  If not, see <http://www.gnu.org/licenses/>.
#

include_once ("/etc/freepbx.conf");
define("AGIBIN_DIR", "/var/lib/asterisk/agi-bin");
define("DEBUG", "FALSE");
include(AGIBIN_DIR."/phpagi.php");

global $db;
$agi = new AGI();

try {
    $code = preg_replace('/^'.str_replace('*','\*',$argv[2]).'/', '', $argv[1]);
    $sql = 'SELECT number FROM `rapidcode` WHERE `code` = ?';

    $sth = $db->prepare($sql);
    $sth->execute(array($code));
    $num_to_call = $sth->fetchAll()[0][0];
    $agi->set_variable("RAPIDCODENUM",$num_to_call);

    if (!isset($num_to_call) || empty($num_to_call)) {
        throw new Exception("Empty num to call for $code");
    }
} catch (Exception $e) {
    @$agi->verbose('Rapidcode ERROR: '.$e->getMessage());
}
