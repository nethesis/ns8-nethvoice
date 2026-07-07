from fastapi import APIRouter, Depends, FastAPI, HTTPException, UploadFile, File, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
import re
import uuid
import json
import httpx
import os
import logging
import subprocess
import sys
import shutil
import tempfile
from deepgram import DeepgramClient, SpeakOptions
from deepgram.clients.common.v1.errors import DeepgramApiError
from langchain_text_splitters import RecursiveCharacterTextSplitter


import db

app = FastAPI()
logger = logging.getLogger("api")

DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")  # Ensure this environment variable is set

DEEPGRAM_TTS_MODELS = [
    "aura-2-agathe-fr",
    "aura-2-agustina-es",
    "aura-2-alvaro-es",
    "aura-2-ama-ja",
    "aura-2-amalthea-en",
    "aura-2-andromeda-en",
    "aura-2-antonia-es",
    "aura-2-apollo-en",
    "aura-2-aquila-es",
    "aura-2-arcas-en",
    "aura-2-aries-en",
    "aura-2-asteria-en",
    "aura-2-athena-en",
    "aura-2-atlas-en",
    "aura-2-aurelia-de",
    "aura-2-aurora-en",
    "aura-2-beatrix-nl",
    "aura-2-callista-en",
    "aura-2-carina-es",
    "aura-2-celeste-es",
    "aura-2-cesare-it",
    "aura-2-cinzia-it",
    "aura-2-cora-en",
    "aura-2-cordelia-en",
    "aura-2-cornelia-nl",
    "aura-2-daphne-nl",
    "aura-2-delia-en",
    "aura-2-demetra-it",
    "aura-2-diana-es",
    "aura-2-dionisio-it",
    "aura-2-draco-en",
    "aura-2-ebisu-ja",
    "aura-2-elara-de",
    "aura-2-electra-en",
    "aura-2-elio-it",
    "aura-2-estrella-es",
    "aura-2-fabian-de",
    "aura-2-flavio-it",
    "aura-2-fujin-ja",
    "aura-2-gloria-es",
    "aura-2-harmonia-en",
    "aura-2-hector-fr",
    "aura-2-helena-en",
    "aura-2-hera-en",
    "aura-2-hermes-en",
    "aura-2-hestia-nl",
    "aura-2-hyperion-en",
    "aura-2-iris-en",
    "aura-2-izanami-ja",
    "aura-2-janus-en",
    "aura-2-javier-es",
    "aura-2-julius-de",
    "aura-2-juno-en",
    "aura-2-jupiter-en",
    "aura-2-kara-de",
    "aura-2-lara-de",
    "aura-2-lars-nl",
    "aura-2-leda-nl",
    "aura-2-livia-it",
    "aura-2-luciano-es",
    "aura-2-luna-en",
    "aura-2-maia-it",
    "aura-2-mars-en",
    "aura-2-melia-it",
    "aura-2-minerva-en",
    "aura-2-neptune-en",
    "aura-2-nestor-es",
    "aura-2-odysseus-en",
    "aura-2-olivia-es",
    "aura-2-ophelia-en",
    "aura-2-orion-en",
    "aura-2-orpheus-en",
    "aura-2-pandora-en",
    "aura-2-perseo-it",
    "aura-2-phoebe-en",
    "aura-2-pluto-en",
    "aura-2-rhea-nl",
    "aura-2-roman-nl",
    "aura-2-sander-nl",
    "aura-2-saturn-en",
    "aura-2-selena-es",
    "aura-2-selene-en",
    "aura-2-silvia-es",
    "aura-2-sirio-es",
    "aura-2-thalia-en",
    "aura-2-theia-en",
    "aura-2-uzume-ja",
    "aura-2-valerio-es",
    "aura-2-vesta-en",
    "aura-2-viktoria-de",
    "aura-2-zeus-en",
    "aura-angus-en",
    "aura-arcas-en",
    "aura-asteria-en",
    "aura-athena-en",
    "aura-helios-en",
    "aura-hera-en",
    "aura-luna-en",
    "aura-orion-en",
    "aura-orpheus-en",
    "aura-perseus-en",
    "aura-stella-en",
    "aura-zeus-en",
]

