*** Settings ***
Library    SSHLibrary
Resource   ../api.resource

*** Test Cases ***
Check if systemd exporter target is published
    ${metrics_path} =             Get Module Environment Value    SYSTEMD_EXPORTER_PROMETHEUS_PATH
    ${systemd_exporter_port} =    Get Module Environment Value    NETHVOICE_SYSTEMD_EXPORTER_PORT
    ${node_id} =                  Get Module Runtime Value        NODE_ID
    ${node_vpn_ip} =              Execute Command    redis-cli --raw HGET node/${node_id}/vpn ip_address
    Should Not Be Empty           ${node_vpn_ip}

    Should Match Regexp           ${metrics_path}    ^/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$
    Should Match Regexp           ${systemd_exporter_port}    ^[0-9]+$
    Should Match Regexp           ${node_id}    ^[0-9]+$

    ${target_yaml} =              Execute Command    redis-cli --raw HGET module/${module_id}/metrics_targets systemd
    Should Not Be Empty           ${target_yaml}
    Should Contain                ${target_yaml}    - targets:
    Should Contain                ${target_yaml}    "${node_vpn_ip}:${systemd_exporter_port}"
    Should Contain                ${target_yaml}    node: "${node_id}"
    Should Contain                ${target_yaml}    __metrics_path__: "${metrics_path}"
    Should Not Contain            ${target_yaml}    module_id:
    Should Not Contain            ${target_yaml}    target_type:

Check if systemd exporter returns user session metrics
    ${metrics_path} =             Get Module Environment Value    SYSTEMD_EXPORTER_PROMETHEUS_PATH
    ${systemd_exporter_port} =    Get Module Environment Value    NETHVOICE_SYSTEMD_EXPORTER_PORT
    ${unit_include} =             Get Module Environment Value    SYSTEMD_EXPORTER_UNIT_INCLUDE
    ${unit_exclude} =             Get Module Environment Value    SYSTEMD_EXPORTER_UNIT_EXCLUDE
    Should Be Equal               ${unit_include}    .*
    Should Be Equal               ${unit_exclude}    .*[.](device|mount|scope|slice|swap|target)$
    ${metrics} =                  Wait Until Keyword Succeeds
    ...                           30x
    ...                           10s
    ...                           Fetch systemd exporter metrics
    ...                           ${systemd_exporter_port}
    ...                           ${metrics_path}
    Should Contain                ${metrics}    \# HELP
    Should Match Regexp           ${metrics}    (?m)^systemd_unit_state\\{.*name="freepbx\\.service"
    Should Not Match Regexp       ${metrics}    (?m)^go_
    Should Not Match Regexp       ${metrics}    (?m)^process_
    Should Not Match Regexp       ${metrics}    (?m)^promhttp_
    Should Not Match Regexp       ${metrics}    (?m)^systemd_unit_state\\{.*name="[^"]+\\.(device|mount|scope|slice|swap|target)"
    Should Not Match Regexp       ${metrics}    (?m)^systemd_unit_state\\{.*name="systemd-journald\\.service"

Check if systemd exporter unit filters are applied
    [Teardown]                    Restore Default systemd exporter filters
    ${metrics_path} =             Get Module Environment Value    SYSTEMD_EXPORTER_PROMETHEUS_PATH
    ${systemd_exporter_port} =    Get Module Environment Value    NETHVOICE_SYSTEMD_EXPORTER_PORT
    Set systemd exporter filters
    ...                           systemd-exporter[.]service|freepbx[.]service
    ...                           freepbx[.]service
    Restart systemd exporter
    ${metrics} =                  Wait Until Keyword Succeeds
    ...                           30x
    ...                           10s
    ...                           Fetch systemd exporter metrics
    ...                           ${systemd_exporter_port}
    ...                           ${metrics_path}
    Should Match Regexp           ${metrics}    (?m)^systemd_unit_state\\{.*name="systemd-exporter\\.service"
    Should Not Match Regexp       ${metrics}    (?m)^systemd_unit_state\\{.*name="freepbx\\.service"

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

Set systemd exporter filters
    [Arguments]    ${include}    ${exclude}
    ${stdout}    ${stderr}    ${rc} =    Execute Command
    ...    runagent -m ${module_id} python3 -c 'import agent, sys; agent.set_env(sys.argv[1], sys.argv[2]); agent.set_env(sys.argv[3], sys.argv[4])' SYSTEMD_EXPORTER_UNIT_INCLUDE '${include}' SYSTEMD_EXPORTER_UNIT_EXCLUDE '${exclude}'
    ...    return_stdout=True
    ...    return_stderr=True
    ...    return_rc=True
    Should Be Equal As Integers    ${rc}    0    ${stderr}

Restore Default systemd exporter filters
    Set systemd exporter filters    .*    .*[.](device|mount|scope|slice|swap|target)$
    Restart systemd exporter

Restart systemd exporter
    ${stdout}    ${stderr}    ${rc} =    Execute Command
    ...    runagent -m ${module_id} systemctl --user restart systemd-exporter.service
    ...    return_stdout=True
    ...    return_stderr=True
    ...    return_rc=True
    Should Be Equal As Integers    ${rc}    0    ${stderr}

Fetch systemd exporter metrics
    [Arguments]    ${port}    ${path}
    ${metrics}    ${stderr}    ${rc} =    Execute Command
    ...    curl --fail --silent --show-error --max-time 10 http://127.0.0.1:${port}${path}
    ...    return_stdout=True
    ...    return_stderr=True
    ...    return_rc=True
    Should Be Equal As Integers    ${rc}    0    ${stderr}
    RETURN    ${metrics}
