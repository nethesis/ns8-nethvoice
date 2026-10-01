*** Settings ***
Library    SSHLibrary
Resource    ../api.resource

*** Test Cases ***
Case-only saves and a missing marker preserve existing provisioning tokens
    [Tags]    hostname    provisioning
    [Documentation]    Use the suite-owned module and a locally administered MAC that cannot select an RPS provider.
    ...    Fingerprint both real Tancredi tokens on the node, and count renewal/RPS attempts in service logs.
    Should Be Equal    ${module_id}    ${hostname_test_module_id}
    ${created} =    Set Variable    ${FALSE}
    TRY
        ${rc} =    Execute Command    runagent -m ${module_id} podman exec -i freepbx sh -ec 'curl -fsS -H "Authentication: static $TANCREDI_STATIC_TOKEN" -H "HTTP_HOST: localhost" -H "Content-Type: application/json" --data-binary @- --output /dev/null "http://127.0.0.1:$TANCREDIPORT/tancredi/api/v1/phones"' <<'JSON'${\n}{"mac":"02-00-00-81-90-01","model":"gigaset-Maxwell3","display_name":"Hostname token fixture"}${\n}JSON    return_stdout=False    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        ${created} =    Set Variable    ${TRUE}
        ${rc} =    Execute Command    runagent -m ${module_id} podman exec -i mariadb sh -c 'exec mysql -uroot -p"$MARIADB_ROOT_PASSWORD" asterisk' <<'SQL'${\n}INSERT INTO rest_devices_phones (mac,vendor,model,type) VALUES ('02:00:00:81:90:01','Test','gigaset-Maxwell3','physical');${\n}SQL    return_stdout=False    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        ${before}    ${rc} =    Execute Command    runagent -m ${module_id} podman exec freepbx php -r 'foreach (["first_access_tokens","tokens"] as $dir) { $tokens = []; foreach (glob("/var/lib/tancredi/data/".$dir."/*") as $path) { if (trim(file_get_contents($path)) === "02-00-00-81-90-01") { $tokens[] = hash("sha256", basename($path)); } } if (count($tokens) !== 1) { exit(1); } echo $tokens[0], PHP_EOL; }'    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        FOR    ${marker}    IN    Voice.Ns8.Local    ${EMPTY}
            ${rc} =    Execute Command    runagent -m ${module_id} podman exec -i mariadb sh -c 'exec mysql -uroot -p"$MARIADB_ROOT_PASSWORD" asterisk' <<'SQL'${\n}DELETE FROM admin WHERE variable='NETHVOICE_HOST'; INSERT INTO admin (variable,value) SELECT 'NETHVOICE_HOST','${marker}' WHERE '${marker}' <> '';${\n}SQL    return_stdout=False    return_rc=True
            Should Be Equal As Integers    ${rc}    0
            ${since} =    Execute Command    date --iso-8601=ns
            Run task    module/${module_id}/configure-module
            ...    {"nethvoice_host":"vOICE.Ns8.LOCAL","nethcti_ui_host":"cTI.Ns8.LOCAL","user_domain":"${users_domain}","reports_international_prefix":"+39"}
            ...    decode_json=False
            ${rc} =    Execute Command    runagent -m ${module_id} bash -c 'for attempt in {1..150}; do if podman exec freepbx sh -c "! pgrep -f \"[f]reepbx_init.sh\" >/dev/null"; then exit 0; fi; sleep 2; done; exit 1'    return_stdout=False    return_rc=True    timeout=6m
            Should Be Equal As Integers    ${rc}    0
            ${saved_marker}    ${rc} =    Execute Command    runagent -m ${module_id} podman exec -i mariadb sh -c 'exec mysql -N -B -uroot -p"$MARIADB_ROOT_PASSWORD" asterisk' <<'SQL'${\n}SELECT value FROM admin WHERE variable='NETHVOICE_HOST';${\n}SQL    return_rc=True
            Should Be Equal As Integers    ${rc}    0
            Should Be Equal    ${saved_marker}    voice.ns8.local
            ${after}    ${rc} =    Execute Command    runagent -m ${module_id} podman exec freepbx php -r 'foreach (["first_access_tokens","tokens"] as $dir) { $tokens = []; foreach (glob("/var/lib/tancredi/data/".$dir."/*") as $path) { if (trim(file_get_contents($path)) === "02-00-00-81-90-01") { $tokens[] = hash("sha256", basename($path)); } } if (count($tokens) !== 1) { exit(1); } echo $tokens[0], PHP_EOL; }'    return_rc=True
            Should Be Equal As Integers    ${rc}    0
            Should Be Equal    ${after}    ${before}
            ${renewals} =    Execute Command    runagent -m ${module_id} journalctl --user --no-pager -u tancredi.service --since '${since}' -o cat | grep -cE 'POST /tancredi/api/v1/phones/02-00-00-81-90-01/tok1' || test "$?" = 1
            Should Be Equal As Integers    ${renewals}    0
            ${rps_attempts} =    Execute Command    runagent -m ${module_id} journalctl --user --no-pager -u freepbx.service --since '${since}' -o cat | grep -cE '(Configured new provisioning url|Failed to set RPS) for 02-00-00-81-90-01' || test "$?" = 1
            Should Be Equal As Integers    ${rps_attempts}    0
            ${ready}    ${rc} =    Execute Command    runagent -m ${module_id} sh -c 'systemctl --user is-active freepbx mariadb tancredi && podman exec freepbx asterisk -rx "core show version"'    return_rc=True
            Should Be Equal As Integers    ${rc}    0
            Should Contain    ${ready}    Asterisk
        END
    FINALLY
        IF    $created
            ${rc} =    Execute Command    runagent -m ${module_id} podman exec -i mariadb sh -c 'exec mysql -uroot -p"$MARIADB_ROOT_PASSWORD" asterisk' <<'SQL'${\n}DELETE FROM rest_devices_phones WHERE mac='02:00:00:81:90:01'; DELETE FROM admin WHERE variable='NETHVOICE_HOST'; INSERT INTO admin (variable,value) VALUES ('NETHVOICE_HOST','voice.ns8.local');${\n}SQL    return_stdout=False    return_rc=True
            Should Be Equal As Integers    ${rc}    0
            ${rc} =    Execute Command    runagent -m ${module_id} podman exec freepbx sh -ec 'curl -fsS -X DELETE -H "Authentication: static $TANCREDI_STATIC_TOKEN" -H "HTTP_HOST: localhost" --output /dev/null "http://127.0.0.1:$TANCREDIPORT/tancredi/api/v1/phones/02-00-00-81-90-01"'    return_stdout=False    return_rc=True
            Should Be Equal As Integers    ${rc}    0
        END
    END

