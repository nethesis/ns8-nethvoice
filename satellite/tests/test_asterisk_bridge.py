import asyncio
from unittest.mock import AsyncMock, Mock

import aiohttp
import pytest

from asterisk_bridge import AriError, AsteriskBridge


@pytest.mark.asyncio
async def test_start_connector_ignores_concurrent_duplicate_start():
    bridge = AsteriskBridge(
        url="http://ari.local",
        app="satellite",
        username="user",
        password="pass",
        mqtt_client=AsyncMock(),
        rtp_server=AsyncMock(),
    )

    start_gate = asyncio.Event()
    connector = AsyncMock()
    connector.start = AsyncMock(side_effect=lambda: start_gate.wait())

    bridge.channels["chan-1"] = {
        "connector_started": False,
        "connector_starting": False,
        "rtp_stream_in": object(),
        "rtp_stream_out": object(),
        "call_elapsed_at_start": 0,
        "connector": connector,
    }

    first = asyncio.create_task(bridge._start_connector("chan-1"))
    await asyncio.sleep(0)
    second = asyncio.create_task(bridge._start_connector("chan-1"))
    await asyncio.sleep(0)

    start_gate.set()
    await asyncio.gather(first, second)

    connector.start.assert_awaited_once()
    assert bridge.channels["chan-1"]["connector_started"] is True


def _bridge():
    return AsteriskBridge(
        url="http://ari.local",
        app="satellite",
        username="user",
        password="pass",
        mqtt_client=AsyncMock(),
        rtp_server=AsyncMock(),
    )


def _requests(bridge):
    return [c.args[:2] for c in bridge._ari_request.await_args_list]


@pytest.mark.asyncio
@pytest.mark.parametrize("channel_id", ["ext-media-in-1795684039.6972", "snoop-out-1795684039.6972"])
async def test_helper_channel_without_call_is_hung_up(channel_id):
    bridge = _bridge()
    bridge._ari_request = AsyncMock(return_value=None)

    await bridge._handle_ari_event({"type": "StasisStart", "channel": {"id": channel_id}})

    assert _requests(bridge) == [("DELETE", f"/channels/{channel_id}")]


@pytest.mark.asyncio
async def test_setup_failure_cleans_up_and_continues_call():
    bridge = _bridge()
    bridge.channels["chan-1"] = {
        "waiting": True,
        "snoop_channel_in": "snoop-in-chan-1",
        "external_media_channel_in": "ext-media-in-chan-1",
    }

    async def ari(method, endpoint, params=None, json_data=None):
        if endpoint.endswith("/addChannel"):
            raise Exception("ARI request failed: 422")
        return {"id": "bridge-in-chan-1"}

    bridge._ari_request = AsyncMock(side_effect=ari)

    await bridge._handle_ari_event({"type": "StasisStart", "channel": {"id": "ext-media-in-chan-1"}})

    assert "chan-1" not in bridge.channels
    assert ("DELETE", "/bridges/bridge-in-chan-1") in _requests(bridge)
    assert ("DELETE", "/channels/ext-media-in-chan-1") in _requests(bridge)
    assert _requests(bridge)[-1] == ("POST", "/channels/chan-1/continue")


@pytest.mark.asyncio
async def test_helper_channel_destroyed_closes_call():
    bridge = _bridge()
    bridge._ari_request = AsyncMock(return_value=None)
    bridge.channels["chan-1"] = {
        "snoop_channel_in": "snoop-in-chan-1",
        "external_media_channel_in": "ext-media-in-chan-1",
        "bridge_in": "bridge-in-chan-1",
    }

    await bridge._handle_ari_event({"type": "ChannelDestroyed", "channel": {"id": "snoop-in-chan-1"}})

    assert "chan-1" not in bridge.channels
    assert _requests(bridge) == [
        ("DELETE", "/bridges/bridge-in-chan-1"),
        ("DELETE", "/channels/ext-media-in-chan-1"),
    ]


