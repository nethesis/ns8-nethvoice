import contextlib
import io
import json
import os
from pathlib import Path
import re
import runpy
import sys
import tempfile
import types
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[2]
CONFIG_ACTION = ROOT / 'imageroot/actions/configure-module/73matrix'
VALIDATION_ACTION = ROOT / 'imageroot/actions/configure-module/12validate_matrix'
UPDATE_STEP = ROOT / 'imageroot/update-module.d/22matrix'


def load_action(path):
    with patch.dict(sys.modules, {'agent': types.SimpleNamespace()}):
        return types.SimpleNamespace(**runpy.run_path(str(path)))


matrix = load_action(CONFIG_ACTION)
validation = load_action(VALIDATION_ACTION)


class MatrixConfigurationTests(unittest.TestCase):
    def setUp(self):
        self.env = {
            'MODULE_ID': 'nethvoice1', 'NETHVOICE_MATRIX_ENABLED': 'True',
            'NETHVOICE_MATRIX_HOST': 'matrix.example.org',
            'MATRIX_POSTGRES_PORT': '20336', 'MATRIX_SYNAPSE_PORT': '20337',
            'MATRIX_M2A_PORT': '20338', 'NETHVOICE_MIDDLEWARE_MATRIX_PORT': '20339',
        }
        self.passwords = {'UNRELATED': 'retained', **{
            name: 'token_' + str(index) for index, name in enumerate((
                'MATRIX_POSTGRES_PASSWORD', 'MATRIX_REGISTRATION_SECRET',
                'MATRIX_MACAROON_SECRET', 'MATRIX_FORM_SECRET',
                'MATRIX_SYNAPSE_SECRET', 'MATRIX_M2A_AS_TOKEN',
                'MATRIX_M2A_HS_TOKEN', 'MATRIX_INTERNAL_AUTH_TOKEN',
            ))}}

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
            advertised = (state / 'middleware.env').read_text()
            with self.assertRaises(ValueError):
                matrix.generate(state, changed, self.passwords)
            self.assertEqual((state / 'middleware.env').read_text(), advertised)

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
        self.assertEqual(validation.validate_settings(self.env, {}), [])
        self.assertEqual(validation.validate_settings(self.env, {}, wizard_complete=False)[0]['error'], 'matrix_setup_required')
        self.assertEqual(validation.validate_settings(self.env, {'matrix_host': ''})[0]['error'], 'matrix_host_required')
        self.assertEqual(validation.validate_settings(self.env, {'matrix_host': 'bad/example.org'})[0]['error'], 'matrix_host_invalid')
        self.assertEqual(validation.validate_settings(self.env, {'matrix_host': 'pbx.example.org', 'nethvoice_host': 'pbx.example.org'})[0]['error'], 'matrix_host_conflict')
        self.assertEqual(validation.validate_settings(self.env, {'matrix_host': 'other.example.org'}, {'server_name': self.env['NETHVOICE_MATRIX_HOST']})[0]['error'], 'matrix_host_immutable')

    def test_credentials_are_serialized_without_yaml_interpolation(self):
        self.passwords['MATRIX_POSTGRES_PASSWORD'] = 'a"\n: {danger: value}'
        config, _, _ = matrix.configurations(self.env, self.passwords)
        self.assertEqual(config['database']['args']['password'], self.passwords['MATRIX_POSTGRES_PASSWORD'])
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError, 'Invalid Matrix service credential'):
                matrix.generate(Path(directory), self.env, self.passwords)

    def test_service_env_files_have_only_needed_secrets_and_are_private(self):
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory)
            output = io.StringIO()
            with contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
                matrix.generate(state, self.env, self.passwords)
            self.assertEqual(output.getvalue(), '')
            pg = state / 'matrix/postgresql.env'
            bridge = state / 'matrix/m2a.env'
            self.assertEqual(pg.stat().st_mode & 0o777, 0o600)
            self.assertEqual(bridge.stat().st_mode & 0o777, 0o600)
            self.assertEqual(pg.read_text(), 'POSTGRES_PASSWORD=' + self.passwords['MATRIX_POSTGRES_PASSWORD'] + '\n')
            self.assertEqual(bridge.read_text().splitlines(), [
                'MATRIX_AS_TOKEN=' + self.passwords['MATRIX_M2A_AS_TOKEN'],
                'MATRIX_HS_TOKEN=' + self.passwords['MATRIX_M2A_HS_TOKEN'],
                'EXT_AUTH_TOKEN=' + self.passwords['MATRIX_INTERNAL_AUTH_TOKEN'],
            ])
            units = ROOT / 'imageroot/systemd/user'
            for name, secret_names in (
                ('matrix-postgresql.service', ('MATRIX_POSTGRES_PASSWORD', 'POSTGRES_PASSWORD=${')),
                ('matrix2acrobits.service', ('MATRIX_M2A_AS_TOKEN', 'MATRIX_M2A_HS_TOKEN', 'MATRIX_INTERNAL_AUTH_TOKEN')),
            ):
                unit = (units / name).read_text()
                self.assertIn('--env-file=%E/state/matrix/', unit)
                for secret in secret_names:
                    self.assertNotIn(secret, unit)

    def test_upgrade_allocates_once_and_preserves_existing_secrets(self):
        env = {'NETHVOICE_MATRIX_HOST': 'matrix.example.org'}
        passwords = {'UNRELATED': 'retained', 'MATRIX_M2A_AS_TOKEN': 'existing-secret'}
        allocations = []
        writes = []

        def allocate_ports(count, protocol, keep_existing):
            self.assertEqual((count, protocol, keep_existing), (1, 'tcp', True))
            port = 21000 + len(allocations)
            allocations.append(port)
            return port, port

        def write_passwords(name, values):
            self.assertEqual(name, 'passwords.env')
            passwords.update(values)
            writes.append(dict(values))

        agent = types.SimpleNamespace(
            read_envfile=lambda name: env if name == 'environment' else passwords,
            write_envfile=write_passwords,
            set_env=lambda name, value: env.update({name: value}),
            allocate_ports=allocate_ports,
        )
        with patch.dict(sys.modules, {'agent': agent}), \
                patch.dict(os.environ, {'AGENT_INSTALL_DIR': '/tmp/nethvoice-test'}), \
                patch('subprocess.run') as run_configure:
            runpy.run_path(str(UPDATE_STEP))
            first_passwords = dict(passwords)
            runpy.run_path(str(UPDATE_STEP))

        port_names = ('MATRIX_POSTGRES_PORT', 'MATRIX_SYNAPSE_PORT',
                      'MATRIX_M2A_PORT', 'NETHVOICE_MIDDLEWARE_MATRIX_PORT')
        self.assertEqual([env[name] for name in port_names], ['21000', '21001', '21002', '21003'])
        self.assertEqual(env['NETHVOICE_MIDDLEWARE_MATRIX_LISTEN_ADDRESS'], '127.0.0.1:21003')
        self.assertEqual(env['NETHVOICE_MATRIX_HOST'], 'matrix.example.org')
        self.assertEqual(env['NETHVOICE_MATRIX_ENABLED'], 'False')
        self.assertEqual(len(allocations), 4)
        self.assertEqual(passwords, first_passwords)
        self.assertEqual(passwords['MATRIX_M2A_AS_TOKEN'], 'existing-secret')
        self.assertEqual(passwords['UNRELATED'], 'retained')
        self.assertEqual(len(passwords), 9)
        self.assertEqual(len(writes), 2)
        self.assertEqual(run_configure.call_count, 2)


if __name__ == '__main__':
    unittest.main()
