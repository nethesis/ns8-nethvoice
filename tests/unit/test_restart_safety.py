# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class RestartSafetyTest(unittest.TestCase):
    def run_helper(self, output, status=0, second_output=None):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            (path / "podman").write_text(
                '#!/bin/sh\nif [ -f "$QUERY_MARKER" ] && [ -f "$SECOND_OUTPUT" ]; then\n'
                'cat "$SECOND_OUTPUT"; exit 0\nfi\ntouch "$QUERY_MARKER"\n'
                'cat "$CALL_OUTPUT"\nexit "$CALL_STATUS"\n')
            (path / "systemctl").write_text('#!/bin/sh\nprintf "%s\\n" "$@" > "$RESTART_LOG"\n')
            for name in ("podman", "systemctl"):
                (path / name).chmod(0o755)
            (path / "output").write_text(output)
            if second_output is not None:
                (path / "second-output").write_text(second_output)
            env = dict(os.environ, PATH=f"{path}:{os.environ['PATH']}",
                       CALL_OUTPUT=str(path / "output"), CALL_STATUS=str(status),
                       RESTART_LOG=str(path / "restart"), QUERY_MARKER=str(path / "queried"),
                       SECOND_OUTPUT=str(path / "second-output"),
                       NETHVOICE_RESTART_TIMEOUT="3" if second_output is not None else "1")
            result = subprocess.run([str(ROOT / "imageroot/bin/restart-services-when-convenient"),
                                     "freepbx", "tancredi"], env=env, capture_output=True, text=True, timeout=5)
            log = (path / "restart").read_text() if (path / "restart").exists() else ""
            return result, log

    def test_valid_zero_calls_preserves_conditional_restart(self):
        result, log = self.run_helper("0 active channels\n0 active calls\n1 call processed\n")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(log.splitlines(), ["--user", "try-restart", "freepbx", "tancredi"])
        self.assertEqual(result.stdout, "")

    def test_waits_for_active_calls_to_end(self):
        result, log = self.run_helper("1 active call\n", second_output="0 active calls\n")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("try-restart", log)

    def test_unknown_query_must_be_followed_by_verified_zero(self):
        result, log = self.run_helper("0 active calls\n", status=1, second_output="0 active calls\n")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("try-restart", log)

    def test_unknown_or_active_calls_never_restart_even_at_deadline(self):
        for output, status in (("1 active call\n", 0), ("23 active calls\n", 0),
                               ("", 0), ("garbage", 0), ("x active calls\n", 0),
                               ("0 active calls\n0 active calls\n", 0),
                               ("0 active calls\n", 1)):
            with self.subTest(output=output, status=status):
                result, log = self.run_helper(output, status)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(log, "")
                self.assertIn("Restart refused", result.stderr)
                self.assertEqual(result.stdout, "")


if __name__ == "__main__":
    unittest.main()
