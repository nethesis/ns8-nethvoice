#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "${SCRIPT_DIR}/lib/env.sh"
source "${SCRIPT_DIR}/lib/log.sh"
source "${SCRIPT_DIR}/lib/podman.sh"
source "${SCRIPT_DIR}/lib/database.sh"
source "${SCRIPT_DIR}/lib/http.sh"

usage() {
  cat <<EOF
Usage: $(basename "$0") [command] [args]

Commands:
  run [manifest]                Start the local stack, seed it, and run a manifest
  start                         Start the local stack and seed the baseline data
  seed                          Seed FreePBX and local REST users into a running stack
  run-manifest [manifest]       Execute a REST manifest against the running stack
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