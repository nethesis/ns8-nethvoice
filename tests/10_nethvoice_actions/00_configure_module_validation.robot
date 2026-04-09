*** Settings ***
Library   SSHLibrary
Resource  ../api.resource

*** Test Cases ***
Input can't be empty
    ${response} =  Run task    module/${module_id}/configure-module
    ...    {}    rc_expected=10    decode_json=False

Integrations settings must use dedicated action
    ${response} =  Run task    module/${module_id}/configure-module
    ...    {"nethvoice_host": "voice.ns8.local", "nethcti_ui_host": "cti.ns8.local", "user_domain": "${users_domain}", "reports_international_prefix": "+39", "satellite_call_transcription_enabled": true}
    ...    rc_expected=10    decode_json=False