Genuine hostname changes renew the first-access token once
    [Tags]    hostname    provisioning
    [Documentation]    Verify actual Tancredi renewal and persisted marker after configure-module, then save and restart again.
    ...    This does not verify successful RPS registration or marker-before-renewal ordering: those need an approved observer.
    Should Be Equal    ${module_id}    ${hostname_test_module_id}
    ${created} =    Set Variable    ${FALSE}
    TRY
        ${rc} =    Execute Command    runagent -m ${module_id} podman exec -i freepbx sh -ec 'curl -fsS -H "Authentication: static $TANCREDI_STATIC_TOKEN" -H "HTTP_HOST: localhost" -H "Content-Type: application/json" --data-binary @- --output /dev/null "http://127.0.0.1:$TANCREDIPORT/tancredi/api/v1/phones"' <<'JSON'${\n}{"mac":"02-00-00-81-90-01","model":"gigaset-Maxwell3","display_name":"Hostname renewal fixture"}${\n}JSON    return_stdout=False    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        ${created} =    Set Variable    ${TRUE}
        ${rc} =    Execute Command    runagent -m ${module_id} podman exec -i mariadb sh -c 'exec mysql -uroot -p"$MARIADB_ROOT_PASSWORD" asterisk' <<'SQL'${\n}INSERT INTO rest_devices_phones (mac,vendor,model,type) VALUES ('02:00:00:81:90:01','Test','gigaset-Maxwell3','physical');${\n}SQL    return_stdout=False    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        ${before}    ${rc} =    Execute Command    runagent -m ${module_id} podman exec freepbx php -r 'foreach (["first_access_tokens","tokens"] as $dir) { $tokens = []; foreach (glob("/var/lib/tancredi/data/".$dir."/*") as $path) { if (trim(file_get_contents($path)) === "02-00-00-81-90-01") { $tokens[] = hash("sha256", basename($path)); } } if (count($tokens) !== 1) { exit(1); } echo $tokens[0], PHP_EOL; }'    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        ${since} =    Execute Command    date --iso-8601=ns
        Run task    module/${module_id}/configure-module
        ...    {"nethvoice_host":"Voice-Renamed.Ns8.Local","nethcti_ui_host":"CTI.Ns8.Local","user_domain":"${users_domain}","reports_international_prefix":"+39"}
        ...    decode_json=False
        ${rc} =    Execute Command    runagent -m ${module_id} bash -c 'for attempt in {1..150}; do if podman exec freepbx sh -c "! pgrep -f \"[f]reepbx_init.sh\" >/dev/null"; then exit 0; fi; sleep 2; done; exit 1'    return_stdout=False    return_rc=True    timeout=6m
        Should Be Equal As Integers    ${rc}    0
        ${marker}    ${rc} =    Execute Command    runagent -m ${module_id} podman exec -i mariadb sh -c 'exec mysql -N -B -uroot -p"$MARIADB_ROOT_PASSWORD" asterisk' <<'SQL'${\n}SELECT value FROM admin WHERE variable='NETHVOICE_HOST';${\n}SQL    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        Should Be Equal    ${marker}    voice-renamed.ns8.local
        ${after}    ${rc} =    Execute Command    runagent -m ${module_id} podman exec freepbx php -r 'foreach (["first_access_tokens","tokens"] as $dir) { $tokens = []; foreach (glob("/var/lib/tancredi/data/".$dir."/*") as $path) { if (trim(file_get_contents($path)) === "02-00-00-81-90-01") { $tokens[] = hash("sha256", basename($path)); } } if (count($tokens) !== 1) { exit(1); } echo $tokens[0], PHP_EOL; }'    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        Should Not Be Equal    ${{ $before.splitlines()[0] }}    ${{ $after.splitlines()[0] }}
        Should Be Equal    ${{ $before.splitlines()[1] }}    ${{ $after.splitlines()[1] }}
        ${renewals} =    Execute Command    runagent -m ${module_id} journalctl --user --no-pager -u tancredi.service --since '${since}' -o cat | grep -cE 'POST /tancredi/api/v1/phones/02-00-00-81-90-01/tok1.*204' || test "$?" = 1
        Should Be Equal As Integers    ${renewals}    1
        ${since} =    Execute Command    date --iso-8601=ns
        FOR    ${operation}    IN    save    restart
            IF    $operation == 'save'
                Run task    module/${module_id}/configure-module
                ...    {"nethvoice_host":"VOICE-RENAMED.NS8.LOCAL","nethcti_ui_host":"CTI.NS8.LOCAL","user_domain":"${users_domain}","reports_international_prefix":"+39"}
                ...    decode_json=False
            ELSE
                Run task    node/1/restart-module    {"module_id":"${module_id}"}
            END
            ${rc} =    Execute Command    runagent -m ${module_id} bash -c 'for attempt in {1..150}; do if podman exec freepbx sh -c "! pgrep -f \"[f]reepbx_init.sh\" >/dev/null"; then exit 0; fi; sleep 2; done; exit 1'    return_stdout=False    return_rc=True    timeout=6m
            Should Be Equal As Integers    ${rc}    0
            ${again}    ${rc} =    Execute Command    runagent -m ${module_id} podman exec freepbx php -r 'foreach (["first_access_tokens","tokens"] as $dir) { $tokens = []; foreach (glob("/var/lib/tancredi/data/".$dir."/*") as $path) { if (trim(file_get_contents($path)) === "02-00-00-81-90-01") { $tokens[] = hash("sha256", basename($path)); } } if (count($tokens) !== 1) { exit(1); } echo $tokens[0], PHP_EOL; }'    return_rc=True
            Should Be Equal As Integers    ${rc}    0
            Should Be Equal    ${again}    ${after}
            ${renewals} =    Execute Command    runagent -m ${module_id} journalctl --user --no-pager -u tancredi.service --since '${since}' -o cat | grep -cE 'POST /tancredi/api/v1/phones/02-00-00-81-90-01/tok1' || test "$?" = 1
            Should Be Equal As Integers    ${renewals}    0
            ${ready}    ${rc} =    Execute Command    runagent -m ${module_id} sh -c 'systemctl --user is-active freepbx mariadb tancredi && podman exec freepbx asterisk -rx "core show version"'    return_rc=True
            Should Be Equal As Integers    ${rc}    0
            Should Contain    ${ready}    Asterisk
        END
    FINALLY
        IF    $created
            ${rc} =    Execute Command    runagent -m ${module_id} podman exec -i mariadb sh -c 'exec mysql -uroot -p"$MARIADB_ROOT_PASSWORD" asterisk' <<'SQL'${\n}DELETE FROM rest_devices_phones WHERE mac='02:00:00:81:90:01';${\n}SQL    return_stdout=False    return_rc=True
            Should Be Equal As Integers    ${rc}    0
            ${rc} =    Execute Command    runagent -m ${module_id} podman exec freepbx sh -ec 'curl -fsS -X DELETE -H "Authentication: static $TANCREDI_STATIC_TOKEN" -H "HTTP_HOST: localhost" --output /dev/null "http://127.0.0.1:$TANCREDIPORT/tancredi/api/v1/phones/02-00-00-81-90-01"'    return_stdout=False    return_rc=True
            Should Be Equal As Integers    ${rc}    0
        END
        Run task    module/${module_id}/configure-module
        ...    {"nethvoice_host":"voice.ns8.local","nethcti_ui_host":"cti.ns8.local","user_domain":"${users_domain}","reports_international_prefix":"+39","lets_encrypt":false}
        ...    decode_json=False
    END
