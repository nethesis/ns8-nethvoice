*** Settings ***
Library   SSHLibrary
Resource  ../api.resource

*** Variables ***
# IP trunk (registration none, no proxy) to an unroutable address: Asterisk
# qualifies it with OPTIONS that nobody answers
${TRUNK_ID}      990
${TRUNK_NAME}    NvRobotIp
@{TRUNK_SQL}
...    INSERT INTO trunks (trunkid, tech, channelid, name) VALUES (${TRUNK_ID}, 'pjsip', '${TRUNK_NAME}', '${TRUNK_NAME}');
...    INSERT INTO pjsip (id, keyword, data) VALUES
...    (${TRUNK_ID}, 'trunk_name', '${TRUNK_NAME}'), (${TRUNK_ID}, 'sv_trunk_name', '${TRUNK_NAME}'),
...    (${TRUNK_ID}, 'sv_channelid', '${TRUNK_NAME}'), (${TRUNK_ID}, 'extdisplay', 'OUT_${TRUNK_ID}'),
...    (${TRUNK_ID}, 'registration', 'none'), (${TRUNK_ID}, 'authentication', 'off'),
...    (${TRUNK_ID}, 'sip_server', '192.0.2.10'), (${TRUNK_ID}, 'sip_server_port', '5060'),
...    (${TRUNK_ID}, 'transport', '0.0.0.0-udp'), (${TRUNK_ID}, 'context', 'from-pstn-toheader'),
...    (${TRUNK_ID}, 'codecs', 'ulaw,alaw'), (${TRUNK_ID}, 'dtmfmode', 'auto'),
...    (${TRUNK_ID}, 'qualify_frequency', '60'), (${TRUNK_ID}, 'from_domain', '192.0.2.10'),
...    (${TRUNK_ID}, 'from_user', '${TRUNK_NAME}'), (${TRUNK_ID}, 'contact_user', '${TRUNK_NAME}'),
...    (${TRUNK_ID}, 'username', '${TRUNK_NAME}'), (${TRUNK_ID}, 'secret', ''),
...    (${TRUNK_ID}, 'outbound_proxy', ''), (${TRUNK_ID}, 'expiration', '300'),
...    (${TRUNK_ID}, 'retry_interval', '60'), (${TRUNK_ID}, 'max_retries', '10'),
...    (${TRUNK_ID}, 'forbidden_retry_interval', '10'), (${TRUNK_ID}, 'fatal_retry_interval', '0'),
...    (${TRUNK_ID}, 'identify_by', 'default'), (${TRUNK_ID}, 'direct_media', 'no'),
...    (${TRUNK_ID}, 'rewrite_contact', 'yes'), (${TRUNK_ID}, 'rtp_symmetric', 'no'),
...    (${TRUNK_ID}, 'force_rport', 'yes'), (${TRUNK_ID}, 'dialoutopts_cb', 'sys'),
...    (${TRUNK_ID}, 'hcid', 'on'), (${TRUNK_ID}, 'pjsip_line', 'true'), (${TRUNK_ID}, 'disabletrunk', 'off');

*** Test Cases ***
Alerts are disabled by default
    ${response} =    Run task    module/${module_id}/get-configuration    {}
    Should Be Equal    ${response['alerts_enabled']}    ${FALSE}
    ${output}    ${rc} =    Execute Command    runagent redis-exec HKEYS module/${module_id}/metrics_alert_rules    return_rc=True
    Should Be Equal As Integers    ${rc}    0
    Should Not Contain    ${output}    nethvoice-

Alert rules are published
    Run task    module/${module_id}/set-alerts    {"alerts_enabled": true}    decode_json=False
    ${response} =    Run task    module/${module_id}/get-configuration    {}
    Should Be Equal    ${response['alerts_enabled']}    ${TRUE}
    ${output}    ${rc} =    Execute Command    runagent redis-exec HKEYS module/${module_id}/metrics_alert_rules    return_rc=True
    Should Be Equal As Integers    ${rc}    0
    Should Contain    ${output}    nethvoice-services
    Should Contain    ${output}    nethvoice-dns
    Should Contain    ${output}    nethvoice-ai
    Should Contain    ${output}    nethvoice-telephony
    ${output}    ${rc} =    Execute Command    runagent redis-exec HGET module/${module_id}/metrics_alert_rules nethvoice-telephony    return_rc=True
    Should Be Equal As Integers    ${rc}    0
    Should Contain    ${output}    alert: NethVoiceTrunkUnreachable

