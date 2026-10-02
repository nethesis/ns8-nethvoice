*** Settings ***
Library    SSHLibrary
Resource    ./api.resource

*** Variables ***
${LEGACY_NETHVOICE_IMAGE}    ghcr.io/nethesis/nethvoice:1.7.9
${RESTORE_VOICE_HOST}    satellite-restore-voice.ns8.local
${RESTORE_CTI_HOST}    satellite-restore-cti.ns8.local

*** Test Cases ***
Restore a real backup without Satellite data into the candidate
    [Tags]    restore    satellite
    Restore legacy backup    ${FALSE}

Restore a real Satellite backup into the candidate
    [Tags]    restore    satellite
    Restore legacy backup    ${TRUE}

Skip an absent Satellite dump without credentials or an image
    [Tags]    restore    satellite
    Check deployed Satellite restore step    absent

Reject an empty Satellite dump
    [Tags]    restore    satellite
    Check deployed Satellite restore step    empty

Reject a compressed empty Satellite dump
    [Tags]    restore    satellite
    Check deployed Satellite restore step    compressed-empty

Reject a corrupt Satellite dump
    [Tags]    restore    satellite
    Check deployed Satellite restore step    corrupt

Propagate Satellite SQL errors
    [Tags]    restore    satellite
    Check deployed Satellite restore step    sql-error

Require the Satellite image when a dump exists
    [Tags]    restore    satellite
    Check deployed Satellite restore step    missing-image

