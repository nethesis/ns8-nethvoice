"""Packaging requires the shared entry point and adds no subprocess launcher."""
import json
import os
from pathlib import Path
import subprocess
import sys

import pytest

ROOT = Path(__file__).resolve().parents[2]


@pytest.mark.parametrize('imports_available', [True, False])
def test_satellite_build_uses_the_shared_application(tmp_path, imports_available):
    stub = tmp_path / 'buildah'
    calls = tmp_path / 'calls'
    stub.write_text(f'#!{sys.executable}\n' + '''import json, os, sys
with open(os.environ['TEST_BUILD_CALLS'], 'a') as output:
    output.write(json.dumps(sys.argv[1:]) + '\\n')
if sys.argv[1] == 'from': print('test-container')
if sys.argv[1] == 'run' and os.environ['TEST_IMPORTS'] == '0': sys.exit(1)
''')
    stub.chmod(0o755)
    env = dict(os.environ, PATH=str(tmp_path) + os.pathsep + os.environ['PATH'],
               BUILD_IMAGES='satellite', SATELLITE_IMAGE='localhost/satellite:shared-test',
               BUILD_TIMING_FILE=str(tmp_path / 'timings'), CI='', IMAGETAG='test',
               TEST_BUILD_CALLS=str(calls), TEST_IMPORTS=str(int(imports_available)))
    result = subprocess.run(['bash', 'build-images.sh'], cwd=ROOT, env=env,
                            capture_output=True, text=True)
    commands = [json.loads(line) for line in calls.read_text().splitlines()]
    assert commands[0] == ['from', 'localhost/satellite:shared-test']
    assert 'from main import run' in commands[1][-1]
    assert not any(command[0] in ('build', 'add') for command in commands)
    if imports_available:
        assert result.returncode == 0, result.stderr
        assert ['config', '--user', '65532:65532', '--cmd',
                '["python", "/app/main.py"]', 'test-container'] in commands
    else:
        assert result.returncode != 0
        assert commands[-1] == ['rm', 'test-container']
        assert not any(command[0] == 'commit' for command in commands)
