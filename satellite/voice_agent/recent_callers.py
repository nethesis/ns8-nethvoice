"""Bounded, call-local callback evidence. No caller/model supplied identity."""
import asyncio
import copy
import re
import secrets
import time
from datetime import datetime, timedelta, timezone

from .routing import RoutingPolicy


def normalize_number(value):
    """Formatting only. Never infer countries or remove significant zeroes."""
    if not isinstance(value, str) or not 1 <= len(value) <= 40:
        return None
    value = re.sub(r'[ ()-]', '', value)
    return value if re.fullmatch(r'\+?[0-9]{3,20}', value) else None


class RecentCallerResolver:
    def __init__(self, snapshot, caller_number, reader, scope, *, clock=time.monotonic):
        self.snapshot = copy.deepcopy(snapshot)
        self.number = normalize_number(caller_number)
        self.reader, self.scope, self.clock = reader, scope, clock
        self.candidates = None
        self.evidence = {}
        self.lock = asyncio.Lock()
        self.closed = False

    def enabled(self):
        return not self.closed and RoutingPolicy(self.snapshot).recent_enabled()

    async def lookup(self, arguments, inventory):
        if not self.enabled():
            return {'error': 'tool_denied'}
        if set(arguments) - {'offset'} or type(arguments.get('offset', 0)) is not int or not 0 <= arguments.get('offset', 0) <= 1000:
            return {'error': 'invalid_arguments'}
        if not self.number:
            return {'error': 'caller_identity_unavailable'}
        async with self.lock:
            now = datetime.now(timezone.utc)
            config = RoutingPolicy(self.snapshot).binding['config']
            if any(self.clock() >= evidence[2] for evidence in self.evidence.values()):
                if arguments.get('offset', 0):
                    return {'error': 'recent_candidates_expired'}
                self.candidates = None
                self.evidence.clear()
            if self.candidates is None:
                try:
                    matches = await asyncio.wait_for(asyncio.to_thread(
                        self.reader, self.number, config['recent_caller_lookback_days']), timeout=3)
                    if len(matches) > 1000:
                        return {'error': 'recent_lookup_overflow'}
                except ValueError as error:
                    return {'error': 'recent_lookup_overflow' if str(error) == 'recent_lookup_overflow' else 'recent_lookup_unavailable'}
                except Exception:
                    return {'error': 'recent_lookup_unavailable'}
                if self.closed:
                    return {'error': 'tool_denied'}
                now = datetime.now(timezone.utc)
                latest = {}
                for match in matches:
                    target, at = match['destination_id'], match['called_at']
                    if at.tzinfo is None or not now - timedelta(days=config['recent_caller_lookback_days']) <= at <= now:
                        continue
                    if RoutingPolicy(self.snapshot).permits_recent(target):
                        latest[target] = max(at, latest.get(target, at))
                self.candidates = []
                for target, at in sorted(latest.items(), key=lambda item: (-item[1].timestamp(), item[0])):
                    ref = secrets.token_urlsafe(24)
                    self.evidence[ref] = (target, at, self.clock() + 300)
                    self.candidates.append(ref)
            names = {r['id']: str(r['name'])[:100] for r in inventory if r.get('available', True)}
            refs = [ref for ref in self.candidates if self.resolve(ref, inventory)]
            offset = arguments.get('offset', 0)
            binding = next(b for b in self.snapshot['tool_bindings'] if b['tool_id'] == 'pbx.find_recent_callers')
            end = offset + binding['config']['max_results']
            page = []
            for ref in refs[offset:end]:
                target, at, _ = self.evidence[ref]
                # The model transfers by opaque reference; extension numbers stay server-side.
                page.append({'name': names[target],
                             'seconds_ago': max(0, int((now - at).total_seconds())), 'candidate_ref': ref})
            return {'candidates': page, 'next_offset': end if end < len(refs) else None}

    def resolve(self, reference, inventory):
        if not self.enabled() or not isinstance(reference, str):
            return None
        evidence = self.evidence.get(reference)
        if not evidence:
            return None
        target, called_at, expires = evidence
        policy = RoutingPolicy(self.snapshot)
        if (self.clock() >= expires or not policy.permits_recent(target) or
                called_at < datetime.now(timezone.utc) - timedelta(days=policy.binding['config']['recent_caller_lookback_days'])):
            return None
        return target if any(r['id'] == target and r.get('available', True) for r in inventory) else None

    async def close(self):
        self.closed = True
        self.evidence.clear()
        self.candidates = []
        self.number = None
