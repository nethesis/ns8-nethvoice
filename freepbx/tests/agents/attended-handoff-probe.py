#!/usr/bin/env python3
"""Opt-in installed-Asterisk proof using synthetic Local channels only.

Run on the authorized NS8 node. Adds one temporary CLI dialplan context, never
reloads FreePBX, dials no extensions/providers and removes only owned resources.
This proves a native Bridge primitive, not attended-transfer product acceptance.
"""
import argparse
import json
import re
import secrets
import socket
import subprocess
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--authorized-test', action='store_true', required=True)
    parser.add_argument('--expected-host', required=True)
    parser.add_argument('--module', required=True)
    args = parser.parse_args()
    if args.expected_host != socket.gethostname():
        raise SystemExit('host_mismatch')
    prefix = ['runagent', '-m', args.module, 'podman']

    def command(argv, data=None):
        result = subprocess.run(prefix + argv, input=data, text=True,
                                capture_output=True, timeout=60)
        if result.returncode:
            raise RuntimeError('probe_command_failed')
        return result.stdout

    def cli(value):
        return command(['exec', 'freepbx', 'asterisk', '-rx', value])

    def identities():
        rows = json.loads(command(['inspect', 'freepbx', 'satellite', 'nethcti-middleware']))
        return {row['Name']: {key: row[key] for key in ('Id', 'Image', 'RestartCount')}
                | {'started': row['State']['StartedAt']} for row in rows}

    baseline = identities()
    if '0 active channels\n0 active calls' not in cli('core show channels count'):
        raise SystemExit('active_calls_defer')
    version = cli('core show version').strip().split(' built by ')[0]
    context = 'va-proof-' + secrets.token_hex(8)
    contexts = (context, 'stasis-' + context)
    if any("Context '" + name + "'" in cli('dialplan show ' + name) for name in contexts):
        raise SystemExit('probe_context_collision')
    token = secrets.token_hex(16)
    channel_ids = ['va' + secrets.token_hex(14) for _ in range(2)]
    report = {'asterisk': version, 'native_handoff': False, 'cleanup': False,
              'provider_connections': 0, 'extension_calls': 0,
              'scope': 'synthetic Local channels; independent test ARI controller'}
    try:
        for extension, applications in {
            'endpoint': ['Answer()', 'Wait(45)', 'Hangup()'],
            'recipient': ['Set(TIMEOUT(absolute)=0)', 'Wait(45)', 'Hangup()'],
            'handoff': ['Set(TIMEOUT(absolute)=0)',
                        'GotoIf($["${VOICE_AGENT_PROOF_TOKEN}"!="' + token + '"]?rejected,1)',
                        'Bridge(${VOICE_AGENT_PROOF_PEER},x)', 'Hangup()'],
            'rejected': ['Hangup()'],
        }.items():
            for priority, application in enumerate(applications, 1):
                response = cli(f'dialplan add extension {extension},{priority},{application} into {context}')
                if ' added into ' not in response:
                    raise RuntimeError('dialplan_setup_failed')
        # The private runner gets credentials from its existing environment. No
        # secrets or raw events leave the container; only bounded proof booleans.
        configuration = {'context': context, 'token': token, 'ids': channel_ids}
        source = 'CONFIG = ' + repr(configuration) + '\n' + ARI_PROBE
        result = command(['exec', '-i', 'satellite', 'python', '-'], source)
        report.update(json.loads(result))
    finally:
        # CLI hangup takes channel names. Match only this random test context,
        # including both Local halves, if the ARI controller has already exited.
        owned_name = re.compile(r'Local/endpoint@' + re.escape(context) + r'-[0-9a-f]+;[12]')
        for line in cli('core show channels concise').splitlines():
            name = line.split('!', 1)[0]
            if owned_name.fullmatch(name):
                cli('channel request hangup ' + name)
        for _ in range(30):
            channels = cli('core show channels concise')
            if not any(owned_name.fullmatch(line.split('!', 1)[0]) for line in channels.splitlines()):
                break
            time.sleep(.1)
        for name in contexts:
            cli('dialplan remove context ' + name)
        report['cleanup'] = (not any(owned_name.fullmatch(line.split('!', 1)[0]) for line in channels.splitlines())
                             and all("Context '" + name + "'" not in cli('dialplan show ' + name) for name in contexts))
        report['containers_unchanged'] = identities() == baseline
        report['zero_final_calls'] = '0 active channels\n0 active calls' in cli('core show channels count')
        print(json.dumps(report, indent=2))
    if not (report['native_handoff'] and report['cleanup'] and report['containers_unchanged']
            and report['zero_final_calls']):
        raise SystemExit('native_handoff_not_proven')


