"""Synthetic boundary measurements and startup comparisons, without vendor calls."""
import asyncio
import base64
import json
import struct
from types import SimpleNamespace

import pytest

from diagnostics.live_audio import SignalStats
from diagnostics.live_startup import DiagnosticLiveAdapter, MEDIA_READY
from test_live import connected
from test_provider_emulators import eventually
from diagnostics.scoped_runner import select_call, fingerprint
from diagnostics.rtp import SyntheticRTP, rtp_payload, decode_ulaw
from diagnostics.budget import reserve_session


def test_audio_statistics_have_no_content_and_bound_malformed_frames():
    now = [0.0]
    stats = SignalStats(clock=lambda: now[0])
    stats.pcm(bytes(960))
    now[0] = 0.02
    stats.encoded(base64.b64encode(struct.pack('<hh', 1000, -1000)).decode())
    for value in ['private transcript', 'AA==', 'x' * 349529, None]:
        stats.encoded(value)
    result = stats.snapshot()
    assert result['samples'] == 482 and result['peak'] == 1000
    assert result['first_signal_ms'] == 20 and result['max_gap_ms'] == 20
    assert result['invalid'] == 4 and len(result['signal_samples_per_second']) == 60
    assert 'private' not in json.dumps(result)


@pytest.mark.asyncio
@pytest.mark.parametrize('variant', ['current', 'concise'])
async def test_startup_delayed_ack_early_output_and_stalled_input(variant):
    opening = 'Synthetic opening. ' * 70
    async with connected({'_opening_instructions': opening, '_capture_transcripts': True},
                         adapter_class=DiagnosticLiveAdapter, adapter_options={'variant': variant}) as (adapter, emulator):
        emulator.ack_gate.clear()
        task = asyncio.create_task(adapter.respond(opening))
        try:
            await eventually(lambda: len(emulator.received) == 1)
            # Speech may precede instruction acknowledgment. Output and input
            # boundaries are independent; stalled input must stay visibly absent.
            audio = base64.b64encode(struct.pack('<' + 'h' * 480, *([1000] * 480))).decode()
            await emulator.ws.send_json({'type': 'session.output_audio.delta', 'delta': audio,
                                         'start_ms': 0, 'end_ms': 20})
            await emulator.ws.send_json({'type': 'session.output_transcript.delta', 'event_id': 'private', 'delta': 'DO NOT RETAIN'})
            await eventually(lambda: adapter.output_stats.frames == 1)
            assert not task.done() and adapter.input_stats.frames == 0
            assert adapter.commands[0]['outcome'] == 'pending'
            assert adapter._observation_queue.empty()
            emulator.ack_gate.set()
            await asyncio.wait_for(task, 2)
            commands = adapter.measurements()['commands']
            assert all(c['outcome'] == 'acknowledged' for c in commands)
            if variant == 'concise':
                assert len(commands) == 1
                assert emulator.received[0]['content'] == MEDIA_READY
            else:
                assert len(commands) == 1
                assert emulator.received[0]['type'] == 'session.commentary.append'
            assert opening in emulator.accepted[0]['session']['input'][0]['content'][0]['text']
            assert 'DO NOT RETAIN' not in json.dumps(adapter.measurements())
        finally:
            emulator.ack_gate.set()
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)


@pytest.mark.asyncio
async def test_pending_instruction_cancellation_cleans_ack_waiter_and_redacts_error():
    async with connected(adapter_class=DiagnosticLiveAdapter) as (adapter, emulator):
        emulator.ack_gate.clear()
        task = asyncio.create_task(adapter.respond('PRIVATE OPENING'))
        try:
            await eventually(lambda: len(emulator.received) == 1)
            task.cancel()
            with pytest.raises(asyncio.CancelledError):
                await task
            assert not adapter._acks
            assert adapter.commands[0]['outcome'] == 'cancelled'
            assert 'PRIVATE' not in json.dumps(adapter.measurements())
        finally:
            emulator.ack_gate.set()


@pytest.mark.asyncio
async def test_provider_input_observed_even_with_transcripts_disabled():
    async with connected(adapter_class=DiagnosticLiveAdapter) as (adapter, emulator):
        await emulator.ws.send_json({'type': 'session.input_audio.append', 'audio': base64.b64encode(bytes(960)).decode()})
        await eventually(lambda: adapter.input_stats.frames == 1)
        assert adapter.input_stats.snapshot()['audio_seconds'] == .02
        assert adapter.input_stats.snapshot()['first_signal_ms'] is None
        assert adapter._observation_queue.empty()


