"""Model the NS8 service state across consolidation and transcription toggles."""
from pathlib import Path
import os
import runpy
import subprocess
import sys
from unittest.mock import patch

import pytest


ROOT = Path(__file__).resolve().parents[2]
HELPER = ROOT / 'imageroot/bin/manage-satellite'


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
        if args[0] == 'configure-voice-agents':
            return subprocess.CompletedProcess(args, 0)
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
            elif action == 'stop':
                self.active.difference_update(services)
            else:
                raise AssertionError(action)
        return subprocess.CompletedProcess(args, 0)


def apply(services):
    with patch('subprocess.run', side_effect=services.run):
        try:
            runpy.run_path(str(HELPER))
        except SystemExit as result:
            assert result.code == 0


@pytest.fixture(autouse=True)
def state(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv('NETHVOICE_SATELLITE_IMAGE', 'synthetic-image')
    (tmp_path / 'satellite.env').write_text('synthetic-credentials')


@pytest.mark.parametrize('legacy', [False, True])
@pytest.mark.parametrize('call,voicemail', [('False', 'False'), ('True', 'False'),
                                          ('False', 'True'), ('True', 'True')])
def test_agents_survive_transcription_changes_and_legacy_is_retired(legacy, call, voicemail):
    services = Services(legacy)
    with patch.dict('os.environ', {'SATELLITE_CALL_TRANSCRIPTION_ENABLED': call,
                                 'SATELLITE_VOICEMAIL_TRANSCRIPTION_ENABLED': voicemail}):
        # Repeated configuration is safe and cannot re-enable the retired runner.
        apply(services)
        apply(services)
    assert services.calls.count(['systemctl', '--user', 'stop', 'satellite.service']) == 1
    assert 'satellite.service' in services.active & services.enabled
    assert 'voice-agent.service' not in services.active | services.enabled
    assert 'satellite-pgsql.service' in services.active
    transcription = 'True' in (call, voicemail)
    for name in ('satellite-mqtt.service', 'satellite-recordings-cleanup.timer'):
        assert (name in services.active) == transcription
        assert (name in services.enabled) == transcription


def test_failed_legacy_stop_prevents_duplicate_ari_consumer():
    services = Services(True)
    services.fail_legacy_stop = True
    with pytest.raises(subprocess.CalledProcessError):
        apply(services)
    assert not any('start' in call for call in services.calls)


def test_changed_environment_waits_for_idle_and_unrelated_settings_do_not_restart(monkeypatch):
    services = Services(False)
    apply(services)
    monkeypatch.setenv('NETHVOICE_HOST', 'other.example.org')
    apply(services)
    assert services.calls.count(['systemctl', '--user', 'stop', 'satellite.service']) == 1
    monkeypatch.setenv('SATELLITE_HTTP_PORT', '31000')
    services.idle = False
    with pytest.raises(subprocess.CalledProcessError):
        apply(services)
    assert services.calls.count(['systemctl', '--user', 'stop', 'satellite.service']) == 1
    services.idle = True
    apply(services)
    assert services.calls.count(['systemctl', '--user', 'stop', 'satellite.service']) == 2
    services.image = 'replacement-image-id'
    apply(services)
    assert services.calls.count(['systemctl', '--user', 'stop', 'satellite.service']) == 3


def test_upgrade_defers_consolidation_until_call_safe_restart(tmp_path):
    log = tmp_path / 'commands'
    stub = tmp_path / 'stub'
    stub.write_text(f'''#!{sys.executable}
from pathlib import Path
import os, sys
with open(os.environ['TEST_COMMAND_LOG'], 'a') as log:
    log.write(Path(sys.argv[0]).name + ' ' + ' '.join(sys.argv[1:]) + '\\n')
''')
    stub.chmod(0o755)
    for name in ('systemctl', 'runagent', 'restart-services-when-convenient'):
        (tmp_path / name).symlink_to(stub)
    env = dict(os.environ, PATH=str(tmp_path) + os.pathsep + os.environ['PATH'],
               TEST_COMMAND_LOG=str(log))
    for name in ('70enable', '80restart'):
        subprocess.run(['bash', str(ROOT / 'imageroot/update-module.d' / name)],
                       env=env, check=True, capture_output=True)
    calls = log.read_text().splitlines()
    restart = next(i for i, call in enumerate(calls) if call.startswith('restart-services-when-convenient '))
    consolidate = calls.index('runagent manage-satellite')
    assert restart < consolidate
    assert calls.count('runagent manage-satellite') == 1
    assert 'satellite' not in calls[restart].split()[1:]
    assert not any({'voice-agent', 'voice-agent.service'} & set(call.split()) for call in calls)
