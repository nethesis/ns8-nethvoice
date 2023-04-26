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

  # Wait for redis to be ready
  redis_address=$(jq -r '.redis_address' /opt/nethvoice-report.json)
  wait-for "${redis_address}" -t 30 -- echo "redis is up"

  # Wait for cdr database to be ready
  cdr_database_host=$(jq -r '.cdr_database.host' /opt/nethvoice-report.json)
  cdr_database_port=$(jq -r '.cdr_database.port' /opt/nethvoice-report.json)
  wait-for "${cdr_database_host}:${cdr_database_port}" -t 30 -- echo "cdr database is up"

  # Migrate cdr database
  # Check if REPORTS_INTERNATIONAL_PREFIX is set, otherwise exit
  if [ -z "${REPORTS_INTERNATIONAL_PREFIX}" ]; then
    echo "REPORTS_INTERNATIONAL_PREFIX is not set"
    exit 1
  fi
  # Fetch credentials from nethvoice-report.json
  cdr_database_user=$(jq -r '.cdr_database.user' /opt/nethvoice-report.json)
  cdr_database_password=$(jq -r '.cdr_database.password' /opt/nethvoice-report.json)
  cdr_database_name=$(jq -r '.cdr_database.name' /opt/nethvoice-report.json)
  # Replace $international_prefix with REPORTS_INTERNATIONAL_PREFIX
  sed \
    -e 's/@international_prefix/'"${REPORTS_INTERNATIONAL_PREFIX}"'/g' \
    -e 's/@database_name/'"${cdr_database_name}"'/g' \
    /opt/nethvoice-report/scripts/migration.sql.tmpl | mysql -u"${cdr_database_user}" -p"${cdr_database_password}" -h"${cdr_database_host}" -P"${cdr_database_port}"

  # Wait for phonebook database to be ready
  phonebook_database_host=$(jq -r '.phonebook_database.host' /opt/nethvoice-report.json)
  phonebook_database_port=$(jq -r '.phonebook_database.port' /opt/nethvoice-report.json)
  wait-for "${phonebook_database_host}:${phonebook_database_port}" -t 30 -- echo "phonebook database is up"

  # Wait for freepbx database to be ready
  freepbx_database_host=$(jq -r '.freepbx_database.host' /opt/nethvoice-report.json)
  freepbx_database_port=$(jq -r '.freepbx_database.port' /opt/nethvoice-report.json)
  wait-for "${freepbx_database_host}:${freepbx_database_port}" -t 30 -- echo "freepbx database is up"
fi

# Execute command
exec "$@"
