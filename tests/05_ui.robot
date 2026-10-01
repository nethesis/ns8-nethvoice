*** Settings ***
Library    SSHLibrary
Resource    ./api.resource
Suite Teardown    Run Keyword And Ignore Error    Close Browser

*** Variables ***
${ADMIN_USER}    admin
${ADMIN_PASSWORD}    Nethesis,1234
${VOICE_INPUT}    iframe >>> input[placeholder*="voice.example.com"]
${CTI_INPUT}    iframe >>> input[placeholder*="cti.example.com"]
${VOICE_ERROR}    iframe >>> .bx--form-item:has(input[placeholder*="voice.example.com"]) .bx--form-requirement
${CTI_ERROR}    iframe >>> .bx--form-item:has(input[placeholder*="cti.example.com"]) .bx--form-requirement

*** Keywords ***

Login to cluster-admin
    New Page    https://${NODE_ADDR}/cluster-admin/
    Fill Text    text="Username"    ${ADMIN_USER}
    Click    button >> text="Continue"
    Fill Text    text="Password"    ${ADMIN_PASSWORD}
    Click    button >> text="Log in"
    Wait For Elements State    css=#main-content    visible    timeout=10s

*** Test Cases ***

Initial setup validates hostnames and saves lowercase routes
    [Tags]    ui    hostname
    [Documentation]    Real wizard interaction on the instance created by 01_nethvoice_add-module.
    Import Library    Browser
    New Browser    chromium    headless=True
    New Context    ignoreHTTPSErrors=True
    Login to cluster-admin
    Go To    https://${NODE_ADDR}/cluster-admin/#/apps/${module_id}
    Wait For Elements State    iframe >>> text="Use an existing account provider"    visible    timeout=60s
    Click    iframe >>> button >> text="Next"
    Wait For Elements State    iframe >>> input[readonly][placeholder*="proxy.example.org"]    visible    timeout=60s
    Click    iframe >>> button >> text="Next"
    Wait For Elements State    ${VOICE_INPUT}    visible    timeout=60s
    Fill Text    iframe >>> input[type="password"] >> nth=0    ${ADMIN_PASSWORD}
    Fill Text    iframe >>> input[type="password"] >> nth=1    ${ADMIN_PASSWORD}
    ${before} =    Run task    module/${module_id}/get-configuration    {}
    ${http_before} =    Run task    ${traefik_agent}/list-routes    {"expand_list":true}
    ${http_before} =    Evaluate    sorted($http_before, key=lambda route: route["instance"])
    ${sip_before}    ${rc} =    Execute Command    runagent -m ${proxy_module_id} podman exec postgres sh -c 'psql -tA -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB" -c "SELECT * FROM nethvoice_proxy_routes ORDER BY setid; SELECT * FROM dispatcher ORDER BY id; SELECT * FROM domain ORDER BY id; SELECT * FROM dialplan ORDER BY id;"'    return_rc=True
    Should Be Equal As Integers    ${rc}    0
    FOR    ${voice}    ${cti}    IN    ${EMPTY}    cti.ns8.local    voice.ns8.local    ${EMPTY}    ${EMPTY}    ${EMPTY}    Same.ns8.local    Same.ns8.local    Same.ns8.local    sAME.ns8.local
        Fill Text    ${VOICE_INPUT}    ${voice}
        Fill Text    ${CTI_INPUT}    ${cti}
        Click    iframe >>> button >> text="Configure"
        IF    not $voice
            Get Text    ${VOICE_ERROR}    ==    Required
        END
        IF    not $cti
            Get Text    ${CTI_ERROR}    ==    Required
        END
        IF    $voice and $cti
            Get Text    ${VOICE_ERROR}    ==    Cannot use the same host for NethVoice and NethVoice CTI
            Get Text    ${CTI_ERROR}    ==    Cannot use the same host for NethVoice and NethVoice CTI
        END
        ${after} =    Run task    module/${module_id}/get-configuration    {}
        Should Be Equal    ${after}    ${before}
        ${http_after} =    Run task    ${traefik_agent}/list-routes    {"expand_list":true}
        ${http_after} =    Evaluate    sorted($http_after, key=lambda route: route["instance"])
        Should Be Equal    ${http_after}    ${http_before}
        ${sip_after}    ${rc} =    Execute Command    runagent -m ${proxy_module_id} podman exec postgres sh -c 'psql -tA -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB" -c "SELECT * FROM nethvoice_proxy_routes ORDER BY setid; SELECT * FROM dispatcher ORDER BY id; SELECT * FROM domain ORDER BY id; SELECT * FROM dialplan ORDER BY id;"'    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        Should Be Equal    ${sip_after}    ${sip_before}
    END
    Fill Text    ${VOICE_INPUT}    Voice.Ns8.Local
    Fill Text    ${CTI_INPUT}    CTI.Ns8.Local
    Click    iframe >>> button >> text="Configure"
    Wait For Elements State    iframe >>> button >> text="Configure"    hidden    timeout=15m
    ${configuration} =    Run task    module/${module_id}/get-configuration    {}
    Should Be Equal    ${configuration}[nethvoice_host]    voice.ns8.local
    Should Be Equal    ${configuration}[nethcti_ui_host]    cti.ns8.local
    ${saved} =    Execute Command    runagent -m ${module_id} sh -c 'printf "%s\\n%s\\n" "$NETHVOICE_HOST" "$NETHCTI_UI_HOST"'
    Should Be Equal    ${saved}    voice.ns8.local${\n}cti.ns8.local
    ${routes} =    Run task    ${traefik_agent}/list-routes    {"expand_list":true}
    ${own_routes} =    Evaluate    [r for r in $routes if r['instance'].startswith('${module_id}-')]
    Length Should Be    ${own_routes}    13
    FOR    ${route}    IN    @{own_routes}
        Should Be True    $route['host'] in ('voice.ns8.local', 'cti.ns8.local')
    END
    ${sip}    ${rc} =    Execute Command    runagent -m ${proxy_module_id} podman exec -i postgres sh -c 'psql -tA -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB"' <<'SQL'${\n}SELECT target FROM nethvoice_proxy_routes WHERE route_type='domain'; SELECT domain FROM domain; SELECT match_exp FROM dialplan WHERE dpid=1;${\n}SQL    return_rc=True
    Should Be Equal As Integers    ${rc}    0
    Should Be Equal    ${sip}    voice.ns8.local${\n}voice.ns8.local${\n}voice.ns8.local
    ${ready}    ${rc} =    Execute Command    runagent -m ${module_id} sh -c 'systemctl --user is-active freepbx mariadb tancredi nethcti-ui && podman exec freepbx asterisk -rx "core show version" && curl -fkLsS --retry 30 --retry-all-errors --retry-delay 2 --resolve voice.ns8.local:443:127.0.0.1 https://voice.ns8.local/freepbx/admin/ -o /dev/null && curl -fkLsS --retry 30 --retry-all-errors --retry-delay 2 --resolve cti.ns8.local:443:127.0.0.1 https://cti.ns8.local/ -o /dev/null'    return_rc=True    timeout=5m
    Should Be Equal As Integers    ${rc}    0
    Should Contain    ${ready}    Asterisk

