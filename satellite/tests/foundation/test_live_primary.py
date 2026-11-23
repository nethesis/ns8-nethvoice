import asyncio
import base64
import copy
import json

import pytest
from aiohttp import web
from aiohttp.test_utils import TestServer
from test_agent_models import snapshot
from voice_agent.providers.live_primary import OpenAILiveWebSocketSession
from voice_agent.providers.realtime import ProviderError


@pytest.mark.asyncio
async def test_primary_start_real_identity_audio_tools_and_finalization():
    accepted, inputs, commands = [], [], []
    async def provider(request):
        assert request.headers['Authorization'] == 'Bearer synthetic'
        assert not request.query
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        async for message in ws:
            e = json.loads(message.data)
            commands.append(e['type'])
            if e['type'] == 'session.start':
                accepted.append(e['session'])
                await ws.send_json({'type': 'session.started', 'session': {'id': 'live_real'}})
                await ws.send_json({'type': 'session.output_audio.delta', 'delta': base64.b64encode(b'x' * 79).decode()})
                await ws.send_json({'type': 'session.output_audio.delta', 'delta': base64.b64encode(b'y' * 81).decode()})
            elif e['type'] == 'session.input_audio.append':
                inputs.append(base64.b64decode(e['audio']))
            elif e['type'] == 'session.commentary.append':
                await ws.send_json({'type': 'session.commentary.appended', 'client_event_id': e['event_id']})
            elif e['type'] == 'session.close':
                await ws.send_json({'type': 'session.closed', 'usage': {'seconds': 1.25}})
        return ws
    app = web.Application()
    app.router.add_get('/live', provider)
    server = TestServer(app)
    await server.start_server()
    session = OpenAILiveWebSocketSession({'api_key': 'synthetic'})
    session.ws_base = str(server.make_url('/live')).replace('http:', 'ws:')
    profile = {**copy.deepcopy(snapshot('gpt-live-1')['conversation']), 'prompt': 'Synthetic voice prompt.',
               '_opening_instructions': 'Synthetic full opening.', '_routing_context': 'Approved context.'}
    try:
        assert await session.start(profile, []) == 'live_real'
        assert await asyncio.wait_for(session.audio.frame(), 1) == b'x' * 79 + b'y' * 81
        await session.send_audio(b'\xff' * 160)
        await session.respond('A long greeting must not be appended again. ' * 30)
        assert accepted[0]['audio']['format'] == {'type': 'audio/pcmu', 'rate': 8000}
        assert accepted[0]['store'] is False and accepted[0]['model'] == 'gpt-live-1'
        assert 'Synthetic full opening.' in accepted[0]['input'][0]['content'][0]['text']
        assert 'Approved context.' in accepted[0]['delegation']['responses']['instructions']
        await session.close()
        assert inputs == [b'\xff' * 160]
        assert commands.count('session.start') == commands.count('session.commentary.append') == 1
        assert session.usage_snapshot['final'] and session.usage_snapshot['seconds'] == 1.25
        assert not any(e['type'] == 'monitoring_gap' for e in session.drain_observations())
        assert session.audio.pending_bytes == 0
    finally:
        await session.close()
        await server.close()


@pytest.mark.asyncio
@pytest.mark.parametrize('event', [
    {'type': 'session.started', 'session': {'id': 'untrusted/id'}},
    {'type': 'error', 'error': {'code': 'invalid_function_parameters', 'message': 'PRIVATE'}},
    None,
])
async def test_startup_failure_does_not_return_a_session_or_retain_audio(event):
    async def provider(request):
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        await ws.receive_json()
        if event is not None:
            await ws.send_json(event)
        await ws.close()
        return ws
    app = web.Application()
    app.router.add_get('/live', provider)
    server = TestServer(app)
    await server.start_server()
    session = OpenAILiveWebSocketSession({'api_key': 'synthetic'})
    session.ws_base = str(server.make_url('/live')).replace('http:', 'ws:')
    try:
        with pytest.raises(ProviderError):
            await session.start(snapshot('gpt-live-1')['conversation'], [])
        assert not session._call
    finally:
        await session.close()
        await server.close()
    assert session.audio.pending_bytes == 0


@pytest.mark.asyncio
async def test_output_backpressure_and_late_audio_after_stop():
    session = OpenAILiveWebSocketSession({'api_key': 'synthetic'})
    for encoded in ['malformed', base64.b64encode(bytes(16001)).decode()]:
        with pytest.raises(ProviderError):
            await session._handle({'type': 'session.output_audio.delta', 'delta': encoded})
    await session._handle({'type': 'session.output_audio.delta', 'delta': base64.b64encode(bytes(16000)).decode()})
    with pytest.raises(ProviderError):
        await session._handle({'type': 'session.output_audio.delta', 'delta': 'AA=='})
    session.stop_audio()
    await session._handle({'type': 'session.output_audio.delta', 'delta': 'AA=='})
    assert session.audio.pending_bytes == 0
    await session.close()


