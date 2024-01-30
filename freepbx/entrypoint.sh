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
astmoddir => /usr/lib/asterisk/modules
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

chown asterisk:asterisk /var/lib/asterisk/db

# Setup ca bundle for pjsip
ln -sf /etc/pki/tls/certs/ca-bundle.crt /etc/ssl/certs/ca-certificates.crt


# Customized wizard page
cat > /etc/apache2/sites-available/wizard.conf <<EOF
Alias /$(echo "${BRAND_NAME:=NethVoice}" | tr '[:upper:]' '[:lower:]') /var/www/html/freepbx/wizard
EOF

# Link rewrite configuration
if [[ ! -f /etc/apache2/sites-enabled/wizard.conf ]] ; then
	ln -sf /etc/apache2/sites-available/wizard.conf /etc/apache2/sites-enabled/wizard.conf
fi

# Write wizard and restapy configuration
cat > /var/www/html/freepbx/wizard/scripts/custom.js <<EOF
var customConfig = {
  BRAND_NAME: '${BRAND_NAME:=NethVoice}',
  BRAND_SITE: '${BRAND_SITE:=http://www.nethvoice.it}',
  BRAND_DOCS: '${BRAND_DOCS:=http://nethvoice.docs.nethesis.it}',
  BASE_API_URL: '/freepbx/rest',
  BASE_API_URL_CTI: '/webrest',
  VPLAN_URL: '/freepbx/visualplan',
  OUTBOUNDS_URL: '/freepbx/admin/config.php?display=routing&view=form&id=',
  SECRET_KEY: '${NETHVOICESECRETKEY}'
};

EOF

cat > /var/www/html/freepbx/rest/config.inc.php <<EOF
<?php
\$config = [
    'settings' => [
        'secretkey' => '${NETHVOICESECRETKEY}',
        'cti_config_path' => '/etc/nethcti'
    ],
    'nethctidb' => [
          'host' => '127.0.0.1',
          'port' => '${NETHVOICE_MARIADB_PORT}',
          'name' => 'nethcti3',
          'user' => '${NETHCTI_DB_USER}',
          'pass' => '${NETHCTI_DB_PASSWORD}'
      ]
];
EOF

# Create empty voicemail.conf if not exists
if [[ ! -f /etc/asterisk/voicemail.conf ]]; then
	touch /etc/asterisk/voicemail.conf
fi

# Configure mysql
php /initdb.d/initdb.php

# Configure freepbx
cat > /etc/freepbx.conf <<EOF
<?php
\$amp_conf['AMPDBUSER'] = '${AMPDBUSER}';
\$amp_conf['AMPDBPASS'] = '${AMPDBPASS}';
\$amp_conf['AMPDBHOST'] = '${AMPDBHOST}';
\$amp_conf['AMPDBPORT'] = '${NETHVOICE_MARIADB_PORT}';
\$amp_conf['AMPDBNAME'] = '${AMPDBNAME}';
\$amp_conf['AMPDBENGINE'] = 'mysql';
\$amp_conf['datasource'] = ''; //for sqlite3

require_once('/var/www/html/freepbx/admin/bootstrap.php');
?>
EOF

# Configure freepbx_db.conf
cat > /etc/freepbx_db.conf <<EOF
<?php

\$amp_conf['AMPDBUSER'] = '${AMPDBUSER}';
\$amp_conf['AMPDBPASS'] = '${AMPDBPASS}';
\$amp_conf['AMPDBHOST'] = '${AMPDBHOST}';
\$amp_conf['AMPDBPORT'] = '${NETHVOICE_MARIADB_PORT}';
\$amp_conf['AMPDBNAME'] = '${AMPDBNAME}';
\$amp_conf['AMPDBENGINE'] = 'mysql';
\$amp_conf['datasource'] = ''; //for sqlite3


\$db = new \PDO(\$amp_conf['AMPDBENGINE'].':host='.\$amp_conf['AMPDBHOST'].';port='.\$amp_conf['AMPDBPORT'].';dbname='.\$amp_conf['AMPDBNAME'],
	\$amp_conf['AMPDBUSER'],
	\$amp_conf['AMPDBPASS']);

\$sql = 'SELECT keyword,value FROM freepbx_settings';
\$sth = \$db->prepare(\$sql);
\$sth->execute();
while (\$row = \$sth->fetch(\PDO::FETCH_ASSOC)) {
	\$amp_conf[\$row['keyword']] = \$row['value'];
}
\$sth->closeCursor();

\$cdr_db_host = (\$amp_conf['CDRDBHOST'] ? \$amp_conf['CDRDBHOST'] : '127.0.0.1');
\$cdr_db_port = (\$amp_conf['CDRDBPORT'] ? \$amp_conf['CDRDBPORT'] : \$amp_conf['AMPDBPORT']);
\$cdr_db_name = (\$amp_conf['CDRDBNAME'] ? \$amp_conf['CDRDBNAME'] : 'asteriskcdrdb');
\$cdr_db_user = (\$amp_conf['CDRDBUSER'] ? \$amp_conf['CDRDBUSER'] : \$amp_conf['AMPDBUSER']);
\$cdr_db_pass = (\$amp_conf['CDRDBPASS'] ? \$amp_conf['CDRDBPASS'] : \$amp_conf['AMPDBPASS']);

\$cdrdb = new \PDO('mysql:host='.\$cdr_db_host.';port='.\$cdr_db_port.';dbname='.\$cdr_db_name.';charset=utf8',
	\$cdr_db_user,
	\$cdr_db_pass);

EOF

# Set proxy ip and port if not already set
if [[ -z "${PROXY_IP}" ]]; then
    export PROXY_IP=$(curl -s https://api.ipify.org || echo "127.0.0.1")
fi
if [[ -z "${PROXY_PORT}" ]]; then
    export PROXY_PORT=5060
fi

# migrate database
php /initdb.d/migration.php

if [[ ! -f /etc/asterisk/extensions_additional.conf ]]; then
	# First install, set needreload to true
	php -r 'include_once "/etc/freepbx_db.conf"; $db->query("UPDATE admin SET value = \"true\" WHERE variable = \"need_reload\"");'
fi

# Configure users
php /configure_users.php

# Make sure config dir is writable from nethcti and freepbx containers
chown -R asterisk:asterisk /etc/nethcti

# Change Apache httpd port
sed -i "s/<VirtualHost \*:80>/<VirtualHost \*:${APACHE_PORT}>/" /etc/apache2/sites-enabled/000-default.conf
sed -i "s/Listen 80/Listen ${APACHE_PORT}/" /etc/apache2/ports.conf

# Load apache envvars
source /etc/apache2/envvars

# Install freepbx modules and apply changes after asterisk is started by supervisor
/freepbx_init.sh &

exec "$@"
