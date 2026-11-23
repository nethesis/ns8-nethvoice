"""Versioned, content-free observations; independent of storage and presentation."""
import asyncio
import json
import logging
import math
import os
import time
import uuid
from contextlib import asynccontextmanager
from contextvars import ContextVar

ACTIVE_SPAN = ContextVar("voice_agent_span", default=None)

PHASES = frozenset(('snapshot', 'binding', 'admission', 'origination', 'webhook_wait',
    'routing_context', 'provider_accept', 'provider_sideband', 'provider_answer',
    'media_bridge', 'media_prepare', 'provider_start', 'provider_audio', 'provider_stream', 'greeting', 'response', 'tool', 'transfer', 'fallback', 'cleanup'))
STATUSES = frozenset(('running', 'completed', 'failed', 'cancelled'))
PROVIDER_CODES = frozenset(('other', 'invalid_value', 'unknown_parameter', 'unsupported_value',
    'invalid_request_error', 'invalid_function_parameters', 'model_not_found', 'invalid_api_key', 'insufficient_quota',
    'invalid_session_id', 'decision_already_made', 'unsupported_parameter', 'invalid_model',
    'model_not_supported', 'srtp_required', 'rate_limit_exceeded', 'server_error'))
ERRORS = frozenset(('other', 'timeout', 'cancelled', 'transport', 'provider_error',
    'tool_denied', 'destination_denied', 'invalid_arguments', 'invalid_invocation',
    'hangup_unavailable', 'hangup_failed', 'tool_unavailable', 'tool_capacity_exceeded', 'recent_lookup_unavailable',
    'recent_lookup_overflow', 'voicemail_unavailable', 'transfer_unavailable', 'transfer_unconfirmed',
    'transfer_cancelled', 'transfer_failed', 'transfer_uncertain', 'provider_disconnected',
    'provider_event_error', 'provider_sideband_error', 'provider_unavailable', 'provider_sideband_failed', 'provider_accept_failed', 'provider_stream_failed',
    'provider_answer_failed', 'media_bridge_failed', 'setup_timeout', 'duration_exceeded',
    'runtime_restarted', 'runtime_stopped', 'ari_disconnected', 'caller_cancelled_before_connect',
    'setup_cancelled', 'tool_execution_failed', 'provider_live_error', 'provider_live_backend_failed',
    'debug_transcription_unavailable', 'media_eof', 'media_identity_invalid', 'media_backpressure', 'media_transport_failed', 'media_capacity_exceeded', 'cleanup_failed', 'fallback_failed', 'trace_limit', 'observation_gap', 'shutdown', 'setup_expired', 'test_finished'))
ERRORS = ERRORS | frozenset('consultation_' + stage + '_' + result
    for stage in ('announcement','moh','presence','origination','provider','chat') for result in ('failed','timeout')) | frozenset((
    'consultation_recovery_failed','consultation_update_failed','consultation_handoff_failed','consultation_no_answer',
    'consultation_busy','consultation_recipient_closed','consultation_recipient_unavailable'))
TOOLS = frozenset(('pbx.find_destinations',
                   'pbx.find_recent_callers', 'pbx.transfer', 'telephony.hangup'))
USAGE_KEYS = ('response_input_tokens', 'response_output_tokens', 'response_total_tokens',
              'live_seconds', 'backend_input_tokens', 'backend_output_tokens', 'backend_total_tokens')
# Noncumulative bucket boundaries, in milliseconds. Version these with monitoring v2.
BUCKETS = (50, 100, 250, 500, 1000, 2500, 5000, 10000, 20000, 30000,
           60000, 120000, 300000, 600000, 1800000, 3600000, 86400000)


def retention_days():
    value = os.getenv('VOICE_AGENT_MONITORING_RETENTION_DAYS', '90')
    if not 1 <= len(value) <= 4 or not value.isascii() or not value.isdigit() or not 1 <= int(value) <= 3650:
        logging.getLogger(__name__).warning('voice_agent_monitoring_retention_invalid')
        return 90
    return int(value)


