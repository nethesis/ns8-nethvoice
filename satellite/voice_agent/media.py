"""Private Asterisk PCMU media, bounded independently of provider JSON/events."""
import asyncio
import json
import re
import time

import aiohttp

from .providers.realtime import ProviderError

FRAME_BYTES = 160
FRAME_SECONDS = .02
MAX_AUDIO_BYTES = 16000  # Two seconds of PCMU/8000, never an unbounded queue.


class AudioBuffer:
    def __init__(self):
        self._data = bytearray()
        self._available = asyncio.Event()
        self._closed = False

    @property
    def pending_bytes(self):
        return len(self._data)

    def append(self, data):
        if self._closed:
            return
        if not isinstance(data, bytes) or not data or len(self._data) + len(data) > MAX_AUDIO_BYTES:
            raise ProviderError('media_backpressure')
        self._data.extend(data)
        self._available.set()

    async def frame(self):
        while not self._closed:
            if len(self._data) >= FRAME_BYTES:
                data = bytes(self._data[:FRAME_BYTES])
                del self._data[:FRAME_BYTES]
                return data
            self._available.clear()
            await self._available.wait()
        return None

    def clear(self):
        self._data.clear()

    def close(self):
        self._closed = True
        self.clear()
        self._available.set()


class AsteriskWebSocketMedia:
    def __init__(self, channel_id, connection_id):
        if not re.fullmatch(r'[a-fA-F0-9-]{36}', connection_id):
            raise ProviderError('media_identity_invalid')
        self.channel_id, self.connection_id = channel_id, connection_id
        self.input = AudioBuffer()
        self.ready, self.failed = asyncio.Event(), asyncio.Event()
        self.writable = asyncio.Event()
        self.writable.set()
        self.error = None
        self._ws = self._reader = None
        self._closed = self._input_enabled = False
        self._status_at = 0.0
        self.queue_frames = 0
        self.input_bytes = self.output_bytes = 0

    async def connect(self, session, base_url):
        try:
            self._ws = await session.ws_connect(base_url + '/media/' + self.connection_id,
                                                heartbeat=10, max_msg_size=65500)
            self._reader = asyncio.create_task(self._read())
            await asyncio.wait_for(self.ready.wait(), 5)
            if self.error:
                raise ProviderError(self.error)
        except BaseException:
            await self.close()
            raise
        return self

    def enable_input(self):
        self._input_enabled = True

    def stop_input(self):
        self._input_enabled = False
        self.input.close()

    def _fail(self, code):
        if not self._closed:
            self.error = code
            self.failed.set()
            self.ready.set()
            self.input.close()

    async def _read(self):
        try:
            async for message in self._ws:
                if message.type == aiohttp.WSMsgType.BINARY:
                    if not self.ready.is_set():
                        raise ProviderError('media_identity_invalid')
                    if self._input_enabled:
                        self.input.append(message.data)
                        self.input_bytes += len(message.data)
                elif message.type == aiohttp.WSMsgType.TEXT:
                    event = json.loads(message.data)
                    if not isinstance(event, dict):
                        raise ProviderError('media_identity_invalid')
                    if event.get('channel_id', self.channel_id) != self.channel_id:
                        raise ProviderError('media_identity_invalid')
                    kind = event.get('event')
                    if kind == 'MEDIA_START':
                        if (self.ready.is_set() or event.get('channel_id') != self.channel_id
                                or event.get('connection_id') != self.connection_id
                                or event.get('format') != 'ulaw' or event.get('optimal_frame_size') != FRAME_BYTES):
                            raise ProviderError('media_identity_invalid')
                        self.ready.set()
                    elif kind == 'MEDIA_XOFF':
                        self.writable.clear()
                    elif kind == 'MEDIA_XON':
                        self.writable.set()
                    elif kind == 'STATUS':
                        frames = event.get('queue_length')
                        if type(frames) is not int or not 0 <= frames <= 1000:
                            raise ProviderError('media_identity_invalid')
                        self.queue_frames = frames
                        self._status_at = time.monotonic()
                    # DTMF is intentionally not a tool/routing command.
            self._fail('media_eof')
        except asyncio.CancelledError:
            raise
        except Exception as error:
            self._fail(error.args[0] if isinstance(error, ProviderError) else 'media_transport_failed')

    async def command(self, name):
        if self._ws is None or self._ws.closed:
            raise ProviderError('media_eof')
        await asyncio.wait_for(self._ws.send_json({'command': name}), 2)

    async def write(self, frame):
        if len(frame) != FRAME_BYTES or not self.ready.is_set() or self.error:
            raise ProviderError(self.error or 'media_identity_invalid')
        await asyncio.wait_for(self.writable.wait(), 2)
        # Monitor the driver's queue as well as our application buffer. XOFF's
        # default threshold is many seconds, too late for conversational audio.
        if time.monotonic() - self._status_at >= .1:
            await self.command('GET_STATUS')
            self._status_at = time.monotonic()
        stalled = time.monotonic()
        while self.queue_frames > 5:
            if time.monotonic() - stalled >= 2:
                raise ProviderError('media_backpressure')
            await asyncio.sleep(.02)
            await self.command('GET_STATUS')
            if self.error:
                raise ProviderError(self.error)
        await asyncio.wait_for(self._ws.send_bytes(frame), 2)
        self.output_bytes += len(frame)

    async def flush(self):
        self.stop_input()
        if self._ws is not None and not self._ws.closed:
            await self.command('FLUSH_MEDIA')

    async def close(self):
        if self._closed:
            return
        self._closed = True
        self.stop_input()
        if self._reader and self._reader is not asyncio.current_task():
            self._reader.cancel()
            await asyncio.gather(self._reader, return_exceptions=True)
        if self._ws is not None:
            await self._ws.close()


class AudioBridge:
    def __init__(self, media, provider, failure):
        self.media, self.provider, self.failure = media, provider, failure
        self.tasks = []
        self.stopped = False

    def start(self):
        self.tasks = [asyncio.create_task(self._pump_input()), asyncio.create_task(self._pump_output())]

    async def _pump_input(self):
        try:
            while not self.stopped:
                frame = await self.media.input.frame()
                if frame is None:
                    return
                if self.stopped:
                    return
                # Asterisk already clocks this stream. Re-pacing its FIFO here
                # preserves the entire provider-startup backlog indefinitely.
                # Forward the bounded buffer in order, including early speech;
                # frame() naturally waits for Asterisk once we are caught up.
                await asyncio.wait_for(self.provider.send_audio(frame), 2)
        except asyncio.CancelledError:
            raise
        except Exception:
            if not self.stopped:
                self.failure('media_transport_failed')

    async def _pump_output(self):
        try:
            deadline = time.monotonic()
            while not self.stopped:
                frame = await self.provider.audio.frame()
                if frame is None:
                    return
                await asyncio.sleep(max(0, deadline - time.monotonic()))
                if self.stopped:
                    return
                await self.media.write(frame)
                if hasattr(self.provider, 'audio_played'):
                    self.provider.audio_played(frame)
                deadline = max(deadline + FRAME_SECONDS, time.monotonic())
        except asyncio.CancelledError:
            raise
        except Exception:
            if not self.stopped:
                self.failure('media_transport_failed')

    async def stop(self):
        if self.stopped:
            return
        self.stopped = True
        self.media.stop_input()
        self.provider.stop_audio()
        for task in self.tasks:
            task.cancel()
        await asyncio.gather(*self.tasks, return_exceptions=True)
        await self.media.flush()
