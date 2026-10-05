"""Workflow ownership: private consultation decisions and provider-leg replacement."""
import asyncio
import time
from types import SimpleNamespace
from unittest.mock import AsyncMock
import pytest
from agent.runtime import AgentRuntime, Call, CallState
from agent.workflows.voice import VoiceWorkflows
from agent.workflows.templates import templates


def call_fixture():
    permissions = {key:'allow' for key in ('directory.extensions','telephony.transfer.extension','telephony.consultative_transfer')}
    profile={'permissions':permissions,'tools':{},'flow':'Workflow','trunk_id':'1','max_call_duration_seconds':600}
    return Call('parent','run-parent','leg-parent','provider-local','original-caller','42','router',profile,
        {'provider':'openai'},[{'id':'extension:201','type':'extension','internal_allowed':True,'external_allowed':True}],
        {},1,'a'*64,'Workflow','external',permissions,profile,time.monotonic()+60,
        state=CallState.CONVERSING,bridge_id='caller-bridge',adapter=AsyncMock(),provider_call_id='provider-call',
        caller_variables={'AGENT_ORIGINAL_CALLER':'+393331234567','AGENT_CALL_ORIGIN':'external'})


async def until(predicate):
    for _ in range(200):
        if predicate(): return
        await asyncio.sleep(.001)
    raise AssertionError('Expected state did not arrive')


def consultation_runtime():
    runtime=SimpleNamespace(controller=AsyncMock(),events=SimpleNamespace(emit=lambda *a,**kw:None),
        _context=lambda call:{'agent_id':call.profile_key,'origin':call.origin,'permissions':call.permissions,'external_profile':call.external_profile},
        _cleanup=AsyncMock(),_finish=AsyncMock(),_spawn=lambda coro:asyncio.create_task(coro))
    runtime.controller.connected=True
    return runtime


@pytest.mark.asyncio
@pytest.mark.parametrize('decision', ['accepted','declined','busy','no_answer','unavailable'])
async def test_consultation_requires_operator_decision_and_resumes_failures(decision):
    call=call_fixture(); runtime=consultation_runtime(); voice=VoiceWorkflows(runtime)
    task=asyncio.create_task(voice.consult(call,'extension:201','Ticket 123 needs assistance',{'ring_seconds':5,'consult_seconds':5}))
    await until(lambda:bool(voice.consultations)); attempt=next(iter(voice.consultations.values()))
    assert len(attempt.channel_id)<=28
    if decision in ('busy','no_answer'):
        await voice.event({'type':'ChannelDestroyed','channel':{'id':attempt.channel_id},'cause':17 if decision=='busy' else 19})
    else:
        await voice.event({'type':'StasisStart','channel':{'id':attempt.channel_id},'args':['consult',call.session_id,attempt.attempt_id]})
        await until(lambda:attempt.accepting)
        assert call.private_consultation
        runtime.controller.mute.assert_awaited_once_with(call.local_id,True,'out')
        assert not runtime.controller.continue_channel.await_count
        if decision=='unavailable':
            await voice.event({'type':'ChannelDestroyed','channel':{'id':attempt.channel_id}})
        else:
            await voice.event({'type':'ChannelDtmfReceived','channel':{'id':attempt.channel_id},'digit':'1' if decision=='accepted' else '2'})
    result=await task
    assert result['status']==decision
    assert not voice.consultations and not call.private_consultation
    if decision=='accepted':
        assert call.handed_off and call.terminal
        continued=runtime.controller.continue_channel.await_args_list
        assert [item.args[0] for item in continued]==[attempt.channel_id,call.caller_id]
        assert continued[0].args[1]['context']=='satellite-agent-consult-wait'
        assert continued[1].args[1]['context']=='satellite-agent-consult-connect'
        runtime.controller.hangup.assert_not_awaited()
        runtime._cleanup.assert_awaited_once()
    else:
        assert call.state==CallState.CONVERSING and not call.terminal
        runtime.controller.continue_channel.assert_not_awaited()
        runtime.controller.hangup.assert_awaited_once_with(attempt.channel_id)
        assert runtime.controller.moh.await_args_list[-1].args==(call.caller_id,False)
        if decision=='unavailable' or decision=='declined':
            assert runtime.controller.mute.await_args_list[-1].args==(call.local_id,False,'out')


