"""Recent callbacks are an evidence grant, never a direct-extension grant."""
import copy
import time
import json
import subprocess
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest

from test_routing import snapshot as v6, rows
from voice_agent.tools import ToolRegistry
from voice_agent.recent_callers import RecentCallerResolver
from test_contract import CONTRACT, ROOT
from voice_agent.contract import validate_snapshot


def snapshot():
    value = v6()
    value['contract_version'] = 8
    value['tool_bindings'][0]['enabled'] = True
    transfer = value['tool_bindings'][1]
    transfer.update(tool_version=2, enabled=True)
    transfer['config'].update(recent_callers_enabled=True, recent_caller_lookback_days=7,
                              recent_caller_denylist=[], extension_allowlist=['extension:203', 'extension:204'])
    return value


def resolver(value=None, matches=None, clock=time.monotonic):
    value = value or snapshot()
    matches = matches if matches is not None else [
        {'destination_id': 'extension:204', 'called_at': datetime.now(timezone.utc) - timedelta(hours=2)}]
    return RecentCallerResolver(value, '+390212345678', lambda number, days: matches,
                                ('session', 'agent', 1), clock=clock)


@pytest.mark.asyncio
async def test_callback_overrides_only_direct_extension_setting():
    value = snapshot()
    controller = AsyncMock()
    controller.transfer.return_value = {'outcome': 'transferred'}
    at = datetime.now(timezone.utc) - timedelta(hours=2)
    recent = resolver(value, [{'destination_id': 'extension:204', 'called_at': at},
                              {'destination_id': 'extension:205', 'called_at': at}])
    inventory = lambda: [*rows(), {'id': 'extension:205', 'name': 'Unapproved'}]
    registry = ToolRegistry(value, inventory, controller, recent=recent)
    page = await registry.invoke('lookup', 'pbx.find_recent_callers', {})
    assert [c['name'] for c in page['candidates']] == ['Private']
    ref = page['candidates'][0]['candidate_ref']
    assert await registry.invoke('direct', 'pbx.transfer', {'destination_id': 'extension:204'}) == {'error': 'destination_denied'}
    assert await registry.invoke('callback', 'pbx.transfer', {'candidate_ref': ref}) == {'outcome': 'transferred'}
    controller.transfer.assert_awaited_once_with('extension:204', candidate_ref=ref)


@pytest.mark.asyncio
@pytest.mark.parametrize('disabled', ['master', 'recent', 'lookup', 'empty_allowlist'])
async def test_disabled_callback_cannot_be_invoked_by_wire_name(disabled):
    value = snapshot()
    if disabled == 'master':
        value['tool_bindings'][1]['enabled'] = False
    elif disabled == 'recent':
        value['tool_bindings'][1]['config']['recent_callers_enabled'] = False
    elif disabled == 'lookup':
        value['tool_bindings'][2]['enabled'] = False
    else:
        value['tool_bindings'][1]['config']['extension_allowlist'] = []
    registry = ToolRegistry(value, rows, AsyncMock(), recent=resolver(value))
    assert 'nv_pbx_find_recent_callers_v1' not in [m['name'] for m in registry.advertised()]
    assert registry.recent_callback_context() == ''
    assert await registry.invoke('forged', 'nv_pbx_find_recent_callers_v1', {}) == {'error': 'tool_denied'}
    assert 'error' in await registry.invoke('callback', 'pbx.transfer', {'candidate_ref': 'invented'})


@pytest.mark.asyncio
async def test_references_are_short_lived_local_and_deleted_targets_fail():
    clock = [10.]
    recent = resolver(clock=lambda: clock[0])
    page = await recent.lookup({}, rows())
    ref = page['candidates'][0]['candidate_ref']
    assert recent.resolve(ref, rows()) == 'extension:204'
    assert resolver().resolve(ref, rows()) is None
    assert recent.resolve(ref, []) is None
    clock[0] += 301
    assert recent.resolve(ref, rows()) is None
    await recent.close()
    assert recent.resolve(ref, rows()) is None


