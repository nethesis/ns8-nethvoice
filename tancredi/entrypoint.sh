#!/bin/bash

#
# Copyright (C) 2022 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

cat > /etc/tancredi.conf <<EOF
[config]
loglevel = "DEBUG"
logfile = "php://stderr"

rw_dir = "/var/lib/tancredi/data/"
ro_dir = "/usr/share/tancredi/data/"

provisioning_url_path = "/provisioning/"
api_url_path = "/tancredi/api/v1/"

auth_class = "NethVoiceAuth"
secret = "${NETHVOICESECRETKEY}"
auth_nethvoice_dbhost = "127.0.0.1"
auth_nethvoice_dbuser = "${AMPDBUSER}"
auth_nethvoice_dbpass = "${AMPDBPASS}"
static_token = "${TANCREDI_STATIC_TOKEN}"
auth_nethvoice_dbport = "${NETHVOICE_MARIADB_PORT}"
runtime_filters = "AsteriskRuntimeFilter"
astdb = "/var/lib/asterisk/db/astdb.sqlite3"
file_reader = "apache"
[macvendors]
00A859 = fanvil
0C383E = fanvil
7C2F80 = gigaset
589EC6 = gigaset
005058 = sangoma
000413 = snom
001565 = yealink
249AD8 = yealink
44DBD2 = yealink
805E0C = yealink
805EC0 = yealink
C4FC22 = yealink
E0E656 = nethesis
0C1105 = akuvox
9C7514 = akuvox
EOF

dst_file="/var/lib/tancredi/data/scopes/defaults.ini"
if [[ ! -f ${dst_file} ]]; then
	echo "NOTICE: $0 initializing ${dst_file}"
	/bin/cp -v /usr/share/tancredi/data/scopes/defaults.ini ${dst_file}
	chown www-data:www-data ${dst_file}

	# Add variable for UI first configuration
	echo 'ui_first_config = "1"' >> ${dst_file}

	# Remove variables if they exists
	for variable in timezone language tonezone hostname outbound_proxy outbound_proxy_port provisioning_url_scheme provisioning_freq time_format date_format ldap_server ldap_port ldap_tls ldap_user ldap_password ldap_base ldap_name_display ldap_number_attr ldap_mainphone_number_attr ldap_mobilephone_number_attr ldap_otherphone_number_attr ldap_name_attr ldap_number_filter ldap_name_filter adminpw userpw; do
		sed -i '/^'${variable}' =.*/d' ${dst_file}
	done
	# Add defaults
	echo 'timezone = "Europe/Rome"' >> ${dst_file}
	echo 'language = "it"' >> ${dst_file}
	echo 'tonezone = "it"' >> ${dst_file}
	echo 'hostname = "'${NETHVOICE_HOST}'"' >> ${dst_file}
	echo 'outbound_proxy_1 = "'${PUBLIC_IP}'"' >> ${dst_file}
	echo 'outbound_proxy_port_1 = "5060"' >> ${dst_file}
	echo 'provisioning_url_scheme = "https"' >> ${dst_file}
	echo 'provisioning_freq = "everyday"' >> ${dst_file}

	# Add time_format and date_format
	echo 'time_format = "24"' >> ${dst_file}
	echo 'date_format = "DD MM YY"' >> ${dst_file}

	# Add ldap defaults
	echo 'ldap_server = ""' >> ${dst_file}
	echo 'ldap_port = "'${PHONEBOOK_LDAP_PORT}'"' >> ${dst_file}
	echo 'ldap_tls = "ldaps"' >> ${dst_file}
	echo 'ldap_user = "cn='${PHONEBOOK_LDAP_USER}',dc=phonebook,dc=nh"' >> ${dst_file}
	echo 'ldap_password = "'${PHONEBOOK_LDAP_PASS}'"' >> ${dst_file}
	echo 'ldap_base = "dc=phonebook,dc=nh"' >> ${dst_file}
	echo 'ldap_name_display = "%cn %o"' >> ${dst_file}
	echo 'ldap_mainphone_number_attr = "telephoneNumber"' >> ${dst_file}
	echo 'ldap_mobilephone_number_attr = "mobile"' >> ${dst_file}
	echo 'ldap_otherphone_number_attr = "homePhone"' >> ${dst_file}
	echo 'ldap_name_attr = "cn o"' >> ${dst_file}
	echo 'ldap_number_filter = "(|(telephoneNumber=%)(mobile=%)(homePhone=%))"' >> ${dst_file}
	echo 'ldap_name_filter = "(|(cn=%)(o=%))"' >> ${dst_file}

	# Set default admin and user passwords
	echo 'adminpw = "'$(head /dev/urandom | tr -dc a-z0-9 | head -c 10)'"' >> ${dst_file}
	echo 'userpw = "'$(head /dev/urandom | tr -dc a-z | head -c 6)'"' >> ${dst_file}
	
	# Set proxy ip if not already set
	if [[ -z "${PROXY_IP}" ]]; then
		export PROXY_IP=${NETHVOICE_HOST}
	fi

	# Set default proxy
	echo 'outbound_proxy_1 = "${PROXY_IP}"' >> ${dst_file}

	# Set proxy port if not empty
	if [[ ! -z "${PROXY_PORT}" ]]; then
		echo 'outbound_proxy_port_1 = "${PROXY_PORT}"' >> ${dst_file}
	fi

fi

runuser -s /bin/bash -c "php /usr/share/tancredi/scripts/upgrade.php" - www-data

exec "$@"