def _iter_bytes(data: bytes, *, chunk_size: int):
    for i in range(0, len(data), chunk_size):
        yield data[i : i + chunk_size]


def _concat_and_boost_mp3_ffmpeg_sync(chunks: list[bytes], gain: float) -> bytes:
    ffmpeg_path = shutil.which("ffmpeg")
    if not ffmpeg_path:
        raise RuntimeError("ffmpeg is not installed or not available in PATH")

    with tempfile.TemporaryDirectory(prefix="satellite-tts-", delete=False) as temp_dir:
        concat_file_path = os.path.join(temp_dir, "inputs.txt")
        output_path = os.path.join(temp_dir, "output.mp3")

        with open(concat_file_path, "w", encoding="utf-8") as concat_file:
            for index, chunk in enumerate(chunks, start=1):
                chunk_filename = f"chunk_{index:04d}.mp3"
                chunk_path = os.path.join(temp_dir, chunk_filename)
                with open(chunk_path, "wb") as chunk_file:
                    chunk_file.write(chunk)
                concat_file.write(f"file '{chunk_filename}'\n")

        proc = subprocess.run(
            [
                ffmpeg_path,
                "-hide_banner",
                "-loglevel",
                "error",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                "inputs.txt",
                "-filter:a",
                f"volume={gain}",
                "-y",
                "output.mp3",
            ],
            cwd=temp_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )

        if proc.returncode != 0:
            stderr_preview = (proc.stderr or b"")[:2000].decode("utf-8", errors="replace")
            raise RuntimeError(f"ffmpeg failed rc={proc.returncode} stderr={stderr_preview!r}")

        with open(output_path, "rb") as output_file:
            return output_file.read()


async def _concat_and_boost_mp3_ffmpeg(chunks: list[bytes], gain: float = 8.0) -> bytes:
    return await run_in_threadpool(_concat_and_boost_mp3_ffmpeg_sync, chunks, gain)


def _tts_chunk_to_bytes_sync(text: str, options: SpeakOptions) -> bytes:
    """Synthesize a single text chunk via Deepgram SDK and return audio bytes."""
    deepgram = DeepgramClient(DEEPGRAM_API_KEY)
    timeout = httpx.Timeout(connect=10.0, read=300.0, write=300.0, pool=10.0)
    response = deepgram.speak.rest.v("1").stream_memory(
        {"text": text}, options, timeout=timeout
    )
    return response.stream_memory.read()


def _require_api_token_if_configured(request: Request) -> None:
    configured_token = (os.getenv("API_TOKEN") or "").strip()
    if not configured_token:
        return

    provided_token = None

    auth = (request.headers.get("authorization") or "").strip()
    if auth.lower().startswith("bearer "):
        provided_token = auth[7:].strip()

    if not provided_token:
        provided_token = (request.headers.get("x-api-token") or "").strip() or None

    if not provided_token or provided_token != configured_token:
        raise HTTPException(
            status_code=401,
            detail="Unauthorized",
            headers={"WWW-Authenticate": "Bearer"},
        )


api_router = APIRouter(
    prefix="/api",
    dependencies=[Depends(_require_api_token_if_configured)],
)

def _run_call_processor(
    *,
    transcript_id: int,
    raw_transcription: str,
    summary: bool = False,
) -> None:
    payload = {"transcript_id": transcript_id, "raw_transcription": raw_transcription, "summary": summary}
    proc = subprocess.run(
        [sys.executable, os.path.join(os.path.dirname(__file__), "call_processor.py")],
        input=json.dumps(payload).encode("utf-8"),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=float(os.getenv("CALL_PROCESSOR_TIMEOUT_SECONDS", "600")),
    )

    # The subprocess logs (including ai pipeline logs) go to stderr by default.
    # Since we're capturing stderr, re-log it here so it shows up in the API logs
    # even when the subprocess succeeds.
    stderr_text = (proc.stderr or b"").decode("utf-8", errors="replace")
    if stderr_text.strip():
        lines = stderr_text.splitlines()
        max_lines = int(os.getenv("CALL_PROCESSOR_LOG_MAX_LINES", "200"))
        if len(lines) > max_lines:
            lines = lines[:max_lines] + [f"... (truncated; {len(stderr_text)} bytes total)"]
        for line in lines:
            if line.strip():
                logger.info("call_processor[%s]: %s", transcript_id, line)

    if proc.returncode != 0:
        stderr_preview = (proc.stderr or b"")[:2000].decode("utf-8", errors="replace")
        stdout_preview = (proc.stdout or b"")[:2000].decode("utf-8", errors="replace")
        raise RuntimeError(f"call_processor failed rc={proc.returncode} stdout={stdout_preview!r} stderr={stderr_preview!r}")


