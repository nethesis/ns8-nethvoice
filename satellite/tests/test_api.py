"""
Unit tests for the FastAPI application endpoints.
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock, Mock
from io import BytesIO
import httpx
import os


@pytest.fixture(autouse=True)
def _unset_api_token(monkeypatch):
    """Ensure local env doesn't accidentally enable auth during tests."""
    monkeypatch.delenv("API_TOKEN", raising=False)


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    from api import app
    return TestClient(app)


@pytest.fixture
def valid_wav_content():
    """Create valid WAV file content for testing."""
    # Minimal WAV file header
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
    return wav_header


class TestGetTranscription:
    """Tests for the /api/get_transcription endpoint."""

    def test_auth_enabled_missing_token_returns_401(self, client, valid_wav_content):
        with patch.dict(os.environ, {"API_TOKEN": "secret"}):
            response = client.post(
                "/api/get_transcription",
                files={"file": ("test.wav", valid_wav_content, "audio/wav")},
                data={"uniqueid": "1234567890.1234"},
            )

        assert response.status_code == 401

    def test_auth_enabled_wrong_token_returns_401(self, client, valid_wav_content):
        with patch.dict(os.environ, {"API_TOKEN": "secret"}):
            response = client.post(
                "/api/get_transcription",
                headers={"Authorization": "Bearer wrong"},
                files={"file": ("test.wav", valid_wav_content, "audio/wav")},
                data={"uniqueid": "1234567890.1234"},
            )

        assert response.status_code == 401

    @patch('httpx.AsyncClient')
    def test_auth_enabled_valid_token_allows_request(self, mock_client_class, client, valid_wav_content):
        """When API_TOKEN is set, /api endpoints require a matching token."""
        # Mock the Deepgram API response
        mock_response = Mock()
        mock_response.json.return_value = {
            "results": {
                "paragraphs": {"transcript": "SPEAKER 1: Hello world"},
                "channels": [
                    {
                        "alternatives": [
                            {"transcript": "Hello world"}
                        ]
                    }
                ]
            }
        }
        mock_response.raise_for_status = Mock()

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock()
        mock_client_class.return_value = mock_client

        with patch.dict(os.environ, {"API_TOKEN": "secret"}):
            response = client.post(
                "/api/get_transcription",
                headers={"Authorization": "Bearer secret"},
                files={"file": ("test.wav", valid_wav_content, "audio/wav")},
                data={"uniqueid": "1234567890.1234", "multichannel": "true"},
            )

        assert response.status_code == 200

    def test_docs_not_protected_by_api_token(self, client):
        with patch.dict(os.environ, {"API_TOKEN": "secret"}):
            response = client.get("/docs")

        assert response.status_code == 200

    @patch("api.db.is_configured", return_value=False)
    def test_missing_uniqueid(self, mock_db_configured, client, valid_wav_content):
        """Test that missing uniqueid is rejected when persistence is requested."""
        response = client.post(
            "/api/get_transcription",
            files={"file": ("test.wav", valid_wav_content, "audio/wav")},
            data={"persist": "true"},
        )

        assert response.status_code == 400
        assert "uniqueid" in response.json()["detail"]

    @patch('httpx.AsyncClient')
    def test_valid_wav_file(self, mock_client_class, client, valid_wav_content):
        """Test transcription with a valid WAV file."""
        # Mock the Deepgram API response
        mock_response = Mock()
        mock_response.json.return_value = {
            "results": {
                "paragraphs": {"transcript": "SPEAKER 1: Hello world"},
                "channels": [
                    {
                        "alternatives": [
                            {"transcript": "Hello world"}
                        ]
                    }
                ]
            }
        }
        mock_response.raise_for_status = Mock()
        
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock()
        mock_client_class.return_value = mock_client

        # Make the request
        response = client.post(
            "/api/get_transcription",
            files={"file": ("test.wav", valid_wav_content, "audio/wav")},
            data={"uniqueid": "1234567890.1234", "multichannel": "true"},
        )

        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert "transcript" in data
        assert data["transcript"] == "SPEAKER 1: Hello world"

    @patch('httpx.AsyncClient')
    def test_persists_raw_transcript_via_threadpool(self, mock_client_class, client, valid_wav_content):
        """Ensure persistence path uses threadpool helper and forwards kwargs to db layer."""

        # Mock the Deepgram API response
        mock_response = Mock()
        mock_response.json.return_value = {
            "results": {
                "paragraphs": {"transcript": "SPEAKER 1: Hello world"},
                "channels": [
                    {
                        "alternatives": [
                            {"transcript": "Hello world"}
                        ]
                    }
                ]
            }
        }
        mock_response.raise_for_status = Mock()

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock()
        mock_client_class.return_value = mock_client

        async def fake_run_in_threadpool(func, *args, **kwargs):
            return func(*args, **kwargs)

        with patch.dict(os.environ, {"OPENAI_API_KEY": ""}), \
             patch("api.db.is_configured", return_value=True), \
             patch("api.db.create_transcript_progress", return_value=123) as progress_mock, \
             patch("api.db.upsert_transcript_raw", return_value=123) as upsert_mock, \
             patch("api.db.set_transcript_state") as state_mock, \
             patch("api.run_in_threadpool", new=fake_run_in_threadpool):
            response = client.post(
                "/api/get_transcription",
                files={"file": ("test.wav", valid_wav_content, "audio/wav")},
                data={"uniqueid": "1234567890.1234", "persist": "true", "multichannel": "true"},
            )

        assert response.status_code == 200

        progress_mock.assert_called_once_with(
            uniqueid="1234567890.1234",
            linkedid=None,
            src_number=None,
            dst_number=None,
            duration_seconds=None,
        )
        upsert_mock.assert_called_once_with(
            transcript_id=123,
            uniqueid="1234567890.1234",
            linkedid=None,
            src_number=None,
            dst_number=None,
            duration_seconds=None,
            raw_transcription="SPEAKER 1: Hello world",
        )
        state_mock.assert_any_call(transcript_id=123, state="done")

    @patch('httpx.AsyncClient')
    def test_persists_duration_when_provided(self, mock_client_class, client, valid_wav_content):
        """The optional `duration` form field is parsed and forwarded to the db layer."""
        mock_response = Mock()
        mock_response.json.return_value = {
            "results": {
                "paragraphs": {"transcript": "SPEAKER 1: Hello world"},
                "channels": [{"alternatives": [{"transcript": "Hello world"}]}],
            }
        }
        mock_response.raise_for_status = Mock()

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock()
        mock_client_class.return_value = mock_client

        async def fake_run_in_threadpool(func, *args, **kwargs):
            return func(*args, **kwargs)

        with patch.dict(os.environ, {"OPENAI_API_KEY": ""}), \
             patch("api.db.is_configured", return_value=True), \
             patch("api.db.create_transcript_progress", return_value=123) as progress_mock, \
             patch("api.db.upsert_transcript_raw", return_value=123) as upsert_mock, \
             patch("api.db.set_transcript_state"), \
             patch("api.run_in_threadpool", new=fake_run_in_threadpool):
            response = client.post(
                "/api/get_transcription",
                files={"file": ("test.wav", valid_wav_content, "audio/wav")},
                data={"uniqueid": "1234567890.1234", "persist": "true", "duration": "24", "multichannel": "true"},
            )

        assert response.status_code == 200
        assert progress_mock.call_args.kwargs["duration_seconds"] == 24
        assert upsert_mock.call_args.kwargs["duration_seconds"] == 24

    @patch('httpx.AsyncClient')
    def test_persists_linkedid_when_provided(self, mock_client_class, client, valid_wav_content):
        mock_response = Mock()
        mock_response.json.return_value = {
            "results": {
                "paragraphs": {"transcript": "SPEAKER 1: Hello world"},
                "channels": [
                    {
                        "alternatives": [
                            {"transcript": "Hello world"}
                        ]
                    }
                ]
            }
        }
        mock_response.raise_for_status = Mock()

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock()
        mock_client_class.return_value = mock_client

        async def fake_run_in_threadpool(func, *args, **kwargs):
            return func(*args, **kwargs)

        with patch.dict(os.environ, {"OPENAI_API_KEY": ""}), \
             patch("api.db.is_configured", return_value=True), \
             patch("api.db.create_transcript_progress", return_value=123) as progress_mock, \
             patch("api.db.upsert_transcript_raw", return_value=123) as upsert_mock, \
             patch("api.db.set_transcript_state") as state_mock, \
             patch("api.run_in_threadpool", new=fake_run_in_threadpool):
            response = client.post(
                "/api/get_transcription",
                files={"file": ("test.wav", valid_wav_content, "audio/wav")},
                data={
                    "uniqueid": "1234567890.1234",
                    "linkedid": "1234567890.1000",
                    "persist": "true",
                    "multichannel": "true",
                },
            )

        assert response.status_code == 200

        progress_mock.assert_called_once_with(
            uniqueid="1234567890.1234",
            linkedid="1234567890.1000",
            src_number=None,
            dst_number=None,
            duration_seconds=None,
        )
        upsert_mock.assert_called_once_with(
            transcript_id=123,
            uniqueid="1234567890.1234",
            linkedid="1234567890.1000",
            src_number=None,
            dst_number=None,
            duration_seconds=None,
            raw_transcription="SPEAKER 1: Hello world",
        )
        state_mock.assert_any_call(transcript_id=123, state="done")

    @patch('httpx.AsyncClient')
    def test_persists_src_and_dst_numbers_when_provided(self, mock_client_class, client, valid_wav_content):
        mock_response = Mock()
        mock_response.json.return_value = {
            "results": {
                "paragraphs": {"transcript": "SPEAKER 1: Hello world"},
                "channels": [
                    {
                        "alternatives": [
                            {"transcript": "Hello world"}
                        ]
                    }
                ]
            }
        }
        mock_response.raise_for_status = Mock()

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock()
        mock_client_class.return_value = mock_client

        async def fake_run_in_threadpool(func, *args, **kwargs):
            return func(*args, **kwargs)

        with patch.dict(os.environ, {"OPENAI_API_KEY": ""}), \
             patch("api.db.is_configured", return_value=True), \
             patch("api.db.create_transcript_progress", return_value=123) as progress_mock, \
             patch("api.db.upsert_transcript_raw", return_value=123) as upsert_mock, \
             patch("api.db.set_transcript_state") as state_mock, \
             patch("api.run_in_threadpool", new=fake_run_in_threadpool):
            response = client.post(
                "/api/get_transcription",
                files={"file": ("test.wav", valid_wav_content, "audio/wav")},
                data={
                    "uniqueid": "1234567890.1234",
                    "src_number": "+390111111111",
                    "dst_number": "+390222222222",
                    "persist": "true",
                    "multichannel": "true",
                },
            )

        assert response.status_code == 200

        progress_mock.assert_called_once_with(
            uniqueid="1234567890.1234",
            linkedid=None,
            src_number="+390111111111",
            dst_number="+390222222222",
            duration_seconds=None,
        )
        upsert_mock.assert_called_once_with(
            transcript_id=123,
            uniqueid="1234567890.1234",
            linkedid=None,
            src_number="+390111111111",
            dst_number="+390222222222",
            duration_seconds=None,
            raw_transcription="SPEAKER 1: Hello world",
        )
        state_mock.assert_any_call(transcript_id=123, state="done")

    def test_invalid_file_type(self, client):
        """Test that non-WAV files are rejected."""
        response = client.post(
            "/api/get_transcription",
            files={"file": ("test.avi", b"fake audio data", "video/avi")}
        )

        assert response.status_code == 400
        assert "Invalid file type" in response.json()["detail"]

    @patch('httpx.AsyncClient')
    def test_deepgram_api_error(self, mock_client_class, client, valid_wav_content):
        """Test handling of Deepgram API errors."""
        # Mock an HTTP error from Deepgram
        mock_response = Mock()
        mock_response.status_code = 401
        mock_response.text = "Invalid API key"
        
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(
            side_effect=httpx.HTTPStatusError(
                "Unauthorized",
                request=Mock(),
                response=mock_response
            )
        )
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_class.return_value = mock_client

        response = client.post(
            "/api/get_transcription",
            files={"file": ("test.wav", valid_wav_content, "audio/wav")},
            data={"uniqueid": "1234567890.1234"},
        )

        assert response.status_code == 401
        assert "Deepgram API error" in response.json()["detail"]

    @patch('httpx.AsyncClient')
    def test_deepgram_timeout_returns_504(self, mock_client_class, client, valid_wav_content):
        """Test that Deepgram timeouts are mapped to 504 Gateway Timeout."""
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(
            side_effect=httpx.ReadTimeout("Timed out", request=Mock())
        )
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_class.return_value = mock_client

        response = client.post(
            "/api/get_transcription",
            files={"file": ("test.wav", valid_wav_content, "audio/wav")},
            data={"uniqueid": "1234567890.1234"},
        )

        assert response.status_code == 504
        assert "timed out" in response.json()["detail"].lower()

    @patch('httpx.AsyncClient')
    def test_malformed_deepgram_response(self, mock_client_class, client, valid_wav_content):
        """Test handling of malformed responses from Deepgram."""
        # Mock a response with missing fields
        mock_response = Mock()
        mock_response.json.return_value = {"results": {}}
        mock_response.raise_for_status = Mock()
        
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock()
        mock_client_class.return_value = mock_client

        response = client.post(
            "/api/get_transcription",
            files={"file": ("test.wav", valid_wav_content, "audio/wav")},
            data={"uniqueid": "1234567890.1234"},
        )

        assert response.status_code == 500
        assert "Failed to parse transcription response" in response.json()["detail"]

    @patch('httpx.AsyncClient')
    def test_silent_audio_marks_persisted_transcript_done_and_returns_200(self, mock_client_class, client, valid_wav_content):
        mock_response = Mock()
        mock_response.json.return_value = {
            "metadata": {"duration": 0.0, "channels": 0},
            "results": {"channels": []},
        }
        mock_response.raise_for_status = Mock()

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock()
        mock_client_class.return_value = mock_client

        async def fake_run_in_threadpool(func, *args, **kwargs):
            return func(*args, **kwargs)

        with patch("api.db.is_configured", return_value=True), \
             patch("api.db.create_transcript_progress", return_value=123) as progress_mock, \
             patch("api.db.set_transcript_state") as state_mock, \
             patch("api.run_in_threadpool", new=fake_run_in_threadpool):
            response = client.post(
                "/api/get_transcription",
                files={"file": ("test.wav", valid_wav_content, "audio/wav")},
                data={"uniqueid": "1234567890.1234", "persist": "true"},
            )

        assert response.status_code == 200
        assert response.json() == {"transcript": "", "detected_language": None}
        progress_mock.assert_called_once_with(
            uniqueid="1234567890.1234",
            linkedid=None,
            src_number=None,
            dst_number=None,
            duration_seconds=None,
        )
        state_mock.assert_called_once_with(transcript_id=123, state="done")

    @patch('httpx.AsyncClient')
    def test_missing_paragraphs_transcript_is_error(self, mock_client_class, client, valid_wav_content):
        """Diarized-only: missing paragraphs transcript returns 500."""
        # Mock response without paragraphs transcript
        mock_response = Mock()
        mock_response.json.return_value = {
            "results": {
                "channels": [
                    {
                        "alternatives": [
                            {"transcript": "Test transcript"}
                        ]
                    }
                ]
            }
        }
        mock_response.raise_for_status = Mock()
        
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock()
        mock_client_class.return_value = mock_client

        response = client.post(
            "/api/get_transcription",
            files={"file": ("test.wav", valid_wav_content, "audio/wav")},
            data={"uniqueid": "1234567890.1234"},
        )

        assert response.status_code == 500
        assert "Failed to parse transcription response" in response.json()["detail"]


