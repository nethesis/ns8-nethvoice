#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

"""Removal of the Traefik routes that published the legacy CTI server
directly on /webrest and /socket.io. The server is reachable only through
the middleware (/api), so a leftover route would expose it."""

import sys
import time

import agent
import agent.tasks

LEGACY_ROUTES = ('server-api', 'cti-server-api', 'server-websocket')


def _run(traefik_id, action, instance):
    try:
        result = agent.tasks.run(
            agent_id=traefik_id,
            action=action,
            data={'instance': instance},
            extra={'isNotificationHidden': True},
        )
    except Exception as ex:
        return None, str(ex)
    if result['exit_code'] != 0:
        return None, f"exit code {result['exit_code']}: {result.get('error', '')}"
    return result.get('output'), None


def remove(module_id, attempts=5, delay=2):
    """Delete the legacy routes and check that Traefik no longer has them.
    Retry with a growing delay. Return the routes that are still present
    or could not be checked (empty list on success)."""
    remaining = [module_id + '-' + route for route in LEGACY_ROUTES]
    for attempt in range(1, attempts + 1):
        traefik_id = agent.resolve_agent_id('traefik@node')
        if traefik_id is None:
            print(f"legacy CTI routes: traefik@node not found (attempt {attempt}/{attempts})", file=sys.stderr)
        else:
            still = []
            for instance in remaining:
                _, error = _run(traefik_id, 'delete-route', instance)
                if error:
                    print(f"legacy CTI routes: delete-route {instance} failed (attempt {attempt}/{attempts}): {error}", file=sys.stderr)
                route, error = _run(traefik_id, 'get-route', instance)
                if error or route:
                    still.append(instance)
            remaining = still
            if not remaining:
                return []
        if attempt < attempts:
            time.sleep(delay * attempt)
    return remaining
