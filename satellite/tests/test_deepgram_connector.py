from types import SimpleNamespace
from unittest.mock import MagicMock, AsyncMock

import pytest

from deepgram_connector import DeepgramConnector


def _make_connector():
    return DeepgramConnector(
        deepgram_api_key="test-key",
        rtp_stream_in=SimpleNamespace(reader=SimpleNamespace(read=lambda _: b"")),
        rtp_stream_out=SimpleNamespace(reader=SimpleNamespace(read=lambda _: b"")),
        mqtt_client=SimpleNamespace(publish=AsyncMock()),
        uniqueid="1234567890.1",
        language="en",
        speaker_name_in="Alice",
        speaker_number_in="100",
        speaker_name_out="Bob",
        speaker_number_out="200",
    )


@pytest.mark.asyncio
async def test_close_publishes_fallback_interim_transcript(monkeypatch):
    connector = _make_connector()
    monkeypatch.setenv("DEEPGRAM_FINALIZE_GRACE_SECONDS", "0")

    connector.latest_interim_by_channel = {
        0: {
            "uniqueid": connector.uniqueid,
            "transcription": "hello world",
            "timestamp": 1.5,
            "speaker_name": "Alice",
            "speaker_number": "100",
            "speaker_counterpart_name": "Bob",
            "speaker_counterpart_number": "200",
            "is_final": False,
        }
    }

    await connector.close()

    connector.mqtt_client.publish.assert_awaited_once()
    _, payload = connector.mqtt_client.publish.await_args.kwargs["topic"], connector.mqtt_client.publish.await_args.kwargs["payload"]
    assert connector.mqtt_client.publish.await_args.kwargs["topic"] == "final"
    assert "hello world" in payload


@pytest.mark.asyncio
async def test_close_prefers_final_segments(monkeypatch):
    connector = _make_connector()
    monkeypatch.setenv("DEEPGRAM_FINALIZE_GRACE_SECONDS", "0")

    connector.complete_call = [
        {
            "uniqueid": connector.uniqueid,
            "transcription": "final text",
            "timestamp": 2.0,
            "speaker_name": "Alice",
            "speaker_number": "100",
            "speaker_counterpart_name": "Bob",
            "speaker_counterpart_number": "200",
            "is_final": True,
        }
    ]
    connector.latest_interim_by_channel = {
        0: {
            "uniqueid": connector.uniqueid,
            "transcription": "interim text",
            "timestamp": 1.0,
            "speaker_name": "Alice",
            "speaker_number": "100",
            "speaker_counterpart_name": "Bob",
            "speaker_counterpart_number": "200",
            "is_final": False,
        }
    }

    await connector.close()

    payload = connector.mqtt_client.publish.await_args.kwargs["payload"]
    assert "final text" in payload
    assert "interim text" not in payload


@pytest.mark.asyncio
async def test_on_error_is_awaitable_and_schedules_close():
    connector = _make_connector()
    connector.loop = MagicMock()
    connector.loop.is_running.return_value = True

    await connector.on_error(None, {"message": "boom"})

    connector.loop.call_soon_threadsafe.assert_called_once()


class _FakeLiveConnection:
    def __init__(self, start_result):
        self._start_result = start_result

    def on(self, event, handler):
        pass

    async def start(self, options):
        if isinstance(self._start_result, Exception):
            raise self._start_result
        return self._start_result


def _patch_deepgram_client(monkeypatch, start_result):
    import deepgram_connector

    connection = _FakeLiveConnection(start_result)
    client = SimpleNamespace(
        listen=SimpleNamespace(asyncwebsocket=SimpleNamespace(v=lambda version: connection))
    )
    monkeypatch.setattr(deepgram_connector, "DeepgramClient", lambda api_key: client)


def _realtime_metric(result: str) -> str:
    from tests.metrics_helpers import sample_value

    return sample_value("satellite_ai_calls_total", provider="deepgram", operation="realtime_transcription", result=result)


@pytest.mark.asyncio
async def test_start_success_is_counted(monkeypatch):
    _patch_deepgram_client(monkeypatch, True)
    connector = _make_connector()
    connector.read_audio_from_rtp = AsyncMock()
    connector.send_audio_to_deepgram = AsyncMock()

    await connector.start()

    assert _realtime_metric("success") == "1"
    assert _realtime_metric("failure") == "0"


@pytest.mark.asyncio
async def test_start_failure_is_counted(monkeypatch):
    _patch_deepgram_client(monkeypatch, False)
    connector = _make_connector()

    await connector.start()

    assert _realtime_metric("success") == "0"
    assert _realtime_metric("failure") == "1"


@pytest.mark.asyncio
async def test_start_exception_is_counted_and_raised(monkeypatch):
    _patch_deepgram_client(monkeypatch, RuntimeError("handshake failed"))
    connector = _make_connector()

    with pytest.raises(RuntimeError):
        await connector.start()

    assert _realtime_metric("failure") == "1"


@pytest.mark.asyncio
async def test_concurrent_close_joins_audio_tasks_and_waits_for_final_publication():
    import asyncio

    connector = _make_connector()
    entered, release = asyncio.Event(), asyncio.Event()

    async def finalize():
        entered.set()
        await release.wait()

    connector.dg_connection = SimpleNamespace(finalize=AsyncMock(side_effect=finalize))
    connector.complete_call = [{'speaker_name': 'Alice', 'transcription': 'final words'}]
    sender = asyncio.create_task(asyncio.Event().wait())
    connector.send_audio_to_deepgram_task = sender
    first = asyncio.create_task(connector.close())
    connector.read_audio_from_rtp_task = first
    await asyncio.wait_for(entered.wait(), 1)
    second = asyncio.create_task(connector.close())
    await asyncio.sleep(0)
    assert not second.done()
    release.set()
    await asyncio.wait_for(asyncio.gather(first, second), 2)
    assert sender.cancelled()
    connector.mqtt_client.publish.assert_awaited_once()
