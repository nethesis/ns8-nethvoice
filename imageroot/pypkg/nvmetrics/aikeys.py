#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

"""Validity of the AI provider API keys used by satellite.

Used by the NethVoiceAiKeyInvalid alert (etc/metrics/alert-rules/nethvoice-ai.yml):

- nethvoice_ai_key_valid{provider}: 1 if the provider accepts the key, 0 if it
  rejects it (HTTP status in INVALID_STATUS)

Checked only when call or voicemail transcription is on and the key is set.
A provider that does not answer, or answers with another status, is not
exported: an unreachable provider is "check unavailable", not an invalid key.
The keys never leave the request header: they are not logged, nor exported.
"""

import http.client
import os
import socket
import sys
import threading
import urllib.error
import urllib.parse
import urllib.request

from .runner import CheckUnavailable

TRANSCRIPTION_FLAGS = ("SATELLITE_CALL_TRANSCRIPTION_ENABLED", "SATELLITE_VOICEMAIL_TRANSCRIPTION_ENABLED")
PASSWORDS_FILE = "passwords.env"
# (provider label, key in passwords.env, URL, Authorization scheme)
PROVIDERS = (
    ("deepgram", "DEEPGRAM_API_KEY", "https://api.deepgram.com/v1/projects", "Token"),
    ("openai", "OPENAI_API_KEY", "https://api.openai.com/v1/models", "Bearer"),
)
# HTTP status codes that mean "the key is rejected". 403 is not one of them:
# a key without some permission (e.g. listing Deepgram projects) can still
# work for transcription, so a 403 is "check skipped", not an invalid key.
INVALID_STATUS = frozenset((401,))
TIMEOUT = 4
USER_AGENT = "nethvoice-export-metrics"


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """A redirect is an unexpected answer: it is not followed."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def resolve(host, timeout=TIMEOUT, getaddrinfo=socket.getaddrinfo):
    """Raise OSError if host does not resolve within timeout seconds.

    getaddrinfo has no timeout of its own: it runs in a thread that is
    abandoned when it does not answer in time.
    """
    result = []

    def lookup():
        try:
            getaddrinfo(host, None, type=socket.SOCK_STREAM)
            result.append(None)
        except Exception as ex:
            result.append(ex)

    thread = threading.Thread(target=lookup, daemon=True)
    thread.start()
    thread.join(timeout)
    if not result:
        raise OSError("name resolution of %s timed out" % host)
    if result[0] is not None:
        raise OSError("name resolution of %s failed: %s" % (host, result[0])) from None


def http_status(url, authorization, resolve=resolve):
    """Return the HTTP status of a GET request; raise OSError if there is no answer."""
    resolve(urllib.parse.urlsplit(url).hostname)
    request = urllib.request.Request(url, method="GET", headers={"User-Agent": USER_AGENT})
    # Not sent again if the request is redirected
    request.add_unredirected_header("Authorization", authorization)
    opener = urllib.request.build_opener(_NoRedirect)
    try:
        with opener.open(request, timeout=TIMEOUT) as response:
            return response.status
    except urllib.error.HTTPError as ex:
        ex.close()
        return ex.code
    except http.client.HTTPException as ex:
        raise OSError("invalid HTTP answer (%s)" % type(ex).__name__) from ex


def check(provider, key, url, scheme, http=http_status):
    """Return 1 if the key is valid, 0 if it is rejected, None if unknown."""
    try:
        status = http(url, "%s %s" % (scheme, key))
    except Exception as ex:
        reason = str(ex).replace(key, "***") or type(ex).__name__
        print("ai_keys: %s: check skipped: %s" % (provider, reason), file=sys.stderr)
        return None
    if status == 200:
        return 1
    if status in INVALID_STATUS:
        return 0
    print("ai_keys: %s: check skipped: HTTP status %s" % (provider, status), file=sys.stderr)
    return None


def check_all(checks, http=http_status):
    """Run check() for every (provider, key, url, scheme) in parallel; return the results in order.

    A slow provider must not use up the time of the other one.
    """
    results = [None] * len(checks)

    def worker(index, args):
        results[index] = check(*args, http)

    threads = [threading.Thread(target=worker, args=item, daemon=True) for item in enumerate(checks)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    return results


def render(keys, http=http_status):
    """Return the metrics in the Prometheus text format."""
    checks = [
        (provider, keys.get(variable, ""), url, scheme)
        for provider, variable, url, scheme in PROVIDERS
        if keys.get(variable, "")
    ]
    samples = [
        'nethvoice_ai_key_valid{provider="%s"} %d' % (provider, valid)
        for (provider, _, _, _), valid in zip(checks, check_all(checks, http))
        if valid is not None
    ]
    if checks and not samples:
        raise CheckUnavailable("no AI provider answered")
    lines = [
        "# HELP nethvoice_ai_key_valid 1 if the AI provider accepts the API key, 0 if it rejects it",
        "# TYPE nethvoice_ai_key_valid gauge",
        *samples,
    ]
    return "\n".join(lines) + "\n"


def read_passwords():
    """Return the variables of passwords.env (the working directory is the module state)."""
    import agent

    try:
        return agent.read_envfile(PASSWORDS_FILE)
    except OSError:
        return {}


def read_keys(passwords=read_passwords):
    """Return the API keys of passwords.env."""
    env = passwords()
    return {variable: env.get(variable, "") for _, variable, _, _ in PROVIDERS}


def transcription_enabled(env=os.environ):
    return any(env.get(flag) == "True" for flag in TRANSCRIPTION_FLAGS)


def enabled(env=os.environ, keys=read_keys):
    return transcription_enabled(env) and any(keys().values())


def collect(keys=read_keys, http=http_status):
    return render(keys(), http)
