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
    Fill Secret    text="Password"    $ADMIN_PASSWORD
    Click    button >> text="Log in"
    Wait For Elements State    css=#main-content    visible    timeout=10s

*** Test Cases ***

Initial setup validates hostnames and saves lowercase routes
    [Tags]    ui    hostname
    [Documentation]    Real wizard interaction on the instance created by 01_nethvoice_add-module.
    Import Library    Browser    enable_playwright_debug=False    auto_closing_level=SUITE
    New Browser    chromium    headless=True
    New Context    ignoreHTTPSErrors=True
    Login to cluster-admin
    Go To    https://${NODE_ADDR}/cluster-admin/#/apps/${module_id}
    Wait For Elements State    iframe >>> text="Use an existing account provider"    visible    timeout=60s
    Click    iframe >>> button >> text="Next"
    Wait For Elements State    iframe >>> input[readonly][placeholder*="proxy.example.org"]    visible    timeout=60s
    Click    iframe >>> button >> text="Next"
    Wait For Elements State    ${VOICE_INPUT}    visible    timeout=60s
    Fill Secret    iframe >>> input[type="password"] >> nth=0    $ADMIN_PASSWORD
    Fill Secret    iframe >>> input[type="password"] >> nth=1    $ADMIN_PASSWORD
    ${before} =    Run task    module/${module_id}/get-configuration    {}
    ${http_before} =    Run task    ${traefik_agent}/list-routes    {"expand_list":true}
    ${http_before} =    Evaluate    sorted($http_before, key=lambda route: route["instance"])
    ${sip_before}    ${rc} =    Execute Command    runagent -m ${proxy_module_id} podman exec postgres sh -c 'psql -tA -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB" -c "SELECT * FROM nethvoice_proxy_routes ORDER BY setid; SELECT * FROM dispatcher ORDER BY id; SELECT * FROM domain ORDER BY id; SELECT * FROM dialplan ORDER BY id;"'    return_rc=True
    Should Be Equal As Integers    ${rc}    0
    FOR    ${voice}    ${cti}    IN    ${EMPTY}    ${CTI_HOST}    ${VOICE_HOST}    ${EMPTY}    ${EMPTY}    ${EMPTY}    Same.ns8.local    Same.ns8.local    Same.ns8.local    sAME.ns8.local
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
    Fill Text    ${VOICE_INPUT}    ${{ $VOICE_HOST.title() }}
    Fill Text    ${CTI_INPUT}    ${{ $CTI_HOST.title() }}
    Click    iframe >>> button >> text="Configure"
    Wait For Elements State    iframe >>> button >> text="Configure"    hidden    timeout=15m
    ${configuration} =    Run task    module/${module_id}/get-configuration    {}
    Should Be Equal    ${configuration}[nethvoice_host]    ${VOICE_HOST}
    Should Be Equal    ${configuration}[nethcti_ui_host]    ${CTI_HOST}
    ${saved} =    Execute Command    runagent -m ${module_id} sh -c 'printf "%s\\n%s\\n" "$NETHVOICE_HOST" "$NETHCTI_UI_HOST"'
    Should Be Equal    ${saved}    ${VOICE_HOST}${\n}${CTI_HOST}
    ${routes} =    Run task    ${traefik_agent}/list-routes    {"expand_list":true}
    ${own_routes} =    Evaluate    [r for r in $routes if r['instance'].startswith('${module_id}-')]
    Length Should Be    ${own_routes}    13
    FOR    ${route}    IN    @{own_routes}
        Should Be True    $route['host'] in ('${VOICE_HOST}', '${CTI_HOST}')
    END
    ${sip}    ${rc} =    Execute Command    runagent -m ${proxy_module_id} podman exec -i postgres sh -c 'psql -tA -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB"' <<'SQL'${\n}SELECT target FROM nethvoice_proxy_routes WHERE route_type='domain'; SELECT domain FROM domain; SELECT match_exp FROM dialplan WHERE dpid=1;${\n}SQL    return_rc=True
    Should Be Equal As Integers    ${rc}    0
    Should Be Equal    ${sip}    ${VOICE_HOST}${\n}${VOICE_HOST}${\n}${VOICE_HOST}
    ${ready}    ${rc} =    Execute Command    runagent -m ${module_id} sh -c 'systemctl --user is-active freepbx mariadb tancredi nethcti-ui && podman exec freepbx asterisk -rx "core show version" && curl -fkLsS --retry 30 --retry-all-errors --retry-delay 2 --resolve ${VOICE_HOST}:443:127.0.0.1 https://${VOICE_HOST}/freepbx/admin/ -o /dev/null && curl -fkLsS --retry 30 --retry-all-errors --retry-delay 2 --resolve ${CTI_HOST}:443:127.0.0.1 https://${CTI_HOST}/ -o /dev/null'    return_rc=True    timeout=5m
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
    FOR    ${voice}    ${cti}    IN    ${EMPTY}    ${CTI_HOST}    ${VOICE_HOST}    ${EMPTY}    ${EMPTY}    ${EMPTY}    Same.ns8.local    Same.ns8.local    Same.ns8.local    sAME.ns8.local
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
    # Compare routing fields and stable IDs; saves update modification timestamps and dispatcher rows.
    ${sip_before}    ${rc} =    Execute Command    runagent -m ${proxy_module_id} podman exec postgres sh -c 'psql -tA -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB" -c "SELECT * FROM nethvoice_proxy_routes ORDER BY setid; SELECT setid,destination,description FROM dispatcher ORDER BY setid,destination; SELECT id,domain,did,created_at FROM domain ORDER BY id; SELECT id,dpid,pr,match_op,match_exp,match_len,subst_exp,repl_exp,attrs,created_at,name FROM dialplan ORDER BY id;"'    return_rc=True
    Should Be Equal As Integers    ${rc}    0
    FOR    ${voice}    ${cti}    IN    ${{ $VOICE_HOST.upper() }}    ${{ $CTI_HOST.upper() }}    ${{ $VOICE_HOST.title().swapcase() }}    ${{ $CTI_HOST.title().swapcase() }}
        Fill Text    ${VOICE_INPUT}    ${voice}
        Fill Text    ${CTI_INPUT}    ${cti}
        Click    iframe >>> button >> text="Save"
        Wait For Elements State    ${VOICE_INPUT}    disabled    timeout=10s
        Wait For Elements State    ${VOICE_INPUT}    enabled    timeout=15m
        Reload
        Wait For Elements State    ${VOICE_INPUT}    enabled    timeout=60s
        Get Property    ${VOICE_INPUT}    value    ==    ${VOICE_HOST}
        Get Property    ${CTI_INPUT}    value    ==    ${CTI_HOST}
        ${http_after} =    Run task    ${traefik_agent}/list-routes    {"expand_list":true}
        ${http_after} =    Evaluate    sorted($http_after, key=lambda route: route["instance"])
        Should Be Equal    ${http_after}    ${http_before}
        ${sip_after}    ${rc} =    Execute Command    runagent -m ${proxy_module_id} podman exec postgres sh -c 'psql -tA -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB" -c "SELECT * FROM nethvoice_proxy_routes ORDER BY setid; SELECT setid,destination,description FROM dispatcher ORDER BY setid,destination; SELECT id,domain,did,created_at FROM domain ORDER BY id; SELECT id,dpid,pr,match_op,match_exp,match_len,subst_exp,repl_exp,attrs,created_at,name FROM dialplan ORDER BY id;"'    return_rc=True
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
