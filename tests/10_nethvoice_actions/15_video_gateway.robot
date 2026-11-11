*** Settings ***
Documentation     Video gateway (MediaMTX) and RTSP video sources, NethServer/dev#7535.
...               No real device: the source points to an RFC 5737 address that
...               nobody answers, so only configuration, API and access control
...               are verified, never a stream.
Library           SSHLibrary
Library           Collections
Library           String
Library           ./VideoGateway.py
Resource          ../api.resource
Suite Setup       Prepare the video gateway suite
Suite Teardown    Remove the test video sources

*** Variables ***
${SOURCE_NAME}       Robot Door
${SOURCE_PATH}       streaming-gw/vs_robot_door
${RENAMED_NAME}      Robot Gate
${RENAMED_PATH}      streaming-gw/vs_robot_gate
${DEVICE_URL}        rtsp://192.0.2.10:554/stream
${DEVICE_USER}       robot
${DEVICE_SECRET}     Door-Secret-7535
${GATE_URL}          http://192.0.2.11/cgi-bin/open?relay=1
${GATE_SECRET}       Gate-Secret-7535
${GATEWAY_CONFIG}    /etc/mediamtx/mediamtx.yml
${CTI_CONFIG}        /etc/nethcti/streaming.json
# Minimal WHEP offer (Robot turns \r\n into CRLF): MediaMTX authorizes the
# reader before using it
${WHEP_OFFER}       v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\nc=IN IP4 0.0.0.0\r\na=mid:0\r\na=recvonly\r\na=rtpmap:96 H264/90000\r\n

*** Test Cases ***
The video gateway ports are allocated
    FOR    ${name}    IN    MEDIAMTX_WHEP_PORT    MEDIAMTX_API_PORT    MEDIAMTX_RTSP_PORT    MEDIAMTX_ICE_UDP_PORT    MEDIAMTX_ICE_TCP_PORT
        ${value} =    Module environment value    ${name}
        Should Match Regexp    ${value}    ^\\d{1,5}$    ${name} is not a port: '${value}'
    END
    ${tcp_ports} =    Evaluate    {$WHEP_PORT, $API_PORT, $RTSP_PORT, $ICE_TCP_PORT}
    Length Should Be    ${tcp_ports}    4    the gateway TCP ports must be distinct
    # Set by configure-module from the nethvoice-proxy addresses
    Environment should define    MEDIAMTX_ICE_HOSTS
    Environment should define    MEDIAMTX_PUBLIC_IP

The mediamtx service is enabled and active
    ${output} =    Execute Command    runagent -m ${module_id} systemctl --user is-enabled mediamtx.service
    Should Be Equal    ${output}    enabled
    # The configuration may appear only after the first FreePBX reload
    Wait Until Keyword Succeeds    3 min    10 sec    Service should be active    mediamtx.service

The gateway configuration uses the allocated ports
    ${rest_port} =    Module environment value    NETHCTI_INTERNAL_REST_PORT9
    ${config} =    Gateway configuration
    Should Contain    ${config}    apiAddress: "127.0.0.1:${API_PORT}"
    Should Contain    ${config}    webrtcAddress: "127.0.0.1:${WHEP_PORT}"
    Should Contain    ${config}    rtspAddress: "127.0.0.1:${RTSP_PORT}"
    Should Contain    ${config}    webrtcLocalUDPAddress: ":${ICE_UDP_PORT}"
    Should Contain    ${config}    webrtcLocalTCPAddress: ":${ICE_TCP_PORT}"
    # Every request is authorized by nethcti-server, the control API included
    Should Contain    ${config}    authMethod: http
    Should Contain    ${config}    authHTTPAddress: "http://127.0.0.1:${rest_port}/mediamtx/auth"
    Should Contain    ${config}    authHTTPExclude: []
    Should Not Contain    ${config}    - action: api
    Should Contain    ${config}    maxReaders: 100
    # Unknown paths are authorized like the configured ones
    Should Contain    ${config}    "~^.*$":
    Should Contain    ${config}    rtspTransports: [tcp]
    Should Contain    ${config}    sourceOnDemand: true
    FOR    ${disabled}    IN    metrics    pprof    playback    rtmp    srt    hls
        Should Contain    ${config}    ${disabled}: false
    END

