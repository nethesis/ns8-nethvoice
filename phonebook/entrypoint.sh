#!/bin/bash

#
# Copyright (C) 2022 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

cat > /etc/config_ldaps.json <<EOF
{
  "basedn" : "dc=phonebook, dc=nh",
  "port": ${PHONEBOOK_LDAP_PORT},
  "debug": ${DEBUG:=false},
  "db_name": "${PHONEBOOK_DB_NAME}",
  "db_user": "${PHONEBOOK_DB_USER}",
  "db_host" : "${PHONEBOOK_DB_HOST}",
  "db_port" : "${NETHVOICE_MARIADB_PORT}",
  "db_pass": "${PHONEBOOK_DB_PASS}",
  "user": "nobody",
  "group": "nobody",
  "limit": ${PHONEBOOK_LDAP_LIMIT:=500},
  "certificate" : "/etc/pki/tls/NethServer.pem",
  "key": "/etc/pki/tls/private/NethServer.key",
  "username": "${PHONEBOOK_LDAP_USER}",
  "password": "${PHONEBOOK_LDAP_PASS}"
}
EOF

/usr/share/phonebooks/phonebook

exec "$@"
