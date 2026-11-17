# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
from pathlib import Path
import re
import sqlite3
import unittest

ROOT = Path(__file__).resolve().parents[2]


class QueueJoinAnnouncementTest(unittest.TestCase):
    def test_backfill_preserves_existing_modes_and_is_idempotent(self):
        source = (ROOT / 'freepbx/initdb.d/update.php').read_text()
        query = re.search(r'\$db->exec\("(INSERT INTO `asterisk`\.`queues_details`.*?)"\);',
                          source, re.S).group(1)
        with sqlite3.connect(':memory:') as db:
            db.execute("ATTACH DATABASE ':memory:' AS asterisk")
            db.execute('CREATE TABLE asterisk.queues_config (extension TEXT PRIMARY KEY)')
            db.execute('''CREATE TABLE asterisk.queues_details (
                id TEXT NOT NULL, keyword TEXT NOT NULL, data TEXT NOT NULL,
                flags INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (id, keyword, data))''')
            db.executemany('INSERT INTO asterisk.queues_config VALUES (?)',
                           [(str(queue),) for queue in range(600, 606)])
            existing = [
                ('600', 'retry', '5', 0),
                ('600', 'member', 'Local/201@from-queue/n', 2),
                ('601', 'skip_joinannounce', '', 0),
                ('602', 'skip_joinannounce', 'free', 0),
                ('603', 'skip_joinannounce', 'ready', 0),
                ('604', 'skip_joinannounce', 'nofreeagent', 0),
                ('999', 'skip_joinannounce', 'ready', 0),
                ('-1', 'autofill', 'yes', 0),
            ]
            db.executemany('INSERT INTO asterisk.queues_details VALUES (?,?,?,?)', existing)
            expected = sorted(existing + [
                ('600', 'skip_joinannounce', '', 0),
                ('605', 'skip_joinannounce', '', 0),
            ])
            for _ in range(2):
                db.execute(query)
                self.assertEqual(db.execute(
                    'SELECT * FROM asterisk.queues_details ORDER BY id, keyword, data'
                ).fetchall(), expected)


if __name__ == '__main__':
    unittest.main()
