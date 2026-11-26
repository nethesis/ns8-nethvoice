"""Run the configure/Integrations entry points and the systemd apply job against a disposable state."""
import gzip
import io
import json
import os
from pathlib import Path
import runpy
import subprocess
import sys
from types import SimpleNamespace

import pytest

ROOT = Path(__file__).resolve().parents[2] / 'imageroot'


@pytest.fixture
def installation(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    monkeypatch.syspath_prepend(str(ROOT / 'pypkg'))
    monkeypatch.setenv('NETHVOICE_HOST', 'pbx.example')
    monkeypatch.setenv('NETHVOICE_SATELLITE_IMAGE', 'test-image')
    monkeypatch.setenv('AGENT_INSTALL_DIR', str(ROOT))
    monkeypatch.setenv('MODULE_ID', 'nethvoice-test')
    env = {'NETHVOICE_HOST': 'pbx.example', 'TCP_PORTS_RANGE': '30000-30045'}
    secrets = dict.fromkeys(('SATELLITE_AGENT_CONFIG_KEY', 'VOICE_AGENT_CONFIG_PASSWORD',
                             'VOICE_AGENT_MONITOR_PASSWORD', 'VOICE_AGENT_RUNTIME_TOKEN',
                             'VOICE_AGENT_RECIPIENT_TOKEN', 'VOICE_AGENT_CHAT_TOKEN',
                             'SATELLITE_API_TOKEN', 'SATELLITE_PGSQL_PASSWORD'), 'synthetic')
    secrets.update(OPENAI_API_KEY='first', MARIADB_ROOT_PASSWORD='forbidden')
    calls, routes, units = [], [], set()
    tasks = SimpleNamespace(run=lambda **kw: routes.append(kw['data']) or {'exit_code': 0})
    sdk = SimpleNamespace(read_envfile=lambda name: dict(env if name == 'environment' else secrets),
                          mset_env=env.update, tasks=tasks, set_route=routes.append,
                          resolve_agent_id=lambda _: 'traefik-test', assert_exp=lambda ok: ok)
    monkeypatch.setitem(sys.modules, 'agent', sdk)
    monkeypatch.setitem(sys.modules, 'agent.tasks', tasks)
    # Import the SDK against this test's instance rather than an earlier fixture.
    monkeypatch.delitem(sys.modules, 'voice_preview', raising=False)
    state = SimpleNamespace(env=env, secrets=secrets, calls=calls, routes=routes, units=units,
                            busy=False, reject=False, native_calls=0, pg_history=False)

    def command(args, **kwargs):
        args = list(args)
        calls.append(args)
        rc, output, stderr = 0, b'', None
        if args[:2] == ['systemctl', '--user']:
            if args[2] == 'is-active':
                rc = 0 if args[-1] in units else 3
            elif args[2] in ('enable', 'disable') and '--now' in args:
                for unit in args[4:]:
                    if args[2] == 'enable':
                        units.add(unit)
                    else:
                        units.discard(unit)
            elif args[2] == 'stop':
                units.discard(args[-1])
        elif args[:3] == ['podman', 'image', 'inspect']:
            output = b'image-id'
        elif args[-1] == 'core show channels count':
            output = f"{state.native_calls} active calls\n"
        elif args[-1] == 'voice_agent.drain':
            rc = 75 if state.busy else 0
        elif args[:4] == ['podman', 'exec', 'satellite-pgsql', 'psql']:
            output = b't\n' if state.pg_history else b'f\n'
        elif args[-1].endswith('install-runtime.php'):
            rc = int(bool(state.reject))
            stderr = state.reject if isinstance(state.reject, bytes) else None
        result = subprocess.CompletedProcess(args, rc, output, stderr)
        if kwargs.get('check'):
            result.check_returncode()
        return result

    monkeypatch.setattr(subprocess, 'run', command)
    state.apply = runpy.run_path(str(ROOT / 'bin/satellite-reconcile'))['apply']
    monkeypatch.setitem(state.apply.__globals__, 'wait_for_agents',
                        lambda port, token: calls.append(['ready', port, token]))
    return state


@pytest.mark.parametrize('action', ['configure-module/94voice_agents', 'set-integrations/50manage_service'])
def test_actions_only_queue_on_configured_instances(installation, action, monkeypatch):
    monkeypatch.delenv('NETHVOICE_HOST')
    runpy.run_path(str(ROOT / 'actions' / action))
    assert not installation.calls
    monkeypatch.setenv('NETHVOICE_HOST', 'pbx.example')
    runpy.run_path(str(ROOT / 'actions' / action))
    assert Path('satellite-apply.pending').exists()
    assert installation.calls[-1][-1] == 'satellite-apply.path'


@pytest.mark.parametrize('agents,transcription', [(False, False), (True, False), (False, True), (True, True)])
def test_effective_service_matrix(installation, agents, transcription):
    s = installation
    s.env.update(VOICE_AGENT_ENABLED=str(agents), SATELLITE_VOICEMAIL_TRANSCRIPTION_ENABLED=str(transcription))
    assert s.apply()
    assert ('satellite.service' in s.units) == (agents or transcription)
    assert ('satellite-pgsql.service' in s.units) == transcription
    assert ('voice-agent-retention.timer' in s.units) == agents
    assert Path('voice-preview/enabled').exists() == agents
    assert any(c[-1].endswith('install-runtime.php') for c in s.calls) == agents
    assert s.routes == [{'instance': 'nethvoice-test-voice-agent-webhooks'}]
    if agents or transcription:
        projection = Path('satellite.env').read_text()
        assert 'forbidden' not in projection
        assert ('VOICE_AGENT_RUNTIME_TOKEN=' in projection) == agents
    s.calls.clear()
    assert s.apply()
    assert not any('stop' in c or 'enable' in c for c in s.calls)


def test_drain_and_key_generation(installation):
    s = installation
    s.env['VOICE_AGENT_ENABLED'] = 'true'
    assert s.apply()
    s.secrets['OPENAI_API_KEY'] = 'second'
    s.busy = True
    assert not s.apply()
    for file in ('satellite.env', 'voice-preview/effective.env'):
        assert 'OPENAI_API_KEY=first' in Path(file).read_text()
    s.busy = False
    assert s.apply()
    for file in ('satellite.env', 'voice-preview/effective.env'):
        assert 'OPENAI_API_KEY=second' in Path(file).read_text()


def test_schema_failure_leaves_transcription_running(installation):
    s = installation
    s.env.update(VOICE_AGENT_ENABLED='true', SATELLITE_CALL_TRANSCRIPTION_ENABLED='True')
    s.reject = True
    with pytest.raises(subprocess.CalledProcessError):
        s.apply()
    assert 'satellite.service' in s.units
    assert 'VOICE_AGENT_ENABLED=false' in Path('satellite.env').read_text()
    assert not Path('voice-preview/enabled').exists()


def test_webhook_only_on_explicit_lab_enable_and_historical_pg_is_preserved(installation):
    s = installation
    s.env.update(VOICE_AGENT_ENABLED='true', VOICE_AGENT_SIP_LAB_ENABLED='true',
                 SATELLITE_CALL_TRANSCRIPTION_ENABLED='True')
    assert s.apply()
    assert s.routes[-1]['url'] == 'http://127.0.0.1:30042'
    s.env.update(VOICE_AGENT_ENABLED='false', SATELLITE_CALL_TRANSCRIPTION_ENABLED='False')
    assert s.apply()
    assert s.routes[-1] == {'instance': 'nethvoice-test-voice-agent-webhooks'}
    assert 'satellite-pgsql.service' in s.units
    assert 'satellite.service' not in s.units


def test_native_pbx_activity_does_not_close_running_satellite_admission(installation):
    s = installation
    s.env['VOICE_AGENT_ENABLED'] = 'true'
    assert s.apply()
    s.native_calls = 1
    s.env['SATELLITE_VOICEMAIL_TRANSCRIPTION_ENABLED'] = 'True'
    s.calls.clear()
    assert not s.apply()
    assert not any('voice_agent.drain' in command for command in s.calls)
    assert 'satellite.service' in s.units


def test_satellite_readiness_failure_keeps_the_candidate_disabled(installation, monkeypatch):
    s = installation
    s.env['VOICE_AGENT_ENABLED'] = 'true'

    def unavailable(port, token):
        raise RuntimeError('voice_agent_runtime_not_ready')

    monkeypatch.setitem(s.apply.__globals__, 'wait_for_agents', unavailable)
    with pytest.raises(RuntimeError, match='voice_agent_runtime_not_ready'):
        s.apply()
    assert not Path('voice-preview/enabled').exists()
    assert not Path('voice-preview/effective.env').exists()
    assert json.loads(Path('satellite-applied.json').read_text())['applying']


@pytest.mark.parametrize('failure,reason', [
    ('ports', 'port_allocation_failed'),
    (b'unsupported_development_database\n', 'unsupported_development_database'),
    (b'runtime_initialization_failed\n', 'runtime_initialization_failed'),
    (b'PHP Fatal error: synthetic-secret\n', 'apply_failed'),
    ('ready', 'voice_agent_runtime_not_ready'),
    ('other', 'apply_failed')])
def test_failed_apply_records_a_stable_reason(installation, monkeypatch, capsys, failure, reason):
    s = installation
    s.env['VOICE_AGENT_ENABLED'] = 'true'
    if failure == 'ports':
        s.env['TCP_PORTS_RANGE'] = ''
        monkeypatch.setattr(sys.modules['agent'], 'allocate_ports',
                            lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError('max_ports_exceeded')), raising=False)
    elif failure in ('ready', 'other'):
        message = 'voice_agent_runtime_not_ready' if failure == 'ready' else 'synthetic-secret'
        monkeypatch.setitem(s.apply.__globals__, 'wait_for_agents',
                            lambda port, token: (_ for _ in ()).throw(RuntimeError(message)))
    else:
        s.reject = failure
    main = s.apply.__globals__['main']
    monkeypatch.setattr(s.apply.__globals__['time'], 'sleep', lambda _: None)
    Path('satellite-apply.pending').touch()
    with pytest.raises(Exception):
        main()
    assert Path('satellite-apply.failed').read_text() == reason + '\n'
    assert not Path('satellite-apply.running').exists()
    capsys.readouterr()
    runpy.run_path(str(ROOT / 'actions/get-integrations/20read'))
    output = json.loads(capsys.readouterr().out)
    assert output['satellite_apply_status'] == 'failed' and output['satellite_apply_error'] == reason
    assert 'secret' not in json.dumps(output['satellite_apply_error'])
    s.reject = False
    monkeypatch.setitem(s.apply.__globals__, 'wait_for_agents', lambda port, token: None)
    s.env['TCP_PORTS_RANGE'] = '30000-30045'
    Path('satellite-apply.pending').touch()
    main()
    assert not Path('satellite-apply.failed').exists()
    runpy.run_path(str(ROOT / 'actions/get-integrations/20read'))
    output = json.loads(capsys.readouterr().out)
    assert output['satellite_apply_status'] == 'applied' and output['satellite_apply_error'] is None


