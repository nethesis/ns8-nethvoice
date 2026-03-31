#!/usr/bin/env bash
set -euo pipefail

# ------------------------------------------------------------------------------
# Fixed local test values
# ------------------------------------------------------------------------------

POD_NAME="${POD_NAME:-nethvoice-local-test}"
MARIADB_CONTAINER="${MARIADB_CONTAINER:-nethvoice-mariadb}"
FREEPBX_CONTAINER="${FREEPBX_CONTAINER:-nethvoice-freepbx}"
TANCREDI_CONTAINER="${TANCREDI_CONTAINER:-nethvoice-tancredi}"

# Use published images by default.
# Override these if you already built local tags from the repo.
NETHVOICE_MARIADB_IMAGE="${NETHVOICE_MARIADB_IMAGE:-ghcr.io/nethesis/nethvoice-mariadb:latest}"
NETHVOICE_FREEPBX_IMAGE="${NETHVOICE_FREEPBX_IMAGE:-ghcr.io/nethesis/nethvoice-freepbx:latest}"
NETHVOICE_TANCREDI_IMAGE="${NETHVOICE_TANCREDI_IMAGE:-ghcr.io/nethesis/nethvoice-tancredi:latest}"

APACHE_PORT="${APACHE_PORT:-8080}"
TANCREDIPORT="${TANCREDIPORT:-8081}"
NETHVOICE_MARIADB_PORT="${NETHVOICE_MARIADB_PORT:-3306}"
TIMEZONE="${TIMEZONE:-UTC}"

MARIADB_ROOT_PASSWORD="${MARIADB_ROOT_PASSWORD:-root-test-password}"
AMPDBHOST="${AMPDBHOST:-127.0.0.1}"
AMPDBNAME="${AMPDBNAME:-asterisk}"
AMPDBUSER="${AMPDBUSER:-asteriskuser}"
AMPDBPASS="${AMPDBPASS:-asteriskpass}"
CDRDBUSER="${CDRDBUSER:-cdruser}"
CDRDBPASS="${CDRDBPASS:-cdrpass}"
NETHCTI_DB_USER="${NETHCTI_DB_USER:-ctiuser}"
NETHCTI_DB_PASSWORD="${NETHCTI_DB_PASSWORD:-ctipass}"
PHONEBOOK_DB_NAME="${PHONEBOOK_DB_NAME:-phonebook}"
PHONEBOOK_DB_USER="${PHONEBOOK_DB_USER:-phonebookuser}"
PHONEBOOK_DB_PASS="${PHONEBOOK_DB_PASS:-phonebookpass}"
REPORTS_PASSWORD="${REPORTS_PASSWORD:-reportspass}"

ASTMANAGERPORT="${ASTMANAGERPORT:-5038}"
AMPMGRUSER="${AMPMGRUSER:-admin}"
AMPMGRPASS="${AMPMGRPASS:-ampmanagerpass}"
NETHCTI_AMI_PASSWORD="${NETHCTI_AMI_PASSWORD:-proxyctipass}"
NETHVOICESECRETKEY="${NETHVOICESECRETKEY:-local-test-secret}"
TANCREDI_STATIC_TOKEN="${TANCREDI_STATIC_TOKEN:-local-test-tancredi-token}"
NETHVOICE_HOST="${NETHVOICE_HOST:-127.0.0.1:${TANCREDIPORT}}"
NETHVOICE_PROXY_FQDN="${NETHVOICE_PROXY_FQDN:-127.0.0.1}"
NETHCTI_UI_HOST="${NETHCTI_UI_HOST:-localhost:${APACHE_PORT}}"
ASTERISK_IAX_PORT="${ASTERISK_IAX_PORT:-4569}"
PHONEBOOK_LDAP_PORT="${PHONEBOOK_LDAP_PORT:-636}"
PHONEBOOK_LDAP_USER="${PHONEBOOK_LDAP_USER:-ldapuser}"
PHONEBOOK_LDAP_PASS="${PHONEBOOK_LDAP_PASS:-ldappass}"

# Best-effort local REST login seed.
FREEPBX_ADMIN_USER="${FREEPBX_ADMIN_USER:-admin}"
FREEPBX_ADMIN_PASSWORD="${FREEPBX_ADMIN_PASSWORD:-adminpass}"
REST_AUTH_USER="${REST_AUTH_USER:-admin}"

