#!/usr/bin/env php
<?php

#
#    Copyright (C) 2019 Nethesis S.r.l.
#    http://www.nethesis.it - support@nethesis.it
#
#    This file is part of Pin FreePBX module.
#
#    Pin module is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or any 
#    later version.
#
#    Pin module is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with Pin module.  If not, see <http://www.gnu.org/licenses/>.
#

define("AGIBIN_DIR", "/var/lib/asterisk/agi-bin");

$restrict_mods = true; //dont load any functions.inc.phps
include_once('/etc/freepbx.conf');
include_once(AGIBIN_DIR."/phpagi.php");

function neth_debug($msg,$force=false) {
    global $agi;
    $debug=true;
    if ($debug || $force) {
        if (is_array($msg)) {
            $msg = print_r($msg,true);
        }
    	@$agi->verbose($msg);
    }
}

/******************************************************/

$agi = new AGI();

$exten = $argv[1];

$dbh = FreePBX::Database();
$sql = 'SELECT `pin`,`enabled` FROM pin WHERE extension = ?';
$sth = $dbh->prepare($sql);
$sth->execute(array($exten));
$res = $sth->fetchAll(\PDO::FETCH_ASSOC)[0];

// allow call if pin isn't configured or it isn't enabled
if (empty($res) or $res['enabled'] != 1 or empty($res['pin'])) {
    neth_debug('pin not configured for extension '.$exten);
    exit(0);
}

$agi->answer();
@$agi->exec("wait","1");

for ($i = 1; $i <=3; $i ++) {
    @$agi->stream_file("insert-pin-followed-by-hash-after-beep");
    $return = $agi->get_data('beep', 10000, 20);
    $pin = $return['result'];
    if ($pin == $res['pin']) {
        neth_debug('correct pin');
        @$agi->stream_file("pin-is-correct");
        exit(0);
    }
    @$agi->stream_file("pin-is-incorrect ");
    neth_debug('incorrect pin');
}
neth_debug('incorrect pin inserted for 3 times, hangup');
$agi->exec("Macro","hangupcall");

