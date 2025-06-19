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
nocolor=yes

[files]
astctlpermissions=775

[modules]
autoload=yes
EOF

# Remove cdr.conf if it's empty. CDR module will create it at install.
if [ ! -s /etc/asterisk/cdr.conf ]; then
	rm -f /etc/asterisk/cdr.conf
fi

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

# Show Asterisk logfiles module on FreePBX interface
sed -i '/^; Hide Asterisk logfile$/N;/\n\[logfiles\]$/N;/\nremove=Yes$/d' /etc/asterisk/freepbx_menu.conf

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

mkdir -p /var/spool/asterisk/outgoing /var/spool/asterisk/tmp /var/spool/asterisk/uploads /var/lib/nethserver/nethcti/templates/customer_card
chown asterisk:asterisk /var/lib/asterisk/db /var/spool/asterisk/outgoing /var/spool/asterisk/tmp /var/spool/asterisk/uploads /var/lib/nethserver/nethcti/templates/customer_card

# Make sure /etc/nethcti exists and is writable and the config directory is
# writable from nethcti and freepbx containers
mkdir -p /etc/nethcti
chown -R asterisk:asterisk /etc/nethcti

# make sure CSV upload path exists if /var/lib/nethvoice isn't a volume or already initialized
mkdir -p /var/lib/nethvoice/phonebook/uploads
chown -R asterisk:asterisk /var/lib/nethvoice/phonebook/uploads

# Don't continue with initialization if the database is not ready
if [[ -z "${AMPDBUSER}" || -z "${AMPDBPASS}" ]]; then

	if [ "$@" == "/usr/bin/supervisord" ]; then
		echo "AMPDBUSER and AMPDBPASS are not set, exiting."
		exit 0
	fi

	exec "$@"
fi

# Customized wizard page
cat > /etc/apache2/sites-available/wizard.conf <<EOF
AliasMatch ^/(?!freepbx)(.+)$ /var/www/html/freepbx/wizard/\$1
EOF

# Link rewrite configuration
if [[ ! -f /etc/apache2/sites-enabled/wizard.conf ]] ; then
	ln -sf /etc/apache2/sites-available/wizard.conf /etc/apache2/sites-enabled/wizard.conf
fi

# Write wizard and restapi configuration
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

# Set the mailcmd
if ! grep -q '^mailcmd=' /etc/asterisk/voicemail.conf; then
	# write mailcmd if it isn't already set
	sed -i "s|^\[general\]$|[general]\nmailcmd=/var/lib/asterisk/bin/send_email|" /etc/asterisk/voicemail.conf
elif grep -q '^mailcmd=/usr/sbin/sendmail' /etc/asterisk/voicemail.conf; then
	# replace mailcmd if it is already set and is the old binary
	sed -i "s|^mailcmd=/usr/sbin/sendmail.*|mailcmd=/var/lib/asterisk/bin/send_email|" /etc/asterisk/voicemail.conf
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

# create freepbx chown configuration if it doesn't exist
if [[ ! -f /etc/asterisk/freepbx_chown.conf ]]; then
  cat > /etc/asterisk/freepbx_chown.conf <<EOF
[blacklist]
directory = /var/www/html/freepbx/rest
directory = /var/www/html/freepbx/visualplan
directory = /var/www/html/freepbx/wizard
EOF
fi

# configure recallonbusy
sed -i 's/^Port: .*/Port: '${ASTMANAGERPORT}'/' /etc/asterisk/recallonbusy.cfg
sed -i 's/^Username: .*/Username: proxycti/' /etc/asterisk/recallonbusy.cfg
sed -i 's/^Secret: .*/Secret: '${NETHCTI_AMI_PASSWORD}'/' /etc/asterisk/recallonbusy.cfg

# Create fias configuration if it doesn't exist
if [[ ! -f /etc/asterisk/fias.conf ]]; then
  cat > /etc/asterisk/fias.conf <<'EOF'
[fiasd]
separator="|"
record_start=2
record_end=3
remote_character_encoding="CP850"
link_check_interval=300
send_msdelay=500
timeout=15
TimeoutLE_msec=300
DebugLevel=1
address=${NETHVOICE_HOTEL_FIAS_ADDRESS}
port=${NETHVOICE_HOTEL_FIAS_PORT}


[cdr]
cdrInternalExtensions=hang
cdrExternalExtensions=anonymous
cdrInternalPatterns=/FMPR-.*/
cdrExternalPatterns=
; cdrMode
; C (Direct Charge)
; T (Meter Pulse)
cdrMode=C

[minibar]
; Favourite minibar mode
; C (Direct Charge, only if item has a price)
; M (Minibar)
psmode=M

