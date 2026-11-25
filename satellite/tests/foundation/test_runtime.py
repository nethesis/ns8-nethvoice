import asyncio
import base64
import copy
import hashlib
import hmac
import json
import time
import threading
from unittest.mock import AsyncMock, MagicMock

import pytest
from test_contract import CONTRACT
from voice_agent.runtime import Runtime, Transfer
from voice_agent.runner import create_app
from voice_agent.tools import DEFINITIONS
from fastapi.testclient import TestClient


def fixtures():
    snapshot = json.loads((CONTRACT / 'published-v8.example.json').read_text())
    snapshot['tool_bindings'][1]['config'].update(extensions_enabled=True, extension_allowlist=['extension:203'])
    storage = MagicMock()
    storage.snapshot.return_value = snapshot
    storage.binding.return_value = {'binding_id':'provider_test','provider':'openai','openai_project_id':'proj_test','trunk_name':'VoiceAgentTrunk_1','api_key':'synthetic-api','webhook_secret':'whsec_' + base64.b64encode(b'synthetic-signing-secret').decode()}
    storage.targets.return_value = [{'id':'extension:203','name':'Test extension'}]
    storage.routing_targets.return_value = copy.deepcopy(storage.targets.return_value)
    storage.tools.return_value = copy.deepcopy(DEFINITIONS)
    controller = AsyncMock()
    controller.connected = True
    controller.get_variable.return_value = 'synthetic-linkedid'
    runtime = Runtime(storage, controller, MagicMock())
    runtime.sip_lab_enabled = True  # Exercise the private SIP lab path in this fixture.
    return runtime, storage, controller, snapshot


async def admit(runtime):
    await runtime.admit({'id':'synthetic-caller','dialplan':{'context':'voice-agent-basic_voice'}},'basic_voice')
    return next(iter(runtime.calls.values()))


def sign(call, data, *, age=0, event_type="realtime.call.incoming"):
    body = json.dumps({'id':'synthetic-event','type':event_type,'data':data}).encode()
    stamp = str(int(time.time()) - age)
    signature = base64.b64encode(hmac.new(b'synthetic-signing-secret', b'wh_test.' + stamp.encode() + b'.' + body, hashlib.sha256).digest()).decode()
    return body, {'webhook-id':'wh_test','webhook-timestamp':stamp,'webhook-signature':'v1,'+signature}


@pytest.mark.asyncio
async def test_admission_pins_configuration_and_persists_before_origination():
    runtime, storage, controller, snapshot = fixtures()
    call = await admit(runtime)
    storage.admit.assert_called_once_with(call)
    controller.originate_local.assert_awaited_once()
    snapshot['tool_bindings'][1]['enabled'] = False
    assert call.snapshot['tool_bindings'][1]['enabled']
    await runtime.finish(call,'fallback','test_finished',fallback=True)
    assert controller.continue_channel.await_args.args[1]['context'].startswith('voice-agent-fallback-')
    assert not runtime.calls


@pytest.mark.asyncio
async def test_agent_model_is_pinned_before_provider_origination():
    runtime, storage, controller, snapshot = fixtures()
    storage.binding.return_value['model'] = 'ignored-trunk-setting'
    call = await admit(runtime)
    snapshot['conversation']['model'] = 'gpt-realtime-2'
    assert call.binding['model'] == 'gpt-realtime-2.1'
    assert call.snapshot['conversation']['model'] == 'gpt-realtime-2.1'
    await runtime.finish(call, 'completed')


@pytest.mark.asyncio
@pytest.mark.parametrize('model', ['grok-voice-3.0',False,''])
async def test_invalid_agent_model_fails_before_paid_session(model):
    runtime, storage, controller, snapshot = fixtures()
    snapshot['conversation']['model'] = model
    await runtime.admit({'id':'synthetic-caller','dialplan':{'context':'voice-agent-basic_voice'}},'basic_voice')
    controller.originate_local.assert_not_awaited()
    storage.admit.assert_not_called()
    assert not runtime.calls


