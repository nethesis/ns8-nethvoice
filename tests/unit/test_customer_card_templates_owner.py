# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
TEMPLATES = '/var/lib/nethserver/nethcti/templates/customer_card'


class CustomerCardTemplatesOwnerTest(unittest.TestCase):
    def test_image_copies_the_templates_as_the_web_server_user(self):
        containerfile = (ROOT / 'nethcti-server/Containerfile').read_text()
        self.assertIn(f'COPY --chown=asterisk:asterisk root{TEMPLATES} {TEMPLATES}', containerfile)
        self.assertLess(containerfile.index('adduser -u 990'), containerfile.index(f'root{TEMPLATES}'))

    def test_startup_gives_existing_templates_to_the_web_server_user(self):
        lines = [line for line in (ROOT / 'freepbx/entrypoint.sh').read_text().splitlines()
                 if line.startswith('find ') and TEMPLATES in line]
        self.assertEqual(len(lines), 1)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            templates = root / 'templates'
            (templates / 'old').mkdir(parents=True)
            for name in ['table.ejs', 'statistics.ejs', 'crm_custom.ejs', 'notes.txt', 'old/identity.ejs']:
                (templates / name).write_text('<p></p>')
            calls = root / 'calls'
            stub = root / 'bin'
            stub.mkdir()
            (stub / 'chown').write_text(f'#!/bin/sh\necho "$@" >> "{calls}"\n')
            (stub / 'chown').chmod(0o755)
            script = lines[0].replace(TEMPLATES, str(templates)).replace('! -user asterisk', '! -user 2147483646')
            result = subprocess.run(['bash', '-c', script], env=dict(os.environ, PATH=f'{stub}:{os.environ["PATH"]}'),
                                    capture_output=True, text=True, timeout=5)
            self.assertEqual(result.returncode, 0, result.stderr)
            arguments = calls.read_text().split()
            self.assertEqual(arguments[0], 'asterisk:asterisk')
            self.assertEqual(sorted(Path(path).name for path in arguments[1:]),
                             ['crm_custom.ejs', 'statistics.ejs', 'table.ejs'])


if __name__ == '__main__':
    unittest.main()
