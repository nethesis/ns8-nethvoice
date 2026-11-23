"""The module builds Satellite from its own checkout."""
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]


def test_satellite_build_uses_local_source(tmp_path):
    stub = tmp_path / 'buildah'
    calls = tmp_path / 'calls'
    stub.write_text(f'#!{sys.executable}\n' + '''import json, os, sys
with open(os.environ['TEST_BUILD_CALLS'], 'a') as output:
    output.write(json.dumps([os.getcwd(), sys.argv[1:]]) + '\\n')
''')
    stub.chmod(0o755)
    env = dict(os.environ, PATH=str(tmp_path) + os.pathsep + os.environ['PATH'],
               BUILD_IMAGES='satellite', REPOBASE='localhost/test-nethvoice', REUSE_IMAGES='',
               BUILD_TIMING_FILE=str(tmp_path / 'timings'), CI='', IMAGETAG='test',
               TEST_BUILD_CALLS=str(calls))
    result = subprocess.run(['bash', 'build-images.sh'], cwd=ROOT, env=env,
                            capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    [(directory, command)] = [json.loads(line) for line in calls.read_text().splitlines()]
    assert Path(directory) == ROOT / 'satellite'
    assert command[0] == 'build'
    assert command[-4:] == ['--tag', 'localhost/test-nethvoice/nethvoice-satellite',
                            '--tag', 'localhost/test-nethvoice/nethvoice-satellite:test']
