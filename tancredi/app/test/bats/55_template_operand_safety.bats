#!/usr/bin/env bats

setup () {
    load tancredi_client
    TEST_PHONE_MAC=""
}

teardown () {
    if [[ -n "$TEST_PHONE_MAC" ]]; then
        run DELETE "/tancredi/api/v1/phones/${TEST_PHONE_MAC}"
        if ! grep -q -E '^HTTP/1.1 (204|404)' <<<"$output"; then
            echo "$output" 1>&2
            return 1
        fi
    fi
}

common_variables='        "account_extension_1": "1234",
        "account_encryption_1": "1",
        "account_display_name_1": "Test User",
        "account_username_1": "1234",
        "account_password_1": "testpass123",
        "account_dtmf_type_1": "rfc4733",
        "account_voicemail_1": "*97",
        "sip_tls_port": "5061",
        "sip_udp_port": "5060",
        "ringtone": "1",
        "ntp_server": "pool.ntp.org",
        "call_waiting_tone": "1",
        "dss_transfer": "attended",
        "language": "en",
        "tonezone": "us",
        "provisioning_url_scheme": "https",
        "provisioning_freq": "everyday",
        "time_format": "24",
        "date_format": "DD MM YY",
        "adminpw": "admin123",
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
        "contrast": "5",
        "timezone": "Europe/Rome",
        "hostname": "voice.example.com",
        "outbound_proxy_1": "proxy.example.com",
        "ldap_user": "cn=ldapuser,dc=phonebook,dc=nh",
        "ldap_password": "password",
        "ldap_server": "ldap.example.com",
        "ldap_port": "389",
        "ldap_tls": "none",
        "ldap_base": "dc=phonebook,dc=nh",
        "ldap_name_display": "%cn %o",
        "ldap_mainphone_number_attr": "telephoneNumber",
        "ldap_mobilephone_number_attr": "mobile",
        "ldap_otherphone_number_attr": "homePhone",
        "ldap_name_attr": "cn o",
        "ldap_number_filter": "(|(telephoneNumber=%)(mobile=%)(homePhone=%))",
        "ldap_name_filter": "(|(cn=%)(o=%))"'

create_phone () {
    local mac="$1"
    local model="$2"
    local extra_variables="$3"
    local payload

    run DELETE "/tancredi/api/v1/phones/${mac}"
    if ! grep -q -E '^HTTP/1.1 (204|404)' <<<"$output"; then
        echo "$output" 1>&2
        return 1
    fi

    payload=$(cat <<EOF
{
    "mac": "${mac}",
    "model": "${model}",
    "display_name": "${model} operand test",
    "variables": {
${common_variables}${extra_variables:+,
${extra_variables}}
    }
}
EOF
)
    run curl -s -i \
        -H 'Accept: application/json, application/problem+json' \
        -H 'Content-Type: application/json; charset=UTF-8' \
        -X POST \
        -d "$payload" \
        "${tancredi_base_url}/tancredi/api/v1/phones"
    assert_http_code "201"
    TEST_PHONE_MAC="$mac"
}

assert_provisioning_render_ok () {
    local mac="$1"
    local user_agent="$2"
    local filename="$3"
    local content_type="$4"

    run GET "/tancredi/api/v1/phones/${mac}"
    assert_http_code "200"

    local tok1
    tok1=$(extract_field "tok1")
    if [[ -z "$tok1" ]]; then
        echo "Failed to extract tok1 token for ${mac}" 1>&2
        return 1
    fi

    run GET_PROVISIONING "$user_agent" "/provisioning/${tok1}/${filename}"
    assert_http_code "200"
    assert_http_header "Content-Type" "$content_type"
    assert_http_body_re "[[:graph:]]"
}

assert_linekey_render_ok () {
    local mac="$1"
    local user_agent="$2"
    local filename="$3"
    local linekey_index="$4"
    local linekey_label="$5"
    local linekey_value="$6"

    run GET "/tancredi/api/v1/phones/${mac}"
    assert_http_code "200"

    local tok1
    tok1=$(extract_field "tok1")
    if [[ -z "$tok1" ]]; then
        echo "Failed to extract tok1 token for ${mac}" 1>&2
        return 1
    fi

    run GET_PROVISIONING "$user_agent" "/provisioning/${tok1}/${filename}"
    assert_http_code "200"
    assert_http_body "<fkey idx=\"${linekey_index}\" context=\"1\" label=\"${linekey_label}\" lp=\"on\" perm=\"\">blf ${linekey_value}|**</fkey>"
}

delete_phone_under_test () {
    local mac="$1"
    run DELETE "/tancredi/api/v1/phones/${mac}"
    assert_http_code "204"
    assert_http_body_empty
    TEST_PHONE_MAC=""
}

