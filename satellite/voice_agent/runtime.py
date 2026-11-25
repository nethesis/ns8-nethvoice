"""Basic Voice call ownership with pinned MariaDB snapshots and bounded handoff."""
import asyncio
import math
import copy
import hmac
import hashlib
import logging
import inspect
import os
import re
import secrets
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from .monitoring import Monitoring, MAX_PENDING, RESERVED
from .drain import admit_work
from .ari import AriHTTPError, new_channel_id
from .telemetry import CallTrace, ACTIVE_SPAN, error_info, safe_error
from .transcripts import Transcripts
from .providers import create_adapter
from .providers.realtime import ProviderError
from .models import conversation_capability
from .contract import validate_snapshot
from .providers.webhook import InvalidPayload, verify_webhook
from .storage import ClaimRejected, trusted_target
from .tools import ToolRegistry, WIRE_IDS, bounded_caller_name


LOG=logging.getLogger(__name__)


@dataclass
class Call:
    session_id: str
    run_id: str
    leg_id: str
    caller_id: str
    snapshot: dict
    binding: dict
    linkedid: str | None
    work_lease: object | None = field(default=None, init=False, repr=False)
    deadline: float = 0
    provider_call_id: str | None = None
    adapter: object | None = None
    tools: object | None = None
    bridge_id: str | None = None
    media_connected: bool = False
    provider_answered: asyncio.Event = field(default_factory=asyncio.Event)
    transfer_done: asyncio.Event = field(default_factory=asyncio.Event)
    transfer_target: dict | None = None
    transfer_destination_id: str | None = None
    transfer_outcome: str | None = None
    transfer_token: str | None = None
    transfer_task: asyncio.Task | None = field(default=None, repr=False)
    transfer_release_requested: bool = False
    transfer_released: bool = False
    transfer_confirmed: bool = False
    ending_by_agent: bool = False
    hangup_deadline: float = 0
    hangup_task: object | None = field(default=None, repr=False)
    caller_left: bool = False
    terminal: bool = False
    finalizer: asyncio.Task | None = field(default=None, repr=False)
    admitted: bool = False
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    tasks: set = field(default_factory=set)
    observed_responses: set = field(default_factory=set)
    started_at: object = field(default_factory=lambda: datetime.now(timezone.utc))
    transcript_keys: set = field(default_factory=set)
    transcript_bytes: int = 0
    caller_number: str | None = field(default=None, repr=False)
    caller_name: str = field(default='', repr=False)
    recent: object | None = field(default=None, repr=False)
    trace: object | None = field(default=None, repr=False)
    webhook_span: str | None = None
    signed_claim: bool = False
    media: object | None = field(default=None, repr=False)
    audio_bridge: object | None = field(default=None, repr=False)
    assistant_snapshot: dict | None = field(default=None, repr=False)
    assistant_binding: dict | None = field(default=None, repr=False)
    consultation: object | None = field(default=None, repr=False)
    voicemail_offer: dict | None = field(default=None, repr=False)
    private_consultation: object | None = field(default=None, repr=False)
    parent_run_id: str | None = None
    consulted_recipients: set = field(default_factory=set, repr=False)
    text_only: bool = False


