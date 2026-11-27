"""Synthetic debug content is opt-in, bounded and separate from call control."""
import copy
import json
from unittest.mock import AsyncMock

import pytest
from test_tool_bindings import snapshot
from voice_agent.contract import validate_snapshot
from voice_agent.tools import ToolRegistry


def debug_snapshot():
    value = snapshot()
    value['contract_version'] = 8
    value['debug'] = {'transcription_enabled': False, 'retention_hours': 24}
    return value


def test_debug_contract_is_additive_and_strict():
    assert validate_snapshot(debug_snapshot())['debug']['transcription_enabled'] is False
    unsupported=debug_snapshot(); unsupported['provider']='grok'; unsupported['debug']['transcription_enabled']=True
    with pytest.raises(ValueError): validate_snapshot(unsupported)
    original = snapshot()
    original['debug']['unknown'] = True
    with pytest.raises(ValueError): validate_snapshot(original)
    for invalid in [0, 25, 1.0, True]:
        value = debug_snapshot(); value['debug']['retention_hours'] = invalid
        with pytest.raises(ValueError): validate_snapshot(value)


@pytest.mark.asyncio
async def test_routing_context_guides_a_real_tool_handoff_without_hidden_targets():
    value = snapshot()
    registry = ToolRegistry(value, lambda: [
        {'id': 'extension:203', 'name': 'Synthetic Support'},
        {'id': 'extension:205', 'name': 'Private synthetic target'}], AsyncMock())
    context = await registry.routing_context()
    assert 'Synthetic Support' in context and 'nv_pbx_transfer_v2' in context
    assert 'Private synthetic target' not in context and 'extension:205' not in context
    assert 'untrusted data' in context
    disabled = copy.deepcopy(value); disabled['tool_bindings'][1]['enabled'] = False
    disabled_context = await ToolRegistry(disabled, lambda: [], AsyncMock()).routing_context()
    assert 'Do not offer call transfers' in disabled_context
    assert 'Synthetic Support' not in disabled_context and 'extension:203' not in disabled_context

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
import asyncio
import base64
import hashlib
import subprocess
import uuid
from pathlib import Path
from nacl.secret import SecretBox
from voice_agent.transcripts import Transcripts
from voice_agent.providers.realtime import OpenAIAdapter
from test_contract import ROOT, CONTRACT


def fake_call(enabled=True):
    value = debug_snapshot(); value['debug']['transcription_enabled'] = enabled
    return SimpleNamespace(snapshot=value, binding={'provider': 'openai'}, run_id=str(uuid.uuid4()),
        started_at=datetime.now(timezone.utc), transcript_keys=set(), transcript_bytes=0)


def turn(item='synthetic-turn', text='Synthetic caller asks for support.'):
    return {'type': 'transcript', 'item_id': item, 'content_index': 0, 'position': 1,
            'text': text, 'role': 'caller', 'interrupted': False}


def test_default_off_replay_and_encrypted_php_reader(monkeypatch):
    monkeypatch.setenv('SATELLITE_AGENT_CONFIG_KEY', 'synthetic-debug-key')
    writer = Transcripts(MagicMock(), MagicMock())
    writer.capture(fake_call(False), turn())
    assert writer.queue.empty()
    call = fake_call(); writer.capture(call, turn()); writer.capture(call, turn())
    assert writer.queue.qsize() == 1
    encrypted = writer.queue.get_nowait()
    assert 'text' not in encrypted and 'Synthetic caller' not in str(encrypted)
    raw = SecretBox(hashlib.sha256(b'synthetic-debug-key').digest()).decrypt(base64.b64decode(encrypted['content_encrypted']))
    assert json.loads(raw)['run_id'] == call.run_id
    php = "require $argv[1]; echo (new \\NethVoice\\Agents\\SecretStore())->decryptSecret(trim(stream_get_contents(STDIN)));"
    result = subprocess.run(['php', '-r', php, str(CONTRACT.parent / 'SecretStore.php')], input=encrypted['content_encrypted'], capture_output=True, text=True)
    assert result.returncode == 0 and result.stdout == raw.decode()
    assert encrypted['expires_at'] <= call.started_at + timedelta(hours=24)
    assert (CONTRACT/'published-v8.schema.json').read_bytes() == (ROOT/'satellite/voice_agent/published-v8.schema.json').read_bytes()
    result = subprocess.run(['php', str(ROOT/'freepbx/tests/agents/validate.php')], input=json.dumps(debug_snapshot()), capture_output=True, text=True)
    assert result.returncode == 0


