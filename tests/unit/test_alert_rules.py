#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

import shutil
import subprocess
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
RULES_DIR = REPO_ROOT / "imageroot" / "etc" / "metrics" / "alert-rules"
RULE_TESTS_DIR = REPO_ROOT / "tests" / "rules"
# Same Prometheus version as the metrics module
PROMETHEUS_IMAGE = "docker.io/prom/prometheus:v3.13.4"


def promtool(*arguments):
    return subprocess.run(
        [
            "podman", "run", "--rm", "--network=none",
            f"--volume={REPO_ROOT}:/src:ro,Z", "--workdir=/src",
            "--entrypoint=/bin/promtool", PROMETHEUS_IMAGE, *arguments,
        ],
        capture_output=True,
        text=True,
        check=False,
    )


@unittest.skipIf(shutil.which("podman") is None, "podman is required to run promtool")
class AlertRulesTest(unittest.TestCase):
    def test_rule_files_are_valid(self):
        files = [str(p.relative_to(REPO_ROOT)) for p in sorted(RULES_DIR.glob("*.yml"))]
        result = promtool("check", "rules", *files)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_rule_unit_tests(self):
        files = [str(p.relative_to(REPO_ROOT)) for p in sorted(RULE_TESTS_DIR.glob("*_test.yml"))]
        result = promtool("test", "rules", *files)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
