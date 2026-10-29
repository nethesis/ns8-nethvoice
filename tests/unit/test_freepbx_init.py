# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class FreepbxInitTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        (self.root / 'custom').mkdir()
        self.calls = self.root / 'calls'
        stub = self.root / 'stub'
        stub.write_text('''#!/bin/bash
echo "$(basename "$0") $*" >> "$TEST_CALLS"
case "$(basename "$0")" in
asterisk) echo 'Asterisk 22';;
fwconsole) if [[ "$*" == 'ma list' ]]; then echo '| core | 17.0 | Disabled |'; fi;;
su) exit "${TEST_RELOAD_EXIT:-0}";;
php) cat >/dev/null;;
esac
if [[ "$(basename "$0") $*" == "${TEST_FAILURE:-}" ]]; then exit 1; fi
''')
        stub.chmod(0o755)
        for name in ['asterisk', 'fwconsole', 'su', 'php', 'ionice', 'sleep', 'chmod']:
            (self.root / name).symlink_to(stub)
        script = (ROOT / 'freepbx/freepbx_init.sh').read_text()
        script = script.replace('/usr/sbin/asterisk', str(self.root / 'asterisk'))
        script = script.replace('/freepbx_custom_modules', str(self.root / 'custom'))
        self.ready = self.root / 'freepbx-ready'
        script = script.replace('/var/run/nethvoice/freepbx-ready', str(self.ready))
        script = script.replace('/var/run/nethvoice/freepbx-failed', str(self.root / 'freepbx-failed'))
        self.script = self.root / 'init.sh'
        # Wait for the background update stub so its log is complete.
        self.script.write_text(script + '\nwait\n')

    def run_init(self, **extra):
        result = subprocess.run(['bash', str(self.script)],
                                env=dict(os.environ, PATH=str(self.root) + ':' + os.environ['PATH'],
                                         TEST_CALLS=str(self.calls), **extra),
                                capture_output=True, text=True, timeout=20)
        return result, self.calls.read_text()

    def test_installs_modules_then_reloads_without_restarting_asterisk(self):
        result, calls = self.run_init()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertLess(calls.index('fwconsole moduleadmin install core'), calls.index('su asterisk'))
        self.assertNotIn('core restart', calls)
        self.assertNotIn('HTTPTLSBINDADDRESS', calls)
        self.assertTrue(self.ready.exists())

    def test_failed_reload_stops_remaining_initialization(self):
        result, calls = self.run_init(TEST_RELOAD_EXIT='1')
        self.assertEqual(result.returncode, 1)
        self.assertNotIn('phonesRpsResetHelper', calls)
        self.assertNotIn('core restart', calls)
        self.assertFalse(self.ready.exists())
        self.assertTrue((self.root / "freepbx-failed").exists())

    def test_required_step_failures_stop_initialization(self):
        for command in ['fwconsole moduleadmin install core',
                        'fwconsole userman --syncall --force --verbose']:
            with self.subTest(command=command):
                self.calls.unlink(missing_ok=True)
                result, calls = self.run_init(TEST_FAILURE=command)
                self.assertEqual(result.returncode, 1, result.stderr)
                self.assertNotIn('su asterisk', calls)
                self.assertNotIn('phonesRpsResetHelper', calls)
                self.assertNotIn('slow_database_updates.php', calls)
                self.assertFalse(self.ready.exists())

    def test_permission_fix_failure_does_not_skip_final_initialization(self):
        result, calls = self.run_init(TEST_FAILURE='ionice -c2 -n7 nice -n 10 fwconsole chown')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('su asterisk', calls)
        self.assertIn('phonesRpsResetHelper', calls)
        self.assertIn('slow_database_updates.php', calls)
        self.assertTrue(self.ready.exists())


if __name__ == '__main__':
    unittest.main()
