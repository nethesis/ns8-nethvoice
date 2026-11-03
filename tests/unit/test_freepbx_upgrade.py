# SPDX-License-Identifier: GPL-3.0-or-later
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class UpgradeTest(unittest.TestCase):
    def run_upgrade(self, fail='', fail_unit='', active=None):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        directory = Path(temporary.name)
        stub = directory / 'stub'
        stub.write_text('''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
name = Path(sys.argv[0]).name
args = sys.argv[1:]
call = ' '.join([name, *args])
with open('calls', 'a') as output: output.write(json.dumps([name, *args])+'\\n')
if name == 'systemctl' and args[:3] == ['--user', 'is-active', '--quiet']:
    sys.exit(0 if args[3] in json.loads(os.environ['TEST_ACTIVE']) else 3)
if name == 'podman' and args[0] == 'exec': print('-- recoverable SQL dump')
if name == 'podman' and args[0] == 'run': print('configuration archive')
if name == 'runagent' and args[0] == 'mysql-update-postprocess':
    assert list(Path('upgrade-backups').glob('*/complete')), 'migration before snapshot'
if call == os.environ.get('TEST_FAIL'): sys.exit(17)
if name == 'systemctl' and args[:2] == ['--user', 'start'] and os.environ.get('TEST_FAIL_UNIT') in args[2:]:
    sys.exit(17)
''')
        stub.chmod(0o755)
        for command in ['systemctl', 'podman', 'runagent', 'restart-services-when-convenient']:
            (directory / command).symlink_to(stub)
        result = subprocess.run(['bash', str(ROOT / 'imageroot/update-module.d/80restart')], cwd=directory,
                                env=dict(os.environ, PATH=str(directory)+':'+os.environ['PATH'], TEST_FAIL=fail,
                                         TEST_FAIL_UNIT=fail_unit,
                                         TEST_ACTIVE=json.dumps(active if active is not None else [
                                             'freepbx', 'janus', 'nethcti-ui', 'satellite-pgsql', 'reports-redis',
                                             'nethcti-server', 'nethcti-middleware', 'tancredi',
                                             'watcher.path', 'phonebook-update.timer']),
                                         NETHVOICE_FREEPBX_IMAGE='test-freepbx'), capture_output=True, text=True)
        calls = [json.loads(line) for line in (directory / 'calls').read_text().splitlines()]
        return result, calls, directory

    def test_snapshot_and_stop_precede_migration_and_consumers_wait_for_ready(self):
        result, calls, directory = self.run_upgrade()
        self.assertEqual(result.returncode, 0, result.stderr)
        stop = next(i for i, call in enumerate(calls) if call[:2] == ['restart-services-when-convenient', '--stop'])
        migrate = calls.index(['runagent', 'mysql-update-postprocess', '--migrate'])
        starts = [call[3:] for call in calls if call[:3] == ['systemctl', '--user', 'start']]
        self.assertEqual(len(starts), 4)  # MariaDB, independent units, consumers, scheduled work.
        self.assertEqual(set(starts[1]), {'freepbx', 'janus', 'nethcti-ui', 'satellite-pgsql', 'reports-redis'})
        self.assertEqual(set(starts[2]), {'nethcti-server', 'nethcti-middleware', 'tancredi'})
        self.assertEqual(set(starts[3]), {'watcher.path', 'phonebook-update.timer'})
        pbx = next(i for i, call in enumerate(calls) if call[:3] == ['systemctl', '--user', 'start'] and 'freepbx' in call[3:])
        cti = next(i for i, call in enumerate(calls) if call[:3] == ['systemctl', '--user', 'start'] and 'nethcti-server' in call[3:])
        self.assertLess(stop, migrate)
        self.assertLess(migrate, pbx)
        self.assertLess(pbx, cti)
        self.assertTrue(list(directory.glob('upgrade-backups/*/succeeded')))
        self.assertFalse(any('fwconsole' in call for call in calls))

    def test_failed_initialization_or_migration_preserves_snapshot_and_stops_consumers(self):
        for fail, unit in [('runagent mysql-update-postprocess --migrate', ''), ('', 'freepbx'), ('', 'tancredi'), ('', 'watcher.path')]:
            with self.subTest(fail=fail, unit=unit):
                result, calls, directory = self.run_upgrade(fail=fail, fail_unit=unit)
                self.assertEqual(result.returncode, 17, result.stderr)
                starts = [call[3:] for call in calls if call[:3] == ['systemctl', '--user', 'start']]
                if fail or unit == 'freepbx':
                    self.assertFalse(any('nethcti-server' in group for group in starts))
                if unit != 'watcher.path':
                    self.assertFalse(any('watcher.path' in group for group in starts))
                stopped = calls[-1]
                self.assertEqual(stopped[:3], ['systemctl', '--user', 'stop'])
                self.assertIn('freepbx', stopped)
                self.assertIn('nethcti-server', stopped)
                self.assertIn('watcher.path', stopped)
                self.assertTrue(list(directory.glob('upgrade-backups/*/complete')))
                self.assertFalse(list(directory.glob('upgrade-backups/*/succeeded')))
                self.assertIn('recovery data:', result.stderr)

    def test_inactive_services_are_not_requested(self):
        for active in [[], ['freepbx'], ['freepbx', 'nethcti-server']]:
            with self.subTest(active=active):
                result, calls, directory = self.run_upgrade(active=active)
                self.assertEqual(result.returncode, 0, result.stderr)
                starts = [call[3:] for call in calls if call[:3] == ['systemctl', '--user', 'start']]
                self.assertTrue(all(starts))
                self.assertEqual([unit for group in starts[1:] for unit in group], active)
                self.assertTrue(list(directory.glob('upgrade-backups/*/succeeded')))


if __name__ == '__main__':
    unittest.main()
