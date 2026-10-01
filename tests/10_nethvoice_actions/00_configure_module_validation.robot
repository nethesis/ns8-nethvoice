*** Settings ***
Library   SSHLibrary
Resource  ../api.resource

*** Test Cases ***
Input can't be empty
    ${response} =  Run task    module/${module_id}/configure-module
    ...    {}    rc_expected=10    decode_json=False

Timezone must be part of the accepted list
    ${response} =  Run task    module/${module_id}/configure-module
    ...    {"nethvoice_host": "voice.ns8.local", "nethcti_ui_host": "cti.ns8.local", "user_domain": "${users_domain}", "reports_international_prefix": "+39", "timezone": "Mars/Phobos"}
    ...    rc_expected=2    decode_json=False
    Should Contain    ${response}    timezone_not_available

Matching hostnames are rejected before configuration or routes change
    [Tags]    hostname
    ${before} =    Run task    module/${module_id}/get-configuration    {}
    ${environment_before} =    Execute Command    runagent -m ${module_id} sha256sum environment
    ${http_before} =    Run task    ${traefik_agent}/list-routes    {"expand_list":true}
    ${sip_before}    ${rc} =    Execute Command    runagent -m ${proxy_module_id} podman exec postgres sh -c 'psql -tA -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB" -c "TABLE nethvoice_proxy_routes; TABLE dispatcher; TABLE domain; TABLE dialplan;"'    return_rc=True
    Should Be Equal As Integers    ${rc}    0
    FOR    ${cti}    IN    Same.ns8.local    sAME.NS8.LOCAL
        ${errors} =    Run task    module/${module_id}/configure-module
        ...    {"nethvoice_host":"Same.ns8.local","nethcti_ui_host":"${cti}","user_domain":"${users_domain}","reports_international_prefix":"+39","lets_encrypt":false}
        ...    rc_expected=2
        Length Should Be    ${errors}    2
        ${fields} =    Evaluate    sorted(e['field'] for e in $errors if e['error'] == 'same_host')
        Should Be Equal    ${fields}    ${{ ['nethcti_ui_host', 'nethvoice_host'] }}
        ${after} =    Run task    module/${module_id}/get-configuration    {}
        Should Be Equal    ${after}    ${before}
        ${environment_after} =    Execute Command    runagent -m ${module_id} sha256sum environment
        Should Be Equal    ${environment_after}    ${environment_before}
        ${http_after} =    Run task    ${traefik_agent}/list-routes    {"expand_list":true}
        Should Be Equal    ${http_after}    ${http_before}
        ${sip_after}    ${rc} =    Execute Command    runagent -m ${proxy_module_id} podman exec postgres sh -c 'psql -tA -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB" -c "TABLE nethvoice_proxy_routes; TABLE dispatcher; TABLE domain; TABLE dialplan;"'    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        Should Be Equal    ${sip_after}    ${sip_before}
    END
