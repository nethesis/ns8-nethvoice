#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

import http.server
import socket
import sys
import threading
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "imageroot" / "pypkg"))

from nvmetrics import satellite  # noqa: E402
from nvmetrics.runner import CheckUnavailable  # noqa: E402

TOKEN = "satellite-secret-token"
FIXTURES = Path(__file__).resolve().parent / "fixtures"
# Output of the satellite GET /metrics page on rl1 (nethesis/satellite#55)
SATELLITE_METRICS = (FIXTURES / "satellite_metrics_rl1.txt").read_text()


class RenderTest(unittest.TestCase):
    def test_satellite_families_are_forwarded_as_they_are(self):
        text = satellite.render(SATELLITE_METRICS)
        self.assertIn('satellite_ai_credit_exhausted{provider="deepgram"} -1.0\n', text)
        self.assertIn('satellite_ai_credit_exhausted{provider="openai"} -1.0\n', text)
        self.assertIn("# TYPE satellite_ai_credit_exhausted gauge\n", text)
        self.assertIn(
            'satellite_ai_calls_total{operation="summary",provider="openai",result="failure"} 0.0\n', text
        )

    def test_other_families_are_not_forwarded(self):
        text = satellite.render(SATELLITE_METRICS)
        self.assertNotIn("process_", text)
        self.assertNotIn("python_", text)
        self.assertNotIn("nethvoice_", text)

    def test_page_without_satellite_metrics_is_unavailable(self):
        with self.assertRaises(CheckUnavailable):
            satellite.render("process_resident_memory_bytes 1\n")

    def test_reserved_labels_are_never_set(self):
        self.assertNotRegex(satellite.render(SATELLITE_METRICS), r"(module|module_id|instance)=")
        text = satellite.render('satellite_x{provider="a"} 1\nsatellite_x{instance="b"} 1\n')
        self.assertEqual(text, 'satellite_x{provider="a"} 1\n')


class CollectTest(unittest.TestCase):
    def test_url_and_token(self):
        calls = []

        def http(url, token):
            calls.append((url, token))
            return SATELLITE_METRICS

        satellite.collect({"SATELLITE_HTTP_PORT": "20111"}, lambda: TOKEN, http)
        self.assertEqual(calls, [("http://127.0.0.1:20111/metrics", TOKEN)])

    def test_token_from_passwords_env(self):
        self.assertEqual(satellite.read_token(lambda: {"SATELLITE_API_TOKEN": TOKEN}), TOKEN)
        self.assertEqual(satellite.read_token(lambda: {}), "")

    def test_enabled_only_with_transcription(self):
        self.assertTrue(satellite.enabled({"SATELLITE_CALL_TRANSCRIPTION_ENABLED": "True"}))
        self.assertTrue(satellite.enabled({"SATELLITE_VOICEMAIL_TRANSCRIPTION_ENABLED": "True"}))
        self.assertFalse(satellite.enabled({"SATELLITE_CALL_TRANSCRIPTION_ENABLED": "False"}))


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

    def test_page_is_read_with_bearer_token(self):
        url, received = self.serve(200, SATELLITE_METRICS.encode())
        self.assertEqual(satellite.fetch(url, TOKEN), SATELLITE_METRICS)
        self.assertEqual(received, ["Bearer " + TOKEN])

    def test_http_error_is_unavailable_without_token(self):
        url, _ = self.serve(401)
        with self.assertRaises(CheckUnavailable) as ctx:
            satellite.fetch(url, TOKEN)
        self.assertIn("401", str(ctx.exception))
        self.assertNotIn(TOKEN, str(ctx.exception))

    def test_satellite_down_is_unavailable(self):
        sock = socket.socket()
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
        sock.close()
        with self.assertRaises(CheckUnavailable) as ctx:
            satellite.fetch("http://127.0.0.1:%d/metrics" % port, TOKEN)
        self.assertNotIn(TOKEN, str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