@pytest.mark.asyncio
async def test_signed_webhook_requires_live_pinned_pending_call_and_deduplicates():
    runtime, storage, controller, snapshot = fixtures()
    call = await admit(runtime)
    runtime.converse = AsyncMock()
    data = {'call_id':'synthetic/provider:call','sip_headers':[
        {'name':'X-OS-Session-ID','value':call.session_id},
        {'name':'X-OS-Provider-Leg-ID','value':call.leg_id},
        {'name':'X-OS-Agent-ID','value':'basic_voice'},
        {'name':'Via','value':'synthetic-hop-1'},{'name':'Via','value':'synthetic-hop-2'}]}
    body, headers = sign(call, data)
    assert await runtime.webhook('openai',body,headers) == {'status':'accepted'}
    assert await runtime.webhook('openai',body,headers) == {'status':'duplicate'}
    await asyncio.sleep(0)
    runtime.converse.assert_awaited_once_with(call)
    storage.accept.assert_called_once_with(call,'synthetic/provider:call')
    with pytest.raises(ValueError):
        await runtime.webhook('grok',body,headers)
    with pytest.raises(ValueError):
        await runtime.webhook('openai',body+b' ',headers)
    stale, stale_headers = sign(call,data,age=301)
    with pytest.raises(ValueError):
        await runtime.webhook('openai',stale,stale_headers)
    assert runtime.invalid_webhook_signatures == 3
    assert not any(e['error_code'] == 'invalid_signature' for e in runtime.monitoring.pending.values())
    signed_notice, auth = sign(call, {}, event_type='response.completed')
    assert await runtime.webhook('openai', signed_notice, auth) == {'status': 'ignored'}
    assert runtime.invalid_webhook_signatures == 3
    storage.verify_signing_secret.assert_not_called()  # Signed claim alone is insufficient.
    unrelated = copy.deepcopy(data)
    unrelated['sip_headers'][0]['value'] = 'unrelated-session'
    raw, auth = sign(call,unrelated)
    assert await runtime.webhook('openai',raw,auth) == {'status':'ignored'}
    await runtime.finish(call,'completed')


@pytest.mark.asyncio
async def test_correlated_webhook_returns_retryable_http_error_and_starts_once():
    from httpx import ASGITransport, AsyncClient
    from voice_agent.storage import ClaimRejected
    runtime, storage, controller, snapshot = fixtures()
    call = await admit(runtime)
    runtime.converse = AsyncMock()
    data = {'call_id': 'provider-call', 'sip_headers': [
        {'name': 'X-OS-Session-ID', 'value': call.session_id},
        {'name': 'X-OS-Provider-Leg-ID', 'value': call.leg_id},
        {'name': 'X-OS-Agent-ID', 'value': call.snapshot['agent_id']}]}
    raw, headers = sign(call, data)
    storage.accept.side_effect = [ClaimRejected(), TimeoutError(), None]
    app = create_app('token', runtime)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url='http://local') as client:
            async def deliver():
                return await client.post('/satellite-webhooks/openai', content=raw, headers=headers)
            assert (await deliver()).json() == {'status': 'ignored'}
            assert (await deliver()).status_code == 503
            assert call.provider_call_id is None
            assert (await deliver()).json() == {'status': 'accepted'}
            assert (await deliver()).json() == {'status': 'duplicate'}
        await asyncio.sleep(0)
        runtime.converse.assert_awaited_once_with(call)
    finally:
        await runtime.finish(call, 'completed')


@pytest.mark.asyncio
async def test_transfer_waits_for_confirmed_ari_release():
    runtime, storage, controller, snapshot = fixtures()
    call = await admit(runtime)
    transfer = asyncio.create_task(Transfer(runtime,call).transfer('extension:203'))
    await transfer_started(controller)
    assert not transfer.done()
    # Asterisk may report the old Stasis location. Release alone is not success.
    await runtime.event({'type':'StasisEnd','channel':{'id':call.caller_id,'dialplan':{'context':'voice-agent-basic_voice','exten':'s'}}})
    await asyncio.sleep(.01)
    assert not transfer.done()
    for token, destination in [('forged', 'extension:203'), (call.transfer_token, 'extension:204')]:
        await runtime.event({'type':'ChannelUserevent','eventname':'VoiceAgentTransfer','channel':{'id':call.caller_id},'userevent':{'token':token,'destination_id':destination}})
        assert not call.transfer_done.is_set()
    await runtime.event({'type':'ChannelUserevent','eventname':'VoiceAgentTransfer','channel':{'id':call.caller_id},'userevent':{'token':call.transfer_token,'destination_id':'extension:203'}})
    assert await transfer == {'outcome':'transferred'}
    events = list(runtime.monitoring.queue._queue)
    assert any(e['event_type']=='transfer_committed' for e in events)


@pytest.mark.asyncio
async def test_hangup_racing_transfer_is_not_success():
    runtime, storage, controller, snapshot = fixtures()
    call = await admit(runtime)
    transfer = asyncio.create_task(Transfer(runtime,call).transfer('extension:203'))
    await transfer_started(controller)
    await runtime.event({'type':'ChannelDestroyed','channel':{'id':call.caller_id}})
    assert await transfer == {'error':'transfer_failed'}
    assert not any(e['event_type']=='transfer_committed' for e in runtime.monitoring.queue._queue)


@pytest.mark.asyncio
async def test_native_ack_alone_does_not_commit_until_release():
    runtime, storage, controller, snapshot = fixtures()
    call = await admit(runtime)
    call.bridge_id = 'owned-media-bridge'
    transfer = asyncio.create_task(Transfer(runtime,call).transfer('extension:203'))
    await transfer_started(controller)
    controller.remove_from_bridge.assert_awaited_once_with('owned-media-bridge',[call.caller_id])
    await runtime.event({'type':'ChannelUserevent','eventname':'VoiceAgentTransfer','channel':{'id':call.caller_id},'userevent':{'token':call.transfer_token,'destination_id':'extension:203'}})
    assert not call.transfer_done.is_set()
    await runtime.event({'type':'StasisEnd','channel':{'id':call.caller_id}})
    assert await transfer == {'outcome':'transferred'}
    controller.unsubscribe_channel.assert_awaited_once_with(call.caller_id)


