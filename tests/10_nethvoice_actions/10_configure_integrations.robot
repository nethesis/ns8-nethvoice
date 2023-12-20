*** Settings ***
Library    SSHLibrary
Resource  ../api.resource

*** Test Cases ***
Check if nethvoice can be configured correctly
    ${response} =  Run task    module/${module_id}/configure-module
    ...    {"nethvoice_host": "voice.ns8.local", "nethcti_ui_host": "cti.ns8.local", "user_domain": "${users_domain}", "reports_international_prefix": "+39", "lets_encrypt": false}
    ...    decode_json=False

Check if nethvoice is configured as expected
    ${response} =  Run task    module/${module_id}/get-configuration    {}
    Should Be Equal As Strings    ${response['nethvoice_host']}    voice.ns8.local
    Should Be Equal As Strings    ${response['nethcti_ui_host']}    cti.ns8.local
    Should Be Equal As Strings    ${response['user_domain']}    ${users_domain}
    Should Be Equal As Strings    ${response['reports_international_prefix']}    +39
    Should Be Equal As Strings    ${response['lets_encrypt']}    False

Check if the password can be changed
    ${response} =  Run task    module/${module_id}/set-nethvoice-admin-password   
    ...    {"nethvoice_admin_password": "Nethesis,1234"}
