*** Settings ***
Library    SSHLibrary
Library    OperatingSystem
Resource    ./api.resource
Test Tags    restore    satellite

*** Variables ***
${LEGACY_NETHVOICE_IMAGE}    ghcr.io/nethesis/nethvoice:1.7.9

*** Test Cases ***
Restore a real backup without Satellite data into the candidate
    Restore legacy backup    ${FALSE}

Restore a real Satellite backup into the candidate
    Restore legacy backup    ${TRUE}

Reject invalid Satellite restores
    ${module} =    Run task    cluster/add-module    {"image":"${IMAGE_URL}","node":1}
    TRY
        ${checks} =    OperatingSystem.Get File    ${CURDIR}/satellite_restore_errors.sh
        ${error}    ${rc} =    Execute Command    runagent -m ${module}[module_id] bash -s <<'SH'${\n}${checks}${\n}SH
        ...    return_stdout=False    return_stderr=True    return_rc=True    timeout=5m
        Should Be Equal As Integers    ${rc}    0    ${error}
    FINALLY
        Run task    cluster/remove-module    {"module_id":"${module}[module_id]","preserve_data":false}
    END

*** Keywords ***
Restore legacy backup
    [Arguments]    ${satellite}
    ${backup_path} =    Set Variable    ${EMPTY}
    ${repository} =    Set Variable    ${EMPTY}
    ${backup_id} =    Set Variable    ${EMPTY}
    ${legacy} =    Run task    cluster/add-module    {"image":"${LEGACY_NETHVOICE_IMAGE}","node":1}
    ${module_id} =    Set Variable    ${legacy}[module_id]
    ${uuid} =    Set Variable    ${legacy}[module_uuid]
    TRY
        Run task    module/${module_id}/configure-module
        ...    {"nethvoice_host":"satellite-restore-voice.ns8.local","nethcti_ui_host":"satellite-restore-cti.ns8.local","user_domain":"${users_domain}","reports_international_prefix":"+39","lets_encrypt":false}
        ...    decode_json=False
        IF    $satellite
            Run task    module/${module_id}/set-integrations    {"satellite_voicemail_transcription_enabled":true}    decode_json=False
            Wait Until Keyword Succeeds    2m    3s    Seed Satellite sentinel    ${module_id}    ${uuid}
            ${cluster} =    Run task    get-cluster-status    {}
            ${vpn_ip} =    Evaluate    next(node['vpn']['ip_address'] for node in $cluster['nodes'] if int(node['id']) == 1)
            ${before} =    Read Satellite sentinel    ${module_id}    ${uuid}    ${vpn_ip}
        END
        ${stderr}    ${rc} =    Execute Command    runagent -m ${module_id} podman exec -i mariadb sh -c 'exec mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" asterisk' <<'SQL'${\n}INSERT INTO admin (variable,value) VALUES ('SATELLITE_RESTORE','${uuid}');${\n}SQL    return_stdout=False    return_stderr=True    return_rc=True
        Should Be Equal As Integers    ${rc}    0    ${stderr}

        # NS8 checks that the backup directory is readable when registering it.
        ${backup_path}    ${rc} =    Execute Command    podman exec rclone-gateway mktemp -d /srv/repo/satellite-restore.XXXXXXXX    return_rc=True
        Should Be Equal As Integers    ${rc}    0    Creating the fixture directory failed
        # Only the repository ID may leave the node. The response also contains a password.
        ${repository}    ${rc} =    Execute Command    bash -o pipefail -c 'api-cli run cluster/add-backup-repository --data - | jq -er .id' <<'JSON'${\n}{"provider":"rclone","name":"Satellite restore fixture","url":"","password":"","parameters":{"rclone_conf_secret":"type = local","basepath":"${backup_path}"}}${\n}JSON    return_rc=True
        Should Be Equal As Integers    ${rc}    0    Registering the fixture repository failed
        ${backup_id} =    Run task    cluster/add-backup    {"name":"Satellite restore fixture","repository":"${repository}","schedule":"daily","retention":1,"instances":["${module_id}"],"enabled":false}
        ${rc} =    Execute Command    runagent -m ${module_id} timeout --kill-after=15s 10m module-backup ${backup_id} >/dev/null 2>&1    return_stdout=False    return_rc=True    timeout=12m
        Should Be Equal As Integers    ${rc}    0    Legacy module-backup failed
        # Filter on the node because unrelated snapshot filenames can contain tokens.
        ${dump_count}    ${rc} =    Execute Command    runagent -m ${module_id} bash -o pipefail -s <<'SH'${\n}restic-wrapper --destination ${repository} ls latest --json | jq -s '[.[] | select((.path // "") | endswith("/satellite_postgresql.pg_dump.gz"))] | length'${\n}SH    return_rc=True    timeout=2m
        Should Be Equal As Integers    ${rc}    0    Listing the Satellite dump failed
        Should Be Equal As Integers    ${dump_count}    ${{ int($satellite) }}

        Run task    cluster/remove-module    {"module_id":"${module_id}","preserve_data":false}
        ${module_id} =    Set Variable    ${EMPTY}
        ${candidate} =    Run task    cluster/add-module    {"image":"${IMAGE_URL}","node":1,"module_uuid":"${uuid}"}
        ${module_id} =    Set Variable    ${candidate}[module_id]
        Restore latest snapshot    ${module_id}    ${repository}    nethvoice/${uuid}

        ${value}    ${rc} =    Execute Command    runagent -m ${module_id} podman exec -i mariadb sh -c 'exec mariadb -N -B -uroot -p"$MARIADB_ROOT_PASSWORD" asterisk' <<'SQL'${\n}SELECT value FROM admin WHERE variable='SATELLITE_RESTORE';${\n}SQL    return_rc=True
        Should Be Equal As Integers    ${rc}    0    Reading the restored MariaDB sentinel failed
        Should Be Equal    ${value}    ${uuid}
        IF    $satellite
            ${rc} =    Execute Command    runagent -m ${module_id} systemctl --user try-restart satellite-pgsql    return_stdout=False    return_rc=True    timeout=2m
            Should Be Equal As Integers    ${rc}    0    Restarting the restored PostgreSQL service failed
            ${after} =    Wait Until Keyword Succeeds    2m    3s    Read Satellite sentinel    ${module_id}    ${uuid}    ${vpn_ip}
            Should Be Equal    ${after}    ${before}
            ${rc} =    Execute Command    runagent -m ${module_id} sh -c 'test ! -e "$AGENT_STATE_DIR/satellite_postgresql.pg_dump.gz" && ! podman container exists restore_db'    return_stdout=False    return_rc=True
            Should Be Equal As Integers    ${rc}    0    Successful restore left temporary artifacts
        END
    FINALLY
        IF    $module_id
            Run Keyword And Continue On Failure    Run task    cluster/remove-module    {"module_id":"${module_id}","preserve_data":false}
        END
        IF    $backup_id
            Run Keyword And Continue On Failure    Run task    cluster/remove-backup    {"id":${backup_id}}
        END
        IF    $repository
            Run Keyword And Continue On Failure    Run task    cluster/remove-backup-repository    {"id":"${repository}"}
        END
        IF    $backup_path
            ${rc} =    Execute Command    podman exec rclone-gateway rm -r -- '${backup_path}'    return_stdout=False    return_rc=True
            Should Be Equal As Integers    ${rc}    0    Removing the fixture directory failed
        END
    END

