"""Bounded audio metadata for synthetic calls. Never retain audio or transcripts."""
import array
import base64
import binascii
import math
import sys
import time


class SignalStats:
    """Analyze raw mono PCM16LE and discard each frame before returning."""

    def __init__(self, rate=24000, *, clock=time.monotonic):
        self.rate, self.clock = rate, clock
        self.started = clock()
        self.frames = self.samples = self.energy = self.peak = self.invalid = 0
        self.first_signal_ms = self.last_ms = None
        self.max_gap_ms = 0
        self.bins = [0] * 60

    def pcm(self, raw):
        if not isinstance(raw, bytes) or len(raw) > 262144 or not raw or len(raw) % 2:
            self.invalid += 1
            return
        values = array.array('h')
        values.frombytes(raw)
        if sys.byteorder != 'little':
            values.byteswap()
        now = round((self.clock() - self.started) * 1000, 3)
        if self.last_ms is not None:
            self.max_gap_ms = max(self.max_gap_ms, now - self.last_ms)
        self.last_ms = now
        self.frames += 1
        self.samples += len(values)
        energy = sum(x * x for x in values)
        peak = max(abs(x) for x in values)
        self.energy += energy
        self.peak = max(self.peak, peak)
        # Signal detection is an energy threshold, not proof of intelligible speech.
        if energy / len(values) >= 200 ** 2:
            if self.first_signal_ms is None:
                self.first_signal_ms = now
            self.bins[min(59, max(0, int(now / 1000)))] += len(values)

    def encoded(self, value):
        if not isinstance(value, str) or len(value) > 349528:
            self.invalid += 1
            return
        try:
            self.pcm(base64.b64decode(value, validate=True))
        except (ValueError, binascii.Error):
            self.invalid += 1

    def snapshot(self):
        return dict(clock_origin_ms=round(self.started * 1000, 3), frames=self.frames, samples=self.samples,
                    audio_seconds=round(self.samples / self.rate, 3),
                    rms=round(math.sqrt(self.energy / self.samples), 2) if self.samples else 0,
                    peak=self.peak, invalid=self.invalid, first_signal_ms=self.first_signal_ms,
                    last_frame_ms=self.last_ms, max_gap_ms=round(self.max_gap_ms, 3),
                    signal_samples_per_second=list(self.bins))
