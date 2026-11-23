"""Call-bound termination: published grants, bounded playback, cleanup and races."""
import asyncio
import copy
import json
from unittest.mock import AsyncMock

import pytest

from test_contract import CONTRACT
from test_runtime import fixtures, admit
from voice_agent.tools import ToolRegistry


def snapshot(enabled=True):
    value=json.loads((CONTRACT/'published-v8.example.json').read_text())
    binding=value['tool_bindings'][-1]
    binding['enabled']=enabled
    binding['config']['playback_timeout_seconds']=1
    return value


def event(invocation='hangup-1', **arguments):
    return {'name':'nv_telephony_hangup_v1','invocation_id':invocation,
            'arguments':arguments or {'reason':'caller_request'},'response_id':'response-close'}


async def ready(enabled=True):
    from voice_agent.tools import DEFINITIONS
    runtime,storage,controller,_=fixtures()
    storage.snapshot.return_value=snapshot(enabled)
    storage.tools.return_value=copy.deepcopy(DEFINITIONS)
    call=await admit(runtime)
    call.media_connected=True
    call.adapter=AsyncMock()
    controller.hangup_owned.return_value=True
    return runtime,call,controller


@pytest.mark.asyncio
async def test_disabled_or_forged_hangup_cannot_end_any_channel():
    runtime,call,controller=await ready(False)
    try:
        assert 'nv_telephony_hangup_v1' not in [t['name'] for t in call.tools.advertised()]
        assert await call.tools.invoke('disabled','telephony.hangup',{'reason':'caller_request'})=={'error':'tool_denied'}
        controller.hangup_owned.assert_not_awaited()
    finally: await runtime.finish(call,'completed')


@pytest.mark.asyncio
async def test_hangup_is_bounded_owned_and_never_falls_back():
    runtime,call,controller=await ready()
    started=asyncio.get_running_loop().time()
    await runtime.handle_tool(call,event())
    elapsed=asyncio.get_running_loop().time()-started
    assert .9 <= elapsed < 2
    controller.hangup_owned.assert_awaited_once_with(call.caller_id)
    controller.continue_channel.assert_not_awaited()
    assert call.terminal and not runtime.calls
    endings=[e for e in runtime.monitoring.queue._queue if e.get('outcome')]
    assert endings[-1]['outcome']=='ended_by_agent'
    call.adapter.close.assert_awaited_once()


@pytest.mark.asyncio
async def test_stalled_goodbye_continuation_does_not_block_termination():
    runtime,call,controller=await ready()
    async def stalled(**kwargs): await asyncio.Event().wait()
    call.adapter.respond.side_effect=stalled
    await asyncio.wait_for(runtime.handle_tool(call,event()),2)
    controller.hangup_owned.assert_awaited_once_with(call.caller_id)
    controller.continue_channel.assert_not_awaited()


@pytest.mark.asyncio
async def test_hangup_validates_arguments_and_denies_transfer_races():
    runtime,call,controller=await ready()
    try:
        for args in ({'reason':'caller_request','channel_id':'foreign'},{'reason':'anything'},{}, {'reason':False}):
            result=await call.tools.invoke('invalid-'+str(len(call.tools.invocations)),event()['name'],args)
            assert result=={'error':'invalid_arguments'}
        call.transfer_target={'context':'synthetic'}
        assert (await call.tools.invoke('late',event()['name'],{'reason':'caller_request'})).get('error')=='hangup_unavailable'
        controller.hangup_owned.assert_not_awaited()
    finally: await runtime.finish(call,'completed')


@pytest.mark.asyncio
async def test_duplicate_or_parallel_requests_share_one_end_and_disconnect_has_no_fallback():
    runtime,call,controller=await ready()
    result=await call.tools.invoke('same',event()['name'],{'reason':'conversation_complete'})
    assert result=={'outcome':'ending'}
    assert await call.tools.invoke('same',event()['name'],{'reason':'conversation_complete'})==result
    assert (await call.tools.invoke('different',event()['name'],{'reason':'caller_request'})).get('error')=='hangup_unavailable'
    await runtime.finish(call,'fallback','provider_disconnected',fallback=True)
    controller.continue_channel.assert_not_awaited()
    assert any(e.get('outcome')=='ended_by_agent' for e in runtime.monitoring.queue._queue)


