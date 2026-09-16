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

FIAS data cannot inject commands or SQL
    ${stdout}    ${stderr}    ${rc} =    Execute Command
    ...    runagent -m ${module_id} podman exec --user asterisk freepbx php /usr/share/neth-hotel-fias/tests/security_test.php
    ...    return_stdout=True
    ...    return_stderr=True
    ...    return_rc=True
    Should Be Equal As Integers    ${rc}    0    FIAS security regressions failed:${\n}${stderr}
    Should Contain    ${stdout}    ok - FIAS command and SQL injection regressions

FIAS processes run without root privileges
    ${stdout}    ${stderr}    ${rc} =    Execute Command
    ...    runagent -m ${module_id} podman exec freepbx php /usr/share/neth-hotel-fias/tests/process_user_test.php
    ...    return_stdout=True
    ...    return_stderr=True
    ...    return_rc=True
    Should Be Equal As Integers    ${rc}    0    Unable to inspect FIAS processes:${\n}${stderr}
    Should Contain    ${stdout}    ok - FIAS processes run as asterisk

Check if nethvoice hotel can be disabled
    ${response} =  Run task    module/${module_id}/set-nethvoice-hotel
    ...    {"nethvoice_hotel": false, "nethvoice_hotel_fias_address": "", "nethvoice_hotel_fias_port": ""}
    ...    decode_json=False
    ${response} =  Run task    module/${module_id}/get-nethvoice-hotel    {}
    Should Be Equal As Strings    ${response['nethvoice_hotel']}    False
