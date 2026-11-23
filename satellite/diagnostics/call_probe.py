"""Bounded automated caller through the existing 7777 route, without recordings.

Run manually inside the temporary Satellite image. Stdin is fixed synthetic
PCMU speech at 8 kHz (max 20 s); stdout contains only measurements. Requires
an operator-armed budget, a pinned snapshot hash, and no existing ARI channels.
"""
import argparse
import asyncio
import json
import os
import secrets
import sys
import time
from urllib.parse import quote

import aiohttp

from voice_agent.storage import Storage, database
from voice_agent.ari import new_channel_id
from .budget import reserve_session
from .rtp import SyntheticRTP
from .scoped_runner import ARM, ROOT, fingerprint


async def probe(variant, expected_snapshot, speech):
    if variant not in ('current', 'concise', 'primary-ws') or not 0 < len(speech) <= 160000:
        raise ValueError('invalid_test_input')
    snapshot = Storage().snapshot('receptionist')
    if fingerprint(snapshot) != expected_snapshot:
        raise ValueError('snapshot_changed')
    label = secrets.token_hex(16)
    caller, other, media = [new_channel_id() for _ in range(3)]
    app, bridge = 'nvprobe-' + label, 'nvprobe-bridge-' + label
    base = os.environ['ASTERISK_URL'].rstrip('/') + '/ari'
    authorization = aiohttp.encode_basic_auth(os.environ['ARI_USERNAME'], os.environ['SATELLITE_ARI_PASSWORD'])
    endpoint = SyntheticRTP()
    transport, _ = await asyncio.get_running_loop().create_datagram_endpoint(lambda: endpoint, local_addr=('127.0.0.1', 0))
    output = {'case': variant, 'maximum_seconds': 55, 'route': '7777', 'external_numbers_dialed': 0}
    stream_task = None
    started = time.time()
    owned = {caller, other, media}
    async with aiohttp.ClientSession(headers={'Authorization': authorization}, timeout=aiohttp.ClientTimeout(total=4)) as client:
        async def request(method, path, **kwargs):
            async with client.request(method, base + path, **kwargs) as response:
                if response.status >= 400:
                    raise RuntimeError('ari_request_failed')
                return {} if response.status == 204 else await response.json()

        async def cleanup(method, path):
            try:
                await request(method, path)
            except Exception:
                pass

        try:
            if await request('GET', '/channels') != []:
                raise RuntimeError('active_channels_defer')
            output['budget_attempt'] = reserve_session(variant)
            arm = {'label': label, 'linkedid': caller, 'agent_channel_id': other, 'variant': variant,
                   'expires_at': time.time() + 50, 'snapshot_sha256': expected_snapshot}
            fd = os.open(ARM, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(fd, 'w') as handle:
                json.dump(arm, handle)
            wsurl = base.replace('http://', 'ws://', 1).replace('https://', 'wss://', 1) + '/events'
            async with client.ws_connect(wsurl, params={'app': app}, heartbeat=10) as ws:
                async with asyncio.timeout(48):
                    await request('POST', '/bridges/' + bridge, params={'type': 'mixing,proxy_media'})
                    await request('POST', '/channels/externalMedia', params={
                        'app': app, 'channelId': media, 'external_host': '127.0.0.1:' + str(transport.get_extra_info('sockname')[1]),
                        'format': 'ulaw', 'encapsulation': 'rtp', 'transport': 'udp', 'direction': 'both'})
                    channel_path = '/channels/' + media
                    port = await request('GET', channel_path + '/variable', params={'variable': 'UNICASTRTP_LOCAL_PORT'})
                    address = await request('GET', channel_path + '/variable', params={'variable': 'UNICASTRTP_LOCAL_ADDRESS'})
                    # All media must remain within the host network.
                    if address.get('value') != '127.0.0.1':
                        raise RuntimeError('nonloopback_media_refused')
                    endpoint.peer = ('127.0.0.1', int(port['value']))
                    await request('POST', '/bridges/' + bridge + '/addChannel', params={'channel': media})
                    await request('POST', '/channels', params={
                        'endpoint': 'Local/7777@from-internal/n', 'app': app,
                        'channelId': caller, 'otherChannelId': other, 'timeout': 30},
                        json={'variables': {'TIMEOUT(absolute)': '45'}})
                    while True:
                        if stream_task and stream_task.done():
                            await stream_task
                            break
                        try:
                            message = await asyncio.wait_for(ws.receive(), .25)
                        except asyncio.TimeoutError:
                            continue
                        if message.type != aiohttp.WSMsgType.TEXT:
                            continue
                        event = json.loads(message.data)
                        cid = (event.get('channel') or {}).get('id')
                        if event.get('type') == 'StasisStart' and cid == caller and stream_task is None:
                            await request('POST', '/channels/' + caller + '/answer')
                            await request('POST', '/bridges/' + bridge + '/addChannel', params={'channel': caller})
                            stream_task = asyncio.create_task(endpoint.stream(speech))
                        if event.get('type') == 'ChannelDestroyed' and cid == caller:
                            break
                        # Periodic WebSocket pings do not guarantee application
                        # events; the overall timeout remains the hard stop.
        except asyncio.TimeoutError:
            output['test_error'] = 'deadline'
        finally:
            ARM.unlink(missing_ok=True)
            if stream_task:
                stream_task.cancel()
                await asyncio.gather(stream_task, return_exceptions=True)
            for cid in owned:
                await cleanup('DELETE', '/channels/' + quote(cid, safe=''))
            await cleanup('DELETE', '/bridges/' + bridge)
            transport.close()
        # Bound teardown observation, and never hang up unrelated channels.
        for _ in range(12):
            remaining = await request('GET', '/channels')
            if not remaining:
                break
            await asyncio.sleep(.25)
        output.update(caller_audio=endpoint.measurements(), all_channels_zero=not remaining,
                      elapsed_seconds=round(time.time() - started, 3))
    result = ROOT / ('live-diagnostic-result-' + label + '.json')
    # ARI can remove the last channel before asynchronous provider close and
    # monitoring flush finish. Wait for that result rather than losing evidence.
    result_deadline = time.monotonic() + (20 if variant == 'primary-ws' else 5)
    while not result.exists() and time.monotonic() < result_deadline:
        await asyncio.sleep(.05)
    if result.exists():
        output['provider'] = json.loads(result.read_text())
        result.unlink()
    else:
        output['instrumentation'] = 'missing_result'
    with database('monitor') as connection:
        with connection.cursor(dictionary=True) as cursor:
            cursor.execute('SELECT run_id,outcome,error_code,workflow_version FROM asteriskcdrdb.voice_agent_runs WHERE linkedid IN (%s,%s) AND started_at>=FROM_UNIXTIME(%s)', (caller, other, started - 1))
            runs = cursor.fetchall()
            output['runs'] = []
            for run in runs:
                cursor.execute('SELECT event_type,TIMESTAMPDIFF(MICROSECOND,%s,occurred_at)/1000 AS elapsed_ms FROM asteriskcdrdb.voice_agent_run_events WHERE run_id=%s ORDER BY occurred_at',
                               (time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime(started)), run['run_id']))
                output['runs'].append({'outcome': run['outcome'], 'error_code': run['error_code'],
                                       'version': run['workflow_version'], 'events': [
                                           {'type': row['event_type'], 'elapsed_ms': float(row['elapsed_ms'])} for row in cursor.fetchall()]})
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('variant', choices=('current', 'concise', 'primary-ws'))
    parser.add_argument('snapshot_sha256')
    args = parser.parse_args()
    try:
        speech = sys.stdin.buffer.read(160001)
        result = asyncio.run(probe(args.variant, args.snapshot_sha256, speech))
        print(json.dumps(result))
    except Exception as error:
        # Never print a traceback: provider/ARI exception contexts contain IDs.
        print(json.dumps({'probe_failed': type(error).__name__}))
        raise SystemExit(1)


if __name__ == '__main__':
    main()