@pytest.mark.asyncio
async def test_early_operator_digit_and_cancelled_caller_do_not_commit():
    call=call_fixture(); runtime=consultation_runtime(); gate=asyncio.Event()
    call.adapter.workflow_respond.side_effect=lambda *a,**kw:gate.wait()
    # AsyncMock must await the gate rather than returning its coroutine.
    async def readback(*args,**kwargs): await gate.wait()
    call.adapter.workflow_respond.side_effect=readback
    voice=VoiceWorkflows(runtime)
    task=asyncio.create_task(voice.consult(call,'extension:201','Summary',{'ring_seconds':5,'consult_seconds':5}))
    await until(lambda:bool(voice.consultations)); attempt=next(iter(voice.consultations.values()))
    await voice.event({'type':'StasisStart','channel':{'id':attempt.channel_id},'args':['consult',call.session_id,attempt.attempt_id]})
    await until(lambda:call.private_consultation)
    await voice.event({'type':'ChannelDtmfReceived','channel':{'id':attempt.channel_id},'digit':'1'})
    assert not attempt.decision.done()
    call.terminal=True;call.cancellation.set();task.cancel()
    with pytest.raises(asyncio.CancelledError): await task
    runtime.controller.continue_channel.assert_not_awaited()
    runtime.controller.hangup.assert_awaited_once_with(attempt.channel_id)
    assert not call.handed_off and not voice.consultations


@pytest.mark.asyncio
@pytest.mark.parametrize('fail', [False, True])
async def test_agent_switch_replaces_only_provider_and_preserves_external_origin(fail):
    call=call_fixture();call.workflow_context_data={'step_count':5,'global_max_steps':200}; graph=templates()[1];graph['provider_binding_ref']='2'
    snapshot={'destinations':[{'id':43,'agent_type':'workflow','workflow_agent_id':'payment-secretary','workflow_version':1}],
        'profiles':{'external':call.external_profile},'bindings':[{'id':'2','provider':'openai','runtime_owner':'builtin','trunk_name':'AgentTrunk_2','provider_user':'secretary','provider_host':'sip.test'}]}
    runtime=AgentRuntime(store=SimpleNamespace(snapshot=snapshot,revision=2,payload_hash='b'*64),controller=AsyncMock())
    runtime.controller.connected=True
    runtime.workflows.db=AsyncMock(return_value={'version':1,'definition':graph})
    runtime.application.voice_bindings=AsyncMock(return_value=[])
    runtime.calls[call.session_id]=call;runtime.by_caller[call.caller_id]=call.session_id;runtime.by_local[call.local_id]=call.session_id
    if fail: runtime.controller.originate_local.side_effect=RuntimeError('fixture originate failed')
    try:
        if fail:
            with pytest.raises(RuntimeError): await runtime.workflow_route_agent(call,'payment-secretary',{},[])
            assert not runtime.calls and not runtime.by_caller
            target=runtime.controller.continue_channel.await_args.args[1]
            assert target=={'context':'satellite-agent-destination-43','exten':'s','label':'fallback'}
        else:
            result=await runtime.workflow_route_agent(call,'payment-secretary',{},[])
            assert result['status']=='handed_off'
            child=next(iter(runtime.calls.values()))
            assert child.caller_id==call.caller_id and child.origin=='external' and child.parent_run_id==call.run_id
            assert child.binding['id']=='2' and child.deadline<=call.deadline
            assert child.workflow_context_data['step_count']==5 and child.workflow_context_data['global_max_steps']==200
            assert runtime.by_caller[call.caller_id]==child.session_id
            variables=runtime.controller.originate_local.await_args.args[2]
            assert variables['__AGENT_ORIGINAL_CALLER']=='+393331234567'
            runtime.controller.continue_channel.assert_not_awaited()
        assert all(item.args[0]!=call.caller_id for item in runtime.controller.hangup.await_args_list)
        call.adapter.close.assert_awaited_once()
        assert call.terminal and call.handed_off
    finally:
        for task in list(runtime._tasks): task.cancel()
        await asyncio.gather(*runtime._tasks,return_exceptions=True)


@pytest.mark.asyncio
async def test_late_consultation_answer_is_released_without_call_admission():
    runtime=AgentRuntime(controller=AsyncMock())
    await runtime._handle_ari_event({'type':'StasisStart','channel':{'id':'expired-consult'},'args':['consult','expired','attempt']})
    runtime.controller.hangup.assert_awaited_once_with('expired-consult')
    assert not runtime.calls


@pytest.mark.asyncio
@pytest.mark.parametrize('valid', [False, True])
async def test_final_conversation_turn_accepts_completion_but_cannot_retry_invalid_data(valid):
    from agent.application.contracts import ApplicationError
    runtime=AgentRuntime(controller=AsyncMock());call=call_fixture();call.workflow=templates()[0]
    future=asyncio.get_running_loop().create_future()
    call.workflow_step={'name':'finish','future':future,'schema':{'type':'object','properties':{'message':{'type':'string'}},'required':['message'],'additionalProperties':False},
        'tools':set(),'turns':5,'max_turns':5,'responses':{'r1','r2','r3','r4','r5'},'context':{},'prior_response_id':'r0','invocations':0}
    await runtime._tool_call(call,{'invocation_id':'last','name':'finish','response_id':'r5','arguments':{'message':'Done'} if valid else {}})
    if valid:
        assert await future=={'message':'Done'}
    else:
        with pytest.raises(ApplicationError,match='conversation_turn_budget'): await future
    call.adapter.respond.assert_not_awaited()