class TestGetSpeech:
    """Tests for the /api/get_speech endpoint."""

    def test_get_models_returns_all_models(self, client):
        response = client.get("/api/get_models")

        assert response.status_code == 200
        data = response.json()
        assert "models" in data
        assert isinstance(data["models"], list)
        assert "aura-2-melia-it" in data["models"]

    def test_get_models_filters_by_language_suffix(self, client):
        response = client.get("/api/get_models", params={"language": "it"})

        assert response.status_code == 200
        models = response.json()["models"]
        assert models
        assert all(model.endswith("-it") for model in models)

    def test_get_models_auth_enabled_requires_token(self, client):
        with patch.dict(os.environ, {"API_TOKEN": "secret"}):
            response = client.get("/api/get_models")

        assert response.status_code == 401

    def test_get_models_auth_enabled_valid_token(self, client):
        with patch.dict(os.environ, {"API_TOKEN": "secret"}):
            response = client.get("/api/get_models", headers={"Authorization": "Bearer secret"})

        assert response.status_code == 200

    @pytest.mark.skipif(
        not (os.getenv("DEEPGRAM_API_KEY") or "").strip(),
        reason="DEEPGRAM_API_KEY is not set or empty",
    )
    def test_get_speech_and_transcription_roundtrip_italian(self, client, tmp_path):
        source_text = "questa è una prova"

        tts_response = client.post(
            "/api/get_speech",
            data={
                "text": source_text,
                "model": "aura-2-melia-it"
            },
        )

        assert tts_response.status_code == 200
        assert tts_response.content

        audio_file = tmp_path / "tts_roundtrip.mp3"
        audio_file.write_bytes(tts_response.content)

        with audio_file.open("rb") as audio_stream:
            stt_response = client.post(
                "/api/get_transcription",
                files={"file": ("tts_roundtrip.mp3", audio_stream, "audio/mpeg")},
                data={"language": "it"},
            )

        assert stt_response.status_code == 200
        transcript = stt_response.json().get("transcript", "")

        def normalize(text: str) -> str:
            return " ".join(
                text.lower()
                .replace(".", " ")
                .replace(",", " ")
                .replace("?", " ")
                .replace("!", " ")
                .replace(":", " ")
                .replace(";", " ")
                .replace("\n", " ")
                .split()
            )

        assert normalize(transcript) == normalize(source_text)

    @patch("api._concat_and_boost_mp3_ffmpeg", new_callable=AsyncMock, return_value=b"MP3DATA")
    @patch("api._tts_chunk_to_bytes_sync", return_value=b"MP3DATA")
    def test_get_speech_returns_mp3_and_filename(self, mock_tts, mock_ffmpeg, client):
        response = client.post("/api/get_speech", data={"text": "hello"})

        assert response.status_code == 200
        assert response.headers["content-type"].startswith("audio/mpeg")
        assert response.content == b"MP3DATA"
        assert "content-disposition" in response.headers
        assert "speech-" in response.headers["content-disposition"]

    @patch("api._concat_and_boost_mp3_ffmpeg", new_callable=AsyncMock, return_value=b"AAABBB")
    @patch("api._tts_chunk_to_bytes_sync", side_effect=[b"AAA", b"BBB"])
    def test_get_speech_splits_and_concatenates(self, mock_tts, mock_ffmpeg, client):
        # api.py uses a fixed 2000-char chunk size; use a 2001-char input to force 2 requests.
        response = client.post("/api/get_speech", data={"text": "a" * 2001})

        assert response.status_code == 200
        assert response.content == b"AAABBB"
        assert mock_tts.call_count == 2

    @patch("api._concat_and_boost_mp3_ffmpeg", new_callable=AsyncMock, return_value=b"MP3DATA")
    @patch("api._tts_chunk_to_bytes_sync", return_value=b"MP3DATA")
    def test_get_speech_ignores_unknown_params(self, mock_tts, mock_ffmpeg, client):
        response = client.post("/api/get_speech?unknown_param=1", data={"text": "hello"})

        assert response.status_code == 200

        _, options = mock_tts.call_args[0]
        options_dict = options.to_dict()
        assert "unknown_param" not in options_dict

    @patch("api._concat_and_boost_mp3_ffmpeg", new_callable=AsyncMock, return_value=b"MP3DATA")
    @patch("api._tts_chunk_to_bytes_sync", return_value=b"MP3DATA")
    def test_get_speech_uses_first_language_model_if_missing_model(self, mock_tts, mock_ffmpeg, client):
        from api import get_models

        response = client.post("/api/get_speech", data={"text": "hello", "language": "it"})

        assert response.status_code == 200
        _, options = mock_tts.call_args[0]
        assert options.model == get_models("it")[0]

    @patch("api._concat_and_boost_mp3_ffmpeg", new_callable=AsyncMock, return_value=b"MP3DATA")
    @patch("api._tts_chunk_to_bytes_sync", return_value=b"MP3DATA")
    def test_get_speech_explicit_model_takes_precedence_over_language(self, mock_tts, mock_ffmpeg, client):
        response = client.post(
            "/api/get_speech",
            data={"text": "hello", "language": "it", "model": "aura-2-elio-it"},
        )

        assert response.status_code == 200
        _, options = mock_tts.call_args[0]
        assert options.model == "aura-2-elio-it"

    def test_get_speech_language_without_available_model_returns_400(self, client):
        response = client.post("/api/get_speech", data={"text": "hello", "language": "zz"})

        assert response.status_code == 400
        assert "No TTS model available for language" in response.json()["detail"]

    def test_get_speech_rejects_non_mp3_encoding(self, client):
        response = client.post("/api/get_speech", data={"text": "hello", "encoding": "linear16"})
        assert response.status_code == 400
        assert "Only MP3 output is supported" in response.json()["detail"]

    def test_get_speech_rejects_non_mp3_container(self, client):
        response = client.post("/api/get_speech", data={"text": "hello", "container": "wav"})
        assert response.status_code == 400
        assert "Only MP3 output is supported" in response.json()["detail"]

    @patch("api._concat_and_boost_mp3_ffmpeg", new_callable=AsyncMock, return_value=b"MP3DATA")
    @patch("api._tts_chunk_to_bytes_sync", return_value=b"MP3DATA")
    def test_get_speech_ignores_container_mp3_for_deepgram(self, mock_tts, mock_ffmpeg, client):
        response = client.post("/api/get_speech", data={"text": "hello", "container": "mp3"})

        assert response.status_code == 200
        _, options = mock_tts.call_args[0]
        assert options.encoding == "mp3"
        assert not options.container

    def test_get_speech_missing_text_returns_400(self, client):
        response = client.post("/api/get_speech", data={})
        assert response.status_code == 400

    @patch("api._tts_chunk_to_bytes_sync", side_effect=httpx.ReadTimeout("Timed out", request=Mock()))
    def test_get_speech_deepgram_timeout_returns_504(self, mock_tts, client):
        response = client.post("/api/get_speech", data={"text": "hello"})
        assert response.status_code == 504

    @patch("api._tts_chunk_to_bytes_sync")
    def test_get_speech_deepgram_http_error_propagates_status(self, mock_tts, client):
        from deepgram.clients.common.v1.errors import DeepgramApiError

        mock_tts.side_effect = DeepgramApiError("Invalid API key", "401")

        response = client.post("/api/get_speech", data={"text": "hello"})
        assert response.status_code == 401
        assert "Deepgram API error" in response.json()["detail"]
