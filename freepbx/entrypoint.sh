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
  BRAND_SITE: '${BRAND_SITE:=http://www.nethvoice.it}',
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

# Configure SMTP for Voicemail
if [ "$SMTP_ENABLED" = "1" ]; then
	cat <<EOF >> /etc/s-nail.rc
set smtp-auth=login
set tls-verify=$(if [ "$SMTP_TLSVERIFY" = "1" ]; then echo "strict"; else echo "ignore"; fi)
set v15-compat=yes
EOF

	# Check if encryption is specified and modify configuration accordingly
	USER_ENCODED_STRING=$(printf %s "${SMTP_USERNAME}"|jq -sRr @uri)
	PASSWORD_ENCODED_STRING=$(printf %s "${SMTP_PASSWORD}"|jq -sRr @uri)
	if [ "$SMTP_ENCRYPTION" = "starttls" ]; then
		echo "set smtp-use-starttls" >> /etc/s-nail.rc
		echo "set mta=smtp://${USER_ENCODED_STRING}:${PASSWORD_ENCODED_STRING}@${SMTP_HOST}:${SMTP_PORT}" >> /etc/s-nail.rc
	elif [ "$SMTP_ENCRYPTION" = "tls" ]; then
		echo "set mta=smtps://$(printf %s "${SMTP_USERNAME}"|jq -sRr @uri):$(printf %s "${SMTP_PASSWORD}"|jq -sRr @uri)@${SMTP_HOST}:${SMTP_PORT}" >> /etc/s-nail.rc
	fi

	# Set the mailcmd
	if ! grep -q '^mailcmd=' /etc/asterisk/voicemail.conf; then
		# write mailcmd if it isn't already set
		sed -i "s/^\[general\]$/[general]\nmailcmd=\/usr\/local\/bin\/sendmail -t/" /etc/asterisk/voicemail.conf
	elif grep -q '^mailcmd=/usr/sbin/sendmail -t -f ' /etc/asterisk/voicemail.conf; then
		# replace mailcmd if it is already set and is the old binary. Also save the from address
		FROM_DOMAIN=$(grep '^mailcmd=/usr/sbin/sendmail -t -f ' /etc/asterisk/voicemail.conf | cut -d' ' -f4)
		sed -i "s|^mailcmd=/usr/sbin/sendmail -t -f .*|mailcmd=/usr/local/bin/sendmail -t|" /etc/asterisk/voicemail.conf
	elif grep -q '^mailcmd=/usr/sbin/sendmail' /etc/asterisk/voicemail.conf; then
		# replace mailcmd if it is already set and is the old binary
		sed -i "s|^mailcmd=/usr/sbin/sendmail.*|mailcmd=/usr/local/bin/sendmail|" /etc/asterisk/voicemail.conf
	fi
	# set the from address if it isn't already set
	if ! grep -q '^serveremail='; then
		if [ -z "$FROM_DOMAIN" ]; then
			if echo "$SMTP_USERNAME" | grep -q '@'; then
				# get the from address from the smtp username
				FROM_DOMAIN=$(echo "$SMTP_USERNAME" | cut -d'@' -f2)
			else
				# get the from address from the smtp host
				FROM_DOMAIN=$(echo "$SMTP_HOST" | cut -d'.' -f2-)
			fi
		fi
		FROM_NAME=$(echo "${BRAND_NAME}" | tr '[:upper:]' '[:lower:]' | sed 's/ /_/g')
		FROM_ADDRESS="${FROM_NAME}@${FROM_DOMAIN}"
		sed -i "s/^\[general\]$/[general]\nserveremail=${FROM_ADDRESS}/" /etc/asterisk/voicemail.conf
	fi
fi
# customize voicemail branding
sed 's/FreePBX/'"${BRAND_NAME}"'/' -i /etc/asterisk/voicemail.conf*
sed 's/http:\/\/AMPWEBADDRESS\/ucp/https:\/\/'"${NETHCTI_UI_HOST}"'\/history/' -i /etc/asterisk/voicemail.conf*

exec "$@"