def test_capture_limits_expiry_and_unsupported_provider(monkeypatch):
    monkeypatch.setenv('SATELLITE_AGENT_CONFIG_KEY', 'synthetic-debug-key')
    writer = Transcripts(MagicMock(), MagicMock()); call = fake_call()
    call.started_at -= timedelta(days=2); writer.capture(call, turn()); assert writer.queue.empty()
    call = fake_call(); call.binding['provider'] = 'grok'; writer.capture(call, turn()); assert writer.queue.empty()
    call = fake_call()
    for i in range(100): writer.capture(call, turn(str(i), 'x'*10000))
    assert call.transcript_bytes <= 65536 and len(call.transcript_keys) <= 64 and writer.queue.qsize() <= 128
    assert writer.monitoring.emit.called
    for encrypted in list(writer.queue._queue):
        raw=SecretBox(hashlib.sha256(b'synthetic-debug-key').digest()).decrypt(base64.b64decode(encrypted['content_encrypted']))
        content=json.loads(raw); assert len(content['text']) <= 4000 and content['truncated']


@pytest.mark.asyncio
async def test_optional_database_failure_does_not_break_capture(monkeypatch):
    monkeypatch.setenv('SATELLITE_AGENT_CONFIG_KEY', 'synthetic-debug-key')
    storage = MagicMock(); storage.transcript.side_effect = RuntimeError('sensitive synthetic error')
    monitor = MagicMock(); writer = Transcripts(storage, monitor)
    await writer.start(); writer.capture(fake_call(), turn())
    await asyncio.wait_for(writer.queue.join(), timeout=1)
    assert monitor.emit.call_args.kwargs == {'error': 'debug_transcription_unavailable'}
    await writer.stop()


@pytest.mark.asyncio
async def test_provider_transcripts_off_by_default_and_optional_failure_is_nonfatal(monkeypatch):
    adapter = OpenAIAdapter({'api_key': 'synthetic-key'})
    raw={'type': 'conversation.item.input_audio_transcription.completed', 'item_id': 'synthetic-id', 'content_index': 0, 'transcript': 'Synthetic text'}
    await adapter._handle(raw); assert adapter._observation_queue.empty()
    adapter._ws = SimpleNamespace(closed=False)
    sent=[]
    async def send(event): sent.append(event)
    monkeypatch.setattr(adapter, '_send', send)
    await adapter.set_capture(True)
    assert sent[-1]['session']['audio']['input']['transcription']['model'] == 'gpt-4o-mini-transcribe'
    await adapter._handle(raw)
    assert adapter._observation_queue.get_nowait()['text'] == 'Synthetic text'
    await adapter._handle({'type': 'error', 'error': {'event_id': sent[-1]['event_id'], 'message': 'Synthetic secret detail'}})
    assert adapter._queue.empty()
    assert adapter._observation_queue.get_nowait() == {'type': 'transcript_failed'}
    await adapter._handle(raw); assert adapter._observation_queue.empty()


def test_grouped_fragments_fit_the_encrypted_database_limit(monkeypatch):
    monkeypatch.setenv('SATELLITE_AGENT_CONFIG_KEY', 'synthetic-debug-key')
    writer = Transcripts(MagicMock(), MagicMock())
    call = fake_call()
    call.binding['adapter'] = 'live_ws'
    call.transcript_pending = None
    fragment = 'é\x01\x02\x03' * 250
    for index in range(4):
        writer.capture(call, turn(f'part-{index}', fragment))
    writer.flush(call)
    encrypted = writer.queue.get_nowait()['content_encrypted']
    assert len(encrypted) <= 24000
    vault = SecretBox(hashlib.sha256(b'synthetic-debug-key').digest())
    content = json.loads(vault.decrypt(base64.b64decode(encrypted)))
    assert content['truncated'] and (fragment * 4).startswith(content['text'])
    assert len(content['text'].encode()) == call.transcript_bytes


