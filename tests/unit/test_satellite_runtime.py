"""Exercise the container supervisor with real, disposable component processes."""
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

import pytest


ROOT = Path(__file__).resolve().parents[2]
LAUNCHER = ROOT / 'satellite/nethvoice_runtime.py'
COMPONENT = '''
from pathlib import Path
import os
import signal
import sys
import time

role = ROLE
def stop(*_):
    Path(role + '.stopped').touch()
    sys.exit(0)
signal.signal(signal.SIGTERM, stop)
with open(role + '.starts', 'a') as starts:
    starts.write('start\\n')
Path(role + '.ready').touch()
if os.getenv('FAIL_COMPONENT') == role:
    deadline = time.monotonic() + 3
    while not all(Path(name + '.ready').exists() for name in ('agent', 'transcription')):
        if time.monotonic() >= deadline:
            sys.exit(99)
        time.sleep(0.01)
    sys.exit(int(os.environ['FAIL_STATUS']))
while True:
    time.sleep(0.1)
'''


@pytest.fixture
def components(tmp_path):
    (tmp_path / 'voice_agent').mkdir()
    (tmp_path / 'voice_agent/__init__.py').touch()
    (tmp_path / 'voice_agent/runner.py').write_text(COMPONENT.replace('ROLE', repr('agent')))
    (tmp_path / 'main.py').write_text(COMPONENT.replace('ROLE', repr('transcription')))
    return tmp_path


def start(directory, call='False', voicemail='False', **settings):
    env = dict(os.environ, SATELLITE_CALL_TRANSCRIPTION_ENABLED=call,
               SATELLITE_VOICEMAIL_TRANSCRIPTION_ENABLED=voicemail, **settings)
    # The supervisor's child modules are found in the container's /app workdir.
    env.pop('PYTHONPATH', None)
    return subprocess.Popen([sys.executable, str(LAUNCHER)], cwd=directory, env=env,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def wait_ready(process, directory, names):
    deadline = time.monotonic() + 5
    while not all((directory / (name + '.ready')).exists() for name in names):
        assert process.poll() is None, process.communicate()
        assert time.monotonic() < deadline, 'component startup timed out'
        time.sleep(0.01)


@pytest.mark.parametrize('call,voicemail', [('False', 'False'), ('True', 'False'),
                                          ('False', 'True'), ('True', 'True')])
@pytest.mark.parametrize('stop_signal', [signal.SIGTERM, signal.SIGINT])
def test_feature_modes_and_graceful_stop(components, call, voicemail, stop_signal):
    process = start(components, call, voicemail)
    names = ['agent'] + (['transcription'] if 'True' in (call, voicemail) else [])
    try:
        wait_ready(process, components, names)
        if names == ['agent']:
            assert not (components / 'transcription.ready').exists()
        process.send_signal(stop_signal)
        process.communicate(timeout=5)
        assert process.returncode == 0
        assert all((components / (name + '.stopped')).exists() for name in names)
    finally:
        if process.poll() is None:
            process.terminate()
            process.communicate(timeout=30)


def test_unresponsive_component_is_killed_after_shutdown_deadline(components):
    runner = components / 'voice_agent/runner.py'
    runner.write_text('''
from pathlib import Path
import os
import signal
import time
signal.signal(signal.SIGTERM, signal.SIG_IGN)
Path('agent.pid').write_text(str(os.getpid()))
Path('agent.ready').touch()
while True:
    time.sleep(0.1)
''')
    process = start(components)
    try:
        wait_ready(process, components, ['agent'])
        child_pid = int((components / 'agent.pid').read_text())
        process.terminate()
        process.communicate(timeout=30)
        assert process.returncode == 0
        with pytest.raises(ProcessLookupError):
            os.kill(child_pid, 0)
    finally:
        if process.poll() is None:
            process.terminate()
            process.communicate(timeout=30)


@pytest.mark.parametrize('component', ['agent', 'transcription'])
@pytest.mark.parametrize('status', ['0', '17'])
def test_component_exit_restarts_it_without_interrupting_sibling(components, component, status):
    process = start(components, 'True', FAIL_COMPONENT=component, FAIL_STATUS=status)
    try:
        wait_ready(process, components, ['agent', 'transcription'])
        deadline = time.monotonic() + 9
        while len((components / (component + '.starts')).read_text().splitlines()) < 2:
            assert process.poll() is None
            assert time.monotonic() < deadline
            time.sleep(0.01)
        sibling = 'transcription' if component == 'agent' else 'agent'
        assert not (components / (sibling + '.stopped')).exists()
        assert len((components / (sibling + '.starts')).read_text().splitlines()) == 1
        process.terminate()
        _, errors = process.communicate(timeout=5)
        assert process.returncode == 0
        assert b'restarting component' in errors
        assert (components / (sibling + '.stopped')).exists()
    finally:
        if process.poll() is None:
            process.terminate()
            process.communicate(timeout=30)
