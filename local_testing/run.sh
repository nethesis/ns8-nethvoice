#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "${SCRIPT_DIR}/lib/env.sh"
source "${SCRIPT_DIR}/lib/log.sh"
source "${SCRIPT_DIR}/lib/podman.sh"
source "${SCRIPT_DIR}/lib/database.sh"
source "${SCRIPT_DIR}/lib/fixtures.sh"
source "${SCRIPT_DIR}/lib/http.sh"

usage() {
  cat <<EOF
Usage: $(basename "$0") [command] [args]

Commands:
  run [manifest]                Start the local stack, seed it, and run a manifest
  start                         Start the local stack and seed the baseline data
  seed                          Seed FreePBX and local REST users into a running stack
  run-manifest [manifest]       Execute a REST manifest against the running stack
  create-fixture CASE [manifest]
                                Start a clean stack, optionally run a manifest, and save dump.sql plus etc-asterisk.tar.gz
  diff-fixture CASE             Diff the running FreePBX /etc/asterisk tree against a saved fixture
  test-fixture CASE             Start a clean stack, import the saved dump, regenerate config, and diff against the fixture
  compare-freepbx-images [--keep-artifacts [DIR]] DUMP
                                Generate /etc/asterisk with the released image, upgrade that dump with the local image, and diff the two trees
  list-fixtures                 List saved fixture cases
  request METHOD PATH [BODY] [EXPECTED]
                                Execute a single authenticated REST request
  cleanup                       Remove the local pod and test volumes
  logs [mariadb|freepbx|tancredi]
                                Show logs for one container or all of them
  help                          Show this message

Environment overrides are documented in local_testing/LOCAL_TESTING.md.
EOF
}

start_stack() {
  local mariadb_policy="${1:-${LOCAL_TESTING_IMAGE_PULL_POLICY}}"
  local freepbx_policy="${2:-${LOCAL_TESTING_IMAGE_PULL_POLICY}}"
  local tancredi_policy="${3:-${LOCAL_TESTING_IMAGE_PULL_POLICY}}"

  lt_cleanup_old
  lt_pull_images "${mariadb_policy}" "${freepbx_policy}" "${tancredi_policy}"
  lt_create_pod
  lt_initialize_mariadb_volume
  lt_start_mariadb
  lt_wait_for_mariadb
  lt_start_freepbx
  lt_start_tancredi
  lt_seed_baseline
  lt_show_access_info
}

run_manifest_command() {
  local manifest="${1:-${LOCAL_TESTING_DIR}/manifests/default.json}"

  lt_compute_rest_secretkey
  lt_run_manifest "${manifest}"
}

create_fixture_command() {
  local case_name="$1"
  local manifest="${2-}"

  [[ -n "${case_name}" ]] || lt_die 'Fixture case name is required'

  start_stack
  if [[ -n "${manifest}" ]]; then
    run_manifest_command "${manifest}"
    lt_wait_for_retrieve_conf
  fi
  lt_fixture_create "${case_name}"
}

test_fixture_command() {
  local case_name="$1"

  [[ -n "${case_name}" ]] || lt_die 'Fixture case name is required'

  start_stack
  lt_fixture_test_case "${case_name}"
}

with_freepbx_image() {
  local image_ref="$1"
  shift

  (
    export NETHVOICE_FREEPBX_IMAGE="${image_ref}"
    "$@"
  )
}

generate_live_fixture_tree_command() {
  local dump_path="$1"
  local output_dir="$2"
  local freepbx_policy="${3:-${LOCAL_TESTING_IMAGE_PULL_POLICY}}"

  [[ -f "${dump_path}" ]] || lt_die "Asterisk dump not found: ${dump_path}"

  start_stack "${LOCAL_TESTING_IMAGE_PULL_POLICY}" "${freepbx_policy}" "${LOCAL_TESTING_IMAGE_PULL_POLICY}"
  lt_fixture_generate_live_tree_from_dump "${dump_path}" "${output_dir}"
}

create_compare_artifacts_dir() {
  local requested_dir="${1:-}"

  if [[ -n "${requested_dir}" ]]; then
    mkdir -p "${requested_dir}"
    printf '%s\n' "${requested_dir}"
    return 0
  fi

  mkdir -p "${LOCAL_TESTING_DIR}/artifacts"
  mktemp -d "${LOCAL_TESTING_DIR}/artifacts/compare-freepbx-images.XXXXXX"
}

