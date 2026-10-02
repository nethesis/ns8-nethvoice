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
        ${before}    ${rc} =    Execute Command    runagent -m ${module_id} podman exec freepbx php -d display_errors=0 -d log_errors=0 -r 'foreach (["first_access_tokens","tokens"] as $dir) { $tokens = []; foreach (glob("/var/lib/tancredi/data/".$dir."/*") as $path) { if (trim(file_get_contents($path)) === "02-00-00-81-90-01") { $tokens[] = hash("sha256", basename($path)); } } if (count($tokens) !== 1) { exit(1); } echo $tokens[0], PHP_EOL; }'    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        FOR    ${marker}    IN    ${{ $VOICE_HOST.title() }}    ${EMPTY}
            ${rc} =    Execute Command    runagent -m ${module_id} podman exec -i mariadb sh -c 'exec mysql -uroot -p"$MARIADB_ROOT_PASSWORD" asterisk' <<'SQL'${\n}DELETE FROM admin WHERE variable='NETHVOICE_HOST'; INSERT INTO admin (variable,value) SELECT 'NETHVOICE_HOST','${marker}' WHERE '${marker}' <> '';${\n}SQL    return_stdout=False    return_rc=True
            Should Be Equal As Integers    ${rc}    0
            ${since} =    Execute Command    date -u '+%Y-%m-%d %H:%M:%S.%6N UTC'
            Run task    module/${module_id}/configure-module
            ...    {"nethvoice_host":"${{ $VOICE_HOST.title().swapcase() }}","nethcti_ui_host":"${{ $CTI_HOST.title().swapcase() }}","user_domain":"${users_domain}","reports_international_prefix":"+39"}
            ...    decode_json=False
            ${rc} =    Execute Command    runagent -m ${module_id} bash -c 'for attempt in {1..150}; do if systemctl --user is-active --quiet freepbx && processes=$(podman top freepbx args 2>/dev/null) && ! printf "%s" "$processes" | grep -q "/[f]reepbx_init.sh"; then exit 0; fi; sleep 2; done; exit 1'    return_stdout=False    return_rc=True    timeout=6m
            Should Be Equal As Integers    ${rc}    0
            ${saved_marker}    ${rc} =    Execute Command    runagent -m ${module_id} podman exec -i mariadb sh -c 'exec mysql -N -B -uroot -p"$MARIADB_ROOT_PASSWORD" asterisk' <<'SQL'${\n}SELECT value FROM admin WHERE variable='NETHVOICE_HOST';${\n}SQL    return_rc=True
            Should Be Equal As Integers    ${rc}    0
            Should Be Equal    ${saved_marker}    ${VOICE_HOST}
            ${after}    ${rc} =    Execute Command    runagent -m ${module_id} podman exec freepbx php -d display_errors=0 -d log_errors=0 -r 'foreach (["first_access_tokens","tokens"] as $dir) { $tokens = []; foreach (glob("/var/lib/tancredi/data/".$dir."/*") as $path) { if (trim(file_get_contents($path)) === "02-00-00-81-90-01") { $tokens[] = hash("sha256", basename($path)); } } if (count($tokens) !== 1) { exit(1); } echo $tokens[0], PHP_EOL; }'    return_rc=True
            Should Be Equal As Integers    ${rc}    0
            Should Be Equal    ${after}    ${before}
            ${renewals}    ${rc} =    Execute Command    bash -o pipefail -c 'runagent -m ${module_id} journalctl --user --no-pager -u tancredi.service --since "${since}" -o cat | { grep -cE "POST /tancredi/api/v1/phones/02-00-00-81-90-01/tok1" || test "$?" = 1; }'    return_rc=True
            Should Be Equal As Integers    ${rc}    0
            Should Be Equal As Integers    ${renewals}    0
            ${rps_attempts}    ${rc} =    Execute Command    bash -o pipefail -c 'runagent -m ${module_id} journalctl --user --no-pager -u freepbx.service --since "${since}" -o cat | { grep -cE "(Configured new provisioning url|Failed to set RPS) for 02-00-00-81-90-01" || test "$?" = 1; }'    return_rc=True
            Should Be Equal As Integers    ${rc}    0
            Should Be Equal As Integers    ${rps_attempts}    0
            ${ready}    ${rc} =    Execute Command    runagent -m ${module_id} sh -c 'systemctl --user is-active freepbx mariadb tancredi && podman exec freepbx asterisk -rx "core show version"'    return_rc=True
            Should Be Equal As Integers    ${rc}    0
            Should Contain    ${ready}    Asterisk
        END
    FINALLY
        IF    $created
            ${rc} =    Execute Command    runagent -m ${module_id} podman exec -i mariadb sh -c 'exec mysql -uroot -p"$MARIADB_ROOT_PASSWORD" asterisk' <<'SQL'${\n}DELETE FROM rest_devices_phones WHERE mac='02:00:00:81:90:01'; DELETE FROM admin WHERE variable='NETHVOICE_HOST'; INSERT INTO admin (variable,value) VALUES ('NETHVOICE_HOST','${VOICE_HOST}');${\n}SQL    return_stdout=False    return_rc=True
            Should Be Equal As Integers    ${rc}    0
            ${rc} =    Execute Command    runagent -m ${module_id} podman exec freepbx sh -ec 'curl -fsS -X DELETE -H "Authentication: static $TANCREDI_STATIC_TOKEN" -H "HTTP_HOST: localhost" --output /dev/null "http://127.0.0.1:$TANCREDIPORT/tancredi/api/v1/phones/02-00-00-81-90-01"'    return_stdout=False    return_rc=True
            Should Be Equal As Integers    ${rc}    0
        END
    END

