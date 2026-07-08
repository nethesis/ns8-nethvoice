#!/usr/bin/env bats

TEMPLATE_CUSTOM_DIR="${TANCREDI_TEMPLATE_CUSTOM_DIR:-/var/lib/tancredi/data/templates-custom/}"
TEMPLATE_CUSTOM_FILE="${TEMPLATE_CUSTOM_DIR%/}/nethesis-firmware-v2.tmpl"
PATTERN_CUSTOM_FILE="${TANCREDI_RW_DIR:-/var/lib/tancredi/data/}"
PATTERN_CUSTOM_FILE="${PATTERN_CUSTOM_FILE%/}/patterns.d/zz-yealink-override.ini"
PATTERN_OVERRIDE_FILE="${TANCREDI_RW_DIR:-/var/lib/tancredi/data/}"
PATTERN_OVERRIDE_FILE="${PATTERN_OVERRIDE_FILE%/}/patterns.d/yealink.ini"

setup () {
    load tancredi_client
}

teardown_file () {
    rm -f "$TEMPLATE_CUSTOM_FILE" "$PATTERN_CUSTOM_FILE" "$PATTERN_OVERRIDE_FILE"
}

@test "POST /tancredi/api/v1/phones (00-15-65-AA-BB-CC, Yealink T46, success)" {
    run POST /tancredi/api/v1/phones <<EOF
{
    "mac": "00-15-65-AA-BB-CC",
    "model": "yealink-T46",
    "display_name": "Yealink T46G Test Phone",
    "variables": {
        "account_extension_1": "1234",
        "account_encryption_1": "1",
        "account_display_name_1": "Test User",
        "account_username_1": "1234",
        "account_password_1": "testpass123",
        "account_dtmf_type_1": "rfc4733",
        "account_voicemail_1": "*97",
        "ldap_user": "cn=ldapuser,dc=phonebook,dc=nh",
        "ldap_password": "password",
        "linekey_type_3": "dnd",
        "linekey_type_4": "blf",
        "linekey_value_4": "202",
        "linekey_label_4": "Foo 2",
        "cap_ldap_tls_blacklist": "starttls",
        "sip_tls_port": "5061",
        "sip_udp_port": "5060",
        "ringtone": "1",
        "ntp_server": "pool.ntp.org",
        "call_waiting_tone": "1",
        "dss_transfer": "attended",
        "ui_first_config": "",
        "language": "it",
        "tonezone": "it",
        "provisioning_url_scheme": "https",
        "provisioning_freq": "everyday",
        "time_format": "24",
        "date_format": "DD MM YY",
        "adminpw": "admin,1234",
        "userpw": "user,1234",
        "cftimeouton": "*52",
        "cftimeoutoff": "*53",
        "cfbusyoff": "*91",
        "cfbusyon": "*90",
        "cfalwaysoff": "*73",
        "cfalwayson": "*72",
        "dndoff": "*79",
        "dndon": "*78",
        "dndtoggle": "*76",
        "call_waiting_off": "*71",
        "call_waiting_on": "*70",
        "pickup_direct": "**",
        "pickup_group": "*8",
        "cftimeout": "0",
        "queuetoggle": "*45",
        "vlan_id_phone": "",
        "vlan_id_pcport": "",
        "cap_ringtone_count": "1",
        "cap_ringtone_blacklist": "-1,0",
        "background_file": "",
        "screensaver_file": "",
        "screensaver_time": "600",
        "cap_background_file": "",
        "cap_screensaver_file": "",
        "backlight_time": "30",
        "cap_brightness": "",
        "cap_contrast": "",
        "brightness": "5",
        "contrast": "5",
        "cap_backlight_time_blacklist": "",
        "cap_screensaver_time_blacklist": "",
        "timezone": "Europe/Rome",
        "hostname": "voice.example.com",
        "outbound_proxy_1": "proxy.examplesis.it",
        "ldap_server": "ldap.example.com",
        "ldap_port": "20123",
        "ldap_tls": "ldaps",
        "ldap_base": "dc=phonebook,dc=nh",
        "ldap_name_display": "%cn %o",
        "ldap_number_attr": "telephoneNumber mobile homePhone",
        "ldap_mainphone_number_attr": "telephoneNumber",
        "ldap_mobilephone_number_attr": "mobile",
        "ldap_otherphone_number_attr": "homePhone",
        "ldap_name_attr": "cn o",
        "ldap_number_filter": "(|(telephoneNumber=%)(mobile=%)(homePhone=%))",
        "ldap_name_filter": "(|(cn=%)(o=%))"
    }
}
EOF
    assert_http_code "201"
    assert_http_header "Location" "/tancredi/api/v1/phones/00-15-65-AA-BB-CC"
}

