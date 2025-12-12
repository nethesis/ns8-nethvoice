*** Settings ***
Library    SSHLibrary
Resource  ../api.resource

*** Test Cases ***
Check if nethvoice can be configured correctly
    ${response} =  Run task    module/${module_id}/configure-module
    ...    {"nethvoice_host": "voice.ns8.local", "nethcti_ui_host": "cti.ns8.local", "user_domain": "${users_domain}", "reports_international_prefix": "+39", "nethvoice_adm_username": "${nv_domain_admin}", "nethvoice_adm_password": "${nv_domain_admin_password}", "lets_encrypt": false }
    ...    decode_json=False

Check if nethvoice is configured as expected
    ${response} =  Run task    module/${module_id}/get-configuration    {}
    Should Be Equal As Strings    ${response['nethvoice_host']}    voice.ns8.local
    Should Be Equal As Strings    ${response['nethcti_ui_host']}    cti.ns8.local
    Should Be Equal As Strings    ${response['user_domain']}    ${users_domain}
    Should Be Equal As Strings    ${response['reports_international_prefix']}    +39
    Should Be Equal As Strings    ${response['nethvoice_adm_username']}    ${nv_domain_admin}
    Should Be Equal As Strings    ${response['nethvoice_adm_password']}    ${nv_domain_admin_password}
    Should Be Equal As Strings    ${response['lets_encrypt']}    False
Check if the password can be changed
    ${response} =  Run task    module/${module_id}/set-nethvoice-admin-password   
    ...    {"nethvoice_admin_password": "Nethesis,1234"}

Check if the route on nethvoice-proxy is created correctly
    ${response} =  Run task    module/${module_id}/list-service-providers
    ...    {"service": "sip", "transport": "tcp", "filter": {"module_id": "${proxy_module_id}"} }
    ${proxy_addr} =  Set Variable   ${response[0]['host']}
    ${response} =  Run task    module/${proxy_module_id}/get-route
    ...    {"domain": "voice.ns8.local"}
    Should Contain    ${response['address'][0]['uri']}    ${proxy_addr}