@pytest.mark.asyncio
async def test_signal_onset_ignores_silence_and_keeps_no_audio_after_close():
    session = OpenAILiveWebSocketSession({'api_key': 'synthetic'})
    await session._handle({'type': 'session.output_audio.delta', 'delta': base64.b64encode(b'\xff' * 160).decode()})
    assert not session._signal_observed
    await session._handle({'type': 'session.output_audio.delta', 'delta': base64.b64encode(b'\x80' * 160).decode()})
    assert session._signal_observed
    assert sum(e['type'] == 'audio_signal' for e in session._queue._queue) == 1
    await session.close()
    assert session.audio.pending_bytes == 0 and not session._signal_remainder


@pytest.mark.asyncio
async def test_consultation_continues_tool_and_waits_for_pbx_speech_then_quiet():
    from types import SimpleNamespace
    from unittest.mock import AsyncMock
    from voice_agent.media import AudioBridge, AudioBuffer
    from test_live import PrimaryLiveEmulator, TOOL
    from test_provider_emulators import eventually

    emulator = PrimaryLiveEmulator()
    server = TestServer(emulator.app)
    await server.start_server()
    session = OpenAILiveWebSocketSession({'api_key': 'synthetic'})
    session.ws_base = str(server.make_url('/v1/live/sessions')).replace('http:', 'ws:')
    media = SimpleNamespace(input=AudioBuffer(), write=AsyncMock(), stop_input=lambda: None, flush=AsyncMock())
    bridge = AudioBridge(media, session, lambda code: pytest.fail(code))
    speech = None
    try:
        await session.start(snapshot('gpt-live-1')['conversation'], [TOOL])
        await emulator.tool(next(iter(session._wire_tools)))
        await eventually(lambda: 'c1' in session._invocations and session._responses['r1']['done'])
        await session.send_result('c1', {'outcome': 'consulting'})
        speech = asyncio.create_task(session.consultation_say('Check with the colleague, then pause.', response_id='r1'))
        await eventually(lambda: any(e['type'] == 'session.commentary.append' for e in emulator.received))
        commands = [e['type'] for e in emulator.received]
        assert commands.index('response.item.create') < commands.index('response.create') < commands.index('session.commentary.append')
        assert commands.count('response.create') == 1
        # Acknowledged context, received audio and queued silence prove no playback.
        for frame in (b'\xff' * 160, b'\x80' * 160, b'\xff' * 12800):
            await emulator.ws.send_json({'type': 'session.output_audio.delta', 'delta': base64.b64encode(frame).decode()})
        await eventually(lambda: session.audio.pending_bytes == 13120)
        assert not speech.done()
        bridge.start()
        await asyncio.wait_for(speech, 2)
        # Continuous silent output need not stop or empty its queue to complete.
        assert session.audio.pending_bytes > 0
        assert media.write.await_count >= 52
    finally:
        if speech:
            speech.cancel()
            await asyncio.gather(speech, return_exceptions=True)
        await bridge.stop()
        await session.close()
        await server.close()


@pytest.mark.asyncio
async def test_consultation_ack_is_correlated_and_close_wakes_playback_wait():
    from unittest.mock import AsyncMock
    session = OpenAILiveWebSocketSession({'api_key': 'synthetic'})
    session._send = AsyncMock()
    task = asyncio.create_task(session.consultation_say('Check with the colleague.'))
    try:
        await asyncio.sleep(0)
        command = session._send.await_args.args[0]
        await session._handle({'type': 'session.commentary.appended', 'client_event_id': 'foreign'})
        assert not task.done() and not session._acks[command['event_id']][1].done()
        await session._handle({'type': 'session.commentary.appended', 'client_event_id': command['event_id']})
        await asyncio.sleep(0)
        assert not task.done()  # Ack is not a spoken announcement.
        session._closed_event.set()
        with pytest.raises(ProviderError, match='provider_disconnected'):
            await asyncio.wait_for(task, .5)
    finally:
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)


@pytest.mark.asyncio
async def test_consultation_rejected_append_fails_without_waiting_for_speech():
    from unittest.mock import AsyncMock
    session = OpenAILiveWebSocketSession({'api_key': 'synthetic'})
    session._send = AsyncMock()
    task = asyncio.create_task(session.consultation_say('Check with the colleague.'))
    await asyncio.sleep(0)
    command = session._send.await_args.args[0]
    await session._handle({'type': 'error', 'error': {'client_event_id': command['event_id'], 'message': 'PRIVATE'}})
    with pytest.raises(ProviderError, match='command rejected'):
        await asyncio.wait_for(task, .5)
    assert not any(event.get('type') == 'error' for event in session._queue._queue)
