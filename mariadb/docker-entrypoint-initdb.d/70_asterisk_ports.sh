#!/bin/bash

#
# Copyright (C) 2023 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

sip_sql='INSERT INTO `kvstore_Sipsettings` (`key`,`val`,`type`,`id`) VALUES ("udpport-0.0.0.0","'${ASTERISK_SIP_PORT}'",NULL,"noid"), ("tlsport-0.0.0.0","'${ASTERISK_SIPS_PORT}'",NULL,"noid"), ("tcpport-0.0.0.0","'${ASTERISK_SIP_PORT}'",NULL,"noid");'

astmanager_sql='INSERT INTO `freepbx_settings` (`keyword`,`value`,`name`,`level`,`description`,`type`,`options`,`defaultval`,`readonly`,`hidden`,`category`,`module`,`emptyok`,`sortorder`) VALUES ("ASTMANAGERPORT","'${ASTMANAGERPORT}'","Asterisk Manager Port",2,"Port for the Asterisk Manager","int","1024,65535","'${ASTMANAGERPORT}'",1,0,"Asterisk Manager","",0,0);'

pjsip_sql='INSERT INTO `kvstore_Sipsettings` (`key`,`val`,`type`,`id`) VALUES ("bindport","'${ASTERISK_SIP_PORT}'",NULL,"noid"),("tlsbindport","'${ASTERISK_SIPS_PORT}'",NULL,"noid");'

# avoid listening on default 4569 port even if IAX is not configured
iax_sql_hack='INSERT INTO `iaxsettings` (`keyword`,`data`,`seq`,`type`) VALUES ("bindport","'${ASTERISK_IAX_PORT}'",1,0)'

# avoid listening on default 5060 port even if SIP is not configured
# this will cause a warning like: Failed to bind to 0.0.0.0:32120: Address already in use
sip_sql_hack='INSERT INTO `sipsettings` VALUES ("bindport","'${ASTERISK_SIP_PORT}'",1,0)'

# do not listen on port 8089
http_sql_hack='INSERT INTO `freepbx_settings` (`keyword`,`value`,`name`,`level`,`description`,`type`,`options`,`defaultval`,`readonly`,`hidden`,`category`,`module`,`emptyok`,`sortorder`) VALUES ("HTTPTLSENABLE","0","Enable TLS for the mini-HTTP Server",3,"Enables listening for HTTPS connections. This is for Asterisk, it is not directly related for FreePBX usage and the value of this setting is irrelevant for accessing core FreePBX settings. Default is no.","bool","","0",0,0,"Asterisk Builtin mini-HTTP server","",0,0)'

/usr/bin/mysql -uroot -p${MARIADB_ROOT_PASSWORD} asterisk -e "$sip_sql"
/usr/bin/mysql -uroot -p${MARIADB_ROOT_PASSWORD} asterisk -e "$pjsip_sql"
/usr/bin/mysql -uroot -p${MARIADB_ROOT_PASSWORD} asterisk -e "$astmanager_sql"
/usr/bin/mysql -uroot -p${MARIADB_ROOT_PASSWORD} asterisk -e "$sip_sql_hack"
/usr/bin/mysql -uroot -p${MARIADB_ROOT_PASSWORD} asterisk -e "$iax_sql_hack"
/usr/bin/mysql -uroot -p${MARIADB_ROOT_PASSWORD} asterisk -e "$http_sql_hack"