@pytest.mark.asyncio
async def test_unconfirmed_released_channel_is_left_with_native_dialplan():
    runtime, storage, controller, snapshot = fixtures()
    call = await admit(runtime)
    call.transfer_target = {'context':'voice-agent-transfer','extension':'203','priority':1}
    call.transfer_released = True
    await runtime.finish(call,'failed','transfer_unconfirmed',fallback=True)
    controller.hangup.assert_awaited_once_with(call.leg_id)
    controller.continue_channel.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize('released', [False, True], ids=['before-release', 'after-release'])
async def test_native_transfer_owns_caller_during_provider_failure_and_deadline(released):
    runtime, _, controller, _ = fixtures()
    call = await admit(runtime)
    transfer = asyncio.create_task(Transfer(runtime, call).transfer('extension:203'))
    await transfer_started(controller)
    if released:
        await runtime.event({'type': 'StasisEnd', 'channel': {'id': call.caller_id}})
    await runtime.event({'type': 'ChannelDestroyed', 'channel': {'id': call.leg_id}})
    await runtime.finish(call, 'fallback', 'duration_exceeded', fallback=True)
    await asyncio.sleep(0)
    assert not call.terminal
    controller.hangup.assert_not_awaited()
    if not released:
        await runtime.event({'type': 'StasisEnd', 'channel': {'id': call.caller_id}})
    await runtime.event({'type': 'ChannelUserevent', 'eventname': 'VoiceAgentTransfer',
                         'channel': {'id': call.caller_id}, 'userevent': {
                             'token': call.transfer_token, 'destination_id': 'extension:203'}})
    assert await transfer == {'outcome': 'transferred'}
    controller.hangup.assert_awaited_once_with(call.leg_id)
    assert controller.continue_channel.await_count == 1


@pytest.mark.asyncio
async def test_lost_native_continue_response_never_hangs_up_the_caller():
    runtime, _, controller, _ = fixtures()
    call = await admit(runtime)
    # None of the REST replies or socket events can establish caller ownership.
    controller.continue_channel.side_effect = TimeoutError
    assert await Transfer(runtime, call).transfer('extension:203') == {'error': 'transfer_uncertain'}
    controller.hangup.assert_awaited_once_with(call.leg_id)
    assert not runtime.calls


@pytest.mark.asyncio
async def test_native_confirmation_can_follow_a_lost_continue_response():
    runtime, _, controller, _ = fixtures()
    call = await admit(runtime)
    controller.continue_channel.side_effect = TimeoutError
    transfer = asyncio.create_task(Transfer(runtime, call).transfer('extension:203'))
    await transfer_started(controller)
    assert not call.terminal
    await runtime.event({'type': 'StasisEnd', 'channel': {'id': call.caller_id}})
    await runtime.event({'type': 'ChannelUserevent', 'eventname': 'VoiceAgentTransfer',
                         'channel': {'id': call.caller_id}, 'userevent': {
                             'token': call.transfer_token, 'destination_id': 'extension:203'}})
    assert await transfer == {'outcome': 'transferred'}
    controller.hangup.assert_awaited_once_with(call.leg_id)
    controller.continue_channel.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize('stopping', [False, True], ids=['disconnect', 'shutdown'])
async def test_lifecycle_waits_for_native_transfer_while_continue_is_in_flight(stopping):
    runtime, _, controller, _ = fixtures()
    runtime.monitoring.stop = AsyncMock()
    call = await admit(runtime)
    entered, release = asyncio.Event(), asyncio.Event()

    async def pending_continue(*args):
        entered.set()
        await release.wait()

    controller.continue_channel.side_effect = pending_continue
    transfer = asyncio.create_task(Transfer(runtime, call).transfer('extension:203'))
    try:
        await asyncio.wait_for(entered.wait(), 2)
        teardown = asyncio.create_task(runtime.stop() if stopping else runtime.disconnected())
        await asyncio.sleep(0)
        await asyncio.sleep(0)
        assert not call.terminal
        await runtime.event({'type': 'StasisEnd', 'channel': {'id': call.caller_id}})
        await runtime.event({'type': 'ChannelUserevent', 'eventname': 'VoiceAgentTransfer',
                             'channel': {'id': call.caller_id}, 'userevent': {
                                 'token': call.transfer_token, 'destination_id': 'extension:203'}})
        assert not teardown.done()
        release.set()
        await asyncio.wait_for(teardown, 2)
        controller.hangup.assert_awaited_once_with(call.leg_id)
        assert controller.continue_channel.await_count == 1
        assert any(e['event_type'] == 'completed' and e['outcome'] == 'transferred'
                   for e in runtime.monitoring.queue._queue)
    finally:
        release.set()
        await transfer


