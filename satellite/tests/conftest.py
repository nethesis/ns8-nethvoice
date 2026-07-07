"""
Shared test fixtures and configuration for pytest.
"""
import pytest
import asyncio
from unittest.mock import AsyncMock
from io import BytesIO


@pytest.fixture
def mock_deepgram_response():
    """Mock response from Deepgram API."""
    return {
        "results": {
            "paragraphs": {"transcript": "SPEAKER 1: This is a test transcription"},
            "channels": [
                {
                    "alternatives": [
                        {
                            "transcript": "This is a test transcription"
                        }
                    ]
                }
            ]
        }
    }


@pytest.fixture
def sample_wav_file():
    """Create a minimal WAV file for testing."""
    # Minimal WAV file header + some data
    wav_header = b'RIFF'
    wav_header += b'\x24\x00\x00\x00'  # File size - 8
    wav_header += b'WAVE'
    wav_header += b'fmt '
    wav_header += b'\x10\x00\x00\x00'  # fmt chunk size
    wav_header += b'\x01\x00'  # Audio format (PCM)
    wav_header += b'\x01\x00'  # Number of channels
    wav_header += b'\x44\xac\x00\x00'  # Sample rate (44100)
    wav_header += b'\x88\x58\x01\x00'  # Byte rate
    wav_header += b'\x02\x00'  # Block align
    wav_header += b'\x10\x00'  # Bits per sample
    wav_header += b'data'
    wav_header += b'\x00\x00\x00\x00'  # Data chunk size
    
    return BytesIO(wav_header)


@pytest.fixture
def mock_mqtt_client():
    """Mock MQTT client for testing."""
    client = AsyncMock()
    client.subscribe = AsyncMock()
    client.publish = AsyncMock()
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock()
    client.messages = AsyncMock()
    return client


@pytest.fixture
def event_loop():
    """Create an instance of the default event loop for each test case."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

