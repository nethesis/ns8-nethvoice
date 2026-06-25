#!/usr/bin/env bash

lt_seed_freepbx_admin() {
  podman exec -i "${MARIADB_CONTAINER}" sh -lc \
    "mysql -uroot -p\"${MARIADB_ROOT_PASSWORD}\"" >/dev/null 2>&1 <<SQL || true
USE asterisk;
UPDATE ampusers
   SET password_sha1 = SHA1('${FREEPBX_ADMIN_PASSWORD}'),
       sections = '*'
 WHERE username = '${FREEPBX_ADMIN_USER}';
SQL
}

lt_set_need_reload() {
  podman exec -i "${MARIADB_CONTAINER}" sh -lc \
    "mysql -uroot -p\"${MARIADB_ROOT_PASSWORD}\"" >/dev/null 2>&1 <<SQL || true
USE asterisk;
UPDATE admin
   SET value = 'true'
 WHERE variable = 'need_reload';
SQL
}

lt_export_asterisk_dump() {
  local output_path="$1"

  mkdir -p "$(dirname "${output_path}")"

  lt_section 'Exporting Asterisk MariaDB dump'
  podman exec "${MARIADB_CONTAINER}" sh -lc \
    "mysqldump -uroot -p\"${MARIADB_ROOT_PASSWORD}\" --single-transaction --routines --triggers --events --add-drop-database --databases asterisk --skip-comments --skip-dump-date" \
    > "${output_path}"
}

lt_import_asterisk_dump() {
  local input_path="$1"

  [[ -f "${input_path}" ]] || lt_die "Asterisk dump not found: ${input_path}"

  lt_section 'Importing Asterisk MariaDB dump'
  podman exec -i "${MARIADB_CONTAINER}" sh -lc \
    "mysql -uroot -p\"${MARIADB_ROOT_PASSWORD}\"" < "${input_path}"

  lt_sync_imported_dump_with_environment
  lt_set_need_reload
}

lt_sync_imported_dump_with_environment() {
  lt_section 'Syncing imported dump with current environment'

  podman exec "${FREEPBX_CONTAINER}" php /initdb.d/initdb.php

  lt_seed_freepbx_admin
  lt_seed_local_rest_users
}

lt_seed_local_rest_users() {
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

lt_seed_baseline() {
  lt_section 'Seeding local baseline data'
  lt_seed_freepbx_admin
  lt_wait_for_freepbx_asterisk
  lt_wait_for_tancredi
  lt_set_need_reload
  lt_wait_for_retrieve_conf
  lt_seed_local_rest_users
}