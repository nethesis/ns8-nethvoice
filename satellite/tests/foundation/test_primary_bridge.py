"""No vendor traffic: both media boundaries use real local WebSockets."""
import asyncio
import base64
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import aiohttp
from aiohttp import web
from aiohttp.test_utils import TestServer
import pytest

from diagnostics.primary_bridge import PrimaryBridgeAdapter
from test_agent_models import snapshot
from test_provider_emulators import eventually
from voice_agent.providers.realtime import ProviderError


@pytest.mark.asyncio
async def test_primary_bridge_preserves_live_startup_grants_and_carries_both_audio_directions():
    connection_id = '12345678-1234-1234-1234-123456789abc'
    accepted, input_frames, pbx_frames = [], [], []

    async def provider(request):
        assert request.headers['Authorization'] == 'Bearer synthetic-provider-key'
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        async for message in ws:
            event = json.loads(message.data)
            if event['type'] == 'session.start':
                accepted.append(event['session'])
                await ws.send_json({'type': 'session.started', 'session': {'id': 'live_primary_test'}})
            elif event['type'] == 'session.input_audio.append':
                input_frames.append(base64.b64decode(event['audio']))
            elif event['type'] == 'session.commentary.append':
                await ws.send_json({'type': 'session.commentary.appended', 'client_event_id': event['event_id']})
                # Odd chunks must be reframed without dropping or duplicating samples.
                for frame in (bytes([128] * 100), bytes([128] * 60)):
                    await ws.send_json({'type': 'session.output_audio.delta', 'delta': base64.b64encode(frame).decode()})
            elif event['type'] == 'session.close':
                await ws.send_json({'type': 'session.closed'})
        return ws

    async def media(request):
        assert request.headers['Authorization'] == aiohttp.encode_basic_auth('test-ari', 'test-password')
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        await ws.send_json({'event': 'MEDIA_START', 'channel_id': 'test-leg', 'connection_id': connection_id,
                            'format': 'ulaw', 'optimal_frame_size': 160})
        await ws.send_bytes(bytes([255] * 160))
        async for message in ws:
            if message.type == aiohttp.WSMsgType.BINARY:
                pbx_frames.append(message.data)
        return ws

    app = web.Application()
    app.router.add_get('/live', provider)
    app.router.add_get('/media/' + connection_id, media)
    server = TestServer(app)
    await server.start_server()
    controller_session = aiohttp.ClientSession(headers={
        'Authorization': aiohttp.encode_basic_auth('test-ari', 'test-password')})
    controller = SimpleNamespace(url=str(server.make_url('')).rstrip('/'), _session=controller_session,
                                 get_variable=AsyncMock(return_value=connection_id))
    storage = SimpleNamespace(accept=Mock())
    call = SimpleNamespace(terminal=False, leg_id='test-leg', provider_call_id=None)
    recorded = []
    adapter = PrimaryBridgeAdapter({'api_key': 'synthetic-provider-key'}, call, controller, storage,
                                    record=recorded.append)
    adapter.primary_ws_base = str(server.make_url('/live')).replace('http:', 'ws:')
    profile = snapshot('gpt-live-1')['conversation']
    profile.update(prompt='Synthetic instructions.', _opening_instructions='Synthetic full opening.')
    tools = [{'type': 'function', 'name': 'allowed_lookup', 'description': 'Synthetic lookup',
              'parameters': {'type': 'object', 'properties': {}}}]
    try:
        await adapter.accept(None, profile, tools)
        assert call.provider_call_id == 'live_primary_test'
        storage.accept.assert_called_once_with(call, 'live_primary_test')
        await adapter.connect(call.provider_call_id)
        await eventually(lambda: len(input_frames) == 1)
        await adapter.respond('Greet now.')
        await eventually(lambda: len(pbx_frames) == 1)
        assert input_frames == [bytes([255] * 160)]
        assert pbx_frames == [bytes([128] * 160)]
        session = accepted[0]
        assert session['model'] == 'gpt-live-1' and session['store'] is False
        assert session['audio']['format'] == {'type': 'audio/pcmu', 'rate': 8000}
        assert 'Synthetic full opening.' in session['input'][0]['content'][0]['text']
        assert session['delegation']['responses']['tools'][0]['name'] in adapter._wire_tools
        assert adapter.input_stats.samples == adapter.output_stats.samples == 160
    finally:
        await adapter.close()
        await controller_session.close()
        await server.close()
    assert len(recorded) == 1 and recorded[0]['variant'] == 'primary-ws'
    assert adapter._closed_event.is_set()
    assert 'synthetic-provider-key' not in json.dumps(recorded)


