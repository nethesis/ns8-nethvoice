#!/usr/bin/env bats

DOOR_PHONE_MAC="0C-38-3E-AA-BB-E0"
DOOR_PHONE_UA="Fanvil i62 2.12.51 0c383eaabbe0"
DESK_PHONE_MAC="0C-38-3E-AA-BB-E2"

setup () {
    load tancredi_client
}

teardown_file () {
    load tancredi_client
    run DELETE "/tancredi/api/v1/phones/${DOOR_PHONE_MAC}"
    run DELETE "/tancredi/api/v1/phones/${DESK_PHONE_MAC}"
}

@test "GET /tancredi/api/v1/models lists the Fanvil i6x door phones" {
    run GET /tancredi/api/v1/models
    assert_http_code "200"
    for model in fanvil-i60 fanvil-i61 fanvil-i62 fanvil-i63 fanvil-i64; do
        assert_http_body "\"name\":\"${model}\""
    done
}

@test "GET /tancredi/api/v1/models/fanvil-i62 has the door phone capability" {
    run GET /tancredi/api/v1/models/fanvil-i62
    assert_http_code "200"
    assert_http_body '"cap_door_phone":"1"'
    assert_http_body '"cap_settings_sections_blacklist":"displayAndRingtones,network,phonebook"'
    assert_http_body '"tmpl_phone":"fanvil-i6x.tmpl"'
    assert_http_body '"door_rtsp_path_main":"/h264/stream.live0"'
    assert_http_body '"door_rtsp_path_sub":"/h264/stream.live1"'
    assert_http_body '"cap_linekey_count":"1"'
    assert_http_body '"linekey_type_1":"speed_dial"'
    assert_http_body '"door_open_url_path_1":"/cgi-bin/ConfigManApp.com?egs&output1=OUT1_SOS"'
    assert_http_body '"door_open_url_path_2":"/cgi-bin/ConfigManApp.com?egs&output2=OUT2_SOS"'
    assert_http_body '"door_open_url_user":"admin"'
    assert_http_body '"cap_linekey_type_blacklist":"conference,forward,transfer,hold,dnd,recall,direct_pickup,dtmf,queuetoggle,voice_mail,line,blf,url,group_pickup,multicast_paging,record,prefix,phone_lock,ldap"'
}

@test "GET /tancredi/api/v1/models/fanvil-i63 has five call buttons" {
    run GET /tancredi/api/v1/models/fanvil-i63
    assert_http_code "200"
    assert_http_body '"cap_linekey_count":"5"'
}

@test "POST /tancredi/api/v1/phones (${DOOR_PHONE_MAC}, Fanvil i62)" {
    run DELETE "/tancredi/api/v1/phones/${DOOR_PHONE_MAC}"
    run POST /tancredi/api/v1/phones <<EOF
{
    "mac": "${DOOR_PHONE_MAC}",
    "model": "fanvil-i62",
    "display_name": "Fanvil i62 door phone test",
    "variables": {
        "account_extension_1": "203",
        "account_display_name_1": "Door <203>",
        "account_username_1": "203",
        "account_password_1": "doorsip123",
        "account_dtmf_type_1": "rfc4733",
        "account_encryption_1": "1",
        "hostname": "voice.example.com",
        "outbound_proxy_1": "proxy.example.com",
        "timezone": "Europe/Rome",
        "language": "it",
        "adminpw": "doorweb123",
        "door_rtsp_user": "nethvoice",
        "door_rtsp_password": "doorrtsp123",
        "door_dtmf_code": "4711"
    }
}
EOF
    assert_http_code "201"
}

