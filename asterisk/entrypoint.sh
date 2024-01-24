#!/bin/bash

#
# Copyright (C) 2022 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

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

# create asterisk.conf
cat > /etc/asterisk/asterisk.conf <<EOF
[directories]
astetcdir => /etc/asterisk
astmoddir => /usr/lib64/asterisk/modules
astvarlibdir => /var/lib/asterisk
astagidir => /var/lib/asterisk/agi-bin
astspooldir => /var/spool/asterisk
astrundir => /var/run/asterisk
astlogdir => /var/log/asterisk
astdbdir => /var/lib/asterisk/db

[options]
transmit_silence_during_record=yes
languageprefix=yes
execincludes=yes
dontwarn=yes
runuser=asterisk
rungroup=asterisk

[files]
astctlpermissions=775

[modules]
autoload=yes
EOF

# create modules.conf
cat > /etc/asterisk/modules.conf <<EOF
[modules]
autoload=yes
preload = func_db.so
preload = res_odbc.so
preload = res_config_odbc.so
preload = cdr_adaptive_odbc.so
noload = chan_dahdi.so
noload = codec_dahdi.so
noload = res_ari_mailboxes.so
noload = res_stir_shaken.so
noload = res_pjsip_stir_shaken.so
noload = res_pjsip_phoneprov.so
noload = res_pjsip_phoneprov_provider.so
noload = cdr_csv.so
noload = cdr_syslog.so
noload = app_alarmreceiver.so
noload = res_http_media_cache.so
noload = res_phoneprov.so
EOF

chown -c asterisk:asterisk /etc/asterisk/*.conf

# Configure ODBC for asteriskcdrdb
cat > /etc/odbc.ini <<EOF
[MySQL-asteriskcdrdb]
Server = 127.0.0.1
Database = asteriskcdrdb
Port = ${NETHVOICE_MARIADB_PORT}
Driver = MySQL
Description = ODBC on asteriskcdrdb
EOF

chown asterisk:asterisk /var/lib/asterisk/db /run/rce

# Setup ca bundle for pjsip
ln -sf /etc/pki/tls/certs/ca-bundle.crt /etc/ssl/certs/ca-certificates.crt

exec "$@"
