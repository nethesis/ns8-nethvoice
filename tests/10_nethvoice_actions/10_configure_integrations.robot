*** Settings ***
Library    SSHLibrary
Library    Collections
Resource  ../api.resource

*** Test Cases ***
Check if nethvoice can be configured correctly
    ${response} =  Run task    module/${module_id}/configure-module
    ...    {"nethvoice_host": "${{ $VOICE_HOST.title() }}", "nethcti_ui_host": "${{ $CTI_HOST.title() }}", "user_domain": "${users_domain}", "reports_international_prefix": "+39", "lets_encrypt": false }
    ...    decode_json=False

Check if nethvoice is configured as expected
    ${response} =  Run task    module/${module_id}/get-configuration    {}
    Should Be Equal As Strings    ${response['nethvoice_host']}    ${VOICE_HOST}
    Should Be Equal As Strings    ${response['nethcti_ui_host']}    ${CTI_HOST}
    Should Be Equal As Strings    ${response['user_domain']}    ${users_domain}
    Should Be Equal As Strings    ${response['reports_international_prefix']}    +39
    Should Be Equal As Strings    ${response['lets_encrypt']}    False

    Dictionary Should Not Contain Key    ${response}    nethvoice_adm_username
    Dictionary Should Not Contain Key    ${response}    nethvoice_adm_password
    ${saved} =    Execute Command    runagent -m ${module_id} sh -c 'printf "%s\\n%s\\n" "$NETHVOICE_HOST" "$NETHCTI_UI_HOST"'
    Should Be Equal    ${saved}    ${VOICE_HOST}${\n}${CTI_HOST}
    ${routes} =    Run task    ${traefik_agent}/list-routes    {"expand_list":true}
    ${own_routes} =    Evaluate    [r for r in $routes if r['instance'].startswith('${module_id}-')]
    Length Should Be    ${own_routes}    13
    FOR    ${route}    IN    @{own_routes}
        Should Be True    $route['host'] in ('${VOICE_HOST}', '${CTI_HOST}')
    END

Omitting lets_encrypt preserves saved certificate settings
    [Tags]    hostname
    ${before} =    Run task    module/${module_id}/get-configuration    {}
    ${http_before} =    Run task    ${traefik_agent}/list-routes    {"expand_list":true}
    ${http_before} =    Evaluate    sorted($http_before, key=lambda route: route["instance"])
    ${certificate_before}    ${rc} =    Execute Command    bash -o pipefail -c 'timeout 15 openssl s_client -connect 127.0.0.1:443 -servername ${VOICE_HOST} </dev/null 2>/dev/null | openssl x509 -outform DER | sha256sum'    return_rc=True
    Should Be Equal As Integers    ${rc}    0
    Run task    module/${module_id}/configure-module
    ...    {"nethvoice_host":"${{ $VOICE_HOST.upper() }}","nethcti_ui_host":"${{ $CTI_HOST.upper() }}","user_domain":"${users_domain}","reports_international_prefix":"+39"}
    ...    decode_json=False
    ${after} =    Run task    module/${module_id}/get-configuration    {}
    Should Be Equal    ${after}[lets_encrypt]    ${before}[lets_encrypt]
    ${http_after} =    Run task    ${traefik_agent}/list-routes    {"expand_list":true}
    ${http_after} =    Evaluate    sorted($http_after, key=lambda route: route["instance"])
    Should Be Equal    ${http_after}    ${http_before}
    ${certificate_after}    ${rc} =    Execute Command    bash -o pipefail -c 'timeout 15 openssl s_client -connect 127.0.0.1:443 -servername ${VOICE_HOST} </dev/null 2>/dev/null | openssl x509 -outform DER | sha256sum'    return_rc=True
    Should Be Equal As Integers    ${rc}    0
    Should Be Equal    ${certificate_after}    ${certificate_before}

Check if the password can be changed
    ${response} =  Run task    module/${module_id}/set-nethvoice-admin-password   
    ...    {"nethvoice_admin_password": "Nethesis,1234"}

Check if the route on nethvoice-proxy is created correctly
    ${response} =  Run task    module/${module_id}/list-service-providers
    ...    {"service": "sip", "transport": "tcp", "filter": {"module_id": "${proxy_module_id}"} }
    ${proxy_addr} =  Set Variable   ${response[0]['host']}
    ${response} =  Run task    module/${proxy_module_id}/get-route
    ...    {"domain": "${VOICE_HOST}"}
    Should Contain    ${response['address'][0]['uri']}    ${proxy_addr}