The gateway configuration is readable only by asterisk
    ${output}    ${rc} =    Execute Command
    ...    runagent -m ${module_id} podman exec freepbx stat -c '%a %U %G' ${GATEWAY_CONFIG}
    ...    return_rc=True
    Should Be Equal As Integers    ${rc}    0
    Should Be Equal    ${output}    640 asterisk asterisk

The gateway listens on loopback except for ICE
    Wait Until Keyword Succeeds    1 min    5 sec    TCP port should listen only on loopback    ${WHEP_PORT}
    TCP port should listen only on loopback    ${API_PORT}
    TCP port should listen only on loopback    ${RTSP_PORT}
    TCP port should listen on all addresses    ${ICE_TCP_PORT}
    UDP port should listen on all addresses    ${ICE_UDP_PORT}

The video sources schema is present
    ${columns} =    Query SQL
    ...    SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'asterisk' AND TABLE_NAME = 'rest_cti_streaming'
    ${columns} =    Split To Lines    ${columns}
    FOR    ${column}    IN    descr    type    url    user    secret    exten    open    tls_skip_verify    tls_fingerprint
        List Should Contain Value    ${columns}    ${column}
    END
    ${lengths} =    Query SQL
    ...    SELECT CONCAT(COLUMN_NAME, ':', CHARACTER_MAXIMUM_LENGTH) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'asterisk' AND TABLE_NAME = 'rest_cti_streaming' AND COLUMN_NAME IN ('user', 'secret', 'open')
    ${lengths} =    Split To Lines    ${lengths}
    List Should Contain Value    ${lengths}    user:255
    List Should Contain Value    ${lengths}    secret:255
    List Should Contain Value    ${lengths}    open:30
    ${columns} =    Query SQL
    ...    SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'asterisk' AND TABLE_NAME = 'rest_cti_streaming_gates'
    ${columns} =    Split To Lines    ${columns}
    FOR    ${column}    IN    id    source    position    name    type    code    url    method    username    password    tls_fingerprint
        List Should Contain Value    ${columns}    ${column}
    END

The gateway control API password is generated
    ${rc} =    Execute Command    runagent -m ${module_id} grep -qE '^MEDIAMTX_API_PASSWORD=[A-Za-z0-9]{32}$' passwords.env
    ...    return_stdout=False    return_rc=True
    Should Be Equal As Integers    ${rc}    0    MEDIAMTX_API_PASSWORD is missing from passwords.env
    # nethcti-server reads it from services.json
    ${rc} =    Execute Command    runagent -m ${module_id} podman exec nethcti-server grep -qE '"api_password": "[A-Za-z0-9]{32}"' /etc/nethcti/services.json
    ...    return_stdout=False    return_rc=True
    Should Be Equal As Integers    ${rc}    0    api_password is missing from services.json

The gateway control API requires the nethcti-server credentials
    # The API returns the device passwords: no anonymous access, not even
    # from the loopback
    ${response} =    Gateway Api Request    ${module_id}    GET    /v3/config/paths/list    none
    Should Be Equal As Integers    ${response['status']}    401    ${response['text']}
    ${response} =    Gateway Api Request    ${module_id}    GET    /v3/config/paths/list    wrong
    Should Be Equal As Integers    ${response['status']}    401    ${response['text']}
    ${response} =    Gateway Api Request    ${module_id}    GET    /v3/config/global/get    none
    Should Be Equal As Integers    ${response['status']}    401    ${response['text']}
    ${response} =    Gateway Api Request    ${module_id}    POST    /v3/webrtcsessions/kick/00000000-0000-0000-0000-000000000000    none
    Should Be Equal As Integers    ${response['status']}    401    ${response['text']}
    ${response} =    Gateway Api Request    ${module_id}    GET    /v3/config/paths/list    secret
    Should Be Equal As Integers    ${response['status']}    200    ${response['text']}

The gateway network facts are returned
    ${response} =    Freepbx Rest Request    ${module_id}    GET    cti/sources/gateway
    Should Be Equal As Integers    ${response['status']}    200    ${response['text']}
    Should Be Equal As Integers    ${response['body']['ice_udp_port']}    ${ICE_UDP_PORT}
    Should Be Equal As Integers    ${response['body']['ice_tcp_port']}    ${ICE_TCP_PORT}
    Should Be Equal    ${response['body']['path_prefix']}    /streaming-gw/
    Should Not Be Empty    ${response['body']['ice_hosts']}

