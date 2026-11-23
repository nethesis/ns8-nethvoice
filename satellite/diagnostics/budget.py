"""Fail closed unless an operator has armed a bounded, shared test budget."""
import fcntl
import json
from pathlib import Path
import time

BUDGET = Path('/var/lib/voice-agent/live-diagnostic-budget.json')


def reserve_session(case, *, path=BUDGET, now=None):
    if case not in ('current', 'concise', 'direct-live', 'realtime', 'primary-ws'):
        raise ValueError('invalid_test_case')
    now = time.time() if now is None else now
    with path.open('r+') as stream:
        fcntl.flock(stream, fcntl.LOCK_EX)
        budget = json.load(stream)
        if (set(budget) != {'starts_at', 'expires_at', 'limit', 'attempts'}
                or type(budget['limit']) is not int or not 1 <= budget['limit'] <= 12
                or type(budget['starts_at']) not in (int, float)
                or type(budget['expires_at']) not in (int, float)
                or not 0 < budget['expires_at'] - budget['starts_at'] <= 3600
                or not budget['starts_at'] <= now < budget['expires_at'] - 60
                or not isinstance(budget['attempts'], list) or len(budget['attempts']) >= budget['limit']):
            raise ValueError('test_budget_unavailable')
        budget['attempts'].append(case)
        stream.seek(0)
        json.dump(budget, stream)
        stream.truncate()
        stream.flush()
        return len(budget['attempts'])
