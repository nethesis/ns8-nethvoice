#!/usr/bin/env sh

#
# Copyright (C) 2022 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

FILE=/etc/nethcti/asterisk.json
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

FILE=/etc/nethcti/authentication.json
cat > $FILE <<EOF
{
	"enabled": ${NETHCTI_AUTHENTICATION_ENABLED:-true},
	"type": "pam",
	"file": {
		"path": "/etc/nethcti/users.json"
	},
	"expiration_timeout": "3600",
	"unauthe_call": {
        	"status": "${NETHCTI_UNAUTHE_CALL:-disabled}",
	        "allowed_ip": "${NETHCTI_UNAUTHE_CALL_IP}"
    	}
}
EOF

FILE=/etc/nethcti/chat.json
cat > $FILE <<EOF
{
	"url" : "${NETHCTI_JABBER_URL}",
	"domain" : "${NETHCTI_JABBER_DOMAIN}"
}
EOF

FILE=/etc/nethcti/dbstatic.d/nethcti3.json
cat > $FILE <<EOF
{
    "cti_phonebook": {
        "dbhost":     "127.0.0.1",
        "dbport":     "${NETHVOICE_MARIADB_PORT}",
        "dbtype":     "mysql",
        "dbuser":     "${NETHCTI_DB_USER}",
        "dbpassword": "{$NETHCTI_DB_PASSWORD}",
        "dbname":     "nethcti3"
    },
    "customer_card": {
        "dbhost":     "127.0.0.1",
        "dbport":     "${NETHVOICE_MARIADB_PORT}",
        "dbtype":     "mysql",
        "dbuser":     "${NETHCTI_DB_USER}",
        "dbpassword": "{$NETHCTI_DB_PASSWORD}",
        "dbname":     "nethcti3"
    },
    "user_dbconn": {
        "dbhost":     "127.0.0.1",
        "dbport":     "${NETHVOICE_MARIADB_PORT}",
        "dbtype":     "mysql",
        "dbuser":     "${NETHCTI_DB_USER}",
        "dbpassword": "{$NETHCTI_DB_PASSWORD}",
        "dbname":     "nethcti3"
    },
    "auth": {
        "dbhost":     "127.0.0.1",
        "dbport":     "${NETHVOICE_MARIADB_PORT}",
        "dbtype":     "mysql",
        "dbuser":     "${NETHCTI_DB_USER}",
        "dbpassword": "{$NETHCTI_DB_PASSWORD}",
        "dbname":     "nethcti3"
    },
    "offhour_files": {
        "dbhost":     "127.0.0.1",
        "dbport":     "${NETHVOICE_MARIADB_PORT}",
        "dbtype":     "mysql",
        "dbuser":     "${NETHCTI_DB_USER}",
        "dbpassword": "{$NETHCTI_DB_PASSWORD}",
        "dbname":     "nethcti3"
    },
    "user_settings": {
        "dbhost":     "127.0.0.1",
        "dbport":     "${NETHVOICE_MARIADB_PORT}",
        "dbtype":     "mysql",
        "dbuser":     "${NETHCTI_DB_USER}",
        "dbpassword": "{$NETHCTI_DB_PASSWORD}",
        "dbname":     "nethcti3"
    }
}
EOF

FILE=/etc/nethcti/dbstatic.d/phonebook.json
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

FILE=/etc/nethcti/exec_script.json
echo "{" > $FILE
if [ -n "${NETHCTI_CDR_SCRIPT}" ] ; then
	cat > $FILE <<EOF
	"cdr": {
		"script": "${NETHCTI_CDR_SCRIPT}",
		"timeout": ${NETHCTI_CDR_SCRIPT_TIMEOUT},
	}
EOF
	if [ -n "${NETHCTI_CDR_SCRIPT_CALL_IN}" ] ; then
		echo "," >> $FILE
	fi
fi
if [ -n "${NETHCTI_CDR_SCRIPT_CALL_IN}" ] ; then
	cat > $FILE <<EOF
	"callin": {
		"script": "${NETHCTI_CDR_SCRIPT_CALL_IN}",
		"timeout": ${NETHCTI_CDR_SCRIPT_TIMEOUT},
	}
