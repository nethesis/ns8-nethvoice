#!/usr/bin/env python3

#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

import importlib.util
import io
import os
import subprocess
import sys
import unittest
from contextlib import redirect_stderr
from importlib.machinery import SourceFileLoader
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch


HELPER_PATH = (
    Path(__file__).parents[1] / "imageroot" / "bin" / "nethvoice-firewall-protection"
)
UPDATE_PATH = (
    Path(__file__).parents[1] / "imageroot" / "update-module.d" / "99firewall_protection"
)
LOADER = SourceFileLoader("nethvoice_firewall_protection", str(HELPER_PATH))
SPEC = importlib.util.spec_from_loader(LOADER.name, LOADER)
FIREWALL = importlib.util.module_from_spec(SPEC)
LOADER.exec_module(FIREWALL)


class FirewallProtectionTest(unittest.TestCase):
    environment = {
        "ASTERISK_SIP_PORT": "20026",
        "SATELLITE_HTTP_PORT": "20035",
    }

    def test_builds_deterministic_ipv4_and_ipv6_drop_rules(self):
        self.assertEqual(FIREWALL.build_rules(self.environment), [
            'rule priority="-100" family="ipv4" port port="20026" protocol="udp" drop',
            'rule priority="-100" family="ipv6" port port="20026" protocol="udp" drop',
            'rule priority="-100" family="ipv4" port port="20035" protocol="udp" drop',
            'rule priority="-100" family="ipv6" port port="20035" protocol="udp" drop',
        ])

    def test_rejects_missing_malformed_and_out_of_range_ports(self):
        invalid_values = (None, "", "0", "0123", "123/udp", "65536")
        for variable in FIREWALL.PROTECTED_PORTS:
            for value in invalid_values:
                with self.subTest(variable=variable, value=value):
                    environment = self.environment.copy()
                    if value is None:
                        environment.pop(variable)
                    else:
                        environment[variable] = value
                    with self.assertRaisesRegex(ValueError, variable):
                        FIREWALL.build_rules(environment)

    def test_adds_and_removes_the_same_rules(self):
        add_rich_rules = Mock(return_value=True)
        remove_rich_rules = Mock(return_value=True)
        agent = SimpleNamespace(
            add_rich_rules=add_rich_rules,
            remove_rich_rules=remove_rich_rules,
        )
        expected_rules = FIREWALL.build_rules(self.environment)

        with patch.dict(sys.modules, {"agent": agent}):
            self.assertEqual(FIREWALL.main(["add"], self.environment), 0)
            self.assertEqual(FIREWALL.main(["remove"], self.environment), 0)

        add_rich_rules.assert_called_once_with(expected_rules)
        remove_rich_rules.assert_called_once_with(expected_rules)

    def test_returns_failure_when_firewall_api_fails(self):
        agent = SimpleNamespace(add_rich_rules=Mock(return_value=False))
        error_output = io.StringIO()
        with patch.dict(sys.modules, {"agent": agent}), redirect_stderr(error_output):
            result = FIREWALL.main(["add"], self.environment)

        self.assertEqual(result, 1)
        self.assertIn("could not add rich rules", error_output.getvalue())

    def test_update_failure_is_propagated_to_the_parent_action(self):
        agent = SimpleNamespace(set_status=Mock())
        loader = SourceFileLoader("firewall_protection_update_failure", str(UPDATE_PATH))
        spec = importlib.util.spec_from_loader(loader.name, loader)
        update = importlib.util.module_from_spec(spec)
        failure = subprocess.CalledProcessError(1, ["firewall-helper"])

        with (
            patch.dict(sys.modules, {"agent": agent}),
            patch.dict(os.environ, {"AGENT_INSTALL_DIR": "/opt/nethvoice"}),
            patch("subprocess.run", side_effect=failure),
            self.assertRaises(subprocess.CalledProcessError),
        ):
            loader.exec_module(update)

        agent.set_status.assert_called_once_with("validation-failed")


if __name__ == "__main__":
    unittest.main()