def test_v7_contract_parity_and_invalid_permissions():
    for filename in ('published-v8.schema.json', 'tools-v5.json'):
        assert (CONTRACT / filename).read_bytes() == (ROOT / 'satellite/voice_agent' / filename).read_bytes()
    valid = snapshot()
    cases = [valid]
    for key, val in [('recent_caller_lookback_days', 0), ('recent_caller_lookback_days', 91),
                     ('recent_caller_lookback_days', True), ('recent_caller_denylist', ['queue:600']),
                     ('recent_callers_enabled', 1)]:
        bad = copy.deepcopy(valid)
        bad['tool_bindings'][1]['config'][key] = val
        cases.append(bad)
    for i, value in enumerate(cases):
        result = subprocess.run(['php', str(ROOT / 'freepbx/tests/agents/validate.php')],
                                input=json.dumps(value), capture_output=True, text=True)
        assert result.returncode == int(i > 0)
        if i:
            with pytest.raises(ValueError): validate_snapshot(value)
        else:
            validate_snapshot(value)


@pytest.mark.asyncio
async def test_multiple_contacts_pagination_dedup_exclusions_and_minimal_data():
    inventory = [{'id': f'extension:{i}', 'name': 'Same name'} for i in range(200, 208)]
    now = datetime.now(timezone.utc)
    matches = [{'destination_id': row['id'], 'called_at': now - timedelta(hours=i)} for i, row in enumerate(inventory)]
    matches += [dict(matches[1], called_at=now - timedelta(days=1))]
    value = snapshot()
    value['tool_bindings'][1]['config']['recent_caller_denylist'] = ['extension:200']
    value['tool_bindings'][1]['config']['extension_allowlist'] = [row['id'] for row in inventory]
    recent = resolver(value, matches)
    first = await recent.lookup({}, inventory)
    second = await recent.lookup({'offset': first['next_offset']}, inventory)
    assert first['next_offset'] == 5 and second['next_offset'] is None
    contacts = first['candidates'] + second['candidates']
    assert [recent.resolve(c['candidate_ref'], inventory) for c in contacts] == [f'extension:{i}' for i in range(201, 208)]
    assert all(set(c) == {'name', 'seconds_ago', 'candidate_ref'} for c in contacts)
    assert '+3902' not in json.dumps(contacts)
    registry = ToolRegistry(value, lambda: inventory, AsyncMock(), recent=recent)
    context = await registry.routing_context()
    assert 'For one match name the contact' in context
    assert 'For multiple matches name' in context
    assert 'Never select the newest automatically' in context
    assert 'Do not look up recent callers during the greeting' in context
    registry.controller.transfer.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize('adapter_kind', ['realtime', 'live'])
async def test_callback_request_guidance_reaches_the_speaking_model_and_backend(adapter_kind):
    from test_runtime import fixtures
    from voice_agent.tools import DEFINITIONS
    runtime, storage, _, _ = fixtures()
    value = snapshot()
    storage.snapshot.return_value = value
    storage.tools.return_value = DEFINITIONS
    storage.routing_targets.return_value = rows()
    await runtime.admit({'id': 'synthetic-caller', 'caller': {'number': '+390212345678'},
                         'dialplan': {'context': 'voice-agent-' + value['agent_id']}}, value['agent_id'])
    call = next(iter(runtime.calls.values()))
    call.binding['adapter'] = adapter_kind
    call.provider_call_id = 'synthetic-provider-call'
    adapter = AsyncMock()
    adapter.connect.side_effect = RuntimeError('synthetic-stop-after-accept')
    runtime.adapter_factory = lambda binding: adapter
    await runtime.converse(call)
    profile = adapter.accept.await_args.args[1]
    contexts = [profile['prompt']]
    if adapter_kind == 'live':
        contexts.append(profile['_routing_context'])
        assert 'Customer Support' not in profile['prompt']
    for context in contexts:
        assert 'someone called me yesterday' in context
        assert 'someone called me from this number' in context
        assert 'I called and spoke with someone' in context
        assert 'answered conversations the caller initiated' in context
        assert 'before asking who called' in context
        assert 'Never ask the caller for their phone number' in context
        assert 'Never speak extension numbers' in context
        assert 'relative call timing' in context
        assert 'Distinguish identical names by extension number' not in context
    storage.recent_calls.assert_not_called()


