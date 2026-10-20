#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

"""AI credit state reported by satellite on real calls.

Used by the NethVoiceAiCreditExhausted alert (etc/metrics/alert-rules/nethvoice-ai.yml):

- nethvoice_satellite_ai_credit_exhausted{provider}: 1 if the provider said
  the credit is exhausted (Deepgram 402, OpenAI 429 insufficient_quota), 0
  after a successful call, -1 when not known yet

Copied from satellite_ai_credit_exhausted of the satellite GET /metrics
page (nethesis/satellite#55), protected by its API token. Other satellite
metrics are not forwarded.
"""

import os
import re
import urllib.error
import urllib.request

from . import aikeys
from .runner import CheckUnavailable

TIMEOUT = 4
_SAMPLE_RE = re.compile(r'^satellite_ai_credit_exhausted\{provider="([a-z0-9_-]+)"\} (-?[0-9.]+)$')


def fetch(url, token):
    """Return the satellite metrics page; raise CheckUnavailable when it cannot be read."""
    request = urllib.request.Request(
        url,
        headers={"Authorization": "Bearer " + token, "User-Agent": aikeys.USER_AGENT},
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            return response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as ex:
        ex.close()
        raise CheckUnavailable("satellite /metrics answered HTTP %d" % ex.code) from None
    except (OSError, ValueError) as ex:
        reason = getattr(ex, "reason", None) or type(ex).__name__
        raise CheckUnavailable("satellite /metrics not reachable: %s" % reason) from None


def render(text):
    """Return the metrics in the Prometheus text format."""
    samples = []
    for line in text.splitlines():
        match = _SAMPLE_RE.match(line.strip())
        if match:
            provider, value = match.groups()
            samples.append('nethvoice_satellite_ai_credit_exhausted{provider="%s"} %d' % (provider, int(float(value))))
    if not samples:
        raise CheckUnavailable("satellite does not report the AI credit state")
    lines = [
        "# HELP nethvoice_satellite_ai_credit_exhausted 1 if the AI provider reported no credit left, 0 if its last call succeeded, -1 if not known yet",
        "# TYPE nethvoice_satellite_ai_credit_exhausted gauge",
        *samples,
    ]
    return "\n".join(lines) + "\n"


def read_token():
    """Return the satellite API token of passwords.env (the working directory is the module state)."""
    import agent

    try:
        return agent.read_envfile(aikeys.PASSWORDS_FILE).get("SATELLITE_API_TOKEN", "")
    except OSError:
        return ""


def enabled(env=os.environ):
    # Satellite runs only when transcription is on
    return aikeys.transcription_enabled(env)


def collect(env=os.environ, token=read_token, http=fetch):
    url = "http://127.0.0.1:%s/metrics" % env.get("SATELLITE_HTTP_PORT", "")
    return render(http(url, token()))
