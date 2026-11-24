#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

import io
import json
import os
import types
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock

from event_test_utils import load_script

ACTIONS = Path(__file__).resolve().parents[2] / 'imageroot' / 'actions'
SUBSCRIPTION = {'provider': 'nsent', 'system_id': 'NETH-0000-1111-2222', 'auth_token': 'my_public.secret',
                'collect_url': 'https://collect.example.org/collect/api/systems'}
REQUEST = {
    'rebranding_brand_name': "L'Azienda \"Voce\"",
    'rebranding_login_people': 'hide',
    'rebranding_navbar_logo_url': '',
    'rebranding_navbar_logo_dark_url': '',
    'rebranding_login_logo_url': 'https://cdn.example.org/logo.svg',
    'rebranding_login_logo_dark_url': '',
    'rebranding_favicon_url': '',
    'rebranding_login_background_url': '',
    'rebranding_wizard_login_logo_url': 'https://cdn.example.org/logo-dark-background.svg',
    'rebranding_wizard_logo_light_url': 'https://cdn.example.org/logo-light-background.svg',
}


class FakeRedis:
    def hgetall(self, key):
        return dict(SUBSCRIPTION) if key == 'cluster/subscription' else {}


class FakeAgent(types.ModuleType):
    def __init__(self):
        super().__init__('agent')
        self.env = {}
        self.statuses = []
        self.helpers = []

    def redis_connect(self, privileged=False):
        return FakeRedis()

    def set_env(self, name, value):
        self.env[name] = value

    def set_status(self, status):
        self.statuses.append(status)

    def run_helper(self, *args):
        self.helpers.append(' '.join(args))
        return mock.Mock()


def fake_status(**status):
    module = types.ModuleType('rebranding_status')
    module.subscriptions = []

    def check(subscription):
        module.subscriptions.append(subscription)
        return dict({'active': False, 'cached': False, 'check_failed': False, 'checked_at': ''}, **status)

    module.check = check
    return module


def run_action(path, status, request=None, environment=None):
    agent = FakeAgent()
    helper = fake_status(**status)
    stdout = io.StringIO()
    exit_code = 0
    with mock.patch('sys.stdin', io.StringIO(json.dumps(request or {}))), \
            mock.patch.dict(os.environ, environment or {}), redirect_stdout(stdout):
        try:
            load_script(path.name, path, {'agent': agent, 'rebranding_status': helper})
        except SystemExit as error:
            exit_code = error.code
    return agent, helper, stdout.getvalue(), exit_code


class GetRebrandingTest(unittest.TestCase):
    path = ACTIONS / 'get-rebranding' / '10read'

    def test_reports_the_status_from_the_shared_check(self):
        _, helper, output, code = run_action(self.path, {'active': True, 'checked_at': '2026-11-20T09:00:00Z'})
        config = json.loads(output)

        self.assertEqual(code, 0)
        self.assertEqual(helper.subscriptions, [SUBSCRIPTION])
        self.assertIs(config['rebranding_active'], True)
        self.assertIs(config['rebranding_cached'], False)
        self.assertIs(config['rebranding_check_failed'], False)
        self.assertEqual(config['rebranding_checked_at'], '2026-11-20T09:00:00Z')

    def test_reports_a_cached_status(self):
        _, _, output, _ = run_action(self.path, {'active': True, 'cached': True, 'check_failed': True,
                                                 'checked_at': '2026-11-19T08:00:00Z'})
        config = json.loads(output)
        self.assertEqual((config['rebranding_active'], config['rebranding_cached'],
                          config['rebranding_check_failed']), (True, True, True))

    def test_reports_the_light_background_logo(self):
        _, _, output, _ = run_action(self.path, {'active': True},
                                     environment={'WIZARD_LOGO_LIGHT_URL': 'https://cdn.example.org/light.svg'})
        self.assertEqual(json.loads(output)['rebranding_wizard_logo_light_url'], 'https://cdn.example.org/light.svg')

    def test_output_matches_the_schema(self):
        import jsonschema
        schema = json.loads((ACTIONS / 'get-rebranding' / 'validate-output.json').read_text())
        _, _, output, _ = run_action(self.path, {'active': True})
        config = json.loads(output)
        jsonschema.validate(config, schema)
        self.assertEqual(sorted(set(config) - set(schema['properties'])), [])


