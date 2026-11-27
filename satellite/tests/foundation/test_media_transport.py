import asyncio
import json
from types import SimpleNamespace

import pytest
from aiohttp import web
from aiohttp.test_utils import TestServer
import aiohttp

from voice_agent.media import AudioBridge, AudioBuffer, AsteriskWebSocketMedia, FRAME_SECONDS, PCMU_SILENCE
from voice_agent.providers.realtime import ProviderError


@pytest.mark.asyncio
async def test_audio_buffer_preserves_fragments_and_bounds_bytes():
    buffer = AudioBuffer()
    buffer.append(b'a' * 79)
    frame = asyncio.create_task(buffer.frame())
    await asyncio.sleep(0)
    assert not frame.done()
    buffer.append(b'b' * 81)
    assert await frame == b'a' * 79 + b'b' * 81
    buffer.append(b'c' * 16000)
    with pytest.raises(ProviderError):
        buffer.append(b'x')
    buffer.close()
    assert await buffer.frame() is None and buffer.pending_bytes == 0


@pytest.mark.asyncio
async def test_suppressed_input_is_padded_without_losing_partial_audio():
    source = AudioBuffer()
    source.append(b'a' * 79)
    sent = []

    async def send(frame):
        sent.append(frame)
        if len(sent) == 2:
            source.append(b'b' * 81 + PCMU_SILENCE)
        if len(sent) == 4:
            source.close()

    bridge = AudioBridge(SimpleNamespace(input=source), SimpleNamespace(send_audio=send), pytest.fail)
    await asyncio.wait_for(bridge._pump_input(), 1)
    assert sent == [PCMU_SILENCE, PCMU_SILENCE, b'a' * 79 + b'b' * 81, PCMU_SILENCE]
    assert bridge.input_real_frames == bridge.input_silence_frames == 2
    assert bridge.max_input_gap_ms >= 19
    assert bridge.max_real_input_gap_ms >= 39


@pytest.mark.asyncio
async def test_real_frame_after_padding_sets_one_idle_interval():
    clock = asyncio.get_running_loop().time
    reads = []
    class Source:
        async def frame(self, *, deadline, max_frames):
            reads.append((clock(), deadline))
            return (b'', bytes(160), None)[len(reads) - 1]

    async def send(frame):
        pass

    bridge = AudioBridge(SimpleNamespace(input=Source()), SimpleNamespace(send_audio=send), pytest.fail)
    await bridge._pump_input()
    at, deadline = reads[-1]
    assert deadline - at <= FRAME_SECONDS


@pytest.mark.asyncio
async def test_idle_clock_skips_missed_slots_after_a_stall():
    source = AudioBuffer()
    clock = asyncio.get_running_loop().time
    finished = []
    started = []

    async def send(frame):
        assert frame == PCMU_SILENCE
        started.append(clock())
        if len(started) == 1:
            await asyncio.sleep(4 * FRAME_SECONDS)
        if len(started) == 3:
            source.close()
        finished.append(clock())

    bridge = AudioBridge(SimpleNamespace(input=source), SimpleNamespace(send_audio=send), pytest.fail)
    await asyncio.wait_for(bridge._pump_input(), 1)
    assert len(started) == bridge.input_silence_frames == 3
    assert all(start - finish >= .015 for start, finish in zip(started[1:], finished))


@pytest.mark.asyncio
@pytest.mark.parametrize('wrong_identity', [False, True])
async def test_media_validates_identity_and_reports_eof(wrong_identity):
    connection = '00000000-0000-4000-8000-000000000001'
    gate = asyncio.Event()
    received = []

    async def media(request):
        assert request.headers['Authorization'] == aiohttp.encode_basic_auth('ari', 'password')
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        await ws.send_json({'event': 'MEDIA_START', 'connection_id': connection,
                            'channel_id': 'foreign' if wrong_identity else 'owned',
                            'format': 'ulaw', 'optimal_frame_size': 160})
        if wrong_identity:
            await ws.close()
            return ws
        await gate.wait()
        await ws.send_bytes(b'a' * 160)
        async for message in ws:
            if message.type == aiohttp.WSMsgType.TEXT:
                value = json.loads(message.data)
                received.append(value)
                if value['command'] == 'FLUSH_MEDIA':
                    await ws.close()
        return ws

    app = web.Application()
    app.router.add_get('/media/' + connection, media)
    server = TestServer(app)
    await server.start_server()
    async with aiohttp.ClientSession(auth=aiohttp.BasicAuth('ari', 'password')) as session:
        transport = AsteriskWebSocketMedia('owned', connection)
        try:
            if wrong_identity:
                with pytest.raises(ProviderError):
                    await transport.connect(session, str(server.make_url('')).replace('http:', 'ws:').rstrip('/'))
                return
            await transport.connect(session, str(server.make_url('')).replace('http:', 'ws:').rstrip('/'))
            transport.enable_input()
            gate.set()
            assert await asyncio.wait_for(transport.input.frame(), 1) == b'a' * 160
            await transport.flush()
            await asyncio.wait_for(transport.failed.wait(), 1)
            assert transport.error == 'media_eof'
            assert received == [{'command': 'FLUSH_MEDIA'}]
        finally:
            gate.set()
            await transport.close()
            await server.close()


@pytest.mark.asyncio
async def test_backpressure_does_not_block_caller_input_or_control_messages():
    connection = '00000000-0000-4000-8000-000000000002'
    sockets, received = [], []
    async def media(request):
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        sockets.append(ws)
        await ws.send_json({'event': 'MEDIA_START', 'connection_id': connection,
                            'channel_id': 'owned', 'format': 'ulaw', 'optimal_frame_size': 160})
        await ws.send_json({'event': 'MEDIA_XOFF', 'channel_id': 'owned'})
        async for message in ws:
            if message.type == aiohttp.WSMsgType.BINARY:
                received.append(message.data)
            elif message.type == aiohttp.WSMsgType.TEXT:
                command = json.loads(message.data)['command']
                if command == 'GET_STATUS':
                    await ws.send_json({'event': 'STATUS', 'channel_id': 'owned', 'queue_length': 0})
        return ws
    app = web.Application()
    app.router.add_get('/media/' + connection, media)
    server = TestServer(app)
    await server.start_server()
    async with aiohttp.ClientSession() as session:
        transport = AsteriskWebSocketMedia('owned', connection)
        task = None
        try:
            await transport.connect(session, str(server.make_url('')).replace('http:', 'ws:').rstrip('/'))
            transport.enable_input()
            await asyncio.sleep(.01)
            task = asyncio.create_task(transport.write(b'o' * 160))
            await sockets[0].send_bytes(b'i' * 160)
            assert await asyncio.wait_for(transport.input.frame(), 1) == b'i' * 160
            assert not task.done()
            await sockets[0].send_json({'event': 'MEDIA_XON', 'channel_id': 'owned'})
            await asyncio.wait_for(task, 1)
            async with asyncio.timeout(1):
                while not received:
                    await asyncio.sleep(.01)
            assert received == [b'o' * 160]
        finally:
            if task:
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)
            await transport.close()
            await server.close()
