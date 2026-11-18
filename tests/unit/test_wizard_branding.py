import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ENTRYPOINT = ROOT / "freepbx/entrypoint.sh"


class WizardBrandingTest(unittest.TestCase):
    def render(self, values):
        source = ENTRYPOINT.read_text()
        section = source[source.index('wizard_brand_name='):source.index('cat > /var/www/html/freepbx/rest/config.inc.php')]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "scripts").mkdir()
            section = section.replace('/var/www/html/freepbx/wizard/', directory + '/')
            env = {k: v for k, v in os.environ.items() if not k.startswith(('WIZARD_', 'BRAND_', 'LOGIN_', 'FAVICON_', 'NAVBAR_', 'NETHVOICE'))}
            env.update(values)
            env['NETHVOICESECRETKEY'] = 'synthetic-private-auth-canary'
            result = subprocess.run(['bash', '-eu', '-c', section], env=env, capture_output=True)
            self.assertEqual(result.returncode, 0, 'branding generation failed')
            public = (root / "branding.json").read_text()
            self.assertNotIn('synthetic-private-auth-canary', public)
            data = json.loads(public)
            self.assertEqual(set(data), {'BRAND_NAME', 'NAVBAR_LOGO_URL'})
            return data

    def test_uses_wizard_overrides_and_never_cti_navbar_logo(self):
        self.assertEqual(self.render({
            'WIZARD_BRAND_NAME': 'Example Voice',
            'WIZARD_LOGIN_LOGO_URL': 'https://example.test/wizard.svg',
            'BRAND_NAME': 'Legacy Voice',
            'LOGIN_LOGO_URL': 'https://example.test/legacy.svg',
            'NAVBAR_LOGO_URL': 'https://example.test/cti.svg',
        }), {'BRAND_NAME': 'Example Voice', 'NAVBAR_LOGO_URL': 'https://example.test/wizard.svg'})

    def test_legacy_fallback_and_fresh_defaults(self):
        self.assertEqual(self.render({'BRAND_NAME': 'Legacy Voice', 'LOGIN_LOGO_URL': 'images/legacy.svg'}),
                         {'BRAND_NAME': 'Legacy Voice', 'NAVBAR_LOGO_URL': 'images/legacy.svg'})
        self.assertEqual(self.render({}), {'BRAND_NAME': 'NethVoice', 'NAVBAR_LOGO_URL': ''})

    def test_empty_wizard_overrides_do_not_restore_legacy_branding(self):
        self.assertEqual(self.render({'WIZARD_BRAND_NAME': '', 'WIZARD_LOGIN_LOGO_URL': '',
                                      'BRAND_NAME': 'Legacy Voice', 'LOGIN_LOGO_URL': 'images/legacy.svg'}),
                         {'BRAND_NAME': '', 'NAVBAR_LOGO_URL': ''})

    def test_serializes_operator_strings_as_data(self):
        values = {'WIZARD_BRAND_NAME': 'Example "Voice" </script> & partners',
                  'WIZARD_LOGIN_LOGO_URL': 'https://example.test/logo.svg?label="Voice"&color=green'}
        self.assertEqual(self.render(values), {'BRAND_NAME': values['WIZARD_BRAND_NAME'],
                                               'NAVBAR_LOGO_URL': values['WIZARD_LOGIN_LOGO_URL']})