ARI_PROBE = r'''
import asyncio
import json
import os
from urllib.parse import quote
import aiohttp

stage = 'connect'
observed = {}

async def main():
    global stage
    base = os.environ['ASTERISK_URL'].rstrip('/') + '/ari'
    auth = aiohttp.BasicAuth(os.environ['ARI_USERNAME'], os.environ['SATELLITE_ARI_PASSWORD'])
    caller, recipient = CONFIG['ids']
    owned = {caller, recipient, caller + ';2', recipient + ';2'}
    context = CONFIG['context']
    app = context
    report = {}
    async with aiohttp.ClientSession(auth=auth, timeout=aiohttp.ClientTimeout(total=4)) as client:
        async def req(method, path, **kwargs):
            async with client.request(method, base + path, **kwargs) as response:
                if response.status == 404 and method == 'DELETE':
                    return None
                if response.status >= 400:
                    raise RuntimeError('ari_probe_request_failed')
                return None if response.status == 204 else await response.json()

        async def variable(identifier, name, value):
            await req('POST', '/channels/' + quote(identifier, safe='') + '/variable',
                      params={'variable': name, 'value': value})

        async def native_bridge():
            bridges = await req('GET', '/bridges')
            observed['bridge_count'] = len(bridges)
            observed['bridge_membership'] = [[identifier in bridge.get('channels', [])
                                               for identifier in (caller, recipient)] for bridge in bridges]
            for bridge in bridges:
                if {caller, recipient} <= set(bridge.get('channels', [])):
                    observed['bridge_class'] = bridge.get('bridge_class')
                    assert bridge.get('bridge_class') == 'basic', 'not_a_native_basic_bridge'
                    return bridge['id']
            return None

        async def wait_for(predicate, seconds=5):
            async with asyncio.timeout(seconds):
                while True:
                    value = await predicate()
                    if value:
                        return value
                    await asyncio.sleep(.05)

        wsbase = base.replace('http://', 'ws://', 1).replace('https://', 'wss://', 1)
        async with client.ws_connect(wsbase + '/events', params={'app': app}) as ws:
            stage = 'originate'
            assert await req('GET', '/channels') == [], 'active_channels_defer'
            for identifier in (caller, recipient):
                await req('POST', '/channels', params={
                    'endpoint': 'Local/endpoint@' + context + '/n', 'app': app,
                    'channelId': identifier, 'timeout': 5}, json={'variables': {
                        '__VOICE_AGENT_PROOF_TOKEN': CONFIG['token'], 'TIMEOUT(absolute)': '10'}})
            started = set()
            stage = 'await_answer'
            async with asyncio.timeout(5):
                while started != {caller, recipient}:
                    message = await ws.receive()
                    if message.type != aiohttp.WSMsgType.TEXT:
                        continue
                    event = json.loads(message.data)
                    if event.get('type') == 'StasisStart' and event.get('channel', {}).get('id') in owned:
                        started.add(event['channel']['id'])
            names = {}
            for identifier in (caller, recipient):
                channel = await req('GET', '/channels/' + quote(identifier, safe=''))
                assert channel['state'] == 'Up', 'not_answered'
                names[identifier] = channel['name']
                await req('POST', '/applications/' + app + '/subscription',
                          params={'eventSource': 'channel:' + identifier})
            stage = 'native_release'
            # Bridge() accepts prefixes. A Local uniqueid is also a prefix of
            # its ;2 peer; the complete ;1 channel name binds the answered leg.
            assert names[recipient].endswith(';1'), 'unexpected_local_half'
            await variable(caller, 'VOICE_AGENT_PROOF_PEER', names[recipient])
            await req('POST', '/channels/' + recipient + '/continue',
                      params={'context': context, 'extension': 'recipient', 'priority': 1})
            await req('POST', '/channels/' + caller + '/continue',
                      params={'context': context, 'extension': 'handoff', 'priority': 1})
            stage = 'confirm_native_bridge'
            try:
                bridge = await wait_for(native_bridge)
            except TimeoutError:
                for role, identifier in [('caller', caller), ('recipient', recipient)]:
                    try:
                        channel = await req('GET', '/channels/' + quote(identifier, safe=''))
                        observed[role + '_state'] = channel.get('state')
                        observed[role + '_application'] = channel.get('dialplan', {}).get('app_name')
                        value = await req('GET', '/channels/' + quote(identifier, safe='') + '/variable',
                                          params={'variable': 'BRIDGERESULT'})
                        observed[role + '_bridge_result'] = value.get('value')
                    except RuntimeError:
                        observed[role + '_query_failed'] = True
                raise
            # Application channel_ids also contains passive subscriptions; it
            # cannot distinguish ownership after a channel leaves Stasis.
            stage = 'confirm_stasis_release'
            released = set()
            async with asyncio.timeout(5):
                while released != {caller, recipient}:
                    message = await ws.receive()
                    if message.type != aiohttp.WSMsgType.TEXT:
                        continue
                    event = json.loads(message.data)
                    if event.get('type') == 'StasisEnd' and event.get('channel', {}).get('id') in (caller, recipient):
                        released.add(event['channel']['id'])
            report['both_answered_before_handoff'] = True
            report['both_released_from_stasis'] = True
            report['native_handoff'] = True
            for identifier in (caller, recipient):
                await req('DELETE', '/applications/' + app + '/subscription',
                          params={'eventSource': 'channel:' + identifier})
        # Close the test controller, then wait beyond its original absolute
        # timeout. This does not stop or restart the shared Satellite service.
        await asyncio.sleep(11)
        stage = 'survival'
        report['survives_controller_disconnect_and_original_timeout'] = await native_bridge() == bridge
        assert report['survives_controller_disconnect_and_original_timeout'], 'native_call_lost'
        for identifier in (caller, recipient):
            value = await req('GET', '/channels/' + quote(identifier, safe='') + '/variable',
                              params={'variable': 'VOICE_AGENT_PROOF_TOKEN'})
            assert value['value'] == CONFIG['token'], 'attempt_correlation_lost'
        report['attempt_correlation_preserved'] = True
    print(json.dumps(report))

try:
    asyncio.run(main())
except Exception as error:
    print(json.dumps({'native_handoff': False, 'error_stage': stage,
                      'error_class': type(error).__name__, 'observed': observed}))
'''


if __name__ == '__main__':
    main()
