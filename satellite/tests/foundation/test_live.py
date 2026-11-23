"""Adapted Live TCP emulator: real HTTP/WebSocket frames, no vendor traffic."""
import asyncio
import copy
import json
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, Mock
from types import SimpleNamespace
import pytest
from aiohttp import web
from aiohttp.test_utils import TestServer
from test_provider_emulators import eventually
from test_agent_models import snapshot
from test_runtime import fixtures, admit, sign
from voice_agent.providers import create_adapter
from voice_agent.providers.live import OpenAILiveAdapter
from voice_agent.providers.realtime import ProviderError
from voice_agent.tools import DEFINITIONS

TOOL = {"type": "function", "name": "lookup", "description": "Read a record",
        "parameters": {"type": "object", "properties": {"id": {"type": "string"}}, "required": ["id"]}}


class LiveEmulator:
    def __init__(self):
        self.accepted = []
        self.received = []
        self.ws = None
        self.reject = None
        # Model context acknowledgments independently of audio events. Clearing
        # this simulates a stalled timeline; tests can still emit early output.
        self.ack_gate = asyncio.Event()
        self.ack_gate.set()
        self.app = web.Application()
        self.app.router.add_post('/v1/live/sessions/{session_id}/accept', self.accept)
        self.app.router.add_post('/v1/live/sessions/{session_id}/hangup', self.hangup)
        self.app.router.add_get('/v1/live/sessions/{session_id}/attach', self.attach)

    async def accept(self, request):
        assert request.headers['Authorization'] == 'Bearer key'
        assert request.match_info['session_id'] == 'live_test'
        body = await request.json()
        assert body['session']['type'] == 'live'
        assert 'format' not in body['session']['audio']
        self.accepted.append(body)
        return web.Response()

    async def attach(self, request):
        assert request.headers['Authorization'] == 'Bearer key'
        assert not request.query
        self.ws = web.WebSocketResponse()
        await self.ws.prepare(request)
        async for message in self.ws:
            event = json.loads(message.data)
            self.received.append(event)
            assert event['type'] != 'session.start'
            if self.reject == event['type']:
                await self.ws.send_json({'type': 'error', 'error': {
                    'client_event_id': event['event_id'], 'message': 'PRIVATE ERROR', 'code': 'invalid'}})
            elif event['type'] == 'session.update':
                assert set(event['session']) == {'delegation'}
                await self.ws.send_json({'type': 'session.updated', 'client_event_id': event['event_id']})
            elif event['type'].endswith('.append'):
                assert len(event['content'].encode()) <= 400
                await self.ack_gate.wait()
                await self.ws.send_json({'type': event['type'] + 'ed', 'client_event_id': event['event_id']})
        return self.ws

    async def hangup(self, request):
        await self.ws.send_json({'type': 'session.closed', 'usage': {'seconds': 15}})
        return web.Response()

    async def event(self, kind, *, response='r1', delegation='d1', **fields):
        payload = {'type': kind, **fields}
        if kind in ('response.created', 'response.completed'):
            payload.setdefault('response', {'id': response, 'status': 'completed', 'output': []})
        # output_item.done deliberately omits response_id, like Responses events.
        await self.ws.send_json({'type': 'response.event', 'delegation_id': delegation, 'event': payload})

    async def tool(self, wire, *, invocation='c1', arguments=None, response='r1', delegation='d1', complete=True):
        await self.event('response.created', response=response, delegation=delegation)
        item = {'type': 'function_call', 'name': wire, 'call_id': invocation,
                'arguments': json.dumps(arguments or {'id': '42'})}
        await self.event('response.output_item.done', item=item, delegation=delegation)
        if complete:
            await self.event('response.completed', response=response, delegation=delegation)
        return item