@pytest.mark.asyncio
async def test_event_socket_drop_falls_back_then_accepts_calls_after_reconnect():
    from aiohttp import web
    from aiohttp.test_utils import TestServer
    from voice_agent.ari import AriController

    runtime, _, _, _ = fixtures()
    call = await admit(runtime)
    call.bridge_id = 'sip-bridge'
    requests = []
    cleaned = asyncio.Event()
    new_call = asyncio.Event()
    connections = 0

    async def drop_events(request):
        nonlocal connections
        connections += 1
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        if connections == 1:
            await ws.close()
        else:
            await ws.send_json({'type': 'StasisStart', 'args': ['caller', 'basic_voice'], 'channel': {
                'id': 'after-reconnect', 'dialplan': {'context': 'voice-agent-basic_voice'}}})
            async for _ in ws:
                pass
        return ws

    async def rest(request):
        requests.append((request.method, request.path))
        if request.path == '/ari/channels' and request.method == 'POST':
            new_call.set()
        if request.method == 'GET':
            return web.json_response([])
        return web.Response(status=204)

    app = web.Application()
    app.router.add_get('/ari/events', drop_events)
    app.router.add_route('*', '/ari/{path:.*}', rest)
    async with TestServer(app) as server:
        controller = AriController(str(server.make_url('/')), 'user', 'test', on_event=runtime.event)
        runtime.controller = controller

        async def disconnected():
            assert not controller.connected
            await runtime.disconnected()
            cleaned.set()

        controller.on_disconnect = disconnected
        await controller.start()
        try:
            await asyncio.wait_for(cleaned.wait(), 2)
            await asyncio.wait_for(new_call.wait(), 4)
            next_call, = runtime.calls.values()
            assert next_call.caller_id == 'after-reconnect' and next_call.admitted
            await runtime.finish(next_call, 'completed')
        finally:
            await controller.stop()
    assert ('POST', f'/ari/channels/{call.caller_id}/continue') in requests
    assert ('DELETE', f'/ari/channels/{call.leg_id}') in requests
    assert ('DELETE', '/ari/bridges/sip-bridge') in requests


@pytest.mark.asyncio
async def test_ari_connection_handles_call_when_ownership_recovery_database_is_down():
    from aiohttp import web
    from aiohttp.test_utils import TestServer
    from voice_agent.ari import AriController

    runtime, storage, _, _ = fixtures()
    storage.media_ownership.side_effect = ConnectionError('database unavailable')
    storage.snapshot.side_effect = ConnectionError('database unavailable')
    continued = asyncio.Event()
    connections = []

    async def events(request):
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        connections.append(ws)
        await ws.send_json({'type': 'StasisStart', 'args': ['caller', 'basic_voice'], 'channel': {
            'id': 'caller', 'dialplan': {'context': 'voice-agent-basic_voice'}}})
        async for _ in ws:
            pass
        return ws

    async def fallback(request):
        continued.set()
        return web.Response(status=204)

    async def set_variable(request):
        return web.Response(status=204)

    app = web.Application()
    app.router.add_get('/ari/events', events)
    app.router.add_post('/ari/channels/caller/continue', fallback)
    app.router.add_post('/ari/channels/caller/variable', set_variable)
    async with TestServer(app) as server:
        controller = AriController(str(server.make_url('/')), 'user', 'test', on_event=runtime.event)
        runtime.controller = controller
        await controller.start()
        try:
            await asyncio.wait_for(continued.wait(), 2)
            assert controller.connected and len(connections) == 1
            storage.snapshot.assert_called_once_with('basic_voice')
            await asyncio.gather(*runtime.admissions.values())
        finally:
            await controller.stop()


@pytest.mark.asyncio
async def test_ari_receives_queued_transfer_events_before_disconnect_cleanup():
    from aiohttp import web
    from aiohttp.test_utils import TestServer
    from voice_agent.ari import AriController

    disconnected = asyncio.Event()
    release = asyncio.Event()
    received = []

    async def events(request):
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        for kind in ('StasisEnd', 'ChannelUserevent'):
            await ws.send_json({'type': kind})
        await ws.close()
        return ws

    async def on_event(event):
        if event['type'] != 'AgentAriConnected':
            await release.wait()
            received.append(event['type'])

    async def on_disconnect():
        received.append('disconnect')
        disconnected.set()

    app = web.Application()
    app.router.add_get('/ari/events', events)
    async with TestServer(app) as server:
        controller = AriController(str(server.make_url('/')), 'user', 'test', on_event=on_event,
                                   on_disconnect=on_disconnect)
        await controller.start()
        try:
            async with asyncio.timeout(2):
                while controller._generation == 0 or controller.connected:
                    await asyncio.sleep(.01)
            release.set()
            await asyncio.wait_for(disconnected.wait(), 2)
            assert received == ['StasisEnd', 'ChannelUserevent', 'disconnect']
        finally:
            await controller.stop()