compare_freepbx_images_command() {
  local dump_path=''
  local local_image="${NETHVOICE_FREEPBX_IMAGE}"
  local released_image="${NETHVOICE_RELEASED_FREEPBX_IMAGE}"
  local tmpdir
  local upgraded_dump_path
  local keep_artifacts=false
  local artifacts_dir=''
  local diff_output_path=''

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --keep-artifacts)
        keep_artifacts=true
        if [[ $# -gt 1 && "$2" != -* ]]; then
          artifacts_dir="$2"
          shift 2
        else
          shift
        fi
        ;;
      -*)
        lt_die "Unknown option for compare-freepbx-images: $1"
        ;;
      *)
        if [[ -n "${dump_path}" ]]; then
          lt_die 'compare-freepbx-images accepts a single dump path'
        fi
        dump_path="$1"
        shift
        ;;
    esac
  done

  [[ -n "${dump_path}" ]] || lt_die 'Asterisk dump path is required'
  [[ -f "${dump_path}" ]] || lt_die "Asterisk dump not found: ${dump_path}"

  if [[ "${keep_artifacts}" == true ]]; then
    tmpdir="$(create_compare_artifacts_dir "${artifacts_dir}")"
    diff_output_path="${tmpdir}/compare.diff"
    cp "${dump_path}" "${tmpdir}/input-dump.sql"
    lt_info "Keeping compare artifacts at ${tmpdir}"
  else
    tmpdir="$(mktemp -d)"
  fi

  upgraded_dump_path="${tmpdir}/released-upgraded.sql"
  trap 'lt_cleanup_old; [[ "${keep_artifacts}" == true ]] || rm -rf "${tmpdir}"' RETURN

  lt_section "Generating /etc/asterisk with released FreePBX image ${released_image}"
  with_freepbx_image \
    "${released_image}" \
    generate_live_fixture_tree_command \
    "${dump_path}" \
    "${tmpdir}/released" \
    always

  lt_section "Exporting upgraded dump from released FreePBX image ${released_image}"
  lt_export_asterisk_dump "${upgraded_dump_path}"

  lt_section "Generating /etc/asterisk with upgraded local FreePBX image ${local_image}"
  with_freepbx_image \
    "${local_image}" \
    generate_live_fixture_tree_command \
    "${upgraded_dump_path}" \
    "${tmpdir}/upgraded" \
    rebuild

  if [[ -n "${diff_output_path}" ]]; then
    lt_diff_asterisk_trees \
      "${tmpdir}/released" \
      "${tmpdir}/upgraded" \
      "released FreePBX image ${released_image}" \
      "upgraded local FreePBX image ${local_image}" \
      "${diff_output_path}"
  else
    lt_diff_asterisk_trees \
      "${tmpdir}/released" \
      "${tmpdir}/upgraded" \
      "released FreePBX image ${released_image}" \
      "upgraded local FreePBX image ${local_image}"
  fi
}

command="${1:-run}"
if [[ $# -gt 0 ]]; then
  shift
fi

case "${command}" in
  run)
    start_stack
    run_manifest_command "$@"
    ;;
  start)
    start_stack
    ;;
  seed)
    lt_seed_baseline
    ;;
  run-manifest)
    run_manifest_command "$@"
    ;;
  create-fixture)
    if [[ $# -lt 1 ]]; then
      usage >&2
      exit 1
    fi
    create_fixture_command "$@"
    ;;
  diff-fixture)
    if [[ $# -ne 1 ]]; then
      usage >&2
      exit 1
    fi
    lt_fixture_diff_live "$1"
    ;;
  test-fixture)
    if [[ $# -ne 1 ]]; then
      usage >&2
      exit 1
    fi
    test_fixture_command "$1"
    ;;
  compare-freepbx-images)
    if [[ $# -lt 1 ]]; then
      usage >&2
      exit 1
    fi
    compare_freepbx_images_command "$@"
    ;;
  list-fixtures)
    lt_fixture_list
    ;;
  request)
    if [[ $# -lt 2 ]]; then
      usage >&2
      exit 1
    fi
    lt_compute_rest_secretkey
    lt_run_authenticated_api "$1" "$2" "${3-}" "${4:-200}"
    ;;
  cleanup)
    lt_cleanup_old
    ;;
  logs)
    lt_show_logs "${1-}"
    ;;
  help|-h|--help)
    usage
    ;;
  *)
    lt_error "Unknown command: ${command}"
    usage >&2
    exit 1
    ;;
esac