#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

import io
import json
import os
import runpy
import sys
import types
import unittest
from pathlib import Path
from unittest import mock


ROOT = Path(__file__).resolve().parents[2]


class HostnameConfigurationTest(unittest.TestCase):
    def setUp(self):
        self.agent = types.ModuleType('agent')
        self.tasks = types.ModuleType('agent.tasks')
        self.agent.tasks = self.tasks
        self.agent.set_status = mock.Mock()
        self.routes = {}
        self.agent.set_route = mock.Mock(
            side_effect=lambda route: self.routes.update({route['instance']: route})
        )
        self.agent.set_env = mock.Mock(side_effect=lambda key, value: os.environ.update({key: value}))
        self.agent.resolve_agent_id = mock.Mock(return_value='module/nethvoice-proxy1')
        self.agent.redis_connect = mock.Mock()
        self.agent.list_service_providers = mock.Mock(return_value=[{
            'fqdn': 'Proxy.example.org', 'host': '192.0.2.10', 'port': '5060',
        }])
        self.agent.assert_exp = self.assertTrue
        self.agent.read_envfile = mock.Mock(return_value={})
        self.tasks.run = mock.Mock(return_value={'exit_code': 0})
        self.request = {
            'nethvoice_host': 'Voice.Example.org',
            'nethcti_ui_host': 'CTI.Example.org',
            'lets_encrypt': True,
            'timezone': 'Europe/Rome',
        }
        self.enterContext(mock.patch.dict(sys.modules, {'agent': self.agent, 'agent.tasks': self.tasks}))
        self.enterContext(mock.patch.dict(os.environ, {
            'MODULE_ID': 'nethvoice1', 'AGENT_ID': 'module/nethvoice1',
            'APACHE_PORT': '20001', 'NETHCTI_UI_PORT': '20002',
            'ASTERISK_SIP_UDP_PORT': '20003', 'TRAEFIK_HTTP2HTTPS': 'true',
        }))

    def run_action(self, path, data):
        output = io.StringIO()
        with mock.patch('sys.stdin', io.StringIO(json.dumps(data))), mock.patch('sys.stdout', output):
            runpy.run_path(str(ROOT / 'imageroot/actions' / path), run_name='__main__')
        return output.getvalue()

    def configure(self, request):
        for step in ('15configure_main_routes', '20setenvs', '60sip_proxy'):
            self.run_action('configure-module/' + step, request)

    def test_save_normalizes_http_environment_and_sip_routes(self):
        self.configure(self.request)
        self.assertEqual(os.environ['NETHVOICE_HOST'], 'voice.example.org')
        self.assertEqual(os.environ['NETHCTI_UI_HOST'], 'cti.example.org')
        self.assertEqual(os.environ['TIMEZONE'], 'Europe/Rome')
        self.assertEqual(os.environ['NETHVOICE_PROXY_FQDN'], 'Proxy.example.org')
        self.assertEqual(self.routes['nethvoice1-wizard']['host'], 'voice.example.org')
        self.assertEqual(self.routes['nethvoice1-ui']['host'], 'cti.example.org')
        self.assertTrue(all(route['lets_encrypt'] for route in self.routes.values()))
        self.assertEqual(self.tasks.run.call_args.kwargs['data']['domain'], 'voice.example.org')

        self.request.update(nethvoice_host='VOICE.EXAMPLE.ORG', nethcti_ui_host='cti.example.org')
        self.configure(self.request)
        self.assertEqual(len(self.routes), 2)
        self.assertEqual(self.tasks.run.call_args.kwargs['data']['domain'], 'voice.example.org')

    def test_matching_hosts_fail_before_routes_or_environment_change(self):
        for cti_host in ('Voice.Example.org', 'voice.example.org', 'VOICE.EXAMPLE.ORG'):
            with self.subTest(cti_host=cti_host):
                self.request['nethcti_ui_host'] = cti_host
                output = io.StringIO()
                with mock.patch('sys.stdout', output), self.assertRaises(SystemExit) as error:
                    with mock.patch('sys.stdin', io.StringIO(json.dumps(self.request))):
                        runpy.run_path(str(ROOT / 'imageroot/actions/configure-module/15configure_main_routes'))
                self.assertEqual(error.exception.code, 2)
                self.assertEqual([item['parameter'] for item in json.loads(output.getvalue())],
                                 ['nethvoice_host', 'nethcti_ui_host'])
                self.agent.set_status.assert_called_with('validation-failed')
                self.agent.set_route.assert_not_called()
                self.agent.set_env.assert_not_called()

    def test_certificate_option_stays_optional(self):
        del self.request['lets_encrypt']
        self.configure(self.request)
        self.assertTrue(all('lets_encrypt' not in route for route in self.routes.values()))

    def test_restore_uses_the_same_normalization(self):
        self.run_action('restore-module/70configure_module', {'environment': {
            'NETHVOICE_HOST': 'Voice.Example.org', 'NETHCTI_UI_HOST': 'CTI.Example.org',
            'REPORTS_INTERNATIONAL_PREFIX': '+39', 'TIMEZONE': 'UTC',
            'USER_DOMAIN': 'users.example.org',
        }})
        configure_call = self.tasks.run.call_args_list[0]
        self.assertEqual(configure_call.kwargs['action'], 'configure-module')
        self.configure(configure_call.kwargs['data'])
        self.assertEqual(os.environ['NETHVOICE_HOST'], 'voice.example.org')
        self.assertEqual(os.environ['NETHCTI_UI_HOST'], 'cti.example.org')


if __name__ == '__main__':
    unittest.main()