*** Keywords ***
Restore legacy backup
    [Arguments]    ${satellite}
    [Documentation]    Create a genuine Restic backup using unmodified 1.7.9 actions and databases.
    ...    Restore its actual Restic snapshot through the candidate's deployed restore-module action.
    ...    Use lowercase fixture hostnames independently of hostname normalization changes.
    ${legacy_id} =    Set Variable    ${EMPTY}
    ${restored_id} =    Set Variable    ${EMPTY}
    ${repository} =    Set Variable    ${EMPTY}
    ${backup_id} =    Set Variable    ${EMPTY}
    TRY
        ${legacy} =    Run task    cluster/add-module    {"image":"${LEGACY_NETHVOICE_IMAGE}","node":1}
        ${legacy_id} =    Set Variable    ${legacy}[module_id]
        ${legacy_uuid} =    Set Variable    ${legacy}[module_uuid]
        Run task    module/${legacy_id}/configure-module
        ...    {"nethvoice_host":"${RESTORE_VOICE_HOST}","nethcti_ui_host":"${RESTORE_CTI_HOST}","user_domain":"${users_domain}","reports_international_prefix":"+39","lets_encrypt":false}
        ...    decode_json=False
        ${old} =    Run task    module/${legacy_id}/get-configuration    {}
        Should Be Equal    ${old}[nethvoice_host]    ${RESTORE_VOICE_HOST}
        Should Be Equal    ${old}[nethcti_ui_host]    ${RESTORE_CTI_HOST}
        ${image} =    Execute Command    runagent -m ${legacy_id} printenv IMAGE_URL
        Should Be Equal    ${image}    ${LEGACY_NETHVOICE_IMAGE}
        IF    $satellite
            Run task    module/${legacy_id}/set-integrations    {"satellite_voicemail_transcription_enabled":true}    decode_json=False
            Wait Until Keyword Succeeds    2m    3s    Seed Satellite sentinel    ${legacy_id}    ${legacy_uuid}
        ELSE
            ${rc} =    Execute Command    runagent -m ${legacy_id} systemctl --user --quiet is-active satellite-pgsql    return_stdout=False    return_rc=True
            Should Not Be Equal As Integers    ${rc}    0
        END
        # Also verify that restoration without Satellite reaches the MariaDB data.
        ${rc} =    Execute Command    runagent -m ${legacy_id} podman exec -i mariadb sh -c 'exec mysql -uroot -p"$MARIADB_ROOT_PASSWORD" asterisk' <<'SQL'${\n}INSERT INTO admin (variable,value) VALUES ('SATELLITE_RESTORE_BACKUP','${legacy_uuid}');${\n}SQL    return_stdout=False    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        ${cluster} =    Run task    get-cluster-status    {}
        ${vpn_ip} =    Evaluate    next(node['vpn']['ip_address'] for node in $cluster['nodes'] if int(node['id']) == 1)
        Should Match Regexp    ${vpn_ip}    ^[0-9.]+$
        IF    $satellite
            ${satellite_before} =    Read Satellite sentinel    ${legacy_id}    ${legacy_uuid}    ${vpn_ip}
        END
        # Discard the generated backup password on the node, before Robot can log it.
        ${repository}    ${rc} =    Execute Command    bash -o pipefail -c 'api-cli run cluster/add-backup-repository --data - | jq -er .id' <<'JSON'${\n}{"provider":"cluster","name":"Satellite restore fixture","url":"webdav:http://${vpn_ip}:4694","password":"","parameters":{}}${\n}JSON    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        ${backup_id} =    Run task    cluster/add-backup    {"name":"Satellite restore fixture","repository":"${repository}","schedule":"daily","retention":1,"instances":["${legacy_id}"],"enabled":false}
        ${rc} =    Execute Command    runagent -m ${legacy_id} timeout --kill-after=15s 10m module-backup ${backup_id} >/dev/null 2>&1    return_stdout=False    return_rc=True    timeout=20m
        Should Be Equal As Integers    ${rc}    0
        ${snapshots}    ${rc} =    Execute Command    runagent -m ${legacy_id} restic-wrapper --destination ${repository} snapshots --json    return_rc=True    timeout=2m
        Should Be Equal As Integers    ${rc}    0
        ${snapshots} =    Evaluate    json.loads($snapshots)    modules=json
        Length Should Be    ${snapshots}    1
        ${snapshot} =    Set Variable    ${snapshots}[0][id]
        # Filter on the node: other backed-up filenames can contain Tancredi tokens.
        ${dump_count}    ${rc} =    Execute Command    runagent -m ${legacy_id} bash -o pipefail -s <<'SH'${\n}restic-wrapper --destination ${repository} ls ${snapshot} --json | jq -s '[.[] | select((.path // "") | endswith("/satellite_postgresql.pg_dump.gz"))] | length'${\n}SH    return_rc=True    timeout=2m
        Should Be Equal As Integers    ${rc}    0
        Should Be Equal As Integers    ${dump_count}    ${{ int($satellite) }}
        Run task    cluster/remove-module    {"module_id":"${legacy_id}","preserve_data":false}
        ${legacy_id} =    Set Variable    ${EMPTY}
        # Keep the backup UUID, but explicitly install the candidate, not the old image.
        ${restored} =    Run task    cluster/add-module    {"image":"${IMAGE_URL}","node":1,"module_uuid":"${legacy_uuid}"}
        ${restored_id} =    Set Variable    ${restored}[module_id]
        ${restore} =    Catenate    SEPARATOR=\n
        ...    import agent, agent.tasks, subprocess, sys, tempfile
        ...    phase = "read legacy backup environment"
        ...    try:
        ...    ${SPACE * 4}with tempfile.NamedTemporaryFile() as source:
        ...    ${SPACE * 8}agent.run_restic(agent.redis_connect(privileged=True), "${repository}", "nethvoice/${legacy_uuid}", ["--workdir=/srv"], ["dump", "${snapshot}", "state/environment"], stdout=source, stderr=subprocess.DEVNULL, check=True)
        ...    ${SPACE * 8}old = agent.read_envfile(source.name)
        ...    ${SPACE * 4}phase = "validate legacy backup environment"
        ...    ${SPACE * 4}assert old["NETHVOICE_HOST"] == "${RESTORE_VOICE_HOST}"
        ...    ${SPACE * 4}assert old["NETHCTI_UI_HOST"] == "${RESTORE_CTI_HOST}"
        ...    ${SPACE * 4}assert old["IMAGE_URL"] == "${LEGACY_NETHVOICE_IMAGE}"
        ...    ${SPACE * 4}phase = "restore candidate"
        ...    ${SPACE * 4}result = agent.tasks.run("module/${restored_id}", "restore-module", endpoint="redis://cluster-leader", data={"repository":"${repository}", "path":"nethvoice/${legacy_uuid}", "snapshot":"${snapshot}", "environment":old, "replace":False})
        ...    ${SPACE * 4}print("restore-module exit code:", result["exit_code"])
        ...    ${SPACE * 4}assert result["exit_code"] == 0
        ...    except Exception as error:
        ...    ${SPACE * 4}print(phase + ": " + type(error).__name__)
        ...    ${SPACE * 4}sys.exit(1)
        # Use the same cluster credentials and task transport as cluster/restore-module.
        # Only the phase and exit code leave the node; the backup environment stays local.
        ${restore_result}    ${rc} =    Execute Command    runagent -m cluster python3 - <<'PY'${\n}${restore}${\n}PY    return_rc=True    timeout=20m
        Should Be Equal As Integers    ${rc}    0    ${restore_result}
        ${rc} =    Execute Command    runagent -m ${restored_id} sh -c 'test ! -e "$AGENT_STATE_DIR/satellite_postgresql.pg_dump.gz" && test ! -e "$AGENT_STATE_DIR/restore" && ! podman container exists restore_db'    return_stdout=False    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        IF    $satellite
            ${satellite_after} =    Wait Until Keyword Succeeds    2m    3s    Read Satellite sentinel    ${restored_id}    ${legacy_uuid}    ${vpn_ip}
            Should Be Equal    ${satellite_after}    ${satellite_before}
            ${rc} =    Execute Command    runagent -m ${restored_id} systemctl --user restart satellite-pgsql    return_stdout=False    return_rc=True    timeout=2m
            Should Be Equal As Integers    ${rc}    0
            ${satellite_restarted} =    Wait Until Keyword Succeeds    2m    3s    Read Satellite sentinel    ${restored_id}    ${legacy_uuid}    ${vpn_ip}
            Should Be Equal    ${satellite_restarted}    ${satellite_before}
        END
        ${configuration} =    Run task    module/${restored_id}/get-configuration    {}
        Should Be Equal    ${configuration}[nethvoice_host]    ${RESTORE_VOICE_HOST}
        Should Be Equal    ${configuration}[nethcti_ui_host]    ${RESTORE_CTI_HOST}
        ${saved} =    Execute Command    runagent -m ${restored_id} sh -c 'printf "%s\\n%s\\n" "$NETHVOICE_HOST" "$NETHCTI_UI_HOST"'
        Should Be Equal    ${saved}    ${RESTORE_VOICE_HOST}${\n}${RESTORE_CTI_HOST}
        ${sentinel}    ${rc} =    Execute Command    runagent -m ${restored_id} podman exec -i mariadb sh -c 'exec mysql -N -B -uroot -p"$MARIADB_ROOT_PASSWORD" asterisk' <<'SQL'${\n}SELECT value FROM admin WHERE variable='SATELLITE_RESTORE_BACKUP';${\n}SQL    return_rc=True
        Should Be Equal As Integers    ${rc}    0
        Should Be Equal    ${sentinel}    ${legacy_uuid}
    FINALLY
        IF    $restored_id
            Run Keyword And Continue On Failure    Run task    cluster/remove-module    {"module_id":"${restored_id}","preserve_data":false}
        END
        IF    $legacy_id
            Run Keyword And Continue On Failure    Run task    cluster/remove-module    {"module_id":"${legacy_id}","preserve_data":false}
        END
        IF    $backup_id
            Run Keyword And Continue On Failure    Run task    cluster/remove-backup    {"id":${backup_id}}
        END
        IF    $repository
            ${rc} =    Execute Command    podman exec rclone-gateway rclone purge ${repository}:/srv/repo/nethvoice/${legacy_uuid}    return_stdout=False    return_rc=True
            Run Keyword And Continue On Failure    Should Be Equal As Integers    ${rc}    0
            Run task    cluster/remove-backup-repository    {"id":"${repository}"}
        END
    END

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

