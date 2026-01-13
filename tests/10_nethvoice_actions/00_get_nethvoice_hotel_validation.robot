*** Settings ***
Library   SSHLibrary
Resource  ../api.resource

*** Test Cases ***
Check NethVoice Hotel configuration retrieval
    ${response} =  Run task    module/${module_id}/get-nethvoice-hotel
    ...    {}    rc_expected=0