@pytest.mark.asyncio
async def test_untrusted_inputs_zero_results_and_read_failure():
    recent = resolver(matches=[])
    assert await recent.lookup({}, rows()) == {'candidates': [], 'next_offset': None}
    for args in ({'caller_number': '203'}, {'offset': True}, {'offset': -1}):
        assert await recent.lookup(args, rows()) == {'error': 'invalid_arguments'}
    recent.number = None
    assert await recent.lookup({}, rows()) == {'error': 'caller_identity_unavailable'}
    recent = resolver(matches=[{}] * 1001)
    assert await recent.lookup({}, rows()) == {'error': 'recent_lookup_overflow'}
    recent = resolver()
    def unavailable(*args): raise RuntimeError('sensitive database details')
    recent.reader = unavailable
    assert await recent.lookup({}, rows()) == {'error': 'recent_lookup_unavailable'}


@pytest.mark.asyncio
@pytest.mark.parametrize('remove_before_continue', [False, True])
async def test_actual_executor_requires_evidence_and_confirmed_handoff(remove_before_continue):
    import asyncio
    from test_runtime import fixtures
    from voice_agent.runtime import Call, Transfer
    runtime, storage, controller, _ = fixtures()
    value = snapshot()
    call = Call('session', '00000000-0000-4000-a000-000000000091', 'leg', 'caller', value, {}, None)
    call.recent = RecentCallerResolver(value, '+390212345678',
        lambda *args: [{'destination_id': 'extension:204', 'called_at': datetime.now(timezone.utc)}],
        (call.session_id, value['agent_id'], value['workflow_version']))
    runtime.calls[call.session_id] = call
    storage.routing_targets.return_value = rows()
    ref = (await call.recent.lookup({}, rows()))['candidates'][0]['candidate_ref']
    assert await Transfer(runtime, call).transfer('extension:204') == {'error': 'destination_denied'}
    assert await Transfer(runtime, call).transfer('extension:204', candidate_ref='fake') == {'error': 'destination_denied'}
    if remove_before_continue:
        storage.routing_targets.side_effect = [rows(), []]
        assert await Transfer(runtime, call).transfer('extension:204', candidate_ref=ref) == {'error': 'destination_denied'}
        assert all(a.args[1].get('extension') != '204' for a in controller.continue_channel.await_args_list)
    else:
        ready = asyncio.Event()
        controller.continue_channel.side_effect = lambda *args: ready.set()
        task = asyncio.create_task(Transfer(runtime, call).transfer('extension:204', candidate_ref=ref))
        await asyncio.wait_for(ready.wait(), 1)
        assert not task.done()
        await runtime.event({'type': 'ChannelUserevent', 'eventname': 'VoiceAgentTransfer', 'channel': {'id': call.caller_id},
                             'userevent': {'token': call.transfer_token, 'destination_id': 'extension:204'}})
        assert not task.done()
        await runtime.event({'type': 'StasisEnd', 'channel': {'id': call.caller_id}})
        assert await task == {'outcome': 'transferred'}
    assert call.recent.evidence == {} and call.caller_number is None