class Transfer:
    def __init__(self, runtime, call):
        self.runtime, self.call = runtime, call

    async def consultation_answer(self, answer):
        return await self.runtime.consultations.answer(self.call, answer)

    async def voicemail(self, reference):
        call = self.call
        offer = call.voicemail_offer
        if not offer or reference != offer['reference'] or time.monotonic() >= offer['expires_at']:
            return {'error': 'voicemail_unavailable'}
        if call.consultation:
            c = call.consultation
            if c.id != reference or not c.task:
                return {'error': 'voicemail_unavailable'}
            try:
                await asyncio.wait_for(asyncio.shield(c.task), 3)
            except Exception:
                return {'error': 'voicemail_unavailable'}
        if not await self.authorized(offer['destination'], offer['candidate']):
            return {'error': 'destination_denied'}
        try:
            if not await self.voicemail_ready(offer['destination'], offer['recipient_id']):
                return {'error': 'voicemail_unavailable'}
        except Exception:
            return {'error': 'voicemail_unavailable'}
        call.voicemail_offer = None
        return await self._native_transfer(offer['destination'], candidate_ref=offer['candidate'],
                                          voicemail_recipient=offer['recipient_id'])

    async def voicemail_ready(self, destination, recipient_id):
        value = await self.runtime.consultations.client.recipient(destination.split(':', 1)[1])
        return value['recipient_id'] == recipient_id and value.get('voicemail_enabled') is True

    async def hangup(self, reason):
        call = self.call
        binding = next((b for b in call.snapshot.get('tool_bindings', [])
                        if b['tool_id'] == 'telephony.hangup'), None)
        if not binding or not binding['enabled'] or binding['tool_version'] != 1:
            return {'error': 'tool_denied'}
        timeout = binding['config'].get('playback_timeout_seconds')
        if reason not in ('caller_request', 'conversation_complete') or type(timeout) is not int or not 1 <= timeout <= 10:
            return {'error': 'invalid_arguments'}
        async with call.lock:
            if (call.terminal or call.transfer_target or call.consultation or call.ending_by_agent or not call.media_connected
                    or self.runtime.calls.get(call.session_id) is not call):
                return {'error': 'hangup_unavailable'}
            call.ending_by_agent = True
            call.hangup_deadline = min(call.deadline, time.monotonic() + timeout)
            # Independent of provider acknowledgments, retries and tool cancellation.
            call.hangup_task = self.runtime.spawn(self.runtime.end_after_playback(call))
        return {'outcome': 'ending'}

    async def authorized(self, destination_id, candidate_ref=None):
        from .routing import RoutingPolicy
        rows = await asyncio.wait_for(asyncio.to_thread(self.runtime.storage.routing_targets), 5)
        policy = RoutingPolicy(self.call.snapshot)
        if destination_id not in {r['id'] for r in rows if r.get('available', True)}:
            return False
        if candidate_ref is not None:
            return bool(self.call.recent and policy.permits_recent(destination_id)
                and self.call.recent.scope == (self.call.session_id, self.call.snapshot['agent_id'], self.call.snapshot['workflow_version'])
                and self.call.recent.resolve(candidate_ref, rows) == destination_id)
        return policy.permits(destination_id)

    async def transfer(self, destination_id, *, candidate_ref=None, reason=None):
        call = self.call
        if destination_id.startswith('extension:') and call.snapshot.get('consultation', {}).get('mode') == 'attended':
            return await self.runtime.consultations.start(call, destination_id, reason, candidate_ref)
        return await self._native_transfer(destination_id, candidate_ref=candidate_ref)

    async def _native_transfer(self, destination_id, *, candidate_ref=None, voicemail_recipient=None):
        call = self.call
        tool_id = 'pbx.transfer'
        target = trusted_target(destination_id, allow_pbx=True)
        if voicemail_recipient is not None:
            target['context'] = 'voice-agent-voicemail'
        def permitted(rows):
            from .routing import RoutingPolicy
            policy = RoutingPolicy(call.snapshot)
            if candidate_ref is not None:
                return bool(call.recent and policy.permits_recent(destination_id)
                            and call.recent.scope == (call.session_id, call.snapshot['agent_id'], call.snapshot['workflow_version'])
                            and call.recent.resolve(candidate_ref, rows) == destination_id)
            return policy.permits(destination_id) and destination_id in {r['id'] for r in rows if r.get('available', True)}
        async with call.lock:
            if call.terminal or call.transfer_target or call.ending_by_agent or call.consultation:
                return {'error': 'transfer_unavailable'}
            from .routing import RoutingPolicy
            rows = await asyncio.wait_for(asyncio.to_thread(self.runtime.storage.routing_targets), timeout=5)
            if not permitted(rows):
                self.runtime.monitoring.emit(call.run_id, 'tool_denied', error='destination_denied', tool_id=tool_id, destination_id=destination_id,elapsed_ms=self.runtime.trace(call).elapsed())
                return {'error': 'destination_denied'}
            if voicemail_recipient is not None:
                try:
                    if not await self.voicemail_ready(destination_id, voicemail_recipient):
                        return {'error': 'voicemail_unavailable'}
                except Exception:
                    return {'error': 'voicemail_unavailable'}
            call.voicemail_offer = None
            call.transfer_destination_id = destination_id
            call.transfer_target = target
            call.transfer_token = uuid.uuid4().hex
            call.transfer_task = self.runtime.spawn(
                self._run_native_transfer(permitted, voicemail_recipient), call)
        return await asyncio.shield(call.transfer_task)

    async def _run_native_transfer(self, permitted, voicemail_recipient):
        call = self.call
        tool_id = 'pbx.transfer'
        destination_id = call.transfer_destination_id
        self.runtime.monitoring.emit(call.run_id, 'transfer_requested',tool_id=tool_id,destination_id=destination_id,elapsed_ms=self.runtime.trace(call).elapsed())
        span = self.runtime.trace(call).start('transfer', parent=ACTIVE_SPAN.get(), tool_id=tool_id)
        continued = False
        try:
            # Preserve a passive subscription after Stasis ends. The native wrapper
            # acknowledges the exact destination with this one-use private token.
            await self.runtime.controller.subscribe_channel(call.caller_id)
            await self.runtime.controller.set_variable(call.caller_id,'VOICE_AGENT_TRANSFER_TOKEN',call.transfer_token)
            if voicemail_recipient is not None:
                await self.runtime.controller.set_variable(call.caller_id,'AGENT_SESSION_ID',call.session_id)
            await self.runtime.quiesce_media(call)
            if call.bridge_id:
                await self.runtime.controller.remove_from_bridge(call.bridge_id,[call.caller_id])
            rows = await asyncio.wait_for(asyncio.to_thread(self.runtime.storage.routing_targets), timeout=5)
            error = ('destination_denied' if not permitted(rows) else
                     'voicemail_unavailable' if voicemail_recipient is not None and not await self.voicemail_ready(destination_id, voicemail_recipient) else None)
            if error:
                self.runtime.monitoring.emit(call.run_id, 'tool_denied' if error == 'destination_denied' else 'transfer_failed', error=error, tool_id=tool_id, destination_id=destination_id,elapsed_ms=self.runtime.trace(call).elapsed())
                await self.runtime.finish(call, 'fallback', error, fallback=True)
                return {'error': error}
            call.transfer_release_requested = True
            try:
                await self.runtime.controller.continue_channel(call.caller_id, call.transfer_target)
                continued = True
            except Exception:
                # The native dialplan can run before a lost REST response.
                pass
            await asyncio.wait_for(call.transfer_done.wait(), timeout=10)
            call.trace.end(span, "completed" if call.transfer_outcome == "transferred" else "failed")
        except asyncio.CancelledError:
            if call.transfer_outcome == 'transferred':
                call.trace.end(span, 'completed')
            else:
                call.trace.end(span, 'cancelled', error='transfer_cancelled')
                self.runtime.monitoring.emit(call.run_id,'transfer_uncertain',error='transfer_cancelled',tool_id=tool_id,destination_id=destination_id,elapsed_ms=self.runtime.trace(call).elapsed())
            await self.runtime.finish(call, 'failed', 'transfer_cancelled', fallback=not call.transfer_release_requested)
            raise
        except Exception:
            if call.transfer_outcome != 'transferred':
                call.trace.end(span, 'failed', error='transfer_unconfirmed')
                self.runtime.monitoring.emit(call.run_id, 'transfer_uncertain', error='transfer_unconfirmed',tool_id=tool_id,destination_id=destination_id,elapsed_ms=self.runtime.trace(call).elapsed())
                fallback = not call.transfer_release_requested
                if call.transfer_release_requested and not continued and not call.caller_left:
                    try:
                        fallback = await asyncio.wait_for(self.runtime.controller.caller_in_stasis(
                            call.caller_id, call.snapshot['agent_id']), timeout=2) is True
                    except Exception:
                        pass
                await self.runtime.finish(call, 'failed', 'transfer_unconfirmed', fallback=fallback)
                return {'error': 'transfer_uncertain'}
            call.trace.end(span, 'completed')
        if call.transfer_outcome == 'transferred':
            await self.runtime.finish(call, 'transferred', fallback=False)
            return {'outcome': 'transferred'}
        error = 'voicemail_unavailable' if voicemail_recipient is not None else 'transfer_failed'
        self.runtime.monitoring.emit(call.run_id, 'transfer_failed', error=error,tool_id=tool_id,destination_id=destination_id,elapsed_ms=self.runtime.trace(call).elapsed())
        await self.runtime.finish(call, 'failed', error, fallback=voicemail_recipient is not None)
        return {'error': error}