An unreachable RTSP device is reported without its password
    ${payload} =    Create Dictionary    url=${DEVICE_URL}    user=${DEVICE_USER}    secret=${DEVICE_SECRET}    details=${TRUE}
    ${response} =    Freepbx Rest Request    ${module_id}    POST    cti/sources/test    ${payload}
    Should Be Equal As Integers    ${response['status']}    200    ${response['text']}
    Should Be Equal    ${response['body']['success']}    ${FALSE}
    Should Be Equal    ${response['body']['type']}    rtsp
    Should Contain Any    ${response['body']['reason']}    timeout    connection_refused    unknown
    Should Not Contain    ${response['text']}    ${DEVICE_SECRET}

An RTSP source can be created
    # Credentials pasted into the URL are stored apart from it
    ${profile} =    Query SQL    SELECT id FROM rest_cti_profiles ORDER BY id LIMIT 1
    Set Suite Variable    ${PROFILE_ID}    ${profile}
    ${payload} =    Evaluate
    ...    {"descr": $SOURCE_NAME, "url": "rtsp://" + $DEVICE_USER + ":" + $DEVICE_SECRET + "@192.0.2.10:554/stream", "exten": "", "gates": [], "profiles": [$PROFILE_ID]}
    ${response} =    Freepbx Rest Request    ${module_id}    POST    cti/streaming    ${payload}
    Should Be Equal As Integers    ${response['status']}    200    ${response['text']}

The created source is returned without its password
    ${source} =    Get video source    ${SOURCE_NAME}
    Should Be Equal    ${source['type']}    rtsp
    Should Be Equal    ${source['url']}    ${DEVICE_URL}
    Should Be Equal    ${source['user']}    ${DEVICE_USER}
    Should Be Equal    ${source['has_secret']}    ${TRUE}
    Dictionary Should Not Contain Key    ${source}    secret
    Should Be Equal    ${source['permission']}    vs_robot_door
    Should Be Equal    ${source['gateway_path']}    ${SOURCE_PATH}
    Should Be Equal    ${source['tls_skip_verify']}    ${FALSE}
    Should Be Empty    ${source['gates']}
    List Should Contain Value    ${source['profiles']}    ${PROFILE_ID}
    ${list} =    Freepbx Rest Request    ${module_id}    GET    cti/streaming
    Should Not Contain    ${list['text']}    ${DEVICE_SECRET}
    ${stored_url} =    Query SQL    SELECT url FROM rest_cti_streaming WHERE descr = '${SOURCE_NAME}'
    Should Be Equal    ${stored_url}    ${DEVICE_URL}

The gateway serves the new source
    Wait Until Keyword Succeeds    3 min    10 sec
    ...    Gateway configuration should contain    "${SOURCE_PATH}":
    ${config} =    Gateway configuration
    # Only the gateway configuration carries the device credentials
    Should Contain    ${config}    source: "rtsp://${DEVICE_USER}:${DEVICE_SECRET}@192.0.2.10:554/stream"
    Wait Until Keyword Succeeds    1 min    5 sec
    ...    Gateway API should list path    ${SOURCE_PATH}

The CTI configuration does not expose the device
    Wait Until Keyword Succeeds    3 min    10 sec
    ...    CTI configuration should contain    "vs_robot_door"
    ${config} =    CTI configuration
    ${entry} =    Evaluate    json.loads($config)['vs_robot_door']    modules=json
    Should Be Equal    ${entry['type']}    rtsp
    Should Be Equal    ${entry['gateway_path']}    ${SOURCE_PATH}
    Should Be Equal    ${entry['url']}    ${EMPTY}
    Should Be Equal    ${entry['user']}    ${EMPTY}
    Should Be Equal    ${entry['secret']}    ${EMPTY}
    Should Be Equal    ${entry['image_auth']}    ${NONE}
    Should Not Contain    ${config}    ${DEVICE_SECRET}
    Should Not Contain    ${config}    192.0.2.10

