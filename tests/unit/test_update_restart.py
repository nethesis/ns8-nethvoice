# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
import os
from pathlib import Path
import subprocess
import tempfile
import types
import unittest
from unittest import mock

from event_test_utils import load_script

ROOT = Path(__file__).resolve().parents[2]


class UpdateRestartTest(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.path = Path(directory.name)
        self.log = self.path / "commands"
        self.env = dict(os.environ, PATH=f"{self.path}:{os.environ['PATH']}",
                        UPDATE_LOG=str(self.log), FAIL_RESTART="0", FAIL_RECOVERY="")
        scripts = {
            "systemctl": 'echo "systemctl $*" >> "$UPDATE_LOG"\n',
            "restart-services-when-convenient":
                'echo "restart $*" >> "$UPDATE_LOG"\nexit "$FAIL_RESTART"\n',
            "recover-dependent-services":
                'echo "recover $*" >> "$UPDATE_LOG"\n[ "$3" != "$FAIL_RECOVERY" ]\n',
        }
        for name, body in scripts.items():
            script = self.path / name
            script.write_text("#!/bin/sh\n" + body)
            script.chmod(0o755)
        self.ports = dict(ASTERISK_RTPSTART="22000", ASTERISK_RTPEND="22499",
                          ASTERISK_SIP_UDP_PORT="23002", ASTERISK_IAX_PORT="23001")
        agent = types.ModuleType("agent")
        agent.read_envfile = mock.Mock(return_value=self.ports)
        self.preparation = load_script("restart_port_preparation",
                                       ROOT / "imageroot/update-module.d/78update_mysql", {"agent": agent})
        self.active = True
        self.fail_preparation = None

    def record(self, text):
        with self.log.open("a") as stream:
            print(text, file=stream)

    def prepare_command(self, command, **kwargs):
        if command[0] == "systemctl":
            self.record("check-freepbx")
            return subprocess.CompletedProcess(command, 0 if self.active else 3)
        operation = "prepare-database" if command[3] == "mariadb" else "generate-configuration"
        self.record(operation)
        if operation == self.fail_preparation:
            raise subprocess.CalledProcessError(1, command)
        return subprocess.CompletedProcess(command, 0)

    def pipeline(self):
        # Model the NS8 lexical step runner: failure in 78 prevents 80.
        with mock.patch.object(self.preparation.subprocess, "run", side_effect=self.prepare_command):
            self.preparation.main()
        return subprocess.run([str(ROOT / "imageroot/update-module.d/80restart")],
                              env=self.env, capture_output=True, text=True, timeout=5)

    def commands(self):
        return self.log.read_text().splitlines() if self.log.exists() else []

    def test_prepares_before_restart_and_then_recovers_only_mapped_dependents(self):
        result = self.pipeline()
        self.assertEqual(result.returncode, 0, result.stderr)
        commands = self.commands()
        self.assertEqual(commands[:4], ["check-freepbx", "prepare-database",
                                       "generate-configuration", "systemctl --user daemon-reload"])
        self.assertTrue(commands[4].startswith("restart mariadb freepbx janus "))
        self.assertIn(" tancredi ", commands[4])
        self.assertEqual(commands[5:], ["recover --wait 120 freepbx.service",
                                       "recover --wait 120 reports-api.service"])
        self.assertEqual(result.stdout, "")

    def test_inactive_freepbx_preserves_preparation_skip_and_conditional_restart(self):
        self.active = False
        result = self.pipeline()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.commands()[0], "check-freepbx")
        self.assertFalse(any(c.startswith("prepare-") for c in self.commands()))
        self.assertTrue(self.commands()[2].startswith("restart "))

    def test_invalid_ports_prevent_restart(self):
        self.ports["ASTERISK_SIP_UDP_PORT"] = "0"
        with self.assertRaises(ValueError):
            self.pipeline()
        self.assertEqual(self.commands(), ["check-freepbx"])

    def test_preparation_errors_prevent_restart(self):
        for operation in ("prepare-database", "generate-configuration"):
            with self.subTest(operation=operation):
                self.log.unlink(missing_ok=True)
                self.fail_preparation = operation
                with self.assertRaises(subprocess.CalledProcessError):
                    self.pipeline()
                self.assertFalse(any(c.startswith("restart ") for c in self.commands()))

    def test_restart_failure_prevents_recovery(self):
        self.env["FAIL_RESTART"] = "1"
        result = self.pipeline()
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(any(c.startswith("recover ") for c in self.commands()))

    def test_recovery_failure_fails_update(self):
        for parent in ("freepbx.service", "reports-api.service"):
            with self.subTest(parent=parent):
                self.env["FAIL_RECOVERY"] = parent
                result = self.pipeline()
                self.assertNotEqual(result.returncode, 0)


if __name__ == "__main__":
    unittest.main()
