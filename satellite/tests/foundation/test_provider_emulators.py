"""Adapt the legacy TCP simulator to PHP-owned v3 snapshots, for both vendors."""
import asyncio
import copy
import json

import pytest
from aiohttp import web
from aiohttp.test_utils import TestServer
from test_runtime import fixtures, admit, sign
from test_tool_bindings import snapshot
from voice_agent.providers import create_adapter
from voice_agent.tools import DEFINITIONS


class Emulator:
    def __init__(self, provider):
        self.provider = provider
        self.accepted = []
        self.received = []
        self.ws = None
        self.app = web.Application()
        self.app.router.add_post('/v1/realtime/calls/{call_id}/accept', self.accept)
        self.app.router.add_post('/v1/realtime/calls/{call_id}/hangup', self.hangup)
        self.app.router.add_get('/v1/realtime', self.connect)

    async def accept(self, request):
        assert self.provider == 'openai'
        assert request.headers['Authorization'] == 'Bearer synthetic-api'
        self.accepted.append(await request.json())
        return web.Response()

    async def hangup(self, request):
        return web.Response()

    async def connect(self, request):
        assert request.headers['Authorization'] == 'Bearer synthetic-api'
        assert request.query['call_id'] == 'synthetic-provider-call'
        self.ws = web.WebSocketResponse()
        await self.ws.prepare(request)
        async for message in self.ws:
            event = json.loads(message.data)
            self.received.append(event)
            if event['type'] == 'session.update':
                await self.ws.send_json({'type': 'session.updated', 'session': event['session']})
        return self.ws

    async def tool(self, name, args, identifier):
        item = {'type': 'function_call', 'name': name, 'arguments': json.dumps(args), 'call_id': identifier}
        await self.ws.send_json({'type': 'response.created', 'response': {'id': identifier}})
        await self.ws.send_json({**item, 'type': 'response.function_call_arguments.done', 'response_id': identifier})
        await self.ws.send_json({'type': 'response.done', 'response': {'id': identifier, 'status': 'completed', 'output': [item]}})

    def results(self, identifier):
        return [json.loads(e['item']['output']) for e in self.received
                if e['type'] == 'conversation.item.create' and e['item'].get('call_id') == identifier]


async def eventually(predicate):
    async with asyncio.timeout(3):
        while not predicate(): await asyncio.sleep(.01)


@pytest.mark.asyncio
@pytest.mark.parametrize('provider', ['openai', 'grok'])
async def test_signed_admission_v3_tools_denial_and_provider_disconnect(provider):
    runtime, storage, controller, _ = fixtures()
    storage.snapshot.return_value = snapshot()
    storage.snapshot.return_value['provider'] = provider
    storage.tools.return_value = copy.deepcopy(DEFINITIONS)
    storage.snapshot.return_value['conversation'].update(model='gpt-realtime-2' if provider=='openai' else 'provider-default', voice='marin' if provider=='openai' else 'eve')
    storage.binding.return_value['provider'] = provider
    storage.binding.return_value['grok_phone_number'] = '+15555550100'
    storage.binding.return_value['model'] = 'gpt-realtime-2' if provider == 'openai' else 'provider-default'
    emulator = Emulator(provider)
    server = TestServer(emulator.app)
    await server.start_server()
    def factory(binding):
        adapter = create_adapter(binding)
        adapter.http_base = str(server.make_url('/v1/realtime')).rstrip('/')
        adapter.ws_base = str(server.make_url('/v1/realtime')).replace('http:', 'ws:')
        return adapter
    runtime.adapter_factory = factory
    call = None
    try:
        call = await admit(runtime)
        if provider == 'openai': storage.binding.return_value['model'] = 'gpt-realtime-2.1'
        await runtime.event({'type': 'StasisStart', 'args': ['provider', call.session_id], 'channel': {'id': call.leg_id}})
        body, headers = sign(call, {'call_id': 'synthetic-provider-call', 'sip_headers': [
            {'name': 'X-OS-Session-ID', 'value': call.session_id},
            {'name': 'X-OS-Provider-Leg-ID', 'value': call.leg_id},
            {'name': 'X-OS-Agent-ID', 'value': call.snapshot['agent_id']}]})
        assert await runtime.webhook(provider, body, headers) == {'status': 'accepted'}
        assert await runtime.webhook(provider, body, headers) == {'status': 'duplicate'}
        await eventually(lambda: call.media_connected)
        session = emulator.accepted[0] if provider == 'openai' else next(e['session'] for e in emulator.received if e['type'] == 'session.update')
        assert {t['name'] for t in session['tools']} == {'nv_pbx_find_destinations_v1', 'nv_pbx_transfer_v2','nv_pbx_find_recent_callers_v1'}
        assert bool(emulator.accepted) == (provider == 'openai')
        if provider == 'openai': assert session['model'] == 'gpt-realtime-2'
        else: assert 'model' not in session
        # Names/results only: no arbitrary target, payload or caller-number grants.
        await emulator.tool('nv_pbx_transfer_v2', {'destination_id': 'extension:999'}, 'denied')
        await eventually(lambda: emulator.results('denied'))
        assert emulator.results('denied') == [{'error': 'destination_denied'}]
        controller.continue_channel.assert_not_awaited()
        await emulator.tool('nv_pbx_find_destinations_v1', {}, 'search')
        await eventually(lambda: emulator.results('search'))
        assert emulator.results('search') == [{'destinations': [{'id': 'extension:203', 'name': 'Test extension', 'description':''}], 'next_offset': None}]
        # EOF must take the pinned native Hangup fallback, without stranding media.
        await emulator.ws.close()
        await eventually(lambda: call.terminal)
        controller.continue_channel.assert_awaited()
        assert any(e['event_type']=='fallback' for e in runtime.monitoring.queue._queue)
    finally:
        if call and not call.terminal: await runtime.finish(call, 'completed')
        await asyncio.gather(*list(runtime.tasks), return_exceptions=True)
        await server.close()