@test "GET /tancredi/api/v1/phones/00-15-65-AA-BB-CC (success)" {
    run GET /tancredi/api/v1/phones/00-15-65-AA-BB-CC
    assert_http_code "200"
    assert_http_body "Test User"
    assert_http_body "yealink-T46"
}

@test "GET /provisioning/{tok1}/001565aabbcc.cfg (template rendering)" {
    # First, get the phone data to extract tok1
    run GET /tancredi/api/v1/phones/00-15-65-AA-BB-CC
    assert_http_code "200"
    
    # Extract tok1 token
    tok1=$(extract_field "tok1")
    tok2=$(extract_field "tok2")
    
    if [[ -z "$tok1" ]]; then
        echo "Failed to extract tok1 token" 1>&2
        return 1
    fi
    
    # Call provisioning API with Yealink user agent
    run GET_PROVISIONING "Yealink SIP-T46G 41.0.0.0 00:15:65:aa:bb:cc" "/provisioning/${tok1}/001565aabbcc.cfg"
    
    output="$(sed -n -r '/^\s*$/,$ p' <<<"$output" | tail -n +2)"
    # Substitute $tok2 value in output with $tok2
    output=$(sed "s/${tok2}/tok2/g" <<<"$output")

    # Compare against fixture
    fixture_file="${BATS_TEST_DIRNAME}/../fixtures/yealink-t46-expected.cfg"
    assert_template_matches_fixture "$fixture_file"
}

@test "GET /provisioning/{tok1}/001565aabbcc.cfg prefers rw patterns.d over ro patterns.d" {
    mkdir -p "$(dirname "$PATTERN_CUSTOM_FILE")"
    cat > "$PATTERN_CUSTOM_FILE" <<'EOF'
[yealink-rw-override]
pattern = "001565aabbcc\.cfg"
scopeid = "ignored"
template = "tmpl_phone"
content_type = "application/x-rw-pattern"
EOF

    run GET /tancredi/api/v1/phones/00-15-65-AA-BB-CC
    assert_http_code "200"

    tok1=$(extract_field "tok1")

    if [[ -z "$tok1" ]]; then
        echo "Failed to extract tok1 token" 1>&2
        return 1
    fi

    run GET_PROVISIONING "Yealink SIP-T46G 41.0.0.0 00:15:65:aa:bb:cc" "/provisioning/${tok1}/001565aabbcc.cfg"
    assert_http_code "200"
    assert_http_header "Content-Type" "application/x-rw-pattern"
}

@test "GET /provisioning/{tok1}/001565aabbcc.cfg allows rw patterns.d to replace a shipped file" {
    mkdir -p "$(dirname "$PATTERN_OVERRIDE_FILE")"
    cat > "$PATTERN_OVERRIDE_FILE" <<'EOF'
[yealink-rw-file-override]
pattern = "001565aabbcc\.cfg"
scopeid = "ignored"
template = "tmpl_phone"
content_type = "application/x-rw-pattern-override"
EOF

    run GET /tancredi/api/v1/phones/00-15-65-AA-BB-CC
    assert_http_code "200"

    tok1=$(extract_field "tok1")

    if [[ -z "$tok1" ]]; then
        echo "Failed to extract tok1 token" 1>&2
        return 1
    fi

    run GET_PROVISIONING "Yealink SIP-T46G 41.0.0.0 00:15:65:aa:bb:cc" "/provisioning/${tok1}/001565aabbcc.cfg"
    assert_http_code "200"
    assert_http_header "Content-Type" "application/x-rw-pattern-override"
}

@test "DELETE /tancredi/api/v1/phones/00-15-65-AA-BB-CC (cleanup)" {
    run DELETE /tancredi/api/v1/phones/00-15-65-AA-BB-CC
    assert_http_code "204"
    assert_http_body_empty
}