@test "GET /provisioning/{tok1}/0c383eaabbe0.cfg renders the door phone configuration" {
    run GET "/tancredi/api/v1/phones/${DOOR_PHONE_MAC}"
    assert_http_code "200"
    tok1=$(extract_field "tok1")
    [[ -n "$tok1" ]]

    run GET_PROVISIONING "$DOOR_PHONE_UA" "/provisioning/${tok1}/0c383eaabbe0.cfg"
    assert_http_code "200"
    assert_http_header "Content-Type" "text/plain; charset=utf-8"
    assert_http_body "<<VOIP CONFIG FILE>>Version:2.0000000000"
    assert_http_body "SIP1 Register User      :203"
    assert_http_body "SIP1 Register Pswd      :doorsip123"
    assert_http_body "SIP1 DTMF Mode          :1"
    assert_http_body "SIP1 Transport          :3"
    assert_http_body "<MMI CONFIG MODULE>"
    assert_http_body "Account1 Name               :admin"
    assert_http_body "Account1 Password           :doorweb123"
    ! assert_http_body "RTSP Server Passwd :doorweb123"
    assert_http_body "video2 BitRate          :512000"
    assert_http_body "video2 Resolution       :4"
    assert_http_body "video1 I Frame Interval :25"
    assert_http_body "<RTSP SERVER CONFIG MODULE>"
    ! assert_http_body "<NET CONFIG MODULE>"
    ! assert_http_body "Web Port"
    ! assert_http_body "<EGS CONFIG MODULE>"
    ! assert_http_body "<DSSKEY CONFIG MODULE>"
    assert_http_body "<SECURITY CONFIG MODULE>"
    assert_http_body "Output1 Trigger By DTMF    :1"
    assert_http_body "Output1 DTMF Trigger Code  :4711"
    assert_http_body "Output2 Trigger By DTMF    :1"
    assert_http_body "Output2 DTMF Trigger Code  :#"
    ! assert_http_body "Trigger Duration"
    ! assert_http_body "Output3"
    ! assert_http_body "Default Language"
    assert_http_body "Enable RTSP        :1"
    assert_http_body "Enable RTSP Auth   :1"
    assert_http_body "RTSP Server User   :nethvoice"
    assert_http_body "RTSP Server Passwd :doorrtsp123"
    assert_http_body "<<END OF FILE>>"
    ! assert_http_body "{{"
    ! assert_http_body "{%"
}

@test "GET /provisioning/0c383eaabbe0.cfg (tokenless) strips the door phone secrets" {
    run GET_PROVISIONING "$DOOR_PHONE_UA" "/provisioning/0c383eaabbe0.cfg"
    assert_http_code "200"
    ! assert_http_body "doorsip123"
    ! assert_http_body "doorweb123"
    ! assert_http_body "doorrtsp123"
    ! assert_http_body "4711"
    ! assert_http_body "RTSP Server Passwd"
    ! assert_http_body "<SECURITY CONFIG MODULE>"
    ! assert_http_body "DTMF Trigger Code"
    ! assert_http_body "<MMI CONFIG MODULE>"
    ! assert_http_body "Account1 Password"
}

@test "Door phone without RTSP password leaves the device RTSP credentials untouched" {
    run PATCH "/tancredi/api/v1/phones/${DOOR_PHONE_MAC}" <<EOF
{
    "variables": {
        "door_rtsp_password": ""
    }
}
EOF
    assert_http_code "200"

    run GET "/tancredi/api/v1/phones/${DOOR_PHONE_MAC}"
    tok1=$(extract_field "tok1")
    run GET_PROVISIONING "$DOOR_PHONE_UA" "/provisioning/${tok1}/0c383eaabbe0.cfg"
    assert_http_code "200"
    assert_http_body "Enable RTSP        :1"
    ! assert_http_body "RTSP Server User"
    ! assert_http_body "RTSP Server Passwd"
    assert_http_body "Account1 Password           :doorweb123"
}

@test "Door phone call button is always written as a SoftDss speed dial key" {
    run PATCH "/tancredi/api/v1/phones/${DOOR_PHONE_MAC}" <<EOF
{
    "variables": {
        "linekey_type_1": "blf",
        "linekey_value_1": "603",
        "linekey_label_1": "Reception"
    }
}
EOF
    assert_http_code "200"

    run GET "/tancredi/api/v1/phones/${DOOR_PHONE_MAC}"
    tok1=$(extract_field "tok1")
    run GET_PROVISIONING "$DOOR_PHONE_UA" "/provisioning/${tok1}/0c383eaabbe0.cfg"
    assert_http_code "200"
    assert_http_body "<DSSKEY CONFIG MODULE>"
    assert_http_body "SoftDss Config-- :"
    assert_http_body "Fkey1 Type               :1"
    assert_http_body "Fkey1 Value              :603@1/f"
    assert_http_body "Fkey1 Title              :Reception"
    ! assert_http_body "Fkey2 "
    ! assert_http_body "Dsskey Config1--"
    ! assert_http_body "Desktop Click"
    ! assert_http_body "{{"
    ! assert_http_body "{%"
}

