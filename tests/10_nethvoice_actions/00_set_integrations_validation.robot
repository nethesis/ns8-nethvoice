*** Settings ***
Library   SSHLibrary
Resource  ../api.resource

*** Test Cases ***
Input can't be empty
    ${response} =  Run task    module/${module_id}/set-integrations
    ...    {}    rc_expected=10    decode_json=False

Invalid boolean value
    ${response} =  Run task    module/${module_id}/set-integrations
    ...    {"satellite_call_transcription_enabled": "NotABoolean"}    rc_expected=10    decode_json=False
    ${response} =  Run task    module/${module_id}/set-integrations
    ...    {"satellite_voicemail_transcription_enabled": "123"}    rc_expected=10    decode_json=False

Invalid API key formats
    ${response} =  Run task    module/${module_id}/set-integrations
    ...    {"deepgram_api_key": 1234}    rc_expected=10    decode_json=False
    ${response} =  Run task    module/${module_id}/set-integrations
    ...    {"openai_api_key": true}    rc_expected=10    decode_json=False
