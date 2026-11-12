# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
ENTRYPOINT = (ROOT / 'freepbx/entrypoint.sh').read_text()
VHOST = (ROOT / 'freepbx/etc/apache2/sites-enabled/000-default.conf').read_text()
CONTAINERFILE = (ROOT / 'freepbx/Containerfile').read_text()
UI_ROOT = '/var/www/html/freepbx/nethvoice-ui'


def wizard_alias_pattern():
    block = ENTRYPOINT.split('cat > /etc/apache2/sites-available/wizard.conf <<EOF\n', 1)[1].split('\nEOF', 1)[0]
    rendered = subprocess.run(['bash', '-c', f'cat <<EOF\n{block}\nEOF'],
                              capture_output=True, text=True, check=True).stdout.strip()
    directive, pattern, target = rendered.split(' ')
    assert directive == 'AliasMatch'
    return re.compile(pattern), target


class LegacyWizardAliasTest(unittest.TestCase):
    def setUp(self):
        self.pattern, self.target = wizard_alias_pattern()

    def test_legacy_wizard_keeps_its_paths(self):
        for path in ['/index.html', '/scripts/custom.js', '/images/brand.svg', '/nethvoicex/app.js']:
            with self.subTest(path=path):
                self.assertIsNotNone(self.pattern.match(path))
        self.assertEqual(self.target, '/var/www/html/freepbx/wizard/$1')

    def test_new_ui_and_freepbx_paths_are_left_to_their_own_rules(self):
        for path in ['/nethvoice', '/nethvoice/', '/nethvoice/users/groups', '/nethvoice/assets/index.js',
                     '/freepbx/rest/users', '/freepbx/admin/config.php']:
            with self.subTest(path=path):
                self.assertIsNone(self.pattern.match(path))


class NewUiVirtualHostTest(unittest.TestCase):
    def test_bare_path_redirects_to_the_application(self):
        block = VHOST.split('<LocationMatch "^/nethvoice$">', 1)[1].split('</LocationMatch>', 1)[0]
        self.assertIn('%{HTTP:X-Forwarded-Host}/nethvoice/', block)

    def test_application_is_aliased_with_history_fallback(self):
        self.assertIn(f'Alias /nethvoice {UI_ROOT}', VHOST)
        directory = VHOST.split(f'<Directory {UI_ROOT}>', 1)[1].split('</Directory>', 1)[0]
        self.assertIn('FallbackResource /nethvoice/index.html', directory)
        self.assertIn('Options -Indexes', directory)

    def test_entry_point_and_runtime_config_are_revalidated(self):
        directory = VHOST.split(f'<Directory {UI_ROOT}>', 1)[1].split('</Directory>', 1)[0]
        files = directory.split('<FilesMatch "', 1)[1].split('">', 1)[0]
        self.assertIsNotNone(re.match(files, 'index.html'))
        self.assertIsNotNone(re.match(files, 'config.json'))
        self.assertIsNone(re.match(files, 'index-abc123.js'))
        self.assertIn('Cache-Control "no-cache"', directory)


class NewUiImageTest(unittest.TestCase):
    def test_bundle_is_built_from_the_lockfile_and_copied_where_apache_serves_it(self):
        self.assertIn('AS nethvoice-ui-builder', CONTAINERFILE)
        self.assertIn('npm ci', CONTAINERFILE.split('AS nethvoice-ui-builder', 1)[1].split('\nFROM ', 1)[0])
        self.assertIn(f'COPY --from=nethvoice-ui-builder --chown=asterisk:asterisk /build/nethvoice-ui/dist {UI_ROOT}',
                      CONTAINERFILE)

    def test_base_path_matches_the_alias(self):
        vite_config = (ROOT / 'freepbx/nethvoice-ui/vite.config.ts').read_text()
        self.assertIn("const BASE = '/nethvoice/'", vite_config)


@unittest.skipUnless(shutil.which('php'), 'php is required to render the runtime configuration')
class RuntimeConfigTest(unittest.TestCase):
    def render(self, **environment):
        start = ENTRYPOINT.index('wizard_brand_name="${WIZARD_BRAND_NAME-}"')
        end = ENTRYPOINT.index('# Write wizard and restapi configuration')
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        output = Path(directory.name) / 'config.json'
        script = ENTRYPOINT[start:end].replace(f'{UI_ROOT}/config.json', str(output))
        clean = {key: value for key, value in os.environ.items()
                 if not key.startswith(('WIZARD_', 'BRAND_')) and not key.endswith('_URL')}
        result = subprocess.run(['bash', '-euo', 'pipefail', '-c', script],
                                env=dict(clean, NETHVOICESECRETKEY='do-not-leak', **environment),
                                capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)
        return output.read_text()

    def test_defaults(self):
        config = json.loads(self.render())
        self.assertEqual(config['BRAND_NAME'], 'NethVoice')
        self.assertEqual(config['NAVBAR_LOGO_URL'], '')
        self.assertTrue(config['BRAND_DOCS'].startswith('https://'))
        self.assertEqual(sorted(config), ['BRAND_DOCS', 'BRAND_NAME', 'BRAND_SITE', 'FAVICON_URL',
                                          'LOGIN_BACKGROUND_URL', 'LOGIN_LOGO_URL', 'NAVBAR_LOGO_URL'])

    def test_rebranding_values_are_json_encoded(self):
        name = 'Acme "Voice" </script><b>'
        config = json.loads(self.render(WIZARD_BRAND_NAME=name,
                                        WIZARD_LOGIN_LOGO_URL='https://cdn.example.org/logo.svg',
                                        FAVICON_URL='https://cdn.example.org/favicon.ico'))
        self.assertEqual(config['BRAND_NAME'], name)
        self.assertEqual(config['LOGIN_LOGO_URL'], 'https://cdn.example.org/logo.svg')
        self.assertEqual(config['NAVBAR_LOGO_URL'], 'https://cdn.example.org/logo.svg')
        self.assertEqual(config['FAVICON_URL'], 'https://cdn.example.org/favicon.ico')

    def test_shared_secret_is_never_published(self):
        self.assertNotIn('do-not-leak', self.render())


if __name__ == '__main__':
    unittest.main()
