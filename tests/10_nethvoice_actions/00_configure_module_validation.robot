*** Settings ***
Library   SSHLibrary
Resource  ../api.resource

*** Test Cases ***
Input can't be empty
    ${response} =  Run task    module/${module_id}/configure-module
    ...    {}    rc_expected=10    decode_json=False

Timezone must be part of the accepted list
    ${response} =  Run task    module/${module_id}/configure-module
    ...    {"nethvoice_host": "voice.ns8.local", "nethcti_ui_host": "cti.ns8.local", "user_domain": "${users_domain}", "reports_international_prefix": "+39", "timezone": "Mars/Phobos"}
    ...    rc_expected=2    decode_json=False
    Should Contain    ${response}    timezone_not_available
