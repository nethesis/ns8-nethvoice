#!/bin/bash

#
# Copyright (C) 2023 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

/usr/bin/mysql -uroot -p${MARIADB_ROOT_PASSWORD} asterisk -e 'INSERT INTO `kvstore_Sipsettings` (`key`,`val`,`type`,`id`) VALUES ("rtpstart","'${ASTERISK_RTPSTART}'",NULL,"noid"), ("rtpend","'${ASTERISK_RTPEND}'",NULL,"noid");'
/usr/bin/mysql -uroot -p${MARIADB_ROOT_PASSWORD} asterisk -e 'INSERT INTO `sipsettings` (`keyword`,`data`,`seq`,`type`) VALUES ("rtpstart","'${ASTERISK_RTPSTART}'",0,0), ("rtpend","'${ASTERISK_RTPEND}'",0,0)';
