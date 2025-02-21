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
        "qm_alarms_notifications": ${NETHCTI_ALERTS:-true}
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
  "expiration_timeout": "864000000",
  "unauthe_call": {
          "status": "${NETHCTI_UNAUTHE_CALL:-disabled}",
          "allowed_ip": "${NETHCTI_UNAUTHE_CALL_IP:-127.0.0.1}"
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

# Create directory before cat
mkdir -p /etc/nethcti/dbstatic.d

FILE=/etc/nethcti/dbstatic.d/asteriskcdrdb.json
cat > $FILE <<EOF
{
    "history_call": {
        "dbhost": "${CDRDBHOST}",
        "dbport": "${NETHVOICE_MARIADB_PORT}",
        "dbtype": "mysql",
        "dbuser": "${CDRDBUSER}",
        "dbpassword": "${CDRDBPASS}",
        "dbname": "${CDRDBNAME}"
    },
    "cel": {
        "dbhost": "${CDRDBHOST}",
        "dbport": "${NETHVOICE_MARIADB_PORT}",
        "dbtype": "mysql",
        "dbuser": "${CDRDBUSER}",
        "dbpassword": "${CDRDBPASS}",
        "dbname": "${CDRDBNAME}"
    },
    "voicemail": {
        "dbhost": "${CDRDBHOST}",
        "dbport": "${NETHVOICE_MARIADB_PORT}",
        "dbtype": "mysql",
        "dbuser": "${CDRDBUSER}",
        "dbpassword": "${CDRDBPASS}",
        "dbname": "${CDRDBNAME}"
    },
    "queue_log": {
        "dbhost": "${CDRDBHOST}",
        "dbport": "${NETHVOICE_MARIADB_PORT}",
        "dbtype": "mysql",
        "dbuser": "${CDRDBUSER}",
        "dbpassword": "${CDRDBPASS}",
        "dbname": "${CDRDBNAME}"
    }
}
EOF

FILE=/etc/nethcti/dbstatic.d/asterisk.json
cat > $FILE <<EOF
{
    "ampusers": {
        "dbhost": "${AMPDBHOST}",
        "dbport": "${NETHVOICE_MARIADB_PORT}",
        "dbtype": "mysql",
        "dbuser": "${AMPDBUSER}",
        "dbpassword": "${AMPDBPASS}",
        "dbname": "${AMPDBNAME}"
    },
    "incoming": {
        "dbhost": "${AMPDBHOST}",
        "dbport": "${NETHVOICE_MARIADB_PORT}",
        "dbtype": "mysql",
        "dbuser": "${AMPDBUSER}",
        "dbpassword": "${AMPDBPASS}",
        "dbname": "${AMPDBNAME}"
    },
    "offhour": {
        "dbhost": "${AMPDBHOST}",
        "dbport": "${NETHVOICE_MARIADB_PORT}",
        "dbtype": "mysql",
        "dbuser": "${AMPDBUSER}",
        "dbpassword": "${AMPDBPASS}",
        "dbname": "${AMPDBNAME}"
    },
    "rest_users": {
        "dbhost": "${AMPDBHOST}",
        "dbport": "${NETHVOICE_MARIADB_PORT}",
        "dbtype": "mysql",
        "dbuser": "${AMPDBUSER}",
        "dbpassword": "${AMPDBPASS}",
        "dbname": "${AMPDBNAME}"
    },
    "userman_users": {
        "dbhost": "${AMPDBHOST}",
        "dbport": "${NETHVOICE_MARIADB_PORT}",
        "dbtype": "mysql",
        "dbuser": "${AMPDBUSER}",
        "dbpassword": "${AMPDBPASS}",
        "dbname": "${AMPDBNAME}"
    },
    "rest_cti_profiles_paramurl": {
        "dbhost": "${AMPDBHOST}",
        "dbport": "${NETHVOICE_MARIADB_PORT}",
        "dbtype": "mysql",
        "dbuser": "${AMPDBUSER}",
        "dbpassword": "${AMPDBPASS}",
        "dbname": "${AMPDBNAME}"
    },
    "pin": {
        "dbhost": "${AMPDBHOST}",
        "dbport": "${NETHVOICE_MARIADB_PORT}",
        "dbtype": "mysql",
        "dbuser": "${AMPDBUSER}",
        "dbpassword": "${AMPDBPASS}",
        "dbname": "${AMPDBNAME}"
    },
    "pin_protected_routes": {
        "dbhost": "${AMPDBHOST}",
        "dbport": "${NETHVOICE_MARIADB_PORT}",
        "dbtype": "mysql",
        "dbuser": "${AMPDBUSER}",
        "dbpassword": "${AMPDBPASS}",
        "dbname": "${AMPDBNAME}"
    }
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
        "dbpassword": "${NETHCTI_DB_PASSWORD}",
        "dbname":     "nethcti3"
    },
    "customer_card": {
        "dbhost":     "127.0.0.1",
        "dbport":     "${NETHVOICE_MARIADB_PORT}",
        "dbtype":     "mysql",
        "dbuser":     "${NETHCTI_DB_USER}",
        "dbpassword": "${NETHCTI_DB_PASSWORD}",
        "dbname":     "nethcti3"
    },
    "user_dbconn": {
        "dbhost":     "127.0.0.1",
        "dbport":     "${NETHVOICE_MARIADB_PORT}",
        "dbtype":     "mysql",
        "dbuser":     "${NETHCTI_DB_USER}",
        "dbpassword": "${NETHCTI_DB_PASSWORD}",
        "dbname":     "nethcti3"
    },
    "auth": {
        "dbhost":     "127.0.0.1",
        "dbport":     "${NETHVOICE_MARIADB_PORT}",
        "dbtype":     "mysql",
        "dbuser":     "${NETHCTI_DB_USER}",
        "dbpassword": "${NETHCTI_DB_PASSWORD}",
        "dbname":     "nethcti3"
    },
    "offhour_files": {
        "dbhost":     "127.0.0.1",
        "dbport":     "${NETHVOICE_MARIADB_PORT}",
        "dbtype":     "mysql",
        "dbuser":     "${NETHCTI_DB_USER}",
        "dbpassword": "${NETHCTI_DB_PASSWORD}",
        "dbname":     "nethcti3"
    },
    "user_settings": {
        "dbhost":     "127.0.0.1",
        "dbport":     "${NETHVOICE_MARIADB_PORT}",
        "dbtype":     "mysql",
        "dbuser":     "${NETHCTI_DB_USER}",
        "dbpassword": "${NETHCTI_DB_PASSWORD}",
        "dbname":     "nethcti3"
    },
    "user_nethlink": {
        "dbhost":     "127.0.0.1",
        "dbport":     "${NETHVOICE_MARIADB_PORT}",
        "dbtype":     "mysql",
        "dbuser":     "${NETHCTI_DB_USER}",
        "dbpassword": "${NETHCTI_DB_PASSWORD}",
        "dbname":     "nethcti3"
    }
}
EOF

