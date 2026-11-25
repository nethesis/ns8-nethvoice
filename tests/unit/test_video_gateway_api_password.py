#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

"""Password of the video gateway (MediaMTX) control API user.

MediaMTX asks nethcti-server to authorize every API request: nethcti-server
sends the password from passwords.env (services.json "mediamtx.api_password")
and its hook accepts only that password.
"""

import os
import re
import sys
import types
import unittest
from pathlib import Path
from unittest import mock

from event_test_utils import load_script

REPO = Path(__file__).resolve().parents[2]
ROOT = REPO / "imageroot"
sys.path.insert(0, str(ROOT / "pypkg"))

import video_gateway  # noqa: E402


class VideoGatewayApiPasswordTest(unittest.TestCase):
    def setUp(self):
        self.files = {"passwords.env": {}, "environment": {}}
        self.agent = types.ModuleType("agent")
        self.agent.tasks = types.ModuleType("agent.tasks")
        self.agent.read_envfile = lambda name: dict(self.files.get(name, {}))
        self.agent.write_envfile = mock.Mock(side_effect=lambda name, values: self.files.__setitem__(name, dict(values)))
        self.agent.set_env = lambda key, value: self.files["environment"].update({key: str(value)})
        self.agent.unset_env = lambda key: self.files["environment"].pop(key, None)
        self.agent.allocate_ports = mock.Mock(side_effect=lambda count, protocol, keep_existing=False: (20000, 20000 + count - 1))
        self.agent.add_public_service = mock.Mock(return_value=True)
        self.agent.SD_WARNING = self.agent.SD_INFO = self.agent.SD_ERR = ""

    def run_script(self, path, extra_env=None):
        environ = {"NODE_ID": "1", "MODULE_ID": "nethvoice1"}
        environ.update(extra_env or {})
        with mock.patch.dict(os.environ, environ, clear=False), mock.patch("sys.stderr"):
            try:
                load_script("api_password_script", ROOT / path, {
                    "agent": self.agent, "agent.tasks": self.agent.tasks, "video_gateway": video_gateway,
                })
            except SystemExit as ex:
                self.assertIn(ex.code, (0, None))

    def test_new_install_generates_it(self):
        self.run_script("actions/create-module/05setenvs", {
            "TCP_PORTS_RANGE": "20000-20046", "UDP_PORTS_RANGE": "30000-32999",
        })
        password = self.files["passwords.env"].get("MEDIAMTX_API_PASSWORD", "")
        self.assertRegex(password, r"^[A-Za-z0-9]{32}$")

    def test_update_generates_it_once(self):
        self.files["passwords.env"] = {"AMPDBPASS": "x", "CHAT_SERVICE_SECRET": "y"}
        self.run_script("update-module.d/23video_gateway_api_password")
        password = self.files["passwords.env"]["MEDIAMTX_API_PASSWORD"]
        self.assertRegex(password, r"^[A-Za-z0-9]{32}$")
        self.assertEqual(self.files["passwords.env"]["AMPDBPASS"], "x", "other passwords kept")
        self.agent.write_envfile.reset_mock()
        self.run_script("update-module.d/23video_gateway_api_password")
        self.assertEqual(self.files["passwords.env"]["MEDIAMTX_API_PASSWORD"], password, "idempotent")
        self.agent.write_envfile.assert_not_called()

    def test_update_replaces_an_empty_one(self):
        self.files["passwords.env"] = {"MEDIAMTX_API_PASSWORD": ""}
        self.run_script("update-module.d/23video_gateway_api_password")
        self.assertRegex(self.files["passwords.env"]["MEDIAMTX_API_PASSWORD"], r"^[A-Za-z0-9]{32}$")

    def test_delivered_to_nethcti_server(self):
        entrypoint = (REPO / "nethcti-server" / "entrypoint.sh").read_text()
        self.assertRegex(entrypoint, re.compile(r'"mediamtx": \{\s*"api_port": "\$\{MEDIAMTX_API_PORT\}",\s*"api_password": "\$\{MEDIAMTX_API_PASSWORD\}"'))
        unit = (ROOT / "systemd" / "user" / "nethcti-server.service").read_text()
        self.assertIn("--env-file=%E/state/passwords.env", unit)


if __name__ == "__main__":
    unittest.main()
