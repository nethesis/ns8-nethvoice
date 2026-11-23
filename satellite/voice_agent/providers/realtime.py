"""OpenAI Realtime and Grok SIP sideband transports.

Only provider protocol details live here; call admission and tool policy belong
to the Agent runtime. See the providers' SIP and speech-to-speech documentation.
"""

import asyncio
import copy
import json
import os
import re
import time
from collections import OrderedDict
from collections.abc import AsyncIterator, Mapping
from urllib.parse import quote, urlencode

from ..telemetry import PROVIDER_CODES

import aiohttp


class ProviderError(RuntimeError):
    """Safe provider failure suitable for a bounded readiness/error event."""


def _call_id(value: str) -> str:
    if not isinstance(value, str) or not value or len(value) > 256 or any(ord(c) < 33 for c in value):
        raise ValueError("invalid provider call ID")
    return value


def _profile_value(profile: Mapping, key: str, default):
    value = profile.get(key)
    return value if value is not None and (not isinstance(value, str) or value.strip()) else default


def _instructions(profile: Mapping) -> str:
    prompt = _profile_value(profile, "prompt", "")
    language = _profile_value(profile, "language", "")
    if language and language.lower() not in ("auto", "automatic"):
        return f"{prompt}\n\nDefault response language: {language}. Switch language when the caller explicitly asks or makes a substantive request in another language. Do not infer language from accent, a name or a short greeting.".strip()
    return prompt


def _tools(tools) -> list[dict]:
    result = []
    for tool in tools or []:
        if isinstance(tool, dict):
            if tool.get("type") == "function":
                # The runtime validates arguments itself. Provider schemas only
                # advertise the tool; xAI does not document a strict flag.
                result.append({key: tool[key] for key in ("type", "name", "description", "parameters")
                               if key in tool})
                continue
            result.append({"type": "function", "name": tool["wire_name"],
                           "description": tool.get("description", ""),
                           "parameters": tool["input_schema"]})
        else:
            result.append({"type": "function", "name": tool.wire_name,
                           "description": tool.description,
                           "parameters": tool.input_schema})
    return result


def _openai_realtime_tools(tools) -> list[dict]:
    """Project one known immutable manifest into Realtime's schema dialect.

    This is model guidance, not authorization. Satellite still requires exactly
    one destination/callback reference and validates its call-bound permissions.
    Live Responses and Grok retain the runtime's one-of constraint.
    """
    result = copy.deepcopy(_tools(tools))
    for tool in result:
        if tool.get('name') not in ('nv_pbx_transfer_v2', 'nv_pbx_transfer_v3'):
            continue
        from ..tools import SUPPORTED
        canonical = SUPPORTED[('pbx.transfer', 3 if tool['name'].endswith('_v3') else 2)]['input_schema']
        restricted = copy.deepcopy(canonical)
        restricted['properties']['destination_id']['pattern'] = r'^(extension|queue):[0-9]{1,20}$(?![\s\S])'
        if tool.get('parameters') not in (canonical, restricted):
            raise ValueError('unsupported_realtime_tool_schema')
        tool['parameters'] = restricted
        tool['parameters'].pop('oneOf')
        tool['description'] += ' Supply exactly one of destination_id or candidate_ref, never both.'
    return result


