import asyncio
import copy
from unittest.mock import AsyncMock

import pytest
from test_agent_models import snapshot
from test_runtime import fixtures, admit
from voice_agent.tools import DEFINITIONS


def live_runtime():
    runtime, storage, controller, _ = fixtures()
    storage.snapshot.return_value = snapshot('gpt-live-1')
    storage.tools.return_value = copy.deepcopy(DEFINITIONS)
    return runtime, storage, controller


@pytest.mark.asyncio
async def test_zero_bridge_capacity_falls_back_before_paid_or_durable_admission(monkeypatch):
    runtime, storage, controller = live_runtime()
    monkeypatch.setenv('VOICE_AGENT_LIVE_WS_MAX_CALLS', '0')
    await runtime.admit({'id': 'test', 'dialplan': {'context': 'voice-agent-basic_voice'}}, 'basic_voice')
    storage.admit.assert_not_called()
    runtime.adapter_factory.assert_not_called()
    controller.create_media_channel.assert_not_awaited()
    controller.continue_channel.assert_awaited_once_with('test')


@pytest.mark.asyncio
async def test_late_media_stasis_for_a_terminal_call_is_hung_up():
    runtime, storage, controller = live_runtime()
    runtime.converse = AsyncMock()
    call = await admit(runtime)
    call.terminal = True
    await runtime.event({'type': 'StasisStart', 'args': ['media', call.session_id],
                         'channel': {'id': call.leg_id}})
    controller.hangup.assert_awaited_once_with(call.leg_id)
    assert not call.provider_answered.is_set()
    call.terminal = False
    await runtime.finish(call, 'completed')


@pytest.mark.asyncio
async def test_cancelled_media_creation_is_reaped_after_its_ari_commit():
    runtime, storage, controller = live_runtime()
    runtime.converse = AsyncMock()
    call = await admit(runtime)
    entered, commit = asyncio.Event(), asyncio.Event()
    history = []
    async def create():
        entered.set()
        await commit.wait()
        history.append('created')
    async def cleanup():
        history.append('cleaned')
    task = asyncio.create_task(runtime.owned_resource(call, create(), cleanup))
    await entered.wait()
    call.terminal = True
    task.cancel()
    await asyncio.gather(task, return_exceptions=True)
    assert not history
    commit.set()
    async with asyncio.timeout(1):
        while history != ['created', 'cleaned']:
            await asyncio.sleep(.01)
    assert history == ['created', 'cleaned']
    call.terminal = False
    await runtime.finish(call, 'completed')


@pytest.mark.asyncio
async def test_recovery_requires_database_and_channel_markers():
    runtime, storage, controller = live_runtime()
    storage.media_ownership.return_value = {'owned': 'session-owned', 'foreign': 'session-foreign'}
    controller.list_channels.return_value = [{'id': 'owned'}, {'id': 'foreign'}, {'id': 'transcription'}]
    async def variable(cid, name):
        if cid == 'owned': return 'session-owned' if name == 'AGENT_SESSION_ID' else 'live_ws'
        return 'untrusted'
    controller.get_variable.side_effect = variable
    await runtime.event({'type': 'AgentAriConnected'})
    controller.hangup.assert_awaited_once_with('owned')


@pytest.mark.asyncio
async def test_ambiguous_ari_timeout_cleans_the_owned_resource():
    runtime, storage, controller = live_runtime()
    runtime.converse = AsyncMock()
    call = await admit(runtime)
    history = []
    async def create():
        history.append('committed')
        raise asyncio.TimeoutError
    async def cleanup():
        history.append('cleaned')
    with pytest.raises(asyncio.TimeoutError):
        await runtime.owned_resource(call, create(), cleanup)
    assert history == ['committed', 'cleaned']
    await runtime.finish(call, 'completed')
