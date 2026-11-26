#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

"""update-module.d/20move_satellite_pgsql_port moves PostgreSQL off a port
used by another local TCP service, preferring a free port the instance
already holds, so the TCP ports quota does not change."""

import os
import types
import unittest
from pathlib import Path
from unittest import mock

from event_test_utils import load_script

SCRIPT = Path(__file__).resolve().parents[2] / "imageroot" / "update-module.d" / "20move_satellite_pgsql_port"

# Ports of an instance created before 1.4 and upgraded to 1.8: the 31-port
# range plus single allocations. 20029 is the dropped IAX TCP port.
UPGRADED_ENV = {
    "TCP_PORTS_RANGE": "20003-20033",
    "NETHVOICE_MARIADB_PORT": "20003", "APACHE_PORT": "20004", "ASTMANAGERPORT": "20005",
    "TANCREDIPORT": "20006", "JANUS_TRANSPORT_PORT": "20007", "NETHCTI_UI_PORT": "20008",
    "NETHCTI_SERVER_API_PORT": "20009", "NETHCTI_SERVER_WS_PORT": "20010", "PHONEBOOK_LDAP_PORT": "20011",
    **{f"NETHCTI_INTERNAL_REST_PORT{i}": str(20011 + i) for i in range(1, 14)},
    "NETHCTI_TCP_PORT": "20025", "NETHCTI_TLS_PORT": "20026", "ASTERISK_SIP_PORT": "20027",
    "ASTERISK_SIPS_PORT": "20028", "REPORTS_REDIS_PORT": "20030", "REPORTS_API_PORT": "20031",
    "REPORTS_UI_PORT": "20032", "ASTERISK_RECORDING_SFTP_PORT": "20033",
    "ASTERISK_IAX_PORT": "20998", "ASTERISK_SIP_UDP_PORT": "20999",
    "ASTERISK_WS_PORT": "20037", "SATELLITE_MQTT_PORT": "20038", "SATELLITE_HTTP_PORT": "20039",
    "ASTERISK_WSS_PORT": "20041", "NETHVOICE_MIDDLEWARE_PORT": "20042",
    "NETHVOICE_MIDDLEWARE_LISTEN_ADDRESS": "127.0.0.1:20042",
    "SATELLITE_PGSQL_PORT": "20042",
}


class FakeSocket:
    busy = set()

    def __init__(self, *args):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def bind(self, address):
        if address[1] in FakeSocket.busy:
            raise OSError("address already in use")


class SatellitePgsqlPortTest(unittest.TestCase):
    def setUp(self):
        self.env = dict(UPGRADED_ENV)
        FakeSocket.busy = set()
        self.agent = types.ModuleType("agent")
        self.agent.allocate_ports = mock.Mock(return_value=(20049, 20049))
        self.agent.set_env = lambda key, value: self.env.update({key: str(value)})
        self.agent.read_envfile = lambda _name: dict(self.env)
        self.agent.SD_ERR = ""

    def run_script(self):
        with mock.patch("socket.socket", FakeSocket), mock.patch("sys.stderr"):
            try:
                load_script("move_pgsql_port", SCRIPT, {"agent": self.agent})
            except SystemExit as ex:
                self.assertIn(ex.code, (0, None))

    def test_reuses_free_reserved_port(self):
        self.run_script()
        self.assertEqual(self.env["SATELLITE_PGSQL_PORT"], "20029")
        self.assertEqual(self.env["NETHVOICE_MIDDLEWARE_PORT"], "20042")
        self.agent.allocate_ports.assert_not_called()

    def test_skips_reserved_port_in_use(self):
        FakeSocket.busy = {20029}
        self.env["TCP_PORTS_RANGE"] = "20003-20034"
        self.run_script()
        self.assertEqual(self.env["SATELLITE_PGSQL_PORT"], "20034")
        self.agent.allocate_ports.assert_not_called()

    def test_allocates_when_range_is_full(self):
        FakeSocket.busy = {20029}
        self.run_script()
        self.assertEqual(self.env["SATELLITE_PGSQL_PORT"], "20049")
        self.agent.allocate_ports.assert_called_once_with(1, "tcp", keep_existing=True)

    def test_allocation_failure_keeps_port(self):
        FakeSocket.busy = {20029}
        self.agent.allocate_ports.side_effect = Exception("max_ports_exceeded")
        self.run_script()
        self.assertEqual(self.env["SATELLITE_PGSQL_PORT"], "20042")

    def test_local_listener_without_port_suffix(self):
        self.env["NETHVOICE_MIDDLEWARE_PORT"] = "20040"
        self.env["SATELLITE_PGSQL_PORT"] = self.env["ASTMANAGERPORT"]
        self.run_script()
        self.assertEqual(self.env["SATELLITE_PGSQL_PORT"], "20029")

    def test_remote_and_udp_ports_are_ignored(self):
        self.env["NETHVOICE_MIDDLEWARE_PORT"] = "20040"
        self.env["SATELLITE_PGSQL_PORT"] = "20999"
        self.env["NETHVOICE_HOTEL_FIAS_PORT"] = "20999"
        self.run_script()
        self.assertEqual(self.env["SATELLITE_PGSQL_PORT"], "20999")
        self.agent.allocate_ports.assert_not_called()

    def test_distinct_ports_unchanged(self):
        self.env["SATELLITE_PGSQL_PORT"] = "20040"
        self.run_script()
        self.assertEqual(self.env["SATELLITE_PGSQL_PORT"], "20040")
        self.agent.allocate_ports.assert_not_called()


if __name__ == "__main__":
    unittest.main()
