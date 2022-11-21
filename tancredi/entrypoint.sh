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