Genuine hostname changes renew the first-access token once
    [Tags]    hostname    provisioning
    [Documentation]    Verify actual Tancredi renewal and persisted marker after configure-module, then save and restart again.
    ...    Timestamp the disposable database row and compare it with the actual new token's filesystem timestamp.
    ...    Successful RPS registration still needs an authorized receiver or physical test device.
    Should Be Equal    ${module_id}    ${hostname_test_module_id}
    Should Not Be Equal    ${{ $RENAMED_VOICE_HOST.lower() }}    ${{ $VOICE_HOST.lower() }}
    ${created} =    Set Variable    ${FALSE}
    ${timestamp_column_added} =    Set Variable    ${FALSE}
    ${hosts_entry_added} =    Set Variable    ${FALSE}
    TRY
        # Give the synthetic new hostname working resolution in recreated containers.
        ${rc} =    Execute Command    printf '127.0.0.1 ${RENAMED_VOICE_HOST} # ns8-nethvoice-hostname-test\\n' >> /etc/hosts    return_stdout=False    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        ${hosts_entry_added} =    Set Variable    ${TRUE}
        # Fixture instrumentation only: the helper's INSERT gets a database timestamp.
        # Removing this column in FINALLY restores the original schema.
        ${rc} =    Execute Command    runagent -m ${module_id} podman exec -i mariadb sh -c 'exec mysql -uroot -p"$MARIADB_ROOT_PASSWORD" asterisk' <<'SQL'${\n}ALTER TABLE admin ADD COLUMN hostname_test_written_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6);${\n}SQL    return_stdout=False    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        ${timestamp_column_added} =    Set Variable    ${TRUE}
        ${rc} =    Execute Command    runagent -m ${module_id} podman exec -i freepbx sh -ec 'curl -fsS -H "Authentication: static $TANCREDI_STATIC_TOKEN" -H "HTTP_HOST: localhost" -H "Content-Type: application/json" --data-binary @- --output /dev/null "http://127.0.0.1:$TANCREDIPORT/tancredi/api/v1/phones"' <<'JSON'${\n}{"mac":"02-00-00-81-90-01","model":"gigaset-Maxwell3","display_name":"Hostname renewal fixture"}${\n}JSON    return_stdout=False    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        ${created} =    Set Variable    ${TRUE}
        ${rc} =    Execute Command    runagent -m ${module_id} podman exec -i mariadb sh -c 'exec mysql -uroot -p"$MARIADB_ROOT_PASSWORD" asterisk' <<'SQL'${\n}INSERT INTO rest_devices_phones (mac,vendor,model,type) VALUES ('02:00:00:81:90:01','Test','gigaset-Maxwell3','physical');${\n}SQL    return_stdout=False    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        ${before}    ${rc} =    Execute Command    runagent -m ${module_id} podman exec freepbx php -d display_errors=0 -d log_errors=0 -r 'foreach (["first_access_tokens","tokens"] as $dir) { $tokens = []; foreach (glob("/var/lib/tancredi/data/".$dir."/*") as $path) { if (trim(file_get_contents($path)) === "02-00-00-81-90-01") { $tokens[] = hash("sha256", basename($path)); } } if (count($tokens) !== 1) { exit(1); } echo $tokens[0], PHP_EOL; }'    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        ${since} =    Execute Command    date -u '+%Y-%m-%d %H:%M:%S.%6N UTC'
        Run task    module/${module_id}/configure-module
        ...    {"nethvoice_host":"${{ $RENAMED_VOICE_HOST.title() }}","nethcti_ui_host":"${{ $CTI_HOST.title() }}","user_domain":"${users_domain}","reports_international_prefix":"+39"}
        ...    decode_json=False
        ${rc} =    Execute Command    runagent -m ${module_id} bash -c 'for attempt in {1..150}; do if systemctl --user is-active --quiet freepbx && processes=$(podman top freepbx args 2>/dev/null) && ! printf "%s" "$processes" | grep -q "/[f]reepbx_init.sh"; then exit 0; fi; sleep 2; done; exit 1'    return_stdout=False    return_rc=True    timeout=6m
        Should Be Equal As Integers    ${rc}    0
        ${marker}    ${rc} =    Execute Command    runagent -m ${module_id} podman exec -i mariadb sh -c 'exec mysql -N -B -uroot -p"$MARIADB_ROOT_PASSWORD" asterisk' <<'SQL'${\n}SELECT value FROM admin WHERE variable='NETHVOICE_HOST';${\n}SQL    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        Should Be Equal    ${marker}    ${RENAMED_VOICE_HOST}
        ${rc} =    Execute Command    runagent -m ${module_id} podman exec freepbx sh -c 'getent hosts "$NETHVOICE_HOST"'    return_stdout=False    return_rc=True
        Should Be Equal As Integers    ${rc}    0    The fixture hostname must resolve inside FreePBX
        ${renewal_errors}    ${rc} =    Execute Command    bash -o pipefail -c 'runagent -m ${module_id} journalctl --user --no-pager -u freepbx.service --since "${since}" -o cat | { grep -oE "Expected code [0-9]+, got [0-9]+|Could not resolve host: [a-zA-Z0-9.-]+|Failed to connect to [a-zA-Z0-9.-]+ port [0-9]+" || test "$?" = 1; }'    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        Should Be Empty    ${renewal_errors}
        ${renewals}    ${rc} =    Execute Command    bash -o pipefail -c 'runagent -m ${module_id} journalctl --user --no-pager -u tancredi.service --since "${since}" -o cat | { grep -cE "POST /tancredi/api/v1/phones/02-00-00-81-90-01/tok1.*204" || test "$?" = 1; }'    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        Should Be Equal As Integers    ${renewals}    1    Expect one successful first-access token renewal before checking its timestamp
        ${marker_written_ns}    ${rc} =    Execute Command    runagent -m ${module_id} podman exec -i mariadb sh -c 'exec mysql -N -B -uroot -p"$MARIADB_ROOT_PASSWORD" asterisk' <<'SQL'${\n}SELECT FLOOR(UNIX_TIMESTAMP(hostname_test_written_at)*1000000000) FROM admin WHERE variable='NETHVOICE_HOST';${\n}SQL    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        ${token_written_ns}    ${rc} =    Execute Command    runagent -m ${module_id} podman exec freepbx python3 -c 'from pathlib import Path; tokens=[p for p in Path("/var/lib/tancredi/data/first_access_tokens").iterdir() if p.read_text().strip()=="02-00-00-81-90-01"]; assert len(tokens)==1; print(tokens[0].stat().st_mtime_ns)'    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        Should Be True    int($marker_written_ns) < int($token_written_ns)    The marker must be persisted before the new token is written
        ${after}    ${rc} =    Execute Command    runagent -m ${module_id} podman exec freepbx php -d display_errors=0 -d log_errors=0 -r 'foreach (["first_access_tokens","tokens"] as $dir) { $tokens = []; foreach (glob("/var/lib/tancredi/data/".$dir."/*") as $path) { if (trim(file_get_contents($path)) === "02-00-00-81-90-01") { $tokens[] = hash("sha256", basename($path)); } } if (count($tokens) !== 1) { exit(1); } echo $tokens[0], PHP_EOL; }'    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        Should Not Be Equal    ${{ $before.splitlines()[0] }}    ${{ $after.splitlines()[0] }}
        Should Be Equal    ${{ $before.splitlines()[1] }}    ${{ $after.splitlines()[1] }}
        ${provisioning_host}    ${rc} =    Execute Command    runagent -m ${module_id} podman exec freepbx bash -o pipefail -c 'curl -fsS -H "Authentication: static $TANCREDI_STATIC_TOKEN" -H "HTTP_HOST: localhost" "http://127.0.0.1:$TANCREDIPORT/tancredi/api/v1/phones/02-00-00-81-90-01" | jq -er .provisioning_url1 | cut -d/ -f3'    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        Should Be Equal    ${provisioning_host}    ${RENAMED_VOICE_HOST}
        ${since} =    Execute Command    date -u '+%Y-%m-%d %H:%M:%S.%6N UTC'
        FOR    ${operation}    IN    save    restart
            IF    $operation == 'save'
                Run task    module/${module_id}/configure-module
                ...    {"nethvoice_host":"${{ $RENAMED_VOICE_HOST.upper() }}","nethcti_ui_host":"${{ $CTI_HOST.upper() }}","user_domain":"${users_domain}","reports_international_prefix":"+39"}
                ...    decode_json=False
            ELSE
                Run task    node/1/restart-module    {"module_id":"${module_id}"}
            END
            ${rc} =    Execute Command    runagent -m ${module_id} bash -c 'for attempt in {1..150}; do if systemctl --user is-active --quiet freepbx && processes=$(podman top freepbx args 2>/dev/null) && ! printf "%s" "$processes" | grep -q "/[f]reepbx_init.sh"; then exit 0; fi; sleep 2; done; exit 1'    return_stdout=False    return_rc=True    timeout=6m
            Should Be Equal As Integers    ${rc}    0
            ${again}    ${rc} =    Execute Command    runagent -m ${module_id} podman exec freepbx php -d display_errors=0 -d log_errors=0 -r 'foreach (["first_access_tokens","tokens"] as $dir) { $tokens = []; foreach (glob("/var/lib/tancredi/data/".$dir."/*") as $path) { if (trim(file_get_contents($path)) === "02-00-00-81-90-01") { $tokens[] = hash("sha256", basename($path)); } } if (count($tokens) !== 1) { exit(1); } echo $tokens[0], PHP_EOL; }'    return_rc=True
            Should Be Equal As Integers    ${rc}    0
            Should Be Equal    ${again}    ${after}
            ${renewals}    ${rc} =    Execute Command    bash -o pipefail -c 'runagent -m ${module_id} journalctl --user --no-pager -u tancredi.service --since "${since}" -o cat | { grep -cE "POST /tancredi/api/v1/phones/02-00-00-81-90-01/tok1" || test "$?" = 1; }'    return_rc=True
            Should Be Equal As Integers    ${rc}    0
            Should Be Equal As Integers    ${renewals}    0
            ${ready}    ${rc} =    Execute Command    runagent -m ${module_id} sh -c 'systemctl --user is-active freepbx mariadb tancredi && podman exec freepbx asterisk -rx "core show version"'    return_rc=True
            Should Be Equal As Integers    ${rc}    0
            Should Contain    ${ready}    Asterisk
        END
    FINALLY
        ${rc} =    Execute Command    runagent -m ${module_id} bash -c 'for attempt in {1..150}; do if systemctl --user is-active --quiet freepbx && processes=$(podman top freepbx args 2>/dev/null) && ! printf "%s" "$processes" | grep -q "/[f]reepbx_init.sh"; then exit 0; fi; sleep 2; done; exit 1'    return_stdout=False    return_rc=True    timeout=6m
        Run Keyword And Continue On Failure    Should Be Equal As Integers    ${rc}    0
        IF    $hosts_entry_added
            ${rc} =    Execute Command    sed -i '/^127[.]0[.]0[.]1 ${{ $RENAMED_VOICE_HOST.replace(".", "[.]") }} # ns8-nethvoice-hostname-test$/d' /etc/hosts    return_stdout=False    return_rc=True
            Run Keyword And Continue On Failure    Should Be Equal As Integers    ${rc}    0
        END
        IF    $timestamp_column_added
            ${rc} =    Execute Command    runagent -m ${module_id} podman exec -i mariadb sh -c 'exec mysql -uroot -p"$MARIADB_ROOT_PASSWORD" asterisk' <<'SQL'${\n}ALTER TABLE admin DROP COLUMN hostname_test_written_at;${\n}SQL    return_stdout=False    return_rc=True
            Run Keyword And Continue On Failure    Should Be Equal As Integers    ${rc}    0
        END
        IF    $created
            ${rc} =    Execute Command    runagent -m ${module_id} podman exec -i mariadb sh -c 'exec mysql -uroot -p"$MARIADB_ROOT_PASSWORD" asterisk' <<'SQL'${\n}DELETE FROM rest_devices_phones WHERE mac='02:00:00:81:90:01';${\n}SQL    return_stdout=False    return_rc=True
            Run Keyword And Continue On Failure    Should Be Equal As Integers    ${rc}    0
            ${rc} =    Execute Command    runagent -m ${module_id} podman exec freepbx sh -ec 'curl -fsS -X DELETE -H "Authentication: static $TANCREDI_STATIC_TOKEN" -H "HTTP_HOST: localhost" --output /dev/null "http://127.0.0.1:$TANCREDIPORT/tancredi/api/v1/phones/02-00-00-81-90-01"'    return_stdout=False    return_rc=True
            Run Keyword And Continue On Failure    Should Be Equal As Integers    ${rc}    0
        END
        Run task    module/${module_id}/configure-module
        ...    {"nethvoice_host":"${VOICE_HOST}","nethcti_ui_host":"${CTI_HOST}","user_domain":"${users_domain}","reports_international_prefix":"+39","lets_encrypt":false}
        ...    decode_json=False
        # A genuine rename retains the previous SIP domain; remove the fixture alias.
        Run task    module/${proxy_module_id}/remove-route    {"domain":"${RENAMED_VOICE_HOST}"}
        ${remaining}    ${rc} =    Execute Command    runagent -m ${proxy_module_id} podman exec -i postgres sh -c 'psql -tA -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB"' <<'SQL'${\n}SELECT count(*) FROM nethvoice_proxy_routes WHERE lower(target)='${RENAMED_VOICE_HOST}'; SELECT count(*) FROM domain WHERE lower(domain)='${RENAMED_VOICE_HOST}'; SELECT count(*) FROM dialplan WHERE dpid=1 AND lower(match_exp)='${RENAMED_VOICE_HOST}';${\n}SQL    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        Should Be Equal    ${remaining}    0${\n}0${\n}0
    END