def test_scope_requires_exact_owned_call_fresh_arm_and_pinned_snapshot():
    snapshot = {'agent_id': 'receptionist', 'conversation': {'model': 'gpt-live-1'}}
    label = 'a' * 32
    call = SimpleNamespace(linkedid='va' + 'b' * 28, caller_id='va' + 'c' * 28, snapshot=snapshot)
    arm = dict(label=label, linkedid=call.linkedid, agent_channel_id=call.caller_id, variant='concise', expires_at=120,
               snapshot_sha256=fingerprint(snapshot))
    assert select_call(call, arm, now=100) == arm
    for update in [dict(expires_at=99), dict(expires_at=161), dict(expires_at=float('nan')),
                   dict(label='../../private'), dict(variant='unknown'), dict(snapshot_sha256='changed'),
                   dict(linkedid='real-caller'), dict(agent_channel_id=call.linkedid), dict(agent_channel_id='real-caller'), dict(extra='untrusted')]:
        assert select_call(call, {**arm, **update}, now=100) is None
    assert select_call(SimpleNamespace(linkedid='another-call', caller_id=call.caller_id, snapshot=snapshot), arm, now=100) is None
    changed = {**snapshot, 'conversation': {'model': 'gpt-realtime-2'}}
    assert select_call(SimpleNamespace(linkedid=call.linkedid, caller_id=call.caller_id, snapshot=changed), arm, now=100) is None


def test_synthetic_caller_rejects_foreign_and_malformed_rtp():
    receiver = SyntheticRTP()
    receiver.peer = ('127.0.0.1', 1234)
    packet = struct.pack('!BBHII', 128, 0, 1, 160, 42) + bytes([255] * 160)
    assert rtp_payload(packet) == bytes([255] * 160)
    assert decode_ulaw(bytes([255, 127, 0, 128])) == struct.pack('<hhhh', 0, 0, -32124, 32124)
    receiver.datagram_received(packet, ('127.0.0.1', 1235))
    assert receiver.stats.frames == 0 and receiver.foreign_packets == 1
    receiver.datagram_received(packet, receiver.peer)
    assert receiver.stats.snapshot()['audio_seconds'] == .02
    for malformed in [b'', bytes(12), packet[:8], bytes([144]) + packet[1:]]:
        assert rtp_payload(malformed) is None


def test_test_budget_expires_and_counts_attempts_before_network_work(tmp_path):
    path = tmp_path / 'budget.json'
    budget = dict(starts_at=100, expires_at=1000, limit=2, attempts=[])
    path.write_text(json.dumps(budget))
    assert reserve_session('current', path=path, now=101) == 1
    assert reserve_session('concise', path=path, now=101) == 2
    with pytest.raises(ValueError):
        reserve_session('direct-live', path=path, now=101)
    for changed in [dict(limit=13), dict(expires_at=99), dict(expires_at=4000), dict(starts_at=102)]:
        path.write_text(json.dumps({**budget, **changed}))
        with pytest.raises(ValueError):
            reserve_session('current', path=path, now=101)


@pytest.mark.asyncio
@pytest.mark.parametrize('case', ['direct-live', 'realtime'])
async def test_direct_clients_stream_audio_finalize_and_discard_content(monkeypatch, case):
    from aiohttp import web
    from aiohttp.test_utils import TestServer
    from diagnostics import direct_probe

    snapshot = {'provider_binding_id': 'synthetic-binding', 'conversation': {'greeting': 'Synthetic greeting'}}
    monkeypatch.setattr(direct_probe, 'Storage', lambda: SimpleNamespace(
        snapshot=lambda _: snapshot, binding=lambda _: {'api_key': 'synthetic-key'}))
    attempts = []
    monkeypatch.setattr(direct_probe, 'reserve_session', lambda case: attempts.append(case) or len(attempts))
    monkeypatch.setattr(direct_probe, 'STREAM_SECONDS', .06)
    received = []

    async def attach(request):
        assert request.headers['Authorization'] == 'Bearer synthetic-key'
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        async for message in ws:
            event = json.loads(message.data)
            received.append(event)
            if event['type'] in ('session.start', 'session.update'):
                await ws.send_json({'type': 'session.started' if case == 'direct-live' else 'session.updated'})
            elif event['type'] in ('session.input_audio.append', 'input_audio_buffer.append'):
                await ws.send_json({'type': 'session.output_audio.delta' if case == 'direct-live' else 'response.output_audio.delta',
                                    'delta': base64.b64encode(bytes([128] * 160)).decode()})
                await ws.send_json({'type': 'session.output_transcript.delta', 'delta': 'PRIVATE TRANSCRIPT'})
            elif event['type'] == 'session.close':
                await ws.send_json({'type': 'session.closed'})
        return ws

    app = web.Application()
    app.router.add_get('/stream', attach)
    server = TestServer(app)
    await server.start_server()
    monkeypatch.setattr(direct_probe, 'LIVE_URL' if case == 'direct-live' else 'REALTIME_URL', str(server.make_url('/stream')).replace('http:', 'ws:'))
    try:
        output = await direct_probe.probe(case, fingerprint(snapshot), bytes([255] * 160))
        assert attempts == [case] and output['started']
        assert output['input_sent']['samples'] == 480
        assert output['output_received']['peak'] == 32124
        assert output['finalization_confirmed'] == (case == 'direct-live')
        assert 'PRIVATE' not in json.dumps(output) and 'synthetic-key' not in json.dumps(output)
        assert received[0]['type'] == ('session.start' if case == 'direct-live' else 'session.update')
    finally:
        await server.close()
