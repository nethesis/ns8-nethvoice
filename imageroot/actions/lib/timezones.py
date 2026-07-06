#!/usr/bin/env python3

#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

import filecmp
import subprocess
from pathlib import Path
from zoneinfo import available_timezones

DEFAULT_TIMEZONE = "UTC"
LOCALTIME_PATH = Path("/etc/localtime")
ZONEINFO_DIR = Path("/usr/share/zoneinfo")
TIMEDATECTL_TIMEOUT = 3

SKIP_TOP_LEVEL = {"posix", "right", "SystemV"}
SKIP_FILES = {
    "iso3166.tab",
    "leap-seconds.list",
    "leapseconds",
    "localtime",
    "posixrules",
    "tzdata.zi",
    "zone.tab",
    "zone1970.tab",
}


def _warn(log, message):
    if log is not None:
        log(message)


def _is_valid_zone_path(zone):
    parts = Path(zone).parts
    return (
        zone
        and zone not in SKIP_FILES
        and not zone.startswith(".")
        and ".." not in parts
        and (not parts or parts[0] not in SKIP_TOP_LEVEL)
        and Path(zone).name not in SKIP_FILES
    )


def _scan_zoneinfo(zoneinfo_dir):
    zones = set()

    if not zoneinfo_dir.is_dir():
        return zones

    for path in zoneinfo_dir.rglob("*"):
        try:
            relative_path = path.relative_to(zoneinfo_dir)
        except ValueError:
            continue

        zone = relative_path.as_posix()
        if not _is_valid_zone_path(zone) or not path.is_file():
            continue

        zones.add(zone)

    return zones


def get_accepted_timezones(log=None, zoneinfo_dir=ZONEINFO_DIR):
    try:
        zones = set(available_timezones())
    except Exception as ex:
        _warn(log, f"failed to load timezones with Python zoneinfo: {ex}")
    else:
        if zones:
            zones.add(DEFAULT_TIMEZONE)
            return sorted(zones)
        _warn(log, "Python zoneinfo returned an empty timezone list")

    zones = _scan_zoneinfo(Path(zoneinfo_dir))
    if zones:
        zones.add(DEFAULT_TIMEZONE)
        return sorted(zones)

    _warn(log, "no timezone data found; using UTC only")
    return [DEFAULT_TIMEZONE]


def _timezone_from_localtime_link(localtime_path, zoneinfo_dir, accepted_timezones):
    try:
        resolved_localtime = localtime_path.resolve(strict=True)
        resolved_zoneinfo_dir = zoneinfo_dir.resolve(strict=True)
        zone = resolved_localtime.relative_to(resolved_zoneinfo_dir).as_posix()
    except (OSError, ValueError):
        return None

    if _is_valid_zone_path(zone) and (
        not accepted_timezones or zone in accepted_timezones
    ):
        return zone

    return None


def _timezone_from_localtime_copy(localtime_path, zoneinfo_dir, accepted_timezones):
    if not localtime_path.is_file():
        return None

    zones = accepted_timezones or _scan_zoneinfo(zoneinfo_dir)
    priority_zones = [DEFAULT_TIMEZONE, "Etc/UTC"]
    ordered_zones = priority_zones + sorted(
        zone for zone in zones if zone not in priority_zones
    )
    for zone in ordered_zones:
        if not _is_valid_zone_path(zone):
            continue

        zone_path = zoneinfo_dir / zone
        try:
            if zone_path.is_file() and filecmp.cmp(
                localtime_path, zone_path, shallow=False
            ):
                return zone
        except OSError:
            continue

    return None


def _timezone_from_timedatectl(run, timeout, log):
    try:
        result = run(
            ["timedatectl", "show", "-p", "Timezone", "--value"],
            capture_output=True,
            text=True,
            check=True,
            timeout=timeout,
        )
    except (OSError, subprocess.SubprocessError) as ex:
        _warn(log, f"failed to read local timezone with timedatectl: {ex}")
        return None

    timezone = result.stdout.strip()
    if timezone:
        return timezone

    _warn(log, "timedatectl returned an empty local timezone")
    return None


def get_local_timezone(
    accepted_timezones=None,
    log=None,
    localtime_path=LOCALTIME_PATH,
    zoneinfo_dir=ZONEINFO_DIR,
    run=subprocess.run,
    timedatectl_timeout=TIMEDATECTL_TIMEOUT,
):
    accepted_timezones = set(accepted_timezones or [])
    localtime_path = Path(localtime_path)
    zoneinfo_dir = Path(zoneinfo_dir)

    timezone = _timezone_from_localtime_link(
        localtime_path, zoneinfo_dir, accepted_timezones
    )
    if timezone:
        return timezone

    timezone = _timezone_from_localtime_copy(
        localtime_path, zoneinfo_dir, accepted_timezones
    )
    if timezone:
        return timezone

    timezone = _timezone_from_timedatectl(run, timedatectl_timeout, log)
    if timezone and (not accepted_timezones or timezone in accepted_timezones):
        return timezone
    if timezone:
        _warn(log, f"timedatectl returned unknown timezone {timezone!r}")

    _warn(log, f"using fallback local timezone {DEFAULT_TIMEZONE}")
    return DEFAULT_TIMEZONE
