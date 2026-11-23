"""Bounded metadata outbox. Spooling and DB retries never block the audio loop."""
import asyncio
import json
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from .telemetry import PHASES, STATUSES, TOOLS, PROVIDER_CODES, USAGE_KEYS, retention_days, safe_error

EVENTS = frozenset(('admitted', 'provider_connected', 'media_connected', 'response_completed',
    'completed', 'fallback', 'failed', 'interrupted', 'tool_started', 'tool_completed',
    'tool_failed', 'tool_denied', 'transfer_requested', 'transfer_committed', 'transfer_failed',
    'transfer_uncertain', 'trace_started', 'trace_finished', 'trace_gap', 'usage_snapshot', 'provider_output', 'transcription_failed'))
EVENTS = EVENTS | frozenset('consultation_' + state for state in ('announced','held','phone','phone_failed','chat','connecting','clarification','transferred','uncertain','replied','declined','unavailable','timed_out','cancelled','failed','recovery_failed'))
OUTCOMES = frozenset(('running', 'completed', 'fallback', 'failed', 'interrupted', 'transferred', 'ended_by_agent'))
BASE_FIELDS = {'event_id', 'run_id', 'event_type', 'outcome', 'error_code', 'tool_id', 'destination_id', 'occurred_at'}
DETAIL_FIELDS = {'result_count', 'monitoring_version', 'span_id', 'parent_span_id', 'phase', 'status',
    'elapsed_ms', 'duration_ms', 'http_status', 'provider_code', 'usage_json', 'usage_complete',
    'run_duration_ms', 'trace_complete', 'first_output_ms'}
MAX_PENDING = 4096
RESERVED = 256
MAX_BYTES = 16 * 1024 * 1024


def validate_event(event):
    if not isinstance(event, dict) or not BASE_FIELDS <= event.keys() or event.keys() - BASE_FIELDS - DETAIL_FIELDS:
        raise ValueError('invalid_outbox_event')
    if not all(isinstance(event.get(name),str) for name in ('event_id','run_id')):
        raise ValueError('invalid_outbox_event')
    for name in ('event_id', 'run_id', 'span_id', 'parent_span_id'):
        if event.get(name) is not None and str(uuid.UUID(event[name])) != event[name]:
            raise ValueError('invalid_outbox_event')
    if event['event_type'] not in EVENTS or (event['outcome'] is not None and event['outcome'] not in OUTCOMES):
        raise ValueError('invalid_outbox_event')
    if type(event.get('monitoring_version')) is not int or event['monitoring_version'] != 2:
        raise ValueError('invalid_outbox_event')
    if event['tool_id'] is not None and event['tool_id'] not in TOOLS:
        raise ValueError('invalid_outbox_event')
    if event['destination_id'] is not None and not re.fullmatch(r'(extension|queue|ivr):[0-9]{1,20}', event['destination_id']):
        raise ValueError('invalid_outbox_event')
    kind = event['event_type']
    if kind in ('trace_started','trace_finished','provider_output','usage_snapshot','trace_gap') and event.get('monitoring_version') != 2:
        raise ValueError('invalid_outbox_event')
    if kind in ('trace_started','trace_finished'):
        if not event.get('span_id') or event.get('phase') not in PHASES or event.get('elapsed_ms') is None:
            raise ValueError('invalid_outbox_event')
        if kind == 'trace_started' and event.get('status') != 'running':
            raise ValueError('invalid_outbox_event')
        if kind == 'trace_finished' and (event.get('status') not in ('completed','failed','cancelled') or event.get('duration_ms') is None):
            raise ValueError('invalid_outbox_event')
    if kind == 'usage_snapshot' and (not event.get('usage_json') or 'usage_complete' not in event):
        raise ValueError('invalid_outbox_event')
    if kind == 'provider_output' and event.get('elapsed_ms') is None:
        raise ValueError('invalid_outbox_event')
    stamp = datetime.fromisoformat(event['occurred_at'])
    if stamp.tzinfo is None:
        raise ValueError('invalid_outbox_event')
    for name, allowed in (('phase', PHASES), ('status', STATUSES), ('provider_code', PROVIDER_CODES)):
        if event.get(name) is not None and event[name] not in allowed:
            raise ValueError('invalid_outbox_event')
    for name in ('elapsed_ms', 'duration_ms', 'run_duration_ms', 'first_output_ms', 'result_count', 'http_status'):
        value = event.get(name)
        maximum = 100 if name == 'result_count' else 599 if name == 'http_status' else 86400000
        minimum=100 if name=='http_status' else 0
        if value is not None and (type(value) is not int or not minimum <= value <= maximum):
            raise ValueError('invalid_outbox_event')
    for name in ('trace_complete', 'usage_complete'):
        if name in event and type(event[name]) is not bool:
            raise ValueError('invalid_outbox_event')
    if event.get('usage_json') is not None:
        usage = json.loads(event['usage_json'])
        if not isinstance(usage, dict) or usage.keys() - set(USAGE_KEYS):
            raise ValueError('invalid_outbox_event')
        for key, value in usage.items():
            if type(value) not in (int, float) or not 0 <= value <= 10**16 or (key != 'live_seconds' and type(value) is not int):
                raise ValueError('invalid_outbox_event')
    if event['error_code'] is not None:
        event['error_code'] = safe_error(event['error_code'])
    if len(json.dumps(event).encode()) > 4096:
        raise ValueError('invalid_outbox_event')
    return event


