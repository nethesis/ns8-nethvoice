*** Settings ***
Library   SSHLibrary
Resource  ../api.resource

*** Test Cases ***
Check get-defaults action output
    ${probe_stdout}    ${probe_stderr}    ${probe_rc} =    Execute Command    test -d /usr/share/zoneinfo/posix    return_stdout=True    return_stderr=True    return_rc=True
    Pass Execution If    ${probe_rc} != 0    Skipping get-defaults validation on nodes without /usr/share/zoneinfo/posix.
    ${response} =  Run task    module/${module_id}/get-defaults
    ...    {}    rc_expected=0