@test "Door phone relays use the default codes and the configured open time" {
    run PATCH "/tancredi/api/v1/phones/${DOOR_PHONE_MAC}" <<EOF
{
    "variables": {
        "door_dtmf_code": null,
        "door_relay_duration_1": "3",
        "door_relay_duration_2": "7"
    }
}
EOF
    assert_http_code "200"

    run GET "/tancredi/api/v1/phones/${DOOR_PHONE_MAC}"
    tok1=$(extract_field "tok1")
    run GET_PROVISIONING "$DOOR_PHONE_UA" "/provisioning/${tok1}/0c383eaabbe0.cfg"
    assert_http_code "200"
    assert_http_body "Output1 DTMF Trigger Code  :*"
    assert_http_body "Output1 Trigger Duration  :3"
    assert_http_body "Output2 DTMF Trigger Code  :#"
    assert_http_body "Output2 Trigger Duration  :7"
}

@test "GET /tancredi/api/v1/models/fanvil-i60 has one relay" {
    run GET /tancredi/api/v1/models/fanvil-i60
    assert_http_code "200"
    assert_http_body '"cap_door_relay_count":"1"'
    ! assert_http_body '"door_dtmf_code_2"'
}

@test "PATCH /tancredi/api/v1/phones refuses invalid door phone values with 422" {
    for variables in \
        '{"door_dtmf_code": "12;3"}' \
        '{"door_dtmf_code": "12345678901234567"}' \
        '{"door_dtmf_code_2": "#8\nRTSP Server Passwd :x"}' \
        '{"door_relay_duration_1": "3\nOutput1 DTMF Trigger Code  :0"}' \
        '{"door_relay_duration_1": "0"}' \
        '{"door_relay_duration_2": "601"}' \
        '{"door_relay_duration_2": "1000"}' \
        '{"door_relay_duration_2": "3s"}' \
        '{"door_rtsp_password": "pw\r\nRTSP Server User :x"}' \
        '{"door_rtsp_user": "admin\u0000"}' \
        '{"door_rtsp_user": ["admin"]}'
    do
        run PATCH "/tancredi/api/v1/phones/${DOOR_PHONE_MAC}" <<<"{\"variables\": ${variables}}"
        assert_http_code "422"
        assert_http_body "Invalid value of variable door_"
    done
}

@test "PATCH /tancredi/api/v1/phones accepts valid, empty and null door phone values" {
    run PATCH "/tancredi/api/v1/phones/${DOOR_PHONE_MAC}" <<EOF
{
    "variables": {
        "door_dtmf_code": "*12#",
        "door_dtmf_code_2": "aD9",
        "door_relay_duration_1": "600",
        "door_relay_duration_2": "",
        "door_rtsp_password": "Abc-123:x@y"
    }
}
EOF
    assert_http_code "200"
    run PATCH "/tancredi/api/v1/phones/${DOOR_PHONE_MAC}" <<EOF
{
    "variables": {
        "door_dtmf_code": null,
        "door_dtmf_code_2": null,
        "door_relay_duration_1": 3,
        "door_relay_duration_2": null
    }
}
EOF
    assert_http_code "200"
}

@test "POST /tancredi/api/v1/phones refuses an invalid door phone value with 422" {
    run POST /tancredi/api/v1/phones <<EOF
{
    "mac": "0C-38-3E-AA-BB-E1",
    "model": "fanvil-i62",
    "display_name": "Invalid door phone",
    "variables": {
        "door_dtmf_code": "4711\nAccount2 Level :10"
    }
}
EOF
    assert_http_code "422"
    run GET /tancredi/api/v1/phones/0C-38-3E-AA-BB-E1
    assert_http_code "404"
}