def test_worker_recovers_a_transient_readiness_failure(installation, monkeypatch):
    s = installation
    s.env['VOICE_AGENT_ENABLED'] = 'true'
    attempts = []
    delays = []

    def wait_for_agents(port, token):
        attempts.append(port)
        if len(attempts) == 1:
            raise RuntimeError('voice_agent_runtime_not_ready')

    monkeypatch.setitem(s.apply.__globals__, 'wait_for_agents', wait_for_agents)
    monkeypatch.setattr(s.apply.__globals__['time'], 'sleep', delays.append)
    Path('satellite-apply.pending').touch()
    s.apply.__globals__['main']()
    assert len(attempts) == 2 and delays == [5]
    assert Path('voice-preview/enabled').exists()
    assert not Path('satellite-apply.failed').exists()


def test_optional_postgresql_stops_without_disabling_cti(installation):
    s = installation
    s.units.update(('satellite-pgsql.service', 'nethcti-middleware.service'))
    assert s.apply()
    assert 'satellite-pgsql.service' not in s.units
    assert 'nethcti-middleware.service' in s.units
    service = (ROOT / 'systemd/user/nethcti-middleware.service').read_text()
    assert 'Requires=mariadb.service\n' in service and 'PartOf=satellite-pgsql.service' not in service
    s.env['SATELLITE_CALL_SUMMARY_ENABLED'] = 'true'
    assert s.apply()
    assert 'satellite-pgsql.service' in s.units
    assert 'satellite.service' not in s.units


