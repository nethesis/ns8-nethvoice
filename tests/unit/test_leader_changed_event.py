#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

import os
import types
import unittest
from pathlib import Path
from unittest import mock

from event_test_utils import load_script


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


class LeaderChangedEventTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.agent = types.ModuleType("agent")
        cls.agent.SD_DEBUG = ""
        cls.handler = load_script(
            "leader_changed_users_admin",
            REPOSITORY_ROOT
            / "imageroot"
            / "events"
            / "leader-changed"
            / "30users_admin",
            {"agent": cls.agent},
        )

    def setUp(self):
        self.agent.run_helper = mock.Mock(
            return_value=types.SimpleNamespace(returncode=0)
        )
        self.agent.assert_exp = mock.Mock()

    def test_reconfigures_users_admin_after_leader_change(self):
        with mock.patch.dict(
            os.environ,
            {
                "AGENT_EVENT_SOURCE": "cluster",
                "NETHVOICE_HOST": "voice.example.test",
                "USER_DOMAIN": "domain.example.test",
            },
            clear=True,
        ):
            self.handler.main()

        self.agent.run_helper.assert_called_once_with(
            "configure-users-admin",
            "domain.example.test",
            "--restart-if-changed",
        )
        self.agent.assert_exp.assert_called_once_with(True)

    def test_ignores_leader_change_from_invalid_source(self):
        with mock.patch.dict(
            os.environ,
            {
                "AGENT_EVENT_SOURCE": "module/untrusted1",
                "NETHVOICE_HOST": "voice.example.test",
                "USER_DOMAIN": "domain.example.test",
            },
            clear=True,
        ):
            self.handler.main()

        self.agent.run_helper.assert_not_called()

    def test_ignores_leader_change_before_configuration(self):
        with mock.patch.dict(
            os.environ,
            {"AGENT_EVENT_SOURCE": "cluster"},
            clear=True,
        ):
            self.handler.main()

        self.agent.run_helper.assert_not_called()


if __name__ == "__main__":
    unittest.main()