Gates can be added to the source
    # An empty secret keeps the stored one (secrets are write-only)
    ${payload} =    Evaluate
    ...    {"currentDescr": $SOURCE_NAME, "descr": $SOURCE_NAME, "url": $DEVICE_URL, "user": $DEVICE_USER, "secret": "", "exten": "", "profiles": [$PROFILE_ID], "gates": [{"name": "Main door", "type": "dtmf", "code": "*1"}, {"name": "Garage", "type": "url", "url": $GATE_URL, "method": "POST", "username": "gate", "password": $GATE_SECRET}]}
    ${response} =    Freepbx Rest Request    ${module_id}    PUT    cti/streaming/${SOURCE_NAME}    ${payload}
    Should Be Equal As Integers    ${response['status']}    200    ${response['text']}
    ${source} =    Get video source    ${SOURCE_NAME}
    Should Be Equal    ${source['has_secret']}    ${TRUE}
    Should Be Equal    ${source['open']}    *1
    Length Should Be    ${source['gates']}    2
    ${dtmf} =    Set Variable    ${source['gates'][0]}
    Should Be Equal    ${dtmf['type']}    dtmf
    Should Be Equal    ${dtmf['code']}    *1
    ${gate} =    Set Variable    ${source['gates'][1]}
    Should Be Equal    ${gate['type']}    url
    Should Be Equal    ${gate['url']}    ${GATE_URL}
    Should Be Equal    ${gate['method']}    POST
    Should Be Equal    ${gate['username']}    gate
    Should Be Equal    ${gate['has_password']}    ${TRUE}
    Dictionary Should Not Contain Key    ${gate}    password
    ${list} =    Freepbx Rest Request    ${module_id}    GET    cti/streaming
    Should Not Contain    ${list['text']}    ${GATE_SECRET}
    Should Not Contain    ${list['text']}    ${DEVICE_SECRET}

The updated configuration keeps the device password and lists the gates
    Wait Until Keyword Succeeds    3 min    10 sec
    ...    CTI configuration should contain    "Garage"
    ${config} =    CTI configuration
    ${entry} =    Evaluate    json.loads($config)['vs_robot_door']    modules=json
    Should Be Equal    ${entry['open']}    *1
    ${types} =    Evaluate    [g['type'] for g in $entry['gates']]
    Should Be Equal    ${types}    ${{['dtmf', 'url']}}
    Should Not Contain    ${config}    ${DEVICE_SECRET}
    ${config} =    Gateway configuration
    Should Contain    ${config}    source: "rtsp://${DEVICE_USER}:${DEVICE_SECRET}@192.0.2.10:554/stream"
    # Gates are opened by nethcti-server, never by the gateway
    Should Not Contain    ${config}    ${GATE_SECRET}
    ${facts} =    Run task    module/${module_id}/get-facts    {}
    Should Be True    ${facts['nethvoice_streaming_by_type']['rtsp']} >= 1
    Should Be True    ${facts['nethvoice_streaming_gates_by_type']['dtmf']} >= 1
    Should Be True    ${facts['nethvoice_streaming_gates_by_type']['url']} >= 1