Settings rejects empty and matching hostnames without changing routes
    [Tags]    ui    hostname
    Go To    https://${NODE_ADDR}/cluster-admin/#/apps/${module_id}?page=settings
    Wait For Elements State    ${VOICE_INPUT}    enabled    timeout=60s
    ${before} =    Run task    module/${module_id}/get-configuration    {}
    ${http_before} =    Run task    ${traefik_agent}/list-routes    {"expand_list":true}
    ${http_before} =    Evaluate    sorted($http_before, key=lambda route: route["instance"])
    ${sip_before}    ${rc} =    Execute Command    runagent -m ${proxy_module_id} podman exec postgres sh -c 'psql -tA -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB" -c "SELECT * FROM nethvoice_proxy_routes ORDER BY setid; SELECT * FROM dispatcher ORDER BY id; SELECT * FROM domain ORDER BY id; SELECT * FROM dialplan ORDER BY id;"'    return_rc=True
    Should Be Equal As Integers    ${rc}    0
    FOR    ${voice}    ${cti}    IN    ${EMPTY}    cti.ns8.local    voice.ns8.local    ${EMPTY}    ${EMPTY}    ${EMPTY}    Same.ns8.local    Same.ns8.local    Same.ns8.local    sAME.ns8.local
        Fill Text    ${VOICE_INPUT}    ${voice}
        Fill Text    ${CTI_INPUT}    ${cti}
        Click    iframe >>> button >> text="Save"
        IF    not $voice
            Get Text    ${VOICE_ERROR}    ==    Required
        END
        IF    not $cti
            Get Text    ${CTI_ERROR}    ==    Required
        END
        IF    $voice and $cti
            Get Text    ${VOICE_ERROR}    ==    Cannot use the same host for NethVoice and NethVoice CTI
            Get Text    ${CTI_ERROR}    ==    Cannot use the same host for NethVoice and NethVoice CTI
        END
        ${after} =    Run task    module/${module_id}/get-configuration    {}
        Should Be Equal    ${after}    ${before}
        ${http_after} =    Run task    ${traefik_agent}/list-routes    {"expand_list":true}
        ${http_after} =    Evaluate    sorted($http_after, key=lambda route: route["instance"])
        Should Be Equal    ${http_after}    ${http_before}
        ${sip_after}    ${rc} =    Execute Command    runagent -m ${proxy_module_id} podman exec postgres sh -c 'psql -tA -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB" -c "SELECT * FROM nethvoice_proxy_routes ORDER BY setid; SELECT * FROM dispatcher ORDER BY id; SELECT * FROM domain ORDER BY id; SELECT * FROM dialplan ORDER BY id;"'    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        Should Be Equal    ${sip_after}    ${sip_before}
    END

