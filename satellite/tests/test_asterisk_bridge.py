import asyncio
from unittest.mock import AsyncMock, Mock

import aiohttp
import pytest

from asterisk_bridge import AsteriskBridge


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
