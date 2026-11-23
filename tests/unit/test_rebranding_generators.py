#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NAME = 'L\'Azienda "Voce" \\ </script>'
URL = 'https://cdn.example.org/logo.svg?v=1&x=2'

EVALUATE = '''
const fs = require('fs')
const window = { location: { hostname: 'pbx.example.org', port: '', pathname: '/', protocol: 'https:' } }
eval(fs.readFileSync(process.argv[1], 'utf8'))
console.log(JSON.stringify(typeof customConfig === 'undefined' ? window.CONFIG : customConfig))
'''


def clean_environment(**environment):
    keep = {key: value for key, value in os.environ.items()
            if key in ('PATH', 'HOME', 'LANG', 'LC_ALL', 'TMPDIR')}
    return dict(keep, **environment)


@unittest.skipUnless(shutil.which('node'), 'node is required to evaluate the generated scripts')
class GeneratorTest(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.dir = Path(directory.name)

    def run_script(self, shell, script, **environment):
        result = subprocess.run([shell, '-c', script], env=clean_environment(**environment),
                                capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)
        return result

    def evaluate(self, path):
        result = subprocess.run(['node', '-e', EVALUATE, str(path)], capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)


class CtiEntrypointTest(GeneratorTest):
    def render(self, **environment):
        (self.dir / 'public' / 'config').mkdir(parents=True)
        wget = self.dir / 'wget'
        wget.write_text('#!/bin/sh\nprintf "%s\\n" "$@" >> "$(dirname "$0")/wget.log"\n')
        wget.chmod(0o755)
        script = (ROOT / 'nethvoice-cti/entrypoint.sh').read_text()
        script = script.replace('/app/public', str(self.dir / 'public')).replace('/usr/bin/wget', str(wget))
        self.run_script('sh', script, **environment)
        return self.evaluate(self.dir / 'public' / 'config' / 'config.production.js')

    def test_defaults_are_unchanged(self):
        config = self.render()
        self.assertEqual((config['BRAND_NAME'], config['PRODUCT_NAME'], config['COMPANY_NAME'],
                          config['COMPANY_SUBNAME'], config['COMPANY_URL'], config['LOGIN_PEOPLE']),
                         ('NethVoice', 'NethVoice CTI', 'Nethesis', 'CTI', 'https://www.nethesis.it/', 'show'))
        self.assertEqual(config['NAVBAR_LOGO_URL'], '')
        self.assertFalse((self.dir / 'wget.log').exists())

    def test_normal_values_are_written_as_before(self):
        self.render(BRAND_NAME='Acme', PRODUCT_NAME='Acme CTI', NAVBAR_LOGO_URL=URL)
        text = (self.dir / 'public' / 'config' / 'config.production.js').read_text()
        self.assertIn("  BRAND_NAME: 'Acme',\n", text)
        self.assertIn("  PRODUCT_NAME: 'Acme CTI',\n", text)
        self.assertIn(f"  NAVBAR_LOGO_URL: '{URL}',\n", text)

    def test_quotes_and_backslashes_are_escaped(self):
        config = self.render(BRAND_NAME=NAME, PRODUCT_NAME=NAME, COMPANY_NAME=NAME, COMPANY_URL=NAME,
                             LOGIN_PEOPLE=NAME, FAVICON_URL=NAME, NAVBAR_LOGO_URL=NAME, NAVBAR_LOGO_DARK_URL=NAME)
        for key in ('BRAND_NAME', 'PRODUCT_NAME', 'COMPANY_NAME', 'COMPANY_URL', 'LOGIN_PEOPLE', 'FAVICON_URL',
                    'NAVBAR_LOGO_URL', 'NAVBAR_LOGO_DARK_URL'):
            with self.subTest(key=key):
                self.assertEqual(config[key], NAME)

    def test_image_urls_are_passed_to_wget_as_one_argument(self):
        url = 'https://cdn.example.org/my logo.svg?a=1&b=2'
        self.render(NAVBAR_LOGO_URL=url, LOGIN_LOGO_DARK_URL=url, LOGIN_BACKGROUND_URL=url)
        arguments = (self.dir / 'wget.log').read_text().splitlines()
        self.assertEqual(arguments.count(url), 3)
        self.assertEqual(len(arguments), 12)


class ReportsConfigTest(GeneratorTest):
    def render(self, **environment):
        script = (ROOT / 'reports/ui/config-gen.sh').read_text()
        script = script.replace('/var/www/html/pbx-report', str(self.dir))
        self.run_script('sh', script, **environment)
        return self.evaluate(self.dir / 'config' / 'config.production.js')

    def test_defaults_are_unchanged(self):
        config = self.render(NETHVOICE_HOST='voice.example.org')
        self.assertEqual((config['APP_NAME'], config['BRAND_NAME'], config['LOGIN_LOGO_URL']),
                         ('NethVoice Reports', 'NethVoice Reports', ''))
        self.assertEqual(config['API_ENDPOINT'], 'voice.example.org/pbx-report-api')

    def test_normal_values_are_written_as_before(self):
        self.render(REPORTS_UI_APP_NAME='Acme Reports', REPORTS_UI_LOGIN_LOGO_URL=URL)
        text = (self.dir / 'config' / 'config.production.js').read_text()
        self.assertIn('  APP_NAME: "Acme Reports",\n', text)
        self.assertIn(f'  LOGIN_LOGO_URL: "{URL}",\n', text)

    def test_quotes_and_backslashes_are_escaped(self):
        keys = ('APP_NAME', 'BRAND_NAME', 'HELP_URL', 'COMPANY_NAME', 'LOGIN_LOGO_URL', 'FAVICON_URL',
                'LOGIN_BACKGROUND_URL', 'LOGIN_BACKGROUND_COLOR')
        config = self.render(**{f'REPORTS_UI_{key}': NAME for key in keys})
        for key in keys:
            with self.subTest(key=key):
                self.assertEqual(config[key], NAME)


@unittest.skipUnless(shutil.which('php'), 'php is required to render the wizard configuration')
class LegacyWizardConfigTest(GeneratorTest):
    def render(self, **environment):
        entrypoint = (ROOT / 'freepbx/entrypoint.sh').read_text()
        start = entrypoint.index('wizard_brand_name="${WIZARD_BRAND_NAME-}"')
        end = entrypoint.index('cat > /var/www/html/freepbx/rest/config.inc.php')
        shutil.copy(ROOT / 'freepbx/nethvoice-ui/index.html', self.dir / 'index.html')
        (self.dir / 'wizard' / 'scripts').mkdir(parents=True)
        script = (entrypoint[start:end]
                  .replace('/var/www/html/freepbx/nethvoice-ui', str(self.dir))
                  .replace('/var/www/html/freepbx/wizard', str(self.dir / 'wizard')))
        self.run_script('bash', script, NETHVOICESECRETKEY='wizard-secret', **environment)
        return self.evaluate(self.dir / 'wizard' / 'scripts' / 'custom.js')

    def test_defaults_are_unchanged(self):
        config = self.render()
        self.assertEqual(config['BRAND_NAME'], 'NethVoice')
        for key in ('NAVBAR_LOGO_URL', 'LOGIN_LOGO_URL', 'FAVICON_URL', 'LOGIN_BACKGROUND_URL'):
            self.assertEqual(config[key], '')

    def test_urls_render_the_same_value(self):
        config = self.render(WIZARD_LOGIN_LOGO_URL=URL, WIZARD_FAVICON_URL=URL, WIZARD_LOGIN_BACKGROUND_URL=URL)
        for key in ('NAVBAR_LOGO_URL', 'LOGIN_LOGO_URL', 'FAVICON_URL', 'LOGIN_BACKGROUND_URL'):
            with self.subTest(key=key):
                self.assertEqual(config[key], URL)

    def test_quotes_in_urls_are_escaped(self):
        config = self.render(WIZARD_BRAND_NAME=NAME, WIZARD_LOGIN_LOGO_URL=NAME, WIZARD_FAVICON_URL=NAME,
                             WIZARD_LOGIN_BACKGROUND_URL=NAME)
        for key in ('BRAND_NAME', 'NAVBAR_LOGO_URL', 'LOGIN_LOGO_URL', 'FAVICON_URL', 'LOGIN_BACKGROUND_URL'):
            with self.subTest(key=key):
                self.assertEqual(config[key], NAME)
        self.assertEqual(config['SECRET_KEY'], 'wizard-secret')


if __name__ == '__main__':
    unittest.main()
