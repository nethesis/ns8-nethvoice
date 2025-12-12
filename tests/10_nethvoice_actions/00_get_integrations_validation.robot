*** Settings ***
Library   SSHLibrary
Resource  ../api.resource

*** Test Cases ***
Check Integrations configuration retrieval
    ${response} =  Run task    module/${module_id}/get-integrations    {}
    ...    rc_expected=0
