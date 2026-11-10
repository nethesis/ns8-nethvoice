# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
import os
from pathlib import Path
import sqlite3
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class LegacySipCheckTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        self.database = self.directory / 'asterisk.db'
        self.db = sqlite3.connect(self.database)
        self.addCleanup(self.db.close)
        self.db.executescript('''
            CREATE TABLE trunks (trunkid INTEGER, tech TEXT, disabled TEXT);
            CREATE TABLE devices (id TEXT, tech TEXT);
            CREATE TABLE admin (variable TEXT, value TEXT);
            INSERT INTO admin VALUES ('MIGRATION_SCRIPT', '2');
            INSERT INTO trunks VALUES (1, 'pjsip', 'off'), (2, 'iax', 'off');
            INSERT INTO devices VALUES ('201', 'pjsip');
        ''')
        # Run the actual shell query through a client backed by a disposable DB.
        (self.directory / 'podman').write_text('''#!/bin/sh
test "$1 $2 $3" = 'exec -i mariadb' || exit 90
shift 3
exec "$@"
''')
        (self.directory / 'mariadb').write_text('''#!/usr/bin/env python3
import os, sqlite3, sys
if os.environ.get('TEST_DB_FAILURE'): sys.exit(17)
if os.environ.get('TEST_BAD_OUTPUT'):
    print('unexpected output')
    sys.exit(0)
with sqlite3.connect(os.environ['TEST_DATABASE']) as db:
    for row in db.execute(sys.stdin.read()):
        print(*row, sep='\t')
''')
        for name in ['podman', 'mariadb']:
            (self.directory / name).chmod(0o755)

    def run_check(self, **extra):
        self.db.commit()
        return subprocess.run(['bash', str(ROOT / 'imageroot/bin/check-legacy-sip')],
                              env=dict(os.environ, PATH=str(self.directory) + ':' + os.environ['PATH'],
                                       TEST_DATABASE=str(self.database), **extra),
                              capture_output=True, text=True, timeout=10)

    def test_pjsip_and_other_technologies_are_allowed(self):
        result = self.run_check()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, '')

    def test_legacy_rows_block_even_with_marker_and_are_never_modified(self):
        for table, row in [('trunks', "(3, 'sip', 'off')"),
                           ('trunks', "(4, 'sip', 'on')"),
                           ('devices', "('202', 'sip')")]:
            with self.subTest(table=table, row=row):
                self.db.execute(f'INSERT INTO {table} VALUES {row}')
                before = list(self.db.iterdump())
                for _ in range(2):
                    result = self.run_check()
                    self.assertEqual(result.returncode, 1)
                    self.assertEqual(result.stdout, '')
                    self.assertIn('legacy chan_sip trunks/devices', result.stderr)
                    self.assertIn('pre-upgrade NS8 backup', result.stderr)
                    self.assertEqual(list(self.db.iterdump()), before)
                self.db.execute(f'DELETE FROM {table} WHERE tech = ?', ('sip',))
                self.assertEqual(self.run_check().returncode, 0)

    def test_database_errors_and_invalid_results_block_replacement(self):
        for extra in [{'TEST_DB_FAILURE': '1'}, {'TEST_BAD_OUTPUT': '1'}]:
            with self.subTest(extra=extra):
                result = self.run_check(**extra)
                self.assertEqual(result.returncode, 1)
                self.assertIn('must not be replaced', result.stderr)


if __name__ == '__main__':
    unittest.main()