@test "POST /tancredi/api/v1/phones (00-04-13-AA-BB-CC, Snom D120, success)" {
    run POST /tancredi/api/v1/phones <<EOF
{
    "mac": "00-04-13-AA-BB-CC",
    "model": "snom-D120",
    "display_name": "Snom D120 Test Phone",
    "variables": {
        "account_extension_1": "1234",
        "account_encryption_1": "1",
        "account_display_name_1": "Test User",
        "account_username_1": "1234",
        "account_password_1": "testpass123",
        "account_dtmf_type_1": "rfc4733",
        "account_voicemail_1": "*97",
        "ldap_user": "cn=ldapuser,dc=phonebook,dc=nh",
        "ldap_password": "password",
        "sip_tls_port": "5061",
        "sip_udp_port": "5060",
        "ringtone": "1",
        "ntp_server": "pool.ntp.org",
        "call_waiting_tone": "1",
        "dss_transfer": "attended",
        "language": "it",
        "tonezone": "it",
        "provisioning_url_scheme": "https",
        "provisioning_freq": "everyday",
        "time_format": "24",
        "date_format": "DD MM YY",
        "adminpw": "admin,1234",
        "cftimeouton": "*52",
        "cftimeoutoff": "*53",
        "cfbusyoff": "*91",
        "cfbusyon": "*90",
        "cfalwaysoff": "*73",
        "cfalwayson": "*72",
        "dndoff": "*79",
        "dndon": "*78",
        "dndtoggle": "*76",
        "call_waiting_off": "*71",
        "call_waiting_on": "*70",
        "pickup_direct": "**",
        "pickup_group": "*8",
        "queuetoggle": "*45",
        "vlan_id_phone": "",
        "vlan_id_pcport": "",
        "background_file": "",
        "screensaver_file": "",
        "screensaver_time": "600",
        "backlight_time": "30",
        "brightness": "5",
        "contrast": "5",
        "timezone": "Europe/Rome",
        "hostname": "voice.example.com",
        "outbound_proxy_1": "proxy.examplesis.it",
        "ldap_server": "ldap.example.com",
        "ldap_port": "20123",
        "ldap_tls": "ldaps",
        "ldap_base": "dc=phonebook,dc=nh",
        "ldap_name_display": "%cn %o",
        "ldap_mainphone_number_attr": "telephoneNumber",
        "ldap_mobilephone_number_attr": "mobile",
        "ldap_otherphone_number_attr": "homePhone",
        "ldap_name_attr": "cn o",
        "ldap_number_filter": "(|(telephoneNumber=%)(mobile=%)(homePhone=%))",
        "ldap_name_filter": "(|(cn=%)(o=%))"
    }
}
EOF
    assert_http_code "201"
    assert_http_header "Location" "/tancredi/api/v1/phones/00-04-13-AA-BB-CC"
}

@test "GET /tancredi/api/v1/phones/00-04-13-AA-BB-CC (success)" {
    run GET /tancredi/api/v1/phones/00-04-13-AA-BB-CC
    assert_http_code "200"
    assert_http_body "Test User"
    assert_http_body "snom-D120"
}

@test "GET /provisioning/{tok1}/000413aabbcc.xml (SNOM template rendering)" {
    run GET /tancredi/api/v1/phones/00-04-13-AA-BB-CC
    assert_http_code "200"

    tok1=$(extract_field "tok1")
    tok2=$(extract_field "tok2")

    if [[ -z "$tok1" ]]; then
        echo "Failed to extract tok1 token" 1>&2
        return 1
    fi

    run GET_PROVISIONING "snom-D120 10.1.54.15 00:04:13:aa:bb:cc" "/provisioning/${tok1}/000413aabbcc.xml"

    output="$(sed -n -r '/^\s*$/,$ p' <<<"$output" | tail -n +2)"
    output=$(sed "s/${tok2}/tok2/g" <<<"$output")

    fixture_file="${BATS_TEST_DIRNAME}/../fixtures/snom-d120-expected.xml"
    assert_template_matches_fixture "$fixture_file"
}

@test "DELETE /tancredi/api/v1/phones/00-04-13-AA-BB-CC (cleanup)" {
    run DELETE /tancredi/api/v1/phones/00-04-13-AA-BB-CC
    assert_http_code "204"
    assert_http_body_empty
}

@test "GET /provisioning/{tok2}/nethesis_np_x5_hwv2_0.txt (NPX5 v2 firmware template rendering)" {
    local custom_template="${TANCREDI_TEMPLATE_CUSTOM_DIR:-/var/lib/tancredi/data/templates-custom/}nethesis-firmware-v2.tmpl"

    mkdir -p "$(dirname "$custom_template")"
    cat > "$custom_template" <<'EOF'
NPX5v2 firmware template selected
EOF

    run POST /tancredi/api/v1/phones <<EOF
{
    "mac": "E0-E6-56-AA-BB-EE",
    "model": "nethesis-NPX5",
    "display_name": "Nethesis NPX5 v2 Test Phone",
    "variables": {
        "hostname": "voice.example.com",
        "provisioning_url_scheme": "https"
    }
}
EOF
    assert_http_code "201"

    run GET /tancredi/api/v1/phones/E0-E6-56-AA-BB-EE
    assert_http_code "200"

    tok2=$(extract_field "tok2")

    if [[ -z "$tok2" ]]; then
        echo "Failed to extract tok2 token" 1>&2
        return 1
    fi

    run GET_PROVISIONING "Nethesis NPX5 v2 2.0.0.0 E0:E6:56:AA:BB:EE" "/provisioning/${tok2}/nethesis_np_x5_hwv2_0.txt"
    assert_http_code "200"
    assert_http_header "Content-Type" "text/plain; charset=utf-8"
    assert_http_body "NPX5v2 firmware template selected"

    run DELETE /tancredi/api/v1/phones/E0-E6-56-AA-BB-EE
    assert_http_code "204"
    assert_http_body_empty
}

