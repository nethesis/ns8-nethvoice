*** Settings ***
Library    SSHLibrary
Resource   ../api.resource

*** Test Cases ***
Check if systemd exporter target is published
    ${systemd_exporter_port} =    Get Module Environment Value    NETHVOICE_SYSTEMD_EXPORTER_PORT
    ${node_id} =                  Get Module Runtime Value        NODE_ID
    ${node_vpn_ip} =              Execute Command    redis-cli --raw HGET node/${node_id}/vpn ip_address
    Should Not Be Empty           ${node_vpn_ip}

    Should Match Regexp           ${systemd_exporter_port}    ^[0-9]+$
    Should Match Regexp           ${node_id}    ^[0-9]+$

    ${target_yaml} =              Execute Command    redis-cli --raw HGET module/${module_id}/metrics_targets systemd
    Should Not Be Empty           ${target_yaml}
    Should Contain                ${target_yaml}    - targets:
    Should Contain                ${target_yaml}    "${node_vpn_ip}:${systemd_exporter_port}"
    Should Contain                ${target_yaml}    node: "${node_id}"
    Should Not Contain            ${target_yaml}    __metrics_path__
    Should Not Contain            ${target_yaml}    module_id:
    Should Not Contain            ${target_yaml}    target_type:

Check if systemd exporter returns user session metrics
    ${systemd_exporter_port} =    Get Module Environment Value    NETHVOICE_SYSTEMD_EXPORTER_PORT
    ${metrics} =                  Wait Until Keyword Succeeds
    ...                           30x
    ...                           10s
    ...                           Fetch systemd exporter metrics
    ...                           ${systemd_exporter_port}
    Should Contain                ${metrics}    \# HELP
    Should Contain                ${metrics}    systemd_exporter_build_info
    Should Match Regexp           ${metrics}    (?m)^systemd_unit_state\\{.*name="freepbx\\.service"
    Should Not Match Regexp       ${metrics}    (?m)^systemd_unit_state\\{.*name="systemd-journald\\.service"

*** Keywords ***
Get Module Environment Value
    [Arguments]    ${name}
    ${value} =    Execute Command
    ...    runagent -m ${module_id} sh -lc 'key="$1"; sed -n "s/^$key=//p" "$AGENT_STATE_DIR/environment" | tail -1' sh ${name}
    Should Not Be Empty    ${value}
    RETURN    ${value}

Get Module Runtime Value
    [Arguments]    ${name}
    ${value} =    Execute Command
    ...    runagent -m ${module_id} sh -lc 'key="$1"; printenv "$key"' sh ${name}
    Should Not Be Empty    ${value}
    RETURN    ${value}

Fetch systemd exporter metrics
    [Arguments]    ${port}
    ${metrics}    ${stderr}    ${rc} =    Execute Command
    ...    curl --fail --silent --show-error --max-time 10 http://127.0.0.1:${port}/metrics
    ...    return_stdout=True
    ...    return_stderr=True
    ...    return_rc=True
    Should Be Equal As Integers    ${rc}    0    ${stderr}
    RETURN    ${metrics}
