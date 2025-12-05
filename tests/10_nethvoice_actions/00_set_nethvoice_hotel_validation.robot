*** Settings ***
Library   SSHLibrary
Resource  ../api.resource

*** Test Cases ***
Input can't be empty
    ${response} =  Run task    module/${module_id}/set-nethvoice-hotel
    ...    {}    rc_expected=10    decode_json=False

Invalid state value
    ${response} =  Run task    module/${module_id}/set-nethvoice-hotel
    ...    {"nethvoice_hotel": "invalid", "nethvoice_hotel_fias_address": "", "nethvoice_hotel_fias_port": ""}
    ...    rc_expected=10    decode_json=False

Invalid address value
    ${response} =  Run task    module/${module_id}/set-nethvoice-hotel
    ...    {"nethvoice_hotel": true, "nethvoice_hotel_fias_address": 12345, "nethvoice_hotel_fias_port": 5000}
    ...    rc_expected=10    decode_json=False

Invalid port value
    ${response} =  Run task    module/${module_id}/set-nethvoice-hotel
    ...    {"nethvoice_hotel": true, "nethvoice_hotel_fias_address": "", "nethvoice_hotel_fias_port": "invalid"}
    ...    rc_expected=10    decode_json=False
