"""Exercise clone ordering and restore compatibility without a live module."""
import json
import os
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]


class AgentLifecycleTests(unittest.TestCase):
    def restore(self, passwords):
        stored = dict(passwords)
        agent = types.ModuleType('agent')
        agent.read_envfile = lambda name: dict(stored)
        agent.write_envfile = lambda name, value: stored.update(value)
        with patch.dict(sys.modules, {'agent': agent}):
            runpy.run_path(str(ROOT/'imageroot/actions/restore-module/25monitoring_key'))
        return stored

    def test_restore_older_backup_supplies_configuration_key(self):
        stored = self.restore({'MARIADB_ROOT_PASSWORD': 'synthetic-db'})
        self.assertTrue(stored['SATELLITE_AGENT_CONFIG_KEY'])
        self.assertEqual(stored['MARIADB_ROOT_PASSWORD'], 'synthetic-db')
        self.assertTrue(stored['SATELLITE_MONITORING_CONTENT_KEY'])
        self.assertTrue(stored['SATELLITE_APPLICATION_CONTENT_KEY'])
        self.assertTrue(stored['SATELLITE_WORKFLOW_DB_PASSWORD'])
        self.assertEqual(self.restore(stored), stored)

    def test_restore_preserves_restored_configuration_key(self):
        stored = self.restore({'SATELLITE_AGENT_CONFIG_KEY': 'restored-key'})
        self.assertEqual(stored['SATELLITE_AGENT_CONFIG_KEY'], 'restored-key')

    def test_restore_empty_configuration_key_is_repaired(self):
        self.assertTrue(self.restore({'SATELLITE_AGENT_CONFIG_KEY': ''})['SATELLITE_AGENT_CONFIG_KEY'])

    def clone(self, fail_migration=False):
        running = True
        events = []
        agent = types.ModuleType('agent')
        secrets = {'passwords.old': {'SATELLITE_AGENT_CONFIG_KEY': 'source-key'},
                   'passwords.env': {'SATELLITE_AGENT_CONFIG_KEY': 'clone-key',
                                     'MARIADB_ROOT_PASSWORD': 'synthetic-db'}}
        agent.read_envfile = lambda name: dict(secrets[name])
        def run(command, **kwargs):
            nonlocal running
            if command[0] == 'systemctl':
                running = command[2] == 'start'
                events.append(command[2])
                return subprocess.CompletedProcess(command, 0)
            self.assertTrue(running, 'Database command while MariaDB is stopped')
            self.assertNotIn('source-key', command)
            self.assertNotIn('clone-key', command)
            self.assertNotIn('synthetic-db', command)
            if command[:2] == ['podman', 'run']:
                events.append('rotate')
                payload = json.loads(kwargs['input'])
                self.assertEqual(payload['source_key'], 'source-key')
                self.assertEqual(payload['target_key'], 'clone-key')
                self.assertEqual(payload['database']['port'], 13306)
                if fail_migration:
                    raise subprocess.CalledProcessError(1, command)
            else:
                self.assertIn('--env-file=passwords.env', command)
                events.append('query')
            return subprocess.CompletedProcess(command, 0, stdout='')
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory)
            (state/'satellite_postgresql.pg_dump.gz').write_bytes(b'synthetic dump')
            previous = os.getcwd()
            try:
                os.chdir(state)
                with patch.dict(sys.modules, {'agent': agent}), patch.dict(os.environ, {
                    'NETHVOICE_FREEPBX_IMAGE': 'synthetic-freepbx', 'NETHVOICE_MARIADB_PORT': '13306'}), \
                     patch('subprocess.run', side_effect=run):
                    if fail_migration:
                        with self.assertRaises(subprocess.CalledProcessError):
                            runpy.run_path(str(ROOT/'imageroot/actions/clone-module/22satellite_agents'))
                    else:
                        runpy.run_path(str(ROOT/'imageroot/actions/clone-module/22satellite_agents'))
                self.assertFalse((state/'satellite_postgresql.pg_dump.gz').exists())
            finally:
                os.chdir(previous)
        self.assertTrue(running)
        return events

    def test_clone_cleans_database_before_existing_stop_step(self):
        self.assertEqual(self.clone(), ['rotate', 'query'])
        steps = sorted(p.name for p in (ROOT/'imageroot/actions/clone-module').iterdir())
        self.assertLess(steps.index('21set_mariadb_passwords'), steps.index('22satellite_agents'))
        self.assertLess(steps.index('22satellite_agents'), steps.index('23stop_mariadb_service'))

    def test_clone_rotation_failure_stops_the_action_before_database_cleanup(self):
        self.assertEqual(self.clone(fail_migration=True), ['rotate'])


if __name__ == '__main__':
    unittest.main()
