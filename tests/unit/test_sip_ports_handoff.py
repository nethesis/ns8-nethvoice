#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

import json
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
            "NODE_ID": "1", "MODULE_ID": "nethvoice1",
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
        self.routes = [{
            "domain": "additional.example.org",
            "address": [{"uri": "sip:10.0.0.1:12002", "description": "custom"}],
        }]
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
        self.agent.redis_connect = mock.MagicMock()
        self.agent.redis_connect.return_value.__enter__.return_value.hget.return_value = "10.0.0.1"
        self.agent.assert_exp = self.assertTrue
        self.agent.SD_WARNING = self.agent.SD_INFO = self.agent.SD_ERR = ""
        self.sip_migration = load_script("sip_proxy_migration", ROOT / "pypkg/sip_proxy_migration.py", {})
        self.sip_migration.subprocess = types.SimpleNamespace(run=mock.Mock(return_value=
            types.SimpleNamespace(stdout=json.dumps([{"addr_info": [
                {"local": "10.0.0.1"}, {"local": "192.0.2.1"},
            ]}]))))

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
        if action == "list-trunks":
            return {"exit_code": 0, "output": self.trunks}
        if action == "list-routes":
            return {"exit_code": 0, "output": self.routes}
        if action == "get-route":
            return {"exit_code": 0, "output": next(
                route for route in self.routes if route["domain"] == data["domain"])}
        if action == "add-route":
            for route in self.routes:
                if route["domain"] == data["domain"]:
                    route["address"] = data["address"]
            return {"exit_code": 0}
        self.assertEqual(action, "add-trunk")
        for trunk in self.trunks:
            if trunk["rule"] == data["rule"]:
                trunk["destination"] = data["destination"]
        return {"exit_code": 0}

    def run_script(self, name, directory="update-module.d"):
        try:
            script = load_script("sip_handoff", ROOT / directory / name, {
                "agent": self.agent, "agent.tasks": self.agent.tasks,
                "sip_proxy_migration": self.sip_migration,
            })
            if name == "92repoint_proxy_routes":
                script.main()
        except SystemExit as ex:
            self.assertEqual(ex.code, 0)

    def update(self):
        for name in (
            "20allocate_ports", "25rewrite_sip_portforward",
            "91repoint_proxy_trunks", "92repoint_proxy_routes", "99clear_ports_handoff",
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
        self.assertNotIn("SIP_PROXY_ROUTES_PENDING", self.env)
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
        for failed_action in ("list-trunks", "add-trunk", "list-routes", "get-route", "add-route"):
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
        self.run_script("92repoint_proxy_routes")
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
        self.run_script("91repoint_proxy_trunks")
        self.run_script("92repoint_proxy_routes")
        self.run_script("99clear_ports_handoff")
        self.assert_migrated()

    def test_restore_clears_source_instance_retry_state(self):
        self.run_script("20allocate_ports")
        self.env["SIP_PORTFORWARD_MIGRATED"] = "20999"
        self.env["SIP_PROXY_TRUNKS_MIGRATED"] = "20999"
        self.env["SIP_PROXY_ROUTES_MIGRATED"] = "20999"
        self.env["SIP_PROXY_ROUTES_PENDING"] = '["additional.example.org"]'
        self.run_script("24clear_ports_migration", "actions/restore-module")
        for key in ("PREVIOUS_SIP_UDP_PORT", "PREVIOUS_SIP_UDP_PORTS",
                    "SIP_PORTFORWARD_MIGRATED", "SIP_PROXY_TRUNKS_MIGRATED",
                    "SIP_PROXY_ROUTES_MIGRATED", "SIP_PROXY_ROUTES_PENDING"):
            self.assertNotIn(key, self.env)

    def test_additional_domains_migrate_without_new_allocation(self):
        self.env["ASTERISK_SIP_UDP_PORT"] = "24999"
        self.env["ASTERISK_SIP_PORT"] = "20190"
        self.routes[0]["address"][0]["uri"] = "sip:10.0.0.1:20190"
        self.routes.append({"domain": "second-alias.example.org", "address": [{
            "uri": "sip:10.0.0.1:20190", "description": "second alias",
        }]})
        self.run_script("92repoint_proxy_routes")
        self.assertEqual(self.routes[0]["address"][0]["uri"], "sip:10.0.0.1:24999")
        self.assertEqual(self.routes[1]["address"], [{
            "uri": "sip:10.0.0.1:24999", "description": "second alias",
        }])
        self.agent.tasks.run.reset_mock()
        self.run_script("92repoint_proxy_routes")
        self.assertNotIn("add-route", [call.kwargs["action"]
                                      for call in self.agent.tasks.run.call_args_list])
        self.agent.allocate_ports.assert_not_called()

    def test_routes_preserve_transports_other_hosts_and_descriptions(self):
        suffix = ";transport=UDP;lr;custom=abc?subject=hello"
        untouched = [
            "sip:10.0.0.2:12002", "sip:10.0.0.1:12345",
            "sip:10.0.0.1:12002;transport=tcp", "sip:10.0.0.1:12002;Transport=TLS",
            "sips:10.0.0.1:12002", "sip:10.0.0.1:12002;transport=sctp",
            "sip:10.0.0.1:12002;transport", "sip:somebody@10.0.0.1:12002",
        ]
        self.routes[0]["address"].extend(
            {"uri": uri, "description": "nethvoice1"} for uri in untouched)
        self.routes.append({"domain": "second.example.org", "address": [{
            "uri": "sip:10.0.0.1:12002" + suffix, "description": "arbitrary",
        }]})
        self.env["PREVIOUS_SIP_UDP_PORT"] = "12002"
        self.env["ASTERISK_SIP_UDP_PORT"] = "20999"
        self.run_script("92repoint_proxy_routes")
        self.assertEqual(self.routes[0]["address"][1:], [
            {"uri": uri, "description": "nethvoice1"} for uri in untouched])
        self.assertEqual(self.routes[1]["address"], [{
            "uri": "sip:10.0.0.1:20999" + suffix, "description": "arbitrary",
        }])

    def test_route_reload_failure_after_save_is_reapplied(self):
        def fail_after_save(*, action, **kwargs):
            result = self.proxy_task(action=action, **kwargs)
            return {"exit_code": 1} if action == "add-route" else result

        self.agent.tasks.run.side_effect = fail_after_save
        self.update()
        self.assertEqual(self.routes[0]["address"][0]["uri"], "sip:10.0.0.1:20999")
        self.assertIn("PREVIOUS_SIP_UDP_PORT", self.env)
        self.assertEqual(json.loads(self.env["SIP_PROXY_ROUTES_PENDING"]),
                         ["additional.example.org"])
        self.agent.tasks.run.side_effect = self.proxy_task
        self.agent.tasks.run.reset_mock()
        self.update()
        self.assertTrue(any(call.kwargs["action"] == "add-route"
                            for call in self.agent.tasks.run.call_args_list))
        self.assert_migrated()

    def test_one_failed_route_does_not_block_other_routes(self):
        self.routes.append({"domain": "second.example.org", "address": [{
            "uri": "sip:10.0.0.1:12002", "description": "second",
        }]})

        def fail_one(*, action, data, **kwargs):
            if action == "add-route" and data["domain"] == "additional.example.org":
                return {"exit_code": 1}
            return self.proxy_task(action=action, data=data, **kwargs)

        self.agent.tasks.run.side_effect = fail_one
        self.update()
        self.assertEqual(self.routes[1]["address"][0]["uri"], "sip:10.0.0.1:20999")
        self.assertIn("PREVIOUS_SIP_UDP_PORT", self.env)
        self.agent.tasks.run.side_effect = self.proxy_task
        self.update()
        self.assert_migrated()

    def test_missing_route_consumer_retains_previous_ports(self):
        self.run_script("20allocate_ports")
        self.run_script("25rewrite_sip_portforward")
        self.run_script("91repoint_proxy_trunks")
        self.run_script("99clear_ports_handoff")
        self.assertIn("PREVIOUS_SIP_UDP_PORT", self.env)

    def test_routes_support_bracketed_ipv6(self):
        lookup = self.agent.redis_connect.return_value.__enter__.return_value.hget
        lookup.return_value = "2001:db8::1"
        self.env["PREVIOUS_SIP_UDP_PORTS"] = '["12002"]'
        self.env["ASTERISK_SIP_UDP_PORT"] = "20999"
        self.routes[0]["address"][0]["uri"] = "sip:[2001:db8:0::1]:12002;lr"
        self.run_script("92repoint_proxy_routes")
        self.assertEqual(self.routes[0]["address"][0]["uri"],
                         "sip:[2001:db8:0::1]:20999;lr")

    def test_route_verification_failure_retains_pending_reload(self):
        def ignore_write(*, action, **kwargs):
            return {"exit_code": 0} if action == "add-route" else self.proxy_task(
                action=action, **kwargs)

        self.agent.tasks.run.side_effect = ignore_write
        self.update()
        self.assertIn("PREVIOUS_SIP_UDP_PORT", self.env)
        self.assertIn("SIP_PROXY_ROUTES_PENDING", self.env)
        self.agent.tasks.run.side_effect = self.proxy_task
        self.update()
        self.assert_migrated()

    def test_deleted_pending_route_is_not_recreated(self):
        self.env["SIP_PROXY_ROUTES_PENDING"] = '["deleted.example.org"]'
        self.routes.clear()
        self.run_script("92repoint_proxy_routes")
        self.assertNotIn("SIP_PROXY_ROUTES_PENDING", self.env)
        self.assertEqual(self.env["SIP_PROXY_ROUTES_MIGRATED"], "12002")
        self.assertNotIn("add-route", [call.kwargs["action"]
                                      for call in self.agent.tasks.run.call_args_list])

    def test_proxy_json_reads_and_empty_successful_write_output(self):
        def serialized_task(*, action, **kwargs):
            result = self.proxy_task(action=action, **kwargs)
            result["output"] = "" if action == "add-route" else json.dumps(result["output"])
            return result

        self.env["PREVIOUS_SIP_UDP_PORT"] = "12002"
        self.env["ASTERISK_SIP_UDP_PORT"] = "20999"
        self.agent.tasks.run.side_effect = serialized_task
        self.run_script("92repoint_proxy_routes")
        self.assertEqual(self.env["SIP_PROXY_ROUTES_MIGRATED"], "20999")
        self.assertNotIn("SIP_PROXY_ROUTES_PENDING", self.env)
        self.assertEqual(self.routes[0]["address"][0]["uri"], "sip:10.0.0.1:20999")

    def test_domain_using_assigned_non_vpn_address(self):
        self.routes[0]["address"][0]["uri"] = "sip:192.0.2.1:12002;lr"
        self.update()
        self.assertEqual(self.routes[0]["address"][0]["uri"], "sip:192.0.2.1:20999;lr")
        self.assertNotIn("PREVIOUS_SIP_UDP_PORT", self.env)

    def test_trunks_using_assigned_non_vpn_address(self):
        self.env["ASTERISK_SIP_PORT"] = "20051"
        self.env["ASTERISK_SIP_UDP_PORT"] = "21001"
        self.trunks = [{"rule": rule, "destination": {
            "uri": "sip:192.0.2.1:20051;transport=udp;tag=keep", "description": "custom",
        }} for rule in ("trunk-A", "trunk-B")]
        self.trunks.extend([{"rule": str(i), "destination": {"uri": uri}} for i, uri in enumerate([
            "sip:192.0.2.2:20051", "sip:192.0.2.1:5555",
            "sip:192.0.2.1:20051;transport=tcp", "sips:192.0.2.1:20051",
        ])])
        untouched = [trunk.copy() for trunk in self.trunks[2:]]
        self.run_script("91repoint_proxy_trunks")
        for trunk in self.trunks[:2]:
            self.assertEqual(trunk["destination"], {
                "uri": "sip:192.0.2.1:21001;transport=udp;tag=keep", "description": "custom",
            })
        self.assertEqual(self.trunks[2:], untouched)
        self.agent.tasks.run.reset_mock()
        self.run_script("91repoint_proxy_trunks")
        self.assertNotIn("add-trunk", [call.kwargs["action"]
                                      for call in self.agent.tasks.run.call_args_list])
        self.agent.allocate_ports.assert_not_called()

    def test_address_discovery_failure_retains_retry_state(self):
        self.sip_migration.subprocess.run.side_effect = RuntimeError("ip unavailable")
        self.update()
        self.assertIn("PREVIOUS_SIP_UDP_PORT", self.env)
        self.assertNotIn("SIP_PROXY_ROUTES_MIGRATED", self.env)
        self.assertNotIn("SIP_PROXY_TRUNKS_MIGRATED", self.env)
        self.assertEqual(self.trunks[0]["destination"]["uri"],
                         "sip:10.0.0.1:12002;transport=udp")


if __name__ == "__main__":
    unittest.main()
