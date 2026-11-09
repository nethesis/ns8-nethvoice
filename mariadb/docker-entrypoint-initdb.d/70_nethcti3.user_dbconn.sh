#!/bin/bash

#
# Copyright (C) 2023 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

/usr/bin/mariadb -uroot -p${MARIADB_ROOT_PASSWORD} nethcti3 -e 'INSERT INTO user_dbconn (`id`,`host`,`port`,`type`,`user`,`pass`,`name`,`creation`) VALUES (1,"127.0.0.1","'${NETHVOICE_MARIADB_PORT}'","mysql","'${NETHCTI_DB_USER}'","'${NETHCTI_DB_PASSWORD}'","phonebook",NOW())'
/usr/bin/mariadb -uroot -p${MARIADB_ROOT_PASSWORD} nethcti3 -e 'INSERT INTO user_dbconn (`id`,`host`,`port`,`type`,`user`,`pass`,`name`,`creation`) VALUES (2,"127.0.0.1","'${NETHVOICE_MARIADB_PORT}'","mysql","'${AMPDBUSER}'","'${AMPDBPASS}'","asteriskcdrdb",NOW())'
