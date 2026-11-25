"""GPT-Live primary audio WebSocket; no provider SIP or webhook lifecycle."""
import asyncio
import base64
import re
import time

import aiohttp

from .live import OpenAILiveAdapter
from .realtime import ProviderError
from ..media import AudioBuffer, FRAME_BYTES, MAX_AUDIO_BYTES


def _pcmu_power(value):
    value = ~value & 255
    magnitude = (((value & 15) << 3) + 132) << ((value & 112) >> 4)
    return (magnitude - 132) ** 2


PCMU_POWER = tuple(_pcmu_power(value) for value in range(256))


class OpenAILiveWebSocketSession(OpenAILiveAdapter):
    close_timeout = 15
    primary_audio = True
    greeting_timeout = 10.0
    greeting_confirmation = .2

    def __init__(self, binding, *, session=None):
        super().__init__(binding, session=session)
        self.audio = AudioBuffer()
        self._audio_enabled = True
        self._output_observed = False
        self._close_requested = False
        self._startup_error = False
        self._signal_observed = False
        self._signal_remainder = bytearray()
        self.startup_marks = {}
        self._greeting_played = asyncio.Event()
        self._caller_onset = None
        self._last_caller_voice = None
        self._greeting_interruption = None

    async def start(self, profile, tools):
        configuration = self.configuration(profile, tools)
        configuration.pop('type')
        configuration['audio']['format'] = {'type': 'audio/pcmu', 'rate': 8000}
        self._ready.clear()
        try:
            client = await self._client()
            self._ws = await client.ws_connect(self.ws_base, headers=self._headers,
                heartbeat=20, max_msg_size=512 * 1024)
        except aiohttp.WSServerHandshakeError as exc:
            error = ProviderError('provider primary handshake rejected')
            error.http_status = exc.status
            raise error from None
        self._reader_task = asyncio.create_task(self._read_events())
        await self._send({'type': 'session.start', 'session': configuration})
        await asyncio.wait_for(self._ready.wait(), 15)
        if self._closed or not self._call or self._closed_event.is_set() or self._startup_error:
            raise ProviderError('provider_live_error')
        return self._call

    async def _handle(self, raw):
        kind = raw.get('type')
        if kind == 'session.started':
            session = raw.get('session') or {}
            value = session.get('id')
            if not isinstance(value, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', value):
                raise ProviderError('provider_live_error')
            if self._call is not None and self._call != value:
                raise ProviderError('provider_live_error')
            self.startup_marks.setdefault('ready', time.monotonic())
            self._call = value
            self._ready.set()
        elif kind == 'session.output_audio.delta':
            if not self._audio_enabled:
                return
            encoded = raw.get('delta')
            if not isinstance(encoded, str) or not 0 < len(encoded) <= ((MAX_AUDIO_BYTES + 2) // 3) * 4:
                raise ProviderError('media_backpressure')
            try:
                data = base64.b64decode(encoded, validate=True)
            except ValueError:
                raise ProviderError('provider_live_error') from None
            self.audio.append(data)
            if not self._output_observed:
                self._output_observed = True
                self.startup_marks['packet'] = time.monotonic()
                await self._emit({'type': 'audio_started', '_observed_at': self.startup_marks['packet']})
            if not self._signal_observed:
                # One content-free onset marker distinguishes generated silence
                # from signal. Discard samples immediately; never infer words or
                # pretend the local observation is a provider timestamp.
                self._signal_remainder.extend(data)
                while len(self._signal_remainder) >= 160:
                    frame = self._signal_remainder[:160]
                    del self._signal_remainder[:160]
                    if sum(PCMU_POWER[v] for v in frame) >= 160 * 200 ** 2:
                        self._signal_observed = True
                        self._signal_remainder.clear()
                        self.startup_marks['signal'] = time.monotonic()
                        await self._emit({'type': 'audio_signal', '_observed_at': self.startup_marks['signal']})
                        break
        else:
            await super()._handle(raw)
            if kind in ('error', 'session.closed'):
                self._startup_error = True
                # Wake startup immediately on failure, rather than charging for
                # a session until its readiness deadline expires.
                self._ready.set()

    async def respond(self, instructions=None, *, response_id=None):
        if response_id is not None:
            return await super().respond(instructions, response_id=response_id)
        # session.start already requested the opening. The media writer confirms
        # playback even if the caller interrupted and the model answered instead.
        deadline = time.monotonic() + self.greeting_timeout
        while self._audio_enabled and not self._greeting_played.is_set():
            try:
                await asyncio.wait_for(self._greeting_played.wait(), max(0, deadline - time.monotonic()))
            except TimeoutError:
                if self._greeting_interruption is not None:
                    deadline = max(deadline, self._greeting_interruption + self.greeting_timeout)
                onset = self.startup_marks.get('playback')
                if onset is not None and onset <= deadline:
                    deadline = max(deadline, onset + self.greeting_confirmation)
                if time.monotonic() >= deadline and not self._greeting_played.is_set():
                    raise

    async def send_audio(self, frame):
        if self._audio_enabled:
            # Content-free input activity uses the same PCMU signal threshold
            # as media diagnostics; it is not identity/intent recognition.
            signal = bool(frame) and sum(PCMU_POWER[v] for v in frame) >= len(frame)*200**2
            if signal:
                now = time.monotonic()
                if not self._greeting_played.is_set():
                    if self._last_caller_voice is None or now - self._last_caller_voice > .1:
                        self._caller_onset = now
                    self._last_caller_voice = now
                    if now - self._caller_onset >= .2:
                        self._greeting_interruption = now
                if not getattr(self,'_consultation_input_active',False):
                    await self._emit({'type':'input_speech'})
                self._consultation_input_active = True
                self._consultation_input_at = time.monotonic()
            elif time.monotonic()-getattr(self,'_consultation_input_at',0)>.5:
                self._consultation_input_active = False
            await self._send({'type': 'session.input_audio.append',
                              'audio': base64.b64encode(frame).decode()})

    def audio_played(self, frame):
        if sum(PCMU_POWER[value] for value in frame) >= len(frame) * 200 ** 2:
            self._played_speech_sequence = getattr(self, '_played_speech_sequence', 0) + 1
            if self._played_speech_sequence == 1:
                self.startup_marks['playback'] = time.monotonic()
            if self._played_speech_sequence == 1600 // FRAME_BYTES:
                self._greeting_played.set()
            self._played_quiet_bytes = 0
        else:
            self._played_quiet_bytes = min(8000, getattr(self, '_played_quiet_bytes', 0) + len(frame))

    def stop_audio(self):
        self._audio_enabled = False
        self._greeting_played.set()
        self.audio.close()
        self._signal_remainder.clear()

    async def hangup(self, provider_call_id=None):
        if self._ws is None or self._ws.closed or self._closed or self._closed_event.is_set():
            return
        if not self._close_requested:
            self._close_requested = True
            await self._send({'type': 'session.close'})
        try:
            await asyncio.wait_for(self._closed_event.wait(), self.close_timeout)
        except asyncio.TimeoutError:
            await self._usage(None)

    async def close(self):
        self.stop_audio()
        try:
            await self.hangup()
        finally:
            await super().close()