FILE=/etc/nethcti/dbstatic.d/phonebook.json
cat > $FILE <<EOF
{
	"phonebook": {
        "dbhost":     "${PHONEBOOK_DB_HOST}",
        "dbport":     "${PHONEBOOK_DB_PORT}",
        "dbtype":     "mysql",
        "dbuser":     "${PHONEBOOK_DB_USER}",
	"dbpassword": "${PHONEBOOK_DB_PASS}",
        "dbname":     "${PHONEBOOK_DB_NAME}"
  }
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
	"publichost":"",
	"loglevel":"${NETHCTI_LOG_LEVEL}",
	"privacy_numbers":"${NETHCTI_PRIVACY_NUMBERS}"
}
EOF

FILE=/etc/nethcti/services.json
cat > $FILE <<EOF
{
  "tcp": {
    "port": "${NETHCTI_TCP_PORT}",
    "base_templates": "http://${NETHVOICE_HOST}/webrest/static/templates/notification_popup"
  },
  "tls": {
    "port": "${NETHCTI_TLS_PORT}",
    "key": "/etc/certificates/NethServer.key",
    "cert": "/etc/certificates/NethServer.crt"
  },
  "websocket": {
    "http_port": "${NETHCTI_SERVER_WS_PORT}"
  },
  "http_proxy": {
    "http_port":  "${NETHCTI_SERVER_API_PORT}",
    "router": {
      "/user": "http://127.0.0.1:${NETHCTI_INTERNAL_REST_PORT1}/user",
      "/phonebook": "http://127.0.0.1:${NETHCTI_INTERNAL_REST_PORT2}/phonebook",
      "/astproxy": "http://127.0.0.1:${NETHCTI_INTERNAL_REST_PORT3}/astproxy",
      "/historycall": "http://127.0.0.1:${NETHCTI_INTERNAL_REST_PORT4}/historycall",
      "/histcallswitch": "http://127.0.0.1:${NETHCTI_INTERNAL_REST_PORT4}/histcallswitch",
      "/histcallsgroups": "http://127.0.0.1:${NETHCTI_INTERNAL_REST_PORT4}/histcallsgroups",
      "/static": "http://127.0.0.1:${NETHCTI_INTERNAL_REST_PORT5}",
      "/voicemail": "http://127.0.0.1:${NETHCTI_INTERNAL_REST_PORT6}/voicemail",
      "/dbconn": "http://127.0.0.1:${NETHCTI_INTERNAL_REST_PORT7}/dbconn",
      "/custcard": "http://127.0.0.1:${NETHCTI_INTERNAL_REST_PORT8}/custcard",
      "/streaming": "http://127.0.0.1:${NETHCTI_INTERNAL_REST_PORT9}/streaming",
      "/offhour": "http://127.0.0.1:${NETHCTI_INTERNAL_REST_PORT10}/offhour",
      "/profiling": "http://127.0.0.1:${NETHCTI_INTERNAL_REST_PORT11}/profiling",
      "/videoconf": "http://127.0.0.1:${NETHCTI_INTERNAL_REST_PORT12}/videoconf",
      "/freepbx": "https://127.0.0.1:${APACHE_PORT}/freepbx",
      "/authentication": "http://127.0.0.1:${NETHCTI_INTERNAL_REST_PORT13}/authentication"
    }
  },
  "rest": {
    "user": {
      "port": "${NETHCTI_INTERNAL_REST_PORT1}",
      "address": "localhost"
    },
    "phonebook": {
      "port":    "${NETHCTI_INTERNAL_REST_PORT2}",
      "address": "localhost"
    },
    "astproxy": {
      "port": "${NETHCTI_INTERNAL_REST_PORT3}",
      "address": "localhost"
    },
    "history": {
      "port": "${NETHCTI_INTERNAL_REST_PORT4}",
      "address": "localhost"
    },
    "static": {
      "port": "${NETHCTI_INTERNAL_REST_PORT5}",
      "address": "localhost",
      "webroot": "/app/plugins/com_static_http/static",
      "customWebroot": "/var/lib/nethserver/nethcti/static"
    },
    "voicemail": {
      "port": "${NETHCTI_INTERNAL_REST_PORT6}",
      "address": "localhost"
    },
    "dbconn": {
      "port": "${NETHCTI_INTERNAL_REST_PORT7}",
      "address": "localhost"
    },
    "customer_card": {
      "port": "${NETHCTI_INTERNAL_REST_PORT8}",
      "address": "localhost",
      "templates_customercards": "/var/lib/nethserver/nethcti/templates/customer_card"
    },
    "streaming": {
      "port": "${NETHCTI_INTERNAL_REST_PORT9}",
      "address": "localhost"
    },
    "offhour": {
      "port": "${NETHCTI_INTERNAL_REST_PORT10}",
      "address": "localhost"
    },
    "profiling": {
      "port": "${NETHCTI_INTERNAL_REST_PORT11}",
      "address": "localhost"
    },
    "videoconf": {
      "port": "${NETHCTI_INTERNAL_REST_PORT12}",
      "address": "localhost"
    },
    "authentication": {
      "port": "${NETHCTI_INTERNAL_REST_PORT13}",
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

FILE=/var/www/html/freepbx/wizard/scripts/custom.js
mkdir -p $(dirname $FILE)
cat > $FILE <<EOF
var customConfig = {
  BRAND_NAME: '${BRAND_NAME:=NethVoice}',
  BRAND_SITE: '${BRAND_SITE:=https://www.nethesis.it/soluzioni/nethvoice}',
  BRAND_DOCS: '${BRAND_DOCS:=https://docs.nethserver.org/projects/ns8/en/latest/nethvoice.html}',
  BASE_API_URL: '/freepbx/rest',
  BASE_API_URL_CTI: '/webrest',
  VPLAN_URL: '/freepbx/visualplan',
  OUTBOUNDS_URL: '/freepbx/admin/config.php?display=routing&view=form&id=',
  SECRET_KEY: '${NETHVOICESECRETKEY}'
};

EOF

# Prepare socket dir for reload
mkdir -p /run/nethvoice/

# Make sure config dir is writable from nethcti and freepbx containers
chown -R asterisk:asterisk /etc/nethcti

# Do not start if the service is not configured and the CMD has not been overriden
echo -e "Action: Login\nActionID: 1\nUsername: proxycti\nSecret: ${NETHCTI_AMI_PASSWORD}\n" | nc 127.0.0.1 ${ASTMANAGERPORT:-5038} | grep -q "Authentication accepted"
auth_ok=$?
if [ ! -f /etc/nethcti/users.json -o $auth_ok -gt 0 ]  && [ "$1 $2" == "npm start" ]; then
    echo "Configuration is not ready: server not started."
    exit 0
fi

FILE=/etc/nethcti/phone_urls.json
cat > $FILE <<EOF
{
    "^yealink\\\s.+\\\s.+": {
        "urls": {
            "call": "http://\$PHONE_USER:\$PHONE_PASS@\$PHONE_IP/servlet?key=number=\$NUMBER&outgoing_uri=\$ACCOUNT@\$SERVER",
            "answer": "http://\$PHONE_USER:\$PHONE_PASS@\$PHONE_IP/servlet?key=ANSWER",
            "hold_unhold": "http://\$PHONE_USER:\$PHONE_PASS@\$PHONE_IP/servlet?key=F_HOLD",
            "dtmf": "http://\$PHONE_USER:\$PHONE_PASS@\$PHONE_IP/servlet?key=\$TONE",
            "mute_unmute": "http://\$PHONE_USER:\$PHONE_PASS@\$PHONE_IP/servlet?key=MUTE",
	    "cancel": "http://\$PHONE_USER:\$PHONE_PASS@\$PHONE_IP/servlet?key=CANCEL"
        }
    },
    "^snom.*": {
        "urls": {
            "call": "http://\$PHONE_USER:\$PHONE_PASS@\$PHONE_IP/command.htm?number=\$NUMBER",
            "answer": "http://\$PHONE_USER:\$PHONE_PASS@\$PHONE_IP/command.htm?key=ENTER",
            "hold_unhold": "http://\$PHONE_USER:\$PHONE_PASS@\$PHONE_IP/command.htm?key=F_HOLD",
            "dtmf": "http://\$PHONE_USER:\$PHONE_PASS@\$PHONE_IP/command.htm?key=\$TONE",
            "mute_unmute": "http://\$PHONE_USER:\$PHONE_PASS@\$PHONE_IP/command.htm?key=MUTE",
	    "cancel": "http://\$PHONE_USER:\$PHONE_PASS@\$PHONE_IP/command.htm?key=CANCEL"
        }
    },
    "^sangoma\\\s.*": {
        "urls": {
            "call": "http://\$PHONE_USER:\$PHONE_PASS@\$PHONE_IP/Phone_ActionURL&Command=1&Number=\$NUMBER&Account=1",
            "answer": "http://\$PHONE_USER:\$PHONE_PASS@\$PHONE_IP/Phone_ActionURL&key=OK",
            "hold_unhold": "http://\$PHONE_USER:\$PHONE_PASS@\$PHONE_IP/Phone_ActionURL&key=F_HOLD"
        }
    },
    "^fanvil.*": {
        "urls": {
            "call": "http://\$PHONE_USER:\$PHONE_PASS@\$PHONE_IP/cgi-bin/ConfigManApp.com?key=\$NUMBER;ENTER",
            "answer": "http://\$PHONE_USER:\$PHONE_PASS@\$PHONE_IP/cgi-bin/ConfigManApp.com?key=OK",
            "hold_unhold": "http://\$PHONE_USER:\$PHONE_PASS@\$PHONE_IP/cgi-bin/ConfigManApp.com?key=F_HOLD",
            "dtmf": "http://\$PHONE_USER:\$PHONE_PASS@\$PHONE_IP/cgi-bin/ConfigManApp.com?key=\$TONE",
            "mute_unmute": "http://\$PHONE_USER:\$PHONE_PASS@\$PHONE_IP/cgi-bin/ConfigManApp.com?key=F_MUTE",
	    "cancel": "http://\$PHONE_USER:\$PHONE_PASS@\$PHONE_IP/cgi-bin/ConfigManApp.com?key=F_CANCEL"
        }
    },
    "^Nethesis\\\s*NP.*": {
        "urls": {
            "call": "http://\$PHONE_USER:\$PHONE_PASS@\$PHONE_IP/cgi-bin/ConfigManApp.com?key=\$NUMBER;ENTER",
            "answer": "http://\$PHONE_USER:\$PHONE_PASS@\$PHONE_IP/cgi-bin/ConfigManApp.com?key=OK",
            "hold_unhold": "http://\$PHONE_USER:\$PHONE_PASS@\$PHONE_IP/cgi-bin/ConfigManApp.com?key=F_HOLD",
            "dtmf": "http://\$PHONE_USER:\$PHONE_PASS@\$PHONE_IP/cgi-bin/ConfigManApp.com?key=\$TONE",
            "mute_unmute": "http://\$PHONE_USER:\$PHONE_PASS@\$PHONE_IP/cgi-bin/ConfigManApp.com?key=F_MUTE",
	    "cancel": "http://\$PHONE_USER:\$PHONE_PASS@\$PHONE_IP/cgi-bin/ConfigManApp.com?key=F_CANCEL"
        }
    },
    "^alcatel\\\s.*1G": {
        "urls": {
            "call": "http://user:nethvoice@\$PHONE_IP/activeuri.kl1?number=\$NUMBER&account=\$ACCOUNT",
            "answer": "http://user:nethvoice@\$PHONE_IP/activeuri.kl1?command=OK"
        }
    }
}
EOF

# Execute given CMD
exec "$@"