@pytest.mark.asyncio
async def test_primary_live_debug_transcript_combines_fragments_and_flushes_at_close(monkeypatch):
    from aiohttp.test_utils import TestServer
    from test_agent_models import snapshot as model_snapshot
    from test_live import PrimaryLiveEmulator, eventually
    from test_runtime import admit, fixtures
    from voice_agent.media import AudioBuffer
    from voice_agent.providers import create_adapter

    monkeypatch.setenv('SATELLITE_AGENT_CONFIG_KEY', 'synthetic-debug-key')
    runtime, storage, controller, _ = fixtures()
    value = model_snapshot('gpt-live-1')
    value['debug'] = {'transcription_enabled': True, 'retention_hours': 1}
    storage.snapshot.return_value = value
    controller.connect_media_channel.return_value = SimpleNamespace(
        input=AudioBuffer(), failed=asyncio.Event(), error=None,
        enable_input=MagicMock(), stop_input=MagicMock(), write=AsyncMock(),
        flush=AsyncMock(), close=AsyncMock())
    emulator = PrimaryLiveEmulator()
    async with TestServer(emulator.app) as server:
        def factory(binding):
            adapter = create_adapter(binding)
            adapter.ws_base = str(server.make_url('/v1/live/sessions')).replace('http:', 'ws:')
            events = adapter.events

            async def with_terminal_race():
                async for event in events():
                    if event.get('text') == 'Posso':
                        call.terminal = True
                    yield event

            adapter.events = with_terminal_race
            return adapter

        runtime.adapter_factory = factory
        await runtime.transcripts.start()
        call = await admit(runtime)
        fragments = ['Discussione', ' di', ' prova.'] * 24
        try:
            await eventually(lambda: call.media_connected)
            for index, fragment in enumerate(fragments):
                await emulator.ws.send_json({'type': 'session.input_transcript.delta',
                    'event_id': f'input-{index}', 'delta': fragment})
            await emulator.ws.send_json({'type': 'session.output_transcript.delta',
                'event_id': 'answer-start', 'delta': 'Posso'})
            await eventually(lambda: len(call.adapter._observed) == len(fragments) + 1)
            # Close produces a final fragment after the conversation task is cancelled.
            close = call.adapter.close

            async def close_with_final_fragment():
                await emulator.ws.send_json({'type': 'session.output_transcript.delta',
                    'event_id': 'answer-end', 'delta': ' aiutare.'})
                await eventually(lambda: 'answer-end' in call.adapter._observed)
                # An automatic provider capture limit stops new collection,
                # while already queued opt-in text remains valid.
                call.adapter._capture = False
                await close()

            monkeypatch.setattr(call.adapter, 'close', close_with_final_fragment)
            await runtime.finish(call, 'completed')
        finally:
            await runtime.finish(call, 'completed')
            await asyncio.gather(*list(runtime.tasks), return_exceptions=True)
            await runtime.transcripts.stop()

    rows = [request.args[0] for request in storage.transcript.call_args_list]
    assert [row['position'] for row in rows] == [1, 2]
    vault = SecretBox(hashlib.sha256(b'synthetic-debug-key').digest())
    turns = [json.loads(vault.decrypt(base64.b64decode(row['content_encrypted']))) for row in rows]
    assert [(item['role'], item['text']) for item in turns] == [
        ('caller', ''.join(fragments)), ('assistant', 'Posso aiutare.')]
    assert all(row['expires_at'] == call.started_at + timedelta(hours=1) for row in rows)
    assert all(event['event_type'] != 'transcription_failed' for event in runtime.monitoring.queue._queue)
