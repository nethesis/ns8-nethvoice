#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

import importlib.machinery
import importlib.util
import os
import sys
import types
import unittest
from pathlib import Path
from unittest import mock


SCRIPT_PATH = (
    Path(__file__).resolve().parents[2]
    / "imageroot"
    / "bin"
    / "configure-users-admin"
)


def load_provider_module(fake_agent, fake_tasks):
    sys.modules["agent"] = fake_agent
    sys.modules["agent.tasks"] = fake_tasks
    loader = importlib.machinery.SourceFileLoader("users_admin_provider", str(SCRIPT_PATH))
    spec = importlib.util.spec_from_loader(loader.name, loader)
    module = importlib.util.module_from_spec(spec)
    loader.exec_module(module)
    return module


class UsersAdminProviderTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.agent = types.ModuleType("agent")
        cls.agent.__path__ = []
        cls.tasks = types.ModuleType("agent.tasks")
        cls.agent.tasks = cls.tasks
        cls.provider = load_provider_module(cls.agent, cls.tasks)

    def setUp(self):
        self.environment = {
            "NETHVOICE_USER_PORTAL_URL": "http://10.0.0.1:2000",
            "NETHVOICE_USER_PORTAL_NODE": "1",
        }
        self.agent.read_envfile = mock.Mock(side_effect=lambda _path: self.environment)
        self.agent.redis_connect = mock.Mock(return_value="redis-connection")
        self.agent.list_service_providers = mock.Mock()
        self.agent.mset_env = mock.Mock()
        self.agent.resolve_agent_id = mock.Mock(return_value="module/traefik1")
        self.agent.set_route = mock.Mock(return_value={"exit_code": 0})
        self.agent.run_helper = mock.Mock(
            return_value=types.SimpleNamespace(returncode=0)
        )
        self.agent.assert_exp = mock.Mock(
            side_effect=lambda expression: expression
            if expression
            else self.fail("agent assertion failed")
        )
        self.tasks.run = mock.Mock(return_value={"exit_code": 0})
        self.env_patch = mock.patch.dict(
            os.environ,
            {
                "AGENT_STATE_DIR": "/state",
                "MODULE_ID": "nethvoice1",
                "NETHVOICE_HOST": "voice.example.test",
            },
        )
        self.env_patch.start()

    def tearDown(self):
        self.env_patch.stop()

    def test_configuration_selects_first_core_ordered_provider(self):
        providers = [
            {"url": "http://10.0.0.2:2000", "node": "2"},
            {"url": "http://10.0.0.3:2000", "node": "3"},
        ]
        self.agent.list_service_providers.return_value = providers

        changed = self.provider.configure_users_admin("domain.example.test")

        self.assertTrue(changed)
        self.agent.list_service_providers.assert_called_once_with(
            "redis-connection",
            "users-admin",
            "http",
            {"domain": "domain.example.test"},
        )
        self.agent.mset_env.assert_called_once_with(
            {
                "NETHVOICE_USER_PORTAL_URL": "http://10.0.0.2:2000",
                "NETHVOICE_USER_PORTAL_NODE": "2",
            }
        )
        self.agent.set_route.assert_called_once_with(
            {
                "instance": "nethvoice1-users-admin",
                "url": "http://10.0.0.2:2000",
                "http2https": True,
                "host": "voice.example.test",
                "path": "/users-admin/domain.example.test",
                "strip_prefix": True,
            },
            error_passthrough=False,
        )

    def test_configuration_clears_selection_and_deletes_empty_route(self):
        self.agent.list_service_providers.return_value = []

        changed = self.provider.configure_users_admin("domain.example.test")

        self.assertTrue(changed)
        self.agent.mset_env.assert_called_once_with(
            {
                "NETHVOICE_USER_PORTAL_URL": "",
                "NETHVOICE_USER_PORTAL_NODE": "",
            }
        )
        self.agent.set_route.assert_not_called()
        self.tasks.run.assert_called_once_with(
            agent_id="module/traefik1",
            action="delete-route",
            data={"instance": "nethvoice1-users-admin"},
            extra={"isNotificationHidden": True},
        )

    def test_provider_event_restarts_only_when_selection_changes(self):
        self.agent.list_service_providers.return_value = [
            {"url": "http://10.0.0.1:2000", "node": "1"}
        ]

        changed = self.provider.configure_users_admin(
            "domain.example.test", restart_if_changed=True
        )

        self.assertFalse(changed)
        self.agent.run_helper.assert_not_called()

        self.agent.list_service_providers.return_value = [
            {"url": "http://10.0.0.2:2000", "node": "2"}
        ]
        changed = self.provider.configure_users_admin(
            "domain.example.test", restart_if_changed=True
        )

        self.assertTrue(changed)
        self.agent.run_helper.assert_called_once_with(
            "restart-services-when-convenient", "freepbx"
        )

    def test_set_route_failure_does_not_persist_provider(self):
        self.agent.list_service_providers.return_value = [
            {"url": "http://10.0.0.2:2000", "node": "2"}
        ]
        self.agent.set_route.return_value = {"exit_code": 1}

        with self.assertRaisesRegex(AssertionError, "agent assertion failed"):
            self.provider.configure_users_admin(
                "domain.example.test", restart_if_changed=True
            )

        self.agent.mset_env.assert_not_called()
        self.agent.run_helper.assert_not_called()

    def test_delete_route_failure_does_not_clear_provider(self):
        self.agent.list_service_providers.return_value = []
        self.tasks.run.return_value = {"exit_code": 1}

        with self.assertRaisesRegex(AssertionError, "agent assertion failed"):
            self.provider.configure_users_admin(
                "domain.example.test", restart_if_changed=True
            )

        self.agent.mset_env.assert_not_called()
        self.agent.run_helper.assert_not_called()


if __name__ == "__main__":
    unittest.main()
