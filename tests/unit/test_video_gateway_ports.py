#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

"""Port allocation invariants of the video gateway (MediaMTX).

The ICE UDP port must never change the size of UDP_PORTS_RANGE: a different
size makes update-module.d/20allocate_ports move every RTP/SIP port of the
instance. These tests run the real scripts against a fake ns8-core port
allocator with the same semantics as node/ports_manager.py.
"""

import json
import os
import sys
import types
import unittest
from pathlib import Path
from unittest import mock

from event_test_utils import load_script

ROOT = Path(__file__).resolve().parents[2] / "imageroot"
sys.path.insert(0, str(ROOT / "pypkg"))

import video_gateway  # noqa: E402

MODULE = "nethvoice1"


class FakePorts:
    """In-memory copy of ns8-core node/ports_manager.allocate_ports()."""

    def __init__(self):
        self.rows = {"tcp": [], "udp": []}
        self.calls = []

    def allocate(self, count, protocol, keep_existing=False, module=MODULE):
        self.calls.append((count, protocol, keep_existing))
        rows = self.rows[protocol]
        if not keep_existing:
            rows[:] = [row for row in rows if row[2] != module]
        start = 20000
        while any(s <= port <= e for s, e, _ in rows for port in range(start, start + count)):
            start = max(e for s, e, _ in rows if any(s <= p <= e for p in range(start, start + count))) + 1
        rows.append((start, start + count - 1, module))
        rows.sort()
        return (start, start + count - 1)

    def ports(self, protocol, module=MODULE):
        return [port for s, e, m in self.rows[protocol] if m == module for port in range(s, e + 1)]