EOF
fi
echo "}" >> $FILE

FILE=/etc/nethcti/mailer.json
cat > $FILE <<EOF
{
	"port":    "25",
	"address": "localhost",
	"sender":  "noreply@${NETHVOICE_HOST}"
}
EOF

FILE=/etc/nethcti/nethcti.json
cat > $FILE <<EOF
{
	"logfile":"/dev/stderr",
	"hostname":"${NETHVOICE_HOST}",
	"publichost":"${NETHVOICE_PUBLIC_HOST}",
	"loglevel":"{$NETHCTI_LOG_LEVEL}",
	"privacy_numbers":"xxx",
	"proxy_port":""
}
EOF

FILE=/etc/nethcti/services.json
cat > $FILE <<EOF
{
  "tcp": {
    "port": "8182",
    "base_templates": "http://${NETHVOICE_PUBLIC_HOST}/webrest/static/templates/notification_popup"
  },
  "tls": {
    "port": "8183",
    "key": "/etc/asterisk/keys/NethServer.key",
    "cert": "/etc/asterisk/keys/NethServer.crt"
  },
  "websocket": {
    "http_port": "8181"
  },
  "http_proxy": {
    "http_port":  "8179",
    "router": {
      "/user": "http://127.0.0.1:50000/user",
      "/phonebook": "http://127.0.0.1:50001/phonebook",
      "/astproxy": "http://127.0.0.1:50002/astproxy",
      "/historycall": "http://127.0.0.1:50003/historycall",
      "/histcallswitch": "http://127.0.0.1:50003/histcallswitch",
      "/histcallsgroups": "http://127.0.0.1:50003/histcallsgroups",
      "/static": "http://127.0.0.1:50004",
      "/voicemail": "http://127.0.0.1:50005/voicemail",
      "/dbconn": "http://127.0.0.1:50006/dbconn",
      "/custcard": "http://127.0.0.1:50007/custcard",
      "/streaming": "http://127.0.0.1:50008/streaming",
      "/offhour": "http://127.0.0.1:50009/offhour",
      "/profiling": "http://127.0.0.1:50010/profiling",
      "/videoconf": "http://127.0.0.1:50011/videoconf",
      "/freepbx": "https://127.0.0.1/freepbx",
      "/authentication": "http://127.0.0.1:50113/authentication"
    }
  },
  "rest": {
    "user": {
      "port": "50000",
      "address": "localhost"
    },
    "phonebook": {
      "port":    "50001",
      "address": "localhost"
    },
    "astproxy": {
      "port": "50002",
      "address": "localhost"
    },
    "history": {
      "port": "50003",
      "address": "localhost"
    },
    "static": {
      "port": "50004",
      "address": "localhost",
      "webroot": "/usr/lib/node/nethcti-server/plugins/com_static_http/static",
      "customWebroot": "/var/lib/nethserver/nethcti/static"
    },
    "voicemail": {
      "port": "50005",
      "address": "localhost"
    },
    "dbconn": {
      "port": "50006",
      "address": "localhost"
    },
    "customer_card": {
      "port": "50007",
      "address": "localhost",
      "templates_customercards": "/var/lib/nethserver/nethcti/templates/customer_card"
    },
    "streaming": {
      "port": "50008",
      "address": "localhost"
    },
    "offhour": {
      "port": "50009",
      "address": "localhost"
    },
    "profiling": {
      "port": "50010",
      "address": "localhost"
    },
    "videoconf": {
      "port": "50011",
      "address": "localhost"
    },
    "authentication": {
      "port": "50113",
      "proto": "http",
      "address": "localhost"
    }
  }
}
EOF

FILE=/etc/nethcti/video_conf.json
cat > $FILE <<EOF
{
	"jitsi": {
		"url": "${CONFERENCE_JITSI_URL}"
	}
}
EOF

# Finally launch NethCTI
npm start
