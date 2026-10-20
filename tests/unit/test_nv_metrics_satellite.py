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
# Output of satellite GET /metrics (nethesis/satellite#55), shortened
SATELLITE_METRICS = """# HELP satellite_ai_credit_exhausted 1 if the provider reported no credit left, 0 if its last call succeeded, -1 if not known yet.
# TYPE satellite_ai_credit_exhausted gauge
satellite_ai_credit_exhausted{provider="deepgram"} 1.0
satellite_ai_credit_exhausted{provider="openai"} -1.0
# HELP satellite_ai_calls_total AI provider calls by operation and result.
# TYPE satellite_ai_calls_total counter
satellite_ai_calls_total{operation="transcription",provider="deepgram",result="failure"} 3.0
process_resident_memory_bytes 1.2e+08
"""


class RenderTest(unittest.TestCase):
    def test_credit_state_is_forwarded(self):
        text = satellite.render(SATELLITE_METRICS)
        self.assertIn('nethvoice_satellite_ai_credit_exhausted{provider="deepgram"} 1\n', text)
        self.assertIn('nethvoice_satellite_ai_credit_exhausted{provider="openai"} -1\n', text)
        self.assertIn("# TYPE nethvoice_satellite_ai_credit_exhausted gauge\n", text)

    def test_other_satellite_metrics_are_not_forwarded(self):
        text = satellite.render(SATELLITE_METRICS)
        self.assertNotIn("calls_total", text)
        self.assertNotIn("process_", text)

    def test_missing_credit_metric_is_unavailable(self):
        with self.assertRaises(CheckUnavailable):
            satellite.render("process_resident_memory_bytes 1\n")

    def test_reserved_labels_are_never_set(self):
        self.assertNotRegex(satellite.render(SATELLITE_METRICS), r"(module|module_id|instance)=")


class CollectTest(unittest.TestCase):
    def test_url_and_token(self):
        calls = []

        def http(url, token):
            calls.append((url, token))
            return SATELLITE_METRICS

        satellite.collect({"SATELLITE_HTTP_PORT": "20111"}, lambda: TOKEN, http)
        self.assertEqual(calls, [("http://127.0.0.1:20111/metrics", TOKEN)])

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