class Runtime:
    def __init__(self, storage, controller, adapter_factory=create_adapter):
        self.storage, self.controller, self.adapter_factory = storage, controller, adapter_factory
        self.monitoring = Monitoring(storage)
        self.transcripts = Transcripts(storage, self.monitoring)
        self.calls = {}
        self.admitting = set()
        self.admissions = {}
        self.tasks = set()
        self._cleanup_tasks = set()
        self.sip_lab_enabled = os.getenv('VOICE_AGENT_SIP_LAB_ENABLED') == 'true'
        self.invalid_webhook_signatures = 0
        self.reserved_adapters = {}
        self.controller.on_event = self.event
        self.controller.on_disconnect = self.disconnected
        self.stopping = False
        from .consultation import Consultations
        self.consultations = Consultations(self)

    def trace(self, call):
        if call.trace is None:
            call.trace = CallTrace(self.monitoring, call.run_id)
        return call.trace

    async def heartbeat(self):
        while not self.stopping:
            health = self.monitoring.health()
            health.update(ari_connected=bool(self.controller.connected), active_calls=len(self.calls),
                          invalid_webhook_signatures=self.invalid_webhook_signatures)
            try:
                await asyncio.to_thread(self.storage.health, health)
            except Exception:
                self.monitoring.mark_degraded()
            await asyncio.sleep(15)

    def spawn(self, coroutine, call=None):
        task = asyncio.create_task(coroutine)
        self.tasks.add(task)
        task.add_done_callback(self.tasks.discard)
        if call:
            call.tasks.add(task)
            task.add_done_callback(call.tasks.discard)
        return task

    async def owned_resource(self, call, operation, cleanup):
        """An ARI timeout/cancellation is not proof that creation was aborted."""
        task = asyncio.create_task(operation)
        try:
            result = await asyncio.shield(task)
        except asyncio.CancelledError:
            async def reap():
                # Even a failed response can follow a successful creation.
                await asyncio.gather(task, return_exceptions=True)
                try:
                    await cleanup()
                except Exception as exc:
                    LOG.warning('Late ARI resource cleanup failed: %s', type(exc).__name__)
            self._start_cleanup(reap())
            raise
        except Exception:
            # The server may have committed before the response was lost. IDs
            # were generated for this call, so cleanup is safe even on a 404.
            await cleanup()
            raise
        if call.terminal:
            await cleanup()
            raise asyncio.CancelledError
        return result

    def _start_cleanup(self, operation):
        task = asyncio.create_task(operation)
        self._cleanup_tasks.add(task)
        task.add_done_callback(self._cleanup_tasks.discard)
        return task

    async def _drain_cleanup(self):
        while self._cleanup_tasks:
            await asyncio.shield(asyncio.gather(*self._cleanup_tasks, return_exceptions=True))

    async def start(self):
        try:
            await asyncio.wait_for(asyncio.to_thread(self.storage.recover), timeout=10)
        except Exception:
            self.monitoring.degraded = True
        await self.monitoring.start()
        await self.transcripts.start()
        await self.controller.start()
        self.spawn(self.expire_pending())
        self.spawn(self.heartbeat())

    async def stop(self):
        self.stopping = True
        await self._finish_calls('runtime_stopped')
        for task in list(self.tasks):
            task.cancel()
        await asyncio.gather(*list(self.tasks), return_exceptions=True)
        await self._drain_cleanup()
        await self.controller.stop()
        await self.transcripts.stop()
        await self.monitoring.stop()

    async def event(self, event):
        kind = event.get('type')
        if kind == 'AgentAriConnected':
            # A media channel has no voice-agent-provider dialplan context.
            # Match persisted ownership and trusted channel markers instead.
            try:
                owned_media, owned_sessions = await asyncio.wait_for(asyncio.gather(
                    asyncio.to_thread(self.storage.media_ownership),
                    asyncio.to_thread(self.storage.consultation_ownership),
                ), timeout=4)
            except Exception as exc:
                LOG.warning('Voice agent ownership recovery unavailable: %s', type(exc).__name__)
                return
            # Only recover channels belonging to this app and these generated contexts.
            for channel in await self.controller.list_channels():
                session = owned_media.get(channel['id']) if isinstance(owned_media, dict) else None
                if (session and not any(c.leg_id == channel['id'] for c in self.calls.values())
                        and await self.controller.get_variable(channel['id'], 'AGENT_SESSION_ID') == session
                        and await self.controller.get_variable(channel['id'], 'VOICE_AGENT_TRANSPORT') == 'live_ws'):
                    await self.controller.hangup(channel['id'])
                    continue
                dialplan = channel.get('dialplan') or {}
                context = dialplan.get('context', '')
                if dialplan.get('app_name') != 'Stasis' or not str(dialplan.get('app_data','')).startswith('voice-agent,'):
                    continue
                if (context in ('voice-agent-consult','stasis-voice-agent')
                        and re.fullmatch(r'Local/[0-9]{1,20}@voice-agent-consult-[a-f0-9]+;1',channel.get('name',''))
                        and await self.controller.get_variable(channel['id'],'AGENT_ROLE') == 'consult'
                        and await self.controller.get_variable(channel['id'],'AGENT_SESSION_ID') in owned_sessions
                        and re.fullmatch(r'[a-f0-9]{32}',await self.controller.get_variable(channel['id'],'AGENT_CONSULT_ATTEMPT') or '')
                        and channel['id'] not in self.consultations.channels):
                    await self.controller.hangup(channel['id'])
                    continue
                if context in ('voice-agent-consult','voice-agent-handoff','voice-agent-handoff-wait','voice-agent-voicemail'):
                    continue
                if context == 'voice-agent-provider':
                    if not any(c.leg_id == channel['id'] for c in self.calls.values()):
                        await self.controller.hangup(channel['id'])
                    continue
                if not re.fullmatch(r'voice-agent-[a-z][a-z0-9_-]{0,47}', context):
                    continue
                # New Stasis callers can appear while recovery is running.
                agent_id = context.removeprefix('voice-agent-')
                if (dialplan.get('app_data') == f'voice-agent,caller,{agent_id}'
                        and await self.controller.get_variable(channel['id'], 'VOICE_AGENT_ID') == agent_id
                        and channel['id'] not in self.admitting
                        and not any(c.caller_id == channel['id'] for c in self.calls.values())):
                    await self.controller.continue_channel(channel['id'], {'context':context,'extension':'s','label':'fallback'})
            owned_bridges = {'livews-' + session for session in owned_media.values()}
            owned_bridges.update('sip-' + session for session in owned_sessions)
            owned_bridges.difference_update(c.bridge_id for c in self.calls.values())
            if owned_bridges:
                bridges = await self.controller.list_bridges()
                if isinstance(bridges, list):
                    for bridge in bridges:
                        if bridge.get('id') in owned_bridges and bridge.get('channels') == []:
                            await self.controller.destroy_bridge(bridge['id'])
            return
        channel = event.get('channel') or {}
        channel_id = channel.get('id')
        if await self.consultations.event(event):
            return
        if kind == 'StasisStart':
            args = event.get('args') or []
            if not isinstance(args,list) or not all(isinstance(value,str) for value in args):
                await self.controller.continue_channel(channel_id)
                return
            if len(args) == 3 and args[0] == 'voicemail_failed':
                call = self.calls.get(args[1])
                if (call and not call.terminal and channel_id == call.caller_id
                        and call.transfer_target and call.transfer_target['context'] == 'voice-agent-voicemail'
                        and call.transfer_token and args[2].isascii() and hmac.compare_digest(args[2],call.transfer_token)):
                    call.caller_left = call.transfer_released = False
                    call.transfer_outcome = 'failed'
                    call.transfer_done.set()
                else:
                    await self.controller.hangup(channel_id)
            elif len(args) == 2 and args[0] == 'caller':
                if channel_id not in self.admitting and not any(c.caller_id == channel_id for c in self.calls.values()):
                    if len(self.admitting) >= 32 or self.stopping or not self.controller.connected:
                        await self.controller.continue_channel(channel_id)
                        return
                    self.admitting.add(channel_id)
                    self.admissions[channel_id] = self.spawn(self.admit(channel, args[1]))
            elif len(args) == 2 and args[0] in ('provider', 'media'):
                call = self.calls.get(args[1])
                expected = 'media' if call and call.binding.get('adapter') == 'live_ws' else 'provider'
                if call and not call.terminal and channel_id == call.leg_id and args[0] == expected:
                    call.provider_answered.set()
                else:
                    await self.controller.hangup(channel_id)
            else:
                await self.controller.continue_channel(channel_id)
        elif kind == 'ChannelUserevent' and event.get('eventname') == 'VoiceAgentTransfer':
            call = next((c for c in self.calls.values() if channel_id == c.caller_id), None)
            body = event.get('userevent') or {}
            if call and not call.terminal and call.transfer_target and isinstance(body,dict):
                token = body.get('token')
                if (isinstance(token,str) and token.isascii() and call.transfer_token
                        and hmac.compare_digest(token,call.transfer_token) and body.get('destination_id') == call.transfer_destination_id
                        and (body.get('mode') == 'voicemail') == (call.transfer_target['context'] == 'voice-agent-voicemail')):
                    call.transfer_confirmed = True
                    if call.transfer_released:
                        call.transfer_outcome = 'transferred'
                        call.transfer_done.set()
        elif kind in ('StasisEnd', 'ChannelDestroyed'):
            call = next((c for c in self.calls.values() if channel_id in (c.caller_id, c.leg_id)), None)
            if call and channel_id == call.caller_id:
                call.caller_left = True
            if not call or call.terminal:
                if channel_id in self.admissions:
                    self.admissions[channel_id].cancel()
                return
            if channel_id == call.caller_id and call.transfer_target:
                if kind == 'StasisEnd':
                    call.transfer_released = True
                    if call.transfer_confirmed:
                        call.transfer_outcome = 'transferred'
                        call.transfer_done.set()
                elif not (call.transfer_released and call.transfer_confirmed):
                    call.transfer_outcome = 'failed'
                    call.transfer_done.set()
            elif channel_id == call.caller_id:
                if call.media_connected:
                    self.spawn(self.finish(call, 'completed', fallback=False), call)
                else:
                    self.spawn(self.finish(call,'interrupted','caller_cancelled_before_connect',fallback=False),call)
            else:
                reason='provider_disconnected'
                cause=event.get('cause')
                if isinstance(cause,int) and 0<cause<128: reason=f'provider_hangup_{cause}'
                LOG.warning('Voice agent phase=provider_channel error_code=%s',reason)
                self.spawn(self.finish(call, 'fallback', reason, fallback=True), call)

    def capacity_available(self, adapter):
        # Both inbound admissions and private consultations run on this event loop.
        adapters = [call.binding.get('adapter') for call in self.calls.values()]
        adapters.extend(self.reserved_adapters.values())
        if len(adapters) >= 32:
            return False
        if adapter != 'live_ws':
            return True
        value = os.getenv('VOICE_AGENT_LIVE_WS_MAX_CALLS') or '2'
        limit = int(value) if re.fullmatch(r'[0-9]{1,2}', value) else 0
        return adapters.count('live_ws') < min(limit, 32)

    def live_transport(self, caller_id, linkedid, snapshot):
        return 'live_ws'

    def load_snapshot(self, agent_id):
        return validate_snapshot(self.storage.snapshot(agent_id))

    async def admit(self, channel, agent_id):
        call = None
        origin = time.monotonic()
        origin_at = datetime.now(timezone.utc)
        observations = []
        stage='snapshot'
        lease = None
        try:
            lease = admit_work()
            if lease is None:
                await self.controller.continue_channel(channel['id'])
                return
            if not re.fullmatch(r'[a-z][a-z0-9_-]{0,47}', agent_id):
                raise ValueError('invalid_agent')
            if (channel.get('dialplan') or {}).get('context') != 'voice-agent-' + agent_id:
                raise ValueError('invalid_entrypoint')
            await self.controller.set_variable(channel['id'], 'VOICE_AGENT_ID', agent_id)
            snapshot = await asyncio.wait_for(asyncio.to_thread(self.load_snapshot, agent_id), timeout=5)
            if snapshot.get('role') == 'consultation':
                raise ValueError('internal_agent_not_public')
            observations.append(('snapshot', origin, time.monotonic()))
            if len(self.monitoring.pending) >= MAX_PENDING - RESERVED:
                raise ValueError('monitoring_capacity_exceeded')
            stage='binding'
            binding_started = time.monotonic()
            binding = await asyncio.wait_for(asyncio.to_thread(self.storage.binding, snapshot['provider_binding_id']), timeout=5)
            if binding['provider'] != snapshot['provider']:
                raise ValueError('provider_mismatch')
            capability = conversation_capability(snapshot['provider'], snapshot['conversation'])
            binding = {**binding, 'model': snapshot['conversation']['model'], 'adapter': capability['adapter']}
            linkedid = await self.controller.get_variable(channel['id'], 'CHANNEL(linkedid)')
            if linkedid is not None and (not isinstance(linkedid, str) or len(linkedid) > 128 or not linkedid.isascii()):
                linkedid = None
            if binding['adapter'] == 'live':
                binding['adapter'] = self.live_transport(channel['id'], linkedid, snapshot)
            if binding['adapter'] != 'live_ws' and not self.sip_lab_enabled:
                raise ValueError('sip_lab_disabled')
            observations.append(('binding', binding_started, time.monotonic()))
            call = Call(str(uuid.uuid4()), str(uuid.uuid4()), new_channel_id(), channel['id'], copy.deepcopy(snapshot), copy.deepcopy(binding), linkedid)
            if not self.capacity_available(binding['adapter']):
                try:
                    await asyncio.wait_for(asyncio.to_thread(self.storage.admit, call, capacity_fallback=True), 3)
                except Exception:
                    self.monitoring.mark_degraded()
                # The dialplan resumes at its native fallback after Stasis.
                call = None
                await self.controller.continue_channel(channel['id'])
                return
            self.reserved_adapters[channel['id']] = binding['adapter']
            if binding.get('adapter') == 'live_ws':
                call.leg_id = 'vw' + secrets.token_hex(14)
            call.started_at = origin_at
            call.trace = CallTrace(self.monitoring, call.run_id, origin=origin)
            call.deadline = time.monotonic()+snapshot['max_call_duration_seconds']
            from .recent_callers import RecentCallerResolver, normalize_number
            call.caller_number = normalize_number((channel.get('caller') or {}).get('number'))
            call.caller_name = bounded_caller_name((channel.get('caller') or {}).get('name'))
            if snapshot.get('consultation', {}).get('mode') == 'attended':
                try:
                    assistant = await asyncio.wait_for(asyncio.to_thread(
                        self.load_snapshot, snapshot['consultation']['assistant_id']), timeout=5)
                    if assistant.get('role') != 'consultation':
                        raise ValueError('invalid_internal_assistant')
                    internal_binding = await asyncio.wait_for(asyncio.to_thread(self.storage.binding, assistant['provider_binding_id']), 5)
                    if internal_binding['provider'] != assistant['provider']:
                        raise ValueError('provider_mismatch')
                    capability = conversation_capability(assistant['provider'], assistant['conversation'])
                    if capability['adapter'] != 'live' and not self.sip_lab_enabled:
                        raise ValueError('sip_lab_disabled')
                    call.assistant_snapshot = assistant
                    call.assistant_binding = {**internal_binding, 'model': assistant['conversation']['model'], 'adapter': 'live_ws' if capability['adapter'] == 'live' else capability['adapter']}
                except Exception:
                    # A missing consultation component must not reject a working
                    # Receptionist session or silently authorize direct transfer.
                    call.assistant_snapshot = call.assistant_binding = None
            call.recent = RecentCallerResolver(snapshot, call.caller_number, self.storage.recent_calls,
                                              (call.session_id, snapshot['agent_id'], snapshot['workflow_version']))
            # Durable correlation exists before SIP origination or webhook acceptance.
            stage='run_storage'
            await asyncio.wait_for(asyncio.to_thread(self.storage.admit, call), timeout=10)
            call.admitted=True
            if self.stopping or not self.controller.connected:
                reason = 'runtime_stopped' if self.stopping else 'ari_disconnected'
                await self.finish(call, 'interrupted', reason, fallback=True)
                return
            for phase, start, end in observations:
                call.trace.record(phase, start, end)
            call.trace.record('admission', origin, time.monotonic())
            if binding.get('adapter') != 'live_ws':
                call.webhook_span = call.trace.start('webhook_wait')
            self.calls[call.session_id] = call
            call.work_lease, lease = lease, None
            self.reserved_adapters.pop(channel['id'], None)
            if asyncio.current_task() in self.tasks:
                call.tasks.add(asyncio.current_task())
            stage='tool_catalog'
            definitions=await asyncio.wait_for(asyncio.to_thread(self.storage.tools),timeout=5)
            call.tools = await asyncio.to_thread(
                ToolRegistry, snapshot, self.storage.routing_targets, Transfer(self, call), definitions, recent=call.recent)
            if call.terminal:
                return
            self.monitoring.emit(call.run_id, 'admitted',elapsed_ms=self.trace(call).elapsed())
            self.spawn(self.deadline(call, 30, setup=True), call)
            self.spawn(self.deadline(call, max(0,call.deadline-time.monotonic())), call)
            if binding.get('adapter') == 'live_ws':
                self.spawn(self.converse(call), call)
                return
            user = binding.get('openai_project_id') if binding['provider'] == 'openai' else binding.get('grok_phone_number')
            if not isinstance(user, str) or not re.fullmatch(r'proj_[A-Za-z0-9_-]+|\+[1-9][0-9]{1,14}', user):
                raise ValueError('invalid_provider_user')
            variables = {'__AGENT_SESSION_ID':call.session_id,'__AGENT_PROVIDER_LEG_ID':call.leg_id,
                         '__VOICE_AGENT_ID':agent_id,'__AGENT_PROVIDER_HOST':'sip.api.openai.com' if binding['provider']=='openai' else 'sip.voice.x.ai','__AGENT_PROVIDER_USER':user,'__AGENT_PROVIDER_TRUNK':binding['trunk_name']}
            stage='origination'
            async with call.trace.measure('origination'):
                await self.owned_resource(call, self.controller.originate_local(call.session_id, call.leg_id, variables),
                                          lambda: self.controller.hangup(call.leg_id))
        except asyncio.CancelledError:
            if call:
                await self.finish(call, 'interrupted', 'setup_cancelled', fallback=True)
            raise
        except Exception as error:
            LOG.warning('Voice agent phase=%s error_class=%s',stage,type(error).__name__)
            if call:
                await self.finish(call, 'fallback', 'setup_'+stage+'_failed', fallback=True)
            else:
                try:
                    await self.controller.continue_channel(channel['id'])
                except Exception:
                    pass
        finally:
            if lease is not None:
                lease.close()
            self.reserved_adapters.pop(channel['id'], None)
            self.admitting.discard(channel['id'])
            self.admissions.pop(channel['id'],None)

    async def expire_pending(self):
        while not self.stopping:
            await asyncio.sleep(10)
            try:
                await asyncio.wait_for(asyncio.to_thread(self.storage.expire_pending),timeout=5)
            except Exception:
                self.monitoring.degraded=True

    async def duration_notice(self, call, delay):
        await asyncio.sleep(delay)
        if not call.media_connected or call.terminal or call.transfer_release_requested or not call.adapter:
            return
        language = call.snapshot['conversation']['language']
        notice = ('Abbiamo raggiunto il limite di tempo della chiamata. La conversazione con l’assistente sta per terminare.'
                  if language.split('-')[0] == 'it' else
                  'We have reached the call time limit. This conversation with the assistant will end shortly.')
        instruction = f'In the configured language ({language}), briefly tell the caller: {notice}'
        try:
            if call.consultation:
                await self.consultations.notice(call.consultation, instruction, restore_hold=True)
            else:
                await call.adapter.consultation_say(instruction)
        except Exception:
            pass  # The independent hard deadline owns fallback.

    async def deadline(self, call, seconds, setup=False):
        if not setup and seconds > 0 and not call.private_consultation:
            self.spawn(self.duration_notice(call, max(0, seconds - 10)), call)
        await asyncio.sleep(seconds)
        if not call.terminal and (not setup or not call.media_connected):
            await self.finish(call, 'fallback', 'setup_timeout' if setup else 'duration_exceeded', fallback=True)

    async def webhook(self, provider, raw, headers):
        if provider not in ('openai', 'grok'):
            raise ValueError('invalid_provider')
        verified = []
        envelope = None
        for call in list(self.calls.values()):
            if call.terminal or call.binding['provider'] != provider or call.binding.get('adapter') == 'live_ws':
                continue
            try:
                envelope = verify_webhook(call.binding.get('webhook_secret'), raw, headers)
                verified.append(call)
            except InvalidPayload:
                raise
            except ValueError:
                pass
        if envelope is None:
            self.invalid_webhook_signatures += 1
            raise ValueError('invalid_webhook')
        kind=envelope.get('type')
        if kind not in ('realtime.call.incoming','live.transport.incoming','live.call.incoming'):
            return {'status':'ignored'}
        data = envelope.get('data') or {}
        if not isinstance(data, dict) or not isinstance(data.get('sip_headers'), list):
            return {'status':'ignored'}
        sip = {}
        if len(data['sip_headers'])>128: return {'status':'ignored'}
        correlation_headers={'x-os-session-id','x-os-provider-leg-id','x-os-agent-id'}
        for item in data['sip_headers']:
            if not isinstance(item, dict) or not isinstance(item.get('name'),str) or not isinstance(item.get('value'),str):
                return {'status':'ignored'}
            name = item['name'].lower()
            if name not in correlation_headers: continue
            if name in sip:
                return {'status':'ignored'}
            sip[name] = item['value']
        call = self.calls.get(sip.get('x-os-session-id'))
        live=bool(call and call.binding.get('adapter')=='live')
        if live:
            if kind=='live.transport.incoming' and data.get('type')!='sip': return {'status':'ignored'}
            if kind=='live.call.incoming' and data.get('type') not in (None,'sip'): return {'status':'ignored'}
            if kind not in ('live.transport.incoming','live.call.incoming'): return {'status':'ignored'}
        elif kind!='realtime.call.incoming': return {'status':'ignored'}
        call_id = data.get('session_id' if live else 'call_id')
        if call not in verified or sip.get('x-os-provider-leg-id') != call.leg_id or sip.get('x-os-agent-id') != call.snapshot['agent_id'] or not isinstance(call_id,str) or not 1<=len(call_id)<=128 or not call_id.isascii() or any(ord(char)<32 or ord(char)==127 for char in call_id):
            return {'status':'ignored'}
        async with call.lock:
            if call.terminal:
                return {'status':'ignored'}
            if call.provider_call_id:
                return {'status':'duplicate' if hmac.compare_digest(call.provider_call_id,call_id) else 'ignored'}
            try:
                await asyncio.wait_for(asyncio.to_thread(self.storage.accept,call,call_id),timeout=5)
            except ClaimRejected:
                return {'status':'ignored'}
            except Exception as error:
                raise ConnectionError('claim_storage_unavailable') from error
            call.provider_call_id = call_id
            call.signed_claim = True
            self.trace(call).end(call.webhook_span)
        self.spawn(self.converse(call), call)
        return {'status':'accepted'}

    async def confirm_signing_secret(self, binding):
        try:
            await asyncio.wait_for(asyncio.to_thread(self.storage.verify_signing_secret, binding), 5)
        except Exception:
            self.monitoring.mark_degraded()

    async def converse(self, call):
        stage='provider_accept'
        trace = self.trace(call)
        stream_span = None
        try:
            call.adapter = self.adapter_factory(call.binding)
            profile = dict(call.snapshot['conversation'])
            profile['model'] = call.binding['model']
            profile['prompt'] = profile.pop('instructions')
            async with trace.measure('routing_context'):
                routing_context=await call.tools.routing_context()
            profile['_opening_instructions']=call.tools.opening_instructions(profile['greeting'],profile['language'],call.caller_name)
            profile['_private_consultation'] = call.private_consultation is not None
            if call.binding.get('adapter') in ('live', 'live_ws'):
                profile['_routing_context']=routing_context
                # Live speaks the opening itself; its delegated backend owns directory data.
                profile['prompt'] += '\n\n' + call.tools.capability_context()
                profile['prompt'] += '\n\n' + call.tools.recent_callback_context()
            else:
                profile['prompt'] += '\n\n' + routing_context
            profile['prompt'] += '\n\n' + call.tools.hangup_context()
            if call.binding.get('adapter') in ('live', 'live_ws'):
                profile['_routing_context'] += '\n\n' + call.tools.hangup_context()
            profile['_capture_transcripts'] = call.snapshot.get('debug', {}).get('transcription_enabled') is True
            if call.binding.get('adapter') == 'live_ws':
                from .media import AudioBridge
                stage = 'media_prepare'
                media_step = 'create_channel'
                async with trace.measure(stage):
                    await self.owned_resource(call,
                        self.controller.create_media_channel(call.session_id, call.leg_id, call.snapshot['agent_id']),
                        lambda: self.controller.hangup(call.leg_id))
                    if call.terminal:
                        await self.controller.hangup(call.leg_id)
                        return
                    media_step = 'connect_channel'
                    media = await self.controller.connect_media_channel(call.leg_id)
                    call.media = media
                    if call.terminal:
                        await media.close()
                        await self.controller.hangup(call.leg_id)
                        return
                    self.spawn(self.watch_media(call), call)
                    media_step = 'create_bridge'
                    call.bridge_id = 'livews-' + call.session_id
                    await self.owned_resource(call, self.controller.create_bridge(call.bridge_id),
                                              lambda: self.controller.destroy_bridge(call.bridge_id))
                    media_step = 'add_to_bridge'
                    await self.controller.add_to_bridge(call.bridge_id, [call.caller_id, call.leg_id])
                    media.enable_input()
                stage = 'provider_start'
                async with trace.measure(stage):
                    provider_id = await asyncio.wait_for(call.adapter.start(profile, call.tools.advertised()), 15)
                    if call.terminal:
                        return
                    await asyncio.wait_for(asyncio.to_thread(self.storage.accept, call, provider_id), 5)
                    call.provider_call_id = provider_id
                    if call.terminal:
                        return
                call.audio_bridge = AudioBridge(media, call.adapter,
                    lambda code: self.spawn(self.finish(call, 'fallback', code, fallback=True), call))
                call.audio_bridge.start()
            else:
                async with trace.measure('provider_accept'):
                    await asyncio.wait_for(call.adapter.accept(call.provider_call_id, profile, call.tools.advertised()), timeout=15)
                stage='provider_sideband'
                async with trace.measure('provider_sideband'):
                    await asyncio.wait_for(call.adapter.connect(call.provider_call_id), timeout=15)
                stage='provider_answer'
                async with trace.measure('provider_answer'):
                    await asyncio.wait_for(call.provider_answered.wait(),timeout=20)
                if call.terminal:
                    return
                stage='media_bridge'
                async with trace.measure('media_bridge'):
                    call.bridge_id = 'sip-' + call.session_id
                    await self.owned_resource(call, self.controller.create_bridge(call.bridge_id),
                                              lambda: self.controller.destroy_bridge(call.bridge_id))
                    await self.controller.add_to_bridge(call.bridge_id, [call.caller_id,call.leg_id])
            self.monitoring.emit(call.run_id,'provider_connected',elapsed_ms=self.trace(call).elapsed())
            # The runtime owns the deadline and must route fallback while the caller
            # is still alive. Asterisk is only a bounded failure watchdog.
            stage = 'media_bridge'
            await self.controller.set_variable(call.caller_id,'TIMEOUT(absolute)',max(1,math.ceil(call.deadline-time.monotonic())+5))
            call.media_connected = True
            if call.signed_claim and call.binding['provider'] == 'openai':
                self.spawn(self.confirm_signing_secret(call.binding))
            self.monitoring.emit(call.run_id,'media_connected',elapsed_ms=trace.elapsed())
            self.spawn(self.greet(call,profile['_opening_instructions']),call)
            stage='provider_stream'
            stream_span = trace.start('provider_stream')
            async for event in call.adapter.events():
                if call.terminal:
                    break
                self.observe(call, event)
                if event.get('type') == 'input_speech' and call.private_consultation:
                    call.private_consultation.colleague_spoke = True
                if event.get('type') == 'closed':
                    await self.finish(call, 'fallback', 'provider_disconnected', fallback=True)
                    break
                if event.get('type')=='response_done' and event.get('status')=='completed':
                    response_id=event.get('response_id')
                    if isinstance(response_id,str) and len(response_id)<=128 and response_id not in call.observed_responses and len(call.observed_responses)<32:
                        call.observed_responses.add(response_id)
                        self.monitoring.emit(call.run_id,'response_completed',key='response:'+response_id,elapsed_ms=self.trace(call).elapsed())
                if event.get('type') == 'error':
                    failure = ProviderError(safe_error(event.get('code')))
                    failure.provider_code = event.get('provider_code')
                    raise failure
                if event.get('type') == 'transcript':
                    try:
                        self.transcripts.capture(call, event)
                    except Exception:
                        self.transcripts.failed(call)
                if event.get('type') == 'monitoring_gap':
                    trace.gap()
                if event.get('type') in ('transcript_failed', 'monitoring_gap') and profile['_capture_transcripts']:
                    self.transcripts.failed(call)
                if event.get('type') == 'tool_call':
                    if len(call.tasks)>=32 or len(self.tasks)>=512:
                        raise ValueError('tool_capacity_exceeded')
                    self.spawn(self.handle_tool(call,event),call)
            trace.end(stream_span,'cancelled' if call.terminal else 'failed',error=None if call.terminal else 'provider_disconnected')
            if not call.terminal:
                await self.finish(call,'fallback','provider_disconnected',fallback=True)
        except asyncio.CancelledError:
            raise
        except Exception as error:
            trace.end(stream_span, 'failed', **error_info(error))
            status=getattr(error,'http_status',None)
            code=stage+'_failed'
            if not isinstance(error, AriHTTPError) and isinstance(status, int) and 400 <= status < 600:
                code = 'provider_http_' + str(status)
            if stage == 'media_prepare':
                LOG.warning('Voice agent phase=media_prepare step=%s http_status=%s', media_step, status)
            LOG.warning('Voice agent phase=%s error_code=%s error_class=%s provider_code=%s provider_param=%s',stage,code,type(error).__name__,getattr(error,'provider_code','none'),getattr(error,'provider_param','none'))
            await self.finish(call,'fallback',code,fallback=True)

    def observe(self, call, event):
        trace = self.trace(call)
        kind = event.get('type')
        if kind == 'usage':
            trace.usage(event.get('usage'), event.get('observation_key'))
        elif kind == 'audio_started':
            trace.provider_output(event.get('_observed_at'))
        elif kind == 'audio_signal':
            observed = event['_observed_at']
            trace.record('provider_audio', observed, observed)
        elif kind in ('response_started','response_done'):
            trace.response(event.get('response_id'), started=kind=='response_started',
                           status=event.get('status'), at=event.get('_observed_at'))
        elif kind == 'monitoring_gap':
            trace.gap()

    async def greet(self,call,instructions):
        try:
            async with self.trace(call).measure('greeting'):
                await call.adapter.respond(instructions)
        except Exception:
            await self.finish(call,'fallback','provider_unavailable',fallback=True)

    async def watch_media(self, call):
        await call.media.failed.wait()
        if not call.terminal:
            await self.finish(call, 'fallback', call.media.error, fallback=True)

    async def quiesce_media(self, call):
        if call.audio_bridge:
            bridge = call.audio_bridge
            if not bridge.stopped:
                marks = getattr(call.adapter, 'startup_marks', {})
                timings = {key: self.trace(call).elapsed(at) for key, at in marks.items()}
                LOG.info('Live audio run=%s startup_ms=%s real_frames=%d silence_frames=%d '
                         'max_input_gap_ms=%d max_real_input_gap_ms=%d',
                         call.run_id, timings, bridge.input_real_frames, bridge.input_silence_frames,
                         bridge.max_input_gap_ms, bridge.max_real_input_gap_ms)
            await bridge.stop()
        elif call.media:
            if call.adapter and hasattr(call.adapter, 'stop_audio'):
                call.adapter.stop_audio()
            await call.media.flush()

    async def handle_tool(self,call,event):
        trace = self.trace(call)
        span = None
        token = None
        try:
            name = event.get('name')
            tool_id = 'pbx.transfer' if name == 'nv_consultation_voicemail_v1' else WIRE_IDS.get(name, name if name in WIRE_IDS.values() else None)
            arguments = event.get('arguments')
            destination = arguments.get('destination_id') if isinstance(arguments, dict) and tool_id == 'pbx.transfer' else None
            if not isinstance(destination, str) or not re.fullmatch(r'(extension|queue|ivr):[0-9]{1,20}', destination):
                destination = None
            span = trace.start('tool', key=str(event.get('invocation_id')), tool_id=tool_id, destination_id=destination, parent=trace.keys.get(('response',event.get('response_id'))))
            token = ACTIVE_SPAN.set(span)
            self.monitoring.emit(call.run_id,'tool_started',tool_id=tool_id,destination_id=destination,key='started:'+str(event.get('invocation_id')),elapsed_ms=self.trace(call).elapsed())
            result=await call.tools.invoke(event.get('invocation_id'),event.get('name'),event.get('arguments'))
            count=len(result['destinations']) if isinstance(result.get('destinations'),list) else None
            if isinstance(result.get('candidates'),list):
                count=len(result['candidates'])
            trace.end(span, 'failed' if result.get('error') else 'completed', error=result.get('error'),result_count=count)
            if result.get('error'):
                kind='tool_denied' if result['error'] in ('tool_denied','destination_denied','invalid_arguments') else 'tool_failed'
                self.monitoring.emit(call.run_id,kind,error=result['error'],tool_id=tool_id,destination_id=destination,key=str(event.get('invocation_id')),elapsed_ms=self.trace(call).elapsed())
            else:
                count=len(result['destinations']) if isinstance(result.get('destinations'),list) else None
                if isinstance(result.get('candidates'), list):
                    count = len(result['candidates'])
                self.monitoring.emit(call.run_id,'tool_completed',tool_id=tool_id,destination_id=destination,key=str(event.get('invocation_id')),result_count=count,elapsed_ms=self.trace(call).elapsed())
            if not call.terminal:
                if tool_id == 'telephony.hangup' and result.get('outcome') == 'ending':
                    try:
                        async with asyncio.timeout(max(0, call.hangup_deadline - time.monotonic())):
                            await call.adapter.send_result(event['invocation_id'], result)
                            await call.adapter.respond('Say only a brief goodbye in the configured language, then stop.',
                                                       response_id=event.get('response_id'))
                    except Exception:
                        # Speech is best effort; the runtime deadline still ends
                        # the call without fallback when the provider stalls.
                        pass
                    await asyncio.shield(call.hangup_task)
                else:
                    await call.adapter.send_result(event['invocation_id'],result)
                    if result.get('outcome') == 'consulting':
                        await self.consultations.begin(call, response_id=event.get('response_id'))
                    else:
                        await call.adapter.respond(response_id=event.get('response_id'))
        except asyncio.CancelledError:
            trace.end(span, 'cancelled', error='cancelled')
            raise
        except Exception as error:
            trace.end(span, 'failed', **error_info(error))
            await self.finish(call,'fallback','tool_execution_failed',fallback=True)
        finally:
            if token is not None:
                ACTIVE_SPAN.reset(token)

    async def end_after_playback(self, call):
        await asyncio.sleep(max(0, call.hangup_deadline - time.monotonic()))
        await self.finish(call, 'ended_by_agent', fallback=False)

    async def finish(self, call, outcome, error=None, fallback=False, *, join=False):
        async with call.lock:
            transfer = call.transfer_task
            if call.finalizer is not None:
                # Call tasks can re-enter finish while the finalizer cancels and
                # drains them. Only external lifecycle callers join that work.
                if not join:
                    return
                cleanup = call.finalizer
            elif transfer and transfer is not asyncio.current_task() and not transfer.done():
                # The native handoff owns the caller until its bounded result.
                if not join:
                    return
                cleanup = transfer
            else:
                call.terminal = True
                call.finalizer = self._start_cleanup(self._finalize(
                    call, outcome, error, fallback, asyncio.current_task()))
                cleanup = call.finalizer
        await asyncio.shield(cleanup)

    async def _finalize(self, call, outcome, error, fallback, initiator):
        if call.text_only:
            fallback = False
        if call.transfer_released and call.transfer_confirmed:
            outcome, error, fallback = 'transferred', None, False
            self.monitoring.emit(call.run_id, 'transfer_committed', outcome=outcome, tool_id='pbx.transfer',
                                 destination_id=call.transfer_destination_id, elapsed_ms=self.trace(call).elapsed())
        elif call.transfer_released:
            fallback = False
        elif call.ending_by_agent:
            outcome, fallback = 'ended_by_agent', False
        consultation = call.consultation
        if consultation:
            await self.consultations.cancel(call, exclude=initiator)
            # A concurrent shutdown/provider failure may have begun before the
            # consultation committed to native ownership. Never compete with it.
            if consultation.transferred or consultation.uncertain or (consultation.releasing and consultation.native_started):
                fallback = False
                call.caller_left = True
                outcome = 'transferred' if consultation.transferred else 'failed'
                error = None if consultation.transferred else 'transfer_uncertain'
        if call.private_consultation:
            await self.consultations.private_ended(call.private_consultation, call)
        if call.hangup_task and call.hangup_task is not initiator:
            call.hangup_task.cancel()
            await asyncio.gather(call.hangup_task, return_exceptions=True)
        trace = self.trace(call)
        if not call.admitted:
            trace.enabled = False
        trace.end(ACTIVE_SPAN.get(), 'completed' if outcome in ('transferred','ended_by_agent') else 'failed' if outcome in ('failed','fallback') else 'cancelled', error=error)
        cleanup_failed = False
        fallback_failed = False
        cleanup_span = trace.start('cleanup')
        fallback_span = trace.start('fallback') if fallback else None
        if outcome == 'ended_by_agent' and not call.caller_left:
            try:
                # The model supplies no channel identity. Recheck Stasis ownership
                # immediately before ARI DELETE, including after playback grace.
                owned = await asyncio.wait_for(self.controller.hangup_owned(call.caller_id), 3)
                if not owned:
                    raise RuntimeError('hangup ownership lost')
            except Exception:
                cleanup_failed = True
                outcome, error = 'failed', 'hangup_failed'
        for task in list(call.tasks):
            if task is not initiator:
                task.cancel()
        try:
            await self.quiesce_media(call)
        except Exception:
            cleanup_failed = True
        if call.tools:
            await call.tools.close(exclude=initiator)
        if call.recent:
            await call.recent.close()
        call.caller_number = None
        if call.transfer_target:
            try:
                await self.controller.unsubscribe_channel(call.caller_id)
            except Exception:
                cleanup_failed = True
        if fallback:
            try:
                await self.controller.continue_channel(call.caller_id, {'context':'voice-agent-fallback-'+hashlib.sha256((call.snapshot['agent_id']+'\0'+call.snapshot['fallback_destination_id']).encode()).hexdigest()[:24], 'extension':'s', 'priority':1})
            except Exception:
                fallback_failed = True
                try:
                    await self.controller.continue_channel(call.caller_id)
                except Exception:
                    # A lost continue response may follow a successful handoff.
                    if not call.transfer_release_requested:
                        try:
                            await self.controller.hangup(call.caller_id)
                        except Exception:
                            pass
        trace.end(fallback_span, 'failed' if fallback_failed else 'completed',error='fallback_failed' if fallback_failed else None)
        if not call.text_only:
            try:
                await self.controller.hangup(call.leg_id)
            except Exception:
                cleanup_failed = True
        if call.media:
            try:
                await call.media.close()
            except Exception:
                cleanup_failed = True
        if call.bridge_id:
            try:
                await self.controller.destroy_bridge(call.bridge_id)
            except Exception:
                cleanup_failed = True
        if call.adapter:
            try:
                await asyncio.wait_for(call.adapter.close(),timeout=16 if call.binding.get('adapter') == 'live_ws' else 3)
            except Exception:
                cleanup_failed = True
        # Monitoring is optional: it cannot prevent cleanup or a terminal outcome.
        if call.adapter:
            try:
                snapshot = getattr(call.adapter, 'usage_snapshot', None)
                if isinstance(snapshot, dict):
                    trace.usage(snapshot)
                drain = getattr(call.adapter, 'drain_observations', None)
                if callable(drain) and not inspect.iscoroutinefunction(drain):
                    for observation in drain():
                        self.observe(call, observation)
            except Exception:
                trace.gap()
        trace.end(cleanup_span, 'failed' if cleanup_failed else 'completed',error='cleanup_failed' if cleanup_failed else None)
        details = trace.finish()
        kind = outcome if outcome in ('completed','fallback','failed','interrupted') else 'completed'
        if call.admitted:
            self.monitoring.emit(call.run_id,kind,outcome=outcome,error=error,elapsed_ms=self.trace(call).elapsed(),**details)
        self.calls.pop(call.session_id,None)
        if call.work_lease is not None:
            call.work_lease.close()

    async def disconnected(self):
        await self._finish_calls('ari_disconnected')
        await self._drain_cleanup()

    async def _finish_calls(self, reason):
        # Admissions still committing to storage check readiness before promotion.
        # Keep REST available until these and already-admitted calls have finalized.
        await asyncio.gather(
            asyncio.gather(*self.admissions.values(), return_exceptions=True),
            *(self.finish(call, 'interrupted', reason, fallback=True, join=True)
              for call in list(self.calls.values())))