def safe_error(value):
    if isinstance(value, str) and value in ERRORS:
        return value
    if isinstance(value, str):
        for prefix, maximum in (('provider_http_', 599), ('provider_hangup_', 127)):
            suffix = value.removeprefix(prefix)
            if value.startswith(prefix) and suffix.isascii() and suffix.isdigit() and 0 < int(suffix) <= maximum:
                return value
        if value in {'setup_' + phase + '_failed' for phase in PHASES | {'tool_catalog', 'run_storage'}}:
            return value
    return 'other'


def error_info(error):
    status = getattr(error, 'http_status', None)
    code = getattr(error, 'provider_code', None)
    return {'http_status': status if type(status) is int and 100 <= status <= 599 else None,
            'provider_code': code if isinstance(code, str) and code in PROVIDER_CODES else None,
            'error': getattr(error, 'category') if getattr(error, 'category', None) in ('timeout','transport') else
                     'cancelled' if isinstance(error, asyncio.CancelledError) else
                     'timeout' if isinstance(error, (TimeoutError, asyncio.TimeoutError)) else
                     safe_error(error.args[0] if getattr(error, 'args', ()) else None)}


class CallTrace:
    def __init__(self, monitor, run_id, *, clock=time.monotonic, origin=None):
        self.monitor, self.run_id, self.clock = monitor, run_id, clock
        self.origin = clock() if origin is None else origin
        self.spans, self.keys, self.usage_seen = {}, {}, set()
        self.partial = False
        self.enabled = True
        self.events = 0
        self.usage_totals = {}
        self.usage_final = False
        self.usage_incomplete = False
        self.first_output_ms = None
        self.response_ends = {}

    def elapsed(self, at=None):
        at = at if type(at) in (int, float) and math.isfinite(at) else self.clock()
        return min(86400000, max(0, round((at - self.origin) * 1000)))

    def gap(self, reason='observation_gap'):
        if not self.partial and self.enabled:
            self.partial = True
            self.monitor.emit(self.run_id, 'trace_gap', error=reason, key='trace-gap')

    def _emit(self, kind, *, at=None, **values):
        if not self.enabled:
            return True
        if self.events >= 256:
            self.gap('trace_limit')
            return False
        self.events += 1
        ok = self.monitor.emit(self.run_id, kind, elapsed_ms=self.elapsed(at), **values)
        if not ok:
            self.gap()
        return ok

    def record(self, phase, start, end):
        if self.events >= 256:
            self.gap('trace_limit')
            return
        self.events += 1
        self.monitor.emit(self.run_id, 'trace_finished', key='record:' + phase,
            span_id=str(uuid.uuid4()), phase=phase, status='completed',
            elapsed_ms=max(0, round((end-self.origin)*1000)), duration_ms=max(0, round((end-start)*1000)))

    def start(self, phase, *, key=None, parent=None, tool_id=None, destination_id=None, at=None):
        if phase not in PHASES:
            raise ValueError('invalid_trace_phase')
        if key is not None and (phase, key) in self.keys:
            return self.keys[(phase, key)]
        detailed = self.events < 255
        if not detailed:
            self.gap('trace_limit')
            if phase != 'tool':
                return None
        span = str(uuid.uuid4())
        self.spans[span] = {'phase': phase, 'parent_span_id': parent,
                            'tool_id': tool_id if tool_id in TOOLS else None,
                            'at': at if type(at) in (int,float) else self.clock(), 'done': False,
                            'key': key, 'destination_id': destination_id, 'detailed': detailed}
        if key is not None:
            self.keys[(phase, key)] = span
        if detailed:
            self._emit('trace_started', key='span:' + span + ':start', span_id=span,
                       at=at, phase=phase, parent_span_id=parent, status='running', tool_id=self.spans[span]['tool_id'])
        return span

    def end(self, span, status='completed', *, at=None, **values):
        record = self.spans.get(span)
        if not record or record['done']:
            return
        record['done'] = True
        measured = min(86400000, max(0, round(((at if type(at) in (int,float) else self.clock())-record['at'])*1000)))
        if record['phase'] == 'tool' and self.enabled:
            kind = 'tool_completed' if status == 'completed' else 'tool_denied' if values.get('error') in ('tool_denied','destination_denied','invalid_arguments') else 'tool_failed'
            ok = self.monitor.emit(self.run_id, kind, key=record['key'] or 'tool-result:'+span,
                span_id=span, parent_span_id=record['parent_span_id'], phase='tool',status=status,
                elapsed_ms=self.elapsed(at),duration_ms=measured,tool_id=record['tool_id'],
                destination_id=record['destination_id'],**values)
            if not ok:
                self.gap()
        if record['detailed']:
            self._emit('trace_finished', key='span:' + span + ':end', span_id=span,
                at=at, parent_span_id=record['parent_span_id'], phase=record['phase'], status=status,
                tool_id=record['tool_id'], duration_ms=measured, **values)

    @asynccontextmanager
    async def measure(self, phase, **values):
        span = self.start(phase, **values)
        try:
            yield span
        except BaseException as exc:
            self.end(span, 'cancelled' if isinstance(exc, asyncio.CancelledError) else 'failed', **error_info(exc))
            raise
        else:
            self.end(span)

    def usage(self, usage, key=None):
        if not isinstance(usage, dict):
            return
        scope = usage.get('scope')
        if scope == 'latest_provider_response':
            if not isinstance(key, str) or not 1 <= len(key) <= 128:
                self.gap()
                return
            if key in self.usage_seen:
                return
            if len(self.usage_seen) >= 4096:
                self.gap('trace_limit')
                return
            self.usage_seen.add(key)
            self.usage_final = True
            self.usage_incomplete |= not all(type(usage.get(k)) is int for k in ('input_tokens','output_tokens'))
            for part in ('input_tokens', 'output_tokens', 'total_tokens'):
                value = usage.get(part)
                if type(value) is int and 0 <= value <= 10**12:
                    field = 'response_' + part
                    self.usage_totals[field] = self.usage_totals.get(field, 0) + value
        elif scope == 'latest_live_session':
            seconds = usage.get('seconds')
            if type(seconds) in (int, float) and math.isfinite(seconds) and 0 <= seconds <= 86400:
                self.usage_totals['live_seconds'] = max(self.usage_totals.get('live_seconds', 0), seconds)
            backend = usage.get('backend')
            if isinstance(backend, dict):
                for part in ('input_tokens', 'output_tokens', 'total_tokens'):
                    value = backend.get(part)
                    if type(value) is int and 0 <= value <= 10**12:
                        field = 'backend_' + part
                        self.usage_totals[field] = max(self.usage_totals.get(field, 0), value)
            self.usage_final |= usage.get('final') is True

    def response(self, ident, *, started=False, status=None, at=None):
        if not isinstance(ident,str) or not 1 <= len(ident) <= 128:
            return
        if started:
            span = self.start("response", key=ident, at=at)
            end = self.response_ends.pop(ident, None)
            if end:
                self.end(span, end[0], at=end[1])
        else:
            state = "completed" if status == "completed" else "failed"
            span = self.keys.get(("response",ident))
            if span:
                self.end(span,state,at=at)
            elif len(self.response_ends) < 4096:
                self.response_ends[ident] = (state,at)
            else:
                self.gap("trace_limit")

    def provider_output(self, at=None):
        if self.first_output_ms is None:
            self.first_output_ms = self.elapsed(at)
            self._emit('provider_output', key='provider-first-output',at=at)

    def finish(self):
        for span, record in list(self.spans.items()):
            if not record['done']:
                if record['phase'] == 'response':
                    self.usage_incomplete = True
                self.end(span, 'cancelled')
        if self.usage_totals and self.enabled:
            self.monitor.emit(self.run_id, 'usage_snapshot', key='usage-final',
                usage_json=json.dumps(self.usage_totals, separators=(',', ':')),
                usage_complete=self.usage_final and not self.partial and not self.usage_incomplete)
        return {'run_duration_ms': self.elapsed(), 'trace_complete': not self.partial and not self.monitor.degraded,
                'first_output_ms': self.first_output_ms}