@pytest.mark.asyncio
async def test_primary_bridge_rejects_malformed_audio_and_bounds_backlog():
    call = SimpleNamespace(terminal=False, leg_id='test-leg', provider_call_id=None)
    adapter = PrimaryBridgeAdapter({'api_key': 'synthetic'}, call, None, None)
    for value in ['private malformed data', base64.b64encode(bytes(16001)).decode()]:
        with pytest.raises(ProviderError):
            await adapter._handle({'type': 'session.output_audio.delta', 'delta': value})
    assert adapter._audio.empty() and adapter.output_stats.samples == 0
    await adapter.close()


@pytest.mark.asyncio
async def test_closed_media_socket_reports_failure_instead_of_waiting_for_call_deadline():
    async def closed_messages():
        if False:
            yield

    call = SimpleNamespace(terminal=False, leg_id='test-leg', provider_call_id=None)
    adapter = PrimaryBridgeAdapter({'api_key': 'synthetic'}, call, None, None)
    adapter._media_ws = closed_messages()
    await adapter._read_media()
    assert not adapter._queue.empty(), 'media EOF must trigger the runtime fallback'
    assert adapter._queue.get_nowait() == {'type': 'error', 'code': 'provider_unavailable'}
    adapter._media_ws = None
    await adapter.close()


@pytest.mark.asyncio
async def test_close_discards_queued_audio_and_does_not_report_a_spurious_media_failure():
    call = SimpleNamespace(terminal=False, leg_id='test-leg', provider_call_id=None)
    adapter = PrimaryBridgeAdapter({'api_key': 'synthetic'}, call, None, None)
    await adapter._handle({'type': 'session.output_audio.delta',
                           'delta': base64.b64encode(bytes([128] * 160)).decode()})
    await adapter.close()
    assert adapter._audio.empty() and adapter._buffered_bytes == 0
    assert adapter._queue.empty()


