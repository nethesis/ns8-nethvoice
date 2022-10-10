<?php

#
# Copyright (C) 2018 Nethesis S.r.l.
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

include_once ("/etc/freepbx.conf");
include_once ("/var/www/html/freepbx/rest/lib/libMigration.php");

try {
    $oldCDRDB = OldCDRDB::Database();
    $statusfile = '/var/run/nethvoice/cdrmigration';

    if (file_exists($statusfile)) {
        unlink($statusfile);
    }

    // get number of calls in old db
    $sql = 'SELECT COUNT(*) FROM cdr';
    $sth = $oldCDRDB->prepare($sql);
    $sth->execute(array());
    $count = $sth->fetchAll()[0][0];

    $newCDRDB = NewCDRDB::Database();
    $offset = 0;
    $progress = 0;
    while ($offset < $count) {
        if ($offset>0) {
            $progress = (int) ceil ( ( $offset / $count ) * 100 );
        }
        file_put_contents($statusfile,json_encode(array('progress' => $progress)));
        $sql = "SELECT * FROM cdr LIMIT 100 OFFSET $offset";
        $sth = $oldCDRDB->prepare($sql);
        $sth->execute(array());

        while ($row = $sth->fetch(\PDO::FETCH_ASSOC)) {
            $c = array();
            $tmp = explode('|',$row['userfield']);
            if (isset($tmp[0])) {
                $c[0] = $tmp[0];
            } else {
                $c[0] = '';
            }
            if (isset($tmp[1])) {
                $c[1] = $tmp[1];
            } else {
                $c[1] = '';
            }
            if (isset($tmp[2])) {
                $c[2] = $tmp[2];
            } else {
                $c[2] = '';
            }
            $sql2 = 'INSERT INTO cdr (`calldate`,`clid`,`src`,`dst`,`dcontext`,`channel`,`dstchannel`,`lastapp`,`lastdata`,`duration`,`billsec`,`disposition`,`amaflags`,`accountcode`,`uniqueid`,`recordingfile`,`did`,`linkedid`,`sequence`,`peeraccount`,`cnum`,`cnam`,`ccompany`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
            $sth2 = $newCDRDB->prepare($sql2);
            $sth2->execute(array(
                $row['calldate'],
                $row['clid'],
                $row['src'],
                $row['dst'],
                $row['dcontext'],
                $row['channel'],
                $row['dstchannel'],
                $row['lastapp'],
                $row['lastdata'],
                $row['duration'],
                $row['billsec'],
                $row['disposition'],
                $row['amaflags'],
                $row['accountcode'],
                $row['uniqueid'],
                $row['recordingfile'],
                $row['did'],
                $row['linkedid'],
                $row['sequence'],
                $row['peeraccount'],
                $c[0],
                $c[1],
                $c[2]
            ));
            $offset += 1;
        }
    }
    file_put_contents($statusfile,json_encode(array('status' => true, 'progress' => $progress)));
} catch (Exception $e) {
    error_log($e->getMessage());
    file_put_contents($statusfile,json_encode(array('status' => false, 'progress' => $progress, 'errors' => $e->getMessage())));
}


