"""Run the configure/Integrations entry points and the systemd apply job against a disposable state."""
import json
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
                            busy=False, reject=False)

    def command(args, **kwargs):
        args = list(args)
        calls.append(args)
        rc, output = 0, b''
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
        elif args[-1] == 'voice_agent.drain':
            rc = 75 if state.busy else 0
        elif args[-1].endswith('install-runtime.php'):
            rc = int(state.reject)
        result = subprocess.CompletedProcess(args, rc, output)
        if kwargs.get('check'):
            result.check_returncode()
        return result

    monkeypatch.setattr(subprocess, 'run', command)
    state.apply = runpy.run_path(str(ROOT / 'bin/satellite-reconcile'))['apply']
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
    assert not s.routes
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