Check deployed Satellite restore step
    [Arguments]    ${case}
    [Documentation]    Run the shipped step in a fresh unconfigured module with a bounded timeout.
    ...    Verify diagnostic artifacts before removing the disposable module and its volume.
    ${module_id} =    Set Variable    ${EMPTY}
    TRY
        ${module} =    Run task    cluster/add-module    {"image":"${IMAGE_URL}","node":1}
        ${module_id} =    Set Variable    ${module}[module_id]
        ${check} =    Catenate    SEPARATOR=\n
        ...    import gzip, os, pathlib, secrets, subprocess, tempfile
        ...    case = "${case}"
        ...    step = pathlib.Path(os.environ["AGENT_INSTALL_DIR"]) / "actions/restore-module/23satellite_pg"
        ...    env = os.environ.copy()
        ...    with tempfile.TemporaryDirectory(prefix="satellite-restore-", dir=os.environ["AGENT_STATE_DIR"]) as directory:
        ...    ${SPACE * 4}fixture = pathlib.Path(directory)
        ...    ${SPACE * 4}dump = fixture / "satellite_postgresql.pg_dump.gz"
        ...    ${SPACE * 4}sql = b"CREATE ROLE satellite;\\nSELECT 1 / 0;\\n"
        ...    ${SPACE * 4}payload = {"empty": b"", "compressed-empty": gzip.compress(b""), "corrupt": gzip.compress(sql)[:-4]}.get(case, gzip.compress(sql))
        ...    ${SPACE * 4}if case == "absent":
        ...    ${SPACE * 8}for key in ("PGVECTOR_IMAGE", "SATELLITE_PGSQL_USER", "SATELLITE_PGSQL_PASSWORD"):
        ...    ${SPACE * 12}env.pop(key, None)
        ...    ${SPACE * 4}else:
        ...    ${SPACE * 8}dump.write_bytes(payload)
        ...    ${SPACE * 8}(fixture / "passwords.env").write_text("SATELLITE_PGSQL_PASSWORD=" + secrets.token_urlsafe(24) + "\\n")
        ...    ${SPACE * 4}if case == "missing-image":
        ...    ${SPACE * 8}env.pop("PGVECTOR_IMAGE", None)
        ...    ${SPACE * 4}with (fixture / "restore.log").open("wb") as log:
        ...    ${SPACE * 8}result = subprocess.run(["timeout", "--kill-after=10s", "90s", str(step)], cwd=fixture, env=env, stdout=log, stderr=subprocess.STDOUT)
        ...    ${SPACE * 4}assert result.returncode not in (124, 137), "restore did not finish within 90 seconds"
        ...    ${SPACE * 4}assert subprocess.run(["podman", "container", "exists", "restore_db"]).returncode == 1, "temporary server was not removed"
        ...    ${SPACE * 4}if case == "absent":
        ...    ${SPACE * 8}assert result.returncode == 0
        ...    ${SPACE * 8}assert not (fixture / "restore").exists()
        ...    ${SPACE * 4}else:
        ...    ${SPACE * 8}assert result.returncode != 0, "invalid restore unexpectedly succeeded"
        ...    ${SPACE * 8}assert dump.read_bytes() == payload, "failed restore removed or changed the dump"
        ...    ${SPACE * 8}assert (fixture / "restore.log").stat().st_size > 0
        ...    ${SPACE * 4}if case == "sql-error":
        ...    ${SPACE * 8}assert result.returncode == 3, "expected psql ON_ERROR_STOP exit status"
        ...    ${SPACE * 8}assert "division by zero" in (fixture / "restore.log").read_text()
        ...    ${SPACE * 8}assert (fixture / "restore/satellite_postgresql_restore.sh").is_file()
        ...    ${SPACE * 8}assert subprocess.run(["podman", "volume", "exists", "satellite_pgdata"]).returncode == 0, "failed restore removed the data volume"
        ...    ${SPACE * 4}else:
        ...    ${SPACE * 8}assert subprocess.run(["podman", "volume", "exists", "satellite_pgdata"]).returncode == 1, "validation started PostgreSQL"
        ...    ${SPACE * 4}if case == "missing-image":
        ...    ${SPACE * 8}assert "PGVECTOR_IMAGE" in (fixture / "restore.log").read_text()
        ...    ${SPACE * 4}print(case + ": verified (step exit " + str(result.returncode) + ")")
        ${result}    ${rc} =    Execute Command    runagent -m ${module_id} python3 - <<'PY'${\n}${check}${\n}PY    return_rc=True    timeout=3m
        Should Be Equal As Integers    ${rc}    0    ${result}
        Should Contain    ${result}    ${case}: verified
    FINALLY
        IF    $module_id
            Run task    cluster/remove-module    {"module_id":"${module_id}","preserve_data":false}
        END
    END
