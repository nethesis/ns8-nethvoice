"""Exercise step switching and audio-drain gating over a real local WebSocket."""
import asyncio
import pytest
from aiohttp.test_utils import TestServer
from agent.providers.realtime import OpenAIAdapter
from tests.test_agent_openai_emulator import OpenAIEmulator, eventually


@pytest.mark.asyncio
async def test_workflow_updates_tools_and_waits_for_finished_audio():
    emulator=OpenAIEmulator();server=TestServer(emulator.app);await server.start_server()
    adapter=OpenAIAdapter({'api_key':'key'})
    adapter.http_base=str(server.make_url('/v1/realtime')).rstrip('/')
    adapter.ws_base=str(server.make_url('/v1/realtime')).replace('http:','ws:')
    try:
        await adapter.accept('provider-1',{'_workflow_mode':True,'language':'it','voice':'marin'},[])
        await adapter.connect('provider-1')
        await eventually(lambda:adapter._ready.is_set())
        await adapter.workflow_update('Collect only the resident name',[{'type':'function','name':'finish_current_step','parameters':{'type':'object'}}])
        update=next(event for event in reversed(emulator.received) if event['type']=='session.update')
        assert update['session']['tools'][0]['name']=='finish_current_step'
        assert update['session']['audio']['input']['turn_detection']['create_response']
        speaking=asyncio.create_task(adapter.workflow_respond('Approved amount',wait=True))
        await eventually(lambda:any(event['type']=='response.create' for event in emulator.received))
        await emulator.ws.send_json({'type':'response.created','response':{'id':'workflow-response'}})
        await emulator.ws.send_json({'type':'output_audio_buffer.started'})
        await emulator.ws.send_json({'type':'response.done','response':{'id':'workflow-response','status':'completed','output':[]}})
        await eventually(lambda:adapter._response_done)
        assert not speaking.done()
        await emulator.ws.send_json({'type':'output_audio_buffer.stopped'})
        await asyncio.wait_for(speaking,1)
        await adapter.workflow_update('Private summary only',[],auto_response=False)
        update=next(event for event in reversed(emulator.received) if event['type']=='session.update')
        assert not update['session']['tools']
        assert not update['session']['audio']['input']['turn_detection']['create_response']
    finally:
        await adapter.close();await server.close()
