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

tancredi_base_url="${TANCREDI_BASE_URL:-http://127.0.0.1}"
tancredi_ro_dir="${TANCREDI_RO_DIR:-/usr/share/tancredi/data}"
tancredi_ro_dir="${tancredi_ro_dir%/}/"
tancredi_rw_dir="${TANCREDI_RW_DIR:-/var/lib/tancredi/data}"
tancredi_rw_dir="${tancredi_rw_dir%/}/"
tancredi_scripts_dir="${TANCREDI_SCRIPTS_DIR:-/usr/share/tancredi/scripts}"
tancredi_scripts_dir="${tancredi_scripts_dir%/}/"
tancredi_template_custom_dir="${TANCREDI_TEMPLATE_CUSTOM_DIR:-${tancredi_rw_dir}templates-custom}"
tancredi_template_custom_dir="${tancredi_template_custom_dir%/}/"
tancredi_artifact_dir="${TANCREDI_ARTIFACT_DIR:-/tmp/fixtures}"

tancredi_ensure_rw_layout () {
    mkdir -p \
        "${tancredi_rw_dir}backgrounds" \
        "${tancredi_rw_dir}firmware" \
        "${tancredi_rw_dir}first_access_tokens" \
    "${tancredi_rw_dir}patterns.d" \
        "${tancredi_rw_dir}ringtones" \
        "${tancredi_rw_dir}scopes" \
        "${tancredi_rw_dir}screensavers" \
        "${tancredi_template_custom_dir}" \
        "${tancredi_rw_dir}tokens"
}

tancredi_reset_rw_dir () {
    tancredi_ensure_rw_layout

    # Safety checks: refuse to delete if tancredi_rw_dir is unsafe.
    case "${tancredi_rw_dir}" in
        ""|"/")
            echo "Refusing to delete files: tancredi_rw_dir is empty or '/'" >&2
            return 1
            ;;
    esac
    find "${tancredi_rw_dir}" -type f -delete
}

tancredi_scope_path () {
    printf '%sscopes/%s.ini\n' "${tancredi_rw_dir}" "$1"
}

tancredi_shipped_scope_path () {
    printf '%sscopes/%s.ini\n' "${tancredi_ro_dir}" "$1"
}

tancredi_upgrade_script () {
    printf '%supgrade.php\n' "${tancredi_scripts_dir}"
}

xcurl () {
    local argv
    argv=("${@}")
    argv[$((${#argv[@]} - 1))]="${tancredi_base_url}${argv[-1]}"
    curl \
      -s -i \
      -H 'Accept: application/json, application/problem+json' \
      -X "${argv[@]}"
}

GET () {
    xcurl GET "${@}"
}


DELETE () {
    xcurl DELETE "${@}"
}

POST () {
    xcurl POST \
        -d @- -H 'Content-Type: application/json; charset=UTF-8' \
        "${@}"
}

POSTFILE () {
    xcurl POST \
        "${@}"
}

PATCH () {
    xcurl PATCH \
        -d @- -H 'Content-Type: application/json; charset=UTF-8' \
        "${@}"
}

GET_PROVISIONING () {
    local user_agent="${1}"
    local path="${2}"
    curl -s -i \
        -H "User-Agent: ${user_agent}" \
        "${tancredi_base_url}${path}"
}

extract_field () {
    local field_name="${1}"
    sed -n -r '/^\s*$/,$ p' <<<"$output" | grep -o "\"${field_name}\":\"[^\"]*\"" | cut -d'"' -f4
}

assert_http_code () {
    if ! grep -q -F "HTTP/1.1 $1" <<<"${lines[@]}"; then
        echo "$output" 1>&2
        return 1
    fi
    return 0
}

assert_http_header () {
    sed '/^$/q' <<<"$output" | grep -q -F "${1}: ${2}" || :
    if [[ ${PIPESTATUS[1]} != 0 ]]; then
        echo "$output" 1>&2
        return 1
    fi
    return 0
}

assert_http_body () {
    sed -n -r '/^\s*$/,$ p' <<<"$output" | grep -q -F "$1" || :
    if [[ ${PIPESTATUS[1]} != 0 ]]; then
        echo "$output" 1>&2
        return 1
    fi
    return 0
}

assert_http_body_re () {
    sed -n -r '/^\s*$/,$ p' <<<"$output" | grep -q -E "$1" || :
    if [[ ${PIPESTATUS[1]} != 0 ]]; then
        echo "$output" 1>&2
        return 1
    fi
    return 0
}

assert_http_body_empty () {
    sed -n -r '/^\s*$/,$ p' <<<"$output" | grep -E '\w' || :
    if [[ ${PIPESTATUS[1]} == 0 ]]; then
        echo "$output" 1>&2
        return 1
    fi
    return 0
}

assert_template_matches_fixture () {
    local fixture_file="${1}"
    mkdir -p "${tancredi_artifact_dir}"
    local test_output_file="${tancredi_artifact_dir}/${fixture_file##*/}"

    echo "$output" > "$test_output_file"

    if [[ ! -f "$fixture_file" ]]; then
        echo "Fixture file not found: $fixture_file" 1>&2
        echo "It can be found in artifacts. Put it in test/fixtures." 1>&2
        return 1
    fi

    local diff_output diff_status
    echo diff -auZEbB --strip-trailing-cr "$fixture_file" "$test_output_file"
    if ! diff_output="$(diff -auZEbB --strip-trailing-cr "$fixture_file" "$test_output_file")"; then
        diff_status=$?
        if [[ $diff_status -eq 1 ]]; then
            printf '%s\n' "$diff_output" 1>&2
            echo "Template output does not match fixture file" 1>&2
            echo "The fixture file $test_output_file can be found in artifacts" 1>&2
        else
            echo "Failed to compare template output: $diff_output" 1>&2
        fi
        return 1
    fi

    return 0
}
