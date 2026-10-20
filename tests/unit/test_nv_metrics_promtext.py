#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

import http.server
import os
import sys
import threading
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "imageroot" / "pypkg"))

from nvmetrics import promtext  # noqa: E402

FIXTURES = Path(__file__).resolve().parent / "fixtures"
# Output of the satellite GET /metrics page on rl1
SATELLITE_RL1 = (FIXTURES / "satellite_metrics_rl1.txt").read_text()


class ParseSampleTest(unittest.TestCase):
    def test_labels_and_value(self):
        self.assertEqual(
            promtext.parse_sample('a_b{x="1",y="z"} 2.5'),
            ("a_b", [("x", "1"), ("y", "z")], "2.5"),
        )

    def test_escaped_quote_comma_and_brace_in_value(self):
        name, labels, value = promtext.parse_sample(r'a{x="q\"u,o}te",y="2",} -1')
        self.assertEqual(labels, [("x", r"q\"u,o}te"), ("y", "2")])
        self.assertEqual(value, "-1")

    def test_timestamp_is_dropped(self):
        self.assertEqual(promtext.parse_sample("a 1 1700000000000"), ("a", [], "1"))

    def test_invalid_lines(self):
        for line in ("", "a", 'a{x="1" y="2"} 1', 'a{x=1} 1', "a one", "a 1 2 3", '1a 2'):
            self.assertIsNone(promtext.parse_sample(line), line)

    def test_special_values(self):
        for value in ("NaN", "+Inf", "-Inf", "1.79251297603e+09"):
            self.assertEqual(promtext.parse_sample("a " + value)[2], value)


class SamplesTest(unittest.TestCase):
    def test_labels_are_unescaped(self):
        text = 'a{x="q\\"u\\\\o\\nte"} 1\nb 2\n'
        self.assertEqual(promtext.samples(text, "a"), [({"x": 'q"u\\o\nte'}, 1.0)])


class ForwardTest(unittest.TestCase):
    def test_only_prefixed_families(self):
        text = promtext.forward(SATELLITE_RL1, "satellite_")
        self.assertIn('satellite_ai_credit_exhausted{provider="deepgram"} -1.0\n', text)
        self.assertIn("# TYPE satellite_ai_calls_total counter\n", text)
        self.assertIn(
            "# HELP satellite_ai_credit_exhausted 1 if the provider reported no credit left, "
            "0 if its last call succeeded, -1 if not known yet.\n",
            text,
        )
        for other in ("process_", "python_"):
            self.assertNotIn(other, text)

    def test_output_is_unchanged_for_valid_families(self):
        lines = [line for line in SATELLITE_RL1.splitlines() if "satellite_" in line]
        self.assertEqual(promtext.forward(SATELLITE_RL1, "satellite_"), "\n".join(lines) + "\n")

    def test_reserved_labels_and_timestamps(self):
        text = promtext.forward(
            'x_a{module="m"} 1\nx_a{instance="i"} 2\nx_a{module_id="m"} 3\nx_a{y="1"} 4 1700000000\n',
            "x_",
        )
        self.assertEqual(text, 'x_a{y="1"} 4\n')

    def test_one_help_and_type_per_family(self):
        text = promtext.forward("# TYPE x_a gauge\nx_a 1\n# TYPE x_a gauge\nx_a 2\n# random comment\n", "x_")
        self.assertEqual(text, "# TYPE x_a gauge\nx_a 1\nx_a 2\n")

    def test_nothing_to_forward(self):
        self.assertEqual(promtext.forward("process_open_fds 1\n", "satellite_"), "")



class FetchTest(unittest.TestCase):
    def test_environment_http_proxy_is_not_used(self):
        received = []

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                received.append(self.headers.get("Authorization"))
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b"a_metric 1\n")

            def log_message(self, *args):
                pass

        server = http.server.HTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        # Nothing listens on the proxy port: the request fails if the proxy is used
        proxy = {"http_proxy": "http://127.0.0.1:9", "HTTP_PROXY": "http://127.0.0.1:9", "no_proxy": "", "NO_PROXY": ""}
        with mock.patch.dict(os.environ, proxy):
            text = promtext.fetch("http://127.0.0.1:%d/metrics" % server.server_port, "Bearer secret", "test")
        self.assertEqual(text, "a_metric 1\n")
        self.assertEqual(received, ["Bearer secret"])


if __name__ == "__main__":
    unittest.main()
