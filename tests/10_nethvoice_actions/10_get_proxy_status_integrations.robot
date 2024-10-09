*** Settings ***
Library   SSHLibrary
Resource  ../api.resource

*** Test Cases ***
Check get-proxy-status action output
    ${response} =  Run task    module/${module_id}/get-proxy-status    {}
    Should Be Equal As Strings    ${response['proxy_installed']}    True
