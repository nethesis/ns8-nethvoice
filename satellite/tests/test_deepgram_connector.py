from types import SimpleNamespace
from unittest.mock import AsyncMock

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
    connector.loop = AsyncMock()
    connector.loop.is_running.return_value = True

    await connector.on_error(None, {"message": "boom"})

    connector.loop.call_soon_threadsafe.assert_called_once()
