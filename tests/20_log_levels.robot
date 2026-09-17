*** Settings ***
Library    SSHLibrary

*** Keywords ***
Environment should contain
    [Arguments]    ${line}
    ${rc} =    Execute Command    runagent -m ${module_id} grep -qx '${line}' environment
    ...    return_stdout=False    return_rc=True
    Should Be Equal As Integers    ${rc}    0    '${line}' missing from the module environment

Container environment should be
    [Arguments]    ${container}    ${name}    ${value}
    ${output} =    Execute Command    runagent -m ${module_id} podman exec ${container} printenv ${name}
    Should Be Equal    ${output}    ${value}
    ...    ${container} does not carry ${name}=${value}

Set environment value and restart
    [Arguments]    ${name}    ${value}    ${service}
    Execute Command    runagent -m ${module_id} sed -i 's/^${name}=.*/${name}=${value}/' environment
    ...    return_stdout=False
    Execute Command    runagent -m ${module_id} systemctl --user restart ${service}    return_stdout=False

Restore tancredi log level
    Set environment value and restart    TANCREDI_LOG_LEVEL    WARNING    tancredi
    Wait Until Keyword Succeeds    60s    5s
    ...    Container environment should be    tancredi    TANCREDI_LOG_LEVEL    WARNING

Restore satellite log level
    Set environment value and restart    SATELLITE_LOG_LEVEL    WARNING    satellite
    Wait Until Keyword Succeeds    120s    5s
    ...    Container environment should be    satellite    LOG_LEVEL    WARNING

*** Test Cases ***
The module environment carries the quiet log levels
    Environment should contain    JANUS_DEBUG_LEVEL=3
    Environment should contain    TANCREDI_LOG_LEVEL=WARNING
    Environment should contain    FREEPBX_LOG_LEVEL=warn
    Environment should contain    SATELLITE_LOG_LEVEL=WARNING
    Environment should contain    NETHVOICE_MIDDLEWARE_GIN_MODE=release
    Environment should contain    REPORTS_GIN_MODE=release

The containers receive their log level
    # nethcti-middleware starts only after the freepbx wizard is complete
    # after an update 80restart defers satellite, so its value can be stale
    Execute Command    runagent -m ${module_id} systemctl --user restart nethcti-middleware satellite
    ...    return_stdout=False
    Container environment should be    tancredi      TANCREDI_LOG_LEVEL    WARNING
    Container environment should be    freepbx       FREEPBX_LOG_LEVEL     warn
    Container environment should be    reports-api   GIN_MODE              release
    Wait Until Keyword Succeeds    120s    5s
    ...    Container environment should be    satellite    LOG_LEVEL    WARNING
    Wait Until Keyword Succeeds    120s    5s
    ...    Container environment should be    nethcti-middleware    GIN_MODE    release

Raising the tancredi level reaches its container
    [Teardown]    Restore tancredi log level
    Set environment value and restart    TANCREDI_LOG_LEVEL    DEBUG    tancredi
    Wait Until Keyword Succeeds    60s    5s
    ...    Container environment should be    tancredi    TANCREDI_LOG_LEVEL    DEBUG

Raising the satellite level reaches its container
    [Teardown]    Restore satellite log level
    Set environment value and restart    SATELLITE_LOG_LEVEL    INFO    satellite
    Wait Until Keyword Succeeds    120s    5s
    ...    Container environment should be    satellite    LOG_LEVEL    INFO
