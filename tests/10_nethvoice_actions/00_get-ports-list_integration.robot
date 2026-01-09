*** Settings ***
Library   SSHLibrary
Resource  ../api.resource

*** Test Cases ***
Check get-ports-list action output
    ${response} =  Run task    module/${module_id}/get-ports-list
    ...    {}    rc_expected=0
