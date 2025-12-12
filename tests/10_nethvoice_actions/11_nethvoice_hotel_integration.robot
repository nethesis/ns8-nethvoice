*** Settings ***
Library    SSHLibrary
Resource  ../api.resource

*** Test Cases ***
Check if nethvoice hotel can be configured correctly
    ${response} =  Run task    module/${module_id}/set-nethvoice-hotel
    ...    {"nethvoice_hotel": true, "nethvoice_hotel_fias_address": "192.168.1.10", "nethvoice_hotel_fias_port": 5000}
    ...    decode_json=False 
    ${response} =  Run task    module/${module_id}/get-nethvoice-hotel    {}
    Should Be Equal As Strings    ${response['nethvoice_hotel']}    True
    Should Be Equal As Strings    ${response['nethvoice_hotel_fias_address']}    192.168.1.10
    Should Be Equal As Strings    ${response['nethvoice_hotel_fias_port']}    5000

Check if nethvoice hotel can be disabled
    ${response} =  Run task    module/${module_id}/set-nethvoice-hotel
    ...    {"nethvoice_hotel": false, "nethvoice_hotel_fias_address": "", "nethvoice_hotel_fias_port": ""}
    ...    decode_json=False
    ${response} =  Run task    module/${module_id}/get-nethvoice-hotel    {}
    Should Be Equal As Strings    ${response['nethvoice_hotel']}    False
