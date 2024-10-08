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
Driver = MariaDB Unicode
Description = ODBC on asteriskcdrdb
EOF

mkdir -p /var/spool/asterisk/outgoing /var/spool/asterisk/tmp /var/spool/asterisk/uploads 
chown asterisk:asterisk /var/lib/asterisk/db /var/spool/asterisk/outgoing /var/spool/asterisk/tmp /var/spool/asterisk/uploads

# Customized wizard page
cat > /etc/apache2/sites-available/wizard.conf <<EOF
AliasMatch ^/(?!freepbx)(.+)$ /var/www/html/freepbx/wizard/\$1
EOF

# Link rewrite configuration
if [[ ! -f /etc/apache2/sites-enabled/wizard.conf ]] ; then
	ln -sf /etc/apache2/sites-available/wizard.conf /etc/apache2/sites-enabled/wizard.conf
fi

# Write wizard and restapy configuration
cat > /var/www/html/freepbx/wizard/scripts/custom.js <<EOF
var customConfig = {
  BRAND_NAME: '${BRAND_NAME:=NethVoice}',
  BRAND_SITE: '${BRAND_SITE:=https://www.nethesis.it/soluzioni/nethvoice}',
  BRAND_DOCS: '${BRAND_DOCS:=https://docs.nethserver.org/projects/ns8/it/latest/nethvoice.html}',
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

\$nethcti3db = new \PDO('mysql:host='.\$amp_conf['AMPDBHOST'].';port='.\$amp_conf['AMPDBPORT'].';dbname=nethcti3; charset=utf8',
  '${NETHCTI_DB_USER}',
  '${NETHCTI_DB_PASSWORD}');
EOF

# create recallonbusy configuration if it doesn't exist
if [[ ! -f /etc/asterisk/recallonbusy.cfg ]]; then
	cat > /etc/asterisk/recallonbusy.cfg <<EOF
[recallonbusy]
Host: 127.0.0.1
Port: 5038
Username: CHANGEME
Secret: CHANGEME
Debug : False
CheckInterval: 20
EOF
fi

# configure recallonbusy
sed -i 's/^Port: .*/Port: '${ASTMANAGERPORT}'/' /etc/asterisk/recallonbusy.cfg
sed -i 's/^Username: .*/Username: proxycti/' /etc/asterisk/recallonbusy.cfg
sed -i 's/^Secret: .*/Secret: '${NETHCTI_AMI_PASSWORD}'/' /etc/asterisk/recallonbusy.cfg

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

# make sure CSV uopload path exists if /var/lib/nethvoice isn't a volume or already initialized
mkdir -p /var/lib/nethvoice/phonebook/uploads
chown -R asterisk:asterisk /var/lib/nethvoice/phonebook/uploads

# Change Apache httpd port
sed -i "s/<VirtualHost \*:80>/<VirtualHost \*:${APACHE_PORT}>/" /etc/apache2/sites-enabled/000-default.conf
sed -i "s/Listen 80/Listen ${APACHE_PORT}/" /etc/apache2/ports.conf

# Load apache envvars
source /etc/apache2/envvars

# Install freepbx modules and apply changes after asterisk is started by supervisor
/freepbx_init.sh &

# bash function to URL-encode a string
url_encode() {
    local input_string="$1"
    local encoded_string

    # URL-encode the input string using jq
    encoded_string=$(printf %s "${input_string}" | jq -sRr @uri)

    # Perform specific replacements for certain characters
    encoded_string=$(echo "${encoded_string}" | sed 's/!/%21/g;s/*/%2A/g;s/(/%28/g;s/)/%29/g;s/'"'"'/%27/g')

    echo "${encoded_string}"
}

# Configure SMTP for Voicemail
if [ "$SMTP_ENABLED" = "1" ]; then
	# Write s-nail configuration

	# Set the s-nail compatibility mode
	echo "set v15-compat=yes" >> /etc/s-nail.rc

	# Set the TLS verify policy
	if [ "$SMTP_TLSVERIFY" = "1" ]; then
		echo "set tls-verify=strict" >> /etc/s-nail.rc
	else
		echo "set tls-verify=ignore" >> /etc/s-nail.rc
	fi

	# Set the authentication method
	if [ -z "$SMTP_PASSWORD" ]; then
		echo "set smtp-auth=none" >> /etc/s-nail.rc
		# Set the SMTP server URL without authentication
		echo "set mta=smtp://${SMTP_HOST}:${SMTP_PORT}" >> /etc/s-nail.rc
	else
		echo "set smtp-auth=login" >> /etc/s-nail.rc
		# Set the SMTP server URL with authentication
		# Check if encryption is specified and modify URL accordingly
		if [ "$SMTP_ENCRYPTION" = "starttls" ]; then
			# use starttls for STARTTLS encryption
			echo "set smtp-use-starttls" >> /etc/s-nail.rc
			echo "set mta=smtp://$(url_encode "${SMTP_USERNAME}"):$(url_encode "${SMTP_PASSWORD}")@${SMTP_HOST}:${SMTP_PORT}" >> /etc/s-nail.rc
		elif [ "$SMTP_ENCRYPTION" = "tls" ]; then
			# use smtps:// for TLS encryption
			echo "set mta=smtps://$(url_encode "${SMTP_USERNAME}"):$(url_encode "${SMTP_PASSWORD}")@${SMTP_HOST}:${SMTP_PORT}" >> /etc/s-nail.rc
		else
			# default to no encryption
			echo "set mta=smtp://${SMTP_USERNAME}:$(url_encode "${SMTP_PASSWORD}")@${SMTP_HOST}:${SMTP_PORT}" >> /etc/s-nail.rc
		fi
	fi

	# Set the mailcmd
	if ! grep -q '^mailcmd=' /etc/asterisk/voicemail.conf; then
		# write mailcmd if it isn't already set
		sed -i "s|^\[general\]$|[general]\nmailcmd=/var/lib/asterisk/bin/send_email|" /etc/asterisk/voicemail.conf
	elif grep -q '^mailcmd=/usr/sbin/sendmail' /etc/asterisk/voicemail.conf; then
		# replace mailcmd if it is already set and is the old binary
		sed -i "s|^mailcmd=/usr/sbin/sendmail.*|mailcmd=/var/lib/asterisk/bin/send_email|" /etc/asterisk/voicemail.conf
	fi
	# set the from address
	if [ -z "$SMTP_FROM_ADDRESS" ]; then
		if echo "$SMTP_USERNAME" | grep -q '@'; then
			# get the from address from the smtp username
			FROM_DOMAIN=$(echo "$SMTP_USERNAME" | cut -d'@' -f2)
		elif echo "$SMTP_HOST" | grep -q '[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*'; then
			# get the from address from NETHVOICE_HOST if smtp host is an IP address
			FROM_DOMAIN=$(echo "$NETHVOICE_HOST" | cut -d'.' -f2-)
		else
			# get the from address from the smtp host
			FROM_DOMAIN=$(echo "$SMTP_HOST" | cut -d'.' -f2-)
		fi
		FROM_NAME=$(echo "${BRAND_NAME}" | tr '[:upper:]' '[:lower:]' | sed 's/ /_/g')
		SMTP_FROM_ADDRESS="${FROM_NAME}@${FROM_DOMAIN}"
	fi

	# add the from address to the s-nail configuration
	echo "set from=${SMTP_FROM_ADDRESS}" >> /etc/s-nail.rc

	# set the email from address in voicemail configuration if it isn't already set from FreePBX interface
	if ! grep -q '^serveremail *=' /etc/asterisk/voicemail.conf; then
		sed -i "s/^\[general\]$/[general]\nserveremail=${SMTP_FROM_ADDRESS}/" /etc/asterisk/voicemail.conf
	fi
fi

# customize voicemail branding
sed 's/FreePBX/'"${BRAND_NAME}"'/' -i /etc/asterisk/voicemail.conf*
sed 's/http:\/\/AMPWEBADDRESS\/ucp/https:\/\/'"${NETHCTI_UI_HOST}"'\/history/' -i /etc/asterisk/voicemail.conf*

exec "$@"