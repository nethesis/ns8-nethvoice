# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later

import os
import subprocess
import types
import unittest
from pathlib import Path
from unittest import mock

from event_test_utils import load_script


HOOK = Path(__file__).resolve().parents[2] / "imageroot/update-module.d/80restart"


class UpdateRestartTest(unittest.TestCase):
    def setUp(self):
        self.ports = {
            "ASTERISK_RTPSTART": "22000",
            "ASTERISK_RTPEND": "22499",
            "ASTERISK_SIP_UDP_PORT": "23002",
            "ASTERISK_IAX_PORT": "23001",
            "ASTERISK_SIP_PORT": "20132",
        }
        self.agent = types.ModuleType("agent")
        self.agent.read_envfile = mock.Mock(return_value=self.ports)
        self.hook = load_script("update_restart", HOOK, {"agent": self.agent})
        self.run_patch = mock.patch.object(self.hook.subprocess, "run")
        self.run = self.run_patch.start()
        self.addCleanup(self.run_patch.stop)
        self.run.return_value = subprocess.CompletedProcess([], 0)

    def commands(self):
        return [call.args[0] for call in self.run.call_args_list]

    def test_generates_configuration_before_the_existing_restart(self):
        with mock.patch.dict(os.environ, {"ASTERISK_SIP_UDP_PORT": "20132"}):
            self.hook.main()

        self.agent.read_envfile.assert_called_once_with("environment")
        commands = self.commands()
        self.assertEqual(commands[2][:4], ["podman", "exec", "-i", "mariadb"])
        sql = self.run.call_args_list[2].kwargs["input"]
        self.assertIn("WHEN 'udpport-0.0.0.0' THEN '23002'", sql)
        self.assertNotIn("20132", sql)
        self.assertNotIn("tcpport", sql)
        self.assertNotIn("tlsport", sql)
        self.assertIn('MYSQL_PWD="$MARIADB_ROOT_PASSWORD"', commands[2][-1])
        self.assertEqual(commands[3][2:5], ["--user", "asterisk", "freepbx"])
        self.assertIn("--dont-reload-asterisk", commands[3])
        self.assertEqual(commands[4][0], "restart-services-when-convenient")
        self.assertFalse(any("chown" in command for command in commands))

    def test_unchanged_ports_still_generate_the_next_start_configuration(self):
        self.ports["ASTERISK_SIP_UDP_PORT"] = self.ports["ASTERISK_SIP_PORT"]
        self.hook.main()
        sql = self.run.call_args_list[2].kwargs["input"]
        self.assertIn("WHEN 'udpport-0.0.0.0' THEN '20132'", sql)
        self.assertIn("--dont-reload-asterisk", self.commands()[3])

    def test_inactive_freepbx_preserves_existing_try_restart_behavior(self):
        self.run.side_effect = [
            subprocess.CompletedProcess([], 0),
            subprocess.CompletedProcess([], 3),
            subprocess.CompletedProcess([], 0),
        ]
        self.hook.main()
        self.agent.read_envfile.assert_not_called()
        self.assertEqual(len(self.commands()), 3)
        self.assertEqual(self.commands()[-1][0], "restart-services-when-convenient")

    def test_invalid_ports_prevent_database_changes_and_restart(self):
        for value in ("", "0", "65536", "23002; DROP TABLE sipsettings", "１２３"):
            with self.subTest(value=value):
                self.ports["ASTERISK_SIP_UDP_PORT"] = value
                self.run.reset_mock()
                with self.assertRaises(ValueError):
                    self.hook.main()
                self.assertEqual(len(self.commands()), 2)

    def test_reversed_rtp_range_prevents_database_changes(self):
        self.ports["ASTERISK_RTPEND"] = "21999"
        with self.assertRaises(ValueError):
            self.hook.main()
        self.assertEqual(len(self.commands()), 2)

    def test_database_failure_prevents_generation_and_restart(self):
        self.run.side_effect = [
            subprocess.CompletedProcess([], 0),
            subprocess.CompletedProcess([], 0),
            subprocess.CalledProcessError(1, ["podman", "exec"]),
        ]
        with self.assertRaises(subprocess.CalledProcessError):
            self.hook.main()
        self.assertEqual(len(self.commands()), 3)

    def test_generation_failure_prevents_restart(self):
        self.run.side_effect = [
            subprocess.CompletedProcess([], 0),
            subprocess.CompletedProcess([], 0),
            subprocess.CompletedProcess([], 0),
            subprocess.CalledProcessError(1, ["fwconsole", "reload"]),
        ]
        with self.assertRaises(subprocess.CalledProcessError):
            self.hook.main()
        self.assertEqual(len(self.commands()), 4)


if __name__ == "__main__":
    unittest.main()
