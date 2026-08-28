*** Settings ***
Library    SSHLibrary

*** Test Cases ***
Check if nethvoice is installed correctly
    ${output}  ${rc} =    Execute Command    add-module ${IMAGE_URL} 1
    ...    return_rc=True
    Should Be Equal As Integers    ${rc}  0
    &{output} =    Evaluate    ${output}
    Set Global Variable    ${module_id}    ${output.module_id}

Check if systemd exporter starts before configuration
    ${status}  ${rc} =    Execute Command
    ...    runagent -m ${module_id} systemctl --user is-active systemd-exporter.service
    ...    return_rc=True
    Should Be Equal As Integers    ${rc}    0
    Should Be Equal               ${status}    active
