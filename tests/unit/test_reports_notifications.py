# SPDX-License-Identifier: GPL-3.0-or-later
import datetime
import os
from pathlib import Path
import runpy
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
CONFIG_IS_CURRENT = runpy.run_path(str(ROOT / 'imageroot/bin/reports-config-is-current'))['config_is_current']


class ReportsConfigTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        (self.root / 'api').mkdir()
        self.config = self.root / 'api/user_authorizations.json'
        self.config.write_text('[]')
        self.started = datetime.datetime(2026, 1, 1, tzinfo=datetime.timezone.utc)
        self.started_ns = int(self.started.timestamp() * 1_000_000_000)

    def check_current(self, delta_ns, state='running'):
        stamp = self.started_ns + delta_ns
        os.utime(self.config, ns=(stamp, stamp))
        replies = [f'{state} {self.started_ns}', str(self.root)]
        with patch('subprocess.check_output', side_effect=replies):
            return CONFIG_IS_CURRENT()

    def test_only_configuration_that_predates_startup_is_current(self):
        self.assertTrue(self.check_current(-2_000_000_000))
        self.assertFalse(self.check_current(2_000_000_000))
        self.assertFalse(self.check_current(0))
        self.assertFalse(self.check_current(-500_000))

    def test_unavailable_container_or_metadata_requires_restart(self):
        self.assertFalse(self.check_current(-2_000_000_000, state='exited'))
        self.config.unlink()
        replies = [f'running {self.started_ns}', str(self.root)]
        with patch('subprocess.check_output', side_effect=replies):
            self.assertFalse(CONFIG_IS_CURRENT())
        with patch('subprocess.check_output', side_effect=subprocess.CalledProcessError(1, 'podman')):
            self.assertFalse(CONFIG_IS_CURRENT())


class ReportsNotificationsTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.notify = self.root / 'notify'
        self.notify.mkdir()
        stub = self.root / 'stub'
        stub.write_text('''#!/bin/bash
echo "$(basename "$0") $*" >> "$TEST_CALLS"
case "$(basename "$0")" in
reports-config-is-current) exit "$TEST_CURRENT_EXIT";;
esac
''')
        stub.chmod(0o755)
        for name in ['systemctl', 'reports-config-is-current', 'ps', 'sleep']:
            (self.root / name).symlink_to(stub)
        self.calls = self.root / 'calls'
        self.env = dict(os.environ, PATH=str(self.root)+':'+os.environ['PATH'],
                        TEST_CALLS=str(self.calls), TEST_CURRENT_EXIT='0')

    def run_dispatcher(self, reason, current_exit):
        (self.notify / 'restart_reports-api').write_text(reason)
        script = (ROOT / 'imageroot/bin/adjust-services').read_text()
        script = script.replace('/usr/bin/systemctl', str(self.root / 'systemctl'))
        result = subprocess.run(['bash', '-c', script], cwd=self.root,
                                env=dict(self.env, TEST_CURRENT_EXIT=str(current_exit)),
                                capture_output=True, text=True, timeout=5)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse((self.notify / 'restart_reports-api').exists())
        return self.calls.read_text()

    def test_late_notification_is_consumed_without_second_restart(self):
        calls = self.run_dispatcher('config\n', 0)
        self.assertIn('reports-config-is-current', calls)
        self.assertNotIn('systemctl', calls)

    def test_new_configuration_or_missing_metadata_still_restarts(self):
        calls = self.run_dispatcher('config\n', 1)
        self.assertIn('systemctl --user restart reports-api', calls)

    def test_explicit_restart_is_not_suppressed(self):
        calls = self.run_dispatcher('', 0)
        self.assertNotIn('reports-config-is-current', calls)
        self.assertIn('systemctl --user restart reports-api', calls)

    def test_reload_helper_marks_configuration_notifications(self):
        script = (ROOT / 'freepbx/var/www/html/freepbx/rest/lib/ctiReloadHelper.sh').read_text()
        script = script.replace('/notify/', str(self.notify)+'/')
        result = subprocess.run(['bash', '-c', script], env=self.env,
                                capture_output=True, text=True, timeout=5)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.notify / 'restart_reports-api').read_text(), 'config\n')
        self.assertTrue((self.notify / 'reload_nethcti-server').exists())


if __name__ == '__main__':
    unittest.main()
