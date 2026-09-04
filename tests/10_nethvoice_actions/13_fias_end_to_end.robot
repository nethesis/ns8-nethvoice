*** Settings ***
Library     SSHLibrary
Library     ./FiasEndToEnd.py


*** Variables ***
${RUN_FIAS_E2E}    False
${SCENARIO}        manual


*** Test Cases ***
Complete isolated FIAS protocol and command test
    [Tags]    fias    e2e    manual
    Skip If    '${RUN_FIAS_E2E}'.lower() not in ('1', 'true', 'yes', 'on')
    ${report} =    Run Fias End To End    ${module_id}    ${SCENARIO}    ${OUTPUT DIR}
    Should Be Equal    ${report['status']}    PASS
    Should Be True    ${report['commands_tested']} >= 28
    Should Be Equal    ${report['cleanup']['fixture rows']}    PASS
    Should Be Equal    ${report['cleanup']['Asterisk state']}    PASS
    Should Be Equal    ${report['cleanup']['transport databases']}    PASS
    Should Be Equal    ${report['cleanup']['runtime secrets']}    PASS
