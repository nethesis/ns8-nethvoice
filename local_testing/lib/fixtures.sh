#!/usr/bin/env bash

lt_fixture_case_dir() {
  local case_name="$1"

  [[ -n "${case_name}" ]] || lt_die 'Fixture case name is required'
  printf '%s/%s\n' "${FIXTURES_DIR}" "${case_name}"
}

lt_fixture_dump_path() {
  local case_name="$1"

  printf '%s/dump.sql\n' "$(lt_fixture_case_dir "${case_name}")"
}

lt_fixture_archive_path() {
  local case_name="$1"

  printf '%s/etc-asterisk.tar.gz\n' "$(lt_fixture_case_dir "${case_name}")"
}

lt_fixture_dir_is_ignored() {
  local case_dir="$1"
  local case_name

  case_name="$(basename "${case_dir}")"
  [[ "${case_name}" == sample* ]]
}

lt_fixture_require_running_stack() {
  local mariadb_running
  local freepbx_running

  mariadb_running="$(podman inspect -f '{{.State.Running}}' "${MARIADB_CONTAINER}" 2>/dev/null || true)"
  freepbx_running="$(podman inspect -f '{{.State.Running}}' "${FREEPBX_CONTAINER}" 2>/dev/null || true)"

  [[ "${mariadb_running}" == 'true' ]] || lt_die 'MariaDB container is not running. Start the local stack first.'
  [[ "${freepbx_running}" == 'true' ]] || lt_die 'FreePBX container is not running. Start the local stack first.'
}

lt_fixture_require_case() {
  local case_name="$1"
  local dump_path
  local archive_path

  dump_path="$(lt_fixture_dump_path "${case_name}")"
  archive_path="$(lt_fixture_archive_path "${case_name}")"

  [[ -f "${dump_path}" ]] || lt_die "Fixture dump not found: ${dump_path}"
  [[ -f "${archive_path}" ]] || lt_die "Fixture archive not found: ${archive_path}"
}

lt_capture_etc_asterisk_archive() {
  local output_path="$1"

  mkdir -p "$(dirname "${output_path}")"

  lt_section 'Capturing /etc/asterisk fixture archive'
  podman exec "${FREEPBX_CONTAINER}" \
    tar --exclude='asterisk/backup' -C /etc -czf - asterisk > "${output_path}"
}

lt_extract_live_asterisk_tree() {
  local target_dir="$1"

  mkdir -p "${target_dir}"
  podman exec "${FREEPBX_CONTAINER}" \
    tar --exclude='asterisk/backup' -C /etc -cf - asterisk | tar -C "${target_dir}" -xf -
}

lt_normalize_asterisk_config_file() {
  local file_path="$1"
  local pattern="$2"
  local replacement="$3"

  [[ -f "${file_path}" ]] || return 0
  sed -E -i "s|${pattern}|${replacement}|" "${file_path}"
}

lt_normalize_proxycti_file() {
  local file_path="$1"

  [[ -f "${file_path}" ]] || return 0
  awk '
    previous_line == "[secret]" { print "${NETHCTI_AMI_PASSWORD}"; previous_line = $0; next }
    { print; previous_line = $0 }
  ' "${file_path}" > "${file_path}.tmp"
  mv "${file_path}.tmp" "${file_path}"
}

lt_remove_asterisk_custom_files() {
  local target_dir="$1"

  find "${target_dir}/asterisk" -type f -iname '*custom*' -delete 2>/dev/null || true
}

lt_remove_asterisk_conf_suffix_files() {
  local target_dir="$1"

  find "${target_dir}/asterisk" -type f -regextype posix-extended \
    -regex '.*\.conf.+' -delete 2>/dev/null || true
}

lt_remove_asterisk_irrelevant_generated_files() {
  local target_dir="$1"

  rm -f \
    "${target_dir}/asterisk/voicemail.conf" \
    "${target_dir}/asterisk/voicemail.conf.template"
}

lt_strip_asterisk_comment_lines() {
  local target_dir="$1"
  local file_path

  while IFS= read -r -d '' file_path; do
    awk '!/^;/' "${file_path}" > "${file_path}.tmp"
    mv "${file_path}.tmp" "${file_path}"
  done < <(find "${target_dir}/asterisk" -type f -print0 2>/dev/null)
}