LOCAL_SEED_USERS=(alice bob foo)
LOCAL_SEED_USER_DESCRIPTIONS=(Alice Bob Foo)
LOCAL_SEED_USER_HASHES=(
  '$2a$08$7zExxB/vTDD62/t.DXIVWOMwLaKDiTEI/IP3NctM5iyI85dAuge0y'
  '$2a$08$fT486lE2MOJm4pG.TBPR6u.UrsCFK9IU4Lq6kSaeicZzqR0UWszJu'
  '$2a$08$d63bYGHon6f76mkHGJyB6OGnqOKIwlYi4..gbw9mzXansv6glFoeu'
)
LOCAL_SEED_USER_PASSWORDS=(alicepass bobpass foopass)

# ------------------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------------------

wait_for_mariadb() {
  local retries="${1:-120}"
  local i

  for ((i=1; i<=retries; i++)); do
    if podman exec "${MARIADB_CONTAINER}" sh -lc \
      "mysqladmin ping -h 127.0.0.1 -P ${NETHVOICE_MARIADB_PORT} -uroot -p\"${MARIADB_ROOT_PASSWORD}\" --silent >/dev/null 2>&1"
    then
      return 0
    fi
    sleep 2
  done

  echo "MariaDB did not become ready in time" >&2
  podman logs "${MARIADB_CONTAINER}" || true
  return 1
}

wait_for_freepbx_asterisk() {
  if podman exec "${FREEPBX_CONTAINER}" bash -lc 'while [[ $(/usr/sbin/asterisk -rx "core show version" 2>/dev/null) != Asterisk* ]]; do ((++attempt<300)) || exit 2; sleep 1; done'
  then
    return 0
  fi

  echo "FreePBX Asterisk process did not become ready in time" >&2
  podman logs "${FREEPBX_CONTAINER}" || true
  return 1
}

run_pod_php_http_request() {
  local container="$1"
  local method="$2"
  local url="$3"
  local payload="${4-}"

  podman exec \
    -e NV_METHOD="${method}" \
    -e NV_URL="${url}" \
    -e NV_SECRETKEY="${REST_API_SECRETKEY:-}" \
    -e NV_USER="${REST_AUTH_USER:-}" \
    -e NV_PAYLOAD="${payload}" \
    "${container}" \
    php -r '
      $headers = [
        "Secretkey: " . getenv("NV_SECRETKEY"),
        "User: " . getenv("NV_USER"),
        "Content-Type: application/json;charset=UTF-8",
        "Accept: application/json, text/plain, */*",
      ];
      $options = [
        "http" => [
          "method" => getenv("NV_METHOD"),
          "ignore_errors" => true,
          "header" => implode("\r\n", $headers),
        ],
      ];

      $payload = getenv("NV_PAYLOAD");
      if ($payload !== "") {
        $options["http"]["content"] = $payload;
      }

      $context = stream_context_create($options);
      $body = @file_get_contents(getenv("NV_URL"), false, $context);
      if ($body === false) {
        $body = "";
      }

      $statusLine = $http_response_header[0] ?? "";
      preg_match("/\\s(\\d{3})\\s/", $statusLine, $matches);
      fwrite(STDOUT, $body . PHP_EOL . ($matches[1] ?? "000"));
    '
}

wait_for_tancredi() {
  local retries="${1:-120}"
  local i
  local response
  local http_code

  for ((i=1; i<=retries; i++)); do
    response="$(run_pod_php_http_request "${FREEPBX_CONTAINER}" GET "http://127.0.0.1:${TANCREDIPORT}/tancredi/api/v1/phones" '' || true)"
    http_code="${response##*$'\n'}"

    if [[ "${http_code}" == '200' || "${http_code}" == '403' ]]; then
      return 0
    fi
    sleep 2
  done

  echo "Tancredi did not become ready in time" >&2
  podman logs "${TANCREDI_CONTAINER}" || true
  return 1
}

seed_freepbx() {
  # Best effort:
  # if the ampusers table and the admin row already exist, force a known password.
  # If they do not exist yet, keep going; the final curl still works as a smoke test.
  podman exec -i "${MARIADB_CONTAINER}" sh -lc \
    "mysql -uroot -p\"${MARIADB_ROOT_PASSWORD}\"" >/dev/null 2>&1 <<SQL || true
USE asterisk;
UPDATE ampusers
   SET password_sha1 = SHA1('${FREEPBX_ADMIN_PASSWORD}'),
       sections = '*'
 WHERE username = '${FREEPBX_ADMIN_USER}';
SQL
}