class PrimaryLiveEmulator(LiveEmulator):
    def __init__(self):
        super().__init__()
        self.app.router.add_get('/v1/live/sessions', self.primary)

    async def primary(self, request):
        self.ws = web.WebSocketResponse()
        await self.ws.prepare(request)
        async for message in self.ws:
            event = json.loads(message.data)
            self.received.append(event)
            if event['type'] == 'session.start':
                self.accepted.append({'session': event['session']})
                await self.ws.send_json({'type': 'session.started', 'session': {'id': 'live_test'}})
            elif event['type'].endswith('.append') and 'content' in event:
                await self.ws.send_json({'type': event['type'] + 'ed', 'client_event_id': event['event_id']})
            elif event['type'] == 'session.close':
                await self.ws.send_json({'type': 'session.closed', 'usage': {'seconds': 1}})
        return self.ws


@asynccontextmanager
async def connected(profile=None, tools=None, *, adapter_class=OpenAILiveAdapter, adapter_options=None):
    emulator = LiveEmulator()
    server = TestServer(emulator.app)
    await server.start_server()
    adapter = adapter_class({'api_key': 'key'}, **(adapter_options or {}))
    adapter.http_base = str(server.make_url('/v1/live/sessions')).rstrip('/')
    adapter.ws_base = adapter.http_base.replace('http:', 'ws:')
    try:
        await adapter.accept('live_test', {**snapshot('gpt-live-1')['conversation'], **(profile or {})}, tools or [TOOL])
        await adapter.connect('live_test')
        yield adapter, emulator
    finally:
        await adapter.close()
        await server.close()


@pytest.mark.asyncio
async def test_completed_items_drive_tools_and_continuation_exactly_once():
    async with connected() as (adapter, emulator):
        wire = next(iter(adapter._wire_tools))
        item = await emulator.tool(wire, complete=False)
        await eventually(lambda: 'c1' in adapter._invocations)
        tool_event = await anext(adapter.events())
        assert tool_event['name'] == 'lookup' and tool_event['arguments'] == {'id': '42'}
        await emulator.event('response.output_item.done', item=item)
        await adapter.send_result('c1', {'found': True})
        continuation = asyncio.create_task(adapter.respond(response_id='r1'))
        await asyncio.sleep(0)
        assert not continuation.done()
        await emulator.event('response.completed')
        await asyncio.wait_for(continuation, 1)
        await adapter.respond(response_id='r1')
        await eventually(lambda: any(e['type'] == 'response.create' for e in emulator.received))
        assert sum(e['type'] == 'response.create' for e in emulator.received) == 1
        assert len(adapter._invocations) == 1
        results = [e for e in emulator.received if e['type'] == 'response.item.create']
        assert json.loads(results[0]['item']['output']) == {'found': True}



@pytest.mark.asyncio
async def test_live_accepts_pinned_options_separate_prompts_and_safe_function_tools():
    profile=snapshot('gpt-live-1')['conversation']
    profile['prompt']='Speak briefly in Italian.'
    profile['options'].update(backend_model='gpt-6-sol',reasoning_effort='high',verbosity='medium',service_tier='priority',max_output_tokens=4096)
    async with connected(profile) as (adapter,emulator):
        session=emulator.accepted[0]['session'];backend=session['delegation']['responses']
        assert session['model']=='gpt-live-1' and session['store'] is False
        assert session['audio']=={'output':{'voice':'marin'}}
        assert 'Speak briefly' in session['instructions']
        assert backend['instructions']=='Use only approved tools.\n\n'
        assert backend['model']=='gpt-6-sol' and backend['reasoning']=={'effort':'high'}
        assert backend['text']=={'verbosity':'medium'} and backend['service_tier']=='priority'
        assert backend['max_output_tokens']==4096 and backend['parallel_tool_calls'] is False
        assert backend['tool_choice']=='auto' and all(t['type']=='function' for t in backend['tools'])
        await adapter.respond('Greet the caller now.')
        assert emulator.received[-1]['type']=='session.commentary.append'
        await adapter.hangup('live_test')
        assert adapter._closed_event.is_set()


