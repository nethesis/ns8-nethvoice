#!/bin/bash

#
# Copyright (C) 2022 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

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

# configure ODBC for Asterisk
cat > /etc/odbc.ini <<EOF
[MySQL-asteriskcdrdb]
Server = localhost
Database = asteriskcdrdb
Port = ${NETHVOICE_MARIADB_PORT}
Driver = MySQL
Description = ODBC on asteriskcdrdb
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

# Install FreePBX modules if required
module_status=$(mktemp)
trap 'rm -f ${module_status}' EXIT
fwconsole ma list | grep '^| ' | grep -v '^| Module'| awk '{print $2,$6}' > $module_status
for module in \
        framework \
        soundlang \
        recordings \
        announcement \
        manager \
        arimanager \
        asteriskinfo \
        filestore \
        backup \
        pm2 \
        core \
        cdr \
        blacklist \
        bosssecretary \
        bulkdids \
        calendar \
        callback \
        callforward \
        callrecording \
        callwaiting \
        cel \
        certman \
        conferences \
        customappsreg \
        customcontexts \
        dashboard \
        daynight \
        directdid \
        disa \
        donotdisturb \
        extraoptions \
        fax \
        featurecodeadmin \
        findmefollow \
        googletts \
        iaxsettings \
        inboundlookup \
        infoservices \
        ivr \
        languages \
        logfiles \
        miscapps \
        music \
        nethcqr \
        nethcti3 \
        nethdash \
        outboundlookup \
        outroutemsg \
        paging \
        parking \
        pin \
        pm2 \
        queues \
        queueexit \
        queuemetrics \
        queueoptions \
        queueprio \
        rapidcode \
        recallonbusy \
        returnontransfer \
        ringgroups \
        setcid \
        sipsettings \
        timeconditions \
        userman \
        visualplan \
        voicemail \
        vmblast
do
    if ! test -s "$module_status" || grep -q "$module " "$module_status" && ! grep -q "$module Enabled" "$module_status" ; then
        echo Installing module $module
        fwconsole moduleadmin install $module
    fi
done

# Disable signature check
php -r 'include_once "/etc/freepbx_db.conf"; $db->query("UPDATE freepbx_settings SET value = 0 WHERE keyword = \"SIGNATURECHECK\"");'

# Sync users
fwconsole userman --syncall --force --verbose

# Always apply changes on start
su - asterisk -s /bin/sh -c "/var/lib/asterisk/bin/fwconsole reload"

exec "$@"
