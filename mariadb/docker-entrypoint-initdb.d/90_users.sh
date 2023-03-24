#!/usr/bin/env sh

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

mysql -e "GRANT ALL on asterisk.* to '${AMPDBUSER}'@'127.0.0.1' identified by '${AMPDBPASS}'"
mysql -e "GRANT ALL on asteriskcdrdb.* to '${CDRDBUSER}'@'127.0.0.1' identified by '${CDRDBPASS}'"
mysql -e "GRANT ALL on nethcti3.* to '${NETHCTI_DB_USER}'@'127.0.0.1' identified by '${NETHCTI_DB_PASSWORD}'"
mysql -e "GRANT ALL on ${PHONEBOOK_DB_NAME}.* to '${PHONEBOOK_DB_USER}'@'127.0.0.1' identified by '${PHONEBOOK_DB_PASS}'"
mysql -e "GRANT ALL on asteriskcdrdb.* to 'nethvoice_report'@'127.0.0.1' identified by '${REPORTS_PASSWORD}';"
mysql -e "GRANT ALL on asterisk.* to 'nethvoice_report'@'127.0.0.1' identified by '${REPORTS_PASSWORD}';"
mysql -e "GRANT SELECT on phonebook.* to 'nethvoice_report'@'127.0.0.1' identified by '${REPORTS_PASSWORD}';"
