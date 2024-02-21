*** Settings ***
Library    SSHLibrary
Resource  ../api.resource

*** Test Cases ***
Check if the factc are returned as expected
    ${response} =  Run task    module/${module_id}/get-facts    {}
    Should Be Equal As Integers    ${response['nethvoice_users_count']}    0
    Should Be Equal As Integers    ${response['nethvoice_mobile_users_count']}    0