@pytest.mark.asyncio
async def test_event_error_does_not_stop_event_loop():
    bridge = _bridge()
    bridge.is_shutting_down = True
    bridge._handle_ari_event = AsyncMock(side_effect=[KeyError("boom"), None])

    class WS:
        async def __aiter__(self):
            for _ in range(2):
                yield Mock(type=aiohttp.WSMsgType.TEXT, data="{}")

    bridge.ws = WS()
    await bridge._process_ari_events()

    assert bridge._handle_ari_event.await_count == 2


@pytest.mark.asyncio
async def test_sweep_removes_orphans_and_keeps_active_calls():
    bridge = _bridge()
    bridge.channels["live"] = {}
    bridge.channels["gone"] = {"external_media_channel_in": "ext-media-in-gone"}

    async def ari(method, endpoint, params=None, json_data=None):
        if (method, endpoint) == ("GET", "/channels"):
            return [{"id": i} for i in (
                "live", "snoop-in-live", "ext-media-in-live",
                "ext-media-in-old", "snoop-out-old", "1795684039.1",
            )]
        if (method, endpoint) == ("GET", "/bridges"):
            return [{"id": "bridge-in-live"}, {"id": "bridge-out-old"}, {"id": "other"}]
        return None

    bridge._ari_request = AsyncMock(side_effect=ari)

    await bridge.sweep_orphans()

    assert {r[1] for r in _requests(bridge) if r[0] == "DELETE"} == {
        "/channels/ext-media-in-old",
        "/channels/snoop-out-old",
        "/channels/ext-media-in-gone",
        "/bridges/bridge-out-old",
    }
    assert list(bridge.channels) == ["live"]


async def _start_call(bridge):
    """Set up call chan-1 up to the external media channel of the in direction."""
    async def ari(method, endpoint, params=None, json_data=None):
        if endpoint.endswith("/snoop"):
            return {"id": params["snoopId"]}
        if endpoint == "/channels/externalMedia":
            return {"id": params["channelId"], "channelvars": {"UNICASTRTP_LOCAL_PORT": "4000"}}
        return None

    bridge._ari_request = AsyncMock(side_effect=ari)
    bridge._get_channel_variable = AsyncMock(return_value=None)
    await bridge._handle_ari_event({"type": "StasisStart", "channel": {
        "id": "chan-1", "caller": {}, "connected": {}, "linkedid": "chan-1",
    }})
    await bridge._handle_ari_event({"type": "StasisStart", "channel": {"id": "snoop-in-chan-1"}})


@pytest.mark.asyncio
@pytest.mark.parametrize("event_type", ["ChannelDestroyed", "StasisEnd"])
async def test_helper_gone_during_setup_continues_call(event_type):
    bridge = _bridge()
    await _start_call(bridge)

    await bridge._handle_ari_event({"type": event_type, "channel": {"id": "snoop-out-chan-1"}})

    assert "chan-1" not in bridge.channels
    assert ("DELETE", "/channels/ext-media-in-chan-1") in _requests(bridge)
    assert _requests(bridge).count(("POST", "/channels/chan-1/continue")) == 1


@pytest.mark.asyncio
async def test_helper_destroyed_after_setup_does_not_continue_again():
    bridge = _bridge()
    bridge._ari_request = AsyncMock(return_value=None)
    bridge.channels["chan-1"] = {
        "waiting": False,
        "snoop_channel_in": "snoop-in-chan-1",
        "external_media_channel_in": "ext-media-in-chan-1",
    }

    await bridge._handle_ari_event({"type": "ChannelDestroyed", "channel": {"id": "ext-media-in-chan-1"}})
    await bridge._handle_ari_event({"type": "StasisEnd", "channel": {"id": "snoop-in-chan-1"}})

    assert "chan-1" not in bridge.channels
    assert _requests(bridge) == [("DELETE", "/channels/ext-media-in-chan-1")]