Restore latest snapshot
    [Arguments]    ${module_id}    ${repository}    ${path}
    # The cluster action would install the image recorded in the backup. Pass its
    # environment to the candidate's module action without sending it through Robot.
    ${restore} =    Catenate    SEPARATOR=\n
    ...    import agent, agent.tasks, sys, tempfile
    ...    with tempfile.NamedTemporaryFile() as source:
    ...    ${SPACE * 4}agent.run_restic(agent.redis_connect(privileged=True), "${repository}", "${path}", ["--workdir=/srv"], ["dump", "latest", "state/environment"], stdout=source, check=True)
    ...    ${SPACE * 4}environment = agent.read_envfile(source.name)
    ...    data = {"repository":"${repository}", "path":"${path}", "snapshot":"latest", "environment":environment, "replace":False}
    ...    sys.exit(agent.tasks.run("module/${module_id}", "restore-module", data=data, endpoint="redis://cluster-leader")["exit_code"])
    ${rc} =    Execute Command    runagent -m cluster python3 - <<'PY'${\n}${restore}${\n}PY    return_stdout=False    return_rc=True    timeout=20m
    Should Be Equal As Integers    ${rc}    0    Restoring the legacy snapshot into the candidate failed

Seed Satellite sentinel
    [Arguments]    ${module_id}    ${uuid}
    # Keep data in a test-owned table and role; the actual pg_dumpall backs them up.
    ${sql} =    Catenate    SEPARATOR=\n
    ...    CREATE EXTENSION IF NOT EXISTS vector;
    ...    CREATE TABLE IF NOT EXISTS public.satellite_restore_sentinel (id text PRIMARY KEY, embedding vector(3));
    ...    INSERT INTO public.satellite_restore_sentinel VALUES ('${uuid}', '[1,2,3]') ON CONFLICT (id) DO NOTHING;
    ...    SELECT 'CREATE ROLE satellite_restore_reader NOLOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname='satellite_restore_reader')\\gexec
    ...    GRANT SELECT ON public.satellite_restore_sentinel TO satellite_restore_reader;
    ...    ALTER ROLE satellite SET statement_timeout = '29s';
    ${rc} =    Execute Command    runagent -m ${module_id} podman exec -i satellite-pgsql sh -c 'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'${\n}${sql}${\n}SQL    return_stdout=False    return_rc=True
    Should Be Equal As Integers    ${rc}    0

Read Satellite sentinel
    [Arguments]    ${module_id}    ${uuid}    ${vpn_ip}
    # Use the node's non-loopback address to exercise password authentication.
    ${sql} =    Catenate    SEPARATOR=\n
    ...    SELECT current_user, pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database();
    ...    SELECT id, embedding::text FROM public.satellite_restore_sentinel;
    ...    SHOW statement_timeout;
    ...    SELECT has_table_privilege('satellite_restore_reader', 'public.satellite_restore_sentinel', 'SELECT');
    ...    SELECT md5(rolpassword) FROM pg_authid WHERE rolname=current_user;
    ${data}    ${rc} =    Execute Command    runagent -m ${module_id} podman exec -i satellite-pgsql sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -w -tA -v ON_ERROR_STOP=1 -h ${vpn_ip} -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'${\n}${sql}${\n}SQL    return_rc=True
    Should Be Equal As Integers    ${rc}    0
    Should Start With    ${data}    satellite|satellite${\n}${uuid}|[1,2,3]${\n}29s${\n}t${\n}
    ${rc} =    Execute Command    runagent -m ${module_id} podman exec satellite-pgsql sh -c 'PGPASSWORD=invalid-restore-fixture exec psql -X -w -h ${vpn_ip} -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1"' >/dev/null 2>&1    return_stdout=False    return_rc=True
    Should Be Equal As Integers    ${rc}    2
    RETURN    ${data}