class SetRebrandingTest(unittest.TestCase):
    path = ACTIONS / 'set-rebranding' / '10setenvs'

    def test_inactive_rebranding_fails_validation_without_writing(self):
        agent, _, output, code = run_action(self.path, {'active': False}, REQUEST)

        self.assertEqual(code, 2)
        self.assertEqual(agent.statuses, ['validation-failed'])
        self.assertEqual(json.loads(output), [{'field': 'rebranding_active', 'parameter': 'rebranding_active',
                                               'value': False, 'error': 'rebranding_not_active'}])
        self.assertEqual(agent.env, {})
        self.assertEqual(agent.helpers, [])

    def test_unverifiable_rebranding_fails_validation_with_its_own_error(self):
        agent, _, output, code = run_action(self.path, {'active': False, 'check_failed': True}, REQUEST)

        self.assertEqual(code, 2)
        self.assertEqual(json.loads(output)[0]['error'], 'rebranding_check_failed')
        self.assertEqual(agent.env, {})

    def test_cached_active_status_allows_saving(self):
        agent, _, _, code = run_action(self.path, {'active': True, 'cached': True, 'check_failed': True}, REQUEST)
        self.assertEqual(code, 0)
        self.assertEqual(agent.env['BRAND_NAME'], REQUEST['rebranding_brand_name'])

    def test_active_rebranding_writes_the_environment_and_restarts(self):
        agent, _, output, code = run_action(self.path, {'active': True}, REQUEST)

        self.assertEqual(code, 0)
        self.assertEqual(output, '')
        self.assertEqual(agent.statuses, [])
        self.assertEqual(agent.env['BRAND_NAME'], REQUEST['rebranding_brand_name'])
        self.assertEqual(agent.env['NETHCTI_UI_PRODUCT_NAME'], REQUEST['rebranding_brand_name'])
        self.assertEqual(agent.env['WIZARD_LOGIN_LOGO_URL'], 'https://cdn.example.org/logo-dark-background.svg')
        self.assertEqual(agent.env['WIZARD_LOGO_LIGHT_URL'], 'https://cdn.example.org/logo-light-background.svg')
        self.assertEqual(agent.helpers, ['systemctl --user try-restart nethcti-ui.service',
                                         'systemctl --user try-restart reports-ui.service',
                                         'systemctl --user try-restart freepbx.service'])

    def test_saving_the_values_read_restores_the_default_names(self):
        defaults = {'BRAND_NAME': 'NethVoice', 'WIZARD_BRAND_NAME': 'NethVoice',
                    'NETHCTI_UI_PRODUCT_NAME': 'NethVoice CTI', 'REPORTS_UI_APP_NAME': 'NethVoice Reports',
                    'REPORTS_UI_BRAND_NAME': 'NethVoice'}
        _, _, output, _ = run_action(GetRebrandingTest.path, {'active': True}, environment=defaults)
        request = {key: value for key, value in json.loads(output).items()
                   if not key.startswith(('rebranding_active', 'rebranding_cached', 'rebranding_check'))}

        agent, _, _, code = run_action(self.path, {'active': True}, request, environment=defaults)

        self.assertEqual(code, 0)
        self.assertEqual({key: agent.env[key] for key in defaults}, defaults)

    def test_blank_or_default_names_restore_the_default_of_each_variable(self):
        for name in ('', ' ', 'NethVoice', 'NethVoice CTI', 'NethVoice Reports'):
            with self.subTest(name=name):
                agent, _, _, _ = run_action(self.path, {'active': True}, dict(
                    REQUEST, rebranding_brand_name=name, rebranding_wizard_brand_name=name,
                    rebranding_reports_brand_name=name))
                self.assertEqual(agent.env['BRAND_NAME'], 'NethVoice')
                self.assertEqual(agent.env['WIZARD_BRAND_NAME'], 'NethVoice')
                self.assertEqual(agent.env['NETHCTI_UI_PRODUCT_NAME'], 'NethVoice CTI')
                self.assertEqual(agent.env['REPORTS_UI_APP_NAME'], 'NethVoice Reports')
                self.assertEqual(agent.env['REPORTS_UI_BRAND_NAME'], 'NethVoice')

    def test_a_custom_name_is_written_to_every_variable(self):
        agent, _, _, _ = run_action(self.path, {'active': True}, dict(
            REQUEST, rebranding_wizard_brand_name='Acme Voice', rebranding_reports_brand_name='Acme Voice'))
        self.assertEqual(agent.env['WIZARD_BRAND_NAME'], 'Acme Voice')
        self.assertEqual(agent.env['REPORTS_UI_APP_NAME'], 'Acme Voice')
        self.assertEqual(agent.env['REPORTS_UI_BRAND_NAME'], 'Acme Voice')

    def test_missing_names_keep_the_wizard_name_and_use_the_defaults(self):
        request = {key: value for key, value in REQUEST.items() if key != 'rebranding_brand_name'}
        agent, _, _, _ = run_action(self.path, {'active': True}, request,
                                    environment={'WIZARD_BRAND_NAME': 'Acme Voice'})
        self.assertEqual(agent.env['BRAND_NAME'], 'NethVoice')
        self.assertEqual(agent.env['NETHCTI_UI_PRODUCT_NAME'], 'NethVoice CTI')
        self.assertEqual(agent.env['WIZARD_BRAND_NAME'], 'Acme Voice')
        self.assertEqual(agent.env['REPORTS_UI_APP_NAME'], 'NethVoice Reports')

    def test_missing_light_background_logo_keeps_the_current_value(self):
        request = {key: value for key, value in REQUEST.items() if key != 'rebranding_wizard_logo_light_url'}
        agent, _, _, _ = run_action(self.path, {'active': True}, request,
                                    environment={'WIZARD_LOGO_LIGHT_URL': 'https://cdn.example.org/current.svg'})
        self.assertEqual(agent.env['WIZARD_LOGO_LIGHT_URL'], 'https://cdn.example.org/current.svg')


