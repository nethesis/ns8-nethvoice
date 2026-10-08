"""Check runtime selection before image builds without contacting a registry."""

import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
PINNED_IMAGE = "ghcr.io/nethesis/satellite@sha256:" + "a" * 64


class BuildImagesTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        shutil.copyfile(ROOT / "build-images.sh", self.root / "build-images.sh")
        for name in ("satellite", "reports", "janus", "bin"):
            (self.root / name).mkdir()
        self.pin = self.root / "satellite/runtime-image.txt"
        self.pin.write_text(PINNED_IMAGE + "\n")
        self.calls = self.root / "buildah-calls.txt"
        buildah = self.root / "bin/buildah"
        buildah.write_text(
            '#!/bin/bash\nprintf "%s\\n" "$*" >> "$BUILD_TEST_CALLS"\n'
            'if [[ "$1" == from ]]; then echo test-container; fi\n'
        )
        buildah.chmod(0o755)

    def build(self, images="satellite", runtime=None):
        env = os.environ.copy()
        for name in ("SATELLITE_RUNTIME_IMAGE", "CI", "GITHUB_OUTPUT", "GITHUB_STEP_SUMMARY"):
            env.pop(name, None)
        env.update(
            BUILD_IMAGES=images,
            PATH=str(self.root / "bin") + os.pathsep + env["PATH"],
            BUILD_TEST_CALLS=str(self.calls),
            BUILD_TIMING_FILE=str(self.root / "timings.tsv"),
        )
        if runtime is not None:
            env["SATELLITE_RUNTIME_IMAGE"] = runtime
        return subprocess.run(
            ["bash", "build-images.sh"], cwd=self.root, env=env,
            capture_output=True, text=True, timeout=10,
        )

    def test_default_build_uses_committed_digest(self):
        result = self.build()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("from " + PINNED_IMAGE, self.calls.read_text())

    def test_explicit_digest_overrides_committed_digest(self):
        image = "ghcr.io/nethesis/satellite@sha256:" + "b" * 64
        result = self.build(runtime=image)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("from " + image, self.calls.read_text())
        self.assertNotIn(PINNED_IMAGE, self.calls.read_text())

    def test_mutable_or_invalid_override_fails_before_any_build(self):
        for image in ("ghcr.io/nethesis/satellite:agent", "ghcr.io/nethesis/satellite@sha256:123"):
            with self.subTest(image=image):
                result = self.build(images="mariadb,satellite", runtime=image)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("immutable Satellite digest", result.stderr)
                self.assertFalse(self.calls.exists())

    def test_missing_pin_fails_before_any_build(self):
        self.pin.unlink()
        result = self.build(images="mariadb,satellite")
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.calls.exists())

    def test_unrelated_build_does_not_require_runtime_pin(self):
        self.pin.unlink()
        result = self.build(images="janus")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("build ", self.calls.read_text())
        self.assertNotIn("from ", self.calls.read_text())


if __name__ == "__main__":
    unittest.main()
