*** Settings ***
Library    SSHLibrary

*** Test Cases ***
Check if nethvoice is installed correctly
    ${output}  ${rc} =    Execute Command    add-module ${IMAGE_URL} 1
    ...    return_rc=True
    Should Be Equal As Integers    ${rc}  0
    &{output} =    Evaluate    ${output}
    Set Global Variable    ${module_id}    ${output.module_id}
    # Fixture mutations below may only use the instance allocated by this suite.
    Set Global Variable    ${hostname_test_module_id}    ${output.module_id}
    ${traefik_agent} =    Execute Command    runagent -m ${module_id} python3 -c 'import agent; print(agent.resolve_agent_id("traefik@node"))'
    Should Start With    ${traefik_agent}    module/traefik
    Set Global Variable    ${traefik_agent}
