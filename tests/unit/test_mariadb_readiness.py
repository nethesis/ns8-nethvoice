# SPDX-License-Identifier: GPL-3.0-or-later
import os
from pathlib import Path
import shlex
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class MariaDBReadinessTest(unittest.TestCase):
    def test_authenticated_query_retries_every_second_until_ready(self):
        unit = (ROOT / 'imageroot/systemd/user/mariadb.service').read_text()
        command = next(line.removeprefix('ExecStartPost=') for line in unit.splitlines()
                       if line.startswith('ExecStartPost='))
        args = shlex.split(command)
        self.assertEqual(args[:4], ['podman', 'exec', 'mariadb', 'bash'])
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            database = root / 'mariadb'
            database.write_text('''#!/bin/bash
test "$*" = '-ufixture -pfixture -h127.0.0.1 -P3306 asterisk -e SHOW TABLES' || exit 2
echo attempt >> "$CHECK_DIR/attempts"
test "$(wc -l < "$CHECK_DIR/attempts")" -ge 3
''')
            sleeper = root / 'sleep'
            sleeper.write_text('#!/bin/sh\necho "$1" >> "$CHECK_DIR/intervals"\n')
            database.chmod(0o755)
            sleeper.chmod(0o755)
            result = subprocess.run(args[3:], env=dict(os.environ, PATH=directory+':'+os.environ['PATH'],
                                    CHECK_DIR=directory, AMPDBUSER='fixture', AMPDBPASS='fixture',
                                    NETHVOICE_MARIADB_PORT='3306'), capture_output=True, text=True, timeout=5)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual((root / 'attempts').read_text().splitlines(), ['attempt'] * 3)
            self.assertEqual((root / 'intervals').read_text().splitlines(), ['1', '1'])


if __name__ == '__main__':
    unittest.main()