@pytest.mark.asyncio
async def test_reconnect_removes_only_empty_sip_bridges_with_persisted_owners():
    runtime, storage, controller, _ = fixtures()
    call = await admit(runtime)
    call.bridge_id = 'sip-' + call.session_id
    controller.destroy_bridge.side_effect = ConnectionError()
    await runtime.disconnected()
    assert not runtime.calls
    controller.destroy_bridge.reset_mock(side_effect=True)
    storage.media_ownership.return_value = {}
    storage.consultation_ownership.return_value = {call.session_id, 'occupied'}
    controller.list_channels.return_value = []
    controller.list_bridges.return_value = [
        {'id': call.bridge_id, 'channels': []},
        {'id': 'sip-occupied', 'channels': ['channel']},
        {'id': 'sip-foreign', 'channels': []}]
    await runtime.event({'type': 'AgentAriConnected'})
    controller.destroy_bridge.assert_awaited_once_with(call.bridge_id)


@pytest.mark.asyncio
@pytest.mark.parametrize('stopping', [True, False], ids=['shutdown', 'event_stream_drop'])
async def test_lifecycle_waits_for_pre_registration_admission(stopping):
    runtime, storage, controller, _ = fixtures()
    runtime.monitoring.stop = AsyncMock()
    entered = asyncio.Event()
    release = threading.Event()
    loop = asyncio.get_running_loop()

    def delayed_commit(call):
        loop.call_soon_threadsafe(entered.set)
        assert release.wait(3)

    storage.admit.side_effect = delayed_commit
    await runtime.event({'type': 'StasisStart', 'args': ['caller', 'basic_voice'], 'channel': {
        'id': 'caller', 'dialplan': {'context': 'voice-agent-basic_voice'}}})
    await asyncio.wait_for(entered.wait(), 2)
    if not stopping:
        controller.connected = False
    teardown = asyncio.create_task(runtime.stop() if stopping else runtime.disconnected())
    try:
        await asyncio.sleep(0)
        assert not teardown.done()
        assert not runtime.calls
    finally:
        release.set()
        await asyncio.wait_for(teardown, 2)
    assert not runtime.calls and not runtime.admissions
    controller.originate_local.assert_not_awaited()
    controller.continue_channel.assert_awaited_once()
    assert controller.continue_channel.await_args.args[1]['context'].startswith('voice-agent-fallback-')
    assert any(e['outcome'] == 'interrupted' for e in runtime.monitoring.queue._queue)


@pytest.mark.asyncio
async def test_shutdown_waits_for_unregistered_finalizer_after_caller_leaves():
    runtime, storage, controller, _ = fixtures()
    started, release = asyncio.Event(), asyncio.Event()
    storage.admit.side_effect = RuntimeError('storage_unavailable')
    async def fallback(*args):
        started.set()
        await release.wait()
    controller.continue_channel.side_effect = fallback
    await runtime.event({'type': 'StasisStart', 'args': ['caller', 'basic_voice'], 'channel': {
        'id': 'caller', 'dialplan': {'context': 'voice-agent-basic_voice'}}})
    admission = runtime.admissions['caller']
    await asyncio.wait_for(started.wait(), 2)
    await runtime.event({'type': 'ChannelDestroyed', 'channel': {'id': 'caller'}})
    await asyncio.gather(admission, return_exceptions=True)
    assert not runtime.admissions and not runtime.calls
    stopping = asyncio.create_task(runtime.stop())
    try:
        await asyncio.sleep(0)
        assert not stopping.done()
        controller.stop.assert_not_awaited()
    finally:
        release.set()
        await asyncio.wait_for(stopping, 2)
    controller.hangup.assert_awaited_once()


@pytest.mark.asyncio
async def test_shutdown_joins_in_progress_deadline_cleanup():
    runtime, _, controller, _ = fixtures()
    call = await admit(runtime)
    call.bridge_id = 'owned-bridge'
    call.adapter = AsyncMock()
    entered, release = asyncio.Event(), asyncio.Event()

    async def fallback(*args):
        entered.set()
        await release.wait()

    controller.continue_channel.side_effect = fallback
    runtime.monitoring.stop = AsyncMock()
    deadline = runtime.spawn(runtime.deadline(call, 0), call)
    await asyncio.wait_for(entered.wait(), 2)
    stopping = asyncio.create_task(runtime.stop())
    try:
        # Even cancellation of the originating worker cannot abort its finalizer.
        deadline.cancel()
        await asyncio.gather(deadline, return_exceptions=True)
        controller.stop.assert_not_awaited()
    finally:
        release.set()
        await asyncio.wait_for(stopping, 2)
    assert not runtime.calls
    controller.destroy_bridge.assert_awaited_once_with(call.bridge_id)
    call.adapter.close.assert_awaited_once()
    assert any(e['event_type'] == 'fallback' and e['error_code'] == 'duration_exceeded'
               for e in runtime.monitoring.queue._queue)