@test "Representative operand-bearing template families render successfully" {
    local cases=(
        "00-15-65-AA-BB-D0|yealink-T46|Yealink SIP-T46G 41.0.0.0 00:15:65:aa:bb:d0|001565aabbd0.cfg|text/plain; charset=utf-8"
        "00-04-13-AA-BB-D1|snom-D120|snom-D120 10.1.54.15 00:04:13:aa:bb:d1|000413aabbd1.xml|text/xml; charset=utf-8"
        "00-04-13-AA-BB-D2|snom-D812|snom-D812 10.1.54.15 00:04:13:aa:bb:d2|000413aabbd2.xml|text/xml; charset=utf-8"
        "00-A8-59-AA-BB-D3|fanvil-X303|Fanvil X303 2.4.1.0 00:A8:59:AA:BB:D3|00a859aabbd3.cfg|text/plain; charset=utf-8"
        "00-A8-59-AA-BB-D4|fanvil-V67|Fanvil V67 2.4.1.0 00:A8:59:AA:BB:D4|00a859aabbd4.cfg|text/plain; charset=utf-8"
        "00-A8-59-AA-BB-D5|fanvil-X3|Fanvil X3S 2.4.1.0 00:A8:59:AA:BB:D5|00a859aabbd5.cfg|text/plain; charset=utf-8"
        "E0-E6-56-AA-BB-D6|nethesis-NPV61|Nethesis NPV61 2.4.1.0 E0:E6:56:AA:BB:D6|e0e656aabbd6.cfg|text/plain; charset=utf-8"
        "00-50-58-AA-BB-D7|sangoma-S300|Sangoma S300 2.0.0.0 00:50:58:AA:BB:D7|cfg005058aabbd7.xml|text/xml; charset=utf-8"
        "7C-2F-80-AA-BB-D8|gigaset-Maxwell3|Gigaset Maxwell 3 2.41.0 7C:2F:80:AA:BB:D8|7c2f80aabbd8.xml|text/xml; charset=utf-8"
        "0C-11-05-AA-BB-D9|akuvox-SPR50P|Akuvox SPR50P 1.0.0 0C:11:05:AA:BB:D9|0c1105aabbd9.cfg|text/plain; charset=utf-8"
        "0C-11-05-AA-BB-DA|akuvox-WP410|Akuvox WP410 1.0.0 0C:11:05:AA:BB:DA|0c1105aabbda.cfg|text/plain; charset=utf-8"
        "9C-75-14-AA-BB-DB|akuvox-WP480|Akuvox WP480 1.0.0 9C:75:14:AA:BB:DB|9c7514aabbdb.cfg|text/plain; charset=utf-8"
    )

    local case mac model user_agent filename content_type
    for case in "${cases[@]}"; do
        IFS='|' read -r mac model user_agent filename content_type <<<"$case"
        create_phone "$mac" "$model" '        "brightness": "5"'
        assert_provisioning_render_ok "$mac" "$user_agent" "$filename" "$content_type"
        delete_phone_under_test "$mac"
    done
}

@test "snom.tmpl tolerates empty expansion-key operands" {
    create_phone "00-04-13-AA-BB-DC" "snom-D120" '        "brightness": "",
        "cap_expkey_count": "",
        "cap_expmodule_count": ""'

    assert_provisioning_render_ok \
        "00-04-13-AA-BB-DC" \
        "snom-D120 10.1.54.15 00:04:13:aa:bb:dc" \
        "000413aabbdc.xml" \
        "text/xml; charset=utf-8"
}

@test "snomD8XX.tmpl tolerates empty expansion-module operands" {
    create_phone "00-04-13-AA-BB-DD" "snom-D812" '        "brightness": "",
        "cap_expmodule_count": ""'

    assert_provisioning_render_ok \
        "00-04-13-AA-BB-DD" \
        "snom-D812 10.1.54.15 00:04:13:aa:bb:dd" \
        "000413aabbdd.xml" \
        "text/xml; charset=utf-8"
}

@test "snom.tmpl renders configured BLF line keys" {
    create_phone "00-04-13-AA-BB-DE" "snom-D120" '        "brightness": "5",
        "cap_linekey_count": "3",
        "linekey_type_3": "blf",
        "linekey_value_3": "203",
        "linekey_label_3": "Alice"'

    assert_linekey_render_ok \
        "00-04-13-AA-BB-DE" \
        "snom-D120 10.1.54.15 00:04:13:aa:bb:de" \
        "000413aabbde.xml" \
        "2" \
        "Alice" \
        "203"
}

@test "snomD8XX.tmpl renders configured BLF line keys" {
    create_phone "00-04-13-AA-BB-DF" "snom-D812" '        "brightness": "5",
        "cap_linekey_count": "3",
        "linekey_type_3": "blf",
        "linekey_value_3": "203",
        "linekey_label_3": "Alice"'

    assert_linekey_render_ok \
        "00-04-13-AA-BB-DF" \
        "snom-D812 10.1.54.15 00:04:13:aa:bb:df" \
        "000413aabbdf.xml" \
        "2" \
        "Alice" \
        "203"
}