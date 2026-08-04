#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

import io
import os
import sys
import types
import unittest
from pathlib import Path
from unittest import mock

from event_test_utils import load_script


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
HANDLER_PATH = (
    REPOSITORY_ROOT
    / "imageroot"
    / "events"
    / "user-domain-changed"
    / "20configure_ldap"
)


class UserDomainChangedEventTest(unittest.TestCase):
    def setUp(self):
        self.agent = types.ModuleType("agent")
        self.agent.__path__ = []
        self.ldapproxy = types.ModuleType("agent.ldapproxy")
        domain_parameters = {
            "host": "127.0.0.1",
            "port": "20000",
            "bind_dn": "ldapservice@domain.example.test",
            "bind_password": "new-secret",
            "schema": "ad",
            "base_dn": "DC=domain,DC=example,DC=test",
        }
        self.ldapproxy.Ldapproxy = mock.Mock(
            return_value=mock.Mock(
                get_domain=mock.Mock(return_value=domain_parameters)
            )
        )
        self.agent.set_env = mock.Mock()
        self.agent.read_envfile = mock.Mock(
            return_value={
                "KEEP_ME": "value",
                "NETHVOICE_LDAP_PASS": "old-secret",
            }
        )
        self.agent.write_envfile = mock.Mock()
        self.agent.unset_env = mock.Mock()
        self.processes = [mock.Mock(), mock.Mock()]
        self.agent.run_helper = mock.Mock(side_effect=self.processes)

    def test_refreshes_ldap_password_only_in_passwords_file(self):
        with (
            mock.patch.dict(
                os.environ,
                {"USER_DOMAIN": "domain.example.test"},
                clear=True,
            ),
            mock.patch.object(
                sys,
                "stdin",
                io.StringIO('{"domains":["domain.example.test"]}'),
            ),
        ):
            load_script(
                "user_domain_changed_ldap",
                HANDLER_PATH,
                {
                    "agent": self.agent,
                    "agent.ldapproxy": self.ldapproxy,
                },
            )

        self.agent.write_envfile.assert_called_once_with(
            "passwords.env",
            {
                "KEEP_ME": "value",
                "NETHVOICE_LDAP_PASS": "new-secret",
            },
        )
        self.agent.unset_env.assert_called_once_with("NETHVOICE_LDAP_PASS")
        self.assertNotIn(
            mock.call("NETHVOICE_LDAP_PASS", "new-secret"),
            self.agent.set_env.call_args_list,
        )
        self.processes[0].check_returncode.assert_called_once_with()
        self.processes[1].check_returncode.assert_called_once_with()


if __name__ == "__main__":
    unittest.main()
