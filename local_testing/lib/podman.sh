#!/usr/bin/env bash

lt_cleanup_old() {
  lt_section 'Cleaning previous local test stack'
  podman pod rm -f "${POD_NAME}" >/dev/null 2>&1 || true
  podman volume rm "${MARIADB_VOLUME}" -f >/dev/null 2>&1 || true
  podman volume rm "${TANCREDI_VOLUME}" -f >/dev/null 2>&1 || true
  podman volume rm "${ASTDB_VOLUME}" -f >/dev/null 2>&1 || true
}

lt_pull_images() {
  lt_section 'Pulling local test images'
  podman pull "${NETHVOICE_MARIADB_IMAGE}"
  podman pull "${NETHVOICE_FREEPBX_IMAGE}"
  podman pull "${NETHVOICE_TANCREDI_IMAGE}"
  lt_warn 'Under rootless Podman, MariaDB can warn about memory.pressure not being writable. This does not block local testing.'
}

lt_create_pod() {
  lt_section 'Creating local test pod'
  podman pod create \
    --name "${POD_NAME}" \
    -p "${APACHE_PORT}:${APACHE_PORT}" \
    -p "${NETHVOICE_MARIADB_PORT}:${NETHVOICE_MARIADB_PORT}" \
    >/dev/null
}

lt_initialize_mariadb_volume() {
  lt_section 'Initializing MariaDB volume'
  podman run \
    --name "${MARIADB_CONTAINER}" \
    --replace \
    --cgroups=no-conmon \
    -e TZ=UTC \
    -e MARIADB_ROOT_PASSWORD="${MARIADB_ROOT_PASSWORD}" \
    -e NETHVOICE_MARIADB_PORT="${NETHVOICE_MARIADB_PORT}" \
    -e AMPDBUSER="${AMPDBUSER}" \
    -e AMPDBPASS="${AMPDBPASS}" \
    -e CDRDBUSER="${CDRDBUSER}" \
    -e CDRDBPASS="${CDRDBPASS}" \
    -e NETHCTI_DB_USER="${NETHCTI_DB_USER}" \
    -e NETHCTI_DB_PASSWORD="${NETHCTI_DB_PASSWORD}" \
    -e PHONEBOOK_DB_NAME="${PHONEBOOK_DB_NAME}" \
    -e PHONEBOOK_DB_USER="${PHONEBOOK_DB_USER}" \
    -e PHONEBOOK_DB_PASS="${PHONEBOOK_DB_PASS}" \
    -e REPORTS_PASSWORD="${REPORTS_PASSWORD}" \
    -v "${MARIADB_VOLUME}:/var/lib/mysql:Z" \
    "${NETHVOICE_MARIADB_IMAGE}" \
    >/dev/null
}

lt_start_mariadb() {
  lt_section 'Starting MariaDB'
  podman run -d \
    --name "${MARIADB_CONTAINER}" \
    --pod "${POD_NAME}" \
    --replace \
    --cgroups=no-conmon \
    -e TZ=UTC \
    -e MARIADB_ROOT_PASSWORD="${MARIADB_ROOT_PASSWORD}" \
    -e NETHVOICE_MARIADB_PORT="${NETHVOICE_MARIADB_PORT}" \
    -e AMPDBUSER="${AMPDBUSER}" \
    -e AMPDBPASS="${AMPDBPASS}" \
    -e CDRDBUSER="${CDRDBUSER}" \
    -e CDRDBPASS="${CDRDBPASS}" \
    -e NETHCTI_DB_USER="${NETHCTI_DB_USER}" \
    -e NETHCTI_DB_PASSWORD="${NETHCTI_DB_PASSWORD}" \
    -e PHONEBOOK_DB_NAME="${PHONEBOOK_DB_NAME}" \
    -e PHONEBOOK_DB_USER="${PHONEBOOK_DB_USER}" \
    -e PHONEBOOK_DB_PASS="${PHONEBOOK_DB_PASS}" \
    -e REPORTS_PASSWORD="${REPORTS_PASSWORD}" \
    -v "${MARIADB_VOLUME}:/var/lib/mysql:Z" \
    "${NETHVOICE_MARIADB_IMAGE}" \
    >/dev/null
}

