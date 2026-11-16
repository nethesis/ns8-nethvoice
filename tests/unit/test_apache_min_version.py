# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
import os
from pathlib import Path
import re
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class ApacheMinimumVersionTest(unittest.TestCase):
    def test_installed_version_must_meet_minimum(self):
        with tempfile.TemporaryDirectory() as directory:
            query = Path(directory) / "dpkg-query"
            query.write_text('#!/bin/sh\nprintf "%s" "$INSTALLED_VERSION"\n')
            query.chmod(0o755)
            for image in ("freepbx", "tancredi", "saml2-proxy"):
                content = (ROOT / image / "Containerfile").read_text()
                minimum = re.search(r"^ARG APACHE_MIN_VERSION=(\S+)", content, re.M)[1]
                check = re.search(
                    r'dpkg --compare-versions .*? ge "\$\{APACHE_MIN_VERSION\}"',
                    content,
                )[0]
                for installed, succeeds in (
                    (minimum, True),
                    (minimum + "+test", True),
                    (minimum + "~test", False),
                    ("", False),
                ):
                    with self.subTest(image=image, installed=installed):
                        result = subprocess.run(
                            ["sh", "-c", check],
                            env=dict(
                                os.environ,
                                PATH=directory + os.pathsep + os.environ["PATH"],
                                APACHE_MIN_VERSION=minimum,
                                INSTALLED_VERSION=installed,
                            ),
                            capture_output=True,
                            text=True,
                            timeout=5,
                        )
                        self.assertEqual(result.returncode == 0, succeeds, result.stderr)


if __name__ == "__main__":
    unittest.main()
