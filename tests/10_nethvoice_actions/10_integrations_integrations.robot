*** Settings ***
Library    SSHLibrary
Resource  ../api.resource

*** Test Cases ***
Check default integrations configuration
    ${response} =  Run task    module/${module_id}/get-integrations    {}
    Should Be Equal    ${response['satellite_call_transcription_enabled']}    ${False}
    Should Be Equal    ${response['satellite_voicemail_transcription_enabled']}    ${False}
    Should Be Equal As Strings    ${response['deepgram_api_key']}    ${EMPTY}
    Should Be Equal As Strings    ${response['openai_api_key']}    ${EMPTY}

Set integrations configuration
    ${response} =  Run task    module/${module_id}/set-integrations
    ...    {"satellite_call_transcription_enabled": true, "satellite_voicemail_transcription_enabled": true, "deepgram_api_key": "deepgramkey123", "openai_api_key": "openaikey-123"}
    ...    decode_json=False
    ${response} =  Run task    module/${module_id}/get-integrations    {}
    Should Be Equal    ${response['satellite_call_transcription_enabled']}    ${True}
    Should Be Equal    ${response['satellite_voicemail_transcription_enabled']}    ${True}
    Should Be Equal As Strings    ${response['deepgram_api_key']}    deepgramkey123
    Should Be Equal As Strings    ${response['openai_api_key']}    openaikey-123

Disable integrations configuration
    ${response} =  Run task    module/${module_id}/set-integrations
    ...    {"satellite_call_transcription_enabled": false, "satellite_voicemail_transcription_enabled": false, "deepgram_api_key": "", "openai_api_key": ""}
    ...    decode_json=False
    ${response} =  Run task    module/${module_id}/get-integrations    {}
    Should Be Equal    ${response['satellite_call_transcription_enabled']}    ${False}
    Should Be Equal    ${response['satellite_voicemail_transcription_enabled']}    ${False}

Partial update integrations configuration
    ${response} =  Run task    module/${module_id}/set-integrations
    ...    {"satellite_call_transcription_enabled": true}
    ...    decode_json=False
    ${response} =  Run task    module/${module_id}/get-integrations    {}
    Should Be Equal    ${response['satellite_call_transcription_enabled']}    ${True}
    Should Be Equal    ${response['satellite_voicemail_transcription_enabled']}    ${False}
    Should Be Equal As Strings    ${response['deepgram_api_key']}    ${EMPTY}
    Should Be Equal As Strings    ${response['openai_api_key']}    ${EMPTY}
