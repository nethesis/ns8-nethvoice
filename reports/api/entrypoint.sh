#!/usr/bin/env sh

set -e

# if command is api, wait for services to be up
if [ "$1" = "api" ]; then
  # Copy directory content into shared volume
  cp -r /opt/defaults/nethvoice-report/* /opt/nethvoice-report

  # Init user_authorization.json if missing
  if [ ! -f /opt/nethvoice-report/api/user_authorizations.json ]; then
    echo "[]" > /opt/nethvoice-report/api/user_authorizations.json
  fi

  reports_config=/opt/nethvoice-report/api/conf.json
  cat > $reports_config <<EOF
{
    "listen_address": "127.0.0.1:${REPORTS_API_PORT}",
    "redis_network_type": "tcp",
    "redis_address": "127.0.0.1:${REPORTS_REDIS_PORT}",
    "ttl_cache": 480,
    "cdr_database": {
        "host": "127.0.0.1",
        "port": "${NETHVOICE_MARIADB_PORT}",
        "user": "nethvoice_report",
        "password": "${REPORTS_PASSWORD}",
        "name": "asteriskcdrdb"
    },
    "phonebook_database": {
        "host": "127.0.0.1",
        "port": "${NETHVOICE_MARIADB_PORT}",
        "user": "nethvoice_report",
        "password": "${REPORTS_PASSWORD}",
        "name": "phonebook"
    },
    "freepbx_database": {
        "host": "127.0.0.1",
        "port": "${NETHVOICE_MARIADB_PORT}",
        "user": "nethvoice_report",
        "password": "${REPORTS_PASSWORD}",
        "name": "asterisk"
    },
    "secret": "${REPORTS_SECRET}",
    "query_path": "/opt/nethvoice-report/api/queries",
    "template_path": "/opt/nethvoice-report/api/templates",
    "values_path": "/opt/nethvoice-report/api/values",
    "views_path": "/opt/nethvoice-report/api/views",
    "phonebook_path": "/opt/nethvoice-report/api/phonebook/phonebook.sql",
    "rrd_path": "/var/lib/collectd/rrd",
    "user_auth_file": "/opt/nethvoice-report/api/user_authorizations.json",
    "default_filter": {
        "queues": [],
        "groups": [],
        "time": {
            "group": "day",
            "division": "60",
            "range": "yesterday",
            "cdrDashboardRange": "past_week",
            "interval": {
                "start": "",
                "end": ""
            }
        },
        "name": "",
        "agent": "",
        "geoGroup": "regione"
    },
    "api_endpoint": "https://${NETHVOICE_HOST}/pbx-report-api",
    "api_key": "${REPORTS_API_KEY}",
    "settings": {
        "start_hour": "09:00",
        "end_hour": "18:00",
        "query_limit": "2000",
        "null_call_time": "5",
        "destinations": [
            "National",
            "Mobile",
            "International",
            "Emergency",
            "PayNumber"
        ],
        "call_patterns": [
            {
                "prefix": "00390",
                "destination": "National"
            },
            {
                "prefix": "+390",
                "destination": "National"
            },
            {
                "prefix": "0",
                "destination": "National"
            },
            {
                "prefix": "00393",
                "destination": "Mobile"
            },
            {
                "prefix": "+393",
                "destination": "Mobile"
            },
            {
                "prefix": "3",
                "destination": "Mobile"
            },
            {
                "prefix": "00",
                "destination": "International"
            },
            {
                "prefix": "+",
                "destination": "International"
            },
            {
                "prefix": "1",
                "destination": "Emergency"
            },
            {
                "prefix": "8",
                "destination": "PayNumber"
            }
        ],
        "currency": "EUR",
        "costs": []
    }
}

EOF

  # Wait for redis to be ready
  redis_address=$(jq -r '.redis_address' $reports_config)
  wait-for "${redis_address}" -t 30 -- echo "redis is up"

  # Wait for cdr database to be ready
  cdr_database_host=$(jq -r '.cdr_database.host' $reports_config)
  cdr_database_port=$(jq -r '.cdr_database.port' $reports_config)
  wait-for "${cdr_database_host}:${cdr_database_port}" -t 30 -- echo "cdr database is up"

  # Migrate cdr database
  # Check if REPORTS_INTERNATIONAL_PREFIX is set, otherwise exit
  if [ -z "${REPORTS_INTERNATIONAL_PREFIX}" ]; then
    echo "REPORTS_INTERNATIONAL_PREFIX is not set"
    exit 1
  fi
  # Fetch credentials from nethvoice-report.json
  cdr_database_user=$(jq -r '.cdr_database.user' $reports_config)
  cdr_database_password=$(jq -r '.cdr_database.password' $reports_config)
  cdr_database_name=$(jq -r '.cdr_database.name' $reports_config)
  # Replace $international_prefix with REPORTS_INTERNATIONAL_PREFIX
  sed \
    -e 's/@international_prefix/'"${REPORTS_INTERNATIONAL_PREFIX}"'/g' \
    -e 's/@database_name/'"${cdr_database_name}"'/g' \
    /opt/nethvoice-report/scripts/schema.sql.tmpl | mysql -u"${cdr_database_user}" -p"${cdr_database_password}" -h"${cdr_database_host}" -P"${cdr_database_port}"

  # Wait for phonebook database to be ready
  phonebook_database_host=$(jq -r '.phonebook_database.host' $reports_config)
  phonebook_database_port=$(jq -r '.phonebook_database.port' $reports_config)
  wait-for "${phonebook_database_host}:${phonebook_database_port}" -t 30 -- echo "phonebook database is up"

  # Wait for freepbx database to be ready
  freepbx_database_host=$(jq -r '.freepbx_database.host' $reports_config)
  freepbx_database_port=$(jq -r '.freepbx_database.port' $reports_config)
  wait-for "${freepbx_database_host}:${freepbx_database_port}" -t 30 -- echo "freepbx database is up"
fi

# Execute command
exec "$@"
