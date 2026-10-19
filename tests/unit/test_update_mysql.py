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
        mysql = self.root / 'mysql'
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

    def run_init(self, **changes):
        return subprocess.run(['bash', str(self.script)], env=dict(self.env, **changes),
                              capture_output=True, text=True)

    def test_invalid_bindings_never_reach_mysql(self):
        for value in ['', '0', '65536', '1; DROP TABLE sipsettings', '１２３']:
            with self.subTest(value=value):
                result = self.run_init(ASTERISK_SIP_UDP_PORT=value)
                self.assertEqual(result.returncode, 2, result.stderr)
                self.assertFalse((self.root / 'calls').exists())

    def test_reversed_rtp_range_never_reaches_mysql(self):
        self.assertEqual(self.run_init(ASTERISK_RTPEND='21999').returncode, 2)
        self.assertFalse((self.root / 'calls').exists())

    def test_first_sql_failure_stops_preparation(self):
        result = self.run_init()
        self.assertEqual(result.returncode, 91)
        self.assertEqual((self.root / 'calls').read_text(), 'called')


if __name__ == '__main__':
    unittest.main()