@pytest.mark.asyncio
@pytest.mark.parametrize('variant', ['current', 'concise', 'primary-ws'])
async def test_armed_live_call_records_selected_comparison_at_close(monkeypatch, tmp_path, variant):
    import time
    from diagnostics import scoped_runner
    from test_live import PrimaryLiveEmulator
    from test_runtime import fixtures, sign
    from voice_agent.media import AudioBuffer

    _, storage, controller, _ = fixtures()
    value = snapshot('gpt-live-1')
    value.update(agent_id='receptionist', destination_id='agent:receptionist')
    value['debug']['transcription_enabled'] = True
    storage.snapshot.return_value = value
    storage.binding.return_value['api_key'] = 'key'
    caller_id, linkedid, label = 'va' + 'a' * 28, 'va' + 'b' * 28, 'c' * 32
    controller.get_variable.return_value = linkedid
    media = SimpleNamespace(input=AudioBuffer(), failed=asyncio.Event(), enable_input=Mock(),
                            stop_input=Mock(), write=AsyncMock(), flush=AsyncMock(), close=AsyncMock())
    controller.connect_media_channel.return_value = media
    monkeypatch.setattr(scoped_runner, 'ROOT', tmp_path)
    monkeypatch.setattr(scoped_runner, 'ARM', tmp_path / 'arm.json')
    scoped_runner.ARM.write_text(json.dumps(dict(label=label, agent_channel_id=caller_id,
        linkedid=linkedid, expires_at=time.time()+50, variant=variant, snapshot_sha256=scoped_runner.fingerprint(value))))
    emulator = PrimaryLiveEmulator()
    server = TestServer(emulator.app)
    await server.start_server()
    from voice_agent.providers.live import OpenAILiveAdapter
    url = str(server.make_url('/v1/live/sessions'))
    monkeypatch.setattr(OpenAILiveAdapter, 'ws_base', url.replace('http:', 'ws:'))
    monkeypatch.setattr(OpenAILiveAdapter, 'http_base', url)
    runtime = scoped_runner.ScopedRuntime(storage, controller)
    try:
        await runtime.admit({'id': caller_id, 'dialplan': {'context': 'voice-agent-receptionist'}}, 'receptionist')
        call, = runtime.calls.values()
        if variant == 'primary-ws':
            assert call.binding['adapter'] == 'live_ws'
            controller.originate_local.assert_not_awaited()
        else:
            assert call.binding['adapter'] == 'live'
            controller.originate_local.assert_awaited_once()
            await runtime.event({'type': 'StasisStart', 'args': ['provider', call.session_id], 'channel': {'id': call.leg_id}})
            data = {'session_id': 'live_test', 'type': 'sip', 'sip_headers': [
                {'name': 'X-OS-Session-ID', 'value': call.session_id},
                {'name': 'X-OS-Provider-Leg-ID', 'value': call.leg_id},
                {'name': 'X-OS-Agent-ID', 'value': 'receptionist'}]}
            body, headers = sign(call, data, event_type='live.transport.incoming')
            assert await runtime.webhook('openai', body, headers) == {'status': 'accepted'}
        await eventually(lambda: call.media_connected and call.adapter.commands and
                         call.adapter.commands[0]['outcome'] == 'acknowledged')
        assert not call.adapter._capture
        if variant == 'primary-ws':
            media.input.append(bytes([128]) * 160)
            await emulator.ws.send_json({'type': 'session.output_audio.delta',
                'delta': base64.b64encode(bytes([128]) * 80).decode()})
            await eventually(lambda: call.adapter.input_stats.samples >= 160 and call.adapter.output_stats.samples == 80)
            media.write.assert_not_awaited()  # A partial frame has arrived but cannot play yet.
    finally:
        for call in list(runtime.calls.values()):
            await runtime.finish(call, 'completed')
        await server.close()
    result = json.loads((tmp_path / ('live-diagnostic-result-' + label + '.json')).read_text())
    assert result['variant'] == variant
    assert result['commands'][0]['kind'] == ('session.instructions.append' if variant == 'concise' else 'session.commentary.append')


@pytest.mark.asyncio
@pytest.mark.parametrize('probe_parent', [False, True])
async def test_scoped_private_consultation_follows_parent_call_scope(monkeypatch, probe_parent):
    from diagnostics import scoped_runner
    from test_runtime import fixtures
    _, storage, controller, _ = fixtures()
    runtime = scoped_runner.ScopedRuntime(storage, controller)
    parent = SimpleNamespace(caller_id='va' + 'a' * 28 if probe_parent else 'ordinary-caller')
    call = SimpleNamespace(caller_id='va' + 'b' * 28, private_consultation=SimpleNamespace(caller=parent))
    converse = AsyncMock()
    monkeypatch.setattr(scoped_runner.runtime.Runtime, 'converse', converse)
    monkeypatch.setattr(scoped_runner, 'read_selection', lambda _: None)
    runtime.finish = AsyncMock()
    await runtime.converse(call)
    if probe_parent:
        runtime.finish.assert_awaited_once_with(call, 'interrupted', 'provider_unavailable', fallback=False)
        converse.assert_not_awaited()
    else:
        converse.assert_awaited_once_with(call)
        runtime.finish.assert_not_awaited()
