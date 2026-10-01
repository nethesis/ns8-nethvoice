*** Settings ***
Library    SSHLibrary
Resource    ./api.resource

*** Variables ***
${LEGACY_NETHVOICE_IMAGE}    ghcr.io/nethesis/nethvoice:1.7.9

*** Test Cases ***
Restore a real legacy backup into the candidate
    [Tags]    hostname    restore
    [Documentation]    Create the backup with unmodified 1.7.9 actions, MariaDB and Tancredi volumes.
    ...    Restore its actual Restic snapshot through the candidate's deployed restore-module action.
    ...    Never manufacture legacy state by changing the candidate's environment or backup contents.
    ${legacy_id} =    Set Variable    ${EMPTY}
    ${restored_id} =    Set Variable    ${EMPTY}
    ${repository} =    Set Variable    ${EMPTY}
    ${backup_id} =    Set Variable    ${EMPTY}
    TRY
        ${legacy} =    Run task    cluster/add-module    {"image":"${LEGACY_NETHVOICE_IMAGE}","node":1}
        ${legacy_id} =    Set Variable    ${legacy}[module_id]
        ${legacy_uuid} =    Set Variable    ${legacy}[module_uuid]
        Run task    module/${legacy_id}/configure-module
        ...    {"nethvoice_host":"LegacyVoice.Ns8.Local","nethcti_ui_host":"LegacyCTI.Ns8.Local","user_domain":"${users_domain}","reports_international_prefix":"+39","lets_encrypt":false}
        ...    decode_json=False
        ${old} =    Run task    module/${legacy_id}/get-configuration    {}
        Should Be Equal    ${old}[nethvoice_host]    LegacyVoice.Ns8.Local
        Should Be Equal    ${old}[nethcti_ui_host]    LegacyCTI.Ns8.Local
        ${image} =    Execute Command    runagent -m ${legacy_id} printenv IMAGE_URL
        Should Be Equal    ${image}    ${LEGACY_NETHVOICE_IMAGE}
        # Persist a non-secret sentinel in the real database and a real Tancredi phone.
        ${rc} =    Execute Command    runagent -m ${legacy_id} podman exec -i mariadb sh -c 'exec mysql -uroot -p"$MARIADB_ROOT_PASSWORD" asterisk' <<'SQL'${\n}INSERT INTO admin (variable,value) VALUES ('HOSTNAME_E2E_BACKUP','${legacy_uuid}');${\n}SQL    return_stdout=False    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        ${rc} =    Execute Command    runagent -m ${legacy_id} podman exec -i freepbx sh -ec 'curl -fsS --retry 30 --retry-all-errors --retry-delay 2 -H "Authentication: static $TANCREDI_STATIC_TOKEN" -H "HTTP_HOST: localhost" -H "Content-Type: application/json" --data-binary @- --output /dev/null "http://127.0.0.1:$TANCREDIPORT/tancredi/api/v1/phones"' <<'JSON'${\n}{"mac":"02-00-00-81-90-02","model":"gigaset-Maxwell3","display_name":"Hostname restore fixture"}${\n}JSON    return_stdout=False    return_rc=True    timeout=3m
        Should Be Equal As Integers    ${rc}    0
        # Only fingerprints leave the node; filenames in these directories are tokens.
        ${tokens_before}    ${rc} =    Execute Command    runagent -m ${legacy_id} podman exec freepbx php -r 'foreach (["first_access_tokens","tokens"] as $dir) { $tokens = []; foreach (glob("/var/lib/tancredi/data/".$dir."/*") as $path) { if (trim(file_get_contents($path)) === "02-00-00-81-90-02") { $tokens[] = hash("sha256", basename($path)); } } if (count($tokens) !== 1) { exit(1); } echo $tokens[0], PHP_EOL; }'    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        ${vpn_ip} =    Execute Command    runagent -m node python3 -c 'import agent,os; print(agent.redis_connect().hget("node/"+os.environ["NODE_ID"]+"/vpn", "ip_address"))'
        Should Match Regexp    ${vpn_ip}    ^[0-9.]+$
        # Discard the generated backup password on the node, before Robot can log it.
        ${repository}    ${rc} =    Execute Command    bash -o pipefail -c 'api-cli run cluster/add-backup-repository --data - | jq -er .id' <<'JSON'${\n}{"provider":"cluster","name":"Hostname restore fixture","url":"webdav:http://${vpn_ip}:4694","password":"","parameters":{}}${\n}JSON    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        ${backup_id} =    Run task    cluster/add-backup    {"name":"Hostname restore fixture","repository":"${repository}","schedule":"daily","retention":1,"instances":["${legacy_id}"],"enabled":false}
        ${rc} =    Execute Command    runagent -m ${legacy_id} module-backup ${backup_id} >/dev/null 2>&1    return_stdout=False    return_rc=True    timeout=20m
        Should Be Equal As Integers    ${rc}    0
        ${snapshots}    ${rc} =    Execute Command    runagent -m ${legacy_id} restic-wrapper --destination ${repository} snapshots --json    return_rc=True    timeout=2m
        Should Be Equal As Integers    ${rc}    0
        ${snapshots} =    Evaluate    json.loads($snapshots)    modules=json
        Length Should Be    ${snapshots}    1
        ${snapshot} =    Set Variable    ${snapshots}[0][id]
        Run task    cluster/remove-module    {"module_id":"${legacy_id}","preserve_data":false}
        ${legacy_id} =    Set Variable    ${EMPTY}
        # Keep the backup UUID, but explicitly install the candidate, not the old image.
        ${restored} =    Run task    cluster/add-module    {"image":"${IMAGE_URL}","node":1,"module_uuid":"${legacy_uuid}"}
        ${restored_id} =    Set Variable    ${restored}[module_id]
        ${restore} =    Catenate    SEPARATOR=\n
        ...    import agent, agent.tasks, os, tempfile
        ...    with tempfile.NamedTemporaryFile() as source:
        ...    ${SPACE * 4}agent.run_restic(agent.redis_connect(privileged=True), "${repository}", "nethvoice/${legacy_uuid}", ["--workdir=/srv"], ["dump", "${snapshot}", "state/environment"], stdout=source, check=True)
        ...    ${SPACE * 4}old = agent.read_envfile(source.name)
        ...    assert old["NETHVOICE_HOST"] == "LegacyVoice.Ns8.Local"
        ...    assert old["NETHCTI_UI_HOST"] == "LegacyCTI.Ns8.Local"
        ...    assert old["IMAGE_URL"] == "${LEGACY_NETHVOICE_IMAGE}"
        ...    result = agent.tasks.run(os.environ["AGENT_ID"], "restore-module", data={"repository":"${repository}", "path":"nethvoice/${legacy_uuid}", "snapshot":"${snapshot}", "environment":old})
        ...    assert result["exit_code"] == 0, "candidate restore-module failed"
        ${rc} =    Execute Command    runagent -m ${restored_id} python3 - <<'PY'${\n}${restore}${\n}PY    return_stdout=False    return_rc=True    timeout=20m
        Should Be Equal As Integers    ${rc}    0
        ${configuration} =    Run task    module/${restored_id}/get-configuration    {}
        Should Be Equal    ${configuration}[nethvoice_host]    legacyvoice.ns8.local
        Should Be Equal    ${configuration}[nethcti_ui_host]    legacycti.ns8.local
        ${saved} =    Execute Command    runagent -m ${restored_id} sh -c 'printf "%s\\n%s\\n" "$NETHVOICE_HOST" "$NETHCTI_UI_HOST"'
        Should Be Equal    ${saved}    legacyvoice.ns8.local${\n}legacycti.ns8.local
        ${sentinel}    ${rc} =    Execute Command    runagent -m ${restored_id} podman exec -i mariadb sh -c 'exec mysql -N -B -uroot -p"$MARIADB_ROOT_PASSWORD" asterisk' <<'SQL'${\n}SELECT value FROM admin WHERE variable='HOSTNAME_E2E_BACKUP';${\n}SQL    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        Should Be Equal    ${sentinel}    ${legacy_uuid}
        ${tokens_after}    ${rc} =    Execute Command    runagent -m ${restored_id} podman exec freepbx php -r 'foreach (["first_access_tokens","tokens"] as $dir) { $tokens = []; foreach (glob("/var/lib/tancredi/data/".$dir."/*") as $path) { if (trim(file_get_contents($path)) === "02-00-00-81-90-02") { $tokens[] = hash("sha256", basename($path)); } } if (count($tokens) !== 1) { exit(1); } echo $tokens[0], PHP_EOL; }'    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        Should Be Equal    ${tokens_after}    ${tokens_before}
        ${routes} =    Run task    ${traefik_agent}/list-routes    {"expand_list":true}
        ${own_routes} =    Evaluate    [r for r in $routes if r['instance'].startswith($restored_id + '-')]
        Length Should Be    ${own_routes}    10
        FOR    ${route}    IN    @{own_routes}
            Should Be True    $route['host'] in ('legacyvoice.ns8.local', 'legacycti.ns8.local')
        END
        ${sip}    ${rc} =    Execute Command    runagent -m ${proxy_module_id} podman exec -i postgres sh -c 'psql -tA -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB"' <<'SQL'${\n}SELECT target FROM nethvoice_proxy_routes WHERE lower(target)='legacyvoice.ns8.local'; SELECT domain FROM domain WHERE lower(domain)='legacyvoice.ns8.local'; SELECT match_exp FROM dialplan WHERE lower(match_exp)='legacyvoice.ns8.local';${\n}SQL    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        Should Be Equal    ${sip}    legacyvoice.ns8.local${\n}legacyvoice.ns8.local${\n}legacyvoice.ns8.local
        ${ready}    ${rc} =    Execute Command    runagent -m ${restored_id} sh -c 'systemctl --user is-active freepbx mariadb tancredi nethcti-ui && podman exec freepbx asterisk -rx "core show version" && curl -fkLsS --retry 30 --retry-all-errors --retry-delay 2 --resolve legacyvoice.ns8.local:443:127.0.0.1 https://legacyvoice.ns8.local/freepbx/admin/ -o /dev/null && curl -fkLsS --retry 30 --retry-all-errors --retry-delay 2 --resolve legacycti.ns8.local:443:127.0.0.1 https://legacycti.ns8.local/ -o /dev/null'    return_rc=True    timeout=5m
        Should Be Equal As Integers    ${rc}    0
        Should Contain    ${ready}    Asterisk
        ${http_before} =    Run task    ${traefik_agent}/list-routes    {"expand_list":true}
        ${sip_before}    ${rc} =    Execute Command    runagent -m ${proxy_module_id} podman exec postgres sh -c 'psql -tA -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB" -c "TABLE nethvoice_proxy_routes; SELECT setid,destination,description FROM dispatcher ORDER BY setid,destination; TABLE domain; TABLE dialplan;"'    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        Run task    module/${restored_id}/configure-module
        ...    {"nethvoice_host":"LEGACYVOICE.NS8.LOCAL","nethcti_ui_host":"LEGACYCTI.NS8.LOCAL","user_domain":"${users_domain}","reports_international_prefix":"+39"}
        ...    decode_json=False
        ${http_after} =    Run task    ${traefik_agent}/list-routes    {"expand_list":true}
        Should Be Equal    ${http_after}    ${http_before}
        ${sip_after}    ${rc} =    Execute Command    runagent -m ${proxy_module_id} podman exec postgres sh -c 'psql -tA -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB" -c "TABLE nethvoice_proxy_routes; SELECT setid,destination,description FROM dispatcher ORDER BY setid,destination; TABLE domain; TABLE dialplan;"'    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        Should Be Equal    ${sip_after}    ${sip_before}
    FINALLY
        IF    $restored_id
            Run task    cluster/remove-module    {"module_id":"${restored_id}","preserve_data":false}
        END
        IF    $legacy_id
            Run task    cluster/remove-module    {"module_id":"${legacy_id}","preserve_data":false}
        END
        IF    $backup_id
            Run task    cluster/remove-backup    {"id":${backup_id}}
        END
        IF    $repository
            ${rc} =    Execute Command    podman exec rclone-gateway rclone purge ${repository}:/srv/repo/nethvoice/${legacy_uuid}    return_stdout=False    return_rc=True
            Should Be Equal As Integers    ${rc}    0
            Run task    cluster/remove-backup-repository    {"id":"${repository}"}
        END
    END