Invalid sources are rejected
    ${response} =    Freepbx Rest Request    ${module_id}    POST    cti/streaming
    ...    {"descr": "Robot Bad", "url": "ftp://192.0.2.10/stream", "profiles": []}
    Validation error should be    ${response}    url
    ${response} =    Freepbx Rest Request    ${module_id}    POST    cti/streaming
    ...    {"descr": "Robot Bad", "url": "rtsp://192.0.2.10:554/stream", "gates": [{"name": "Door", "type": "dtmf", "code": "12x"}], "profiles": []}
    Validation error should be    ${response}    gates[0].code
    ${response} =    Freepbx Rest Request    ${module_id}    POST    cti/streaming
    ...    {"descr": "Robot Bad", "url": "rtsp://192.0.2.10:554/stream", "gates": [{"name": "Door", "type": "url", "url": "rtsp://192.0.2.11/open"}], "profiles": []}
    Validation error should be    ${response}    gates[0].url
    ${response} =    Freepbx Rest Request    ${module_id}    POST    cti/streaming
    ...    {"descr": "Robot Bad", "url": "rtsp://192.0.2.10:554/stream", "exten": "12a", "profiles": []}
    Validation error should be    ${response}    exten
    # The PBX itself and the link-local addresses are never devices, in any form
    FOR    ${url}    IN    http://127.0.0.1:${API_PORT}/v3/config/global/get    http://localhost/x.jpg    http://0x7f000001:${API_PORT}/v3/config/paths/list
    ...    http://2130706433/x.jpg    http://[::1]/x.jpg    http://[::ffff:127.0.0.1]/x.jpg    http://169.254.169.254/latest/meta-data/    rtsp://127.0.0.1:${RTSP_PORT}/x
        ${payload} =    Evaluate    {"descr": "Robot Bad", "url": $url, "profiles": []}
        ${response} =    Freepbx Rest Request    ${module_id}    POST    cti/streaming    ${payload}
        Validation error should be    ${response}    url
    END
    ${response} =    Freepbx Rest Request    ${module_id}    POST    cti/streaming
    ...    {"descr": "Robot Bad", "url": "rtsp://192.0.2.10:554/stream", "gates": [{"name": "Door", "type": "url", "url": "http://169.254.169.254/latest/meta-data/"}], "profiles": []}
    Validation error should be    ${response}    gates[0].url
    # Skip the TLS verification only with the certificate of the device: an
    # unreachable device cannot be pinned
    ${response} =    Freepbx Rest Request    ${module_id}    POST    cti/streaming
    ...    {"descr": "Robot Bad", "url": "https://192.0.2.12/snap.jpg", "tls_skip_verify": true, "profiles": []}
    Validation error should be    ${response}    tls_skip_verify
    ${response} =    Freepbx Rest Request    ${module_id}    POST    cti/streaming
    ...    {"descr": "Robot Bad", "url": "rtsp://192.0.2.10:554/stream", "tls_skip_verify": true, "gates": [{"name": "Door", "type": "url", "url": "https://192.0.2.12/open"}], "profiles": []}
    Validation error should be    ${response}    gates[0].url
    ${list} =    Freepbx Rest Request    ${module_id}    GET    cti/streaming
    ${names} =    Evaluate    [s['descr'] for s in $list['body']]
    List Should Not Contain Value    ${names}    Robot Bad

The check refuses the PBX itself and the link-local addresses
    FOR    ${url}    IN    http://127.0.0.1:${API_PORT}/v3/config/global/get    http://0x7f000001:${API_PORT}/v3/config/global/get    http://169.254.169.254/latest/meta-data/    rtsp://127.0.0.1:${RTSP_PORT}/x
        ${payload} =    Create Dictionary    url=${url}    details=${TRUE}
        ${response} =    Freepbx Rest Request    ${module_id}    POST    cti/sources/test    ${payload}
        Should Be Equal As Integers    ${response['status']}    200    ${response['text']}
        Should Be Equal    ${response['body']['success']}    ${FALSE}
        Should Be Equal    ${response['body']['reason']}    address_not_allowed
        Should Be Equal    ${response['body']['image']}    ${NONE}
    END
    # Legacy clients (no "details"): an error, never the content
    ${payload} =    Create Dictionary    url=http://127.0.0.1:${API_PORT}/v3/config/global/get
    ${response} =    Freepbx Rest Request    ${module_id}    POST    cti/sources/test    ${payload}
    Should Be Equal As Integers    ${response['status']}    500    ${response['text']}

A stored password is never sent to another device
    ${payload} =    Evaluate
    ...    {"currentDescr": $SOURCE_NAME, "descr": $SOURCE_NAME, "url": "rtsp://192.0.2.20:554/stream", "user": $DEVICE_USER, "secret": "", "profiles": [$PROFILE_ID]}
    ${response} =    Freepbx Rest Request    ${module_id}    PUT    cti/streaming/${SOURCE_NAME}    ${payload}
    Validation error should be    ${response}    secret
    ${source} =    Get video source    ${SOURCE_NAME}
    Should Be Equal    ${source['url']}    ${DEVICE_URL}

Duplicate and unknown sources are refused
    ${payload} =    Evaluate    {"descr": $SOURCE_NAME, "url": $DEVICE_URL, "profiles": []}
    ${response} =    Freepbx Rest Request    ${module_id}    POST    cti/streaming    ${payload}
    Should Be Equal As Integers    ${response['status']}    409    ${response['text']}
    ${payload} =    Evaluate    {"currentDescr": "Robot Missing", "descr": "Robot Missing", "url": $DEVICE_URL, "profiles": []}
    ${response} =    Freepbx Rest Request    ${module_id}    PUT    cti/streaming/Robot Missing    ${payload}
    Should Be Equal As Integers    ${response['status']}    404    ${response['text']}

