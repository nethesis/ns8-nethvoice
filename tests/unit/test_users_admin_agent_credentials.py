# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later

import ast
import json
import subprocess
import types
import unittest
from pathlib import Path
from unittest import mock


CHECK = Path(__file__).resolve().parents[1] / "10_nethvoice_actions/UsersAdminAgentCredentials.py"


class UsersAdminAgentCredentialsTest(unittest.TestCase):
    def setUp(self):
        # Load the remote helpers without Robot, SSH or an installed NS8 agent.
        source = ast.parse(CHECK.read_text())
        remote = next(
            ast.literal_eval(node.value) for node in source.body
            if isinstance(node, ast.Assign) and node.targets[0].id == "REMOTE_CHECK"
        )
        functions = ast.Module(
            body=[node for node in ast.parse(remote).body if isinstance(node, ast.FunctionDef)],
            type_ignores=[],
        )
        self.process = types.SimpleNamespace(run=mock.Mock(), TimeoutExpired=subprocess.TimeoutExpired)
        self.clock = mock.Mock()
        self.namespace = {
            "subprocess": self.process, "time": self.clock, "json": json,
            "password": 'test-password"quoted', "agent_env": {},
            "environment": {"NETHVOICE_MIDDLEWARE_SUPER_ADMIN_TOKEN": "middleware-secret"},
            "os": types.SimpleNamespace(environ={}),
        }
        exec(compile(functions, str(CHECK), "exec"), self.namespace)

    def test_waits_until_initialization_completes(self):
        self.clock.monotonic.side_effect = [0, 0, 2]
        self.process.run.side_effect = [
            types.SimpleNamespace(returncode=1),
            types.SimpleNamespace(returncode=0),
        ]
        self.namespace["wait_for_freepbx"]()
        self.assertEqual(self.process.run.call_count, 2)
        self.clock.sleep.assert_called_once_with(2)

    def test_readiness_wait_has_a_deadline(self):
        self.clock.monotonic.side_effect = [0, 0, 2]
        self.process.run.return_value = types.SimpleNamespace(returncode=1)
        with self.assertRaisesRegex(RuntimeError, "initialization did not complete within 2 seconds"):
            self.namespace["wait_for_freepbx"](timeout=2)
        self.assertEqual(self.process.run.call_count, 1)

    def test_import_failure_includes_diagnostics_and_redacts_credentials(self):
        password = self.namespace["password"]
        self.process.run.return_value = types.SimpleNamespace(
            returncode=0, stdout=json.dumps({"errors": "missing local user ID", "secret": password})
        )
        result = types.SimpleNamespace(
            returncode=1, stdout=password,
            stderr="bearer-token middleware-secret Nethesis,1234",
        )
        message = self.namespace["csv_import_failure"](result, "bearer-token")
        details = json.loads(message.split(": ", 1)[1])
        self.assertEqual(details["exitcode"], 1)
        self.assertEqual(details["stdout"], "[redacted]")
        self.assertEqual(details["stderr"], "[redacted] [redacted] [redacted]")
        self.assertIn("missing local user ID", details["status"])
        self.assertEqual(json.loads(details["status"])["secret"], "[redacted]")

    def test_missing_status_does_not_hide_importer_error(self):
        self.process.run.return_value = types.SimpleNamespace(returncode=1, stdout="")
        result = types.SimpleNamespace(returncode=1, stdout="", stderr="sync failed")
        message = self.namespace["csv_import_failure"](result, "bearer-token")
        self.assertIn("sync failed", message)
        self.assertIn("unavailable", message)

    def test_status_timeout_preserves_original_failure(self):
        self.process.run.side_effect = subprocess.TimeoutExpired("podman", 15)
        result = types.SimpleNamespace(returncode=1, stdout="", stderr="sync failed")
        message = self.namespace["csv_import_failure"](result, "bearer-token")
        self.assertIn("sync failed", message)
        self.assertIn("unavailable", message)


if __name__ == "__main__":
    unittest.main()
