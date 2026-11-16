#!/usr/bin/env bats

DOOR_PHONE_MAC="0C-38-3E-AA-BB-E0"
DOOR_PHONE_UA="Fanvil i62 2.12.51 0c383eaabbe0"

setup () {
    load tancredi_client
}

teardown_file () {
    load tancredi_client
    run DELETE "/tancredi/api/v1/phones/${DOOR_PHONE_MAC}"
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
    assert_http_body '"cap_door_rtsp_adminpw":"1"'
    assert_http_body '"tmpl_phone":"fanvil-i6x.tmpl"'
    assert_http_body '"door_rtsp_path":"/h264/stream.live1"'
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
    assert_http_body "Account1 Password           :doorweb123"
    assert_http_body "video2 BitRate          :512000"
    assert_http_body "video2 Resolution       :4"
    assert_http_body "video1 I Frame Interval :25"
    assert_http_body "<RTSP SERVER CONFIG MODULE>"
    ! assert_http_body "<NET CONFIG MODULE>"
    ! assert_http_body "Web Port"
    ! assert_http_body "<EGS CONFIG MODULE>"
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
}

@test "Door phone RTSP password defaults to the admin password on i6x" {
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
    assert_http_body "RTSP Server User   :nethvoice"
    assert_http_body "RTSP Server Passwd :doorweb123"
}

@test "Door phone without RTSP password leaves the device RTSP credentials untouched" {
    run PATCH "/tancredi/api/v1/phones/${DOOR_PHONE_MAC}" <<EOF
{
    "variables": {
        "door_rtsp_password": "",
        "cap_door_rtsp_adminpw": ""
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
}