The gateway refuses WHEP readers without a token
    # nethcti-server authorizes every reader: no token, no stream. It
    # refuses also when nethcti-server is not running (wizard not completed).
    ${headers} =    Create Dictionary    Content-Type=application/sdp
    ${offer} =    Set Variable    ${WHEP_OFFER}
    ${response} =    Node Http Request    ${module_id}    POST
    ...    http://127.0.0.1:${WHEP_PORT}/${SOURCE_PATH}/whep    ${offer}    ${headers}
    Should Be Equal As Integers    ${response['status']}    401    ${response['text']}
    # The same through traefik, the way the CTI clients reach it
    ${cti_host} =    Module environment value    NETHCTI_UI_HOST
    ${headers} =    Create Dictionary    Content-Type=application/sdp    Host=${cti_host}
    ${response} =    Node Http Request    ${module_id}    POST
    ...    https://127.0.0.1/${SOURCE_PATH}/whep    ${offer}    ${headers}
    Should Be Equal As Integers    ${response['status']}    401    ${response['text']}

The gateway answers unknown paths like the configured ones
    ${headers} =    Create Dictionary    Content-Type=application/sdp
    ${response} =    Node Http Request    ${module_id}    POST
    ...    http://127.0.0.1:${WHEP_PORT}/streaming-gw/vs_robot_nope/whep    ${WHEP_OFFER}    ${headers}
    Should Be Equal As Integers    ${response['status']}    401    ${response['text']}
    Should Not Contain    ${response['text']}    not configured

The gateway refuses a token in the query string
    # Only "Authorization: Bearer" is read: a query token is never valid
    ${headers} =    Create Dictionary    Content-Type=application/sdp
    ${response} =    Node Http Request    ${module_id}    POST
    ...    http://127.0.0.1:${WHEP_PORT}/${SOURCE_PATH}/whep?token=${{'0' * 64}}    ${WHEP_OFFER}    ${headers}
    Should Be Equal As Integers    ${response['status']}    401    ${response['text']}

A source is deleted only by its exact name
    # "Robot Door!" has the same permission name as "Robot Door"
    ${response} =    Freepbx Rest Request    ${module_id}    DELETE    cti/streaming/${SOURCE_NAME}!
    Should Be Equal As Integers    ${response['status']}    404    ${response['text']}
    ${response} =    Freepbx Rest Request    ${module_id}    DELETE    cti/streaming/robot door
    Should Be Equal As Integers    ${response['status']}    404    ${response['text']}
    ${count} =    Query SQL    SELECT COUNT(*) FROM rest_cti_permissions WHERE name = 'vs_robot_door'
    Should Be Equal As Integers    ${count}    1
    ${source} =    Get video source    ${SOURCE_NAME}
    List Should Contain Value    ${source['profiles']}    ${PROFILE_ID}

The gateway control API is not reachable through traefik
    ${cti_host} =    Module environment value    NETHCTI_UI_HOST
    ${headers} =    Create Dictionary    Host=${cti_host}
    ${response} =    Node Http Request    ${module_id}    GET
    ...    https://127.0.0.1/streaming-gw/v3/config/paths/list    headers=${headers}
    Should Not Be Equal As Integers    ${response['status']}    200
    Should Not Contain    ${response['text']}    ${DEVICE_SECRET}

A renamed source moves its gateway path
    ${source} =    Get video source    ${SOURCE_NAME}
    # Gate ids keep the stored gate passwords
    ${gates} =    Evaluate
    ...    [{"id": g["id"], "name": g["name"], "type": g["type"], "code": g["code"], "url": g["url"], "method": g["method"], "username": g["username"], "password": ""} for g in $source["gates"]]
    ${payload} =    Evaluate
    ...    {"currentDescr": $SOURCE_NAME, "descr": $RENAMED_NAME, "url": $DEVICE_URL, "user": $DEVICE_USER, "secret": "", "exten": "", "profiles": [$PROFILE_ID], "gates": $gates}
    ${response} =    Freepbx Rest Request    ${module_id}    PUT    cti/streaming/${SOURCE_NAME}    ${payload}
    Should Be Equal As Integers    ${response['status']}    200    ${response['text']}
    ${source} =    Get video source    ${RENAMED_NAME}
    Should Be Equal    ${source['gateway_path']}    ${RENAMED_PATH}
    Should Be Equal    ${source['has_secret']}    ${TRUE}
    Length Should Be    ${source['gates']}    2
    Should Be Equal    ${source['gates'][1]['has_password']}    ${TRUE}
    Wait Until Keyword Succeeds    3 min    10 sec
    ...    Gateway configuration should contain    "${RENAMED_PATH}":
    Gateway configuration should not contain    "${SOURCE_PATH}":
    Wait Until Keyword Succeeds    1 min    5 sec
    ...    Gateway API should not list path    ${SOURCE_PATH}

