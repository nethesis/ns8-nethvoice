*** Settings ***
Library   SSHLibrary
Resource  ../api.resource

*** Test Cases ***
Check get-defaults action output
    ${response} =  Run task    module/${module_id}/get-defaults
    ...    {}    rc_expected=0
