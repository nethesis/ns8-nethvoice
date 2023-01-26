#!/bin/bash

#
# Copyright (C) 2022 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

# Customized wizard page
cat > /etc/apache2/sites-available/wizard.conf <<EOF
Alias /$(echo ${BRAND_NAME:=NethVoice} | tr '[:upper:]' '[:lower:]') /var/www/html/freepbx/wizard
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
          'user' => 'nethcti',
          'pass' => '${CTIDBPASS}'
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

# Create empty /etc/amportal.conf
if [[ ! -f /etc/amportal.conf ]]; then
	touch /etc/amportal.conf
fi

if [[ ! -f /etc/asterisk/voicemail.conf ]]; then
	touch /etc/asterisk/voicemail.conf
fi

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

\$cdr_db_host = (\$amp_conf['CDRDBHOST'] ? \$amp_conf['CDRDBHOST'] : 'localhost');
\$cdr_db_port = (\$amp_conf['CDRDBPORT'] ? \$amp_conf['CDRDBPORT'] : \$amp_conf['AMPDBPORT']);
\$cdr_db_name = (\$amp_conf['CDRDBNAME'] ? \$amp_conf['CDRDBNAME'] : 'asteriskcdrdb');
\$cdr_db_user = (\$amp_conf['CDRDBUSER'] ? \$amp_conf['CDRDBUSER'] : \$amp_conf['AMPDBUSER']);
\$cdr_db_pass = (\$amp_conf['CDRDBPASS'] ? \$amp_conf['CDRDBPASS'] : \$amp_conf['AMPDBPASS']);

\$cdrdb = new \PDO('mysql:host='.\$cdr_db_host.';port='.\$cdr_db_port.';dbname='.\$cdr_db_name.';charset=utf8',
	\$cdr_db_user,
	\$cdr_db_pass);

EOF

# Configure mysql
php /initdb.d/initdb.php 

if [[ ! -f /etc/asterisk/extensions_additional.conf ]]; then
	# First install, set needreload to true
	php -r 'include_once "/etc/freepbx_db.conf"; $db->query("UPDATE admin SET value = \"true\" WHERE variable = \"need_reload\"");'
fi

# Check if apply changes is needed
php <<'EOF'
<?php
include_once '/etc/freepbx_db.conf';
$stmt = $db->prepare('SELECT value FROM admin WHERE variable = "need_reload"');
$stmt->execute();
if ($stmt->fetchAll()[0][0] == "true" ) exit(1);
EOF

# Apply changes if needed
if [[ $? == 1 ]]; then
	fwconsole reload
fi

# Configure users
php /configure_users.php

# Sync users
fwconsole userman --syncall --force --verbose

exec "$@"