lt_wait_for_mariadb() {
  local retries="${1:-120}"
  local i

  for ((i = 1; i <= retries; i++)); do
    if podman exec "${MARIADB_CONTAINER}" sh -lc \
      "mysqladmin ping -h 127.0.0.1 -P ${NETHVOICE_MARIADB_PORT} -uroot -p\"${MARIADB_ROOT_PASSWORD}\" --silent >/dev/null 2>&1"
    then
      return 0
    fi
    sleep 2
  done

  lt_error 'MariaDB did not become ready in time'
  podman logs "${MARIADB_CONTAINER}" || true
  return 1
}

lt_start_freepbx() {
  lt_section 'Starting FreePBX'
  podman run -d \
    --name "${FREEPBX_CONTAINER}" \
    --pod "${POD_NAME}" \
    --cgroups=no-conmon \
    -e TZ=UTC \
    -e TIMEZONE="${TIMEZONE}" \
    -e APACHE_PORT="${APACHE_PORT}" \
    -e NETHVOICE_MARIADB_PORT="${NETHVOICE_MARIADB_PORT}" \
    -e AMPDBHOST="${AMPDBHOST}" \
    -e AMPDBNAME="${AMPDBNAME}" \
    -e AMPDBUSER="${AMPDBUSER}" \
    -e AMPDBPASS="${AMPDBPASS}" \
    -e CDRDBUSER="${CDRDBUSER}" \
    -e CDRDBPASS="${CDRDBPASS}" \
    -e NETHCTI_DB_USER="${NETHCTI_DB_USER}" \
    -e NETHCTI_DB_PASSWORD="${NETHCTI_DB_PASSWORD}" \
    -e AMPMGRUSER="${AMPMGRUSER}" \
    -e AMPMGRPASS="${AMPMGRPASS}" \
    -e APACHE_RUN_USER=asterisk \
    -e APACHE_RUN_GROUP=asterisk \
    -e ASTMANAGERPORT="${ASTMANAGERPORT}" \
    -e NETHCTI_AMI_PASSWORD="${NETHCTI_AMI_PASSWORD}" \
    -e NETHVOICESECRETKEY="${NETHVOICESECRETKEY}" \
    -e NETHVOICE_HOST="${NETHVOICE_HOST}" \
    -e NETHCTI_UI_HOST="${NETHCTI_UI_HOST}" \
    -e ASTERISK_IAX_PORT="${ASTERISK_IAX_PORT}" \
    -e TANCREDIPORT="${TANCREDIPORT}" \
    -v "${TANCREDI_VOLUME}:/var/lib/tancredi:z" \
    -v "${ASTDB_VOLUME}:/var/lib/asterisk/db:z" \
    "${NETHVOICE_FREEPBX_IMAGE}" \
    >/dev/null
}

lt_start_tancredi() {
  lt_section 'Starting Tancredi'
  podman run -d \
    --name "${TANCREDI_CONTAINER}" \
    --pod "${POD_NAME}" \
    --replace \
    --cgroups=no-conmon \
    -e TZ=UTC \
    -e TIMEZONE="${TIMEZONE}" \
    -e AMPDBUSER="${AMPDBUSER}" \
    -e AMPDBPASS="${AMPDBPASS}" \
    -e NETHVOICE_MARIADB_PORT="${NETHVOICE_MARIADB_PORT}" \
    -e NETHVOICE_HOST="${NETHVOICE_HOST}" \
    -e NETHVOICESECRETKEY="${NETHVOICESECRETKEY}" \
    -e TANCREDI_STATIC_TOKEN="${TANCREDI_STATIC_TOKEN}" \
    -e TANCREDIPORT="${TANCREDIPORT}" \
    -e NETHVOICE_PROXY_FQDN="${NETHVOICE_PROXY_FQDN}" \
    -e PHONEBOOK_LDAP_PORT="${PHONEBOOK_LDAP_PORT}" \
    -e PHONEBOOK_LDAP_USER="${PHONEBOOK_LDAP_USER}" \
    -e PHONEBOOK_LDAP_PASS="${PHONEBOOK_LDAP_PASS}" \
    -v "${TANCREDI_VOLUME}:/var/lib/tancredi:z" \
    -v "${ASTDB_VOLUME}:/var/lib/asterisk/db:z" \
    "${NETHVOICE_TANCREDI_IMAGE}" \
    >/dev/null
}

