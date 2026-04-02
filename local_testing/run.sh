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
  lt_cleanup_old
  lt_pull_images
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

  lt_fixture_test_case "${case_name}"
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