@pytest.mark.asyncio
@pytest.mark.parametrize('resource', ['leg', 'bridge'])
@pytest.mark.parametrize('lifecycle', ['stop', 'disconnected'])
async def test_hangup_reaps_sip_resource_before_shutdown_or_reconnect(resource, lifecycle):
    runtime, _, controller, _ = fixtures()
    entered, release, early_delete = asyncio.Event(), asyncio.Event(), asyncio.Event()
    history = []

    async def create(*args):
        entered.set()
        await release.wait()
        history.append('created')

    async def delete(identifier):
        history.append('deleted')
        early_delete.set()

    if resource == 'leg':
        controller.originate_local.side_effect = create
        controller.hangup.side_effect = delete
    else:
        controller.create_bridge.side_effect = create
        controller.destroy_bridge.side_effect = delete
    runtime.monitoring.stop = AsyncMock()
    await runtime.event({'type': 'StasisStart', 'args': ['caller', 'basic_voice'], 'channel': {
        'id': 'caller', 'dialplan': {'context': 'voice-agent-basic_voice'}}})
    if resource == 'bridge':
        await asyncio.wait_for(runtime.admissions['caller'], 2)
        call = next(iter(runtime.calls.values()))
        call.provider_answered.set()
        runtime.adapter_factory.return_value = AsyncMock()
        runtime.spawn(runtime.converse(call), call)
    await asyncio.wait_for(entered.wait(), 2)
    await runtime.event({'type': 'StasisEnd', 'channel': {'id': 'caller'}})
    await asyncio.wait_for(early_delete.wait(), 2)
    stopping = asyncio.create_task(getattr(runtime, lifecycle)())
    try:
        async with asyncio.timeout(2):
            while runtime.tasks:
                await asyncio.sleep(0)
        assert not stopping.done()
        controller.stop.assert_not_awaited()
    finally:
        release.set()
        await asyncio.wait_for(stopping, 2)
    assert history == ['deleted', 'created', 'deleted']
    if resource == 'bridge':
        controller.create_bridge.assert_awaited_once_with('sip-' + call.session_id)


@pytest.mark.asyncio
async def test_cancelled_tool_waiter_does_not_cancel_native_transfer():
    runtime, _, controller, _ = fixtures()
    call = await admit(runtime)
    transfer = asyncio.create_task(Transfer(runtime, call).transfer('extension:203'))
    await transfer_started(controller)
    transfer.cancel()
    with pytest.raises(asyncio.CancelledError):
        await transfer
    await runtime.event({'type': 'StasisEnd', 'channel': {'id': call.caller_id}})
    await runtime.event({'type': 'ChannelUserevent', 'eventname': 'VoiceAgentTransfer',
                         'channel': {'id': call.caller_id}, 'userevent': {
                             'token': call.transfer_token, 'destination_id': 'extension:203'}})
    assert await call.transfer_task == {'outcome': 'transferred'}
    controller.hangup.assert_awaited_once_with(call.leg_id)


@pytest.mark.asyncio
async def test_failed_fallback_continuation_hangs_up_the_owned_caller():
    runtime, storage, controller, snapshot = fixtures()
    call = await admit(runtime)
    controller.continue_channel.side_effect=RuntimeError('unavailable')
    await runtime.finish(call,'fallback','test_failure',fallback=True)
    controller.hangup.assert_any_await(call.caller_id)


@pytest.mark.asyncio
async def test_destroy_media_bridge_even_when_provider_leg_is_already_gone():
    runtime, storage, controller, snapshot = fixtures()
    call = await admit(runtime)
    call.bridge_id = 'owned-media-bridge'
    controller.hangup.side_effect=RuntimeError('already_gone')
    await runtime.finish(call,'completed')
    controller.destroy_bridge.assert_awaited_once_with('owned-media-bridge')


@pytest.mark.asyncio
async def test_setup_deadline_requires_connected_media_not_allocated_bridge():
    runtime, storage, controller, snapshot = fixtures()
    call = await admit(runtime)
    call.bridge_id = 'partially-created-bridge'
    assert not call.media_connected
    await runtime.deadline(call, 0, setup=True)
    assert call.terminal
    controller.continue_channel.assert_awaited()


def test_webhook_http_body_boundaries_and_public_route_isolation():
    runtime = MagicMock()
    runtime.webhook = AsyncMock(return_value={'status':'ignored'})
    client = TestClient(create_app('synthetic-token',runtime))
    assert client.post('/satellite-webhooks/openai', content=b'x'*(256*1024+1)).status_code == 413
    assert client.post('/satellite-webhooks/unexpected',content=b'{}').status_code == 404
    assert client.post('/satellite-webhooks/openai/unexpected',content=b'{}').status_code == 404
    assert client.post('/satellite-webhooks/openai/',content=b'{}').status_code == 404
    assert client.get('/internal/ready').status_code == 401


