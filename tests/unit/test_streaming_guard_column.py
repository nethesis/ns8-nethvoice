# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]


class StreamingGuardColumnTest(unittest.TestCase):
    def test_upgrades_add_the_column_of_new_installs_once(self):
        schema = (ROOT / 'mariadb/docker-entrypoint-initdb.d/10_asterisk.rest_cti_streaming-schema.sql').read_text()
        column = re.search(r"^\s*(`guard_addresses` [^\n]*?),?$", schema, re.M).group(1)
        update = (ROOT / 'freepbx/initdb.d/update.php').read_text()
        migration = re.search(
            r"TABLE_NAME = 'rest_cti_streaming'\s+AND COLUMN_NAME = 'guard_addresses'\";\s*"
            r"if \(\(int\)\$db->query\(\$sql\)->fetchColumn\(\) === 0\) \{\s*"
            r"\$db->exec\(\"ALTER TABLE `asterisk`\.`rest_cti_streaming` ADD COLUMN (.*?) AFTER `open`\"\);\s*\}",
            update)
        self.assertIsNotNone(migration)
        self.assertEqual(migration.group(1), column)
        self.assertEqual(column, "`guard_addresses` tinyint(1) NOT NULL DEFAULT '0'")


if __name__ == '__main__':
    unittest.main()
