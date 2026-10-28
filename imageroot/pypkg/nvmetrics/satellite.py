#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

"""Satellite metrics, forwarded as they are.

The satellite_* families of the satellite GET /metrics page
(nethesis/satellite#55, protected by its API token) are copied unchanged.
The NethVoiceAICreditExhausted alert (etc/metrics/alert-rules/nethvoice-ai.yml)
uses:

- satellite_ai_credit_exhausted{provider}: 1 if the provider said the credit
  is exhausted (Deepgram 402, OpenAI 429 insufficient_quota), 0 after a
  successful call, -1 when not known yet

The process_* and python_* families are not forwarded. The token is never
logged.
"""

import os

from . import aikeys, promtext
from .runner import CheckUnavailable

PREFIX = "satellite_"


def fetch(url, token):
    """Return the satellite metrics page; raise CheckUnavailable when it cannot be read."""
    return promtext.fetch(url, "Bearer " + token, "satellite")


def render(text):
    """Return the satellite families in the Prometheus text format."""
    text = promtext.forward(text, PREFIX)
    if not text:
        raise CheckUnavailable("satellite does not report its metrics")
    return text


def read_token(passwords=aikeys.read_passwords):
    """Return the satellite API token of passwords.env."""
    return passwords().get("SATELLITE_API_TOKEN", "")


def enabled(env=os.environ):
    # Satellite runs only when transcription is on
    return aikeys.transcription_enabled(env)


def collect(env=os.environ, token=read_token, http=fetch):
    url = "http://127.0.0.1:%s/metrics" % env.get("SATELLITE_HTTP_PORT", "")
    return render(http(url, token()))
