#!/usr/bin/env bats

# Templates write each variable on a configuration line: the API refuses
# values (and names) with CR, LF or NUL for every variable

PHONE_MAC="0C-38-3E-AA-BB-D0"
MODEL_NAME="linebreak-test-model"

setup () {
    load tancredi_client
}

teardown_file () {
    load tancredi_client
    run DELETE "/tancredi/api/v1/phones/${PHONE_MAC}"
    run DELETE "/tancredi/api/v1/phones/0C-38-3E-AA-BB-D1"
    run DELETE "/tancredi/api/v1/models/${MODEL_NAME}"
}

@test "POST /tancredi/api/v1/phones (${PHONE_MAC}) for the line break checks" {
    run DELETE "/tancredi/api/v1/phones/${PHONE_MAC}"
    run POST /tancredi/api/v1/phones <<EOF
{
    "mac": "${PHONE_MAC}",
    "model": "fanvil-X5U",
    "display_name": "Line break test",
    "variables": {
        "linekey_label_1": "Reception"
    }
}
EOF
    assert_http_code "201"
}

@test "PATCH /tancredi/api/v1/phones refuses CR, LF and NUL in any variable with 422" {
    for variables in \
        '{"linekey_label_1": "Recept\n<MMI CONFIG MODULE>"}' \
        '{"linekey_value_1": "603\r\nAccount3 Name :x"}' \
        '{"linekey_value_1": "603\rx"}' \
        '{"adminpw": "pw\u0000"}' \
        '{"account_display_name_1": "Door\r\nSIP2 Enable Reg :1"}' \
        '{"ldap_base": "dc=example\n"}' \
        '{"custom_variable": ["ok", "a\nb"]}' \
        '{"custom_variable": {"a\nb": "ok"}}' \
        '{"linekey_label_1\nAccount2 Level": "10"}'
    do
        run PATCH "/tancredi/api/v1/phones/${PHONE_MAC}" <<<"{\"variables\": ${variables}}"
        assert_http_code "422"
        assert_http_body "Invalid value of variable"
    done
    run GET "/tancredi/api/v1/phones/${PHONE_MAC}"
    assert_http_code "200"
    assert_http_body '"linekey_label_1":"Reception"'
    ! assert_http_body 'MMI CONFIG'
}

@test "PATCH /tancredi/api/v1/phones accepts values without line breaks" {
    run PATCH "/tancredi/api/v1/phones/${PHONE_MAC}" <<'EOF'
{
    "variables": {
        "linekey_label_1": "Réception\t<1> \"A\" ;# Адриан",
        "linekey_value_1": 603,
        "linekey_type_1": "",
        "custom_variable": ["a", "b"],
        "account_display_name_1": null
    }
}
EOF
    assert_http_code "200"
    assert_http_body '"linekey_value_1":"603"'
    assert_http_body '"custom_variable":["a","b"]'
}

@test "POST /tancredi/api/v1/phones refuses a line break with 422" {
    run POST /tancredi/api/v1/phones <<'EOF'
{
    "mac": "0C-38-3E-AA-BB-D1",
    "model": "fanvil-X5U",
    "display_name": "Line break test",
    "variables": {
        "linekey_label_1": "Recept\nAccount2 Level :10"
    }
}
EOF
    assert_http_code "422"
    run GET /tancredi/api/v1/phones/0C-38-3E-AA-BB-D1
    assert_http_code "404"
}

@test "Models refuse a line break with 422" {
    run POST /tancredi/api/v1/models <<EOF
{"name": "${MODEL_NAME}", "display_name": "Line break test", "variables": {"adminpw": "pw\nx"}}
EOF
    assert_http_code "422"
    run GET "/tancredi/api/v1/models/${MODEL_NAME}"
    assert_http_code "404"

    run POST /tancredi/api/v1/models <<EOF
{"name": "${MODEL_NAME}", "display_name": "Line break test", "variables": {"adminpw": "pw"}}
EOF
    assert_http_code "201"
    run PATCH "/tancredi/api/v1/models/${MODEL_NAME}" <<<'{"variables": {"ntp_server": "linebreak-ntp.example.com\r\nx"}}'
    assert_http_code "422"
    run GET "/tancredi/api/v1/models/${MODEL_NAME}"
    ! assert_http_body "linebreak-ntp.example.com"
}

@test "Defaults refuse a line break with 422" {
    run PATCH /tancredi/api/v1/defaults <<<'{"ntp_server": "linebreak-ntp.example.com\nx"}'
    assert_http_code "422"
    run GET /tancredi/api/v1/defaults
    ! assert_http_body "linebreak-ntp.example.com"
}
