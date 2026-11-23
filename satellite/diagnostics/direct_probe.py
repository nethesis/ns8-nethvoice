"""Minimal primary Live client and isolated Realtime control. No PBX writes.

Credentials are resolved inside Satellite using the existing encrypted binding.
Only fixed synthetic PCMU speech is accepted on stdin; audio and transcripts are
discarded in memory. Each invocation consumes the shared armed session budget.
"""
import argparse
import asyncio
import base64
import json
import sys
import time

import aiohttp

from voice_agent.storage import Storage
from .budget import reserve_session
from .live_audio import SignalStats
from .rtp import decode_ulaw
from .scoped_runner import fingerprint

LIVE_URL = 'wss://api.openai.com/v1/live/sessions'
REALTIME_URL = 'wss://api.openai.com/v1/realtime?model=gpt-realtime-2'
STREAM_SECONDS = 35


async def probe(case, expected_snapshot, speech):
    if case not in ('direct-live', 'realtime') or not 0 < len(speech) <= 160000:
        raise ValueError('invalid_test_input')
    storage = Storage()
    snapshot = storage.snapshot('receptionist')
    if fingerprint(snapshot) != expected_snapshot:
        raise ValueError('snapshot_changed')
    binding = storage.binding(snapshot['provider_binding_id'])
    output = {'case': case, 'maximum_seconds': 55, 'errors': 0, 'started': False,
              'finalization_confirmed': False, 'transcripts_retained': 0}
    sent, received = SignalStats(8000), SignalStats(8000)
    ready, closed = asyncio.Event(), asyncio.Event()
    live = case == 'direct-live'
    url = LIVE_URL if live else REALTIME_URL
    session_config = {
        'model': 'gpt-live-1', 'store': False,
        'instructions': 'Speak concisely in Italian. Greet the caller, then listen and answer briefly. Do not use tools.',
        'input': [{'type': 'message', 'role': 'developer', 'content': [
            {'type': 'input_text', 'text': 'Say the opening greeting immediately: ' + snapshot['conversation']['greeting']}]}],
        'audio': {'format': {'type': 'audio/pcmu', 'rate': 8000}, 'output': {'voice': 'ballad'}},
        'delegation': {'type': 'client'}}
    output['budget_attempt'] = reserve_session(case)
    started = time.monotonic()
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=8)) as client:
        async with client.ws_connect(url, headers={'Authorization': 'Bearer ' + binding['api_key']},
                                     heartbeat=10, max_msg_size=512 * 1024) as ws:
            async def receiver():
                async for message in ws:
                    if message.type != aiohttp.WSMsgType.TEXT:
                        continue
                    event = json.loads(message.data)
                    kind = event.get('type')
                    if kind == ('session.started' if live else 'session.updated'):
                        ready.set()
                    elif kind in ('session.output_audio.delta', 'response.output_audio.delta', 'response.audio.delta'):
                        encoded = event.get('delta')
                        if isinstance(encoded, str) and len(encoded) <= 262144:
                            try:
                                received.pcm(decode_ulaw(base64.b64decode(encoded, validate=True)))
                            except (ValueError, TypeError):
                                received.invalid += 1
                    elif kind == 'error':
                        output['errors'] += 1
                    elif kind == 'session.closed':
                        output['finalization_confirmed'] = True
                        closed.set()

            task = asyncio.create_task(receiver())
            try:
                async with asyncio.timeout(48):
                    if live:
                        await ws.send_json({'type': 'session.start', 'session': session_config})
                    else:
                        await ws.send_json({'type': 'session.update', 'session': {
                            'type': 'realtime', 'model': 'gpt-realtime-2',
                            'instructions': session_config['instructions'],
                            'audio': {'input': {'format': {'type': 'audio/pcmu'},
                                               'turn_detection': {'type': 'server_vad'}},
                                      'output': {'format': {'type': 'audio/pcmu'}, 'voice': 'ballad'}}}})
                    await asyncio.wait_for(ready.wait(), 8)
                    output['started'] = True
                    if not live:
                        await ws.send_json({'type': 'response.create', 'response': {
                            'instructions': 'Greet the caller briefly in Italian, then listen.'}})
                    stream_started = time.monotonic()
                    for frame in range(int(STREAM_SECONDS * 50)):
                        await asyncio.sleep(max(0, stream_started + frame * .02 - time.monotonic()))
                        offset = frame * 160 - 12 * 8000
                        audio = speech[offset:offset + 160] if 0 <= offset < len(speech) else b''
                        audio = audio.ljust(160, b'\xff')
                        await ws.send_json({'type': 'session.input_audio.append' if live else 'input_audio_buffer.append',
                                            'audio': base64.b64encode(audio).decode()})
                        sent.pcm(decode_ulaw(audio))
            except asyncio.TimeoutError:
                output['test_error'] = 'deadline'
            finally:
                if live and not ws.closed:
                    await ws.send_json({'type': 'session.close'})
                    try:
                        await asyncio.wait_for(closed.wait(), 3)
                    except asyncio.TimeoutError:
                        pass
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)
    output.update(elapsed_seconds=round(time.monotonic() - started, 3), input_sent=sent.snapshot(),
                  output_received=received.snapshot())
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('case', choices=('direct-live', 'realtime'))
    parser.add_argument('snapshot_sha256')
    args = parser.parse_args()
    try:
        result = asyncio.run(probe(args.case, args.snapshot_sha256, sys.stdin.buffer.read(160001)))
        print(json.dumps(result))
    except Exception as error:
        print(json.dumps({'probe_failed': type(error).__name__}))
        raise SystemExit(1)


if __name__ == '__main__':
    main()
