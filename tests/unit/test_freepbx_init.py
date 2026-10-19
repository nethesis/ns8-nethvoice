# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later

import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


INIT = Path(__file__).resolve().parents[2] / "freepbx/freepbx_init.sh"
OLD_TRANSPORT = "[0.0.0.0-udp]\nprotocol=udp\nbind=0.0.0.0:20132\n"
NEW_TRANSPORT = OLD_TRANSPORT.replace("20132", "23002")


class FreepbxInitTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.transport = self.root / "pjsip.transports.conf"
        self.transport.write_text(OLD_TRANSPORT)
        self.calls = self.root / "calls.jsonl"
        self.database = self.root / "configuration.sqlite"
        self.http = self.root / "http.conf"
        with sqlite3.connect(self.database) as database:
            database.executescript(
                'CREATE TABLE kvstore_Sipsettings (`key` TEXT PRIMARY KEY, val TEXT);'
                'CREATE TABLE freepbx_settings (keyword TEXT PRIMARY KEY, value TEXT);'
            )
            database.execute(
                'INSERT INTO kvstore_Sipsettings VALUES ("binds", ?)',
                [json.dumps({"ws": {"0.0.0.0": "off"}, "wss": {"0.0.0.0": "off"}})],
            )
            database.execute(
                'INSERT INTO freepbx_settings VALUES ("HTTPTLSBINDADDRESS", "::")'
            )
        # Execute the real PHP that constructs transport updates. Record its SQL
        # and apply the UPDATEs to SQLite so these tests check their effects.
        self.db_config = self.root / "freepbx_db.conf"
        self.db_config.write_text('''<?php
class TestDatabase {
    public static function record($sql, $parameters = []) {
        file_put_contents(getenv('TEST_SQL_LOG'), json_encode([$sql, $parameters]) . "\\n", FILE_APPEND);
        return true;
    }
    public function query($sql) { return self::record($sql); }
    public function prepare($sql) { return new TestStatement($sql); }
}
class TestStatement {
    public function __construct(private $sql) {}
    public function execute($parameters) { return TestDatabase::record($this->sql, $parameters); }
}
$db = new TestDatabase();
''')
        modules = self.root / "custom-modules"
        modules.mkdir()
        binary = self.root / "bin"
        binary.mkdir()
        # Run the actual init script with container commands replaced. Database
        # and permission updates are skipped; reload and module installation can
        # rewrite the transport file just as they do during an upgrade.
        stub = binary / "stub"
        stub.write_text(
            f"#!{sys.executable}\n"
            "import json, os, sqlite3, subprocess, sys\n"
            "from pathlib import Path\n"
            "command = Path(sys.argv[0]).name\n"
            "args = sys.argv[1:]\n"
            "transport = Path(os.environ['TEST_TRANSPORT'])\n"
            "with open(os.environ['TEST_CALLS'], 'a') as output:\n"
            "    output.write(json.dumps([command, *args]) + '\\n')\n"
            "if command == 'asterisk':\n"
            "    if args == ['-rx', 'core show version']:\n"
            "        print('Asterisk 22.10.0')\n"
            "    elif args == ['-rx', 'core restart now']:\n"
            "        sys.exit(int(os.environ.get('TEST_RESTART_EXIT', '0')))\n"
            "    else:\n"
            "        sys.exit(99)\n"
            "elif command == 'fwconsole':\n"
            "    if args == ['ma', 'list']:\n"
            "        status = 'Disabled' if os.environ.get('TEST_MODULE_REWRITE') else 'Enabled'\n"
            "        print('| framework | 17.0 | ' + status + ' |')\n"
            "        if os.environ.get('TEST_CORE_INSTALL'):\n"
            "            print('| core | 17.0 | Disabled |')\n"
            "    elif args[:2] == ['moduleadmin', 'install']:\n"
            "        transport.write_text(os.environ['TEST_NEW_TRANSPORT'])\n"
            "        if args[2] == 'core':\n"
            "            with sqlite3.connect(os.environ['TEST_DATABASE']) as db:\n"
            "                db.execute(\"UPDATE freepbx_settings SET value='127.0.0.1' WHERE keyword='HTTPTLSBINDADDRESS' AND value='::'\")\n"
            "elif command == 'su':\n"
            "    calls = [json.loads(line) for line in Path(os.environ['TEST_CALLS']).read_text().splitlines()]\n"
            "    if sum(call[0] == 'su' for call in calls) <= int(os.environ.get('TEST_BUSY_RELOADS', '0')):\n"
            "        print(json.dumps({'error': 'Process is already running.', 'trace': 'Process ID : 42'}, separators=(',', ':')))\n"
            "        sys.exit(255)\n"
            "    transport.write_text(os.environ['TEST_NEW_TRANSPORT'])\n"
            "    if os.environ.get('TEST_SQL_MODE'):\n"
            "        with sqlite3.connect(os.environ['TEST_DATABASE']) as db:\n"
            "            binds = json.loads(db.execute(\"SELECT val FROM kvstore_Sipsettings WHERE `key`='binds'\").fetchone()[0])\n"
            "            address = db.execute(\"SELECT value FROM freepbx_settings WHERE keyword='HTTPTLSBINDADDRESS'\").fetchone()[0]\n"
            "        with transport.open('a') as output:\n"
            "            for protocol in ('ws', 'wss'):\n"
            "                if binds.get(protocol, {}).get('0.0.0.0') == 'on':\n"
            "                    output.write('[' + protocol + ']\\nprotocol=' + protocol + '\\n')\n"
            "        Path(os.environ['TEST_HTTP']).write_text('tlsbindaddr=' + address + ':8089\\n')\n"
            "    if os.environ.get('TEST_REMOVE_TRANSPORT'):\n"
            "        transport.unlink()\n"
            "    sys.exit(int(os.environ.get('TEST_RELOAD_EXIT', '0')))\n"
            "elif command == 'php':\n"
            "    code = args[1] if args[:1] == ['-r'] else sys.stdin.read()\n"
            "    if 'HTTPTLSBINDADDRESS' in code:\n"
            "        if os.environ.get('TEST_SQL_EXIT'):\n"
            "            sys.exit(int(os.environ['TEST_SQL_EXIT']))\n"
            "        if os.environ.get('TEST_SQL_MODE'):\n"
            "            code = code.replace('/etc/freepbx_db.conf', os.environ['TEST_DB_CONFIG'])\n"
            "            result = subprocess.run([os.environ['TEST_PHP']], input=code, text=True)\n"
            "            if result.returncode:\n"
            "                sys.exit(result.returncode)\n"
            "            with sqlite3.connect(os.environ['TEST_DATABASE']) as db:\n"
            "                for line in Path(os.environ['TEST_SQL_LOG']).read_text().splitlines():\n"
            "                    sql, parameters = json.loads(line)\n"
            "                    db.execute(sql, parameters)\n"
        )
        stub.chmod(0o755)
        for name in ("asterisk", "fwconsole", "su", "php", "ionice", "sleep"):
            (binary / name).symlink_to(stub)
        self.init = self.root / "freepbx_init.sh"
        self.init.write_text(
            INIT.read_text()
            .replace("/usr/sbin/asterisk", str(binary / "asterisk"))
            .replace("/etc/asterisk/pjsip.transports.conf", str(self.transport))
            .replace("/freepbx_custom_modules", str(modules))
        )
        self.environment = dict(
            os.environ,
            PATH=str(binary) + os.pathsep + os.environ["PATH"],
            TEST_TRANSPORT=str(self.transport),
            TEST_CALLS=str(self.calls),
            TEST_NEW_TRANSPORT=NEW_TRANSPORT,
            TEST_DATABASE=str(self.database),
            TEST_HTTP=str(self.http),
            TEST_DB_CONFIG=str(self.db_config),
            TEST_SQL_LOG=str(self.root / "queries.jsonl"),
            TEST_PHP=shutil.which("php") or "",
        )

    def run_init(self, **environment):
        result = subprocess.run(
            ["bash", str(self.init)], env=dict(self.environment, **environment),
            stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
            stderr=subprocess.PIPE, text=True, timeout=20,
        )
        calls = [json.loads(line) for line in self.calls.read_text().splitlines()]
        return result, calls

    def assert_restart_count(self, calls, count):
        self.assertEqual(calls.count(["asterisk", "-rx", "core restart now"]), count)

    def test_changed_port_restarts_only_after_successful_reload(self):
        result, calls = self.run_init()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assert_restart_count(calls, 1)
        reload_index = next(i for i, call in enumerate(calls) if call[0] == "su")
        restart_index = calls.index(["asterisk", "-rx", "core restart now"])
        self.assertLess(reload_index, restart_index)
        self.assertEqual(self.transport.read_text(), NEW_TRANSPORT)

    def test_unchanged_transports_do_not_restart(self):
        result, calls = self.run_init(TEST_NEW_TRANSPORT=OLD_TRANSPORT)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assert_restart_count(calls, 0)

    def test_module_installation_rewrite_is_included_in_comparison(self):
        result, calls = self.run_init(TEST_MODULE_REWRITE="1")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(["fwconsole", "moduleadmin", "install", "framework"], calls)
        self.assert_restart_count(calls, 1)

    def test_first_start_without_transport_file_restarts(self):
        self.transport.unlink()
        result, calls = self.run_init()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assert_restart_count(calls, 1)

    def test_failed_reload_does_not_restart_even_if_file_changed(self):
        result, calls = self.run_init(TEST_RELOAD_EXIT="1")
        self.assertEqual(result.returncode, 1)
        self.assert_restart_count(calls, 0)
        self.assertFalse(any("--host-changed" in call for call in calls))

    def test_reload_contention_retries_then_completes_initialization(self):
        result, calls = self.run_init(TEST_BUSY_RELOADS="2")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(sum(call[0] == "su" for call in calls), 3)
        self.assertEqual(calls.count(["sleep", "5"]), 2)
        self.assert_restart_count(calls, 1)
        self.assertTrue(any("--host-changed" in call for call in calls))

    def test_persistent_contention_has_a_bounded_retry_limit(self):
        result, calls = self.run_init(TEST_BUSY_RELOADS="60")
        self.assertEqual(result.returncode, 255)
        self.assertEqual(sum(call[0] == "su" for call in calls), 60)
        self.assertEqual(calls.count(["sleep", "5"]), 59)
        self.assert_restart_count(calls, 0)
        self.assertFalse(any("--host-changed" in call for call in calls))

    def test_unrelated_exit_255_is_not_retried(self):
        result, calls = self.run_init(TEST_RELOAD_EXIT="255")
        self.assertEqual(result.returncode, 255)
        self.assertEqual(sum(call[0] == "su" for call in calls), 1)
        self.assertNotIn(["sleep", "5"], calls)
        self.assert_restart_count(calls, 0)

    def test_transport_database_failure_prevents_reload(self):
        result, calls = self.run_init(TEST_SQL_EXIT="1")
        self.assertEqual(result.returncode, 1)
        self.assertFalse(any(call[0] == "su" for call in calls))
        self.assert_restart_count(calls, 0)

    @unittest.skipUnless(shutil.which("php"), "PHP CLI is required")
    def test_disabled_websockets_are_enabled_before_generation(self):
        result, calls = self.run_init(TEST_SQL_MODE="1", TEST_NEW_TRANSPORT=OLD_TRANSPORT)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("protocol=ws\n", self.transport.read_text())
        self.assertIn("protocol=wss\n", self.transport.read_text())
        self.assert_restart_count(calls, 1)
        self.assertTrue(any("--host-changed" in call for call in calls))

    @unittest.skipUnless(shutil.which("php"), "PHP CLI is required")
    def test_core_loopback_binding_is_repaired_before_reload(self):
        result, calls = self.run_init(TEST_SQL_MODE="1", TEST_CORE_INSTALL="1")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(["fwconsole", "moduleadmin", "install", "core"], calls)
        self.assertEqual(self.http.read_text(), "tlsbindaddr=0.0.0.0:8089\n")
        self.assertIn("protocol=wss\n", self.transport.read_text())

    @unittest.skipUnless(shutil.which("php"), "PHP CLI is required")
    def test_custom_https_binding_is_preserved(self):
        with sqlite3.connect(self.database) as database:
            database.execute(
                "UPDATE freepbx_settings SET value='192.0.2.17' WHERE keyword='HTTPTLSBINDADDRESS'"
            )
        result, _ = self.run_init(TEST_SQL_MODE="1", TEST_CORE_INSTALL="1")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.http.read_text(), "tlsbindaddr=192.0.2.17:8089\n")

    def test_missing_generated_file_fails_without_restart(self):
        result, calls = self.run_init(TEST_REMOVE_TRANSPORT="1")
        self.assertNotEqual(result.returncode, 0)
        self.assert_restart_count(calls, 0)

    def test_restart_failure_is_reported(self):
        result, calls = self.run_init(TEST_RESTART_EXIT="1")
        self.assertEqual(result.returncode, 1)
        self.assert_restart_count(calls, 1)
        self.assertFalse(any("--host-changed" in call for call in calls))


if __name__ == "__main__":
    unittest.main()
