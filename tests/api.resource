*** Settings ***
Library    SSHLibrary

*** Variables ***
${VOICE_HOST}    voice.ns8.local
${CTI_HOST}    cti.ns8.local
${RENAMED_VOICE_HOST}    voice-renamed.ns8.local
${LEGACY_VOICE_HOST}    legacyvoice.ns8.local
${LEGACY_CTI_HOST}    legacycti.ns8.local

*** Keywords ***
Run task
    [Arguments]    ${action}    ${input}    ${decode_json}=${TRUE}    ${rc_expected}=0
    ${stdout}    ${stderr}    ${rc} =     Execute Command    api-cli run ${action} --data '${input}'    return_stdout=True    return_stderr=True    return_rc=True
    Should Be Equal As Integers    ${rc_expected}    ${rc}    Run task ${action} failed!${\n}${stderr}
    IF    ${decode_json} and len($stdout) > 0
        ${response} =    Evaluate    json.loads('''${stdout}''')    modules=json
    ELSE
        ${response} =    Set Variable    ${stdout}
    END
    RETURN    ${response}
