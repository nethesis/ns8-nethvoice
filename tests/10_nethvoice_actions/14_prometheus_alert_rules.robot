*** Settings ***
Library       SSHLibrary
Suite Setup   Require Module Alert Rules Test Environment

*** Variables ***
${RUN_METRICS_ALERT_RULES_E2E}    ${FALSE}

*** Test Cases ***
Check if metrics loads and scopes NethVoice service rules
    ${rules} =    Wait Until Keyword Succeeds    30x    10s    Read Loaded NethVoice Rules
    ${names} =    Evaluate    {rule["name"] for rule in $rules}
    Should Contain    ${names}    NethVoiceFreePBXDown
    Should Contain    ${names}    NethVoiceSystemdExporterDown
    FOR    ${rule}    IN    @{rules}
        Should Be Equal    ${rule}[health]    ok
        Should Be Equal    ${rule}[labels][severity]    critical
        Should Contain    ${rule}[query]    module_id="${module_id}"
        Should Be Equal As Numbers    ${rule}[duration]    300
    END

Check if a stopped service alerts and recovers
    [Teardown]    Start Monitored Service And Wait For Recovery    tancredi.service    NethVoiceTancrediDown
    Change Monitored Service State    stop    tancredi.service
    Wait Until Keyword Succeeds    30x    5s    NethVoice Alert State Should Be    NethVoiceTancrediDown    pending
    Wait Until Keyword Succeeds    45x    10s    NethVoice Alert State Should Be    NethVoiceTancrediDown    firing

Check if an exporter outage alerts and recovers
    [Teardown]    Start Monitored Service And Wait For Recovery    systemd-exporter.service    NethVoiceSystemdExporterDown
    Change Monitored Service State    stop    systemd-exporter.service
    Wait Until Keyword Succeeds    30x    5s    NethVoice Alert State Should Be    NethVoiceSystemdExporterDown    pending
    Wait Until Keyword Succeeds    45x    10s    NethVoice Alert State Should Be    NethVoiceSystemdExporterDown    firing
    ${rules} =    Read Loaded NethVoice Rules
    FOR    ${rule}    IN    @{rules}
        IF    $rule["name"] != "NethVoiceSystemdExporterDown"
            Should Be Equal    ${rule}[state]    inactive
        END
    END

*** Keywords ***
Require Module Alert Rules Test Environment
    ${enabled} =    Convert To Boolean    ${RUN_METRICS_ALERT_RULES_E2E}
    Skip If    not $enabled    Requires a disposable node with a compatible metrics module
    ${metrics_id} =    Execute Command    redis-cli --raw GET cluster/default_instance/metrics
    Should Not Be Empty    ${metrics_id}
    ${path} =    Execute Command    runagent -m ${metrics_id} printenv PROMETHEUS_PATH
    ${prefix} =    Evaluate    "/" + $path.strip("/") if $path.strip("/") else ""
    Set Suite Variable    ${PROMETHEUS_BASE_URL}    http://127.0.0.1:9091${prefix}
    FOR    ${unit}    IN    tancredi.service    systemd-exporter.service
        ${rc} =    Execute Command    runagent -m ${module_id} systemctl --user is-active --quiet ${unit}
        ...    return_stdout=False    return_rc=True
        Should Be Equal As Integers    ${rc}    0    ${unit} must be running before this test
    END

Read Loaded NethVoice Rules
    ${output}    ${rc} =    Execute Command
    ...    curl --fail --silent --show-error --max-time 10 ${PROMETHEUS_BASE_URL}/api/v1/rules
    ...    return_rc=True
    Should Be Equal As Integers    ${rc}    0
    ${rules} =    Evaluate    [rule for group in json.loads($output)["data"]["groups"] for rule in group["rules"] if rule.get("labels", {}).get("module_id") == $module_id]    modules=json
    Should Not Be Empty    ${rules}
    RETURN    ${rules}

NethVoice Alert State Should Be
    [Arguments]    ${name}    ${state}
    ${rules} =    Read Loaded NethVoice Rules
    ${matches} =    Evaluate    [rule for rule in $rules if rule["name"] == $name]
    Length Should Be    ${matches}    1
    Should Be Equal    ${matches}[0][health]    ok
    Should Be Equal    ${matches}[0][state]    ${state}

Change Monitored Service State
    [Arguments]    ${action}    ${unit}
    ${output}    ${stderr}    ${rc} =    Execute Command
    ...    runagent -m ${module_id} systemctl --user ${action} ${unit}
    ...    return_stderr=True    return_rc=True
    Should Be Equal As Integers    ${rc}    0    ${stderr}

Start Monitored Service And Wait For Recovery
    [Arguments]    ${unit}    ${alert}
    Change Monitored Service State    start    ${unit}
    Wait Until Keyword Succeeds    30x    5s    NethVoice Alert State Should Be    ${alert}    inactive