@pytest.mark.asyncio
async def test_live_prepares_greeting_at_accept_and_confirms_media_before_speaking():
    profile=snapshot('gpt-live-1')['conversation']
    profile.update(prompt='Be a helpful receptionist.',language='it',greeting='Buongiorno, come posso aiutarla?',
                   _opening_instructions='Buongiorno, come posso aiutarla? Describe the confirmed extension and department capabilities.')
    async with connected(profile) as (adapter,emulator):
        session=emulator.accepted[0]['session']
        opening=session['input'][0]
        assert opening['role']=='developer' and opening['type']=='message'
        assert opening['content'][0]['type']=='input_text'
        assert profile['greeting'] in opening['content'][0]['text']
        assert profile['_opening_instructions'] in opening['content'][0]['text']
        assert 'it' in session['input'][-1]['content'][0]['text']
        assert not any(e['type']=='session.commentary.append' for e in emulator.received)
        await adapter.respond(profile['_opening_instructions'])
        instruction=emulator.received[-1]
        assert instruction['type']=='session.commentary.append'
        assert instruction['content'].startswith('Caller media is connected.')
        assert 'Do not generate <|SpawnThinking|> for the opening greeting' in session['instructions']


@pytest.mark.asyncio
async def test_live_rejects_unadvertised_wire_tools_and_redacts_command_errors():
    async with connected() as (adapter,emulator):
        await emulator.tool('forged_tool')
        await eventually(lambda:any(e['type']=='response.item.create' for e in emulator.received))
        assert not any(e.get('type')=='tool_call' for e in list(adapter._queue._queue))
        emulator.reject='session.commentary.append'
        with pytest.raises(ProviderError,match='command rejected') as error:
            await adapter.respond('safe instruction')
        assert 'PRIVATE' not in str(error.value) and not adapter._acks


@pytest.mark.asyncio
async def test_live_transcripts_default_off_and_capture_positions_are_bounded():
    async with connected() as (adapter,emulator):
        await adapter._handle({'type':'session.input_transcript.delta','event_id':'turn-1','delta':'PRIVATE TEST TEXT','start_ms':0})
        assert not adapter._observation_queue.qsize()
        await adapter.set_capture(True)
        await adapter._handle({'type':'session.input_transcript.delta','event_id':'turn-2','delta':'synthetic transcript','start_ms':999999})
        event=await anext(adapter.events())
        assert event['role']=='caller' and event['position']==1
        await adapter.set_capture(False)
        assert adapter._observation_queue.empty()


@pytest.mark.asyncio
async def test_live_oversized_content_is_bounded_and_backend_failure_is_safe():
    async with connected({'_capture_transcripts':True}) as (adapter,emulator):
        await adapter._handle({'type':'session.input_transcript.delta','event_id':'x'*129,'delta':'ignore'})
        assert not adapter._observed
        await adapter._handle({'type':'session.input_transcript.delta','event_id':'oversized','delta':'x'*16385})
        assert (await anext(adapter.events()))['type']=='transcript_failed'
        wire=next(iter(adapter._wire_tools))
        await emulator.tool(wire,arguments={'id':'x'*8192})
        await eventually(lambda:any(e['type']=='response.item.create' for e in emulator.received))
        result=next(e['item']['output'] for e in emulator.received if e['type']=='response.item.create')
        assert json.loads(result)=={'error':'invalid_arguments'}
        await emulator.event('response.created',response='failed')
        await emulator.event('response.failed',response='failed',error={'message':'PRIVATE ERROR'})
        await eventually(lambda:any(e.get('type')=='error' for e in list(adapter._queue._queue)))
        assert 'PRIVATE ERROR' not in json.dumps(list(adapter._queue._queue))


