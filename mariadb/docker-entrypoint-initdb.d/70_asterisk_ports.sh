#!/bin/bash

#
# Copyright (C) 2023 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

sip_sql='INSERT INTO `kvstore_Sipsettings` (`key`,`val`,`type`,`id`) VALUES ("udpport-0.0.0.0","'${ASTERISK_SIP_PORT}'",NULL,"noid"), ("tlsport-0.0.0.0","'${ASTERISK_SIPS_PORT}'",NULL,"noid"), ("tcpport-0.0.0.0","'${ASTERISK_SIP_PORT}'",NULL,"noid");'

astmanager_sql='INSERT INTO `freepbx_settings` (`keyword`,`value`,`name`,`level`,`description`,`type`,`options`,`defaultval`,`readonly`,`hidden`,`category`,`module`,`emptyok`,`sortorder`) VALUES ("ASTMANAGERPORT","'${ASTMANAGERPORT}'","Asterisk Manager Port",2,"Port for the Asterisk Manager","int","1024,65535","'${ASTMANAGERPORT}'",1,0,"Asterisk Manager","",0,0);'

pjsip_sql='INSERT INTO `kvstore_Sipsettings` (`key`,`val`,`type`,`id`) VALUES ("bindport","'${ASTERISK_SIP_PORT}'",NULL,"noid"),("tlsbindport","'${ASTERISK_SIPS_PORT}'",NULL,"noid");'

/usr/bin/mysql -uroot -p${MARIADB_ROOT_PASSWORD} asterisk -e "$sip_sql"
/usr/bin/mysql -uroot -p${MARIADB_ROOT_PASSWORD} asterisk -e "$pjsip_sql"
/usr/bin/mysql -uroot -p${MARIADB_ROOT_PASSWORD} asterisk -e "$astmanager_sql"
