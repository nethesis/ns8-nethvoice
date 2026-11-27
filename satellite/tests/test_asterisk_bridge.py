import asyncio
from unittest.mock import AsyncMock

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


@pytest.mark.asyncio
async def test_ext_media_without_call_is_hung_up():
    bridge = _bridge()
    bridge._ari_request = AsyncMock(return_value=None)

    await bridge._handle_ari_event({
        "type": "StasisStart",
        "channel": {"id": "ext-media-in-1795684039.6972"},
    })

    bridge._ari_request.assert_awaited_once_with(
        "DELETE", "/channels/ext-media-in-1795684039.6972"
    )


@pytest.mark.asyncio
async def test_snoop_without_call_is_hung_up():
    bridge = _bridge()
    bridge._ari_request = AsyncMock(return_value=None)

    await bridge._handle_ari_event({
        "type": "StasisStart",
        "channel": {"id": "snoop-out-1795684039.6972"},
    })

    bridge._ari_request.assert_awaited_once_with(
        "DELETE", "/channels/snoop-out-1795684039.6972"
    )


@pytest.mark.asyncio
async def test_bridge_failure_cleans_up_and_continues_call():
    bridge = _bridge()
    bridge.channels["chan-1"] = {
        "snoop_channel_in": "snoop-in-chan-1",
        "snoop_channel_out": "snoop-out-chan-1",
        "external_media_channel_in": "ext-media-in-chan-1",
    }

    async def ari(method, endpoint, params=None, json_data=None):
        if method == "POST" and endpoint.endswith("/addChannel"):
            raise Exception("ARI request failed: 422")
        return None

    bridge._ari_request = AsyncMock(side_effect=ari)

    await bridge._handle_ari_event({
        "type": "StasisStart",
        "channel": {"id": "ext-media-in-chan-1"},
    })

    calls = [c.args[:2] for c in bridge._ari_request.await_args_list]
    assert "chan-1" not in bridge.channels
    assert ("DELETE", "/bridges/bridge-in-chan-1") in calls
    assert ("DELETE", "/channels/ext-media-in-chan-1") in calls
    assert ("DELETE", "/channels/snoop-in-chan-1") in calls
    assert ("DELETE", "/channels/snoop-out-chan-1") in calls
    assert calls[-1] == ("POST", "/channels/chan-1/continue")


@pytest.mark.asyncio
async def test_snoop_failure_continues_call():
    bridge = _bridge()

    async def ari(method, endpoint, params=None, json_data=None):
        if endpoint.endswith("/snoop"):
            raise Exception("ARI request failed: 404")
        return None

    bridge._ari_request = AsyncMock(side_effect=ari)

    await bridge._handle_ari_event({
        "type": "StasisStart",
        "channel": {
            "id": "chan-1",
            "linkedid": "1795684039.1",
            "caller": {},
            "connected": {},
        },
    })

    assert "chan-1" not in bridge.channels
    bridge._ari_request.assert_any_await(
        "POST", "/channels/chan-1/continue", params={}
    )


@pytest.mark.asyncio
async def test_helper_channel_destroyed_closes_call():
    bridge = _bridge()
    bridge._ari_request = AsyncMock(return_value=None)
    bridge.channels["chan-1"] = {
        "snoop_channel_in": "snoop-in-chan-1",
        "external_media_channel_in": "ext-media-in-chan-1",
        "bridge_in": "bridge-in-chan-1",
    }

    await bridge._handle_ari_event({
        "type": "ChannelDestroyed",
        "channel": {"id": "snoop-in-chan-1"},
    })

    assert "chan-1" not in bridge.channels
    bridge._ari_request.assert_any_await("DELETE", "/bridges/bridge-in-chan-1")
    bridge._ari_request.assert_any_await("DELETE", "/channels/ext-media-in-chan-1")


@pytest.mark.asyncio
async def test_event_error_does_not_stop_event_loop():
    bridge = _bridge()
    handled = []

    async def handle(event):
        handled.append(event["n"])
        if event["n"] == 1:
            raise KeyError("boom")

    bridge._handle_ari_event = handle
    bridge.is_shutting_down = True

    class Msg:
        def __init__(self, n):
            self.type = __import__("aiohttp").WSMsgType.TEXT
            self.data = '{"n": %d}' % n

    class WS:
        def __aiter__(self):
            async def gen():
                for n in (1, 2):
                    yield Msg(n)
            return gen()

    bridge.ws = WS()
    await bridge._process_ari_events()

    assert handled == [1, 2]


@pytest.mark.asyncio
async def test_sweep_removes_orphans_and_keeps_active_calls():
    bridge = _bridge()
    bridge.channels["live"] = {"created_at": 0}
    bridge.channels["gone"] = {
        "created_at": 0,
        "external_media_channel_in": "ext-media-in-gone",
    }
    bridge.channels["new"] = {"created_at": __import__("time").monotonic()}

    async def ari(method, endpoint, params=None, json_data=None):
        if (method, endpoint) == ("GET", "/channels"):
            return [
                {"id": "live"},
                {"id": "snoop-in-live"},
                {"id": "ext-media-in-live"},
                {"id": "ext-media-in-old"},
                {"id": "snoop-out-old"},
                {"id": "PJSIP/other"},
            ]
        if (method, endpoint) == ("GET", "/bridges"):
            return [{"id": "bridge-in-live"}, {"id": "bridge-out-old"}, {"id": "other"}]
        return None

    bridge._ari_request = AsyncMock(side_effect=ari)

    await bridge.sweep_orphans()

    deletes = {c.args[1] for c in bridge._ari_request.await_args_list if c.args[0] == "DELETE"}
    assert deletes == {
        "/channels/ext-media-in-old",
        "/channels/snoop-out-old",
        "/channels/ext-media-in-gone",
        "/bridges/bridge-out-old",
    }
    assert set(bridge.channels) == {"live", "new"}
