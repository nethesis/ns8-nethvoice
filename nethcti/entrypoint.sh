#!/bin/bash

#
# Copyright (C) 2022 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

FILE=/etc/nethcti/asterisk.json
if [[ ! -f $FILE ]]; then
	cat > $FILE <<EOF
{
        "user": "proxycti",
        "pass": "${NETHCTI_AMI_PASSWORD}",
        "host": "127.0.0.1",
        "port": "${ASTMANAGERPORT:-5038}",
        "prefix": "${NETHCTI_PREFIX}",
        "auto_c2c": "${NETHCTI_AUTOC2C}",
        "trunks_events": "${NETHCTI_TRUNKS_EVENTS}",
        "qm_alarms_notifications": ${NETHCTI_ALERTS}
}
EOF
fi

FILE=/etc/nethcti/authentication.json
if [[ ! -f $FILE ]]; then
	cat > $FILE <<EOF
{
	"enabled": ${NETHCTI_AUTHENTICATION_ENABLED:true},
	"type": "pam",
	"file": {
		"path": "/etc/nethcti/users.json"
	},
	"expiration_timeout": "3600",
	"unauthe_call": {
        	"status": "${NETHCTI_UNAUTHE_CALL:disabled}",
	        "allowed_ip": "${NETHCTI_UNAUTHE_CALL_IP}"
    	}
}
EOF
fi

FILE=/etc/nethcti/chat.json
if [[ ! -f $FILE ]]; then
	cat > $FILE <<EOF
{
	"url" : "${NETHCTI_JABBER_URL}",
	"domain" : "${NETHCTI_JABBER_DOMAIN}"
}
EOF
fi

FILE=/etc/nethcti/dbstatic.d/nethcti3.json
if [[ ! -f $FILE ]]; then
	cat > $FILE <<EOF
{
    "cti_phonebook": {
        "dbhost":     "127.0.0.1",
        "dbport":     "${NETHVOICE_MARIADB_PORT}",
        "dbtype":     "mysql",
        "dbuser":     "${CTIDBUSER}",
        "dbpassword": "{$CTIDBPASS}",
        "dbname":     "nethcti3"
    },
    "customer_card": {
        "dbhost":     "127.0.0.1",
        "dbport":     "${NETHVOICE_MARIADB_PORT}",
        "dbtype":     "mysql",
        "dbuser":     "${CTIDBUSER}",
        "dbpassword": "{$CTIDBPASS}",
        "dbname":     "nethcti3"
    },
    "user_dbconn": {
        "dbhost":     "127.0.0.1",
        "dbport":     "${NETHVOICE_MARIADB_PORT}",
        "dbtype":     "mysql",
        "dbuser":     "${CTIDBUSER}",
        "dbpassword": "{$CTIDBPASS}",
        "dbname":     "nethcti3"
    },
    "auth": {
        "dbhost":     "127.0.0.1",
        "dbport":     "${NETHVOICE_MARIADB_PORT}",
        "dbtype":     "mysql",
        "dbuser":     "${CTIDBUSER}",
        "dbpassword": "{$CTIDBPASS}",
        "dbname":     "nethcti3"
    },
    "offhour_files": {
        "dbhost":     "127.0.0.1",
        "dbport":     "${NETHVOICE_MARIADB_PORT}",
        "dbtype":     "mysql",
        "dbuser":     "${CTIDBUSER}",
        "dbpassword": "{$CTIDBPASS}",
        "dbname":     "nethcti3"
    },
    "user_settings": {
        "dbhost":     "127.0.0.1",
        "dbport":     "${NETHVOICE_MARIADB_PORT}",
        "dbtype":     "mysql",
        "dbuser":     "${CTIDBUSER}",
        "dbpassword": "{$CTIDBPASS}",
        "dbname":     "nethcti3"
    }
}
EOF
fi

FILE=/etc/nethcti/dbstatic.d/phonebook.json
if [[ ! -f $FILE ]]; then
	cat > $FILE <<EOF
{
	"phonebook": {
        "dbhost":     "127.0.0.1",
        "dbport":     "${NETHVOICE_MARIADB_PORT}",
        "dbtype":     "mysql",
        "dbuser":     "pbookuser",
        "dbpassword": "{$NETHVOICE_PHONEBOOK_DB_PASSWORD}",
        "dbname":     "phonebook"
}
EOF
fi





# Finally launch NethCTI
npm start
