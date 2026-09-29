import importlib.machinery
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


def load_helper(name):
    path = Path(__file__).resolve().parents[2] / 'imageroot/bin' / name
    loader = importlib.machinery.SourceFileLoader(name, str(path))
    spec = importlib.util.spec_from_loader(name, loader)
    module = importlib.util.module_from_spec(spec)
    loader.exec_module(module)
    return module


matrix = load_helper('matrix-config')


class MatrixConfigurationTests(unittest.TestCase):
    def setUp(self):
        self.env = {
            'MODULE_ID': 'nethvoice1', 'NETHVOICE_MATRIX_ENABLED': 'True',
            'NETHVOICE_MATRIX_HOST': 'matrix.example.org',
            'MATRIX_POSTGRES_PORT': '20336', 'MATRIX_SYNAPSE_PORT': '20337',
            'MATRIX_M2A_PORT': '20338', 'NETHVOICE_MIDDLEWARE_MATRIX_PORT': '20339',
        }
        self.passwords = matrix.fill_secrets({'UNRELATED': 'retained'})

    def test_secrets_are_generated_once_and_preserved(self):
        self.assertEqual(matrix.fill_secrets(self.passwords), self.passwords)
        self.assertEqual(self.passwords['UNRELATED'], 'retained')
        self.assertEqual(len({self.passwords[name] for name in matrix.SECRET_NAMES}), 8)
        partial = dict(self.passwords)
        del partial['MATRIX_INTERNAL_AUTH_TOKEN']
        backfilled = matrix.fill_secrets(partial)
        for name in partial:
            self.assertEqual(backfilled[name], partial[name])

    def test_generated_config_is_private_and_preserves_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory)
            matrix.generate(state, self.env, self.passwords)
            config = json.loads((state / 'matrix/synapse/homeserver.yaml').read_text())
            self.assertEqual(config['server_name'], self.env['NETHVOICE_MATRIX_HOST'])
            self.assertEqual(config['listeners'][0]['bind_addresses'], ['127.0.0.1'])
            self.assertEqual(config['listeners'][0]['resources'][0]['names'], ['client'])
            self.assertFalse(config['enable_registration'])
            self.assertFalse(config['password_config']['localdb_enabled'])
            self.assertNotIn('ldap', json.dumps(config).lower())
            self.assertEqual((state / 'matrix/synapse/homeserver.yaml').stat().st_mode & 0o777, 0o600)
            changed = {**self.env, 'NETHVOICE_MATRIX_HOST': 'other.example.org'}
            with self.assertRaises(ValueError):
                matrix.generate(state, changed, self.passwords)

    def test_disable_removes_advertisement_but_retains_data_and_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory)
            matrix.generate(state, self.env, self.passwords)
            original = (state / 'matrix/identity.json').read_text()
            matrix.generate(state, {**self.env, 'NETHVOICE_MATRIX_ENABLED': 'False'}, self.passwords)
            self.assertEqual((state / 'middleware.env').read_text(), 'NETHVOICE_MATRIX_BASE_URL=\n')
            self.assertEqual((state / 'matrix/identity.json').read_text(), original)
            self.assertTrue((state / 'matrix/synapse/homeserver.yaml').exists())

    def test_namespace_matches_only_local_users_and_reserved_aliases(self):
        import re
        _, registration, _ = matrix.configurations(self.env, self.passwords)
        namespaces = registration['namespaces']
        self.assertEqual(namespaces['rooms'], [])
        self.assertFalse(namespaces['users'][0]['exclusive'])
        user = re.compile(namespaces['users'][0]['regex'])
        self.assertIsNotNone(user.fullmatch('@alice:' + self.env['NETHVOICE_MATRIX_HOST']))
        self.assertIsNone(user.fullmatch('@alice:other.example.org'))
        alias = re.compile(namespaces['aliases'][0]['regex'])
        self.assertIsNotNone(alias.fullmatch('#_acrobits_' + 'a' * 64 + ':' + self.env['NETHVOICE_MATRIX_HOST']))
        self.assertIsNone(alias.fullmatch('#general:' + self.env['NETHVOICE_MATRIX_HOST']))

    def test_settings_reject_invalid_conflicting_or_changed_identity(self):
        self.assertEqual(matrix.validate_settings(self.env, {}), [])
        self.assertEqual(matrix.validate_settings(self.env, {}, wizard_complete=False)[0]['error'], 'matrix_setup_required')
        self.assertEqual(matrix.validate_settings(self.env, {'matrix_host': ''})[0]['error'], 'matrix_host_required')
        self.assertEqual(matrix.validate_settings(self.env, {'matrix_host': 'bad/example.org'})[0]['error'], 'matrix_host_invalid')
        self.assertEqual(matrix.validate_settings(self.env, {'matrix_host': 'pbx.example.org', 'nethvoice_host': 'pbx.example.org'})[0]['error'], 'matrix_host_conflict')
        self.assertEqual(matrix.validate_settings(self.env, {'matrix_host': 'other.example.org'}, {'server_name': self.env['NETHVOICE_MATRIX_HOST']})[0]['error'], 'matrix_host_immutable')

    def test_credentials_are_serialized_without_yaml_interpolation(self):
        self.passwords['MATRIX_POSTGRES_PASSWORD'] = 'a"\n: {danger: value}'
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory)
            matrix.generate(state, self.env, self.passwords)
            config = json.loads((state / 'matrix/synapse/homeserver.yaml').read_text())
            self.assertEqual(config['database']['args']['password'], self.passwords['MATRIX_POSTGRES_PASSWORD'])


if __name__ == '__main__':
    unittest.main()