Repeated Settings saves preserve route identities and dispatcher sets
    [Tags]    ui    hostname
    ${http_before} =    Run task    ${traefik_agent}/list-routes    {"expand_list":true}
    ${http_before} =    Evaluate    sorted($http_before, key=lambda route: route["instance"])
    # Dispatcher row IDs may change on save; compare set IDs, destinations and descriptions.
    ${sip_before}    ${rc} =    Execute Command    runagent -m ${proxy_module_id} podman exec postgres sh -c 'psql -tA -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB" -c "SELECT * FROM nethvoice_proxy_routes ORDER BY setid; SELECT setid,destination,description FROM dispatcher ORDER BY setid,destination; SELECT * FROM domain ORDER BY id; SELECT * FROM dialplan ORDER BY id;"'    return_rc=True
    Should Be Equal As Integers    ${rc}    0
    FOR    ${voice}    ${cti}    IN    VOICE.NS8.LOCAL    CTI.NS8.LOCAL    vOICE.nS8.lOCAL    cTI.nS8.lOCAL
        Fill Text    ${VOICE_INPUT}    ${voice}
        Fill Text    ${CTI_INPUT}    ${cti}
        Click    iframe >>> button >> text="Save"
        Wait For Elements State    ${VOICE_INPUT}    disabled    timeout=10s
        Wait For Elements State    ${VOICE_INPUT}    enabled    timeout=15m
        Reload
        Wait For Elements State    ${VOICE_INPUT}    enabled    timeout=60s
        Get Property    ${VOICE_INPUT}    value    ==    voice.ns8.local
        Get Property    ${CTI_INPUT}    value    ==    cti.ns8.local
        ${http_after} =    Run task    ${traefik_agent}/list-routes    {"expand_list":true}
        ${http_after} =    Evaluate    sorted($http_after, key=lambda route: route["instance"])
        Should Be Equal    ${http_after}    ${http_before}
        ${sip_after}    ${rc} =    Execute Command    runagent -m ${proxy_module_id} podman exec postgres sh -c 'psql -tA -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB" -c "SELECT * FROM nethvoice_proxy_routes ORDER BY setid; SELECT setid,destination,description FROM dispatcher ORDER BY setid,destination; SELECT * FROM domain ORDER BY id; SELECT * FROM dialplan ORDER BY id;"'    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        Should Be Equal    ${sip_after}    ${sip_before}
    END

Take screenshots
    [Tags]    ui
    Go To    https://${NODE_ADDR}/cluster-admin/#/apps/${module_id}
    Wait For Elements State    iframe >>> h2 >> text="Status"    visible    timeout=60s
    Take Screenshot    filename=${OUTPUT DIR}/browser/screenshot/1._Status.png
    Go To    https://${NODE_ADDR}/cluster-admin/#/apps/${module_id}?page=settings
    Wait For Elements State    iframe >>> h2 >> text="Settings"    visible    timeout=10s
    Take Screenshot    filename=${OUTPUT DIR}/browser/screenshot/2._Settings.png