@pytest.mark.asyncio
@pytest.mark.parametrize('event_type',['live.transport.incoming','live.call.incoming'])
async def test_primary_live_cannot_be_claimed_by_a_sip_webhook(event_type,caplog):
    runtime,storage,controller,_=fixtures();storage.snapshot.return_value=snapshot('gpt-live-1')
    storage.tools.return_value=copy.deepcopy(DEFINITIONS)
    runtime.converse=AsyncMock()
    call=await admit(runtime)
    data={'call_id':'wrong-realtime-id','session_id':'live_test','type':'sip','sip_headers':[
        {'name':'X-OS-Session-ID','value':call.session_id},
        {'name':'X-OS-Provider-Leg-ID','value':call.leg_id},
        {'name':'X-OS-Agent-ID','value':call.snapshot['agent_id']}]}
    raw,auth=sign(call,data)
    with pytest.raises(ValueError, match='invalid_webhook'):
        await runtime.webhook('openai',raw,auth)
    assert call.session_id not in caplog.text and call.leg_id not in caplog.text
    raw,auth=sign(call,{**data,'type':'webrtc'},event_type=event_type)
    with pytest.raises(ValueError, match='invalid_webhook'):
        await runtime.webhook('openai',raw,auth)
    raw,auth=sign(call,data,event_type=event_type)
    with pytest.raises(ValueError, match='invalid_webhook'):
        await runtime.webhook('openai',raw,auth)
    storage.accept.assert_not_called()
    controller.originate_local.assert_not_awaited()
    await runtime.finish(call,'completed')


@pytest.mark.asyncio
async def test_live_runtime_uses_common_grants_and_confirmed_transfer_over_tcp():
    runtime,storage,controller,_=fixtures()
    storage.binding.return_value['api_key']='key'
    value=snapshot('gpt-live-1')
    for binding in value['tool_bindings']: binding['enabled']=True
    value['tool_bindings'][1]['config'].update(extensions_enabled=True, extension_allowlist=['extension:203'])
    storage.snapshot.return_value=value;storage.tools.return_value=copy.deepcopy(DEFINITIONS)
    emulator=PrimaryLiveEmulator();server=TestServer(emulator.app);await server.start_server()
    from voice_agent.media import AudioBuffer
    media=SimpleNamespace(input=AudioBuffer(),failed=asyncio.Event(),error=None,
        enable_input=Mock(),stop_input=Mock(),write=AsyncMock(),flush=AsyncMock(),close=AsyncMock())
    controller.connect_media_channel.return_value=media
    def factory(binding):
        adapter=create_adapter(binding)
        adapter.http_base=str(server.make_url('/v1/live/sessions')).rstrip('/')
        adapter.ws_base=adapter.http_base.replace('http:','ws:')
        return adapter
    runtime.adapter_factory=factory
    call=await admit(runtime)
    try:
        await eventually(lambda:call.media_connected)
        assert call.provider_call_id=='live_test' and call.binding['adapter']=='live_ws'
        controller.originate_local.assert_not_awaited()
        storage.accept.assert_called_once_with(call,'live_test')
        backend=emulator.accepted[0]['session']['delegation']['responses']
        assert 'extension:203' in backend['instructions']
        wire=next(w for w,name in call.adapter._wire_tools.items() if name==call.tools.manifests['pbx.transfer']['name'])
        await emulator.tool(wire,invocation='denied',response='denied-response',arguments={'destination_id':'extension:204'})
        await eventually(lambda:any(e['type']=='response.item.create' and e['item'].get('call_id')=='denied' for e in emulator.received))
        controller.continue_channel.assert_not_awaited()
        async def acknowledge(channel,target):
            media.flush.assert_awaited()
            await runtime.event({'type':'StasisEnd','channel':{'id':channel}})
            assert not call.transfer_done.is_set()
            await runtime.event({'type':'ChannelUserevent','eventname':'VoiceAgentTransfer','channel':{'id':channel},'userevent':{'token':call.transfer_token,'destination_id':'extension:203'}})
        controller.continue_channel.side_effect=acknowledge
        await emulator.tool(wire,invocation='allowed',response='allowed-response',arguments={'destination_id':'extension:203'})
        await eventually(lambda:any(e['event_type']=='transfer_committed' for e in list(runtime.monitoring.queue._queue)))
        assert call.transfer_outcome=='transferred'
    finally:
        await runtime.finish(call,'completed')
        await asyncio.gather(*list(runtime.tasks),return_exceptions=True)
        await server.close()
