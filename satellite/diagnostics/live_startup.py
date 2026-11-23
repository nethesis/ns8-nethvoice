"""Synthetic-only adapter variants, independent of the production factory.

An external harness must select this adapter for an exactly owned call. These
helpers have no environment switches, credentials, logging, or runtime imports.
"""
import asyncio
import base64
import time

from voice_agent.providers.live import OpenAILiveAdapter
from voice_agent.providers.live_primary import OpenAILiveWebSocketSession
from .rtp import decode_ulaw
from .live_audio import SignalStats


MEDIA_READY = ('Caller media is now connected. Say the prepared opening greeting '
               'now in the configured language, without delegation, then listen.')


class LiveMeasurements:
    variants = ('current', 'concise')
    sample_rate = 24000

    def __init__(self, binding, *, variant='current', session=None, clock=time.monotonic, on_close=None):
        if variant not in self.variants:
            raise ValueError('invalid_diagnostic_variant')
        super().__init__(binding, session=session)
        self.variant, self.clock = variant, clock
        self.on_close = on_close
        self.started = clock()
        self.input_stats, self.output_stats = SignalStats(self.sample_rate, clock=clock), SignalStats(self.sample_rate, clock=clock)
        self.commands = []
        self.command_overflow = 0
        self.errors = 0

    def configuration(self, profile, tools):
        # The investigation never exports or persists content, regardless of the
        # operator's unchanged published transcript-retention setting.
        return super().configuration({**profile, '_capture_transcripts': False}, tools)

    async def _command(self, kind, expected, **fields):
        record = None
        if len(self.commands) < 64:
            record = {'kind': kind if kind in ('session.instructions.append', 'session.commentary.append', 'session.update') else 'other',
                      'sent_ms': round((self.clock() - self.started) * 1000, 3), 'outcome': 'pending'}
            self.commands.append(record)
        else:
            self.command_overflow += 1
        try:
            await super()._command(kind, expected, **fields)
            outcome = 'acknowledged'
        except asyncio.CancelledError:
            outcome = 'cancelled'
            raise
        except asyncio.TimeoutError:
            outcome = 'timeout'
            raise
        except Exception:
            outcome = 'rejected_or_closed'
            raise
        finally:
            if record is not None:
                record.update(outcome=outcome, finished_ms=round((self.clock() - self.started) * 1000, 3))

    async def respond(self, instructions=None, *, response_id=None):
        if self.variant == 'concise' and response_id is None:
            # Full opening remains seeded at acceptance. One short notification
            # avoids serially injecting that same text a second time.
            await self._append('instructions', MEDIA_READY)
        else:
            await super().respond(instructions, response_id=response_id)

    async def _handle(self, raw):
        kind = raw.get('type')
        if kind == 'error':
            self.errors += 1
        # Transcript deltas are deliberately discarded before the normal handler.
        if kind not in ('session.input_transcript.delta', 'session.output_transcript.delta'):
            await super()._handle(raw)

    async def close(self):
        try:
            await super().close()
        finally:
            if self.on_close:
                self.on_close(self.measurements())

    def measurements(self):
        return {'clock_origin_ms': round(self.started * 1000, 3), 'variant': self.variant, 'commands': [dict(c) for c in self.commands],
                'command_overflow': self.command_overflow, 'provider_errors': self.errors,
                'provider_input': self.input_stats.snapshot(), 'provider_output': self.output_stats.snapshot()}


class DiagnosticLiveAdapter(LiveMeasurements, OpenAILiveAdapter):
    async def _handle(self, raw):
        kind = raw.get('type')
        if kind == 'session.input_audio.append':
            self.input_stats.encoded(raw.get('audio'))
            return
        if kind == 'session.output_audio.delta':
            self.output_stats.encoded(raw.get('delta'))
            return
        await super()._handle(raw)


class DiagnosticWebSocketSession(LiveMeasurements, OpenAILiveWebSocketSession):
    variants = ('primary-ws',)
    sample_rate = 8000

    async def send_audio(self, frame):
        await super().send_audio(frame)
        if self._audio_enabled:
            self.input_stats.pcm(decode_ulaw(frame))

    async def _handle(self, raw):
        await super()._handle(raw)
        if raw.get('type') == 'session.output_audio.delta' and self._audio_enabled:
            # The primary adapter validated and queued this delta. Measure arrival
            # here so PBX frame size and playback pacing do not affect the probe.
            self.output_stats.pcm(decode_ulaw(base64.b64decode(raw['delta'], validate=True)))