lt_wait_for_freepbx_asterisk() {
  if podman exec "${FREEPBX_CONTAINER}" bash -lc 'while [[ $(/usr/sbin/asterisk -rx "core show version" 2>/dev/null) != Asterisk* ]]; do ((++attempt<300)) || exit 2; sleep 1; done'
  then
    return 0
  fi

  lt_error 'FreePBX Asterisk process did not become ready in time'
  podman logs "${FREEPBX_CONTAINER}" || true
  return 1
}

lt_wait_for_tancredi() {
  local retries="${1:-120}"
  local i
  local response
  local http_code

  for ((i = 1; i <= retries; i++)); do
    response="$(lt_run_pod_php_http_request "${FREEPBX_CONTAINER}" GET "http://127.0.0.1:${TANCREDIPORT}/tancredi/api/v1/phones" '' || true)"
    http_code="${response##*$'\n'}"

    if [[ "${http_code}" == '200' || "${http_code}" == '403' ]]; then
      return 0
    fi
    sleep 2
  done

  lt_error 'Tancredi did not become ready in time'
  podman logs "${TANCREDI_CONTAINER}" || true
  return 1
}

lt_wait_for_retrieve_conf() {
  local retries="${1:-360}"
  local i

  lt_info 'Waiting for FreePBX to initialize (this can take several minutes)...'
  for i in $(seq 1 "${retries}"); do
    if podman exec "${MARIADB_CONTAINER}" sh -lc \
      "mysql -uroot -p\"${MARIADB_ROOT_PASSWORD}\" -e \"SELECT 1 FROM asterisk.admin WHERE variable='need_reload' AND value='false'\" -s -N" | grep -q 1
    then
      lt_info 'FreePBX initialization complete.'
      return 0
    fi
    sleep 2
  done

  lt_error 'FreePBX did not initialize in time'
  podman logs "${FREEPBX_CONTAINER}" || true
  return 1
}

lt_show_access_info() {
  printf '\n'
  lt_info 'Containers are up.'
  printf 'Pod:        %s\n' "${POD_NAME}"
  printf 'MariaDB:    %s\n' "${MARIADB_CONTAINER}"
  printf 'FreePBX:    %s\n' "${FREEPBX_CONTAINER}"
  printf 'Tancredi:   %s\n' "${TANCREDI_CONTAINER}"
  printf 'FreePBX UI: http://127.0.0.1:%s/\n' "${APACHE_PORT}"
  printf 'Username:   %s\n' "${FREEPBX_ADMIN_USER}"
  printf 'Password:   %s\n' "${FREEPBX_ADMIN_PASSWORD}"
}

lt_show_logs() {
  local target="${1:-all}"

  case "${target}" in
    mariadb)
      podman logs "${MARIADB_CONTAINER}"
      ;;
    freepbx)
      podman logs "${FREEPBX_CONTAINER}"
      ;;
    tancredi)
      podman logs "${TANCREDI_CONTAINER}"
      ;;
    all)
      lt_section 'MariaDB logs'
      podman logs "${MARIADB_CONTAINER}" || true
      lt_section 'FreePBX logs'
      podman logs "${FREEPBX_CONTAINER}" || true
      lt_section 'Tancredi logs'
      podman logs "${TANCREDI_CONTAINER}" || true
      ;;
    *)
      lt_die "Unknown log target: ${target}"
      ;;
  esac
}