"""Temporary staging entry point; the normal runner never imports this file.

Requires a short-lived arm file for one exact synthetic linkedid and one pinned
snapshot hash. All other calls use the unmodified provider factory. Remove the
temporary image/override after the experiment, rather than shipping this entry.
"""
import contextvars
import hashlib
import json
import os
from pathlib import Path
import re
import runpy
import time
from types import SimpleNamespace

from voice_agent import runtime
from voice_agent.providers import create_adapter
from .live_startup import DiagnosticLiveAdapter, DiagnosticWebSocketSession


ROOT = Path('/var/lib/voice-agent')
ARM = ROOT / 'live-diagnostic-arm.json'
_selection = contextvars.ContextVar('live_diagnostic_selection', default=None)


def fingerprint(snapshot):
    return hashlib.sha256(json.dumps(snapshot, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def select_call(call, arm, *, now=None):
    now = time.time() if now is None else now
    if (not isinstance(arm, dict) or set(arm) != {'linkedid', 'agent_channel_id', 'variant', 'expires_at', 'snapshot_sha256', 'label'}
            or not isinstance(arm.get('label'), str) or not re.fullmatch(r'[a-f0-9]{32}', arm['label'])
            or not isinstance(arm.get('linkedid'), str) or not re.fullmatch(r'va[a-f0-9]{28}', arm['linkedid'])
            or not isinstance(arm.get('agent_channel_id'), str) or not re.fullmatch(r'va[a-f0-9]{28}', arm['agent_channel_id'])
            or arm['linkedid'] == arm['agent_channel_id']
            or call.linkedid not in (arm['linkedid'], arm['agent_channel_id'])
            or call.caller_id != arm['agent_channel_id']
            or call.snapshot.get('agent_id') != 'receptionist'
            or arm.get('variant') not in ('current', 'concise', 'primary-ws')
            or type(arm.get('expires_at')) not in (int, float) or not now < arm['expires_at'] <= now + 60
            or call.snapshot.get('conversation', {}).get('model') != 'gpt-live-1'
            or fingerprint(call.snapshot) != arm.get('snapshot_sha256')):
        return None
    return dict(arm)


def read_selection(call):
    try:
        if ARM.stat().st_size <= 2048:
            return select_call(call, json.loads(ARM.read_text()))
    except (OSError, ValueError, TypeError):
        pass
    return None


def record_result(label, measurements):
    result_path = ROOT / ('live-diagnostic-result-' + label + '.json')
    path = result_path.with_suffix('.tmp')
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as stream:
        json.dump(measurements, stream)
    path.replace(result_path)


def factory(binding):
    selection = _selection.get()
    if selection and binding['provider'] == 'openai':
        variant = selection['variant']
        if binding['adapter'] == 'live_ws' and variant == 'primary-ws':
            adapter = DiagnosticWebSocketSession
        elif binding['adapter'] == 'live' and variant in ('current', 'concise'):
            adapter = DiagnosticLiveAdapter
        else:
            raise ValueError('diagnostic_transport_mismatch')
        return adapter(binding, variant=variant, on_close=lambda data: record_result(selection['label'], data))
    return create_adapter(binding)


class ScopedRuntime(runtime.Runtime):
    def __init__(self, storage, controller, adapter_factory=factory):
        super().__init__(storage, controller, adapter_factory=adapter_factory)

    def live_transport(self, caller_id, linkedid, snapshot):
        selection = read_selection(SimpleNamespace(caller_id=caller_id, linkedid=linkedid, snapshot=snapshot))
        if selection and selection['variant'] in ('current', 'concise'):
            return 'live'  # The two sideband comparisons require SIP and its signed webhook.
        return super().live_transport(caller_id, linkedid, snapshot)

    async def converse(self, call):
        selection = read_selection(call)
        owner = call.private_consultation.caller if call.private_consultation else call
        if re.fullmatch(r'va[a-f0-9]{28}', owner.caller_id) and selection is None:
            # Never let a mistimed/mismatched synthetic arm fall through to
            # ordinary transcript retention or an unmeasured provider session.
            await self.finish(call, 'interrupted', 'provider_unavailable', fallback=False)
            return
        token = _selection.set(selection)
        try:
            await super().converse(call)
        finally:
            _selection.reset(token)


def main():
    runtime.Runtime = ScopedRuntime
    runpy.run_module('voice_agent.runner', run_name='__main__')


if __name__ == '__main__':
    main()
