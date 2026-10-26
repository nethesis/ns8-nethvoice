"""Model the NS8 service state across consolidation and transcription toggles."""
import json
import os
from pathlib import Path
import runpy
import subprocess
import sys
from types import SimpleNamespace
from unittest.mock import patch

import pytest


ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture(params=['configure-module/94voice_agents', 'set-integrations/50manage_service'])
def action(request):
    return ROOT / 'imageroot/actions' / request.param


class Services:
    def __init__(self, legacy):
        self.active = {'satellite.service', 'satellite-mqtt.service',
                       'satellite-pgsql.service', 'satellite-recordings-cleanup.timer'}
        self.enabled = set(self.active)
        if legacy:
            self.active.add('voice-agent.service')
            self.enabled.add('voice-agent.service')
        self.legacy = legacy
        self.orphan = True
        self.calls = []
        self.idle = True
        self.fail_legacy_stop = False
        self.image = "synthetic-image-id"

    def run(self, args, **kwargs):
        self.calls.append(args)
        if args[0] == 'restart-services-when-convenient':
            assert args[1:] == ['--wait-only']
            if not self.idle:
                raise subprocess.CalledProcessError(1, args)
            return subprocess.CompletedProcess(args, 0)
        if args[:3] == ['podman', 'image', 'inspect']:
            return subprocess.CompletedProcess(args, 0, stdout=self.image)
        if args[:2] == ['podman', 'exec']:
            return subprocess.CompletedProcess(args, 0)
        if args[:2] == ['podman', 'rm']:
            assert 'voice-agent.service' not in self.active
            assert '--volumes' not in args and '-v' not in args
            self.orphan = False
        else:
            assert args[:2] == ['systemctl', '--user']
            action = args[2]
            if action == 'daemon-reload':
                return subprocess.CompletedProcess(args, 0)
            if action == 'is-active':
                return subprocess.CompletedProcess(args, 0 if args[-1] in self.active else 3)
            if action == 'disable' and 'voice-agent.service' in args and self.fail_legacy_stop:
                raise subprocess.CalledProcessError(1, args)
            if action == 'show':
                return subprocess.CompletedProcess(args, 0, stdout='loaded' if self.legacy else 'not-found')
            services = [arg for arg in args[3:] if not arg.startswith('-')]
            if action == 'enable':
                self.enabled.update(services)
                if '--now' in args:
                    self.active.update(services)
            elif action == 'disable':
                self.enabled.difference_update(services)
                if '--now' in args:
                    self.active.difference_update(services)
            elif action == 'start':
                if 'satellite.service' in services:
                    assert not self.orphan and 'voice-agent.service' not in self.active
                self.active.update(services)
            elif action == 'try-restart':
                pass
            elif action == 'stop':
                self.active.difference_update(services)
            else:
                raise AssertionError(action)
        return subprocess.CompletedProcess(args, 0)


def apply(services, action):
    with patch('subprocess.run', side_effect=services.run):
        runpy.run_path(str(action))