class _RealtimeAdapter:
    http_base: str
    ws_base: str
    provider: str

    def __init__(self, binding: Mapping, *, session: aiohttp.ClientSession | None = None):
        self._api_key = binding.get("api_key")
        if not isinstance(self._api_key, str) or not self._api_key:
            raise ValueError("missing provider API key")
        self._session = session
        self._owns_session = session is None
        self._ws = None
        self._reader_task = None
        self._queue: asyncio.Queue[dict | None] = asyncio.Queue(maxsize=256)
        self._observation_queue = asyncio.Queue(maxsize=64)
        self._event_ready = asyncio.Event()
        self._condition = asyncio.Condition()
        self._pending: set[str] = set()
        self._seen_calls: set[str] = set()
        self._response_done = True
        self._audio_playing = False
        self._response_id = "response-0"
        self._response_generation = 0
        self._done_responses: set[str] = set()
        self._continuations: set[str] = set()
        self._closed = False
        self._respond_lock = asyncio.Lock()
        self._call = None
        self._profile = None
        self._tools_config = []
        self._ready = asyncio.Event()
        self._session_configured = False
        self._capture = False
        self._items = OrderedDict()
        self._item_sequence = 0
        self._interrupted = set()
        self._last_assistant_item = None
        self._optional_updates = set()
        self._observations_dropped = False
        self._usage_responses = set()

    async def _client(self) -> aiohttp.ClientSession:
        if self._session is None:
            self._session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=15))
        return self._session

    @property
    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._api_key}"}

    async def _post(self, url: str, body: dict | None = None) -> None:
        try:
            client = await self._client()
            async with client.post(url, headers=self._headers, json=body, allow_redirects=False) as response:
                if not 200 <= response.status < 300:
                    error=ProviderError(f"{self.provider} call control failed ({response.status})")
                    error.http_status=response.status
                    error.provider_code='other'
                    error.provider_param='other'
                    # Retain only known schema field names and error categories.
                    # Upstream messages may echo prompts or secrets: never retain them.
                    if getattr(response,'content',None) is not None:
                        try:
                            raw=await response.content.read(8193)
                            detail=json.loads(raw).get('error',{}) if len(raw)<=8192 else {}
                            parameters={'session.'+name for name in ['type','model','store','instructions','audio','audio.output','audio.output.voice','delegation','delegation.type','delegation.responses','delegation.responses.model','delegation.responses.instructions','delegation.responses.tools','delegation.responses.tool_choice','delegation.responses.parallel_tool_calls','delegation.responses.reasoning','delegation.responses.reasoning.effort','delegation.responses.text','delegation.responses.text.verbosity','delegation.responses.service_tier','delegation.responses.max_output_tokens']}
                            if detail.get('param') in parameters:error.provider_param=detail['param']
                            if detail.get('code') in {'invalid_value','unknown_parameter','unsupported_value','invalid_request_error','invalid_function_parameters','model_not_found','invalid_api_key','insufficient_quota','invalid_session_id','decision_already_made','unsupported_parameter','invalid_model','model_not_supported'}:error.provider_code=detail['code']
                            words=set(re.findall(r'[a-z_]+',str(detail.get('message','')).lower()))
                            if {'live','sip','srtp'} <= words and words & {'require','requires'}:
                                error.provider_code='srtp_required'
                        except (ValueError,TypeError,AttributeError,aiohttp.ClientError):
                            pass
                    raise error
        except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
            error = ProviderError(f"{self.provider} call control unavailable")
            error.category = 'timeout' if isinstance(exc, asyncio.TimeoutError) else 'transport'
            raise error from None

    async def _connect(self, call_id: str) -> None:
        try:
            client = await self._client()
            self._ws = await client.ws_connect(
                self.ws_base + "?" + urlencode({"call_id": call_id}),
                headers=self._headers, heartbeat=20,
            )
        except aiohttp.WSServerHandshakeError as exc:
            error = ProviderError('provider sideband handshake rejected')
            error.http_status = exc.status
            raise error from None
        except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
            error = ProviderError(f"{self.provider} sideband unavailable")
            error.category = 'timeout' if isinstance(exc, asyncio.TimeoutError) else 'transport'
            raise error from None
        self._reader_task = asyncio.create_task(self._read_events())

    async def _send(self, event: dict) -> None:
        if self._ws is None or self._ws.closed:
            raise ProviderError(f"{self.provider} sideband closed")
        await self._ws.send_json(event)

    async def send_result(self, invocation_id: str, result) -> None:
        if not isinstance(invocation_id, str) or not invocation_id:
            raise ValueError("invalid invocation ID")
        output = result if isinstance(result, str) else json.dumps(result, ensure_ascii=False)
        await self._send({"type": "conversation.item.create", "item": {
            "type": "function_call_output", "call_id": invocation_id, "output": output,
        }})
        async with self._condition:
            self._pending.discard(invocation_id)
            self._condition.notify_all()

    async def respond(self, instructions: str | None = None, *,
                      response_id: str | None = None) -> None:
        # Claim a particular completed response before waiting. Parallel tool
        # results cannot issue another continuation after response.created has
        # advanced the session to the next generation.
        token = response_id if isinstance(response_id, str) and response_id else "greeting"
        async with self._condition:
            if token in self._continuations:
                return
            if len(self._continuations) >= 4096:
                raise ProviderError(f"{self.provider} response capacity exceeded")
            self._continuations.add(token)
        async with self._respond_lock:
            async with self._condition:
                await self._condition.wait_for(lambda: self._closed or (
                    not self._pending and not self._audio_playing and self._response_done and
                    (token == "greeting" or token in self._done_responses)))
                if self._closed:
                    raise ProviderError(f"{self.provider} sideband closed")
            event = {"type": "response.create"}
            if instructions is not None:
                event["response"] = {"instructions": instructions}
            await self._send(event)

    def drain_observations(self):
        result = []
        while not self._observation_queue.empty():
            event = self._observation_queue.get_nowait()
            if event.get('type') in ('usage', 'monitoring_gap', 'response_started'):
                result.append(event)
        while not self._queue.empty():
            event = self._queue.get_nowait()
            if isinstance(event,dict) and event.get('type') in ('audio_started','response_done','monitoring_gap'):
                result.append(event)
        return result

    async def events(self) -> AsyncIterator[dict]:
        while True:
            if not self._queue.empty():
                event = self._queue.get_nowait()
                if event is None:
                    return
                yield event
            elif not self._observation_queue.empty():
                yield self._observation_queue.get_nowait()
            else:
                self._event_ready.clear()
                await self._event_ready.wait()

    async def workflow_input(self, inputs):
        # Caller speech and connector outputs remain conversation data.
        await self._send({"type": "conversation.item.create", "item": {
            "type": "message", "role": "user", "content": [{
                "type": "input_text", "text": "Workflow step data:\n" + json.dumps(inputs, ensure_ascii=False)
            }]
        }})

    async def consultation_say(self, instructions, data=None, *, response_id=None):
        if data is not None:
            await self.workflow_input(data)
        await self.workflow_respond(instructions, wait=True)

    async def workflow_update(self, instructions, tools, *, auto_response=True):
        """Change the current workflow step without changing the voice/model."""
        async with self._respond_lock:
            async with self._condition:
                await self._condition.wait_for(lambda: self._closed or (
                    self._response_done and not self._audio_playing and not self._pending))
                if self._closed:
                    raise ProviderError("workflow sideband closed")
            self._ready.clear()
            session = {"instructions": instructions, "tools": _tools(tools)}
            if self.provider == "openai":
                session.update({"type": "realtime", "audio": {"input": {"turn_detection": {
                    "type": "server_vad", "silence_duration_ms": 1000,
                    "create_response": auto_response, "interrupt_response": auto_response}}}})
            else:
                session["turn_detection"] = {"type": "server_vad"} if auto_response else None
            await self._send({"type": "session.update", "session": session})
            await asyncio.wait_for(self._ready.wait(), 10)
            if self._closed:
                raise ProviderError("workflow session update failed")

    async def workflow_respond(self, instructions=None, *, wait=False):
        """A new explicit response, independently of tool continuation tokens."""
        async with self._respond_lock:
            async with self._condition:
                await self._condition.wait_for(lambda: self._closed or (
                    self._response_done and not self._audio_playing and not self._pending))
                if self._closed:
                    raise ProviderError("workflow sideband closed")
                self._response_done = False
            value = {"type": "response.create"}
            if instructions is not None:
                value["response"] = {"instructions": instructions}
            await self._send(value)
        if wait:
            async with self._condition:
                await self._condition.wait_for(lambda: self._closed or (
                    self._response_done and not self._audio_playing and not self._pending))
                if self._closed:
                    raise ProviderError("workflow response interrupted")


    async def _emit(self, event: dict) -> None:
        if event.get('type') in ('audio_started','response_done'):
            event['_observed_at'] = time.monotonic()
        # A stalled consumer must not force unbounded memory growth.
        try:
            self._queue.put_nowait(event)
            self._event_ready.set()
        except asyncio.QueueFull:
            raise ProviderError(f"{self.provider} event queue full")

    async def _read_events(self) -> None:
        try:
            async for message in self._ws:
                if message.type != aiohttp.WSMsgType.TEXT:
                    if message.type in (aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.ERROR):
                        break
                    continue
                try:
                    raw = json.loads(message.data)
                except json.JSONDecodeError:
                    raise ProviderError(f"{self.provider} invalid event")
                if not isinstance(raw, dict):
                    continue
                await self._handle(raw)
        except Exception:
            try:
                await self._emit({"type": "error", "code": "provider_sideband_error"})
            except ProviderError:
                pass
        finally:
            self._ready.set()
            async with self._condition:
                self._closed = True
                self._response_done = True
                self._audio_playing = False
                self._pending.clear()
                self._condition.notify_all()
            # Pending observations are drained by Runtime.finish; their presence
            # does not mean they were lost. Reserve terminal slots and report a
            # gap only when an observation/event really had to be discarded.
            lost = self._observations_dropped
            while self._queue.qsize() > self._queue.maxsize - 3:
                self._queue.get_nowait()
                lost = True
            if lost:
                self._queue.put_nowait({"type": "monitoring_gap"})
            self._queue.put_nowait({"type": "closed"})
            self._queue.put_nowait(None)
            self._event_ready.set()

    async def _observation(self, value):
        if value.get('type') == 'response_started':
            value['_observed_at'] = time.monotonic()
        # Optional observations have a separate bounded queue. Tool and voice
        # lifecycle events never compete with transcript buffers.
        if self._observation_queue.full():
            self._observations_dropped = True
            return
        if self._observations_dropped:
            self._observation_queue.put_nowait({"type": "monitoring_gap"})
            self._observations_dropped = False
            if self._observation_queue.full():
                self._observations_dropped = True
                self._event_ready.set()
                return
        self._observation_queue.put_nowait(value)
        self._event_ready.set()

    def _position(self, item_id):
        if item_id not in self._items:
            self._item_sequence += 1
            self._items[item_id] = self._item_sequence
            if len(self._items) > 2048:
                oldest, _ = self._items.popitem(last=False)
                self._interrupted.discard(oldest)
        return self._items[item_id]

    async def set_capture(self, enabled):
        self._capture = bool(enabled and self.provider == "openai")
        if not self._capture:
            retained=[]
            while not self._observation_queue.empty():
                value=self._observation_queue.get_nowait()
                if value.get("type") not in ("transcript","transcript_interrupted"):
                    retained.append(value)
            for value in retained:
                self._observation_queue.put_nowait(value)
        if self.provider != "openai" or self._ws is None or self._ws.closed:
            return
        if len(self._optional_updates)>=8:
            self._capture=False
            return
        update_id = "monitoring-" + str(len(self._optional_updates))
        self._optional_updates.add(update_id)
        try:
            await self._send({"event_id": update_id, "type": "session.update", "session": {
                "type": "realtime", "audio": {"input": {"transcription": {
                    "model": os.getenv("SATELLITE_MONITORING_TRANSCRIPTION_MODEL", "gpt-4o-mini-transcribe")
                } if self._capture else None}}}})
        except Exception:
            self._capture = False
            await self._observation({"type": "transcript_failed"})

    async def _monitoring_event(self, raw):
        kind = raw.get("type")
        item = raw.get("item") or {}
        item_id = raw.get("item_id") or item.get("id")
        if isinstance(item_id, str) and 0 < len(item_id) <= 128 and kind in (
                "conversation.item.added", "conversation.item.created", "input_audio_buffer.committed", "response.output_item.added"):
            if item.get("role") == "assistant":
                self._last_assistant_item = item_id
            self._position(item_id)
        if self._capture and kind in ("conversation.item.truncated", "output_audio_buffer.cleared"):
            ids = [item_id] if item_id in self._items else ([self._last_assistant_item] if self._last_assistant_item else [])
            for affected in ids:
                self._interrupted.add(affected)
                await self._observation({"type": "transcript_interrupted", "item_id": affected})
        if self._capture and kind == "conversation.item.input_audio_transcription.failed":
            await self._observation({"type": "transcript_failed"})
        if self._capture and kind in ("conversation.item.input_audio_transcription.completed", "response.output_audio_transcript.done"):
            text, index = raw.get("transcript"), raw.get("content_index", 0)
            if isinstance(text, str) and isinstance(item_id, str) and 0 < len(item_id) <= 128 and type(index) is int and 0 <= index <= 100:
                data = text.encode("utf-8")
                await self._observation({"type": "transcript", "text": data[:16384].decode("utf-8", errors="ignore"),
                    "truncated": len(data) > 16384, "item_id": item_id, "content_index": index,
                    "role": "caller" if kind.startswith("conversation.") else "assistant",
                    "position": self._position(item_id), "response_id": str(raw.get("response_id") or "")[:128],
                    "interrupted": item_id in self._interrupted})
        if kind == "response.done":
            response = raw.get("response") or {}
            response_id = response.get("id")
            usage = response.get("usage")
            if isinstance(response_id, str) and response_id not in self._usage_responses and isinstance(usage, dict) and len(self._usage_responses) < 4096:
                clean = {key: value for key, value in usage.items() if key in ("total_tokens", "input_tokens", "output_tokens")
                         and type(value) is int and 0 <= value <= 10**12}
                if clean:
                    self._usage_responses.add(response_id)
                    clean["scope"] = "latest_provider_response"
                    await self._observation({"type": "usage", "usage": clean, "observation_key": response_id})

    async def _handle(self, raw: dict) -> None:
        kind = raw.get("type")
        if kind == 'input_audio_buffer.speech_started':
            await self._emit({'type':'input_speech'})
        try:
            await self._monitoring_event(raw)
        except Exception:
            await self._observation({"type": "monitoring_gap"})
            if self._capture:
                await self._observation({"type": "transcript_failed"})
        if kind == "session.updated":
            self._session_configured = True
            self._ready.set()
        if kind == "error" and (raw.get("error") or {}).get("event_id") in self._optional_updates:
            self._capture = False
            await self._observation({"type": "transcript_failed"})
            return
        if kind == "error":
            code = (raw.get("error") or {}).get("code")
            await self._emit({"type": "error", "code": "provider_event_error", "provider_code": code if isinstance(code, str) and code in PROVIDER_CODES else "other"})
        if kind == "response.created":
            await self._observation({"type": "response_started", "response_id": (raw.get("response") or {}).get("id")})
            async with self._condition:
                self._response_generation += 1
                response = raw.get("response") or {}
                self._response_id = response.get("id") or f"response-{self._response_generation}"
                self._response_done = False
        if kind == "output_audio_buffer.started":
            async with self._condition:
                self._audio_playing = True
            await self._emit({"type": "audio_started"})
        if kind in ("output_audio_buffer.stopped", "output_audio_buffer.cleared"):
            async with self._condition:
                self._audio_playing = False
                self._condition.notify_all()
            await self._emit({"type": "audio_stopped"})
        if kind == "response.function_call_arguments.done":
            await self._tool_call(raw, raw.get("response_id"))
        if kind == "response.done":
            response = raw.get("response") or {}
            response_id = response.get("id") or self._response_id
            for item in response.get("output") or []:
                if isinstance(item, dict) and item.get("type") == "function_call":
                    await self._tool_call(item, response_id)
            async with self._condition:
                if len(self._done_responses) >= 4096:
                    raise ProviderError(f"{self.provider} response capacity exceeded")
                self._done_responses.add(response_id)
                if response_id == self._response_id:
                    self._response_done = True
                self._condition.notify_all()
            await self._emit({"type": "response_done", "response_id": response_id,
                              "status": response.get("status"), "has_tool_calls": bool(self._pending)})

    async def _tool_call(self, item: dict, response_id: str | None) -> None:
        invocation_id = item.get("call_id")
        name = item.get("name")
        if not isinstance(invocation_id, str) or not invocation_id or not isinstance(name, str):
            return
        try:
            arguments = json.loads(item.get("arguments") or "{}")
        except (TypeError, ValueError):
            arguments = {}
        if not isinstance(arguments, dict):
            arguments = {}
        response_id = response_id or self._response_id
        async with self._condition:
            if invocation_id in self._seen_calls:
                return
            if len(self._seen_calls) >= 4096:
                raise ProviderError(f"{self.provider} invocation capacity exceeded")
            self._seen_calls.add(invocation_id)
            self._pending.add(invocation_id)
            self._response_done = False
        await self._emit({"type": "tool_call", "invocation_id": invocation_id,
                          "name": name, "arguments": arguments, "response_id": response_id})

    async def close(self) -> None:
        if self._reader_task:
            self._reader_task.cancel()
            try:
                await self._reader_task
            except asyncio.CancelledError:
                pass
            self._reader_task = None
        if self._ws is not None:
            await self._ws.close()
            self._ws = None
        if self._owns_session and self._session is not None:
            await self._session.close()
            self._session = None

    async def hangup(self, provider_call_id: str) -> None:
        call_id = _call_id(provider_call_id)
        await self._post(self.http_base + "/calls/" + quote(call_id, safe="") + "/hangup")


