#!/usr/bin/env bats

#
# Copyright (C) 2024 Nethesis S.r.l.
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

@test "Reset storage dir before upgrade" {
    tancredi_reset_rw_dir
}

@test "Seed outdated nethesis-NPX5v2 scope before upgrade" {
    local scope_path
    scope_path="$(tancredi_scope_path nethesis-NPX5v2)"

    mkdir -p "$(dirname "$scope_path")"
    cat > "$scope_path" <<'EOF'
[metadata]
scopeType = "model"
displayName = "Nethesis NP-X5 v2"
version = 1

[data]
cap_ldap_tls_blacklist =
provisioning_url_filename = "$mac.cfg"
tmpl_phone = "nethesis.tmpl"
tmpl_firmware = "nethesis-firmware.tmpl"
nethesis_sidekey_count = 4
nethesis_sidepages_count = 1
cap_linekey_count = 34
cap_linekey_type_blacklist =
cap_softkey_count = 4
cap_softkey_type_blacklist =
cap_expkey_count =
cap_expkey_type_blacklist =
cap_ringtone_count = 9
cap_ringtone_blacklist = -1
cap_dss_transfer_blacklist =
softkey_type_1 = "history"
softkey_type_2 = "ldap"
softkey_type_3 = "group_pickup"
softkey_type_4 = "menu"
linekey_type_1 = "line"
linekey_type_2 = "line"
cap_background_file = 1
cap_screensaver_file =
screensaver_time = 600
backlight_time = 30
cap_contrast = 1
contrast = 4
cap_brightness = 1
brightness = 5
cap_screensaver_time_blacklist =
cap_backlight_time_blacklist =
date_format = "WWW DD MMM"
EOF

    # Verify that the scope file was correctly seeded
    [[ -f "$scope_path" ]]
    grep -q '^version = 1$' "$scope_path"
    grep -q '^tmpl_firmware = "nethesis-firmware.tmpl"$' "$scope_path"
}

@test "Seed phone inheriting nethesis-NPX5v2 before upgrade" {
    local scope_path
    scope_path="$(tancredi_scope_path E0-E6-56-AA-BB-EF)"

    mkdir -p "$(dirname "$scope_path")"
    cat > "$scope_path" <<'EOF'
[metadata]
scopeType = "phone"
displayName = "Nethesis Upgrade Test Phone"
inheritFrom = "nethesis-NPX5v2"

[data]
EOF

    [[ -f "$scope_path" ]]
    grep -q '^inheritFrom = "nethesis-NPX5v2"$' "$scope_path"
}

@test "Run upgrade script" {
    run php "$(tancredi_upgrade_script)"
    [[ $status -eq 0 ]]
}

@test "Upgrade sets defaults version" {
    run GET /tancredi/api/v1/defaults
    assert_http_code "200"
    assert_http_body '"vlan_id_phone"'
    assert_http_body '"vlan_id_pcport"'
}

@test "Upgrade sets snom-D785 ldap filters (012)" {
    run GET /tancredi/api/v1/models/snom-D785
    assert_http_code "200"
    assert_http_body '"ldap_number_filter"'
    assert_http_body '"ldap_name_filter"'
}

@test "Upgrade sets fanvil-X3U cap_linekey_count (005)" {
    run GET /tancredi/api/v1/models/fanvil-X3U
    assert_http_code "200"
    assert_http_body '"cap_linekey_count":"3"'
}

@test "Upgrade sets sangoma-S305 cap_linekey_count (007)" {
    run GET /tancredi/api/v1/models/sangoma-S305
    assert_http_code "200"
    assert_http_body '"cap_linekey_count":"15"'
}

@test "Upgrade sets gigaset-Maxwell3 screensaver blacklist (008)" {
    run GET /tancredi/api/v1/models/gigaset-Maxwell3
    assert_http_code "200"
    assert_http_body '"cap_screensaver_time_blacklist":"3,5,7,10,15,30,60,120,300"'
}

@test "Upgrade keeps yealink-T43 expansion settings" {
    run GET /tancredi/api/v1/models/yealink-T43
    assert_http_code "200"
    assert_http_body '"cap_expmodule_count":"3"'
    assert_http_body '"cap_expkey_count":"60"'
}

@test "Upgrade sets snom expansion key modules (006)" {
    run GET /tancredi/api/v1/models/snom-D735
    assert_http_code "200"
    assert_http_body '"cap_expkey_count":"18"'
    assert_http_body '"cap_expmodule_count":"3"'
}

@test "Upgrade sets fanvil sidekey pages (009)" {
    run GET /tancredi/api/v1/models/fanvil-X4U
    assert_http_code "200"
    assert_http_body '"fanvil_sidepages_count":"1"'
}

@test "Upgrade sets fanvil-X3U fanvil_lkpages_count (011)" {
    run GET /tancredi/api/v1/models/fanvil-X3U
    assert_http_code "200"
    assert_http_body '"fanvil_lkpages_count":"0"'
}

@test "Upgrade migrates nethesis-NPX5v2 into nethesis-NPX5 (014)" {
    run grep -F 'version = 14' "$(tancredi_scope_path nethesis-NPX5)"
    [[ $status -eq 0 ]]

    run grep -F 'tmpl_firmware = "nethesis-firmware.tmpl"' "$(tancredi_scope_path nethesis-NPX5)"
    [[ $status -eq 0 ]]

    run grep -F 'tmpl_firmware_v2 = "nethesis-firmware-v2.tmpl"' "$(tancredi_scope_path nethesis-NPX5)"
    [[ $status -eq 0 ]]

    run test ! -e "$(tancredi_scope_path nethesis-NPX5v2)"
    [[ $status -eq 0 ]]

    run GET /tancredi/api/v1/models/nethesis-NPX5
    assert_http_code "200"
    assert_http_body '"tmpl_firmware":"nethesis-firmware.tmpl"'
    assert_http_body '"tmpl_firmware_v2":"nethesis-firmware-v2.tmpl"'
}

@test "Upgrade rewrites phone inheritFrom to nethesis-NPX5 (014)" {
    run grep -F 'inheritFrom = "nethesis-NPX5"' "$(tancredi_scope_path E0-E6-56-AA-BB-EF)"
    [[ $status -eq 0 ]]

    run GET /tancredi/api/v1/models/nethesis-NPX5v2
    assert_http_code "404"
}

@test "Upgrade is idempotent (second run succeeds)" {
    run php "$(tancredi_upgrade_script)"
    [[ $status -eq 0 ]]
}

@test "Models unchanged after idempotent upgrade" {
    run GET /tancredi/api/v1/models/snom-D785
    assert_http_code "200"
    assert_http_body '"ldap_number_filter"'

    run GET /tancredi/api/v1/models/fanvil-X3U
    assert_http_code "200"
    assert_http_body '"cap_linekey_count":"3"'

    run GET /tancredi/api/v1/models/yealink-T43
    assert_http_code "200"
    assert_http_body '"cap_expmodule_count":"3"'
    assert_http_body '"cap_expkey_count":"60"'

    run GET /tancredi/api/v1/models/nethesis-NPX5
    assert_http_code "200"
    assert_http_body '"tmpl_firmware_v2":"nethesis-firmware-v2.tmpl"'
}

@test "Reset storage dir after upgrade tests" {
    tancredi_reset_rw_dir
}