@pytest.fixture(autouse=True)
def state(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv('NETHVOICE_SATELLITE_IMAGE', 'synthetic-image')
    monkeypatch.setenv('AGENT_INSTALL_DIR', str(ROOT / 'imageroot'))
    values = {'environment': {}, 'passwords.env': {
        'SATELLITE_ARI_PASSWORD': 'synthetic-ari',
        'SATELLITE_API_TOKEN': 'synthetic-api',
        'SATELLITE_PGSQL_PASSWORD': 'synthetic-pg',
        'MARIADB_ROOT_PASSWORD': 'synthetic-root',
    }}

    def write(name, settings):
        values[name] = dict(settings)
        Path(name).write_text(json.dumps(settings, sort_keys=True))

    agent = SimpleNamespace(
        read_envfile=lambda name: dict(values[name]), write_envfile=write,
        set_env=lambda name, value: values['environment'].update({name: value}))
    monkeypatch.setitem(sys.modules, 'agent', agent)
    return values


@pytest.mark.parametrize('legacy', [False, True])
@pytest.mark.parametrize('call,voicemail', [('False', 'False'), ('True', 'False'),
                                          ('False', 'True'), ('True', 'True')])
def test_agents_survive_transcription_changes_and_legacy_is_retired(action, legacy, call, voicemail):
    services = Services(legacy)
    with patch.dict('os.environ', {'SATELLITE_CALL_TRANSCRIPTION_ENABLED': call,
                                 'SATELLITE_VOICEMAIL_TRANSCRIPTION_ENABLED': voicemail}):
        # Repeated configuration is safe and cannot re-enable the retired runner.
        apply(services, action)
        apply(services, action)
    assert services.calls.count(['systemctl', '--user', 'stop', 'satellite.service']) == 1
    assert 'satellite.service' in services.active & services.enabled
    assert 'voice-agent.service' not in services.active | services.enabled
    assert 'satellite-pgsql.service' in services.active
    transcription = 'True' in (call, voicemail)
    for name in ('satellite-mqtt.service', 'satellite-recordings-cleanup.timer'):
        assert (name in services.active) == transcription
        assert (name in services.enabled) == transcription


def test_failed_legacy_stop_prevents_duplicate_ari_consumer(action):
    services = Services(True)
    services.fail_legacy_stop = True
    with pytest.raises(subprocess.CalledProcessError):
        apply(services, action)
    assert not any('start' in call for call in services.calls)


def test_changed_environment_waits_for_idle_and_unrelated_settings_do_not_restart(action, monkeypatch):
    services = Services(False)
    apply(services, action)
    monkeypatch.setenv('NETHVOICE_HOST', 'other.example.org')
    apply(services, action)
    assert services.calls.count(['systemctl', '--user', 'stop', 'satellite.service']) == 1
    monkeypatch.setenv('SATELLITE_HTTP_PORT', '31000')
    services.idle = False
    with pytest.raises(subprocess.CalledProcessError):
        apply(services, action)
    assert services.calls.count(['systemctl', '--user', 'stop', 'satellite.service']) == 1
    services.idle = True
    apply(services, action)
    assert services.calls.count(['systemctl', '--user', 'stop', 'satellite.service']) == 2
    services.image = 'replacement-image-id'
    apply(services, action)
    assert services.calls.count(['systemctl', '--user', 'stop', 'satellite.service']) == 3


def test_upgrade_defers_consolidation_until_call_safe_restart(tmp_path):
    log = tmp_path / 'commands'
    stub = tmp_path / 'stub'
    stub.write_text(f'''#!{sys.executable}
from pathlib import Path
import json
from types import SimpleNamespace
import os, sys
with open(os.environ['TEST_COMMAND_LOG'], 'a') as log:
    log.write(Path(sys.argv[0]).name + ' ' + ' '.join(sys.argv[1:]) + '\\n')
''')
    stub.chmod(0o755)
    for name in ('systemctl', 'runagent', 'restart-services-when-convenient', 'podman'):
        (tmp_path / name).symlink_to(stub)
    env = dict(os.environ, PATH=str(tmp_path) + os.pathsep + os.environ['PATH'],
               TEST_COMMAND_LOG=str(log), NETHVOICE_FREEPBX_IMAGE='synthetic-freepbx',
               AGENT_INSTALL_DIR=str(ROOT / 'imageroot'))
    for name in ('70enable', '80restart'):
        subprocess.run(['bash', str(ROOT / 'imageroot/update-module.d' / name)],
                       cwd=tmp_path, env=env, check=True, capture_output=True)
    calls = log.read_text().splitlines()
    restart = next(i for i, call in enumerate(calls) if call.startswith('restart-services-when-convenient '))
    configure = 'runagent ' + str(ROOT / 'imageroot/actions/configure-module/94voice_agents')
    consolidate = calls.index(configure)
    assert restart < consolidate
    assert calls.count(configure) == 1
    assert calls[restart].startswith('restart-services-when-convenient --stop ')
    assert 'satellite' in calls[restart].split()[2:]
    assert 'systemctl --user start satellite' not in calls
    assert calls.index('systemctl --user start freepbx') < consolidate
    assert not any({'voice-agent', 'voice-agent.service'} & set(call.split()) for call in calls)


def test_credentials_are_filtered_and_changes_require_a_call_safe_restart(action, state):
    services = Services(False)
    apply(services, action)
    secrets = dict(state['passwords.env'])
    fingerprint = Path('satellite-runtime.sha256').read_text()
    assert 'MARIADB_ROOT_PASSWORD' not in state['satellite.env']
    assert Path('satellite.env').stat().st_mode & 0o777 == 0o600
    assert Path('passwords.env').stat().st_mode & 0o777 == 0o600
    apply(services, action)
    assert state['passwords.env'] == secrets
    assert services.calls.count(['systemctl', '--user', 'stop', 'satellite.service']) == 1
    if action.parent.name == 'configure-module':
        assert services.calls.count(['systemctl', '--user', 'enable', '--now',
                                     'voice-agent-retention.timer']) == 2
    else:
        for name in ('freepbx.service', 'nethcti-server.service', 'nethcti-ui.service'):
            assert services.calls.count(['systemctl', '--user', 'try-restart', name]) == 2
    state['passwords.env']['OPENAI_API_KEY'] = 'synthetic-new-provider'
    services.idle = False
    with pytest.raises(subprocess.CalledProcessError):
        apply(services, action)
    assert Path('satellite-runtime.sha256').read_text() == fingerprint
    assert services.calls.count(['systemctl', '--user', 'stop', 'satellite.service']) == 1
    services.idle = True
    apply(services, action)
    assert state['satellite.env']['OPENAI_API_KEY'] == 'synthetic-new-provider'
    assert Path('satellite-runtime.sha256').read_text() != fingerprint
    assert services.calls.count(['systemctl', '--user', 'stop', 'satellite.service']) == 2