A deleted source leaves no trace
    ${response} =    Freepbx Rest Request    ${module_id}    DELETE    cti/streaming/${RENAMED_NAME}
    Should Be Equal As Integers    ${response['status']}    200    ${response['text']}
    ${list} =    Freepbx Rest Request    ${module_id}    GET    cti/streaming
    ${names} =    Evaluate    [s['descr'] for s in $list['body']]
    List Should Not Contain Value    ${names}    ${RENAMED_NAME}
    ${count} =    Query SQL    SELECT COUNT(*) FROM rest_cti_streaming_gates WHERE source = '${RENAMED_NAME}'
    Should Be Equal As Integers    ${count}    0
    ${count} =    Query SQL    SELECT COUNT(*) FROM rest_cti_permissions WHERE name = 'vs_robot_gate'
    Should Be Equal As Integers    ${count}    0
    Wait Until Keyword Succeeds    3 min    10 sec
    ...    Gateway configuration should not contain    "${RENAMED_PATH}":
    Gateway configuration should not contain    ${DEVICE_SECRET}
    Wait Until Keyword Succeeds    3 min    10 sec
    ...    CTI configuration should not contain    "vs_robot_gate"
    Wait Until Keyword Succeeds    1 min    5 sec
    ...    Gateway API should not list path    ${RENAMED_PATH}

*** Keywords ***
Prepare the video gateway suite
    Wait Until Keyword Succeeds    10 min    10 sec    FreePBX should be ready
    ${value} =    Module environment value    MEDIAMTX_WHEP_PORT
    Set Suite Variable    ${WHEP_PORT}    ${value}
    ${value} =    Module environment value    MEDIAMTX_API_PORT
    Set Suite Variable    ${API_PORT}    ${value}
    ${value} =    Module environment value    MEDIAMTX_RTSP_PORT
    Set Suite Variable    ${RTSP_PORT}    ${value}
    ${value} =    Module environment value    MEDIAMTX_ICE_UDP_PORT
    Set Suite Variable    ${ICE_UDP_PORT}    ${value}
    ${value} =    Module environment value    MEDIAMTX_ICE_TCP_PORT
    Set Suite Variable    ${ICE_TCP_PORT}    ${value}
    Set Suite Variable    ${PROFILE_ID}    ${EMPTY}
    # Leftovers of an interrupted run
    Remove the test video sources

Remove the test video sources
    # Delete only what exists: every deletion triggers a FreePBX reload
    ${response} =    Freepbx Rest Request    ${module_id}    GET    cti/streaming
    Should Be Equal As Integers    ${response['status']}    200    ${response['text']}
    ${names} =    Evaluate    [s['descr'] for s in $response['body'] if s['descr'] in ($SOURCE_NAME, $RENAMED_NAME, 'Robot Bad', 'Robot Missing')]
    FOR    ${name}    IN    @{names}
        ${response} =    Freepbx Rest Request    ${module_id}    DELETE    cti/streaming/${name}
        Should Be Equal As Integers    ${response['status']}    200    ${response['text']}
    END

FreePBX should be ready
    ${rc} =    Execute Command    runagent -m ${module_id} podman exec freepbx test -f /var/run/nethvoice/freepbx-ready
    ...    return_stdout=False    return_rc=True
    Should Be Equal As Integers    ${rc}    0    FreePBX is not ready

Module environment value
    [Arguments]    ${name}
    ${output}    ${rc} =    Execute Command    runagent -m ${module_id} printenv ${name}    return_rc=True
    Should Be Equal As Integers    ${rc}    0    ${name} is missing from the module environment
    RETURN    ${output}

Environment should define
    [Arguments]    ${name}
    ${rc} =    Execute Command    runagent -m ${module_id} grep -q '^${name}=' environment
    ...    return_stdout=False    return_rc=True
    Should Be Equal As Integers    ${rc}    0    ${name} is missing from the module environment

