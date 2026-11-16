#!/bin/bash

#
# Copyright (C) 2019 Nethesis S.r.l.
# http://www.nethesis.it - nethserver@nethesis.it
#
# This script is part of NethServer.
#
# NethServer is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License,
# or any later version.
#
# NethServer is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with NethServer.  If not, see COPYING.
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MODE="${1:-local}"

require_command() {
    if command -v "$1" >/dev/null 2>&1; then
        return 0
    fi

    echo "Missing required command: $1" >&2
    exit 1
}

ensure_bats() {
    if command -v bats >/dev/null 2>&1; then
        return 0
    fi

    echo "The bats command is missing." >&2
    echo "Install bats-core with your package manager before running the suite." >&2
    exit 1
}

pick_local_port() {
    if [[ -n "${TANCREDI_PORT:-}" ]]; then
        printf '%s\n' "${TANCREDI_PORT}"
        return 0
    fi

    local port
    for port in 18080 18081 18082 18083 18084; do
        if ! ss -ltnH "( sport = :${port} )" 2>/dev/null | grep -q .; then
            printf '%s\n' "${port}"
            return 0
        fi
    done

    echo "Could not find a free TCP port for the local PHP test server." >&2
    exit 1
}

create_rw_layout() {
    mkdir -p \
        "${TANCREDI_RW_DIR%/}/backgrounds" \
        "${TANCREDI_RW_DIR%/}/firmware" \
        "${TANCREDI_RW_DIR%/}/first_access_tokens" \
    "${TANCREDI_RW_DIR%/}/patterns.d" \
        "${TANCREDI_RW_DIR%/}/ringtones" \
        "${TANCREDI_RW_DIR%/}/scopes" \
        "${TANCREDI_RW_DIR%/}/screensavers" \
        "${TANCREDI_RW_DIR%/}/templates-custom" \
        "${TANCREDI_RW_DIR%/}/tokens"
}

seed_packaged_test_assets() {
    local filetype

    for filetype in backgrounds firmware ringtones screensavers; do
        mkdir -p "${TANCREDI_RO_DIR%/}/${filetype}"
        printf 'packaged %s asset\n' "${filetype}" > "${TANCREDI_RO_DIR%/}/${filetype}/packaged-test.txt"
    done
}

write_local_config() {
    seed_packaged_test_assets
    cat > "${TANCREDI_CONFIG}" <<EOF
[config]
rw_dir = "${TANCREDI_RW_DIR}"
ro_dir = "${TANCREDI_RO_DIR}"
provisioning_url_path = "/provisioning/"
api_url_path = "/tancredi/api/v1/"
file_reader = "native"
displayErrorDetails = 1
debug = 1

[macvendors]
00A859 = fanvil
0C383E = fanvil
7C2F80 = gigaset
589EC6 = gigaset
005058 = sangoma
000413 = snom
001565 = yealink
805E0C = yealink
805EC0 = yealink
EOF
}

wait_for_server() {
    local url="${1}"
    local _attempt
    for _attempt in $(seq 1 50); do
        if curl -fsS "${url}" >/dev/null 2>&1; then
            return 0
        fi
        sleep 0.2
    done

    echo "Local PHP test server did not become ready: ${url}" >&2
    return 1
}

cleanup_local_server() {
    local exit_code="$1"

    if [[ -n "${SERVER_PID:-}" ]] && kill -0 "${SERVER_PID}" >/dev/null 2>&1; then
        kill "${SERVER_PID}" >/dev/null 2>&1 || true
        wait "${SERVER_PID}" >/dev/null 2>&1 || true
    fi

    exit "${exit_code}"
}

run_bats() {
    cd "${SCRIPT_DIR}"
    bats bats/
}

run_local_mode() {
    require_command curl
    require_command php
    require_command ss

    export TANCREDI_APP_ROOT="${REPO_ROOT}"
    export TANCREDI_TEST_ROOT="${TANCREDI_TEST_ROOT:-${REPO_ROOT}/var/test-runtime}"
    export TANCREDI_RO_DIR="${TANCREDI_RO_DIR:-${REPO_ROOT}/data/}"
    export TANCREDI_RW_DIR="${TANCREDI_RW_DIR:-${TANCREDI_TEST_ROOT}/data/}"
    export TANCREDI_SCRIPTS_DIR="${TANCREDI_SCRIPTS_DIR:-${REPO_ROOT}/scripts/}"
    export TANCREDI_TEMPLATE_CUSTOM_DIR="${TANCREDI_TEMPLATE_CUSTOM_DIR:-${TANCREDI_RW_DIR}templates-custom/}"
    export TANCREDI_ARTIFACT_DIR="${TANCREDI_ARTIFACT_DIR:-${TANCREDI_TEST_ROOT}/artifacts}"
    export TANCREDI_CONFIG="${TANCREDI_CONFIG:-${TANCREDI_TEST_ROOT}/tancredi.conf}"
    export APP_DEBUG="true"

    rm -rf "${TANCREDI_TEST_ROOT}"
    mkdir -p "${TANCREDI_TEST_ROOT}" "${TANCREDI_ARTIFACT_DIR}"
    create_rw_layout
    write_local_config

    local port
    port="$(pick_local_port)"
    export TANCREDI_BASE_URL="http://127.0.0.1:${port}"
    export tancredi_conf="${TANCREDI_CONFIG}"
    export TANCREDI_SERVER_LOG="${TANCREDI_TEST_ROOT}/php-server.log"

    tancredi_conf="${TANCREDI_CONFIG}" APP_DEBUG="true" \
        php -S "127.0.0.1:${port}" -t "${REPO_ROOT}" "${SCRIPT_DIR}/router.php" \
        >"${TANCREDI_SERVER_LOG}" 2>&1 &
    SERVER_PID="$!"
    trap 'cleanup_local_server "$?"' EXIT INT TERM

    wait_for_server "${TANCREDI_BASE_URL}/tancredi/api/v1/defaults"
    run_bats
}

run_system_mode() {
    export TANCREDI_APP_ROOT="${REPO_ROOT}"
    export TANCREDI_RO_DIR="${TANCREDI_RO_DIR:-/usr/share/tancredi/data/}"
    export TANCREDI_RW_DIR="${TANCREDI_RW_DIR:-/var/lib/tancredi/data/}"
    export TANCREDI_SCRIPTS_DIR="${TANCREDI_SCRIPTS_DIR:-/usr/share/tancredi/scripts/}"
    export TANCREDI_TEMPLATE_CUSTOM_DIR="${TANCREDI_TEMPLATE_CUSTOM_DIR:-${TANCREDI_RW_DIR}templates-custom/}"
    export TANCREDI_ARTIFACT_DIR="${TANCREDI_ARTIFACT_DIR:-/tmp/fixtures}"

    mkdir -p "${TANCREDI_ARTIFACT_DIR}"
    seed_packaged_test_assets
    run_bats
}

ensure_bats

case "${MODE}" in
    local)
        run_local_mode
        ;;
    system|ci)
        run_system_mode
        ;;
    *)
        echo "Usage: $0 [local|system|ci]" >&2
        exit 1
        ;;
esac