[record_LDLR]
0="LD|DA|TI|V#2.0.2|IFPB|"
1="LR|RIGI|FLRNG#GNGLGSSFA0A1A2A3|"
2="LR|RIGO|FLRNG#GSSF|"
3="LR|RIGC|FLRNG#GNGLGSROA0A1A2A3|"
4="LR|RIRE|FLRNRSMLCSDN|"
5="LR|RIWR|FLDATIRN|"
6="LR|RIWC|FLDATIRN|"
7="LR|RIWA|FLDATIRNAS|"
8="LR|RIPS|FLDATIRNPTDDDUTAMAM#P#MPSO|"
9="LR|RIPA|FLASDAP#RNTI|"

[WR2PMS]
command=/usr/share/neth-hotel-fias/wr2pms.php
format=DA_TI_RN

[WC2PMS]
command=/usr/share/neth-hotel-fias/wc2pms.php
format=DA_TI_RN

[WA2PMS]
command=/usr/share/neth-hotel-fias/wa2pms.php
format=DA_TI_RN_AS

[RE2PMS]
command=/usr/share/neth-hotel-fias/re2pms.php
format=RN_RS

[PS2PMS]
command=/usr/share/neth-hotel-fias/ps2pms.php
format=DA_DD_DU_MA_M#_MP_PT_RN_TA_TI_P#_G#_SO

[LE2PMS]
command=/usr/share/neth-hotel-fias/le2pms.php
format=

[WR2PBX]
command=/usr/share/neth-hotel-fias/wr2pbx.php
format=DA_TI_RN

[WC2PBX]
command=/usr/share/neth-hotel-fias/wc2pbx.php
format=DA_TI_RN

[GI2PBX]
command=/usr/share/neth-hotel-fias/gi2pbx.php
format=RN_G#_GN_GL_GS_SF_A0_A1_A2_A3

[GO2PBX]
command=/usr/share/neth-hotel-fias/go2pbx.php
format=RN_G#_GS_SF

[GC2PBX]
command=/usr/share/neth-hotel-fias/gc2pbx.php
format=RN_G#_GN_GL_GS_RO_A0_A1_A2_A3

[PA2PBX]
command=/usr/share/neth-hotel-fias/pa2pbx.php
format=AS_DA_P#_RN_TI

[RE2PBX]
command=/usr/share/neth-hotel-fias/re2pbx.php
format=RN_RS_ML_CS_DN

[DR2PMS]
command=/usr/share/neth-hotel-fias/dr2pms.php
format=DA_TI

[MINIBAR2PMS]
command=/usr/share/neth-hotel-fias/minibar.php
format=DA_TI_RN_MA_M#_TA

[custom_fields]
A0='logger -t fias "Check-in room %ROOM% #%RESERVATION% Guest: %GUESTNAME% %GUESTLANGUAGE%. Custom field A0: %ARG%"'
A1=
A2=
A3=

EOF
fi

# configure fias
if [[ "${NETHVOICE_HOTEL}" -eq True && -n "${NETHVOICE_HOTEL_FIAS_ADDRESS}" && -n "${NETHVOICE_HOTEL_FIAS_PORT}" ]]; then
  sed -i 's/^address=.*/address='"${NETHVOICE_HOTEL_FIAS_ADDRESS}"'/' /etc/asterisk/fias.conf
  sed -i 's/^port=.*/port='"${NETHVOICE_HOTEL_FIAS_PORT}"'/' /etc/asterisk/fias.conf
  cat > /etc/supervisor/conf.d/fias.conf <<EOF
[program:fias]
command=/usr/share/neth-hotel-fias/fiasd.php
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stdout_logfile_backups=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
stderr_logfile_backups=0

[program:fiasdispatcher]
command=/usr/share/neth-hotel-fias/dispatcher.php
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stdout_logfile_backups=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
stderr_logfile_backups=0
EOF
fi

# migrate database
php /initdb.d/migration.php

if [[ ! -f /etc/asterisk/extensions_additional.conf ]]; then
	# First install, set needreload to true
	php -r 'include_once "/etc/freepbx_db.conf"; $db->query("UPDATE admin SET value = \"true\" WHERE variable = \"need_reload\"");'
fi

# Configure users
php /configure_users.php

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

# customize voicemail branding
sed 's/FreePBX/'"${BRAND_NAME}"'/' -i /etc/asterisk/voicemail.conf*
sed 's/http:\/\/AMPWEBADDRESS\/ucp/https:\/\/'"${NETHCTI_UI_HOST}"'\/history/' -i /etc/asterisk/voicemail.conf*

exec "$@"
