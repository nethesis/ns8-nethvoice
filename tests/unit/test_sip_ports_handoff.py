#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

import json
import os
import types
import unittest
from pathlib import Path
from unittest import mock

from event_test_utils import load_script


ROOT = Path(__file__).resolve().parents[2] / "imageroot"


class SipPortsHandoffTest(unittest.TestCase):
    def setUp(self):
        # An existing dedicated SIP UDP port in an oversized allocation.
        self.env = {
            "NODE_ID": "1", "MODULE_ID": "nethvoice1", "NETHVOICE_HOST": "pbx.example.org",
            "UDP_PORTS_RANGE": "10000-12002",
            "ASTERISK_SIP_PORT": "5061", "ASTERISK_SIP_UDP_PORT": "12002",
            "ASTERISK_RTPSTART": "10000", "ASTERISK_RTPEND": "10398",
            "JANUS_SIP_RTPSTART": "10399", "JANUS_SIP_RTPEND": "10797",
            "JANUS_RTPSTART": "10798", "JANUS_RTPEND": "10996",
            "SATELLITE_RTP_PORT": "10997", "ASTERISK_IAX_PORT": "10998",
            "NETHVOICE_MIDDLEWARE_PORT": "2000", "ASTERISK_WSS_PORT": "2001",
            "ASTERISK_RECORDING_SFTP_PORT": "2002", "ASTERISK_WS_PORT": "2003",
            "SATELLITE_MQTT_PORT": "2004", "SATELLITE_HTTP_PORT": "2005",
            "SATELLITE_PGSQL_PORT": "2006",
            "CHAT_C2S_PORT": "2007", "CHAT_HTTP_PORT": "2008",
            "CHAT_COMPONENT_PORT": "2009", "CHAT_GW_PORT": "2010",
        }
        self.rules = [self.rule("12002")]
        self.trunks = [{
            "rule": "provider",
            "destination": {"uri": "sip:10.0.0.1:12002;transport=udp"},
        }]
        self.routes = [{"domain": "alias.example.org", "address": [{
            "uri": "sip:10.0.0.1:12002", "description": "custom",
        }]}]
        self.ip_read = mock.Mock(return_value=json.dumps([{"addr_info": [
            {"local": "10.0.0.1"}, {"local": "192.0.2.1"},
        ]}]))
        self.agent = types.ModuleType("agent")
        self.agent.tasks = types.ModuleType("agent.tasks")
        self.agent.tasks.run = mock.Mock(side_effect=self.proxy_task)
        self.agent.read_envfile = lambda _: self.env.copy()
        self.agent.set_env = lambda key, value: self.env.update({key: str(value)})
        self.agent.unset_env = lambda key: self.env.pop(key, None)
        self.agent.allocate_ports = mock.Mock(return_value=(20000, 20999))
        self.agent.list_rich_rules = mock.Mock(side_effect=lambda **_: self.rules[:])
        self.agent.add_rich_rules = mock.Mock(side_effect=self.add_rules)
        self.agent.remove_rich_rules = mock.Mock(side_effect=self.remove_rules)
        self.agent.resolve_agent_id = mock.Mock(return_value="module/proxy1")
        self.agent.run_helper = mock.Mock()
        self.agent.redis_connect = mock.MagicMock()
        self.agent.redis_connect.return_value.__enter__.return_value.hget.return_value = "10.0.0.1"
        self.agent.assert_exp = self.assertTrue
        self.agent.SD_WARNING = self.agent.SD_INFO = self.agent.SD_ERR = ""

    @staticmethod
    def rule(port):
        return f'rule family="ipv4" forward-port port="5060" protocol="udp" to-port="{port}"'

    def add_rules(self, rules):
        self.rules.extend(rules)
        return True

    def remove_rules(self, rules):
        for rule in rules:
            self.rules.remove(rule)
        return True

    def proxy_task(self, *, action, data, **_):
        if action == "list-routes":
            return {"exit_code": 0, "output": self.routes}
        if action == "add-route":
            for route in self.routes:
                if route["domain"] == data["domain"]:
                    route["address"] = data["address"]
            return {"exit_code": 0, "output": ""}
        if action == "list-trunks":
            return {"exit_code": 0, "output": self.trunks}
        self.assertEqual(action, "add-trunk")
        for trunk in self.trunks:
            if trunk["rule"] == data["rule"]:
                trunk["destination"] = data["destination"]
        return {"exit_code": 0}

    def run_script(self, name, directory="update-module.d"):
        try:
            with mock.patch("subprocess.check_output", self.ip_read), mock.patch.dict(
                os.environ, {"AGENT_INSTALL_DIR": str(ROOT)},
            ):
                load_script("sip_handoff", ROOT / directory / name, {
                    "agent": self.agent, "agent.tasks": self.agent.tasks,
                })
        except SystemExit as ex:
            self.assertEqual(ex.code, 0)

    def update(self):
        for name in (
            "20allocate_ports", "25rewrite_sip_portforward",
            "90repoint_sip_proxy", "91repoint_proxy_trunks", "99clear_ports_handoff",
        ):
            self.run_script(name)

    def assert_migrated(self):
        self.assertEqual(self.rules, [self.rule("20999")])
        self.assertEqual(self.trunks[0]["destination"]["uri"],
                         "sip:10.0.0.1:20999;transport=udp")
        self.assertNotIn("PREVIOUS_SIP_UDP_PORT", self.env)
        self.assertNotIn("PREVIOUS_SIP_UDP_PORTS", self.env)
        self.assertNotIn("SIP_PORTFORWARD_MIGRATED", self.env)
        self.assertNotIn("SIP_PROXY_TRUNKS_MIGRATED", self.env)
        self.assertNotIn("SIP_PROXY_ROUTES_MIGRATED", self.env)
        self.assertEqual(self.routes[0]["address"], [{
            "uri": "sip:10.0.0.1:20999", "description": "custom",
        }])
        self.agent.allocate_ports.assert_called_once_with(1000, "udp")

    def test_success_clears_handoff(self):
        self.update()
        self.assert_migrated()

    def test_firewall_lookup_failure_retries_on_next_update(self):
        self.agent.list_rich_rules.side_effect = RuntimeError("firewall unavailable")
        self.update()
        self.assertEqual(self.env["PREVIOUS_SIP_UDP_PORT"], "12002")
        self.agent.list_rich_rules.side_effect = lambda **_: self.rules[:]
        self.update()
        self.assert_migrated()

    def test_firewall_add_failure_keeps_original_for_retry(self):
        self.agent.add_rich_rules.side_effect = None
        self.agent.add_rich_rules.return_value = False
        self.update()
        self.assertEqual(self.rules, [self.rule("12002")])
        self.agent.remove_rich_rules.assert_not_called()
        self.assertIn("PREVIOUS_SIP_UDP_PORT", self.env)
        self.agent.add_rich_rules.side_effect = self.add_rules
        self.update()
        self.assert_migrated()

    def test_firewall_remove_failure_retries_without_duplicate_replacement(self):
        self.agent.remove_rich_rules.side_effect = None
        self.agent.remove_rich_rules.return_value = False
        self.update()
        self.assertEqual(set(self.rules), {self.rule("12002"), self.rule("20999")})
        self.assertIn("PREVIOUS_SIP_UDP_PORT", self.env)
        self.agent.remove_rich_rules.side_effect = self.remove_rules
        self.update()
        self.assert_migrated()
        self.agent.add_rich_rules.assert_called_once()

    def test_proxy_list_and_write_failures_retry_on_next_update(self):
        for failed_action in ("list-trunks", "add-trunk", "list-routes", "add-route"):
            with self.subTest(action=failed_action):
                self.setUp()

                def fail_task(*, action, **kwargs):
                    if action == failed_action:
                        return {"exit_code": 1}
                    return self.proxy_task(action=action, **kwargs)

                self.agent.tasks.run.side_effect = fail_task
                self.update()
                self.assertEqual(self.env["PREVIOUS_SIP_UDP_PORT"], "12002")
                self.agent.tasks.run.side_effect = self.proxy_task
                self.update()
                self.assert_migrated()

    def test_missing_node_address_retains_handoff(self):
        lookup = self.agent.redis_connect.return_value.__enter__.return_value.hget
        lookup.return_value = None
        self.update()
        self.assertIn("PREVIOUS_SIP_UDP_PORT", self.env)
        lookup.return_value = "10.0.0.1"
        self.update()
        self.assert_migrated()

    def test_empty_scans_and_absent_proxy_confirm_success(self):
        self.rules.clear()
        self.agent.resolve_agent_id.return_value = None
        self.update()
        self.assertNotIn("PREVIOUS_SIP_UDP_PORT", self.env)
        self.assertNotIn("PREVIOUS_SIP_UDP_PORTS", self.env)

    def test_skipped_consumer_cannot_reuse_previous_success(self):
        self.agent.tasks.run.side_effect = RuntimeError("proxy unavailable")
        self.update()
        self.assertIn("SIP_PORTFORWARD_MIGRATED", self.env)
        self.run_script("20allocate_ports")
        self.agent.tasks.run.side_effect = self.proxy_task
        self.run_script("91repoint_proxy_trunks")
        self.run_script("99clear_ports_handoff")
        self.assertIn("PREVIOUS_SIP_UDP_PORT", self.env)

    def test_another_port_move_keeps_all_pending_ports(self):
        self.env["PREVIOUS_SIP_UDP_PORT"] = "9000"
        self.env["PREVIOUS_SIP_UDP_PORTS"] = '["8000"]'
        self.rules.extend([self.rule("8000"), self.rule("9000")])
        self.run_script("20allocate_ports")
        self.assertEqual(json.loads(self.env["PREVIOUS_SIP_UDP_PORTS"]),
                         ["12002", "8000", "9000"])
        self.run_script("25rewrite_sip_portforward")
        self.run_script("90repoint_sip_proxy")
        self.run_script("91repoint_proxy_trunks")
        self.run_script("99clear_ports_handoff")
        self.assert_migrated()

    def test_restore_clears_source_instance_retry_state(self):
        self.run_script("20allocate_ports")
        self.env["SIP_PORTFORWARD_MIGRATED"] = "20999"
        self.env["SIP_PROXY_TRUNKS_MIGRATED"] = "20999"
        self.env["SIP_PROXY_ROUTES_MIGRATED"] = "20999"
        self.run_script("24clear_ports_migration", "actions/restore-module")
        for key in ("PREVIOUS_SIP_UDP_PORT", "PREVIOUS_SIP_UDP_PORTS",
                    "SIP_PORTFORWARD_MIGRATED", "SIP_PROXY_TRUNKS_MIGRATED",
                    "SIP_PROXY_ROUTES_MIGRATED"):
            self.assertNotIn(key, self.env)

    def test_additional_domains_on_already_upgraded_instance(self):
        self.env.update(ASTERISK_SIP_PORT="20190", ASTERISK_SIP_UDP_PORT="24999")
        self.routes = [{"domain": domain, "address": [{
            "uri": "sip:10.0.0.1:20190;transport=udp;lr", "description": "custom",
        }]} for domain in ("alias-a.example.org", "alias-b.example.org")]
        self.routes[0]["address"].extend({"uri": uri, "description": "nethvoice1"} for uri in (
            "sip:10.0.0.2:20190", "sip:10.0.0.1:12345",
            "sip:10.0.0.1:20190;transport=tcp", "sips:10.0.0.1:20190",
        ))
        untouched = self.routes[0]["address"][1:]
        for _ in range(2):
            self.run_script("90repoint_sip_proxy")
            for route in self.routes:
                self.assertEqual(route["address"][0], {
                    "uri": "sip:10.0.0.1:24999;transport=udp;lr", "description": "custom",
                })
            self.assertEqual(self.routes[0]["address"][1:], untouched)
        self.agent.allocate_ports.assert_not_called()
        self.agent.run_helper.assert_called_with(
            "runagent", str(ROOT / "actions/configure-module/60sip_proxy"))

    def test_trunks_using_another_assigned_local_address(self):
        self.env.update(ASTERISK_SIP_PORT="20051", ASTERISK_SIP_UDP_PORT="21001")
        self.trunks = [{"rule": rule, "destination": {
            "uri": "sip:192.0.2.1:20051;transport=udp;tag=keep", "description": "custom",
        }} for rule in ("trunk-A", "trunk-B")]
        self.trunks.append({"rule": "keep-tcp", "destination": {
            "uri": "sip:192.0.2.1:20051;transport=tcp",
        }})
        self.run_script("91repoint_proxy_trunks")
        for trunk in self.trunks[:2]:
            self.assertEqual(trunk["destination"], {
                "uri": "sip:192.0.2.1:21001;transport=udp;tag=keep", "description": "custom",
            })
        self.assertEqual(self.trunks[2]["destination"]["uri"],
                         "sip:192.0.2.1:20051;transport=tcp")

    def test_route_saved_before_reload_failure_is_reapplied(self):
        def fail_after_save(*, action, **kwargs):
            result = self.proxy_task(action=action, **kwargs)
            return {"exit_code": 1} if action == "add-route" else result

        self.agent.tasks.run.side_effect = fail_after_save
        self.update()
        self.assertEqual(self.routes[0]["address"][0]["uri"], "sip:10.0.0.1:20999")
        self.assertIn("PREVIOUS_SIP_UDP_PORT", self.env)
        self.agent.tasks.run.side_effect = self.proxy_task
        self.agent.tasks.run.reset_mock()
        self.update()
        self.assertTrue(any(call.kwargs["action"] == "add-route"
                            for call in self.agent.tasks.run.call_args_list))
        self.assert_migrated()

    def test_address_lookup_failure_retains_handoff(self):
        self.ip_read.side_effect = RuntimeError("ip unavailable")
        self.update()
        self.assertIn("PREVIOUS_SIP_UDP_PORT", self.env)
        self.ip_read.side_effect = None
        self.update()
        self.assert_migrated()


if __name__ == "__main__":
    unittest.main()
