"""Check the release gate without invoking containers or network access."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class MatrixBuildTests(unittest.TestCase):
    def check(self, images, **inputs):
        env = dict(os.environ)
        for name in ('NETHCTI_MIDDLEWARE_SOURCE', 'NETHCTI_MIDDLEWARE_BASE_IMAGE',
                     'MATRIX2ACROBITS_SOURCE', 'MATRIX2ACROBITS_BASE_IMAGE'):
            env.pop(name, None)
        env.update(BUILD_IMAGES=images, **inputs)
        return subprocess.run(['bash', 'build-images.sh', '--check-dependencies'],
                              cwd=ROOT, env=env, capture_output=True, text=True)

    def test_module_rejects_obsolete_implicit_dependencies(self):
        result = self.check('nethvoice')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('nethcti-middleware is not released', result.stderr)
        result = self.check('nethvoice', NETHCTI_MIDDLEWARE_BASE_IMAGE='localhost/mw:qa')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('matrix2acrobits is not released', result.stderr)

    def test_explicit_local_images_allow_offline_development(self):
        result = self.check('nethvoice', NETHCTI_MIDDLEWARE_BASE_IMAGE='localhost/mw:qa',
                            MATRIX2ACROBITS_BASE_IMAGE='localhost/m2a:qa')
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_independent_builds_do_not_require_unselected_sources(self):
        for image in ('matrix-synapse', 'freepbx', 'cti-ui'):
            result = self.check(image)
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_source_checkout_must_exist_and_be_committed(self):
        with tempfile.TemporaryDirectory() as temporary:
            result = self.check('matrix2acrobits', MATRIX2ACROBITS_SOURCE=temporary)
            self.assertNotEqual(result.returncode, 0)
            (Path(temporary) / 'Containerfile').write_text('FROM scratch\n')
            result = self.check('matrix2acrobits', MATRIX2ACROBITS_SOURCE=temporary)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('clean committed checkout', result.stderr)


if __name__ == '__main__':
    unittest.main()
