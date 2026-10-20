#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

import http.server
import io
import socket
import sys
import threading
import time
import types
import unittest
from contextlib import redirect_stderr
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "imageroot" / "pypkg"))

from nvmetrics import aikeys  # noqa: E402
from nvmetrics.runner import CheckUnavailable  # noqa: E402

DEEPGRAM_KEY = "dg-secret-0123456789abcdef"
OPENAI_KEY = "sk-secret-0123456789abcdef"
KEYS = {"DEEPGRAM_API_KEY": DEEPGRAM_KEY, "OPENAI_API_KEY": OPENAI_KEY}
DEEPGRAM_URL = "https://api.deepgram.com/v1/projects"
OPENAI_URL = "https://api.openai.com/v1/models"


def fake_http(answers):
    """answers: {url: HTTP status | exception}"""
    calls = []

    def http(url, authorization):
        calls.append((url, authorization))
        answer = answers[url]
        if isinstance(answer, Exception):
            raise answer
        return answer

    http.calls = calls
    return http


class RenderTest(unittest.TestCase):
    def render(self, answers, keys=KEYS):
        err = io.StringIO()
        with redirect_stderr(err):
            text = aikeys.render(keys, fake_http(answers))
        return text, err.getvalue()

    def test_valid_keys(self):
        http = fake_http({DEEPGRAM_URL: 200, OPENAI_URL: 200})
        text = aikeys.render(KEYS, http)
        self.assertIn('nethvoice_ai_key_valid{provider="deepgram"} 1\n', text)
        self.assertIn('nethvoice_ai_key_valid{provider="openai"} 1\n', text)
        self.assertIn("# TYPE nethvoice_ai_key_valid gauge\n", text)
        self.assertCountEqual(
            http.calls,
            [(DEEPGRAM_URL, "Token " + DEEPGRAM_KEY), (OPENAI_URL, "Bearer " + OPENAI_KEY)],
        )

    def test_invalid_key_401(self):
        text, _ = self.render({DEEPGRAM_URL: 401, OPENAI_URL: 401})
        self.assertIn('nethvoice_ai_key_valid{provider="deepgram"} 0\n', text)
        self.assertIn('nethvoice_ai_key_valid{provider="openai"} 0\n', text)

    def test_forbidden_is_skipped(self):
        # A key without the permission to list projects still works
        text, err = self.render({DEEPGRAM_URL: 403, OPENAI_URL: 200})
        self.assertNotIn('provider="deepgram"', text)
        self.assertIn('nethvoice_ai_key_valid{provider="openai"} 1\n', text)
        self.assertIn("ai_keys: deepgram: check skipped: HTTP status 403", err)

    def test_server_error_is_skipped(self):
        text, err = self.render({DEEPGRAM_URL: 503, OPENAI_URL: 200})
        self.assertNotIn('provider="deepgram"', text)
        self.assertIn('nethvoice_ai_key_valid{provider="openai"} 1\n', text)
        self.assertIn("ai_keys: deepgram: check skipped: HTTP status 503", err)

    def test_other_client_errors_are_skipped(self):
        # Rate limit and exhausted credit are not an invalid key
        text, _ = self.render({DEEPGRAM_URL: 402, OPENAI_URL: 200})
        self.assertNotIn('provider="deepgram"', text)
        with self.assertRaises(CheckUnavailable):
            self.render({DEEPGRAM_URL: 402, OPENAI_URL: 429})

    def test_timeout_is_skipped(self):
        text, err = self.render({DEEPGRAM_URL: 200, OPENAI_URL: TimeoutError("timed out")})
        self.assertIn('nethvoice_ai_key_valid{provider="deepgram"} 1\n', text)
        self.assertNotIn('provider="openai"', text)
        self.assertIn("ai_keys: openai: check skipped: timed out", err)

    def test_all_providers_skipped_is_unavailable(self):
        with self.assertRaises(CheckUnavailable):
            self.render({DEEPGRAM_URL: OSError("network unreachable"), OPENAI_URL: 500})

    def test_only_configured_providers_are_checked(self):
        http = fake_http({OPENAI_URL: 200})
        text = aikeys.render({"DEEPGRAM_API_KEY": "", "OPENAI_API_KEY": OPENAI_KEY}, http)
        self.assertEqual(http.calls, [(OPENAI_URL, "Bearer " + OPENAI_KEY)])
        self.assertNotIn('provider="deepgram"', text)

    def test_providers_are_checked_in_parallel(self):
        def slow(url, authorization):
            time.sleep(0.5)
            return 200

        started = time.monotonic()
        text = aikeys.render(KEYS, slow)
        self.assertLess(time.monotonic() - started, 0.9)
        self.assertIn('nethvoice_ai_key_valid{provider="deepgram"} 1\n', text)
        self.assertIn('nethvoice_ai_key_valid{provider="openai"} 1\n', text)
        self.assertLess(text.index('provider="deepgram"'), text.index('provider="openai"'))

    def test_keys_never_in_output_or_log(self):
        outputs = []
        answers = (
            {DEEPGRAM_URL: 200, OPENAI_URL: 401},
            {DEEPGRAM_URL: 403, OPENAI_URL: OSError("bad header Bearer " + OPENAI_KEY)},
            {DEEPGRAM_URL: OSError(DEEPGRAM_KEY), OPENAI_URL: 302},
        )
        for answer in answers:
            err = io.StringIO()
            with redirect_stderr(err):
                try:
                    outputs.append(aikeys.render(KEYS, fake_http(answer)))
                except CheckUnavailable as ex:
                    outputs.append(str(ex))
            outputs.append(err.getvalue())
        self.assertIn("***", "".join(outputs))
        for output in outputs:
            self.assertNotIn(DEEPGRAM_KEY, output)
            self.assertNotIn(OPENAI_KEY, output)

    def test_reserved_labels_are_never_set(self):
        text, _ = self.render({DEEPGRAM_URL: 200, OPENAI_URL: 200})
        self.assertNotRegex(text, r"(module|module_id|instance)=")


