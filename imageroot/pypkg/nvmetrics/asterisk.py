#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

"""Asterisk metrics of res_prometheus, forwarded as they are.

The asterisk_* families of GET /metrics on the Asterisk HTTP server
(127.0.0.1:ASTERISK_WS_PORT, basic auth "prometheus" with
ASTERISK_PROMETHEUS_PASSWORD of passwords.env) are copied unchanged, e.g.
asterisk_calls_count, asterisk_endpoints_state{id,tech,resource} and
asterisk_pjsip_outbound_registration_status{username,domain}. The page is
read once per run: the trunks collector uses it too.

While freepbx is not running the page is not read: ServiceDown reports it.
The password is never logged.
"""

import base64
import os

from . import aikeys, promtext, systemd
from .runner import CheckUnavailable

TIMEOUT = 4
USERNAME = "prometheus"
PREFIX = "asterisk_"


def fetch(url, password):
    """Return the Asterisk metrics page; raise CheckUnavailable when it cannot be read."""
    credentials = base64.b64encode(("%s:%s" % (USERNAME, password)).encode()).decode()
    return promtext.fetch(url, "Basic " + credentials, "Asterisk")


def read_password(passwords=aikeys.read_passwords):
    """Return the res_prometheus password of passwords.env."""
    return passwords().get("ASTERISK_PROMETHEUS_PASSWORD", "")


def freepbx_active(units=systemd.read_units):
    """Return True if freepbx is running, from the units read by the systemd collector."""
    return any(
        unit.get("Id") == "freepbx.service" and unit.get("ActiveState") in ("active", "reloading") for unit in units()
    )


def read_page(env=os.environ, password=read_password, http=fetch, active=freepbx_active):
    """Return the Asterisk metrics page; raise CheckUnavailable when it cannot be read."""
    if not active():
        raise CheckUnavailable("freepbx is not running")
    secret = password()
    if not secret:
        raise CheckUnavailable("ASTERISK_PROMETHEUS_PASSWORD is not set")
    return http("http://127.0.0.1:%s/metrics" % env.get("ASTERISK_WS_PORT", ""), secret)


def collect(page=read_page):
    text = promtext.forward(page(), PREFIX)
    if not text:
        raise CheckUnavailable("Asterisk does not report its metrics")
    return text
