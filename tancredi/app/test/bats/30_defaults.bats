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

@test "DELETE /tancredi/api/v1/defaults (failed/unallowed)" {
    run DELETE /tancredi/api/v1/defaults
    assert_http_code "405"
}

@test "GET /tancredi/api/v1/defaults (success)" {
    run GET /tancredi/api/v1/defaults
    assert_http_code "200"
    assert_http_body_re "^\{"
}

@test "PATCH /tancredi/api/v1/defaults (success/set)" {
    run PATCH /tancredi/api/v1/defaults <<EOF
{
    "var1": "value1",
    "var2": "value2"
}
EOF
    assert_http_code "204"

    run GET /tancredi/api/v1/defaults
    assert_http_code "200"
    assert_http_body "value1"
    assert_http_body "value2"
}

@test "PATCH /tancredi/api/v1/defaults (success/unset)" {
    run PATCH /tancredi/api/v1/defaults <<EOF
{
    "var1": "valore1",
    "var2": null
}
EOF
    assert_http_code "204"

    run GET /tancredi/api/v1/defaults
    assert_http_code "200"
    assert_http_body "valore1"
    ! assert_http_body "value2"
}