def test_legacy_cti_history_keeps_postgresql_on_after_upgrade(installation):
    s = installation
    s.units.add('satellite-pgsql.service')
    s.pg_history = True
    assert s.apply()
    assert 'satellite-pgsql.service' in s.units and 'satellite.service' not in s.units
    assert json.loads(Path('satellite-applied.json').read_text())['historical_postgresql']


@pytest.mark.parametrize('volume,active', [(False, False), (True, False), (True, True)])
def test_backup_saves_stopped_postgresql_and_restores_its_state(tmp_path, volume, active):
    (tmp_path / 'passwords.env').write_text('MARIADB_ROOT_PASSWORD=synthetic\n')
    systemctl = tmp_path / 'systemctl'
    systemctl.write_text('''#!/bin/sh
printf "%s\\n" "$*" >> units
case "$*" in
    *is-active*) test "$TEST_PG_ACTIVE" = true ;;
    *is-enabled*) exit 1 ;;
esac
''')
    podman = tmp_path / 'podman'
    podman.write_text('''#!/bin/sh
case "$*" in
    "volume exists satellite_pgdata") test "$TEST_PG_VOLUME" = true ;;
    "volume inspect"*) exit 1 ;;
    "exec satellite-pgsql pg_dumpall -U satellite") printf 'synthetic dump' ;;
esac
''')
    for path in (systemctl, podman):
        path.chmod(0o755)
    subprocess.run(['/bin/sh', str(ROOT / 'bin/module-dump-state')], cwd=tmp_path, check=True, env=dict(
        os.environ, PATH=str(tmp_path)+os.pathsep+os.environ['PATH'],
        TEST_PG_VOLUME=str(volume).lower(), TEST_PG_ACTIVE=str(active).lower()))
    dump = tmp_path / 'satellite_postgresql.pg_dump.gz'
    commands = (tmp_path / 'units').read_text().splitlines()
    if volume:
        assert gzip.decompress(dump.read_bytes()) == b'synthetic dump'
    else:
        assert not dump.exists()
    if volume and not active:
        assert commands[-3:] == ['--user start satellite-pgsql.service',
                                  '--user --quiet is-enabled satellite-pgsql.service',
                                  '--user stop satellite-pgsql.service']
    else:
        assert commands == ['--user --quiet is-active satellite-pgsql.service']


