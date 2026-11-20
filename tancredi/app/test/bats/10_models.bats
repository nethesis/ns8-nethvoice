#!/usr/bin/env bats

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

setup () {
    load tancredi_client
}

@test "Reset storage dir" {
    tancredi_reset_rw_dir
}

@test "GET /tancredi/api/v1/models" {
    run GET /tancredi/api/v1/models
    assert_http_code "200"
}

@test "POST /tancredi/api/v1/models (acme19_2, success)" {
    run POST /tancredi/api/v1/models <<EOF
{
    "name": "acme19_2",
    "display_name": "Acme IP phone v19 rev. 2",
    "variables": {
        "var1": "value1",
        "var2": "value2"
    }
}
EOF
    assert_http_code "201"
    assert_http_header "Location" "/tancredi/api/v1/models/acme19_2"
}

@test "DELETE /tancredi/api/v1/models/acme19_2 (success)" {
    run DELETE /tancredi/api/v1/models/acme19_2
    assert_http_code "204"
}

@test "POST /tancredi/api/v1/models (acme19_2)" {
    run POST /tancredi/api/v1/models <<EOF
{
    "name": "acme19_2",
    "display_name": "Acme IP phone v19 rev. 2",
    "variables": {
        "var1": "value1",
        "var2": "value2"
    }
}
EOF
    assert_http_code "201"
    assert_http_header "Location" "/tancredi/api/v1/models/acme19_2"
}

@test "GET /tancredi/api/v1/models/acme19_2 (success)" {
    run GET /tancredi/api/v1/models/acme19_2
    assert_http_code "200"
    assert_http_body '"name":"acme19_2"'
    assert_http_body '"var1":"value1"'
}

@test "PATCH /tancredi/api/v1/models/acme19_2 (success)" {
    run PATCH /tancredi/api/v1/models/acme19_2 <<EOF
{
    "display_name": "Acme IP phone v19 rev. 2 (changed)",
    "variables": {
        "var1": "value1-changed",
        "var2": "value2"
    }
}
EOF
    assert_http_code "200"
    assert_http_body '"var1":"value1-changed"'
}

@test "GET /tancredi/api/v1/models/acme19_2/version/original" {
    skip "Not implemented"
    run GET /tancredi/api/v1/models/acme19_2/version/original
    assert_http_code "200"
}

@test "GET /tancredi/api/v1/models/acme19_2/version/1 (failed/not-found)" {
    run GET /tancredi/api/v1/models/acme19_2/version/1
    assert_http_code "404"
}

@test "POST /tancredi/api/v1/models returns last_edit_time" {
    run POST /tancredi/api/v1/models <<EOF2
{
    "name": "acme19_3",
    "display_name": "Acme IP phone v19 rev. 3",
    "variables": {
        "var1": "value1"
    }
}
EOF2
    assert_http_code "201"
    assert_http_body_re '"last_edit_time":[0-9]+'
    run DELETE /tancredi/api/v1/models/acme19_3
    assert_http_code "204"
}

@test "GET /tancredi/api/v1/models/acme19_2 does not change last_edit_time" {
    scope_path="$(tancredi_scope_path acme19_2)"
    test -f "$scope_path"
    run grep -E '^last_edit_time = [0-9]+$' "$scope_path"
    [[ "$status" -eq 0 ]]
    seeded="$(sed -r 's/^last_edit_time = [0-9]+$/last_edit_time = 1700000000/' "$scope_path")"
    printf '%s\n' "$seeded" > "$scope_path"
    run GET /tancredi/api/v1/models/acme19_2
    assert_http_code "200"
    assert_http_body '"last_edit_time":1700000000'
    run GET /tancredi/api/v1/models/acme19_2?inherit=1
    assert_http_code "200"
    assert_http_body '"last_edit_time":1700000000'
    run grep -F 'last_edit_time = 1700000000' "$scope_path"
    [[ "$status" -eq 0 ]]
}

@test "PATCH /tancredi/api/v1/models/acme19_2 updates last_edit_time" {
    started_at="$(date +%s)"
    run PATCH /tancredi/api/v1/models/acme19_2 <<EOF2
{
    "display_name": "Acme IP phone v19 rev. 2 (changed)"
}
EOF2
    assert_http_code "200"
    patched="$(sed -n -r '/^\s*$/,$ p' <<<"$output" | grep -o '"last_edit_time":[0-9]*' | cut -d: -f2)"
    [[ -n "$patched" && "$patched" -ge "$started_at" ]]
    run GET /tancredi/api/v1/models/acme19_2
    assert_http_body "\"last_edit_time\":${patched}"
}

@test "GET /tancredi/api/v1/models/yealink-T21 (never edited, last_edit_time null)" {
    rm -f "$(tancredi_scope_path yealink-T21)"
    run GET /tancredi/api/v1/models/yealink-T21
    assert_http_code "200"
    assert_http_body '"last_edit_time":null'
    run GET /tancredi/api/v1/models
    assert_http_code "200"
    assert_http_body_re '"name":"yealink-T21","display_name":"[^"]*","model_url":"[^"]*","last_edit_time":null'
}
