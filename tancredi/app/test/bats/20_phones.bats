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

@test "GET /tancredi/api/v1/phones (success)" {
    run GET /tancredi/api/v1/phones
    assert_http_code "200"
    assert_http_body_re "^\[\]$"
}

@test "POST /tancredi/api/v1/phones (01-23-45-67-89-AB, success)" {
    run POST /tancredi/api/v1/phones <<EOF
{
    "mac": "01-23-45-67-89-AB",
    "model": "acme19_2",
    "display_name": "Acme Model 19.2",
    "variables": {
        "sip_login": "212",
        "sip_password": "s3cr3t!",
        "owner": "Адриан Нестор"
    }
}
EOF
    assert_http_code "201"
    assert_http_header "Location" "/tancredi/api/v1/phones/01-23-45-67-89-AB"
}

@test "GET /tancredi/api/v1/phones/01-23-45-67-89-AB (success)" {
    run GET /tancredi/api/v1/phones/01-23-45-67-89-AB
    assert_http_code "200"
    assert_http_body "Адриан Нестор"
}

@test "GET /tancredi/api/v1/phones/01-23-45-67-89-AB?inherit=1 (success)" {
    run GET /tancredi/api/v1/phones/01-23-45-67-89-AB?inherit=1
    assert_http_code "200"
    assert_http_body '"var1":"value1-changed"'
}

@test "POST /tancredi/api/v1/phones (01-23-45-67-89-AB, failed/conflict)" {
    run POST /tancredi/api/v1/phones <<EOF
{
    "mac": "01-23-45-67-89-AB",
    "model": "acme19_2",
    "display_name": "Acme Model 19.2",
    "variables": {
        "sip_login": "215",
        "sip_password": "s3cr3t!",
        "owner": "Adriano Nestore"
    }
}
EOF
    assert_http_code "409"
    assert_http_header "Content-Type" "application/problem+json"
    assert_http_header "Content-Language" "en"
    assert_http_body "http"
    assert_http_body "already"
}

@test "PATCH /tancredi/api/v1/phones/01-23-45-67-89-AB (success)" {
    run PATCH /tancredi/api/v1/phones/01-23-45-67-89-AB <<EOF
{
    "variables": {
        "var1": "value1-changed",
        "var2": "value2"
    }
}
EOF
    assert_http_code "200"
    assert_http_body '"var1":"value1-changed"'
}

@test "PATCH /tancredi/api/v1/phones/ (failed/missing mac)" {
    run PATCH /tancredi/api/v1/phones/ <<EOF
{
    "variables": {
        "var1": "value1-changed"
    }
}
EOF
    assert_http_code "400"
    assert_http_header "Content-Type" "application/problem+json"
    assert_http_header "Content-Language" "en"
    assert_http_body "Missing MAC address"
}

@test "DELETE /tancredi/api/v1/phones/01-23-45-67-89-AB (success)" {
    run DELETE /tancredi/api/v1/phones/01-23-45-67-89-AB
    assert_http_code "204"
    assert_http_body_empty
}

@test "DELETE /tancredi/api/v1/phones/01-23-45-67-89-AB (failed/not found)" {
    run DELETE /tancredi/api/v1/phones/01-23-45-67-89-AB
    assert_http_code "404"
    assert_http_header "Content-Type" "application/problem+json"
    assert_http_header "Content-Language" "en"
    assert_http_body "http"
    assert_http_body "not found"
}