class SetRebrandingSchemaTest(unittest.TestCase):
    def setUp(self):
        import jsonschema
        schema = json.loads((ACTIONS / 'set-rebranding' / 'validate-input.json').read_text())
        self.validator = jsonschema.Draft7Validator(schema)
        self.example = schema['examples'][0]

    def errors(self, **changes):
        return sorted(error.path[0] for error in self.validator.iter_errors(dict(self.example, **changes)))

    def test_example_and_empty_values_are_valid(self):
        self.assertEqual(self.errors(), [])
        self.assertEqual(self.errors(rebranding_navbar_logo_url='', rebranding_brand_name=''), [])

    def test_names_accept_quotes_and_symbols_inside(self):
        self.assertEqual(self.errors(rebranding_brand_name="L'Azienda \"Voce\" & Co. $1",
                                     rebranding_nethlink_company_name='O\u2019Brien Telecom (R&D) 100%'), [])

    def test_names_reject_what_breaks_the_environment_file(self):
        names = ['rebranding_brand_name', 'rebranding_nethlink_company_name', 'rebranding_reports_brand_name',
                 'rebranding_wizard_brand_name']
        for value in ('"Voice', "'Acme", 'Acme \\ Voice'):
            with self.subTest(value=value):
                self.assertEqual(self.errors(**{name: value for name in names}), names)

    def test_names_reject_control_characters_and_long_values(self):
        self.assertEqual(self.errors(rebranding_brand_name='Acme\tVoice'), ['rebranding_brand_name'])
        self.assertEqual(self.errors(rebranding_wizard_brand_name='Acme\x7fVoice'), ['rebranding_wizard_brand_name'])
        self.assertEqual(self.errors(rebranding_reports_brand_name='A' * 65), ['rebranding_reports_brand_name'])
        self.assertEqual(self.errors(rebranding_brand_name='A' * 64), [])

    def test_login_people_accepts_only_its_values(self):
        for value in ('show', 'hide', ''):
            self.assertEqual(self.errors(rebranding_login_people=value), [])
        for value in ('show\nNETHVOICE_X=y', 'yes', 'Show'):
            with self.subTest(value=value):
                self.assertEqual(self.errors(rebranding_login_people=value), ['rebranding_login_people'])

    def test_every_url_field_accepts_only_plain_http_urls(self):
        url_fields = sorted(key for key in self.validator.schema['properties'] if key.endswith('_url'))
        self.assertIn('rebranding_wizard_logo_light_url', url_fields)
        for value in ('javascript:alert(1)', 'ftp://cdn.example.org/logo.svg', "https://cdn.example.org/a'b.svg",
                      'https://cdn.example.org/$HOME.svg', 'https://cdn.example.org/a\\b.svg',
                      'https://cdn.example.org/a"b.svg', 'https://cdn.example.org/a b.svg',
                      'https://cdn.example.org/<b>.svg', '//cdn.example.org/logo.svg',
                      'https://' + 'a' * 2048):
            with self.subTest(value=value):
                self.assertEqual(self.errors(**{field: value for field in url_fields}), url_fields)
        for value in ('http://cdn.example.org/logo.svg', 'https://cdn.example.org/a/logo.svg?v=2&x=%20#top'):
            with self.subTest(value=value):
                self.assertEqual(self.errors(**{field: value for field in url_fields}), [])


if __name__ == '__main__':
    unittest.main()
