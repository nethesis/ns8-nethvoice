# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class FreepbxEntrypointTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.link = self.root / 'asterisk/extensions.conf'
        self.link.parent.mkdir()
        self.target = self.root / 'core/extensions.conf'
        self.target.parent.mkdir()
        self.target.write_text('[from-internal]\n')
        self.started = self.root / 'started'
        # Run the real startup checks before any container configuration writes.
        script = (ROOT / 'freepbx/entrypoint.sh').read_text().split('# Configure asterisk manager', 1)[0]
        script = script.replace('/etc/asterisk/extensions.conf', str(self.link))
        script = script.replace('/var/www/html/freepbx/admin/modules/core/etc/extensions.conf', str(self.target))
        script = script.replace('/var/run/nethvoice/', str(self.root / 'runtime') + '/')
        self.script = self.root / 'entrypoint.sh'
        self.script.write_text(script + f'\ntouch "{self.started}"\n')

    def run_startup(self, **environment):
        return subprocess.run(['bash', str(self.script)],
                              env=dict(os.environ, **environment),
                              capture_output=True, text=True, timeout=5)

    def test_repairs_wrong_links_before_startup_and_is_idempotent(self):
        for target in [str(self.target).lstrip('/'), '/obsolete/extensions.conf']:
            with self.subTest(target=target):
                self.link.unlink(missing_ok=True)
                self.link.symlink_to(target)
                result = self.run_startup()
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(os.readlink(self.link), str(self.target))
                self.assertEqual(self.link.read_text(), '[from-internal]\n')
                self.assertTrue(self.started.exists())
                inode = self.link.lstat().st_ino
                self.assertEqual(self.run_startup().returncode, 0)
                self.assertEqual(self.link.lstat().st_ino, inode)

    def test_preserves_correct_link(self):
        self.link.symlink_to(self.target)
        inode = self.link.lstat().st_ino
        self.assertEqual(self.run_startup().returncode, 0)
        self.assertEqual(self.link.lstat().st_ino, inode)

    def test_preserves_regular_dialplan_and_custom_files(self):
        self.link.write_text('[custom-dialplan]\n')
        custom = self.link.parent / 'extensions_custom.conf'
        custom.write_text('[custom-context]\n')
        self.assertEqual(self.run_startup().returncode, 0)
        self.assertFalse(self.link.is_symlink())
        self.assertEqual(self.link.read_text(), '[custom-dialplan]\n')
        self.assertEqual(custom.read_text(), '[custom-context]\n')

    def test_leaves_missing_link_unchanged(self):
        self.assertEqual(self.run_startup().returncode, 0)
        self.assertFalse(self.link.exists())

    def test_failed_repair_stops_startup(self):
        self.link.symlink_to('/obsolete/extensions.conf')
        stub = self.root / 'ln'
        stub.write_text('#!/bin/sh\nexit 17\n')
        stub.chmod(0o755)
        result = self.run_startup(PATH=str(self.root) + ':' + os.environ['PATH'])
        self.assertEqual(result.returncode, 17)
        self.assertFalse(self.started.exists())


if __name__ == '__main__':
    unittest.main()
