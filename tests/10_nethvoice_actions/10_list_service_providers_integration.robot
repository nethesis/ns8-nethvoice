*** Settings ***
Library    SSHLibrary
Resource    ../api.resource

*** Test Cases ***
Check if the SIP service provider are returned as expected
    ${response} =  Run task    module/${module_id}/list-service-providers
    ...    {"service":"sip","transport":"udp","filter":{"node":"1","module_id":"${module_id}"}}
    Length Should Be    ${response}    1

Check if the Phonebook service provider are returned as expected
    ${response} =  Run task    module/${module_id}/list-service-providers
    ...    {"service":"phonebook","transport":"tcp","filter":{"node":"1","module_id":"${module_id}"}}
    Length Should Be    ${response}    1
