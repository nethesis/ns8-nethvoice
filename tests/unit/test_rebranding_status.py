#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stderr
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "imageroot" / "pypkg"))

import rebranding_status  # noqa: E402

NEW_MY = {
    'provider': 'nsent',
    'system_id': 'NETH-0000-1111-2222',
    'auth_token': 'my_public.secret-token',
    'collect_url': 'https://collect.example.org/collect/api/systems/',
}
LEGACY_MY = {'provider': 'nsent', 'system_id': '00000000-aaaa-bbbb-cccc-000000000000', 'auth_token': 'abc123'}
COMMUNITY = {
    'provider': 'nscom',
    'system_id': '11111111-aaaa-bbbb-cccc-000000000000',
    'auth_token': 'community-token',
    'dartagnan_url': 'https://community.example.org/api',
}


class FakeResponse:
    def __init__(self, status_code=200, body=None, text=None):
        self.status_code = status_code
        self.body = body
        self.text = text

    def json(self):
        if self.text is not None:
            return json.loads(self.text)
        return self.body


class FakeGet:
    def __init__(self, result):
        self.result = result
        self.calls = []

    def __call__(self, url, **kwargs):
        self.calls.append((url, kwargs))
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


def collect_answer(enabled):
    return FakeResponse(body={'code': 200, 'message': 'rebranding retrieved successfully',
                              'data': {'enabled': enabled, 'system': [], 'applications': []}})