Service state is exported
    ${output}    ${rc} =    Execute Command    runagent -m ${module_id} export-metrics    return_rc=True
    Should Be Equal As Integers    ${rc}    0
    Should Contain    ${output}    nethvoice_service_up{service="freepbx"} 1
    Should Contain    ${output}    nethvoice_service_restarts_total{service="freepbx"}
    Should Contain    ${output}    nethvoice_exporter_collector_up{collector="systemd"} 1
    # The resolver may not know the test names, but it always gets a response time
    Should Contain    ${output}    nethvoice_exporter_collector_up{collector="dns"} 1
    Should Contain    ${output}    nethvoice_dns_response_seconds{
    Should Not Contain    ${output}    module=

Asterisk and trunk metrics are exported
    # The Asterisk HTTP server may still be starting after configure-module
    ${output} =    Wait Until Keyword Succeeds    2 min    10 sec    Asterisk and trunks collectors are up
    Should Contain    ${output}    asterisk_core_uptime_seconds
    Should Contain    ${output}    \# TYPE asterisk_endpoints_state gauge
    Should Contain    ${output}    \# HELP nethvoice_trunk_endpoint_state
    Should Contain    ${output}    \# TYPE nethvoice_trunk_endpoint_state gauge
    Should Contain    ${output}    \# HELP nethvoice_trunk_registration_up
    Should Contain    ${output}    \# TYPE nethvoice_trunk_registration_up gauge
    Should Contain    ${output}    \# HELP nethvoice_trunk_qualify_up
    Should Contain    ${output}    \# TYPE nethvoice_trunk_qualify_up gauge
    # Only the asterisk_ families of the Asterisk page are forwarded
    Should Not Match Regexp    ${output}    (?m)^(# (HELP|TYPE) )?(process|python)_

IP trunk state is exported
    [Teardown]    Remove the test trunk
    Run SQL    @{TRUNK_SQL}
    Reload FreePBX
    ${output} =    Wait Until Keyword Succeeds    1 min    5 sec
    ...    Export should contain    nethvoice_trunk_endpoint_state{trunk="${TRUNK_NAME}",via_proxy="false",registration="none"}
    Should Not Contain    ${output}    nethvoice_trunk_registration_up{trunk="${TRUNK_NAME}"}
    # Nobody answers the OPTIONS sent to 192.0.2.10
    Wait Until Keyword Succeeds    2 min    5 sec
    ...    Export should contain    nethvoice_trunk_qualify_up{trunk="${TRUNK_NAME}"} 0

Removed trunk is not exported
    ${output}    ${rc} =    Execute Command    runagent -m ${module_id} export-metrics    return_rc=True
    Should Be Equal As Integers    ${rc}    0
    Should Contain    ${output}    nethvoice_exporter_collector_up{collector="trunks"} 1
    Should Not Contain    ${output}    nethvoice_trunk_endpoint_state{trunk="${TRUNK_NAME}"
    Should Not Contain    ${output}    nethvoice_trunk_qualify_up{trunk="${TRUNK_NAME}"}

Publishing unchanged rules sends no event
    ${output}    ${rc} =    Execute Command    runagent -m ${module_id} publish-metrics-config    return_stdout=False    return_stderr=True    return_rc=True
    Should Be Equal As Integers    ${rc}    0
    Should Contain    ${output}    alert rules unchanged

Disabling alerts removes the rules
    Run task    module/${module_id}/set-alerts    {"alerts_enabled": false}    decode_json=False
    ${output}    ${rc} =    Execute Command    runagent redis-exec HKEYS module/${module_id}/metrics_alert_rules    return_rc=True
    Should Be Equal As Integers    ${rc}    0
    Should Not Contain    ${output}    nethvoice-
    # Metrics are still exported
    ${output}    ${rc} =    Execute Command    runagent -m ${module_id} export-metrics    return_rc=True
    Should Be Equal As Integers    ${rc}    0
    Should Contain    ${output}    nethvoice_exporter_collector_up{collector="systemd"} 1

*** Keywords ***
Asterisk and trunks collectors are up
    ${output}    ${rc} =    Execute Command    runagent -m ${module_id} export-metrics    return_rc=True
    Should Be Equal As Integers    ${rc}    0
    Should Contain    ${output}    nethvoice_exporter_collector_up{collector="asterisk"} 1
    # Needs PROXY_IP, set by configure-module when nethvoice-proxy is installed
    Should Contain    ${output}    nethvoice_exporter_collector_up{collector="trunks"} 1
    RETURN    ${output}

Export should contain
    [Arguments]    ${line}
    ${output}    ${rc} =    Execute Command    runagent -m ${module_id} export-metrics    return_rc=True
    Should Be Equal As Integers    ${rc}    0
    Should Contain    ${output}    ${line}
    RETURN    ${output}

Run SQL
    [Arguments]    @{statements}
    ${sql} =    Catenate    @{statements}
    ${stderr}    ${rc} =    Execute Command
    ...    runagent -m ${module_id} podman exec mariadb sh -c 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb -uroot asterisk -e "$1"' sh "${sql}"
    ...    return_stdout=False    return_stderr=True    return_rc=True
    Should Be Equal As Integers    ${rc}    0    ${stderr}

Reload FreePBX
    ${stderr}    ${rc} =    Execute Command
    ...    runagent -m ${module_id} podman exec --user asterisk freepbx fwconsole reload --no-interaction
    ...    return_stdout=False    return_stderr=True    return_rc=True
    Should Be Equal As Integers    ${rc}    0    ${stderr}

Remove the test trunk
    Run SQL    DELETE FROM pjsip WHERE id = '${TRUNK_ID}';    DELETE FROM trunks WHERE trunkid = ${TRUNK_ID};
    Reload FreePBX
