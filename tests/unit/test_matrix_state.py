"""Exercise Matrix clone and push snapshot actions without a running module."""
import io
import gzip
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
CLONE = ROOT / 'imageroot/actions/clone-module/24matrix'
RESTORE_PUSH = ROOT / 'imageroot/actions/restore-module/25matrix_push'
DUMP = ROOT / 'imageroot/bin/module-dump-state'


class CloneTests(unittest.TestCase):
    def run_clone(self, state, replace, source, fresh, old):
        settings = {}
        written = []
        commands = []

        def read_envfile(name):
            return {
                'environment.clone-module': source,
                'passwords.env': fresh,
                'passwords.old': old,
            }[name]

        fake_agent = types.SimpleNamespace(
            read_envfile=read_envfile,
            set_env=lambda name, value: settings.__setitem__(name, value),
            write_envfile=lambda name, value: written.append((name, value)),
        )

        def run(command, **kwargs):
            commands.append((command, kwargs))
            return types.SimpleNamespace(returncode=0)

        with patch.dict(sys.modules, {'agent': fake_agent}), \
                patch.dict(os.environ, {'AGENT_STATE_DIR': str(state), 'AGENT_INSTALL_DIR': '/module'}), \
                patch.object(sys, 'stdin', io.StringIO(json.dumps({'replace': replace}))), \
                patch('subprocess.run', side_effect=run):
            runpy.run_path(str(CLONE), run_name='__main__')
        return settings, written, commands

    def test_move_keeps_transferred_matrix_identity_and_secrets(self):
        with tempfile.TemporaryDirectory() as directory:
            source = {'NETHVOICE_MATRIX_ENABLED': 'True', 'NETHVOICE_MATRIX_HOST': 'matrix.example.org'}
            fresh = {'MATRIX_POSTGRES_PASSWORD': 'fresh', 'MATRIX_M2A_AS_TOKEN': 'fresh-as', 'OTHER': 'new'}
            old = {'MATRIX_POSTGRES_PASSWORD': 'old', 'MATRIX_M2A_AS_TOKEN': 'old-as', 'OTHER': 'old'}
            settings, written, commands = self.run_clone(Path(directory), True, source, fresh, old)
            self.assertEqual(settings, source)
            self.assertEqual(written[0][1]['MATRIX_POSTGRES_PASSWORD'], 'old')
            self.assertEqual(written[0][1]['MATRIX_M2A_AS_TOKEN'], 'old-as')
            self.assertEqual(written[0][1]['OTHER'], 'new')
            self.assertEqual(commands[-1][0], ['runagent', '/module/actions/configure-module/73matrix'])

    def test_independent_clone_clears_identity_and_saved_startup_units(self):
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory)
            (state / 'matrix').mkdir()
            (state / 'matrix/identity.json').write_text('{"server_name":"old.example.org"}')
            (state / 'matrix_postgresql.pg_dump.gz').write_bytes(b'old')
            units = state / 'default-target.clone-module'
            units.write_text('agent.service matrix-postgresql.service matrix-synapse.service '
                             'matrix2acrobits.service freepbx.service\n')
            settings, written, commands = self.run_clone(state, False, {}, {'MATRIX_POSTGRES_PASSWORD': 'new'},
                                                         {'MATRIX_POSTGRES_PASSWORD': 'old'})
            self.assertEqual(settings, {'NETHVOICE_MATRIX_ENABLED': 'False', 'NETHVOICE_MATRIX_HOST': ''})
            self.assertEqual(written, [])
            self.assertEqual(units.read_text(), 'agent.service freepbx.service\n')
            self.assertFalse((state / 'matrix').exists())
            self.assertFalse((state / 'matrix_postgresql.pg_dump.gz').exists())
            removed = [call[0][3] for call in commands if call[0][:3] == ['podman', 'volume', 'rm']]
            self.assertEqual(removed, ['matrix-postgresql-data', 'matrix-synapse-data', 'matrix2acrobits-data'])


class PushRestoreTests(unittest.TestCase):
    def test_snapshot_replaces_database_and_stale_wal(self):
        with tempfile.TemporaryDirectory() as directory:
            volume = Path(directory) / 'volume'
            volume.mkdir()
            (volume / 'push.backup.db').write_bytes(b'consistent')
            (volume / 'push.db').write_bytes(b'old')
            (volume / 'push.db-wal').write_bytes(b'stale')
            tools = Path(directory) / 'tools'
            tools.mkdir()
            podman = tools / 'podman'
            podman.write_text('#!/bin/sh\n'
                              'if [ "$1" = volume ]; then printf "%s\\n" "$TEST_MATRIX_VOLUME"; exit 0; fi\n'
                              'if [ "$1" = unshare ]; then shift; exec "$@"; fi\n'
                              'exit 1\n')
            podman.chmod(0o755)
            env = {**os.environ, 'PATH': str(tools) + os.pathsep + os.environ['PATH'],
                   'TEST_MATRIX_VOLUME': str(volume)}
            subprocess.run([str(RESTORE_PUSH)], check=True, env=env)
            self.assertEqual((volume / 'push.db').read_bytes(), b'consistent')
            self.assertFalse((volume / 'push.db-wal').exists())
            self.assertEqual((volume / 'push.db').stat().st_mode & 0o777, 0o600)