def get_models(language: str | None = None) -> list[str]:
    models = DEEPGRAM_TTS_MODELS
    normalized_language = (language or "").strip().lower()
    if not normalized_language:
        return models
    language_suffix = f"-{normalized_language}"
    return [model for model in models if model.lower().endswith(language_suffix)]


@api_router.get("/get_models")
async def get_models_endpoint(language: str | None = None):
    return {"models": get_models(language)}


@api_router.post("/get_speech")
async def get_speech(request: Request):
    # Collect parameters from query string and multipart/x-www-form-urlencoded form fields
    try:
        form = await request.form()
    except Exception:
        form = {}

    form_params = {}
    if hasattr(form, "items"):
        for k, v in form.items():
            form_params[k] = v if isinstance(v, str) else str(v)

    input_params = {**dict(request.query_params), **form_params}
    logger.debug("Params: %s", input_params)

    text = (input_params.get("text") or input_params.get("input") or "").strip()
    language = (input_params.get("language") or "").strip().lower()
    if not text:
        raise HTTPException(status_code=400, detail="Missing required field: text")

    # Enforce MP3 output format
    encoding = (input_params.get("encoding") or "").strip().lower()
    container = (input_params.get("container") or "").strip().lower()
    if encoding and encoding != "mp3":
        raise HTTPException(status_code=400, detail="Only MP3 output is supported")
    if container and container != "mp3":
        raise HTTPException(status_code=400, detail="Only MP3 output is supported")

    # use langchain text splitter to split text into smaller chunks
    # Deepgram TTS can handle 2000 characters per request https://developers.deepgram.com/docs/text-to-speech#input-text-limit
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=2000,
        chunk_overlap=0,
        separators=["\n\n", "\n", ".", "?", "!", " ", ""],
    )
    chunks = [c.strip() for c in splitter.split_text(text or "")]
    if not chunks:
        raise HTTPException(status_code=400, detail="Text is empty")

    if not input_params.get("model") and language:
        models = get_models(language)
        if not models:
            raise HTTPException(status_code=400, detail=f"No TTS model available for language: {language}")
        input_params["model"] = models[0]

    # Build SpeakOptions with valid TTS parameters
    speak_kwargs = {}
    if input_params.get("model"):
        speak_kwargs["model"] = input_params["model"]
    if input_params.get("sample_rate"):
        speak_kwargs["sample_rate"] = int(input_params["sample_rate"])
    if input_params.get("bit_rate"):
        speak_kwargs["bit_rate"] = int(input_params["bit_rate"])
    speak_kwargs["encoding"] = "mp3"

    options = SpeakOptions(**speak_kwargs)
    logger.debug("Deepgram TTS options: %s", speak_kwargs)

    audio_parts: list[bytes] = []
    try:
        for idx, chunk in enumerate(chunks, start=1):
            audio_data = await run_in_threadpool(
                _tts_chunk_to_bytes_sync, chunk, options
            )
            logger.debug(
                "Deepgram TTS response: chunk=%s/%s bytes=%s",
                idx, len(chunks), len(audio_data),
            )
            audio_parts.append(audio_data)
    except DeepgramApiError as e:
        status = int(e.status) if e.status else 502
        logger.error("Deepgram TTS API error: status=%s message=%s", e.status, e.message)
        raise HTTPException(
            status_code=status,
            detail=f"Deepgram API error: {e.message}",
        )
    except httpx.TimeoutException:
        logger.warning("Deepgram TTS request timed out")
        raise HTTPException(status_code=504, detail="Deepgram request timed out")
    except httpx.RequestError as e:
        logger.error("Deepgram TTS request failed: %s", str(e))
        raise HTTPException(status_code=502, detail="Failed to reach Deepgram")
    except Exception as e:
        logger.exception("Unexpected error while calling Deepgram TTS")
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

    try:
        audio_bytes = await _concat_and_boost_mp3_ffmpeg(audio_parts, gain=8.0)
    except Exception as e:
        logger.exception("Failed to post-process TTS audio with ffmpeg")
        raise HTTPException(status_code=500, detail=f"Failed to post-process audio: {str(e)}")

    if not audio_bytes:
        raise HTTPException(status_code=500, detail="Deepgram returned empty audio")

    filename = f"speech-{uuid.uuid4().hex}.mp3"
    headers_out = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
    }
    return StreamingResponse(
        _iter_bytes(audio_bytes, chunk_size=65536),
        media_type="audio/mpeg",
        headers=headers_out,
    )