set_need_reload() {
  podman exec -i "${MARIADB_CONTAINER}" sh -lc \
    "mysql -uroot -p\"${MARIADB_ROOT_PASSWORD}\"" >/dev/null 2>&1 <<SQL || true
USE asterisk;
UPDATE admin
    SET value = 'true'
  WHERE variable = 'need_reload';
SQL
}

wait_for_retrieve_conf() {
  local retries="${1:-360}"
  local i
  echo "Waiting for FreePBX to initialize (this can take several minutes)..."
  for i in $(seq 1 "${retries}"); do
    if podman exec "${MARIADB_CONTAINER}" sh -lc \
      "mysql -uroot -p\"${MARIADB_ROOT_PASSWORD}\" -e \"SELECT 1 FROM asterisk.admin WHERE variable='need_reload' AND value='false'\" -s -N" | grep -q 1
    then
      echo "FreePBX initialization complete."
      return 0
    fi
    sleep 2
  done
  echo "FreePBX did not initialize in time" >&2
  podman logs "${FREEPBX_CONTAINER}" || true
  return 1
}

seed_local_rest_users() {
  local i
  local username
  local description
  local password_hash
  local clear_password

  for i in "${!LOCAL_SEED_USERS[@]}"; do
    username="${LOCAL_SEED_USERS[$i]}"
    description="${LOCAL_SEED_USER_DESCRIPTIONS[$i]}"
    password_hash="${LOCAL_SEED_USER_HASHES[$i]}"
    clear_password="${LOCAL_SEED_USER_PASSWORDS[$i]}"

    podman exec -i "${MARIADB_CONTAINER}" sh -lc \
      "mysql -uroot -p\"${MARIADB_ROOT_PASSWORD}\"" >/dev/null <<SQL
USE asterisk;
INSERT INTO userman_users (
  auth,
  authid,
  username,
  description,
  password,
  default_extension,
  primary_group,
  permissions
) VALUES (
  '1',
  NULL,
  '${username}',
  '${description}',
  '${password_hash}',
  'none',
  NULL,
  NULL
)
ON DUPLICATE KEY UPDATE
  auth = VALUES(auth),
  description = VALUES(description),
  password = VALUES(password),
  default_extension = VALUES(default_extension),
  primary_group = VALUES(primary_group),
  permissions = VALUES(permissions);

INSERT INTO rest_users (user_id, password)
SELECT id, '${clear_password}'
  FROM userman_users
 WHERE username = '${username}'
   AND auth = '1'
ON DUPLICATE KEY UPDATE
  password = VALUES(password);
SQL
  done
}

sha1_hex() {
  printf '%s' "$1" | sha1sum | awk '{print $1}'
}

build_rest_secretkey() {
  local password_sha1

  password_sha1="$(sha1_hex "${FREEPBX_ADMIN_PASSWORD}")"
  sha1_hex "${REST_AUTH_USER}${password_sha1}${NETHVOICESECRETKEY}"
}

