# SPDX-License-Identifier: GPL-3.0-or-later
import json
import os
from pathlib import Path
import stat
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class UpgradeTest(unittest.TestCase):
    def run_upgrade(self, states=None, fail='', *, runner=False, **extra):
        core_source = os.environ.get('NS8_CORE_SOURCE')
        if runner and not core_source:
            self.skipTest('set NS8_CORE_SOURCE to test against the critical-hook runner')
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        directory = Path(temporary.name)
        (directory / 'states').write_text(json.dumps(states if states is not None else {
            'freepbx': 'active', 'nethcti-server': 'active', 'tancredi': 'active'}))
        stub = directory / 'stub'
        stub.write_text('''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
name = Path(sys.argv[0]).name
args = sys.argv[1:]
call = ' '.join([name, *args])
with open('calls', 'a') as output: output.write(json.dumps([name, *args])+'\\n')
if call == os.environ.get('TEST_FAIL'): sys.exit(17)
if name == 'systemctl' and args[:2] == ['--user', 'stop'] and os.environ.get('TEST_STOP_FAILURE'):
    sys.exit(17)
if name == 'systemctl':
    states = json.loads(Path('states').read_text())
    if args[:3] == ['--user', 'show', '--property=ActiveState']:
        print(states.get(args[-1], 'inactive'))
    elif args[:2] == ['--user', 'stop']:
        # Model a captured starting unit failing or reaching running before stop,
        # and an originally inactive unit starting during the call-drain wait.
        states.update(json.loads(os.environ.get('TEST_TRANSITIONS', '{}')))
        for unit in args[2:]: states[unit] = 'inactive'
        states.update(json.loads(os.environ.get('TEST_SURVIVORS', '{}')))
        Path('states').write_text(json.dumps(states))
        Path('stopped').touch()
    elif args[:2] == ['--user', 'start'] and args[-1] != 'mariadb':
        assert Path('prepared').exists(), 'consumer started before preparation'
        if args[-1] == 'freepbx':
            Path('ready').touch()  # Model successful ExecStartPost readiness.
        elif args[-1] in ['nethcti-server', 'tancredi', 'satellite']:
            assert Path('ready').exists(), 'consumer started before FreePBX readiness'
    elif 'is-enabled' in args or 'is-active' in args:
        sys.exit('runtime intent must not be inferred from enablement/is-active')
if name == 'timeout':
    assert args[:2] == ['--foreground', '300']
    if os.environ.get('TEST_STOP_TIMEOUT'): sys.exit(124)
    os.execvp(args[2], args[2:])
if name == 'podman':
    if args[0] == 'exec' and args[1] == 'freepbx':
        count = Path('call-count')
        if os.environ.get('TEST_CALLS') and not count.exists():
            count.touch()
            print('1 active call')
        else: print('0 active calls')
    elif args[0] == 'ps':
        if os.environ.get('TEST_CONTAINER_SURVIVES'): print('freepbx')
    elif args[0] in ['exec', 'run']: print('snapshot data')
if name == 'runagent':
    assert Path('stopped').exists(), 'preparation before explicit stop'
    states = json.loads(Path('states').read_text())
    assert all(state in ['inactive', 'failed'] for state in states.values())
    assert list(Path('upgrade-backups').glob('*/complete')), 'migration before snapshot'
    if args[0] == 'prepare-asterisk-config': Path('prepared').touch()
''')
        stub.chmod(0o755)
        for command in ['systemctl', 'podman', 'runagent', 'timeout', 'sleep']:
            (directory / command).symlink_to(stub)
        (directory / 'restart-services-when-convenient').symlink_to(
            ROOT / 'imageroot/bin/restart-services-when-convenient')
        install = directory / 'install'
        hooks = install / 'update-module.d'
        hooks.mkdir(parents=True)
        for name in ['70enable', '80restart', '80restart.fatal']:
            (hooks / name).symlink_to(ROOT / 'imageroot/update-module.d' / name)
        for name, content in [('60optional', 'exit 23'), ('81later', 'touch later-ran')]:
            path = hooks / name
            path.write_text('#!/bin/bash\n' + content + '\n')
            path.chmod(0o755)
        if extra.pop('restore_sql', False):
            (directory / 'restore_background').mkdir()
            (directory / 'restore_background/old.sql').touch()
        script = (Path(core_source) / 'core/imageroot/usr/local/agent/actions/update-module/50run_scriptdir'
                  if runner else ROOT / 'imageroot/update-module.d/80restart')
        result = subprocess.run(['bash', str(script)], cwd=directory,
                                env=dict(os.environ, PATH=str(directory)+':'+os.environ['PATH'],
                                         HOME=str(directory), AGENT_INSTALL_DIR=str(install),
                                         TEST_FAIL=fail, NETHVOICE_FREEPBX_IMAGE='test-freepbx', **extra),
                                capture_output=True, text=True, timeout=20)
        calls = [json.loads(line) for line in (directory / 'calls').read_text().splitlines()] \
            if (directory / 'calls').exists() else []
        return result, calls, directory

    def assert_failed_closed(self, result, calls, directory, code=17):
        self.assertEqual(result.returncode, code, result.stderr)
        self.assertNotIn(['systemctl', '--user', 'start', 'nethcti-server'], calls)
        self.assertFalse(list(directory.glob('upgrade-backups/*/succeeded')))
        self.assertIn('recovery data:', result.stderr)

    def test_healthy_upgrade_snapshots_then_prepares_then_waits_for_readiness(self):
        result, calls, directory = self.run_upgrade(TEST_CALLS='1')
        self.assertEqual(result.returncode, 0, result.stderr)
        stop = next(i for i, call in enumerate(calls) if call[:3] == ['systemctl', '--user', 'stop'])
        migrate = calls.index(['runagent', 'mysql-update-postprocess', '--migrate'])
        prepare = calls.index(['runagent', 'prepare-asterisk-config'])
        pbx = calls.index(['systemctl', '--user', 'start', 'freepbx'])
        cti = calls.index(['systemctl', '--user', 'start', 'nethcti-server'])
        self.assertLess(stop, migrate)
        self.assertLess(migrate, prepare)
        self.assertLess(prepare, pbx)
        self.assertLess(pbx, cti)
        self.assertIn(['sleep', '1'], calls[:stop])
        self.assertEqual(sum(call[:3] == ['podman', 'exec', 'freepbx'] for call in calls[:stop]), 2)
        snapshot = next(directory.glob('upgrade-backups/*'))
        self.assertTrue((snapshot / 'succeeded').exists())
        self.assertEqual(stat.S_IMODE(snapshot.stat().st_mode), 0o700)
        for path in snapshot.iterdir():
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600, path.name)
        self.assertFalse(any('fwconsole' in call for call in calls))

    def test_activating_and_auto_restart_are_stopped_and_resumed(self):
        # systemd reports both start-post and auto-restart as activating.
        for transition in ['active', 'failed', 'activating']:
            with self.subTest(transition=transition):
                result, calls, directory = self.run_upgrade(
                    {'freepbx': 'activating', 'nethcti-server': 'activating',
                     'tancredi': 'reloading'},
                    TEST_TRANSITIONS=json.dumps({'freepbx': transition, 'phonebook': 'activating'}))
                self.assertEqual(result.returncode, 0, result.stderr)
                stop = next(call for call in calls if call[:3] == ['systemctl', '--user', 'stop'])
                self.assertIn('freepbx', stop)
                self.assertIn('phonebook', stop)
                self.assertIn(['systemctl', '--user', 'start', 'freepbx'], calls)
                self.assertIn(['systemctl', '--user', 'start', 'nethcti-server'], calls)
                self.assertNotIn(['systemctl', '--user', 'start', 'phonebook'], calls)
                self.assertIn('freepbx', next(directory.glob('upgrade-backups/*/active-services')).read_text())

    def test_stopped_failed_and_conditional_services_are_not_started(self):
        result, calls, _ = self.run_upgrade({'freepbx': 'inactive', 'tancredi': 'failed'},
                                          restore_sql=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual([call for call in calls if call[:3] == ['systemctl', '--user', 'start']],
                         [['systemctl', '--user', 'start', 'mariadb']])
        self.assertFalse(any('--now' in call for call in calls))

    def test_background_import_resume_is_asynchronous_after_readiness(self):
        result, calls, directory = self.run_upgrade(
            {'freepbx': 'active', 'nethvoice-restore-background': 'activating'}, restore_sql=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        background = ['systemctl', '--user', 'start', '--no-block', 'nethvoice-restore-background.service']
        self.assertIn(background, calls)
        self.assertNotIn(['systemctl', '--user', 'start', 'nethvoice-restore-background'], calls)
        self.assertLess(calls.index(['systemctl', '--user', 'start', 'freepbx']), calls.index(background))
        self.assertTrue(list(directory.glob('upgrade-backups/*/succeeded')))

    def test_timers_and_workers_stop_together_and_activators_resume_last(self):
        result, calls, _ = self.run_upgrade({'freepbx': 'active', 'watcher.path': 'active',
            'phonebook-update.timer': 'active', 'phonebook-update.service': 'activating',
            'nethcti-ui-restart.timer': 'active', 'nethcti-ui': 'active'})
        self.assertEqual(result.returncode, 0, result.stderr)
        stop = next(call for call in calls if call[:3] == ['systemctl', '--user', 'stop'])
        for unit in ['watcher.path', 'watcher.service', 'phonebook-update.service',
                     'nethcti-ui-restart.timer', 'nethcti-ui-restart.service']:
            self.assertIn(unit, stop)
        starts = [call[-1] for call in calls if call[:3] == ['systemctl', '--user', 'start']]
        self.assertLess(starts.index('freepbx'), starts.index('phonebook-update.service'))
        self.assertLess(starts.index('nethcti-ui'), starts.index('nethcti-ui-restart.timer'))
        self.assertLess(starts.index('phonebook-update.service'), starts.index('phonebook-update.timer'))

    def test_stop_timeout_failure_or_surviving_service_prevents_preparation(self):
        for extra, code in [({'TEST_STOP_TIMEOUT': '1'}, 124),
                            ({'TEST_STOP_FAILURE': '1'}, 17),
                            ({'TEST_SURVIVORS': '{"freepbx": "activating"}'}, 1),
                            ({'TEST_CONTAINER_SURVIVES': '1'}, 1)]:
            with self.subTest(extra=extra):
                result, calls, directory = self.run_upgrade(**extra)
                self.assert_failed_closed(result, calls, directory, code)
                self.assertFalse(any(call[0] == 'runagent' for call in calls))
                self.assertFalse(list(directory.glob('upgrade-backups/*/complete')))

    def test_ambiguous_or_unknown_state_fails_before_stopping(self):
        for state in ['deactivating', 'maintenance', '']:
            with self.subTest(state=state):
                result, calls, directory = self.run_upgrade({'freepbx': state})
                self.assert_failed_closed(result, calls, directory, 1)
                self.assertFalse(any(call[:3] == ['systemctl', '--user', 'stop'] for call in calls))
                self.assertIn('Cannot determine resume intent', result.stderr)

    def test_snapshot_migration_preparation_and_readiness_failures_stop_consumers(self):
        for fail in ['runagent mysql-update-postprocess --migrate',
                     'runagent prepare-asterisk-config', 'systemctl --user start freepbx',
                     "podman ps --filter name=^freepbx$ --format {{.Names}}",
                     'podman run --rm --network=none --entrypoint=tar --volume=asterisk:/snapshot/asterisk:ro,z --volume=agi-bin:/snapshot/agi-bin:ro,z --volume=astdb:/snapshot/astdb:ro,z --volume=nethcti:/snapshot/nethcti:ro,z test-freepbx -czf - -C /snapshot .']:
            with self.subTest(fail=fail):
                result, calls, directory = self.run_upgrade(fail=fail)
                self.assertEqual(result.returncode, 17, result.stderr)
                self.assertNotIn(['systemctl', '--user', 'start', 'nethcti-server'], calls)
                self.assertFalse(list(directory.glob('upgrade-backups/*/succeeded')))
                self.assertIn('recovery data:', result.stderr)
                if fail.startswith('podman'):
                    self.assertFalse(any(call[0] == 'runagent' for call in calls))
                else:
                    self.assertTrue(list(directory.glob('upgrade-backups/*/complete')))

    def test_consumer_cannot_implicitly_start_originally_stopped_freepbx(self):
        result, calls, directory = self.run_upgrade({'nethcti-server': 'active'})
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertNotIn(['systemctl', '--user', 'start', 'nethcti-server'], calls)
        self.assertFalse(list(directory.glob('upgrade-backups/*/succeeded')))
        self.assertIn('FreePBX originally stopped', result.stderr)

    def test_critical_failure_is_fatal_to_action_and_skips_later_hooks(self):
        result, calls, directory = self.run_upgrade(fail='runagent prepare-asterisk-config', runner=True)
        self.assertEqual(result.returncode, 17, result.stderr)
        self.assertFalse((directory / 'later-ran').exists())
        self.assertIn('60optional has failed (exit 23)', result.stderr)
        self.assertIn('80restart has failed (exit 17)', result.stderr)
        self.assertNotIn(['systemctl', '--user', 'start', 'nethcti-server'], calls)

    def test_optional_failure_keeps_warning_policy_and_success_runs_later_hooks(self):
        result, _, directory = self.run_upgrade(runner=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((directory / 'later-ran').exists())
        self.assertIn('60optional has failed (exit 23)', result.stderr)

    def test_restart_hook_opts_into_critical_failure_reporting(self):
        marker = ROOT / 'imageroot/update-module.d/80restart.fatal'
        self.assertTrue(marker.is_file())
        self.assertFalse(os.access(marker, os.X_OK))

    def test_enable_migrations_do_not_start_services_before_state_capture(self):
        with tempfile.TemporaryDirectory() as directory:
            stub = Path(directory) / 'systemctl'
            stub.write_text('#!/bin/bash\necho "$*" >> "$TEST_CALLS"\n')
            stub.chmod(0o755)
            result = subprocess.run(['bash', str(ROOT / 'imageroot/update-module.d/70enable')],
                                    env=dict(os.environ, PATH=directory + ':' + os.environ['PATH'],
                                             TEST_CALLS=str(Path(directory) / 'calls')),
                                    capture_output=True, text=True, timeout=5)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertNotIn('--now', (Path(directory) / 'calls').read_text())


if __name__ == '__main__':
    unittest.main()
