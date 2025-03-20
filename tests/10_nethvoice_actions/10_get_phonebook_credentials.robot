*** Settings ***
Library   SSHLibrary
Resource  ../api.resource

*** Test Cases ***
Check get-phonebook-credentials action output
    ${response} =  Run task    module/${module_id}/get-phonebook-credentials    {}
    Should Be Equal As Strings    ${response['database']}    phonebook
    Should Be Equal As Strings    ${response['user']}    pbookuser
