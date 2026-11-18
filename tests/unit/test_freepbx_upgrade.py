# SPDX-License-Identifier: GPL-3.0-or-later
import json
import os
from pathlib import Path
import shlex
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class UpgradeTest(unittest.TestCase):
    def test_freepbx_stop_cleans_reload_requests_after_container_removal(self):
        unit = (ROOT / 'imageroot/systemd/user/freepbx.service').read_text()
        commands = [line.split('=', 1)[1] for line in unit.splitlines() if line.startswith('ExecStopPost=')]
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            notify = directory / 'state/notify'
            notify.mkdir(parents=True)
            (notify / 'reload_nethcti-server').touch()
            wizard = notify / 'restart_nethcti-middleware'
            wizard.touch()
            podman = directory / 'podman'
            # A helper can enqueue another request while the container is stopping.
            podman.write_text('#!/bin/sh\ntouch "$TEST_NOTIFY/restart_reports-api"\n')
            podman.chmod(0o755)
            for command in commands:
                args = shlex.split(command.replace('%E', temporary).replace('%t', temporary))
                if args[0] == '/usr/bin/podman':
                    args[0] = str(podman)
                subprocess.run(args, env=dict(os.environ, TEST_NOTIFY=str(notify)), check=True)
            self.assertEqual(list(notify.iterdir()), [wizard])
            # Cleanup also succeeds before notify exists or after it was consumed.
            wizard.unlink()
            notify.rmdir()
            subprocess.run(shlex.split(commands[-1].replace('%E', temporary)), check=True)

    def run_upgrade(self, fail=''):
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
    sys.exit(0 if args[3] in ['freepbx', 'nethcti-server', 'tancredi'] else 3)
if name == 'podman' and args[0] == 'exec': print('-- recoverable SQL dump')
if name == 'podman' and args[0] == 'run': print('configuration archive')
if name == 'runagent' and args[0] == 'mysql-update-postprocess':
    assert list(Path('upgrade-backups').glob('*/complete')), 'migration before snapshot'
if call == os.environ.get('TEST_FAIL'): sys.exit(17)
''')
        stub.chmod(0o755)
        for command in ['systemctl', 'podman', 'runagent', 'restart-services-when-convenient']:
            (directory / command).symlink_to(stub)
        result = subprocess.run(['bash', str(ROOT / 'imageroot/update-module.d/80restart')], cwd=directory,
                                env=dict(os.environ, PATH=str(directory)+':'+os.environ['PATH'], TEST_FAIL=fail,
                                         AGENT_INSTALL_DIR=str(ROOT / 'imageroot'),
                                         NETHVOICE_FREEPBX_IMAGE='test-freepbx'), capture_output=True, text=True)
        calls = [json.loads(line) for line in (directory / 'calls').read_text().splitlines()]
        return result, calls, directory

    def test_snapshot_and_stop_precede_migration_and_consumers_wait_for_ready(self):
        result, calls, directory = self.run_upgrade()
        self.assertEqual(result.returncode, 0, result.stderr)
        stop = next(i for i, call in enumerate(calls) if call[:2] == ['restart-services-when-convenient', '--stop'])
        migrate = calls.index(['runagent', 'mysql-update-postprocess', '--migrate'])
        pbx = calls.index(['systemctl', '--user', 'start', 'freepbx'])
        cti = calls.index(['systemctl', '--user', 'start', 'nethcti-server'])
        self.assertLess(stop, migrate)
        self.assertLess(migrate, pbx)
        self.assertLess(pbx, cti)
        self.assertTrue(list(directory.glob('upgrade-backups/*/succeeded')))
        self.assertFalse(any('fwconsole' in call for call in calls))

    def test_failed_initialization_or_migration_preserves_snapshot_and_stops_consumers(self):
        for fail in ['systemctl --user start freepbx', 'runagent mysql-update-postprocess --migrate']:
            with self.subTest(fail=fail):
                result, calls, directory = self.run_upgrade(fail)
                self.assertEqual(result.returncode, 17, result.stderr)
                self.assertNotIn(['systemctl', '--user', 'start', 'nethcti-server'], calls)
                self.assertTrue(list(directory.glob('upgrade-backups/*/complete')))
                self.assertFalse(list(directory.glob('upgrade-backups/*/succeeded')))
                self.assertIn('recovery data:', result.stderr)


if __name__ == '__main__':
    unittest.main()
