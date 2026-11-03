# SPDX-License-Identifier: GPL-3.0-or-later
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class ReportsNotificationsTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.notify = self.root / 'notify'
        self.notify.mkdir()
        stub = self.root / 'stub'
        stub.write_text('''#!/bin/sh
echo "$(basename "$0") $*" >> "$TEST_CALLS"
''')
        stub.chmod(0o755)
        for name in ['systemctl', 'ps', 'sleep']:
            (self.root / name).symlink_to(stub)
        self.calls = self.root / 'calls'
        self.env = dict(os.environ, PATH=str(self.root)+':'+os.environ['PATH'],
                        TEST_CALLS=str(self.calls))

    def test_runtime_reports_notification_still_restarts(self):
        flag = self.notify / 'restart_reports-api'
        flag.touch()
        script = (ROOT / 'imageroot/bin/adjust-services').read_text()
        script = script.replace('/usr/bin/systemctl', str(self.root / 'systemctl'))
        result = subprocess.run(['bash', '-c', script], cwd=self.root,
                                env=self.env, capture_output=True, text=True, timeout=5)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(flag.exists())
        self.assertIn('systemctl --user restart reports-api', self.calls.read_text())

    def test_delayed_helper_notifies_cti_and_restarts_reports(self):
        script = (ROOT / 'freepbx/var/www/html/freepbx/rest/lib/ctiReloadHelper.sh').read_text()
        script = script.replace('/notify/', str(self.notify)+'/')
        result = subprocess.run(['bash', '-c', script], env=self.env,
                                capture_output=True, text=True, timeout=5)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((self.notify / 'reload_nethcti-server').exists())
        self.assertEqual((self.notify / 'restart_reports-api').read_text(), '')


if __name__ == '__main__':
    unittest.main()
