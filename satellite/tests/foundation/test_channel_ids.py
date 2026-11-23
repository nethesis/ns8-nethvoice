"""ARI identities must survive native CDR/CEL VARCHAR(32), including Local ;2."""
import uuid
from unittest.mock import AsyncMock
from urllib.parse import quote

import pytest

from test_runtime import admit, fixtures
from voice_agent.ari import AriController


@pytest.mark.asyncio
async def test_provider_channel_fits_both_local_halves_without_changing_correlations():
    runtime, storage, controller, _ = fixtures()
    call = await admit(runtime)
    try:
        assert len(call.leg_id + ';2') <= 32
        assert str(uuid.UUID(call.session_id)) == call.session_id
        assert str(uuid.UUID(call.run_id)) == call.run_id
        assert len({call.leg_id, call.session_id, call.run_id}) == 3
        args = controller.originate_local.await_args.args
        assert args[:2] == (call.session_id, call.leg_id)
        assert args[2]['__AGENT_PROVIDER_LEG_ID'] == call.leg_id
        assert args[2]['__AGENT_SESSION_ID'] == call.session_id
        assert call.linkedid == 'synthetic-linkedid'
        storage.admit.assert_called_once_with(call)
        await runtime.event({'type': 'StasisStart', 'args': ['provider', call.session_id],
                             'channel': {'id': call.leg_id + ';2'}})
        assert not call.provider_answered.is_set()
        controller.hangup.assert_awaited_with(call.leg_id + ';2')
        await runtime.event({'type': 'StasisStart', 'args': ['provider', call.session_id],
                             'channel': {'id': call.leg_id}})
        assert call.provider_answered.is_set()
    finally:
        await runtime.finish(call, 'completed')
    controller.hangup.assert_awaited_with(call.leg_id)
    assert not runtime.calls


@pytest.mark.asyncio
@pytest.mark.parametrize('operation', ['provider', 'consult', 'media'])
@pytest.mark.parametrize('channel_id', [str(uuid.uuid4()), 'a' * 31, '', 'é' * 30])
async def test_ari_refuses_unsafe_new_channel_ids_before_any_request(operation, channel_id):
    controller = AriController('http://synthetic', 'user', 'password')
    controller.request = AsyncMock()
    with pytest.raises(ValueError, match='channel_id'):
        if operation == 'provider':
            await controller.originate_local('session', channel_id, {})
        elif operation == 'consult':
            await controller.originate_consult('session', 'attempt', channel_id, '203', 10)
        else:
            await controller.create_media_channel('session', channel_id, 'receptionist')
    controller.request.assert_not_awaited()


@pytest.mark.asyncio
async def test_existing_uuid_channels_can_still_be_cleaned_up():
    controller = AriController('http://synthetic', 'user', 'password')
    controller.request = AsyncMock()
    # The creation guard must not strand calls started by the previous runtime.
    for channel_id in (str(uuid.uuid4()), str(uuid.uuid4()) + ';2'):
        await controller.hangup(channel_id)
        controller.request.assert_awaited_with('DELETE', '/channels/' + quote(channel_id, safe=''))
