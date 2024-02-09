#!/bin/bash

#
# Copyright (C) 2023 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

/usr/bin/mysql -uroot -p"${MARIADB_ROOT_PASSWORD}" asterisk -e "INSERT INTO \`inboundlookup\` (\`mysql_host\`,\`mysql_dbname\`,\`mysql_query\`,\`mysql_username\`,\`mysql_password\`,\`mysql_charset\`) VALUES ('127.0.0.1:${PHONEBOOK_DB_PORT}','${PHONEBOOK_DB_NAME}','SELECT name,company FROM phonebook WHERE homephone LIKE ''%[NUMBER]%'' OR workphone LIKE ''%[NUMBER]%'' OR cellphone LIKE ''%[NUMBER]%'' OR fax LIKE ''%[NUMBER]%''','${PHONEBOOK_DB_USER}','${PHONEBOOK_DB_PASS}','')"
/usr/bin/mysql -uroot -p"${MARIADB_ROOT_PASSWORD}" asterisk -e "INSERT INTO \`outboundlookup\` (\`mysql_host\`,\`mysql_dbname\`,\`mysql_query\`,\`mysql_username\`,\`mysql_password\`,\`mysql_charset\`) VALUES ('127.0.0.1:${PHONEBOOK_DB_PORT}','${PHONEBOOK_DB_NAME}','SELECT name,company FROM phonebook WHERE homephone LIKE ''%[NUMBER]%'' OR workphone LIKE ''%[NUMBER]%'' OR cellphone LIKE ''%[NUMBER]%'' OR fax LIKE ''%[NUMBER]%''','${PHONEBOOK_DB_USER}','${PHONEBOOK_DB_PASS}','')"
