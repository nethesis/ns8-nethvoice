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

# Set defaults into an array
DEFAULTS[timezone]="${TIMEZONE}"
DEFAULTS[language]="it"
DEFAULTS[tonezone]="it"
DEFAULTS[hostname]="${NETHVOICE_HOST}"
DEFAULTS[outbound_proxy_1]="${NETHVOICE_PROXY_FQDN}"
DEFAULTS[provisioning_url_scheme]="https"
DEFAULTS[provisioning_freq]="everyday"
DEFAULTS[time_format]="24"
DEFAULTS[date_format]="DD MM YY"
DEFAULTS[ldap_server]="${NETHVOICE_HOST}"
DEFAULTS[ldap_port]="${PHONEBOOK_LDAP_PORT}"
DEFAULTS[ldap_tls]="ldaps"
DEFAULTS[ldap_user]="cn=${PHONEBOOK_LDAP_USER},dc=phonebook,dc=nh"
DEFAULTS[ldap_password]="${PHONEBOOK_LDAP_PASS}"
DEFAULTS[ldap_base]="dc=phonebook,dc=nh"
DEFAULTS[ldap_name_display]="%cn %o"
DEFAULTS[ldap_mainphone_number_attr]="telephoneNumber"
DEFAULTS[ldap_mobilephone_number_attr]="mobile"
DEFAULTS[ldap_otherphone_number_attr]="homePhone"
DEFAULTS[ldap_name_attr]="cn o"
DEFAULTS[ldap_number_filter]="(|(telephoneNumber=%)(mobile=%)(homePhone=%))"
DEFAULTS[ldap_name_filter]="(|(cn=%)(o=%))"
DEFAULTS[adminpw]=$(head /dev/urandom | tr -dc a-z0-9 | head -c 10)
DEFAULTS[userpw]=$(head /dev/urandom | tr -dc a-z | head -c 6)

dst_file="/var/lib/tancredi/data/scopes/defaults.ini"
if [[ ! -f ${dst_file} ]]; then
	echo "NOTICE: $0 initializing ${dst_file}"
	/bin/cp -v /usr/share/tancredi/data/scopes/defaults.ini ${dst_file}
	chown www-data:www-data ${dst_file}
	# Variables that are only added the first time
	for variable in \
		language \
		tonezone \
		provisioning_freq \
		time_format \
		date_format \
		adminpw \
		userpw
	do
		sed -i '/^'${variable}' =.*/d' ${dst_file}
		echo "${variable} = \"${DEFAULTS[${variable}]}\"" >> ${dst_file}
	done
fi

# Variables that are always overwritten:
for variable in \
	timezone \
	hostname \
	outbound_proxy_1 \
	ldap_server \
	ldap_port \
	ldap_tls \
	ldap_user \
	ldap_password \
	ldap_base \
	ldap_name_display \
	ldap_number_attr \
	ldap_mainphone_number_attr \
	ldap_mobilephone_number_attr \
	ldap_otherphone_number_attr \
	ldap_name_attr \
	ldap_number_filter \
	ldap_name_filter
do
	if [[ -z $(grep "^${variable} = " ${dst_file}) ]]; then
		echo "${variable} = \"${DEFAULTS[${variable}]}\"" >> ${dst_file}
	else
		sed -i "s/^${variable} =.*/${variable} = \"${DEFAULTS[${variable}]}\"/" ${dst_file}
	fi
done

runuser -s /bin/bash -c "php /usr/share/tancredi/scripts/upgrade.php" - www-data

exec "$@"