run_authenticated_api() {
  local method="$1"
  local path="$2"
  local payload="${3-}"
  local expected_codes="${4:-200}"
  local url
  local response
  local body
  local http_code
  local expected_code
  local matched=false
  local curl_args=(
    -sS
    -o
    -
    -w
    '\n%{http_code}'
    -X
    "${method}"
    -H
    "Secretkey: ${REST_API_SECRETKEY}"
    -H
    "User: ${REST_AUTH_USER}"
    -H
    'Content-Type: application/json;charset=UTF-8'
    -H
    'Accept: application/json, text/plain, */*'
  )

  if [[ -n "${payload}" ]]; then
    curl_args+=(--data-raw "${payload}")
  fi

  if [[ "${path}" == /tancredi/* || "${path}" == /provisioning/* ]]; then
    url="http://127.0.0.1:${TANCREDIPORT}${path}"
    response="$(run_pod_php_http_request "${FREEPBX_CONTAINER}" "${method}" "${url}" "${payload}")"
  else
    url="http://127.0.0.1:${APACHE_PORT}${path}"
    response="$(curl "${curl_args[@]}" "${url}")"
  fi

  http_code="${response##*$'\n'}"
  body="${response%$'\n'*}"

  echo
  echo -n "${method} ${path} "
  echo "HTTP ${http_code}"
  if [[ -n "${body}" ]]; then
    printf '%s\n' "${body}"
  fi

  IFS=',' read -r -a _expected_codes <<< "${expected_codes}"
  for expected_code in "${_expected_codes[@]}"; do
    if [[ "${http_code}" == "${expected_code}" ]]; then
      matched=true
      break
    fi
  done

  if [[ "${matched}" != true ]]; then
    echo >&2
    echo "Unexpected HTTP status for ${method} ${path}. Expected ${expected_codes}, got ${http_code}." >&2
    #echo "FreePBX logs:" >&2
    #(podman logs "${FREEPBX_CONTAINER}" | tail -n30) || true
    #exit 1
  fi
}

run_authenticated_api_sequence() {
  REST_API_SECRETKEY="$(build_rest_secretkey)"

  echo
  echo "Authenticated API sequence"
  echo "User:      ${REST_AUTH_USER}"
  echo "Secretkey: ${REST_API_SECRETKEY}"

  # Keep this sequence aligned with the requested capture order.
  run_authenticated_api POST '/freepbx/rest/mainextensions' '{"username":"alice","extension":"201"}' '201'
  run_authenticated_api POST '/freepbx/rest/mainextensions' '{"username":"bob","extension":"202"}' '201'
  run_authenticated_api GET '/freepbx/rest/mainextensions/userlimits' '' '200'
  run_authenticated_api POST '/freepbx/rest/mainextensions' '{"username":"foo","extension":"203"}' '201'
  run_authenticated_api GET '/freepbx/rest/mainextensions/userlimits' '' '200'
  run_authenticated_api POST '/freepbx/rest/configuration/wizard' '{"status":"true","step":2}' '200'
  run_authenticated_api GET '/freepbx/rest/devices/gateways/list/e2fa272b0b69291f2916ccf63f55d0e8' '' '200'
  run_authenticated_api GET '/freepbx/rest/users/false' '' '200'
  run_authenticated_api POST '/freepbx/rest/configuration/wizard' '{"status":"true","step":3}' '200'
  run_authenticated_api GET '/freepbx/rest/providers' '' '200'
  run_authenticated_api GET '/freepbx/rest/trunks' '' '200'
  run_authenticated_api GET '/freepbx/rest/codecs/voip' '' '200'
  run_authenticated_api POST '/freepbx/rest/configuration/wizard' '{"status":"true","step":2}' '200'
  run_authenticated_api GET '/freepbx/rest/devices/gateways/list/e2fa272b0b69291f2916ccf63f55d0e8' '' '200'
  run_authenticated_api GET '/freepbx/rest/devices/gateways/manufacturers' '' '200'
  run_authenticated_api GET '/freepbx/rest/users/false' '' '200'
  run_authenticated_api POST '/freepbx/rest/devices/gateways' '{"proxy":"sip::;lr","ipv4_green":"192.168.12.32","manufacturer":"Patton","name":"Patton-TRINITY ISDN 2 Porte","model":"17","trunks_isdn":[{"name":0,"type":"pp"},{"name":1,"type":"pmp"}],"trunks_pri":[],"trunks_fxo":[],"trunks_fxs":[],"ipv4_new":"192.168.12.34","mac":"00:AA:BB:CC:DD:EE","netmask_green":"255.255.255.248","gateway":"192.168.12.33","onSave":true,"onSaveSuccess":false,"onError":false,"onDeleteSuccess":false,"onPushSuccess":false,"ipv4":""}' '200'
  run_authenticated_api GET '/freepbx/rest/devices/gateways/list/e2fa272b0b69291f2916ccf63f55d0e8' '' '200'
  run_authenticated_api POST '/freepbx/rest/configuration/wizard' '{"status":"true","step":3}' '200'
  run_authenticated_api GET '/freepbx/rest/providers' '' '200'
  run_authenticated_api GET '/freepbx/rest/trunks' '' '200'
  run_authenticated_api GET '/freepbx/rest/codecs/voip' '' '200'
  run_authenticated_api POST '/freepbx/rest/configuration/wizard' '{"status":"true","step":4}' '200'
  run_authenticated_api GET '/freepbx/rest/inboundroutes' '' '200'
  run_authenticated_api POST '/freepbx/rest/configuration/wizard' '{"status":"true","step":5}' '200'
  run_authenticated_api GET '/freepbx/rest/trunks' '' '200'
  run_authenticated_api GET '/freepbx/rest/outboundroutes' '' '200'
  run_authenticated_api GET '/freepbx/rest/outboundroutes/defaults' '' '200'
  run_authenticated_api POST '/freepbx/rest/outboundroutes' '{"it":[{"name":"national_it","trunks":[{"name":"Patton_ccddee_isdn_0","trunkid":"1"},{"name":"Patton_ccddee_isdn_1","trunkid":"2"}]},{"name":"cellphone_it","trunks":[{"name":"Patton_ccddee_isdn_0","trunkid":"1"},{"name":"Patton_ccddee_isdn_1","trunkid":"2"}]},{"name":"international_it","trunks":[{"name":"Patton_ccddee_isdn_0","trunkid":"1"},{"name":"Patton_ccddee_isdn_1","trunkid":"2"}]},{"name":"toll_it","trunks":[{"name":"Patton_ccddee_isdn_0","trunkid":"1"},{"name":"Patton_ccddee_isdn_1","trunkid":"2"}]}]}' '200'
  run_authenticated_api GET '/freepbx/rest/outboundroutes' '' '200'
  run_authenticated_api POST '/freepbx/rest/configuration/wizard' '{"status":"true","step":6}' '200'
  run_authenticated_api GET '/freepbx/rest/lib/macAddressMap.json' '' '200'
  run_authenticated_api GET '/tancredi/api/v1/phones' '' '200'
  run_authenticated_api GET '/freepbx/rest/configuration/networks' '' '200'
}

cleanup_old() {
  podman pod rm -f "${POD_NAME}" >/dev/null 2>&1 || true
  podman volume rm mariadb-data -f >/dev/null 2>&1 || true
  podman volume rm tancredi -f >/dev/null 2>&1 || true
  podman volume rm astdb -f >/dev/null 2>&1 || true
}

# ------------------------------------------------------------------------------
# Main
# ------------------------------------------------------------------------------

cleanup_old

echo "Pulling images..."
podman pull "${NETHVOICE_MARIADB_IMAGE}"
podman pull "${NETHVOICE_FREEPBX_IMAGE}"
podman pull "${NETHVOICE_TANCREDI_IMAGE}"

echo "Note: under rootless Podman, MariaDB can warn that /sys/fs/cgroup/.../memory.pressure is not writable."
echo "That warning is expected in local runs and does not prevent startup."

echo "Creating pod..."
podman pod create \
  --name "${POD_NAME}" \
  -p "${APACHE_PORT}:${APACHE_PORT}" \
  -p "${NETHVOICE_MARIADB_PORT}:${NETHVOICE_MARIADB_PORT}" \
  >/dev/null

echo "Initializing MariaDB..."
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
  -v mariadb-data:/var/lib/mysql:Z \
  "${NETHVOICE_MARIADB_IMAGE}" \
  >/dev/null


echo "Starting MariaDB..."
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
  -v mariadb-data:/var/lib/mysql:Z \
  "${NETHVOICE_MARIADB_IMAGE}" \
  >/dev/null

wait_for_mariadb

echo "Starting FreePBX..."
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
  -v tancredi:/var/lib/tancredi:z \
  -v astdb:/var/lib/asterisk/db:z \
  "${NETHVOICE_FREEPBX_IMAGE}" \
  >/dev/null

echo "Starting Tancredi..."
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
  -v tancredi:/var/lib/tancredi:z \
  -v astdb:/var/lib/asterisk/db:z \
  "${NETHVOICE_TANCREDI_IMAGE}" \
  >/dev/null


seed_freepbx
wait_for_freepbx_asterisk
wait_for_tancredi
set_need_reload
wait_for_retrieve_conf
seed_local_rest_users

echo
echo "Containers are up."
echo "Pod:       ${POD_NAME}"
echo "MariaDB:   ${MARIADB_CONTAINER}"
echo "FreePBX:   ${FREEPBX_CONTAINER}"
echo "Tancredi:  ${TANCREDI_CONTAINER}"
echo "FreePBX UI: http://127.0.0.1:${APACHE_PORT}/"
echo "Username:   ${FREEPBX_ADMIN_USER}"
echo "Password:   ${FREEPBX_ADMIN_PASSWORD}"
echo

run_authenticated_api_sequence
