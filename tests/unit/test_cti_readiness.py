# SPDX-License-Identifier: GPL-3.0-or-later
import os
from pathlib import Path
import shlex
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class CTIReadinessTest(unittest.TestCase):
    def test_waits_for_the_cli_socket_and_times_out_on_a_regular_file(self):
        unit = (ROOT / 'imageroot/systemd/user/nethcti-server.service').read_text()
        command = next(line.removeprefix('ExecStartPost=') for line in unit.splitlines()
                       if line.startswith('ExecStartPost='))
        args = shlex.split(command)
        self.assertEqual(args[:6], ['/usr/bin/podman', 'exec', 'nethcti-server', 'timeout', '60', 'sh'])
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            endpoint = root / 'nethcti.sock'
            args[-1] = args[-1].replace('/run/nethvoice/nethcti.sock', str(endpoint))
            sleeper = root / 'sleep'
            sleeper.write_text(f'#!{sys.executable}\n' + '''import os,socket,sys
from pathlib import Path
root=Path(os.environ['CHECK_DIR'])
with (root/'intervals').open('a') as output: output.write(sys.argv[1]+'\\n')
if len((root/'intervals').read_text().splitlines())==2:
    with socket.socket(socket.AF_UNIX) as endpoint: endpoint.bind(str(root/'nethcti.sock'))
''')
            sleeper.chmod(0o755)
            result = subprocess.run(args[3:], env=dict(os.environ, PATH=directory+':'+os.environ['PATH'],
                                    CHECK_DIR=directory), capture_output=True, text=True, timeout=5)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual((root/'intervals').read_text().splitlines(), ['1', '1'])
            endpoint.unlink()
            endpoint.touch()
            args[4] = '0.1'
            result = subprocess.run(args[3:], capture_output=True, text=True, timeout=5)
            self.assertNotEqual(result.returncode, 0)


if __name__ == '__main__':
    unittest.main()