@api_router.post('/get_transcription')
async def get_transcription(
    request: Request,
    file: UploadFile = File(...)
):
    if file.content_type not in ("audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp3"):
        logger.warning("Unsupported file type: %s", file.content_type)
        raise HTTPException(status_code=400, detail="Invalid file type. Only WAV files are supported.")

    audio_bytes = await file.read()

    # Collect parameters from query string and multipart form fields (excluding the file)
    try:
        form = await request.form()
    except Exception:
        form = {}

    form_params = {}
    if hasattr(form, "items"):
        for k, v in form.items():
            if k == "file":
                continue
            form_params[k] = v if isinstance(v, str) else str(v)

    input_params = {**dict(request.query_params), **form_params}

    logger.debug(f"Params: {input_params}")

    uniqueid = (input_params.get("uniqueid") or "").strip()
    linkedid = (input_params.get("linkedid") or "").strip() or None
    src_number = (input_params.get("src_number") or "").strip() or None
    dst_number = (input_params.get("dst_number") or "").strip() or None
    duration_raw = (input_params.get("duration") or "").strip()
    try:
        duration_seconds = int(duration_raw) if duration_raw else None
        if duration_seconds is not None and duration_seconds < 0:
            duration_seconds = None
    except ValueError:
        duration_seconds = None
    channel0_name = (input_params.get("channel0_name") or "").strip()
    channel1_name = (input_params.get("channel1_name") or "").strip()
    # Persist only when explicitly requested.
    persist = (input_params.get("persist") or "false").lower() in ("1", "true", "yes")
    summary = (input_params.get("summary") or "false").lower() in ("1", "true", "yes")

    # uniqueid is only required when persistence is enabled.
    if persist:
        try:
            db.validate_uniqueid(uniqueid)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    transcript_id = None
    if db.is_configured() and persist:
        # Create a DB row immediately so we can track state even if Deepgram fails.
        try:
            transcript_id = await run_in_threadpool(
                db.create_transcript_progress,
                uniqueid=uniqueid,
                linkedid=linkedid,
                src_number=src_number,
                dst_number=dst_number,
                duration_seconds=duration_seconds,
            )
        except Exception:
            logger.exception("Failed to initialize transcript row for state tracking")
            raise HTTPException(status_code=500, detail="Failed to initialize transcript persistence")

    # Valid Deepgram REST API parameters for /v1/listen endpoint
    deepgram_params = {
        "callback": "",
        "callback_method": "",
        "custom_topic": "",
        "custom_topic_mode": "",
        "custom_intent": "",
        "custom_intent_mode": "",
        "detect_entities": "",
        "detect_language": "true",
        "diarize": "",
        "dictation": "",
        "encoding": "",
        "extra": "",
        "filler_words": "",
        "intents": "",
        "keyterm": "",
        "keywords": "",
        "language": "",
        "measurements": "",
        "mip_opt_out": "", # Opts out requests from the Deepgram Model Improvement Program
        "model": "nova-3",
        "multichannel": "",
        "numerals": "true",
        "paragraphs": "true",
        "profanity_filter": "",
        "punctuate": "true",
        "redact": "",
        "replace": "",
        "search": "",
        "sentiment": "false",
        "smart_format": "true",
        "summarize": "",
        "tag": "",
        "topics": "",
        "utterances": "",
        "utt_split": "",
        "version": "",
    }

    headers = {
        "Authorization": f"Token {DEEPGRAM_API_KEY}",
        "Content-Type": file.content_type
    }

    params = {}
    for k, v in deepgram_params.items():
        if k in input_params and input_params[k].strip():
            params[k] = input_params[k]
        elif v.strip():
            params[k] = v

    try:
        deepgram_timeout_seconds = 300.0
        timeout = httpx.Timeout(
            connect=10.0,
            read=deepgram_timeout_seconds,
            write=deepgram_timeout_seconds,
            pool=10.0,
        )
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                "https://api.deepgram.com/v1/listen",
                headers=headers,
                params=params,
                content=audio_bytes,
            )
            # Debug: log response meta and preview
            try:
                logger.debug(
                    "Deepgram response: status=%s content_type=%s body_preview=%s",
                    response.status_code,
                    response.headers.get("Content-Type"),
                    (response.text[:500] if response is not None and hasattr(response, "text") and response.text else ""),
                )
            except Exception:
                logger.debug("Failed to log Deepgram response preview")
            response.raise_for_status()
    except httpx.HTTPStatusError as e:
        if transcript_id is not None:
            try:
                await run_in_threadpool(db.set_transcript_state, transcript_id=transcript_id, state="failed")
            except Exception:
                logger.exception("Failed to update transcript state=failed")
        try:
            status = e.response.status_code if e.response is not None else "unknown"
            body_preview = e.response.text[:500] if e.response is not None and hasattr(e.response, "text") and e.response.text else ""
            logger.error("Deepgram API error: status=%s body_preview=%s", status, body_preview)
        except Exception:
            logger.error("Deepgram API error (logging failed)")
        raise HTTPException(status_code=e.response.status_code, detail=f"Deepgram API error: {e.response.text}")
    except httpx.TimeoutException:
        logger.warning("Deepgram request timed out (uniqueid=%s)", uniqueid)
        if transcript_id is not None:
            try:
                await run_in_threadpool(db.set_transcript_state, transcript_id=transcript_id, state="failed")
            except Exception:
                logger.exception("Failed to update transcript state=failed")
        raise HTTPException(status_code=504, detail="Deepgram request timed out")
    except httpx.RequestError as e:
        logger.error("Deepgram request failed (uniqueid=%s): %s", uniqueid, str(e))
        if transcript_id is not None:
            try:
                await run_in_threadpool(db.set_transcript_state, transcript_id=transcript_id, state="failed")
            except Exception:
                logger.exception("Failed to update transcript state=failed")
        raise HTTPException(status_code=502, detail="Failed to reach Deepgram")
    except Exception as e:
        logger.exception("Unexpected error while calling Deepgram")
        if transcript_id is not None:
            try:
                await run_in_threadpool(db.set_transcript_state, transcript_id=transcript_id, state="failed")
            except Exception:
                logger.exception("Failed to update transcript state=failed")
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

    result = response.json()
    detected_language = None  # always define; mocks may omit this field
    results = result.get("results", {})
    metadata = result.get("metadata", {})
    channels = results.get("channels")
    if channels is not None and not channels:
        duration = metadata.get("duration", 0.0)
        paragraphs = results.get("paragraphs")
        paragraphs_transcript = paragraphs.get("transcript") if isinstance(paragraphs, dict) else None
        if duration == 0.0 and (
            paragraphs_transcript is None
            or (isinstance(paragraphs_transcript, str) and paragraphs_transcript.strip() == "")
        ):
            logger.warning(
                "Deepgram returned explicit empty transcription (duration=%.1f, uniqueid=%s); skipping empty audio",
                duration,
                uniqueid,
            )
            if transcript_id is not None:
                try:
                    await run_in_threadpool(db.set_transcript_state, transcript_id=transcript_id, state="done")
                except Exception:
                    logger.exception("Failed to update transcript state=done after empty audio")
            return {"transcript": "", "detected_language": None}

        logger.error(
            "Deepgram returned empty channels without explicit empty-audio indicators "
            "(duration=%s, uniqueid=%s); treating response as invalid",
            duration,
            uniqueid,
        )
        if transcript_id is not None:
            try:
                await run_in_threadpool(db.set_transcript_state, transcript_id=transcript_id, state="failed")
            except Exception:
                logger.exception("Failed to update transcript state=failed after invalid empty channels response")
        raise HTTPException(status_code=502, detail="Invalid Deepgram response")
    try:
        if "paragraphs" in result["results"] and "transcript" in result["results"]["paragraphs"]:
            raw_transcription = result["results"]["paragraphs"]["transcript"].strip()
        elif (
            "channels" in result["results"]
            and result["results"]["channels"]
            and "alternatives" in result["results"]["channels"][0]
            and result["results"]["channels"][0]["alternatives"]
            and "paragraphs" in result["results"]["channels"][0]["alternatives"][0]
            and "transcript" in result["results"]["channels"][0]["alternatives"][0]["paragraphs"]
        ):
            raw_transcription = (
                result["results"]["channels"][0]["alternatives"][0]["paragraphs"]["transcript"].strip()
            )
        else:
            logger.debug("failed to get paragraphs transcript")
            logger.debug(result)
            raise KeyError("paragraphs transcript not found")
        if "channels" in result["results"] and "detected_language" in result["results"]["channels"][0]:
            detected_language = result["results"]["channels"][0]["detected_language"]
        else:
            logger.debug("failed to get detected_language")
            logger.debug(result)
        if channel0_name:
            raw_transcription = raw_transcription.replace("Channel 0:", f"{channel0_name}:")
        if channel1_name:
            raw_transcription = raw_transcription.replace("Channel 1:", f"{channel1_name}:")
    except (KeyError, IndexError):
        logger.error("Failed to parse Deepgram transcription response: %s", response.text)
        if transcript_id is not None:
            try:
                await run_in_threadpool(db.set_transcript_state, transcript_id=transcript_id, state="failed")
            except Exception:
                logger.exception("Failed to update transcript state=failed")
        raise HTTPException(status_code=500, detail="Failed to parse transcription response.")

    # Persist raw transcript when Postgres config is present (default) unless disabled per request.
    if transcript_id is not None:
        try:
            transcript_id = await run_in_threadpool(
                db.upsert_transcript_raw,
                transcript_id=transcript_id,
                uniqueid=uniqueid,
                linkedid=linkedid,
                src_number=src_number,
                dst_number=dst_number,
                duration_seconds=duration_seconds,
                raw_transcription=raw_transcription,
            )
        except ValueError as e:
            logger.exception("Invalid uniqueid for Postgres persistence")
            try:
                await run_in_threadpool(db.set_transcript_state, transcript_id=transcript_id, state="failed")
            except Exception:
                logger.exception("Failed to update transcript state=failed")
            raise HTTPException(status_code=400, detail=str(e))
        except Exception:
            logger.exception("Failed to persist raw transcript to Postgres")
            try:
                await run_in_threadpool(db.set_transcript_state, transcript_id=transcript_id, state="failed")
            except Exception:
                logger.exception("Failed to update transcript state=failed")
            raise HTTPException(status_code=500, detail="Failed to persist transcription")
    else:
        if not db.is_configured():
            logger.warning("PGVECTOR_* env vars not set; skipping Postgres persistence")
        else:
            logger.debug("Postgres persistence disabled by request")

    # Optional AI enrichment (clean/summary/sentiment) via per-request subprocess
    did_enrichment = False
    if os.getenv("OPENAI_API_KEY") and transcript_id is not None and raw_transcription:
        try:
            did_enrichment = True
            await run_in_threadpool(db.set_transcript_state, transcript_id=transcript_id, state="summarizing")
            await run_in_threadpool(
                _run_call_processor,
                transcript_id=transcript_id,
                raw_transcription=raw_transcription,
                summary=summary,
            )
            await run_in_threadpool(db.set_transcript_state, transcript_id=transcript_id, state="done")
        except Exception:
            logger.exception("Failed to process call transcript")
            try:
                await run_in_threadpool(db.set_transcript_state, transcript_id=transcript_id, state="failed")
            except Exception:
                logger.exception("Failed to update transcript state=failed")

    # If we persisted but didn't run enrichment, the pipeline is complete after raw transcript is stored.
    if transcript_id is not None and not did_enrichment:
        try:
            await run_in_threadpool(db.set_transcript_state, transcript_id=transcript_id, state="done")
        except Exception:
            logger.exception("Failed to update transcript state=done")

    return {"transcript": raw_transcription, "detected_language": detected_language}


app.include_router(api_router)