class VideoGatewayPortsTest(unittest.TestCase):
    def setUp(self):
        self.ports = FakePorts()
        self.env = {}
        self.firewall = []
        self.agent = types.ModuleType("agent")
        self.agent.tasks = types.ModuleType("agent.tasks")
        self.agent.allocate_ports = mock.Mock(side_effect=self.ports.allocate)
        self.agent.set_env = lambda key, value: self.env.update({key: str(value)})
        self.agent.unset_env = lambda key: self.env.pop(key, None)
        self.agent.read_envfile = lambda _name: dict(self.env)
        self.agent.write_envfile = mock.Mock()
        self.agent.add_public_service = mock.Mock(side_effect=lambda name, ports, replace_ports=False: self.firewall.append((ports, replace_ports)) or True)
        self.agent.SD_WARNING = self.agent.SD_INFO = self.agent.SD_ERR = ""

    def run_script(self, path, extra_env=None):
        environ = {"NODE_ID": "1", "MODULE_ID": MODULE}
        environ.update(self.env)
        environ.update(extra_env or {})
        with mock.patch.dict(os.environ, environ, clear=False), mock.patch("sys.stderr"):
            try:
                load_script("video_gateway_script", ROOT / path, {
                    "agent": self.agent, "agent.tasks": self.agent.tasks, "video_gateway": video_gateway,
                })
            except SystemExit as ex:
                self.assertIn(ex.code, (0, None))

    def install(self):
        """create-module/05setenvs on a new instance: ns8-core allocated the
        label demands (46 TCP, 3000 UDP) before the action runs."""
        tcp = self.ports.allocate(46, "tcp")
        udp = self.ports.allocate(3000, "udp")
        self.ports.calls.clear()
        self.run_script("actions/create-module/05setenvs", {
            "TCP_PORTS_RANGE": f"{tcp[0]}-{tcp[1]}",
            "UDP_PORTS_RANGE": f"{udp[0]}-{udp[1]}",
        })
        # ns8-core sets these at install time
        self.env["TCP_PORTS_RANGE"] = f"{tcp[0]}-{tcp[1]}"
        self.env.setdefault("UDP_PORTS_RANGE", f"{udp[0]}-{udp[1]}")

    def existing_18_instance(self):
        """An instance installed by 1.8.x: 43 TCP ports, 1000 UDP ports."""
        tcp = self.ports.allocate(43, "tcp")
        udp = self.ports.allocate(1000, "udp")
        base = udp[0]
        self.env.update({
            "TCP_PORTS_RANGE": f"{tcp[0]}-{tcp[1]}",
            "UDP_PORTS_RANGE": f"{udp[0]}-{udp[1]}",
            "ASTERISK_RTPSTART": str(base), "ASTERISK_RTPEND": str(base + 398),
            "JANUS_SIP_RTPSTART": str(base + 399), "JANUS_SIP_RTPEND": str(base + 797),
            "JANUS_RTPSTART": str(base + 798), "JANUS_RTPEND": str(base + 996),
            "SATELLITE_RTP_PORT": str(base + 997), "ASTERISK_IAX_PORT": str(base + 998),
            "ASTERISK_SIP_UDP_PORT": str(base + 999), "ASTERISK_SIP_PORT": str(tcp[0] + 24),
            "NETHVOICE_MIDDLEWARE_PORT": str(tcp[0] + 34), "ASTERISK_WSS_PORT": str(tcp[0] + 33),
            "ASTERISK_RECORDING_SFTP_PORT": str(tcp[0] + 29), "ASTERISK_WS_PORT": str(tcp[0] + 30),
            "SATELLITE_MQTT_PORT": str(tcp[0] + 31), "SATELLITE_HTTP_PORT": str(tcp[0] + 32),
            "SATELLITE_PGSQL_PORT": str(tcp[0] + 35), "CHAT_C2S_PORT": str(tcp[0] + 38),
            "CHAT_HTTP_PORT": str(tcp[0] + 39), "CHAT_COMPONENT_PORT": str(tcp[0] + 40),
            "CHAT_GW_PORT": str(tcp[0] + 41),
        })
        self.ports.calls.clear()

    def update(self):
        for name in ("20allocate_ports", "20allocate_video_gateway_ports"):
            self.run_script("update-module.d/" + name)

    def assert_gateway_ports(self):
        tcp = [int(self.env[name]) for name in video_gateway.TCP_PORT_VARS]
        udp = int(self.env[video_gateway.UDP_PORT_VAR])
        self.assertEqual(len(set(tcp)), 4)
        self.assertTrue(set(tcp) <= set(self.ports.ports("tcp")), "TCP ports are allocated to the module")
        self.assertIn(udp, self.ports.ports("udp"))
        start, end = (int(v) for v in self.env["UDP_PORTS_RANGE"].split("-"))
        self.assertEqual(end - start + 1, 1000, "UDP block size unchanged")
        self.assertFalse(start <= udp <= end, "ICE UDP port is outside UDP_PORTS_RANGE")

    def test_new_install(self):
        self.install()
        self.assert_gateway_ports()
        tcp = list(range(*(int(v) for v in self.env["TCP_PORTS_RANGE"].split("-")))) + [int(self.env["TCP_PORTS_RANGE"].split("-")[1])]
        self.assertEqual([self.env[name] for name in video_gateway.TCP_PORT_VARS], [str(p) for p in tcp[42:46]])
        # The ICE port is allocated after the UDP block has been shrunk, and
        # without dropping it
        self.assertEqual(self.ports.calls, [(1000, "udp", False), (1, "udp", True)])
        # No other TCP port of 05setenvs uses the indexes of the gateway
        udp_vars = ("ASTERISK_RTP", "JANUS_RTP", "JANUS_SIP_RTP", "SATELLITE_RTP_PORT",
                    "ASTERISK_IAX_PORT", "ASTERISK_SIP_UDP_PORT", "MEDIAMTX_")
        other_tcp = {value for key, value in self.env.items()
                     if value.isdigit() and not key.startswith(udp_vars)}
        for name in video_gateway.TCP_PORT_VARS:
            self.assertNotIn(self.env[name], other_tcp, f"{name} collides with another TCP port")

    def test_new_install_then_update_is_a_noop(self):
        self.install()
        before = dict(self.env)
        rows = json.dumps(self.ports.rows)
        self.ports.calls.clear()
        self.update()
        self.assertEqual(self.ports.calls, [])
        self.assertEqual(json.dumps(self.ports.rows), rows)
        before_ports = {k: v for k, v in before.items() if "PORT" in k or "RTP" in k}
        self.assertEqual({k: v for k, v in self.env.items() if k in before_ports}, before_ports)

    def test_update_of_existing_instance_does_not_move_rtp_ports(self):
        self.existing_18_instance()
        rtp_before = {k: v for k, v in self.env.items() if k.startswith(("ASTERISK_", "JANUS_", "SATELLITE_RTP", "UDP_PORTS_RANGE"))}
        self.update()
        self.assert_gateway_ports()
        self.assertEqual({k: self.env[k] for k in rtp_before}, rtp_before)
        self.assertNotIn("PORTS_MIGRATION_REPORT", self.env)
        # Only single extra allocations, never a resize of an existing range
        self.assertEqual(self.ports.calls, [(4, "tcp", True), (1, "udp", True)])
        # A second update allocates nothing
        self.ports.calls.clear()
        self.update()
        self.assertEqual(self.ports.calls, [])
        self.assertNotIn("PORTS_MIGRATION_REPORT", self.env)

    def test_full_udp_migration_reallocates_the_ice_port(self):
        # A 1.7.10 instance with the 2003 ports block: 20allocate_ports moves
        # it, dropping every UDP row of the module, the ICE port included
        self.existing_18_instance()
        self.update()
        old_ice = self.env[video_gateway.UDP_PORT_VAR]
        start = int(self.env["UDP_PORTS_RANGE"].split("-")[0])
        self.ports.rows["udp"] = [r for r in self.ports.rows["udp"] if r[2] != MODULE]
        self.ports.rows["udp"].append((start, start + 2002, MODULE))
        self.ports.rows["udp"].append((int(old_ice), int(old_ice), MODULE))
        self.env["UDP_PORTS_RANGE"] = f"{start}-{start + 2002}"
        self.ports.calls.clear()
        self.update()
        self.assertEqual(self.ports.calls, [(1000, "udp", False), (1, "udp", True)])
        self.assert_gateway_ports()
        self.assertEqual(len([r for r in self.ports.rows["udp"] if r[2] == MODULE]), 2)

    def test_allocation_failure_does_not_block_the_update(self):
        self.existing_18_instance()
        self.agent.allocate_ports.side_effect = RuntimeError("Ports range max exceeded!")
        self.run_script("update-module.d/20allocate_video_gateway_ports")
        self.assertEqual(video_gateway.missing_port_vars(self.env), list(video_gateway.TCP_PORT_VARS) + [video_gateway.UDP_PORT_VAR])

    def test_partial_failure_keeps_what_was_allocated(self):
        self.existing_18_instance()
        real = self.ports.allocate

        def tcp_only(count, protocol, keep_existing=False):
            if protocol == "udp":
                raise RuntimeError("no UDP ports")
            return real(count, protocol, keep_existing)
        self.agent.allocate_ports.side_effect = tcp_only
        self.run_script("update-module.d/20allocate_video_gateway_ports")
        self.assertEqual(video_gateway.missing_port_vars(self.env), [video_gateway.UDP_PORT_VAR])
        self.agent.allocate_ports.side_effect = self.ports.allocate
        self.ports.calls.clear()
        self.run_script("update-module.d/20allocate_video_gateway_ports")
        self.assertEqual(self.ports.calls, [(1, "udp", True)])

    def test_update_scripts_order(self):
        names = sorted(os.listdir(ROOT / "update-module.d"))
        self.assertLess(names.index("20allocate_ports"), names.index("20allocate_video_gateway_ports"))
        self.assertLess(names.index("20allocate_video_gateway_ports"), names.index("21firewall_ports"))

    def test_firewall_opens_ice_on_udp_and_tcp(self):
        self.install()
        self.env.update({
            "NETHCTI_TLS_PORT": "1", "PHONEBOOK_LDAP_PORT": "2", "ASTERISK_RECORDING_SFTP_PORT": "3",
        })
        self.run_script("actions/create-module/90firewall")
        ports, replace = self.firewall[-1]
        self.assertTrue(replace)
        self.assertIn(self.env["MEDIAMTX_ICE_UDP_PORT"] + "/udp", ports)
        self.assertIn(self.env["MEDIAMTX_ICE_TCP_PORT"] + "/tcp", ports)
        for name in ("MEDIAMTX_WHEP_PORT", "MEDIAMTX_API_PORT", "MEDIAMTX_RTSP_PORT"):
            self.assertNotIn(self.env[name] + "/tcp", ports, f"{name} must stay on loopback")
        # Instances without the gateway ports keep the previous firewall
        for name in ("MEDIAMTX_ICE_UDP_PORT", "MEDIAMTX_ICE_TCP_PORT"):
            del self.env[name]
        self.run_script("actions/create-module/90firewall")
        self.assertFalse([p for p in self.firewall[-1][0] if "None" in p])

    def test_ports_list(self):
        self.install()
        environ = dict(self.env)
        with mock.patch.dict(os.environ, environ), mock.patch("sys.stdout") as stdout:
            load_script("ports_list", ROOT / "actions/get-ports-list/10read", {})
        output = json.loads("".join(call.args[0] for call in stdout.write.call_args_list))
        entries = {(e["name"], e["port"], e["protocol"]) for e in output}
        self.assertIn(("Video gateway ICE (UDP)", self.env["MEDIAMTX_ICE_UDP_PORT"], "udp"), entries)
        self.assertIn(("Video gateway ICE (TCP)", self.env["MEDIAMTX_ICE_TCP_PORT"], "tcp"), entries)

    def test_ice_env(self):
        self.assertEqual(video_gateway.ice_env({"address": "10.0.0.5", "public_address": "203.0.113.5"}), {
            "MEDIAMTX_PUBLIC_IP": "203.0.113.5", "MEDIAMTX_ICE_HOSTS": "203.0.113.5,10.0.0.5",
        })
        self.assertEqual(video_gateway.ice_env({"address": "203.0.113.5", "public_address": "203.0.113.5"}), {
            "MEDIAMTX_PUBLIC_IP": "203.0.113.5", "MEDIAMTX_ICE_HOSTS": "203.0.113.5",
        })
        # nethvoice-proxy not configured yet
        self.assertEqual(video_gateway.ice_env({"address": "127.0.0.1", "public_address": "127.0.0.1"}), {
            "MEDIAMTX_PUBLIC_IP": "", "MEDIAMTX_ICE_HOSTS": "",
        })


if __name__ == "__main__":
    unittest.main()
