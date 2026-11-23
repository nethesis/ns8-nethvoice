"""Live greeting startup and bounded forwarding of early caller audio."""
import asyncio

import pytest

from test_agent_models import snapshot
from test_live import connected
from voice_agent.providers.live_primary import OpenAILiveWebSocketSession


@pytest.mark.asyncio
async def test_greeting_is_seeded_then_activated_in_one_commentary_event():
    async with connected({'greeting': 'Welcome to the synthetic test.',
                          'language': 'it'}) as (adapter, emulator):
        configuration = emulator.accepted[0]['session']
        assert '<|SpawnThinking|>' in configuration['instructions']
        assert 'Backchannel policy:' in configuration['instructions']
        assert 'Interruption policy:' in configuration['instructions']
        assert 'Welcome to the synthetic test.' in configuration['input'][-1]['content'][0]['text']
        await adapter.respond('Repeated opening policy. ' * 200)
        updates = [e for e in emulator.received if e['type'].endswith('.append')]
        assert len(updates) == 1
        assert updates[0]['type'] == 'session.commentary.append'
        assert updates[0]['delegation_id'] is None
        assert 'Welcome to the synthetic test.' in updates[0]['content']
        assert 'it' in updates[0]['content']


@pytest.mark.asyncio
async def test_long_welcome_stays_in_startup_context_without_serial_appends():
    welcome = 'Benvenuto, come posso aiutarti? ' * 60
    async with connected({'greeting': welcome, 'language': 'it'}) as (adapter, emulator):
        assert welcome in emulator.accepted[0]['session']['input'][-1]['content'][0]['text']
        await adapter.respond()
        updates = [event for event in emulator.received if event['type'].endswith('.append')]
        assert len(updates) == 1
        assert len(updates[0]['content'].encode()) <= 400
        assert updates[0]['type'] == 'session.commentary.append'


def test_primary_session_has_no_wait_for_media_that_is_already_connected():
    adapter = OpenAILiveWebSocketSession({'api_key': 'synthetic'})
    configuration = adapter.configuration(snapshot('gpt-live-1')['conversation'], [])
    assert 'SIP session starts before caller media' not in configuration['instructions']
    assert all('Wait for the application to confirm' not in item['content'][0]['text']
               for item in configuration['input'])


@pytest.mark.asyncio
async def test_input_forwards_buffered_early_speech_without_retaining_startup_lag():
    from types import SimpleNamespace
    from voice_agent.media import AudioBuffer, AudioBridge

    source = AudioBuffer()
    # A second of early caller audio accumulated while the provider connected.
    frames = [bytes([index]) * 160 for index in range(50)]
    source.append(b''.join(frames))
    received = []
    current = asyncio.Event()

    async def send(frame):
        received.append(frame)
        if len(received) == 51:
            current.set()

    failures = []
    media = SimpleNamespace(input=source)
    provider = SimpleNamespace(send_audio=send)
    bridge = AudioBridge(media, provider, failures.append)
    task = asyncio.create_task(bridge._pump_input())
    try:
        await asyncio.sleep(.01)
        source.append(b'z' * 160)
        await asyncio.wait_for(current.wait(), .15)
        assert received == frames + [b'z' * 160]
        assert not failures
    finally:
        bridge.stopped = True
        source.close()
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