def test_inherited_key_rotation_only_restarts_satellite(installation):
    s = installation
    s.env.update(VOICE_AGENT_ENABLED='true', CHAT_ENABLED='true')
    assert s.apply()
    s.calls.clear()
    s.secrets['OPENAI_API_KEY'] = 'rotated'
    assert s.apply()
    assert ['systemctl', '--user', 'stop', 'satellite.service'] in s.calls
    assert not any({'apache2ctl', 'fwconsole', 'chat-gateway.service', 'freepbx.service'}.intersection(call)
                   or call[-1].endswith('configure-agent-recipient') for call in s.calls)
    s.secrets['OPENAI_API_KEY'] = ''
    assert s.apply()
    assert ['podman', 'exec', 'freepbx', 'fwconsole', 'reload'] in s.calls


def test_update_refresh_restarts_chat_gateway_once_after_settings(installation):
    s = installation
    s.env.update(VOICE_AGENT_ENABLED='true', CHAT_ENABLED='true')
    Path('chat-gateway-refresh.pending').touch()
    Path('satellite-apply.pending').touch()
    s.apply.__globals__['main']()
    restarts = [command for command in s.calls if command[-1] == 'chat-gateway.service'
                and command[2] in ('restart','try-restart')]
    assert restarts == [['systemctl', '--user', 'restart', 'chat-gateway.service']]
    assert s.calls.index(restarts[0]) > s.calls.index(['ready', '30042', 'synthetic'])
    assert not Path('chat-gateway-refresh.pending').exists()


