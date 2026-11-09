#!/usr/bin/env bats

#
# Copyright (C) 2020 Nethesis S.r.l.
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

ASSET_TEST_RW_DIR="${TANCREDI_RW_DIR:-/var/lib/tancredi/data}"
ASSET_TEST_RW_DIR="${ASSET_TEST_RW_DIR%/}/"

setup () {
    load tancredi_client
}

asset_test_create_phone () {
    run POST /tancredi/api/v1/phones <<EOF
{
    "mac": "02-34-56-78-9A-BC",
    "model": "acme19_2",
    "display_name": "Static Asset Test Phone",
    "variables": {
        "sip_login": "220",
        "sip_password": "s3cr3t!"
    }
}
EOF
    assert_http_code "201"
}

asset_test_get_tok1 () {
    run GET /tancredi/api/v1/phones/02-34-56-78-9A-BC
    assert_http_code "200"

    local tok1
    tok1=$(extract_field "tok1")
    if [[ -z "${tok1}" ]]; then
        echo "Failed to extract tok1 token for static asset test phone" 1>&2
        return 1
    fi

    printf '%s\n' "${tok1}"
}

# Firmware

@test "POST /tancredi/api/v1/firmware (success)" {
    run POSTFILE -F "file=@/etc/hosts" /tancredi/api/v1/firmware
    assert_http_code "204"
}

@test "GET /tancredi/api/v1/firmware (success)" {
    run GET /tancredi/api/v1/firmware
    assert_http_code "200"
    assert_http_body_re "^\[{"
}

@test "DELETE /tancredi/api/v1/firmware (success)" {
    run DELETE /tancredi/api/v1/firmware/hosts
    assert_http_code "204"
}

@test "DELETE /tancredi/api/v1/firmware (failed/not found)" {
    run DELETE /tancredi/api/v1/firmware/hosts
    assert_http_code "404"
}

# Backgrounds

@test "POST /tancredi/api/v1/backgrounds (success)" {
    run POSTFILE -F "file=@/etc/hosts" /tancredi/api/v1/backgrounds
    assert_http_code "204"
}

@test "GET /tancredi/api/v1/backgrounds (success)" {
    run GET /tancredi/api/v1/backgrounds
    assert_http_code "200"
    assert_http_body_re "^\[{"
}

@test "DELETE /tancredi/api/v1/backgrounds (success)" {
    run DELETE /tancredi/api/v1/backgrounds/hosts
    assert_http_code "204"
}

@test "DELETE /tancredi/api/v1/backgrounds (failed/not found)" {
    run DELETE /tancredi/api/v1/backgrounds/hosts
    assert_http_code "404"
}

# Ringtones

@test "POST /tancredi/api/v1/ringtones (success)" {
    run POSTFILE -F "file=@/etc/hosts" /tancredi/api/v1/ringtones
    assert_http_code "204"
}

@test "GET /tancredi/api/v1/ringtones (success)" {
    run GET /tancredi/api/v1/ringtones
    assert_http_code "200"
    assert_http_body_re "^\[{"
}

@test "DELETE /tancredi/api/v1/ringtones (success)" {
    run DELETE /tancredi/api/v1/ringtones/hosts
    assert_http_code "204"
}

@test "DELETE /tancredi/api/v1/ringtones (failed/not found)" {
    run DELETE /tancredi/api/v1/ringtones/hosts
    assert_http_code "404"
}

# Screensavers

@test "POST /tancredi/api/v1/screensavers (success)" {
    run POSTFILE -F "file=@/etc/hosts" /tancredi/api/v1/screensavers
    assert_http_code "204"
}

@test "GET /tancredi/api/v1/screensavers (success)" {
    run GET /tancredi/api/v1/screensavers
    assert_http_code "200"
    assert_http_body_re "^\[{"
}

@test "DELETE /tancredi/api/v1/screensavers (success)" {
    run DELETE /tancredi/api/v1/screensavers/hosts
    assert_http_code "204"
}

@test "DELETE /tancredi/api/v1/screensavers (failed/not found)" {
    run DELETE /tancredi/api/v1/screensavers/hosts
    assert_http_code "404"
}

@test "GET /provisioning/{tok1}/{filetype}/{filename} prefers rw and falls back to ro" {
    local filetype
    local filename="packaged-test.txt"
    local tok1

    asset_test_create_phone
    tok1=$(asset_test_get_tok1)

    for filetype in firmware backgrounds ringtones screensavers; do
        run GET_PROVISIONING "Tancredi static asset test" "/provisioning/${tok1}/${filetype}/${filename}"
        assert_http_code "200"
        assert_http_body "packaged ${filetype} asset"

        printf 'rw %s override\n' "${filetype}" > "${ASSET_TEST_RW_DIR}${filetype}/${filename}"

        run GET_PROVISIONING "Tancredi static asset test" "/provisioning/${tok1}/${filetype}/${filename}"
        assert_http_code "200"
        assert_http_body "rw ${filetype} override"

        rm -f "${ASSET_TEST_RW_DIR}${filetype}/${filename}"
    done

    run DELETE /tancredi/api/v1/phones/02-34-56-78-9A-BC
    assert_http_code "204"
}