Service should be active
    [Arguments]    ${service}
    ${output} =    Execute Command    runagent -m ${module_id} systemctl --user is-active ${service}
    Should Be Equal    ${output}    active

TCP port should listen only on loopback
    [Arguments]    ${port}
    ${output} =    Execute Command    ss -Hltn 'sport = :${port}'
    ${addresses} =    Evaluate    [line.split()[3] for line in $output.splitlines() if line.strip()]
    Should Not Be Empty    ${addresses}    nothing listens on TCP port ${port}
    FOR    ${address}    IN    @{addresses}
        Should Be Equal    ${address}    127.0.0.1:${port}    TCP port ${port} is not loopback only
    END

TCP port should listen on all addresses
    [Arguments]    ${port}
    ${output} =    Execute Command    ss -Hltn 'sport = :${port}'
    Listener should be public    ${output}    ${port}

UDP port should listen on all addresses
    [Arguments]    ${port}
    ${output} =    Execute Command    ss -Hlun 'sport = :${port}'
    Listener should be public    ${output}    ${port}

Listener should be public
    [Arguments]    ${ss_output}    ${port}
    ${hosts} =    Evaluate    [line.split()[3].rsplit(':', 1)[0] for line in $ss_output.splitlines() if line.strip()]
    ${public} =    Evaluate    any(host in ('*', '0.0.0.0', '[::]') for host in $hosts)
    Should Be True    ${public}    port ${port} does not listen on all addresses: ${hosts}

Query SQL
    [Arguments]    ${sql}
    ${stdout}    ${stderr}    ${rc} =    Execute Command
    ...    runagent -m ${module_id} podman exec mariadb sh -c 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb -uroot asterisk --batch --skip-column-names -e "$1"' sh "${sql}"
    ...    return_stdout=True    return_stderr=True    return_rc=True
    Should Be Equal As Integers    ${rc}    0    ${stderr}
    RETURN    ${stdout}

Container file
    [Arguments]    ${path}
    ${output}    ${rc} =    Execute Command    runagent -m ${module_id} podman exec freepbx cat ${path}
    ...    return_rc=True
    Should Be Equal As Integers    ${rc}    0    cannot read ${path}
    RETURN    ${output}

Gateway configuration
    ${config} =    Container file    ${GATEWAY_CONFIG}
    RETURN    ${config}

Gateway configuration should contain
    [Arguments]    ${text}
    ${config} =    Gateway configuration
    Should Contain    ${config}    ${text}

Gateway configuration should not contain
    [Arguments]    ${text}
    ${config} =    Gateway configuration
    Should Not Contain    ${config}    ${text}

CTI configuration
    ${config} =    Container file    ${CTI_CONFIG}
    RETURN    ${config}

CTI configuration should contain
    [Arguments]    ${text}
    ${config} =    CTI configuration
    Should Contain    ${config}    ${text}

CTI configuration should not contain
    [Arguments]    ${text}
    ${config} =    CTI configuration
    Should Not Contain    ${config}    ${text}

Gateway API paths
    # Loopback only, never routed, and only for the nethcti-server user
    ${response} =    Gateway Api Request    ${module_id}    GET    /v3/config/paths/list?itemsPerPage=1000
    Should Be Equal As Integers    ${response['status']}    200    ${response['text']}
    ${names} =    Evaluate    [item['name'] for item in $response['body']['items']]
    RETURN    ${names}

Gateway API should list path
    [Arguments]    ${path}
    ${names} =    Gateway API paths
    List Should Contain Value    ${names}    ${path}

Gateway API should not list path
    [Arguments]    ${path}
    ${names} =    Gateway API paths
    List Should Not Contain Value    ${names}    ${path}

Get video source
    [Arguments]    ${descr}
    ${response} =    Freepbx Rest Request    ${module_id}    GET    cti/streaming
    Should Be Equal As Integers    ${response['status']}    200    ${response['text']}
    ${matches} =    Evaluate    [s for s in $response['body'] if s['descr'] == $descr]
    Length Should Be    ${matches}    1    video source ${descr} not found
    RETURN    ${matches[0]}

Validation error should be
    [Arguments]    ${response}    ${field}
    Should Be Equal As Integers    ${response['status']}    400    ${response['text']}
    Should Be Equal    ${response['body']['field']}    ${field}