class EnabledTest(unittest.TestCase):
    def test_disabled_when_transcription_off(self):
        keys = mock.Mock(return_value=KEYS)
        env = {"SATELLITE_CALL_TRANSCRIPTION_ENABLED": "False", "SATELLITE_VOICEMAIL_TRANSCRIPTION_ENABLED": "False"}
        self.assertFalse(aikeys.enabled(env, keys))
        self.assertFalse(aikeys.enabled({}, keys))
        # passwords.env is not read when transcription is off
        keys.assert_not_called()

    def test_disabled_without_keys(self):
        env = {"SATELLITE_CALL_TRANSCRIPTION_ENABLED": "True"}
        self.assertFalse(aikeys.enabled(env, lambda: {"DEEPGRAM_API_KEY": "", "OPENAI_API_KEY": ""}))
        self.assertFalse(aikeys.enabled(env, lambda: {}))

    def test_enabled_by_call_or_voicemail_transcription(self):
        keys = lambda: {"DEEPGRAM_API_KEY": DEEPGRAM_KEY, "OPENAI_API_KEY": ""}  # noqa: E731
        self.assertTrue(aikeys.enabled({"SATELLITE_CALL_TRANSCRIPTION_ENABLED": "True"}, keys))
        self.assertTrue(aikeys.enabled({"SATELLITE_VOICEMAIL_TRANSCRIPTION_ENABLED": "True"}, keys))


class ReadKeysTest(unittest.TestCase):
    def fake_agent(self, read_envfile):
        return mock.patch.dict(sys.modules, {"agent": types.SimpleNamespace(read_envfile=read_envfile)})

    def test_keys_from_passwords_env(self):
        env = dict(KEYS, MARIADB_ROOT_PASSWORD="other")
        with self.fake_agent(lambda path: env if path == "passwords.env" else {}):
            self.assertEqual(aikeys.read_keys(), KEYS)

    def test_missing_file(self):
        def missing(path):
            raise FileNotFoundError(path)

        with self.fake_agent(missing):
            self.assertEqual(aikeys.read_passwords(), {})
            self.assertFalse(any(aikeys.read_keys().values()))

    def test_keys_from_shared_passwords(self):
        self.assertEqual(aikeys.read_keys(lambda: dict(KEYS, OTHER="x")), KEYS)


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.server.authorizations.append(self.headers.get("Authorization"))
        if self.path == "/redirect":
            self.send_response(302)
            self.send_header("Location", "/ok")
        else:
            self.send_response({"/ok": 200, "/denied": 401}[self.path])
        self.send_header("Content-Length", "2")
        self.end_headers()
        self.wfile.write(b"{}")

    def log_message(self, *args):
        pass


class HttpStatusTest(unittest.TestCase):
    """http_status against a local server: no Internet access needed."""

    def setUp(self):
        self.server = http.server.HTTPServer(("127.0.0.1", 0), Handler)
        self.server.authorizations = []
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.base = "http://127.0.0.1:%d" % self.server.server_port

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()

    def test_status_and_header(self):
        self.assertEqual(aikeys.http_status(self.base + "/ok", "Token abc"), 200)
        self.assertEqual(self.server.authorizations, ["Token abc"])

    def test_error_status_is_returned(self):
        self.assertEqual(aikeys.http_status(self.base + "/denied", "Token abc"), 401)

    def test_redirect_is_not_followed(self):
        self.assertEqual(aikeys.http_status(self.base + "/redirect", "Token abc"), 302)
        self.assertEqual(self.server.authorizations, ["Token abc"])

    def test_name_resolution_timeout_raises_oserror(self):
        def hung(*args, **kwargs):
            time.sleep(5)

        started = time.monotonic()
        with self.assertRaises(OSError):
            aikeys.resolve("api.example.com", 0.2, hung)
        self.assertLess(time.monotonic() - started, 2)

    def test_name_resolution_error_raises_oserror(self):
        def missing(*args, **kwargs):
            raise socket.gaierror("Name or service not known")

        with self.assertRaises(OSError) as ctx:
            aikeys.resolve("api.example.com", 1, missing)
        self.assertIn("not known", str(ctx.exception))

    def test_name_is_resolved_before_the_request(self):
        resolved = []
        with self.assertRaises(OSError):
            aikeys.http_status("https://api.example.com/v1/models", "Bearer abc", resolved.append)
        self.assertEqual(resolved, ["api.example.com"])

    def test_no_answer_raises_oserror(self):
        port = self.server.server_port
        self.tearDown()
        with self.assertRaises(OSError):
            aikeys.http_status("http://127.0.0.1:%d/ok" % port, "Token abc")
        self.setUp()


if __name__ == "__main__":
    unittest.main()