def test_integrations_only_runs_chat_actions_for_chat_changes(tmp_path, monkeypatch):
    env, passwords = {'CHAT_ENABLED':'true'}, {}
    agent = SimpleNamespace(read_envfile=lambda name: dict(env if name=='environment' else passwords),
                            set_env=env.__setitem__, write_envfile=lambda name, data: passwords.update(data))
    monkeypatch.setitem(sys.modules, 'agent', agent)
    monkeypatch.chdir(tmp_path)
    commands = tmp_path / 'actions' / 'configure-module'
    commands.mkdir(parents=True)
    for path in (commands / '45chat_routes', commands / '46chat', tmp_path / 'systemctl'):
        path.write_text('#!/bin/sh\nprintf "%s\\n" "${0##*/}" >> calls\n')
        path.chmod(0o755)
    monkeypatch.setenv('AGENT_INSTALL_DIR', str(tmp_path))
    monkeypatch.setenv('PATH', str(tmp_path), prepend=os.pathsep)

    def save(**values):
        monkeypatch.setattr(sys, 'stdin', io.StringIO(json.dumps(values)))
        runpy.run_path(str(ROOT / 'actions/set-integrations/20setenvs'))
        subprocess.run(['/bin/bash', str(ROOT / 'actions/set-integrations/60chat')], check=True)

    save(voice_agent_enabled=True, chat_enabled=True, chat_retention_days=365)
    assert not Path('calls').exists()
    save(chat_retention_days=42)
    assert Path('calls').read_text().splitlines() == ['46chat']
    save(chat_enabled=False)
    assert Path('calls').read_text().splitlines() == ['46chat', '45chat_routes', '46chat', 'systemctl']


def test_legacy_empty_failure_flag_is_reported_generically(installation, capsys):
    Path('satellite-apply.failed').touch()
    runpy.run_path(str(ROOT / 'actions/get-integrations/20read'))
    output = json.loads(capsys.readouterr().out)
    assert output['satellite_apply_status'] == 'failed' and output['satellite_apply_error'] == 'apply_failed'


@pytest.mark.parametrize('old_image', [False, True])
def test_integrations_reports_preview_impact(installation, monkeypatch, capsys, old_image):
    Path('voice-preview').mkdir(exist_ok=True)
    Path('voice-preview/enabled').touch()
    impact = [{'agent_id':'receptionist','name':'Synthetic Receptionist','fallback_destination_id':'extension:203'}]
    names = ['Synthetic Receptionist']
    inventory = names if old_image else {'inherited_agents':names, 'voice_agent_preview_impact':impact}

    def inventory_result(command, **kwargs):
        assert command[-1] == '--include-preview-impact' and kwargs['timeout'] == 10
        return subprocess.CompletedProcess(command, 0, json.dumps(inventory))

    monkeypatch.setattr(subprocess, 'run', inventory_result)
    runpy.run_path(str(ROOT / 'actions/get-integrations/20read'))
    output = json.loads(capsys.readouterr().out)
    assert output['inherited_agents'] == names
    assert output['voice_agent_preview_impact'] == (None if old_image else impact)


def test_disabled_worker_retires_old_grants_after_applying_state(installation):
    s = installation
    main = s.apply.__globals__['main']
    s.env['VOICE_AGENT_ENABLED'] = 'true'
    Path('satellite-apply.pending').touch()
    main()
    assert not any('--disable-accounts' in command for command in s.calls)
    s.env['VOICE_AGENT_ENABLED'] = 'false'
    Path('satellite-apply.pending').touch()
    main()
    stop = next(index for index, command in enumerate(s.calls) if command[2:] == ['stop', 'satellite.service'])
    retire = next(index for index, command in enumerate(s.calls) if command[-1] == '--disable-accounts')
    assert stop < retire
    s.calls.clear()
    Path('satellite-apply.pending').touch()
    main()
    assert any(command[-1] == '--disable-accounts' for command in s.calls)
