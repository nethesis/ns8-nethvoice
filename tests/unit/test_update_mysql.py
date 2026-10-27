# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
INIT = ROOT / 'mariadb/usr/local/bin/nethvoice-db-init'


class DatabasePreparationTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        mysql = self.root / 'mariadb'
        mysql.write_text('#!/bin/sh\nprintf called >> "$TEST_CALLS"\nexit 91\n')
        mysql.chmod(0o755)
        self.env = dict(os.environ, PATH=str(self.root) + ':' + os.environ['PATH'],
                        TEST_CALLS=str(self.root / 'calls'), MARIADB_ROOT_PASSWORD='test')
        self.script = self.root / 'init.sh'
        self.script.write_text(INIT.read_text().replace('/docker-entrypoint-initdb.d/', str(self.root) + '/'))
        (self.root / '00_roomsdb-schema-create.sql').write_text('CREATE DATABASE IF NOT EXISTS roomsdb;')
        self.env.update({key: str(value) for key, value in {
            'ASTERISK_RTPSTART': 22000, 'ASTERISK_RTPEND': 22999,
            'ASTERISK_SIP_UDP_PORT': 23002, 'ASTERISK_IAX_PORT': 23001,
            'ASTERISK_SIP_PORT': 20132, 'ASTERISK_SIPS_PORT': 20133,
            'ASTERISK_WS_PORT': 20134, 'ASTERISK_WSS_PORT': 20135,
            'ASTMANAGERPORT': 20102, 'NETHVOICE_MARIADB_PORT': 20100,
        }.items()})

    def run_init(self, *options, **changes):
        return subprocess.run(['bash', str(self.script), *options], env=dict(self.env, **changes),
                              input='', capture_output=True, text=True)

    def test_invalid_bindings_never_reach_mysql(self):
        for value in ['', '0', '65536', '1; DROP TABLE sipsettings', '１２３']:
            with self.subTest(value=value):
                result = self.run_init(ASTERISK_SIP_UDP_PORT=value)
                self.assertEqual(result.returncode, 2, result.stderr)
                self.assertFalse((self.root / 'calls').exists())

    def test_reversed_rtp_range_never_reaches_mysql(self):
        self.assertEqual(self.run_init(ASTERISK_RTPEND='21999').returncode, 2)
        self.assertFalse((self.root / 'calls').exists())

    def test_fullwidth_digits_are_rejected_in_utf8_locale(self):
        result = self.run_init(ASTERISK_SIP_UDP_PORT='１２３', LC_ALL='en_US.utf8')
        self.assertEqual(result.returncode, 2, result.stderr)
        self.assertFalse((self.root / 'calls').exists())

    def test_permission_migrations_and_catalog_refresh_require_opt_in(self):
        for sql in (ROOT / 'mariadb/docker-entrypoint-initdb.d').glob('*.sql'):
            (self.root / sql.name).write_text('-- ' + sql.name)
        (self.root / 'mariadb').write_text('''#!/bin/bash
printf '%s\\n' "$*" >> "$TEST_CALLS"
if [[ "$*" == *'-e '* ]]; then
    case "$*" in
        *'COUNT(*) FROM roomsdb.rates'*) echo 1 ;;
        *CHARACTER_MAXIMUM_LENGTH*) echo 255 ;;
    esac
else
    cat >> "$TEST_CALLS"
fi
''')
        for options in [(), ('--migrate',), ('--socket', '--migrate')]:
            with self.subTest(options=options):
                (self.root / 'calls').unlink(missing_ok=True)
                result = self.run_init(*options, AMPDBUSER='freepbx', AMPDBPASS='test')
                self.assertEqual(result.returncode, 0, result.stderr)
                calls = (self.root / 'calls').read_text()
                for mutation in ['INSERT INTO `rest_cti_profiles_permissions`',
                                 'TRUNCATE TABLE', '50_asterisk.rest_pjsip_providers.sql',
                                 '50_asterisk.gateway_models.sql',
                                 'UPDATE sip s JOIN rest_devices_phones',
                                 "WHEN 'voicecodecs' THEN"]:
                    self.assertEqual(mutation in calls, '--migrate' in options, mutation)
                self.assertIn('INSERT INTO sipsettings', calls)

    def test_first_sql_failure_stops_preparation(self):
        result = self.run_init()
        self.assertEqual(result.returncode, 91)
        self.assertEqual((self.root / 'calls').read_text(), 'called')


if __name__ == '__main__':
    unittest.main()
