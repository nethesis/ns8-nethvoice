# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later

import base64
import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


IMPORTER = Path(__file__).resolve().parents[2] / "freepbx/var/www/html/freepbx/rest/lib/csvimport.php"


@unittest.skipUnless(shutil.which("php"), "PHP CLI is required")
class CsvImportTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.synced = self.root / "synced"
        self.lookup = self.root / "lookup"
        self.status = self.root / "csvimport.code"
        # Keep the real importer flow, replacing only container dependencies.
        # An existing LDAP user must still be synchronized before its local ID
        # is available. The shell delay exposes an accidentally backgrounded sync.
        (self.root / "libUsers.php").write_text('''<?php
function getToken() { return 'test-token'; }
function userExists($username, $token) { return true; }
function getUserID($username) {
    touch(getenv('TEST_LOOKUP'));
    return file_exists(getenv('TEST_SYNCED')) ? 42 : null;
}
function triggerMiddlewareProfilesReload() {}
''')
        for name in ("libExtensions.php", "libCTI.php", "libMiddleware.php", "libMigration.php"):
            (self.root / name).write_text("<?php\n")
        sync = self.root / "fwconsole"
        sync.write_text('''#!/bin/sh
sleep 0.2
if [ "${TEST_SYNC_EXIT:-0}" -ne 0 ]; then
    exit "$TEST_SYNC_EXIT"
fi
touch "$TEST_SYNCED"
''')
        sync.chmod(0o755)
        retrieve = self.root / "retrieveHelper.sh"
        retrieve.write_text("#!/bin/sh\nexit 0\n")
        retrieve.chmod(0o755)
        self.script = self.root / "csvimport.php"
        self.script.write_text(
            IMPORTER.read_text()
            .replace("/var/www/html/freepbx/rest/lib/", str(self.root) + "/")
            .replace("/usr/bin/fwconsole", str(sync))
            .replace("/var/run/nethvoice/csvimport.code", str(self.status))
        )

    def run_import(self, sync_exit="0"):
        payload = base64.b64encode(b"csvtest,CSV test user\n").decode()
        result = subprocess.run(
            ["php", str(self.script), payload],
            env=dict(os.environ, TEST_SYNCED=str(self.synced),
                     TEST_LOOKUP=str(self.lookup), TEST_SYNC_EXIT=sync_exit),
            capture_output=True, text=True, timeout=10,
        )
        return result, json.loads(self.status.read_text())

    def test_import_waits_for_user_sync_before_looking_up_local_id(self):
        result, status = self.run_import()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(self.lookup.exists())
        self.assertEqual(status, {"exitcode": 0, "errors": "", "progress": 100})

    def test_failed_sync_stops_import_and_records_error(self):
        result, status = self.run_import(sync_exit="7")
        self.assertEqual(result.returncode, 1)
        self.assertFalse(self.lookup.exists())
        self.assertEqual(status["exitcode"], 1)
        self.assertIn("FreePBX user synchronization failed (exit 7)", status["errors"])


if __name__ == "__main__":
    unittest.main()