@pytest.mark.asyncio
async def test_parallel_tool_batch_does_not_block_event_consumption():
    runtime, storage, controller, snapshot = fixtures()
    call = await admit(runtime)
    call.provider_call_id = 'synthetic-provider-call'
    call.provider_answered.set()
    completed = asyncio.Event()
    results = []
    class Adapter:
        async def accept(self,*args): pass
        async def connect(self,*args): pass
        async def close(self): pass
        async def respond(self,*args,**kwargs):
            # A continuation must wait for both function results.
            if kwargs.get('response_id'):
                await completed.wait()
        async def send_result(self,identifier,result):
            results.append((identifier,result))
            if len(results)==2: completed.set()
        async def events(self):
            for identifier in ('one','two'):
                yield {'type':'tool_call','invocation_id':identifier,'name':'nv_pbx_find_destinations_v1','arguments':{},'response_id':'batch'}
            await asyncio.Event().wait()
    runtime.adapter_factory=lambda binding: Adapter()
    conversation=runtime.spawn(runtime.converse(call),call)
    await asyncio.wait_for(completed.wait(),timeout=1)
    assert {identifier for identifier,result in results}=={'one','two'}
    assert not call.terminal
    await runtime.finish(call,'completed')
    await asyncio.gather(conversation,return_exceptions=True)


@pytest.mark.asyncio
async def test_caller_hangup_cancels_admission_before_provider_origination():
    import threading
    runtime, storage, controller, snapshot = fixtures()
    waiting = threading.Event()
    released = threading.Event()
    def slow_snapshot(identifier):
        waiting.set()
        released.wait(timeout=1)
        return snapshot
    storage.snapshot.side_effect=slow_snapshot
    await runtime.event({'type':'StasisStart','args':['caller','basic_voice'],'channel':{'id':'early-caller','dialplan':{'context':'voice-agent-basic_voice'}}})
    try:
        for _ in range(20):
            if waiting.is_set(): break
            await asyncio.sleep(.01)
        task=runtime.admissions['early-caller']
        await runtime.event({'type':'StasisEnd','channel':{'id':'early-caller'}})
        await asyncio.gather(task,return_exceptions=True)
        controller.originate_local.assert_not_awaited()
        assert not runtime.calls
    finally:
        released.set()


@pytest.mark.asyncio
async def test_restart_recovery_touches_only_owned_stasis_channels():
    runtime, storage, controller, snapshot = fixtures()
    async def ownership(channel, variable):
        assert variable == 'VOICE_AGENT_ID'
        return 'internal' if channel == 'owned' else None

    controller.get_variable.side_effect = ownership
    controller.list_channels.return_value=[
        {'id':'unrelated','dialplan':{'context':'voice-agent-internal','app_name':'Dial','app_data':'PJSIP/test'}},
        {'id':'fresh','dialplan':{'context':'voice-agent-internal','app_name':'Stasis','app_data':'voice-agent,caller,internal'}},
        {'id':'owned','dialplan':{'context':'voice-agent-internal','app_name':'Stasis','app_data':'voice-agent,caller,internal'}},
        {'id':'old-provider','dialplan':{'context':'voice-agent-provider','app_name':'Stasis','app_data':'voice-agent,provider,old'}},
    ]
    await runtime.event({'type':'AgentAriConnected'})
    controller.continue_channel.assert_awaited_once_with('owned',{'context':'voice-agent-internal','extension':'s','label':'fallback'})
    controller.hangup.assert_awaited_once_with('old-provider')


@pytest.mark.asyncio
async def test_failed_durable_admission_emits_no_orphan_event_or_provider_leg():
    runtime,storage,controller,snapshot=fixtures()
    storage.admit.side_effect=RuntimeError('synthetic_db_failure')
    await runtime.admit({'id':'synthetic-caller','dialplan':{'context':'voice-agent-basic_voice'}},'basic_voice')
    controller.originate_local.assert_not_awaited()
    assert not runtime.monitoring.pending
    assert not runtime.calls


@pytest.mark.asyncio
async def test_full_monitoring_queue_denies_new_admission_before_sip():
    runtime,storage,controller,snapshot=fixtures()
    runtime.monitoring.pending={str(number):{} for number in range(4096-256)}
    await runtime.admit({'id':'synthetic-caller','dialplan':{'context':'voice-agent-basic_voice'}},'basic_voice')
    storage.admit.assert_not_called()
    controller.originate_local.assert_not_awaited()
    controller.continue_channel.assert_awaited_once()


@pytest.mark.asyncio
async def test_v2_fallback_pins_native_wrapper_without_model_dialplan():
    runtime,storage,controller,snapshot=fixtures()
    snapshot['contract_version']=8
    snapshot['fallback_destination_id']='native:ivr-7,s,1'
    call=await admit(runtime)
    snapshot['fallback_destination_id']='hangup'
    await runtime.finish(call,'fallback','test',fallback=True)
    import hashlib
    digest=hashlib.sha256(('basic_voice\0native:ivr-7,s,1').encode()).hexdigest()[:24]
    controller.continue_channel.assert_awaited_with('synthetic-caller',{'context':'voice-agent-fallback-'+digest,'extension':'s','priority':1})


