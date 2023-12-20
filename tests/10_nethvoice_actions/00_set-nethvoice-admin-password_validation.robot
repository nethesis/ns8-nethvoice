*** Settings ***
Library   SSHLibrary
Resource  ../api.resource

*** Test Cases ***
Input can't be empty
    ${response} =  Run task    module/${module_id}/set-nethvoice-admin-password
    ...    {}    rc_expected=10    decode_json=False
