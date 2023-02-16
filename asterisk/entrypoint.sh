#!/bin/bash

#
# Copyright (C) 2022 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

# initialize manager.conf with credentials from environment
if [[ ! -f /etc/asterisk/manager.conf ]]; then
        # Configure asterisk manager
        cat > /etc/asterisk/manager.conf <<EOF
[general]
enabled = yes
port = ${ASTMANAGERPORT:-5038}
bindaddr = 0.0.0.0
displayconnects=no

[${AMPMGRUSER}]
secret = ${AMPMGRPASS}
deny=0.0.0.0/0.0.0.0
permit=127.0.0.1/255.255.255.0
read = system,call,log,verbose,command,agent,user,config,command,dtmf,reporting,cdr,dialplan,originate,message
write = system,call,log,verbose,command,agent,user,config,command,dtmf,reporting,cdr,dialplan,originate,message
writetimeout = 5000

#include manager_additional.conf
#include manager_custom.conf
EOF
chown asterisk:asterisk /etc/asterisk/manager.conf
fi

# Configure ODBC for asteriskcdrdb
cat > /etc/odbc.ini <<EOF
[MySQL-asteriskcdrdb]
Server = 127.0.0.1
Database = asteriskcdrdb
Port = ${NETHVOICE_MARIADB_PORT}
Driver = MySQL
Description = ODBC on asteriskcdrdb
EOF

chown asterisk:asterisk /var/lib/asterisk/db

exec "$@"
