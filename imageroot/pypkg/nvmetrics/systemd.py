#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

"""State of the NethVoice services, read from systemd.

Used by the ServiceDown alert (etc/metrics/alert-rules/nethvoice-services.yml):

- nethvoice_service_up{service}: 1 when the unit is running or waiting for an
  automatic restart, 0 when it is down. Not exported when the unit is disabled
  and stopped (feature turned off) or has never started (CTI before the wizard).
- nethvoice_service_restarts_total{service}: automatic restarts done by systemd
  (NRestarts). A manual start or restart resets it to 0.
"""

import subprocess

# Unit names without ".service": the value of the "service" label
SERVICES = (
    "freepbx",
    "mariadb",
    "janus",
    "nethcti-ui",
    "nethcti-server",
    "nethcti-middleware",
    "phonebook",
    "tancredi",
    "satellite",
    "satellite-mqtt",
    "satellite-pgsql",
    "reports-api",
    "reports-redis",
    "reports-ui",
    "sftp",
    "saml2-proxy",
    "oauth2-proxy",
)
PROPERTIES = (
    "Id",
    "LoadState",
    "ActiveState",
    "UnitFileState",
    "NRestarts",
    "InactiveExitTimestampMonotonic",
)
TIMEOUT = 4


def read_units(services=SERVICES, run=subprocess.run):
    """Return the properties of every service, one dict per unit."""
    result = run(
        ["systemctl", "--user", "show", "--property=" + ",".join(PROPERTIES), "--"]
        + [service + ".service" for service in services],
        check=True,
        capture_output=True,
        text=True,
        timeout=TIMEOUT,
    )
    return parse_show(result.stdout)


def parse_show(text):
    """Parse "systemctl show" output: units are separated by empty lines."""
    units = []
    current = {}
    for line in text.splitlines():
        if not line.strip():
            if current:
                units.append(current)
                current = {}
            continue
        key, _, value = line.partition("=")
        current[key] = value
    if current:
        units.append(current)
    return units


def service_up(unit):
    """Return 1 (up), 0 (down) or None (not expected to run)."""
    state = unit.get("ActiveState")
    # "activating" also covers the wait before an automatic restart: a crash
    # loop is reported by the restart counter, not as a stopped service
    if state in ("active", "reloading", "activating"):
        return 1
    if state == "failed":
        return 0
    ran = int(unit.get("InactiveExitTimestampMonotonic") or 0) > 0
    if unit.get("UnitFileState") == "enabled" and ran:
        return 0
    return None


def render(units, prefix="nethvoice"):
    """Return the metrics in the Prometheus text format."""
    up = []
    restarts = []
    for unit in units:
        if unit.get("LoadState") != "loaded":
            continue
        service = unit["Id"][: -len(".service")]
        restarts.append('%s_service_restarts_total{service="%s"} %d' % (prefix, service, int(unit.get("NRestarts") or 0)))
        value = service_up(unit)
        if value is not None:
            up.append('%s_service_up{service="%s"} %d' % (prefix, service, value))
    lines = [
        "# HELP %s_service_up 1 if the service is running or restarting, 0 if it is down" % prefix,
        "# TYPE %s_service_up gauge" % prefix,
        *up,
        "# HELP %s_service_restarts_total Automatic restarts done by systemd" % prefix,
        "# TYPE %s_service_restarts_total counter" % prefix,
        *restarts,
    ]
    return "\n".join(lines) + "\n"


def collect(units=read_units):
    return render(units())