class DumpTests(unittest.TestCase):
    def run_dump(self, directory, active=False, fail_dump=False):
        state = Path(directory)
        (state / 'passwords.env').write_text('MARIADB_ROOT_PASSWORD=local\nMATRIX_POSTGRES_PASSWORD=matrix-secret\n')
        volume = state / 'pg-volume'
        volume.mkdir()
        (volume / 'PG_VERSION').write_text('16\n')
        tools = state / 'tools'
        tools.mkdir()
        podman = tools / 'podman'
        podman.write_text('''#!/bin/bash
printf 'podman %s\\n' "$*" >> "$TEST_MATRIX_LOG"
case "$1 $2" in
    'volume inspect')
        if [[ $* == *matrix-postgresql-data* ]]; then printf '%s\\n' "$TEST_MATRIX_VOLUME"; exit 0; fi
        exit 1 ;;
    'unshare test') shift; exec "$@" ;;
    'inspect --format={{.State.Running}}') printf 'false\\n'; exit 0 ;;
    'exec mariadb')
        if [[ $* == *mariabackup* ]]; then printf 'mariadb-data'; fi
        exit 0 ;;
    'exec freepbx')
        if [[ $* == *' ls '* ]]; then exit 1; fi
        exit 0 ;;
    'exec matrix-postgresql-snapshot')
        if [[ $* == *' pg_dump '* ]]; then
            if [[ ${TEST_MATRIX_FAIL_DUMP:-0} == 1 ]]; then printf partial; exit 2; fi
            printf PGDMP; exit 0
        fi
        exit 0 ;;
    'cp freepbx:'*) mkdir -p "$(dirname "$3")"; printf astdb > "$3"; exit 0 ;;
    'run --rm') printf 'cid\\n'; exit 0 ;;
    'stop --ignore') exit 0 ;;
esac
exit 0
''')
        podman.chmod(0o755)
        systemctl = tools / 'systemctl'
        systemctl.write_text('''#!/bin/bash
printf 'systemctl %s\\n' "$*" >> "$TEST_MATRIX_LOG"
if [[ $* == *is-active* ]]; then
    if [[ ${TEST_MATRIX_ACTIVE:-0} == 1 && $* != *satellite-pgsql* ]]; then exit 0; fi
    exit 3
fi
exit 0
''')
        systemctl.chmod(0o755)
        log = state / 'commands.log'
        env = {**os.environ, 'PATH': str(tools) + os.pathsep + os.environ['PATH'],
               'TEST_MATRIX_VOLUME': str(volume), 'TEST_MATRIX_LOG': str(log),
               'TEST_MATRIX_ACTIVE': '1' if active else '0',
               'TEST_MATRIX_FAIL_DUMP': '1' if fail_dump else '0',
               'POSTGRES_IMAGE': 'postgres:test', 'NETHVOICE_MATRIX2ACROBITS_IMAGE': 'bridge:test'}
        result = subprocess.run([str(DUMP)], cwd=state, env=env, stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, text=True)
        return result, log.read_text()

    def test_disabled_instance_snapshots_initialized_database_without_starting_services(self):
        with tempfile.TemporaryDirectory() as directory:
            result, commands = self.run_dump(directory)
            self.assertEqual(result.returncode, 0, result.stderr)
            with gzip.open(Path(directory) / 'matrix_postgresql.pg_dump.gz', 'rb') as stream:
                self.assertEqual(stream.read(), b'PGDMP')
            self.assertIn('--network=none', commands)
            self.assertNotIn('systemctl --user start matrix-', commands)
            self.assertNotIn('matrix-secret', commands)

    def test_failed_dump_keeps_previous_snapshot_and_restarts_active_writers(self):
        with tempfile.TemporaryDirectory() as directory:
            previous = Path(directory) / 'matrix_postgresql.pg_dump.gz'
            previous.write_bytes(b'previous')
            result, commands = self.run_dump(directory, active=True, fail_dump=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(previous.read_bytes(), b'previous')
            self.assertFalse((Path(directory) / 'matrix_postgresql.pg_dump.gz.tmp').exists())
            self.assertIn('systemctl --user stop matrix2acrobits.service', commands)
            self.assertIn('systemctl --user stop matrix-synapse.service', commands)
            self.assertIn('systemctl --user start matrix-synapse.service', commands)
            self.assertIn('systemctl --user start matrix2acrobits.service', commands)


if __name__ == '__main__':
    unittest.main()