def test_v8_contract_parity_and_old_publications_remain_closed():
    import pathlib
    import subprocess
    from voice_agent.contract import validate_snapshot
    from test_contract import ROOT
    for name in ('published-v8.schema.json','published-v8.example.json','tools-v5.json'):
        assert (CONTRACT/name).read_bytes()==(pathlib.Path(__file__).parents[2]/'voice_agent'/name).read_bytes()
    value=snapshot()
    validate_snapshot(value)
    result=subprocess.run(['php',str(ROOT/'freepbx/tests/agents/validate.php')],input=json.dumps(value),text=True,capture_output=True)
    assert result.returncode==0,result.stderr
    for bad in (0,11,True,1.0,'5'):
        invalid=copy.deepcopy(value);invalid['tool_bindings'][-1]['config']['playback_timeout_seconds']=bad
        with pytest.raises(ValueError):validate_snapshot(invalid)
    value['contract_version']=7
    with pytest.raises(ValueError):validate_snapshot(value)


@pytest.mark.asyncio
async def test_failed_or_lost_ari_ownership_is_not_reported_as_success_or_fallback():
    for failure in (False,RuntimeError('synthetic ARI failure')):
        runtime,call,controller=await ready()
        if isinstance(failure,Exception):controller.hangup_owned.side_effect=failure
        else:controller.hangup_owned.return_value=False
        await runtime.handle_tool(call,event())
        controller.continue_channel.assert_not_awaited()
        endings=[e for e in runtime.monitoring.queue._queue if e.get('outcome')]
        assert endings[-1]['outcome']=='failed' and endings[-1]['error_code']=='hangup_failed'


@pytest.mark.asyncio
async def test_caller_leaving_during_grace_prevents_a_late_delete_or_fallback():
    runtime,call,controller=await ready()
    await call.tools.invoke('ending',event()['name'],{'reason':'caller_request'})
    await runtime.event({'type':'StasisEnd','channel':{'id':call.caller_id}})
    await asyncio.gather(*list(runtime.tasks),return_exceptions=True)
    controller.hangup_owned.assert_not_awaited()
    controller.continue_channel.assert_not_awaited()
    assert call.terminal


@pytest.mark.asyncio
async def test_ari_hangup_checks_application_and_never_deletes_foreign_channel():
    from voice_agent.ari import AriController
    controller=object.__new__(AriController)
    controller.app='satellite-agent'
    controller.request=AsyncMock(return_value={'channel_ids':['owned']})
    assert not await controller.hangup_owned('foreign')
    assert controller.request.await_count==1
    assert await controller.hangup_owned('owned')
    assert controller.request.await_args.args==('DELETE','/channels/owned')


@pytest.mark.asyncio
async def test_live_primary_hangup_keeps_media_until_grace_and_collects_final_usage():
    from types import SimpleNamespace
    from unittest.mock import Mock
    from aiohttp.test_utils import TestServer
    from test_agent_models import snapshot as conversation_snapshot
    from test_live import PrimaryLiveEmulator
    from test_provider_emulators import eventually
    from voice_agent.media import AudioBuffer
    from voice_agent.providers import create_adapter
    from voice_agent.tools import DEFINITIONS
    runtime,storage,controller,_=fixtures()
    value=snapshot();value['conversation']=conversation_snapshot('gpt-live-1')['conversation']
    storage.snapshot.return_value=value;storage.tools.return_value=copy.deepcopy(DEFINITIONS)
    media=SimpleNamespace(input=AudioBuffer(),failed=asyncio.Event(),error=None,
        enable_input=Mock(),stop_input=Mock(),write=AsyncMock(),flush=AsyncMock(),close=AsyncMock())
    controller.connect_media_channel.return_value=media
    controller.hangup_owned.return_value=True
    emulator=PrimaryLiveEmulator();server=TestServer(emulator.app);await server.start_server()
    def factory(binding):
        adapter=create_adapter(binding)
        adapter.ws_base=str(server.make_url('/v1/live/sessions')).replace('http:','ws:')
        return adapter
    runtime.adapter_factory=factory
    call=await admit(runtime)
    try:
        await eventually(lambda:call.media_connected)
        wire=next(w for w,name in call.adapter._wire_tools.items() if name=='nv_telephony_hangup_v1')
        await emulator.tool(wire,arguments={'reason':'conversation_complete'})
        await eventually(lambda:call.ending_by_agent)
        media.flush.assert_not_awaited()
        controller.hangup_owned.assert_not_awaited()
        async with asyncio.timeout(3):
            while not call.terminal: await asyncio.sleep(.01)
        await asyncio.gather(*list(runtime.tasks),return_exceptions=True)
        assert call.adapter.usage_snapshot['final']
        media.flush.assert_awaited_once()
        controller.hangup_owned.assert_awaited_once_with(call.caller_id)
        controller.continue_channel.assert_not_awaited()
        assert any(e.get('outcome')=='ended_by_agent' for e in runtime.monitoring.queue._queue)
    finally:
        await runtime.finish(call,'completed')
        await asyncio.gather(*list(runtime.tasks),return_exceptions=True)
        await server.close()
