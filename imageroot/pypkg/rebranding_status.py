#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

import datetime
import hashlib
import json
import os
import sys
import urllib.parse

import requests

LEGACY_URL = 'https://my.nethesis.it/api/systems/rebranding/{}'
TIMEOUT = 5
CACHE_FILE = 'rebranding-status.json'


class CheckFailed(Exception):
    pass


def _subscription_key(subscription):
    return hashlib.sha256(subscription['system_id'].encode()).hexdigest()


def _now():
    return datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def _get_json(get, url, **kwargs):
    try:
        response = get(url, timeout=TIMEOUT, **kwargs)
    except requests.RequestException as error:
        raise CheckFailed(type(error).__name__) from None
    if response.status_code != 200:
        raise CheckFailed(f'HTTP {response.status_code}')
    try:
        return response.json()
    except ValueError:
        raise CheckFailed('invalid JSON') from None


def _query_collect(subscription, get):
    url = subscription['collect_url'].rstrip('/') + '/rebranding'
    body = _get_json(get, url, auth=(subscription['system_id'], subscription['auth_token']))
    data = body.get('data') if isinstance(body, dict) else None
    enabled = data.get('enabled') if isinstance(data, dict) else None
    if not isinstance(enabled, bool):
        raise CheckFailed('unexpected response')
    return enabled


def _query_legacy(subscription, get):
    url = LEGACY_URL.format(urllib.parse.quote(subscription['system_id'], safe=''))
    body = _get_json(get, url)
    if not isinstance(body, dict):
        raise CheckFailed('unexpected response')
    return 'brand' in body


def _read_cache(path, key):
    try:
        with open(path) as cache:
            content = json.load(cache)
    except (OSError, ValueError):
        return None
    if not isinstance(content, dict) or content.get('subscription') != key:
        return None
    if not isinstance(content.get('active'), bool) or not isinstance(content.get('checked_at'), str):
        return None
    return content


def _write_cache(path, key, active, checked_at):
    temporary = f'{path}.tmp'
    try:
        with open(temporary, 'w') as cache:
            json.dump({'subscription': key, 'active': active, 'checked_at': checked_at}, cache)
        os.replace(temporary, path)
    except OSError as error:
        print(f'rebranding: cannot save the status cache: {error.strerror}', file=sys.stderr)


def check(subscription, cache_path=CACHE_FILE, get=requests.get, now=_now):
    result = {'active': False, 'cached': False, 'check_failed': False, 'checked_at': ''}
    if subscription.get('provider') != 'nsent' or not subscription.get('system_id'):
        return result
    if subscription.get('collect_url'):
        if not subscription.get('auth_token'):
            return result
        query = _query_collect
    else:
        query = _query_legacy
    key = _subscription_key(subscription)
    try:
        active = query(subscription, get)
    except CheckFailed as error:
        print(f'rebranding: subscription check failed: {error}', file=sys.stderr)
        result['check_failed'] = True
        cached = _read_cache(cache_path, key)
        if cached:
            result.update(active=cached['active'], cached=True, checked_at=cached['checked_at'])
        return result
    checked_at = now()
    _write_cache(cache_path, key, active, checked_at)
    result.update(active=active, checked_at=checked_at)
    return result