class OpenAIAdapter(_RealtimeAdapter):
    provider = "openai"
    http_base = "https://api.openai.com/v1/realtime"
    ws_base = "wss://api.openai.com/v1/realtime"

    async def accept(self, provider_call_id: str, profile: Mapping, tools) -> None:
        call_id = _call_id(provider_call_id)
        self._call, self._profile, self._tools_config = call_id, profile, _openai_realtime_tools(tools)
        from ..models import model_for_adapter
        body = {"type": "realtime", "model": model_for_adapter(self.provider, profile, 'realtime'),
                "instructions": _instructions(profile),
                "audio": {"output": {"voice": _profile_value(profile, "voice", "alloy")}},
                "tools": self._tools_config}
        if profile.get("_workflow_mode"):
            body["audio"]["input"] = {"turn_detection": {"type": "server_vad", "create_response": False, "interrupt_response": False}}
        await self._post(self.http_base + "/calls/" + quote(call_id, safe="") + "/accept", body)

    async def connect(self, provider_call_id: str) -> None:
        call_id = _call_id(provider_call_id)
        if call_id != self._call:
            raise ValueError("provider call mismatch")
        await self._connect(call_id)
        if self._profile.get("_capture_transcripts"):
            await self.set_capture(True)


class GrokAdapter(_RealtimeAdapter):
    provider = "grok"
    http_base = "https://api.x.ai/v1/realtime"
    ws_base = "wss://api.x.ai/v1/realtime"

    async def accept(self, provider_call_id: str, profile: Mapping, tools) -> None:
        from ..models import model_for_adapter
        model_for_adapter(self.provider, profile, 'grok')
        self._call, self._profile, self._tools_config = _call_id(provider_call_id), profile, _tools(tools)

    async def connect(self, provider_call_id: str) -> None:
        call_id = _call_id(provider_call_id)
        if call_id != self._call:
            raise ValueError("provider call mismatch")
        await self._connect(call_id)
        await self._send({"type": "session.update", "session": {
            "voice": _profile_value(self._profile, "voice", "eve"),
            "instructions": _instructions(self._profile),
            "turn_detection": None if self._profile.get("_workflow_mode") else {"type": "server_vad"},
            "tools": self._tools_config,
        }})
        try:
            await asyncio.wait_for(self._ready.wait(), timeout=10)
        except asyncio.TimeoutError as exc:
            raise ProviderError("grok session setup timed out") from exc
        if not self._session_configured or self._ws.closed:
            raise ProviderError("grok session setup failed")
