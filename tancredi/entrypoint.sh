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
805E0C = yealink
805EC0 = yealink
E0E656 = nethesis
EOF

exec "$@"