@pytest.mark.asyncio
@pytest.mark.parametrize('provider', ['openai', 'grok'])
async def test_provider_emulator_advertises_callback_flow_without_greeting_lookup(provider):
    import asyncio
    from aiohttp.test_utils import TestServer
    from test_runtime import fixtures, sign
    from test_provider_emulators import Emulator, eventually
    from voice_agent.providers import create_adapter
    from voice_agent.tools import DEFINITIONS
    runtime, storage, controller, _ = fixtures()
    value = snapshot()
    value['provider'] = provider
    if provider == 'grok':
        value['conversation'].update(model='provider-default', voice='ara', options=None)
    storage.snapshot.return_value = value
    storage.tools.return_value = DEFINITIONS
    storage.routing_targets.return_value = rows()
    storage.recent_calls.return_value = [
        {'destination_id': 'extension:203', 'called_at': datetime.now(timezone.utc)-timedelta(hours=1)},
        {'destination_id': 'extension:204', 'called_at': datetime.now(timezone.utc)-timedelta(hours=2)}]
    storage.binding.return_value.update(provider=provider, grok_phone_number='+15555550100')
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
        await runtime.admit({'id': 'synthetic-caller', 'caller': {'number': '+390212345678'},
                             'dialplan': {'context': 'voice-agent-'+value['agent_id']}}, value['agent_id'])
        call = next(iter(runtime.calls.values()))
        await runtime.event({'type': 'StasisStart', 'args': ['provider', call.session_id], 'channel': {'id': call.leg_id}})
        body, headers = sign(call, {'call_id': 'synthetic-provider-call', 'sip_headers': [
            {'name': 'X-OS-Session-ID', 'value': call.session_id},
            {'name': 'X-OS-Provider-Leg-ID', 'value': call.leg_id},
            {'name': 'X-OS-Agent-ID', 'value': call.snapshot['agent_id']}]})
        assert await runtime.webhook(provider, body, headers) == {'status': 'accepted'}
        await eventually(lambda: call.media_connected)
        storage.recent_calls.assert_not_called()
        session = emulator.accepted[0] if provider == 'openai' else next(e['session'] for e in emulator.received if e['type'] == 'session.update')
        assert {t['name'] for t in session['tools']} == {'nv_pbx_transfer_v2', 'nv_pbx_find_destinations_v1', 'nv_pbx_find_recent_callers_v1'}
        assert 'ask whom to connect' in session['instructions']
        assert 'someone called me yesterday' in session['instructions']
        assert 'someone called me from this number' in session['instructions']
        assert 'Never speak extension numbers' in session['instructions']
        await emulator.tool('nv_pbx_find_recent_callers_v1', {'caller_number': '203'}, 'spoofed')
        await eventually(lambda: emulator.results('spoofed'))
        assert emulator.results('spoofed') == [{'error': 'invalid_arguments'}]
        await emulator.tool('nv_pbx_find_recent_callers_v1', {}, 'return-call')
        await eventually(lambda: emulator.results('return-call'))
        candidates = emulator.results('return-call')[0]['candidates']
        assert [c['name'] for c in candidates] == ['Alice', 'Private']
        assert all(set(c) == {'name', 'seconds_ago', 'candidate_ref'} for c in candidates)
        storage.recent_calls.assert_called_once_with('+390212345678', 7)
        controller.continue_channel.assert_not_awaited()
        # Scripted selection stands for a caller choosing the second contact.
        await emulator.tool('nv_pbx_transfer_v2', {'candidate_ref': candidates[1]['candidate_ref']}, 'selected-contact')
        await eventually(lambda: controller.continue_channel.await_count > 0)
        assert call.transfer_destination_id == 'extension:204'
        await runtime.event({'type': 'ChannelUserevent', 'eventname': 'VoiceAgentTransfer', 'channel': {'id': call.caller_id},
                             'userevent': {'token': call.transfer_token, 'destination_id': 'extension:204'}})
        await runtime.event({'type': 'StasisEnd', 'channel': {'id': call.caller_id}})
        await eventually(lambda: call.terminal)
        assert any(e['event_type'] == 'transfer_committed' for e in runtime.monitoring.queue._queue)
        assert '+390212345678' not in json.dumps(list(runtime.monitoring.queue._queue))
    finally:
        if call and not call.terminal:
            await runtime.finish(call, 'completed')
        await asyncio.gather(*list(runtime.tasks), return_exceptions=True)
        await server.close()