lt_normalize_asterisk_fixture_tree() {
  local target_dir="$1"

  rm -rf "${target_dir}/asterisk/backup"
  rm -rf "${target_dir}/asterisk/keys"
  rm -f "${target_dir}/asterisk/recallonbusy.cfg"
  lt_remove_asterisk_custom_files "${target_dir}"
  lt_remove_asterisk_conf_suffix_files "${target_dir}"
  lt_remove_asterisk_irrelevant_generated_files "${target_dir}"
  lt_strip_asterisk_comment_lines "${target_dir}"

  lt_normalize_asterisk_config_file \
    "${target_dir}/asterisk/manager_additional.conf" \
    '^secret=.*$' \
    'secret=${NETHCTI_AMI_PASSWORD}'
  lt_normalize_asterisk_config_file \
    "${target_dir}/asterisk/manager.conf" \
    '^port = .*$' \
    'port = ${ASTMANAGERPORT}'
  lt_normalize_asterisk_config_file \
    "${target_dir}/asterisk/manager.conf" \
    '^secret = .*$' \
    'secret = ${AMPMGRPASS}'
  lt_normalize_asterisk_config_file \
    "${target_dir}/asterisk/res_odbc_additional.conf" \
    '^password=>.*$' \
    'password=>${CDRDBPASS}'
  lt_normalize_proxycti_file "${target_dir}/asterisk/proxycti"
}

lt_fixture_create() {
  local case_name="$1"
  local case_dir
  local dump_path
  local archive_path

  lt_fixture_require_running_stack

  case_dir="$(lt_fixture_case_dir "${case_name}")"
  dump_path="$(lt_fixture_dump_path "${case_name}")"
  archive_path="$(lt_fixture_archive_path "${case_name}")"

  mkdir -p "${case_dir}"

  lt_export_asterisk_dump "${dump_path}"
  lt_capture_etc_asterisk_archive "${archive_path}"

  lt_info "Saved fixture case at ${case_dir}"
}

lt_fixture_diff_live() {
  local case_name="$1"
  local archive_path
  local tmpdir
  local diff_rc=0

  lt_fixture_require_running_stack
  lt_fixture_require_case "${case_name}"

  archive_path="$(lt_fixture_archive_path "${case_name}")"
  tmpdir="$(mktemp -d)"
  trap 'rm -rf "${tmpdir}"' RETURN

  tar -xzf "${archive_path}" -C "${tmpdir}"
  lt_normalize_asterisk_fixture_tree "${tmpdir}"
  lt_extract_live_asterisk_tree "${tmpdir}/current"
  lt_normalize_asterisk_fixture_tree "${tmpdir}/current"

  lt_section "Diffing /etc/asterisk against fixture ${case_name}"
  if diff -ruN "${tmpdir}/asterisk" "${tmpdir}/current/asterisk"; then
    diff_rc=0
  else
    diff_rc=$?
  fi

  if [[ "${diff_rc}" -eq 0 ]]; then
    lt_info "No differences found for fixture ${case_name}"
    return 0
  fi

  if [[ "${diff_rc}" -eq 1 ]]; then
    lt_error "Fixture ${case_name} differs from the current /etc/asterisk tree"
    return 1
  fi

  return "${diff_rc}"
}

lt_fixture_test_case() {
  local case_name="$1"
  local dump_path

  lt_fixture_require_case "${case_name}"
  dump_path="$(lt_fixture_dump_path "${case_name}")"

  lt_import_asterisk_dump "${dump_path}"
  lt_run_fwconsole_reload
  lt_fixture_diff_live "${case_name}"
}

lt_fixture_list() {
  local case_dir
  local found=false

  mkdir -p "${FIXTURES_DIR}"

  shopt -s nullglob
  for case_dir in "${FIXTURES_DIR}"/*; do
    [[ -d "${case_dir}" ]] || continue
    lt_fixture_dir_is_ignored "${case_dir}" && continue
    if [[ -f "${case_dir}/dump.sql" && -f "${case_dir}/etc-asterisk.tar.gz" ]]; then
      printf '%s\n' "$(basename "${case_dir}")"
      found=true
    fi
  done
  shopt -u nullglob

  if [[ "${found}" != true ]]; then
    lt_info 'No fixture cases found.'
  fi
}