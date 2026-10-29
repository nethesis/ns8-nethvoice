#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

import os
import select
import shlex
import shutil
import signal
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ENTRYPOINT = Path(__file__).resolve().parents[2] / "janus" / "entrypoint.sh"


class JanusEntrypointTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        # Skip container-only configuration edits, but run the real output filter.
        sed = Path(self.directory.name) / "sed"
        sed.write_text(
            '#!/bin/bash\n'
            'if [[ "$1" == "-u" ]]; then\n'
            f'    exec {shlex.quote(shutil.which("sed"))} "$@"\n'
            'fi\n'
        )
        sed.chmod(0o755)
        self.environment = dict(os.environ, LOCAL_IP="")
        self.environment["PATH"] = self.directory.name + os.pathsep + os.environ["PATH"]

    def start(self, code):
        return subprocess.Popen(
            ["bash", str(ENTRYPOINT), sys.executable, "-u", "-c", code],
            env=self.environment,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

    def test_tags_stdout_stderr_and_multiline_output_without_duplicate_prefix(self):
        process = self.start(
            'import sys\n'
            'print("startup\\nsecond line")\n'
            'print("[janus] warning")\n'
            'print("library error", file=sys.stderr)\n'
            'sys.stdout.write("last partial line")\n'
            'sys.exit(7)\n'
        )
        output, errors = process.communicate(timeout=5)
        self.assertEqual(process.returncode, 7)
        self.assertEqual(errors, b"")
        self.assertEqual(
            output,
            b"[janus] startup\n[janus] second line\n[janus] warning\n"
            b"[janus] library error\n[janus] last partial line",
        )

    def test_command_receives_sigterm_directly(self):
        process = self.start(
            'import os, signal\n'
            'print(os.getpid())\n'
            'signal.pause()\n'
        )
        try:
            ready, _, _ = select.select([process.stdout], [], [], 5)
            self.assertTrue(ready, "Output filter did not flush the startup line")
            self.assertEqual(
                process.stdout.readline(), f"[janus] {process.pid}\n".encode()
            )
            process.terminate()
            _, errors = process.communicate(timeout=5)
            self.assertEqual(process.returncode, -signal.SIGTERM)
            self.assertEqual(errors, b"")
        finally:
            if process.poll() is None:
                process.kill()
                process.communicate(timeout=5)


if __name__ == "__main__":
    unittest.main()