class CheckTest(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.cache = Path(directory.name) / 'rebranding-status.json'

    def check(self, subscription, get, now='2026-11-20T09:00:00Z'):
        err = io.StringIO()
        with redirect_stderr(err):
            status = rebranding_status.check(subscription, cache_path=str(self.cache), get=get,
                                             now=lambda: now)
        return status, err.getvalue()

    def test_new_my_is_called_with_basic_auth_and_a_timeout(self):
        get = FakeGet(collect_answer(True))
        status, _ = self.check(NEW_MY, get)

        self.assertEqual(status, {'active': True, 'cached': False, 'check_failed': False,
                                  'checked_at': '2026-11-20T09:00:00Z'})
        self.assertEqual(get.calls, [('https://collect.example.org/collect/api/systems/rebranding',
                                      {'timeout': rebranding_status.TIMEOUT,
                                       'auth': ('NETH-0000-1111-2222', 'my_public.secret-token')})])
        self.assertLessEqual(rebranding_status.TIMEOUT, 10)

    def test_new_my_disabled(self):
        status, _ = self.check(NEW_MY, FakeGet(collect_answer(False)))
        self.assertFalse(status['active'])
        self.assertFalse(status['check_failed'])

    def test_new_my_ignores_the_legacy_brand_field(self):
        answer = FakeResponse(body={'brand': 'Acme', 'data': {'enabled': False}})
        status, _ = self.check(NEW_MY, FakeGet(answer))
        self.assertFalse(status['active'])

    def test_new_my_without_auth_token_is_inactive_and_not_called(self):
        get = FakeGet(collect_answer(True))
        status, _ = self.check(dict(NEW_MY, auth_token=''), get)
        self.assertFalse(status['active'])
        self.assertEqual(get.calls, [])

    def test_legacy_my_is_used_only_without_collect_url(self):
        get = FakeGet(FakeResponse(body={'brand': 'Acme', 'products': {}}))
        status, _ = self.check(LEGACY_MY, get)

        self.assertTrue(status['active'])
        url, kwargs = get.calls[0]
        self.assertEqual(url, 'https://my.nethesis.it/api/systems/rebranding/00000000-aaaa-bbbb-cccc-000000000000')
        self.assertEqual(kwargs, {'timeout': rebranding_status.TIMEOUT})

    def test_legacy_my_without_brand_is_inactive(self):
        status, _ = self.check(LEGACY_MY, FakeGet(FakeResponse(body={'products': {}})))
        self.assertFalse(status['active'])
        self.assertFalse(status['check_failed'])

    def test_legacy_system_id_is_quoted_in_the_path(self):
        get = FakeGet(FakeResponse(body={'products': {}}))
        self.check(dict(LEGACY_MY, system_id='a/b?c'), get)
        self.assertTrue(get.calls[0][0].endswith('/rebranding/a%2Fb%3Fc'))

    def test_community_and_unsubscribed_systems_are_inactive_without_calls(self):
        for subscription in (COMMUNITY, {}, {'provider': 'nsent'}, dict(NEW_MY, provider='')):
            with self.subTest(subscription=subscription):
                get = FakeGet(collect_answer(True))
                status, _ = self.check(subscription, get)
                self.assertEqual(status, {'active': False, 'cached': False, 'check_failed': False,
                                          'checked_at': ''})
                self.assertEqual(get.calls, [])

    def test_failures_without_cache_are_reported_as_inactive(self):
        failures = {
            'timeout': requests.Timeout('read timed out'),
            'connection': requests.ConnectionError('unreachable'),
            'non-200': FakeResponse(status_code=503, body={'data': {'enabled': True}}),
            'unauthorized': FakeResponse(status_code=401, body={'code': 401}),
            'bad JSON': FakeResponse(text='<html>maintenance</html>'),
            'unexpected shape': FakeResponse(body={'data': {'enabled': 'yes'}}),
            'not an object': FakeResponse(body=['enabled']),
        }
        for name, failure in failures.items():
            with self.subTest(failure=name):
                status, err = self.check(NEW_MY, FakeGet(failure))
                self.assertEqual(status, {'active': False, 'cached': False, 'check_failed': True,
                                          'checked_at': ''})
                self.assertIn('rebranding: subscription check failed', err)
                self.assertNotIn('secret-token', err)
                self.assertNotIn('NETH-0000-1111-2222', err)

    def test_legacy_failures_do_not_log_the_system_id(self):
        status, err = self.check(LEGACY_MY, FakeGet(requests.ConnectionError(
            'https://my.nethesis.it/api/systems/rebranding/00000000-aaaa-bbbb-cccc-000000000000')))
        self.assertTrue(status['check_failed'])
        self.assertNotIn('00000000-aaaa', err)

    def test_last_good_answer_is_used_when_my_is_unreachable(self):
        self.check(NEW_MY, FakeGet(collect_answer(True)), now='2026-11-19T08:00:00Z')

        status, _ = self.check(NEW_MY, FakeGet(requests.Timeout()))

        self.assertEqual(status, {'active': True, 'cached': True, 'check_failed': True,
                                  'checked_at': '2026-11-19T08:00:00Z'})

    def test_cache_keeps_a_disabled_answer_too(self):
        self.check(NEW_MY, FakeGet(collect_answer(False)))
        status, _ = self.check(NEW_MY, FakeGet(FakeResponse(status_code=500)))
        self.assertEqual((status['active'], status['cached']), (False, True))

    def test_cache_is_refreshed_by_every_good_answer(self):
        self.check(NEW_MY, FakeGet(collect_answer(True)), now='2026-11-19T08:00:00Z')
        self.check(NEW_MY, FakeGet(collect_answer(False)), now='2026-11-20T08:00:00Z')

        status, _ = self.check(NEW_MY, FakeGet(requests.Timeout()))

        self.assertEqual((status['active'], status['checked_at']), (False, '2026-11-20T08:00:00Z'))

    def test_cache_of_another_subscription_is_ignored(self):
        self.check(NEW_MY, FakeGet(collect_answer(True)))
        status, _ = self.check(dict(NEW_MY, system_id='NETH-9999-8888-7777'), FakeGet(requests.Timeout()))
        self.assertEqual((status['active'], status['cached']), (False, False))

    def test_cache_file_holds_no_credentials(self):
        self.check(NEW_MY, FakeGet(collect_answer(True)))
        content = self.cache.read_text()
        self.assertEqual(sorted(json.loads(content)), ['active', 'checked_at', 'subscription'])
        for secret in ('NETH-0000-1111-2222', 'secret-token'):
            self.assertNotIn(secret, content)

    def test_damaged_cache_is_ignored(self):
        for content in ('not json', '[]', '{"subscription": "x"}'):
            with self.subTest(content=content):
                self.cache.write_text(content)
                status, _ = self.check(NEW_MY, FakeGet(requests.Timeout()))
                self.assertEqual((status['active'], status['cached']), (False, False))

    def test_cache_write_failure_does_not_fail_the_check(self):
        get = FakeGet(collect_answer(True))
        err = io.StringIO()
        with redirect_stderr(err):
            status = rebranding_status.check(NEW_MY, cache_path=str(self.cache.parent / 'missing' / 'cache.json'),
                                             get=get, now=lambda: '2026-11-20T09:00:00Z')
        self.assertTrue(status['active'])
        self.assertIn('cannot save the status cache', err.getvalue())


if __name__ == '__main__':
    unittest.main()
