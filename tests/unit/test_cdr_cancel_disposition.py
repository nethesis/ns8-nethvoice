# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
from pathlib import Path
import re
import sqlite3
import unittest

ROOT = Path(__file__).resolve().parents[2]


class CdrCancelDispositionTest(unittest.TestCase):
    def setUp(self):
        source = (ROOT / 'freepbx/initdb.d/update.php').read_text()
        self.query = re.search(
            r'\$db->exec\("(INSERT INTO `asterisk`\.`freepbx_settings`.*?)"\);',
            source, re.S).group(1)
        self.db = sqlite3.connect(':memory:')
        self.addCleanup(self.db.close)
        self.db.execute("ATTACH DATABASE ':memory:' AS asterisk")
        self.db.execute('''CREATE TABLE asterisk.freepbx_settings (
            keyword TEXT PRIMARY KEY, value TEXT, name TEXT, level INTEGER,
            description TEXT, type TEXT, options TEXT, defaultval TEXT,
            readonly INTEGER, hidden INTEGER, category TEXT, module TEXT,
            emptyok INTEGER, sortorder INTEGER)''')
        # MariaDB supplies DUAL; provide its single row for this SQL test.
        self.db.execute('CREATE TABLE DUAL (dummy INTEGER)')
        self.db.execute('INSERT INTO DUAL VALUES (1)')
        self.db.execute("INSERT INTO asterisk.freepbx_settings (keyword, value) VALUES ('CDR_BATCH_ENABLE', '1')")

    def test_missing_setting_gets_complete_definition_and_is_idempotent(self):
        for _ in range(2):
            self.db.execute(self.query)
            row = self.db.execute('''SELECT keyword, value, name, level, type, options,
                defaultval, readonly, hidden, category, module, emptyok, sortorder
                FROM asterisk.freepbx_settings WHERE keyword = 'CANCELDISPOSITION'
            ''').fetchone()
            self.assertEqual(row, ('CANCELDISPOSITION', '0', 'Cancel disposition enabled',
                                   0, 'bool', '', '0', 0, 0, 'cdr', 'cdr', 0, 9))
            self.assertTrue(self.db.execute("SELECT description FROM asterisk.freepbx_settings WHERE keyword = 'CANCELDISPOSITION'").fetchone()[0])
            self.assertEqual(self.db.execute(
                'SELECT COUNT(*) FROM asterisk.freepbx_settings').fetchone()[0], 2)
            self.assertEqual(self.db.execute("SELECT value FROM asterisk.freepbx_settings WHERE keyword = 'CDR_BATCH_ENABLE'").fetchone()[0], '1')

    def test_existing_values_and_metadata_are_preserved(self):
        for value in ['0', '1', '', None]:
            with self.subTest(value=value):
                self.db.execute("DELETE FROM asterisk.freepbx_settings WHERE keyword = 'CANCELDISPOSITION'")
                self.db.execute('''INSERT INTO asterisk.freepbx_settings
                    (keyword, value, name) VALUES ('CANCELDISPOSITION', ?, 'Existing setting')''', (value,))
                before = self.db.execute('SELECT * FROM asterisk.freepbx_settings ORDER BY keyword').fetchall()
                self.db.execute(self.query)
                self.assertEqual(self.db.execute(
                    'SELECT * FROM asterisk.freepbx_settings ORDER BY keyword').fetchall(), before)


if __name__ == '__main__':
    unittest.main()