@test "Models and defaults refuse invalid door phone values with 422" {
    run PATCH /tancredi/api/v1/models/fanvil-i62 <<<'{"variables": {"door_dtmf_code": "*\n"}}'
    assert_http_code "422"
    run POST /tancredi/api/v1/models <<<'{"name": "door-test-model", "display_name": "Door test", "variables": {"door_relay_duration_1": "x"}}'
    assert_http_code "422"
    run GET /tancredi/api/v1/models/door-test-model
    assert_http_code "404"
    run PATCH /tancredi/api/v1/defaults <<<'{"door_rtsp_user": "admin\nx"}'
    assert_http_code "422"
    run GET /tancredi/api/v1/defaults
    ! assert_http_body "door_rtsp_user"
}

@test "Door phone template removes line breaks from free-text values" {
    run PATCH "/tancredi/api/v1/phones/${DOOR_PHONE_MAC}" <<'EOF'
{
    "variables": {
        "linekey_type_1": "speed_dial",
        "linekey_value_1": "603\r\nAccount3 Name :inj",
        "linekey_label_1": "Recept\n<MMI CONFIG MODULE>\nAccount2 Name :ptinj\nAccount2 Level :10",
        "adminpw": "doorweb123\nAccount4 Level :10",
        "account_display_name_1": "Door\r\nSIP2 Enable Reg :1"
    }
}
EOF
    assert_http_code "200"

    run GET "/tancredi/api/v1/phones/${DOOR_PHONE_MAC}"
    tok1=$(extract_field "tok1")
    run GET_PROVISIONING "$DOOR_PHONE_UA" "/provisioning/${tok1}/0c383eaabbe0.cfg"
    assert_http_code "200"
    assert_http_body "Fkey1 Title              :Recept<MMI CONFIG MODULE>Account2 Name :ptinjAccount2 Level :10"
    assert_http_body "Fkey1 Value              :603Account3 Name :inj@1/f"
    assert_http_body "Account1 Password           :doorweb123Account4 Level :10"
    assert_http_body "SIP1 Display Name       :DoorSIP2 Enable Reg :1"
    ! grep -q -E $'^(Account[234] |SIP2 )' <<<"$output"
    [[ $(grep -c -F '<MMI CONFIG MODULE>' <<<"$output") == 2 ]]
}

@test "GET /provisioning/0c383eaabbe0.cfg (tokenless) gives no token to a door phone" {
    run POST "/tancredi/api/v1/phones/${DOOR_PHONE_MAC}/tok1" <<<'{}'
    run GET "/tancredi/api/v1/phones/${DOOR_PHONE_MAC}"
    assert_http_code "200"
    tok1=$(extract_field "tok1")
    [[ -n "$tok1" ]]

    run GET_PROVISIONING "$DOOR_PHONE_UA" "/provisioning/0c383eaabbe0.cfg"
    assert_http_code "200"
    ! assert_http_body "$tok1"
    ! assert_http_body "<AUTOUPDATE CONFIG MODULE>"
    ! assert_http_body "Flash File Name"
    assert_http_body "<<END OF FILE>>"

    # The first access token still works for the device that knows it
    run GET_PROVISIONING "$DOOR_PHONE_UA" "/provisioning/${tok1}/0c383eaabbe0.cfg"
    assert_http_code "200"
    assert_http_body "<AUTOUPDATE CONFIG MODULE>"
    assert_http_body "Flash File Name    :provisioning/"
}

@test "GET /provisioning/{mac}.cfg (tokenless) still gives the first access token to other phones" {
    run POST /tancredi/api/v1/phones <<EOF
{
    "mac": "${DESK_PHONE_MAC}",
    "model": "fanvil-V61",
    "display_name": "Fanvil desk phone test",
    "variables": {}
}
EOF
    assert_http_code "201"
    tok1=$(extract_field "tok1")
    [[ -n "$tok1" ]]
    run GET_PROVISIONING "Fanvil V61 2.12.0 0c383eaabbe2" "/provisioning/0c383eaabbe2.cfg"
    assert_http_code "200"
    assert_http_body "$tok1"
}
