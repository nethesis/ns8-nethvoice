#!/bin/bash

#
# Copyright (C) 2022 Nethesis S.r.l.
# http://www.nethesis.it - nethserver@nethesis.it
#
# This script is part of NethServer.
#
# NethServer is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License,
# or any later version.
#
# NethServer is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with NethServer.  If not, see COPYING.
#

NEEDRELOAD=FALSE

# ProxyPass to allow wizard to reach Tancredi
cat > /etc/apache2/sites-available/tancredi.conf <<EOF
ProxyPass "/tancredi"  "http://127.0.0.1:${TANCREDIPORT}/tancredi"
ProxyPassReverse "/tancredi"  "http://127.0.0.1:${TANCREDIPORT}/tancredi"
EOF

# Link Tancredi ProxyPass configuration
if [[ ! -f /etc/apache2/sites-enabled/tancredi.conf ]] ; then
	ln -sf /etc/apache2/sites-available/tancredi.conf /etc/apache2/sites-enabled/tancredi.conf
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
          'port' => '${MARIADB_PORT}',
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
Port = ${MARIADB_PORT}
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

if [[ ! -f /etc/freepbx.conf ]]; then
	# First install

	# Configure mysql
	php /initdb.d/initdb.php 

	# Apply changes
	fwconsole r

	# Set ownership and permission
	fwconsole chown
fi

# Configure freepbx
cat > /etc/freepbx.conf <<EOF
<?php
\$amp_conf['AMPDBUSER'] = '${AMPDBUSER}';
\$amp_conf['AMPDBPASS'] = '${AMPDBPASS}';
\$amp_conf['AMPDBHOST'] = '${AMPDBHOST}';
\$amp_conf['AMPDBPORT'] = '${MARIADB_PORT}';
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
\$amp_conf['AMPDBPORT'] = '${MARIADB_PORT}';
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

\$cdr_db_host = (\$amp_conf['CDRDBHOST'] ? \$amp_conf['CDRDBHOST'] : 'localhost');
\$cdr_db_port = (\$amp_conf['CDRDBPORT'] ? \$amp_conf['CDRDBPORT'] : \$amp_conf['AMPDBPORT']);
\$cdr_db_name = (\$amp_conf['CDRDBNAME'] ? \$amp_conf['CDRDBNAME'] : 'asteriskcdrdb');
\$cdr_db_user = (\$amp_conf['CDRDBUSER'] ? \$amp_conf['CDRDBUSER'] : \$amp_conf['AMPDBUSER']);
\$cdr_db_pass = (\$amp_conf['CDRDBPASS'] ? \$amp_conf['CDRDBPASS'] : \$amp_conf['AMPDBPASS']);

\$cdrdb = new \PDO('mysql:host='.\$cdr_db_host.';port='.\$cdr_db_port.';dbname='.\$cdr_db_name.';charset=utf8',
	\$cdr_db_user,
	\$cdr_db_pass);

EOF

exec "$@"