def _asterisk(channels, continue_errors=()):
    """ARI mock: Asterisk has these channels and no bridge. Continue requests
    raise the given errors in turn, then succeed."""
    continue_errors = list(continue_errors)

    async def ari(method, endpoint, params=None, json_data=None):
        if (method, endpoint) == ("GET", "/channels"):
            return [{"id": i} for i in channels]
        if (method, endpoint) == ("GET", "/bridges"):
            return []
        if endpoint.endswith("/continue") and continue_errors:
            raise continue_errors.pop(0)
        return None
    return AsyncMock(side_effect=ari)


SETUP_CHANNELS = ("chan-1", "snoop-in-chan-1", "ext-media-in-chan-1")


@pytest.mark.asyncio
async def test_sweep_releases_call_stuck_in_setup():
    bridge = _bridge()
    await _start_call(bridge)
    bridge._ari_request = _asterisk(SETUP_CHANNELS)

    await bridge.sweep_orphans()

    assert "chan-1" in bridge.channels
    assert ("POST", "/channels/chan-1/continue") not in _requests(bridge)

    await bridge.sweep_orphans()

    assert "chan-1" not in bridge.channels
    assert _requests(bridge).count(("POST", "/channels/chan-1/continue")) == 1
    assert ("DELETE", "/channels/snoop-in-chan-1") in _requests(bridge)
    assert ("DELETE", "/channels/ext-media-in-chan-1") in _requests(bridge)


@pytest.mark.asyncio
async def test_sweep_keeps_call_that_finished_setup():
    bridge = _bridge()
    bridge.channels["chan-1"] = {"waiting": False, "snoop_channel_in": "snoop-in-chan-1"}
    bridge._ari_request = _asterisk(SETUP_CHANNELS)

    await bridge.sweep_orphans()
    await bridge.sweep_orphans()

    assert "chan-1" in bridge.channels
    assert {r[0] for r in _requests(bridge)} == {"GET"}


@pytest.mark.asyncio
@pytest.mark.parametrize("error", [aiohttp.ClientConnectionError("refused"), asyncio.TimeoutError()])
async def test_failed_continue_is_retried_by_sweep(error):
    bridge = _bridge()
    await _start_call(bridge)
    bridge._ari_request = _asterisk(SETUP_CHANNELS, continue_errors=[error])

    await bridge._handle_ari_event({"type": "StasisEnd", "channel": {"id": "snoop-out-chan-1"}})

    assert "chan-1" not in bridge.channels
    assert bridge.pending_continues == {"chan-1"}

    bridge._ari_request = _asterisk(SETUP_CHANNELS)
    await bridge.sweep_orphans()

    assert _requests(bridge).count(("POST", "/channels/chan-1/continue")) == 1
    assert bridge.pending_continues == set()


@pytest.mark.asyncio
async def test_continue_refused_by_asterisk_is_not_retried():
    bridge = _bridge()
    await _start_call(bridge)
    bridge._ari_request = _asterisk(SETUP_CHANNELS, continue_errors=[AriError(404)])

    await bridge._handle_ari_event({"type": "StasisEnd", "channel": {"id": "snoop-out-chan-1"}})

    assert "chan-1" not in bridge.channels
    assert bridge.pending_continues == set()


@pytest.mark.asyncio
async def test_continue_server_error_is_retried_by_sweep():
    bridge = _bridge()
    await _start_call(bridge)
    bridge._ari_request = _asterisk(SETUP_CHANNELS, continue_errors=[AriError(500)])

    await bridge._handle_ari_event({"type": "StasisEnd", "channel": {"id": "snoop-out-chan-1"}})

    assert "chan-1" not in bridge.channels
    assert bridge.pending_continues == {"chan-1"}

    await bridge.sweep_orphans()

    assert _requests(bridge).count(("POST", "/channels/chan-1/continue")) == 2
    assert bridge.pending_continues == set()


@pytest.mark.asyncio
async def test_sweep_drops_pending_continue_of_channel_gone():
    bridge = _bridge()
    bridge.pending_continues.add("chan-1")
    bridge._ari_request = _asterisk(("1795684039.1",))

    await bridge.sweep_orphans()

    assert ("POST", "/channels/chan-1/continue") not in _requests(bridge)
    assert bridge.pending_continues == set()