class Monitoring:
    def __init__(self, storage, directory=None):
        self.storage = storage
        self.queue = asyncio.Queue(maxsize=MAX_PENDING)
        self.spool_queue = asyncio.Queue(maxsize=MAX_PENDING)
        self.degraded = False
        self.spool_disabled = False
        self.worker = self.spool_worker = None
        self.directory = Path(directory or os.environ['VOICE_AGENT_EVENT_DIR']) if directory or os.getenv('VOICE_AGENT_EVENT_DIR') else None
        if self.directory:
            self.directory.mkdir(mode=0o700, parents=True, exist_ok=True)
            self.directory.chmod(0o700)
            self.degraded = (self.directory / 'monitoring-degraded').exists()
        self.pending, self.ready = {}, {}
        self.pending_bytes = 0
        self.dropped = self.retries = 0
        self.last_write = None

    async def start(self):
        if self.directory:
            # Files are bounded independently of in-memory replay, including stale files.
            def load():
                loaded, bad = [], False
                paths = sorted(self.directory.glob('*.json'))
                if len(paths) > MAX_PENDING:
                    bad = True
                cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days())
                for path in paths[:MAX_PENDING]:
                    try:
                        if path.is_symlink() or path.stat().st_size > 4096:
                            raise ValueError('invalid_outbox_event')
                        event = validate_event(json.loads(path.read_text()))
                        if event['event_id'] != path.stem:
                            raise ValueError('invalid_outbox_event')
                        if datetime.fromisoformat(event['occurred_at']) < cutoff:
                            path.unlink()
                            continue
                        loaded.append(event)
                    except Exception:
                        bad = True
                return loaded, bad
            loaded, bad = await asyncio.to_thread(load)
            self.degraded |= bad
            self.spool_disabled |= bad
            for event in sorted(loaded, key=lambda item: item['occurred_at']):
                if event['event_id'] not in self.pending:
                    self._enqueue(event)
        self.spool_worker = asyncio.create_task(self._spool())
        self.worker = asyncio.create_task(self._write())

    def mark_degraded(self):
        self.degraded = True

    def _enqueue(self, event):
        ident = event['event_id']
        self.pending[ident] = event
        self.pending_bytes += len(json.dumps(event).encode())
        self.ready[ident] = asyncio.Event()
        self.spool_queue.put_nowait(event)
        self.queue.put_nowait(event)

    def emit(self, run_id, kind, *, outcome=None, error=None, key=None, tool_id=None, destination_id=None, result_count=None, **details):
        event_id = str(uuid.uuid5(uuid.UUID(run_id), key or kind))
        if event_id in self.pending:
            return True
        event = {'event_id': event_id, 'run_id': run_id, 'event_type': kind, 'outcome': outcome,
                 'error_code': safe_error(error) if error is not None else None,
                 'tool_id': tool_id if tool_id in TOOLS else None, 'destination_id': destination_id,
                 'occurred_at': datetime.now(timezone.utc).isoformat(), 'monitoring_version': 2}
        if result_count is not None:
            event['result_count'] = result_count
        event.update(details)
        try:
            validate_event(event)
        except (ValueError, TypeError, KeyError, AttributeError):
            self.dropped += 1
            self.mark_degraded()
            return False
        terminal = outcome is not None or kind in ('trace_gap', 'usage_snapshot')
        if (len(self.pending) >= (MAX_PENDING if terminal else MAX_PENDING - RESERVED)
                or self.pending_bytes + len(json.dumps(event).encode()) > MAX_BYTES or self.queue.full()):
            self.dropped += 1
            self.mark_degraded()
            return False
        self._enqueue(event)
        return True

    def _persist(self, event):
        if not self.directory or self.spool_disabled:
            return
        if self.degraded:
            marker = self.directory / 'monitoring-degraded'
            descriptor = os.open(marker, os.O_WRONLY | os.O_CREAT, 0o600)
            os.close(descriptor)
        path = self.directory / (event['event_id'] + '.json')
        if path.exists():
            return
        temporary = path.with_suffix('.tmp')
        try:
            with temporary.open('w', encoding='utf-8') as stream:
                os.chmod(temporary, 0o600)
                json.dump(event, stream, separators=(',', ':'))
                stream.flush()
                os.fsync(stream.fileno())
            temporary.replace(path)
        finally:
            temporary.unlink(missing_ok=True)

    async def _spool(self):
        while True:
            event = await self.spool_queue.get()
            try:
                await asyncio.to_thread(self._persist, event)
            except Exception:
                self.spool_disabled = True
                self.mark_degraded()
            finally:
                self.ready[event['event_id']].set()
                self.spool_queue.task_done()

    async def _write(self):
        while True:
            event = await self.queue.get()
            try:
                await self.ready[event['event_id']].wait()
                while True:
                    try:
                        await asyncio.to_thread(self.storage.event, event)
                        self.last_write = datetime.now(timezone.utc).isoformat()
                        if self.directory:
                            try:
                                await asyncio.to_thread((self.directory / (event['event_id'] + '.json')).unlink, missing_ok=True)
                            except OSError:
                                # Already committed: retain the file for safe replay,
                                # but do not block later writes or subtract twice.
                                self.spool_disabled = True
                                self.mark_degraded()
                        self.pending.pop(event['event_id'], None)
                        self.ready.pop(event['event_id'], None)
                        self.pending_bytes -= len(json.dumps(event).encode())
                        break
                    except Exception:
                        self.retries += 1
                        self.mark_degraded()
                        await asyncio.sleep(1)
            finally:
                self.queue.task_done()

    def health(self):
        now = datetime.now(timezone.utc)
        oldest = min((datetime.fromisoformat(e['occurred_at']) for e in self.pending.values()), default=now)
        return {'degraded': self.degraded, 'spool_writable': not self.spool_disabled, 'queue_depth': len(self.pending), 'pending_bytes': self.pending_bytes,
                'oldest_pending_seconds': max(0, int((now-oldest).total_seconds())),
                'dropped': self.dropped, 'retries': self.retries, 'last_write_at': self.last_write}

    async def stop(self):
        try:
            await asyncio.wait_for(self.queue.join(), timeout=5)
        except asyncio.TimeoutError:
            self.mark_degraded()
        if self.directory and self.degraded:
            try:
                await asyncio.to_thread(self._persist_marker)
            except OSError:
                pass
        for task in (self.worker, self.spool_worker):
            if task:
                task.cancel()
        await asyncio.gather(*(t for t in (self.worker, self.spool_worker) if t), return_exceptions=True)

    def _persist_marker(self):
        descriptor = os.open(self.directory / 'monitoring-degraded', os.O_WRONLY | os.O_CREAT, 0o600)
        os.close(descriptor)
