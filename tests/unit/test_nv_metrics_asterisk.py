#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

import base64
import http.server
import socket
import sys
import threading
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "imageroot" / "pypkg"))

from nvmetrics import asterisk  # noqa: E402
from nvmetrics.runner import CheckUnavailable  # noqa: E402

PASSWORD = "asterisk-secret-password"
FIXTURES = Path(__file__).resolve().parent / "fixtures"
# Output of the res_prometheus GET /metrics page on rl1, with test trunks
ASTERISK_METRICS = (FIXTURES / "asterisk_metrics_rl1.txt").read_text()


class CollectTest(unittest.TestCase):
    def test_asterisk_families_are_forwarded_as_they_are(self):
        text = asterisk.collect(lambda: ASTERISK_METRICS)
        self.assertEqual(text, ASTERISK_METRICS)

    def test_other_families_and_reserved_labels_are_dropped(self):
        page = ASTERISK_METRICS + 'go_goroutines 3\nasterisk_x{instance="a"} 1\n'
        self.assertEqual(asterisk.collect(lambda: page), ASTERISK_METRICS)

    def test_empty_page_is_unavailable(self):
        with self.assertRaises(CheckUnavailable):
            asterisk.collect(lambda: "")


class ReadPageTest(unittest.TestCase):
    def test_url_and_password(self):
        calls = []

        def http(url, password):
            calls.append((url, password))
            return ASTERISK_METRICS

        page = asterisk.read_page({"ASTERISK_WS_PORT": "20091"}, lambda: PASSWORD, http, lambda: True)
        self.assertEqual(page, ASTERISK_METRICS)
        self.assertEqual(calls, [("http://127.0.0.1:20091/metrics", PASSWORD)])

    def test_unavailable_when_freepbx_is_not_running(self):
        def http(url, password):
            raise AssertionError("must not be called")

        with self.assertRaises(CheckUnavailable):
            asterisk.read_page({"ASTERISK_WS_PORT": "20091"}, lambda: PASSWORD, http, lambda: False)

    def test_unavailable_without_password(self):
        with self.assertRaises(CheckUnavailable):
            asterisk.read_page({"ASTERISK_WS_PORT": "20091"}, lambda: "", None, lambda: True)

    def test_freepbx_active_from_systemd_units(self):
        def units(state):
            return lambda: [{"Id": "mariadb.service", "ActiveState": "active"}, {"Id": "freepbx.service", "ActiveState": state}]

        self.assertTrue(asterisk.freepbx_active(units("active")))
        self.assertTrue(asterisk.freepbx_active(units("reloading")))
        self.assertFalse(asterisk.freepbx_active(units("activating")))
        self.assertFalse(asterisk.freepbx_active(units("failed")))
        self.assertFalse(asterisk.freepbx_active(lambda: []))

    def test_password_from_passwords_env(self):
        passwords = lambda: {"ASTERISK_PROMETHEUS_PASSWORD": PASSWORD, "OTHER": "x"}  # noqa: E731
        self.assertEqual(asterisk.read_password(passwords), PASSWORD)
        self.assertEqual(asterisk.read_password(lambda: {}), "")


class FetchTest(unittest.TestCase):
    def serve(self, status, body=b""):
        received = []

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                received.append(self.headers.get("Authorization"))
                self.send_response(status)
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *args):
                pass

        server = http.server.HTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        return "http://127.0.0.1:%d/metrics" % server.server_port, received

    def test_page_is_read_with_basic_auth(self):
        url, received = self.serve(200, ASTERISK_METRICS.encode())
        self.assertEqual(asterisk.fetch(url, PASSWORD), ASTERISK_METRICS)
        expected = base64.b64encode(("prometheus:" + PASSWORD).encode()).decode()
        self.assertEqual(received, ["Basic " + expected])

    def test_wrong_password_is_unavailable_without_password(self):
        url, _ = self.serve(401)
        with self.assertRaises(CheckUnavailable) as ctx:
            asterisk.fetch(url, PASSWORD)
        self.assertIn("401", str(ctx.exception))
        self.assertNotIn(PASSWORD, str(ctx.exception))

    def test_asterisk_down_is_unavailable(self):
        sock = socket.socket()
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
        sock.close()
        with self.assertRaises(CheckUnavailable) as ctx:
            asterisk.fetch("http://127.0.0.1:%d/metrics" % port, PASSWORD)
        self.assertNotIn(PASSWORD, str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
