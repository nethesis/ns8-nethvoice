import gzip
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from test_matrix_config import load_helper

state = load_helper('matrix-state')


class FakeDump:
    def __init__(self, payload, code):
        self.stdout = io.BytesIO(payload)
        self.code = code

    def wait(self):
        return self.code

    def poll(self):
        return self.code


class MatrixStateTests(unittest.TestCase):
    def test_move_preserves_identity_and_all_matrix_credentials(self):
        fresh = {name: 'new-' + name for name in state.matrix['SECRET_NAMES']}
        old = {name: 'old-' + name for name in state.matrix['SECRET_NAMES']}
        old['UNRELATED'] = 'old'
        fresh['UNRELATED'] = 'new'
        source = {'NETHVOICE_MATRIX_ENABLED': 'True', 'NETHVOICE_MATRIX_HOST': 'matrix.example.org'}
        settings, passwords = state.clone_environment({}, source, fresh, old, True)
        self.assertEqual(settings, source)
        self.assertEqual(passwords['UNRELATED'], 'new')
        for name in state.matrix['SECRET_NAMES']:
            self.assertEqual(passwords[name], old[name])

    def test_independent_clone_retains_fresh_credentials_and_clears_identity(self):
        settings, passwords = state.clone_environment({}, {'NETHVOICE_MATRIX_HOST': 'old.example.org'},
                                                      {'MATRIX_INTERNAL_AUTH_TOKEN': 'new'},
                                                      {'MATRIX_INTERNAL_AUTH_TOKEN': 'old'}, False)
        self.assertEqual(settings, {'NETHVOICE_MATRIX_ENABLED': 'False', 'NETHVOICE_MATRIX_HOST': ''})
        self.assertEqual(passwords['MATRIX_INTERNAL_AUTH_TOKEN'], 'new')

    def test_saved_startup_lists_cannot_enable_matrix_for_independent_clone(self):
        original = 'agent.service matrix-postgresql.service\nmatrix-synapse.service matrix2acrobits.service freepbx.service\n'
        self.assertEqual(state.filter_startup_units(original), 'agent.service freepbx.service\n')

    def test_snapshot_is_gzipped_and_atomically_published(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'dump.gz'
            with patch.object(state.subprocess, 'Popen', return_value=FakeDump(b'PGDMP-data', 0)):
                state.dump_database(target, 'matrix-postgresql', {})
            with gzip.open(target, 'rb') as stream:
                self.assertEqual(stream.read(), b'PGDMP-data')
            self.assertEqual(target.stat().st_mode & 0o777, 0o600)
            self.assertFalse(target.with_name('dump.gz.tmp').exists())

    def test_failed_dump_cannot_replace_a_previous_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'dump.gz'
            target.write_bytes(b'previous')
            with patch.object(state.subprocess, 'Popen', return_value=FakeDump(b'partial', 1)):
                with self.assertRaises(RuntimeError):
                    state.dump_database(target, 'matrix-postgresql', {})
            self.assertEqual(target.read_bytes(), b'previous')
            self.assertFalse(target.with_name('dump.gz.tmp').exists())

    def test_disabled_database_snapshot_has_no_network_and_stops_after_failure(self):
        env = {'POSTGRES_IMAGE': 'postgres:16.15-alpine', 'NETHVOICE_MATRIX_ENABLED': 'False'}
        commands = []
        with patch.object(state, 'container_running', return_value=False), \
                patch.object(state, 'run', side_effect=lambda *args, **kwargs: commands.append((args, kwargs))), \
                patch.object(state, 'wait_database'):
            with self.assertRaises(RuntimeError):
                with state.database(env, {'MATRIX_POSTGRES_PASSWORD': 'secret'}) as name:
                    self.assertEqual(name, 'matrix-postgresql-snapshot')
                    raise RuntimeError('dump failed')
        self.assertIn('--network=none', commands[0][0])
        self.assertNotIn('secret', ' '.join(commands[0][0]))
        self.assertEqual(commands[-1][0][:2], ('podman', 'stop'))

    def test_bridge_restore_consumes_snapshot_and_removes_stale_wal(self):
        with tempfile.TemporaryDirectory() as directory:
            volume = Path(directory)
            (volume / 'push.backup.db').write_bytes(b'consistent')
            (volume / 'push.db').write_bytes(b'old')
            (volume / 'push.db-wal').write_bytes(b'stale')
            state.restore_bridge_files(volume)
            self.assertEqual((volume / 'push.db').read_bytes(), b'consistent')
            self.assertFalse((volume / 'push.db-wal').exists())
            self.assertEqual((volume / 'push.db').stat().st_mode & 0o777, 0o600)

    def test_old_backup_without_matrix_snapshot_is_supported(self):
        with patch.object(state, 'volume_path', return_value=None):
            state.restore_bridge()
            self.assertFalse(state.database_initialized())

    def test_bridge_volume_probe_uses_podman_user_namespace(self):
        volume = Path('/rootless/matrix2acrobits-data/_data')
        with patch.object(state.subprocess, 'run', return_value=type('Result', (), {'returncode': 0})()) as command:
            self.assertTrue(state.volume_file_exists(volume, 'push.db'))
        self.assertEqual(command.call_args.args[0],
                         ['podman', 'unshare', 'test', '-f', str(volume / 'push.db')])

    def test_bridge_restore_enters_podman_user_namespace(self):
        volume = Path('/rootless/matrix2acrobits-data/_data')
        with patch.object(state, 'volume_path', return_value=volume), \
                patch.object(state, 'volume_file_exists', return_value=True), \
                patch.object(state, 'run') as command:
            state.restore_bridge()
        self.assertEqual(command.call_args.args[:3], ('podman', 'unshare', state.sys.executable))

    def test_failed_snapshot_restarts_only_previously_active_writers(self):
        commands = []
        with patch.object(state.subprocess, 'run', return_value=type('Result', (), {'returncode': 0})()), \
                patch.object(state, 'run', side_effect=lambda *args, **kwargs: commands.append(args)):
            with self.assertRaises(RuntimeError):
                with state.paused_chat():
                    raise RuntimeError('snapshot failed')
        self.assertEqual(commands[0], ('systemctl', '--user', 'stop', 'matrix2acrobits.service', 'matrix-synapse.service'))
        self.assertEqual(commands[1], ('systemctl', '--user', 'start', 'matrix-synapse.service', 'matrix2acrobits.service'))

    def test_disabled_snapshot_does_not_enable_services(self):
        with patch.object(state.subprocess, 'run', return_value=type('Result', (), {'returncode': 3})()), \
                patch.object(state, 'run') as command:
            with state.paused_chat():
                pass
        command.assert_not_called()

    def test_satellite_restore_matches_service_image_and_major_version(self):
        root = Path(__file__).resolve().parents[2]
        restore = (root / 'imageroot/actions/restore-module/23satellite_pg').read_text()
        service = (root / 'imageroot/systemd/user/satellite-pgsql.service').read_text()
        self.assertIn('${PGVECTOR_IMAGE}', restore)
        self.assertIn('${PGVECTOR_IMAGE}', service)
        self.assertIn('/var/lib/postgresql/18/docker', restore)
        self.assertIn('/var/lib/postgresql/18/docker', service)
        self.assertIn('psql -U "$POSTGRES_USER"', restore)


if __name__ == '__main__':
    unittest.main()
