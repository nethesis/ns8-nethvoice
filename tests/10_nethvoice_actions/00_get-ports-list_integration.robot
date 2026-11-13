*** Settings ***
Library   SSHLibrary
Library   Collections
Resource  ../api.resource

*** Test Cases ***
Check get-ports-list action output
    ${response} =  Run task    module/${module_id}/get-ports-list
    ...    {}    rc_expected=0

Check the video gateway ICE ports are listed and opened
    ${response} =  Run task    module/${module_id}/get-ports-list    {}
    ${ports} =    Evaluate    {p['name']: p for p in $response}
    Dictionary Should Contain Key    ${ports}    Video gateway ICE (UDP)
    Dictionary Should Contain Key    ${ports}    Video gateway ICE (TCP)
    Should Be Equal    ${ports['Video gateway ICE (UDP)']['protocol']}    udp
    Should Be Equal    ${ports['Video gateway ICE (TCP)']['protocol']}    tcp
    ${udp} =    Set Variable    ${ports['Video gateway ICE (UDP)']['port']}
    ${tcp} =    Set Variable    ${ports['Video gateway ICE (TCP)']['port']}
    ${firewall} =    Execute Command    firewall-cmd --permanent --service=${module_id} --get-ports
    Should Contain    ${firewall}    ${udp}/udp
    Should Contain    ${firewall}    ${tcp}/tcp

Check the ICE UDP port is outside the RTP block
    ${env} =    Execute Command    runagent -m ${module_id} env
    ${range} =    Evaluate    [l.split('=', 1)[1] for l in $env.splitlines() if l.startswith('UDP_PORTS_RANGE=')][0]
    ${ice} =    Evaluate    int([l.split('=', 1)[1] for l in $env.splitlines() if l.startswith('MEDIAMTX_ICE_UDP_PORT=')][0])
    ${bounds} =    Evaluate    [int(x) for x in $range.split('-')]
    ${size} =    Evaluate    $bounds[1] - $bounds[0] + 1
    Should Be Equal As Integers    ${size}    1000
    Should Be True    not ($bounds[0] <= $ice <= $bounds[1])