@pytest.mark.parametrize('bridge_allocated', [False, True])
@pytest.mark.asyncio
async def test_caller_hangup_before_provider_connection_is_interrupted_not_completed(bridge_allocated):
    runtime,storage,controller,snapshot=fixtures()
    call=await admit(runtime)
    if bridge_allocated: call.bridge_id='synthetic-pending-bridge'
    await runtime.event({'type':'StasisEnd','channel':{'id':call.caller_id}})
    await asyncio.sleep(0.01)
    events=list(runtime.monitoring.queue._queue)
    terminal=next(e for e in events if e.get('outcome'))
    assert terminal['outcome']=='interrupted'
    assert terminal['error_code']=='caller_cancelled_before_connect'


@pytest.mark.asyncio
async def test_connection_phases_and_response_metadata_are_bounded_and_deduplicated():
    runtime, storage, controller, snapshot = fixtures()
    call = await admit(runtime)
    call.provider_call_id = 'synthetic-provider-call'
    call.provider_answered.set()
    class Adapter:
        async def accept(self, *args): pass
        async def connect(self, *args): pass
        async def close(self): pass
        async def respond(self, *args, **kwargs): pass
        async def events(self):
            for number in range(40):
                event = {'type':'response_done','status':'completed','response_id':f'synthetic-{number}'}
                yield event
                yield event
            yield {'type':'response_done','status':'failed','response_id':'failed-response'}
            await asyncio.Event().wait()
    runtime.adapter_factory = lambda binding: Adapter()
    conversation = runtime.spawn(runtime.converse(call), call)
    for _ in range(30):
        if len(call.observed_responses) == 32: break
        await asyncio.sleep(.01)
    events = list(runtime.monitoring.queue._queue)
    assert [event['event_type'] for event in events if event['event_type'] in ('admitted','provider_connected','media_connected')] == ['admitted','provider_connected','media_connected']
    assert sum(event['event_type'] == 'response_completed' for event in events) == 32
    assert len(call.observed_responses) == 32
    assert all('response_id' not in event and 'transcript' not in event for event in events)
    assert call.media_connected
    await runtime.event({'type':'StasisEnd','channel':{'id':call.caller_id}})
    await asyncio.gather(conversation, return_exceptions=True)
    await asyncio.sleep(.01)
    assert any(event.get('outcome') == 'completed' for event in runtime.monitoring.queue._queue)


async def transfer_started(controller):
    async with asyncio.timeout(2):
        while not controller.continue_channel.called:
            await asyncio.sleep(.001)


@pytest.mark.asyncio
async def test_native_watchdog_leaves_runtime_time_to_execute_deadline_fallback():
    runtime, storage, controller, _ = fixtures()
    call = await admit(runtime)
    call.provider_answered.set()
    call.provider_call_id = 'synthetic-provider'
    call.deadline = time.monotonic() + 30.9
    adapter = AsyncMock()
    ready = asyncio.Event()
    programmed = []

    async def variable(channel, name, value):
        if name == 'TIMEOUT(absolute)':
            programmed.append(time.monotonic() + value)

    async def events():
        ready.set()
        await asyncio.Event().wait()
        yield {}

    controller.set_variable.side_effect = variable
    adapter.events = events
    runtime.adapter_factory = MagicMock(return_value=adapter)
    conversation = runtime.spawn(runtime.converse(call), call)
    try:
        await asyncio.wait_for(ready.wait(), 2)
        assert call.media_connected
        assert call.deadline < programmed[0] <= call.deadline + 10
        await runtime.deadline(call, 0)
        assert call.terminal
        assert controller.continue_channel.await_args.args[1]['context'].startswith('voice-agent-fallback-')
        assert any(event['outcome'] == 'fallback' and event['error_code'] == 'duration_exceeded'
                   for event in runtime.monitoring.queue._queue)
    finally:
        await runtime.finish(call, 'completed')
        await asyncio.gather(conversation, return_exceptions=True)

@pytest.mark.asyncio
@pytest.mark.parametrize('language, words', [('en', 'call time limit'), ('it', 'limite di tempo')])
async def test_late_duration_notice_cannot_delay_native_fallback(language, words):
    runtime, _, controller, _ = fixtures()
    call = await admit(runtime)
    call.media_connected = True
    call.snapshot['conversation']['language'] = language
    call.adapter = AsyncMock()
    spoken = asyncio.Event()
    async def stalled(instructions):
        assert words in instructions
        spoken.set()
        await asyncio.Event().wait()
    call.adapter.consultation_say.side_effect = stalled
    await asyncio.wait_for(runtime.deadline(call, .03), .5)
    assert spoken.is_set()
    controller.continue_channel.assert_awaited_once()
    assert any(e['error_code'] == 'duration_exceeded' for e in runtime.monitoring.pending.values())
