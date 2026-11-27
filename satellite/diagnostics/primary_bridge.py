"""Synthetic-only Live primary WebSocket ↔ Asterisk media WebSocket prototype.

Uses the existing Live startup/tool engine. No configuration or public routes.
Not a production transport: interruption/backpressure acceptance needs more tests.
"""
import asyncio
import base64
import json

import aiohttp

from voice_agent.providers.realtime import ProviderError, _call_id
from .live_audio import SignalStats
from .live_startup import DiagnosticLiveAdapter
from .rtp import decode_ulaw


class PrimaryBridgeAdapter(DiagnosticLiveAdapter):
    primary_ws_base = 'wss://api.openai.com/v1/live/sessions'
    primary_audio = True

    def __init__(self, binding, call, controller, storage, *, record=None):
        super().__init__(binding)
        self.variant = 'primary-ws'
        self.input_stats, self.output_stats = SignalStats(8000), SignalStats(8000)
        self.call, self.controller, self.storage = call, controller, storage
        self.record = record
        self._media_ws = None
        self._media_read_task = self._media_write_task = None
        self._media_ready = asyncio.Event()
        self._audio = asyncio.Queue(maxsize=32)
        self._buffered_bytes = 0
        self._connection_id = None
        self._finalized = False

    async def _post(self, url, body=None):
        if not url.endswith('/accept') or body is None:
            raise ProviderError('unsupported diagnostic control')
        session = dict(body['session'])
        session.pop('type', None)
        session['audio'] = {**session['audio'], 'format': {'type': 'audio/pcmu', 'rate': 8000}}
        client = await self._client()
        self._ws = await client.ws_connect(self.primary_ws_base,
            headers=self._headers, heartbeat=20, max_msg_size=512 * 1024)
        self._reader_task = asyncio.create_task(self._read_events())
        await self._send({'type': 'session.start', 'session': session})
        await asyncio.wait_for(self._ready.wait(), 8)

    async def accept(self, provider_call_id, profile, tools):
        if self.call.terminal:
            raise ProviderError('diagnostic caller ended')
        await super().accept('diagnostic_primary', profile, tools)
        if self.call.terminal:
            raise ProviderError('diagnostic caller ended')
        await asyncio.to_thread(self.storage.accept, self.call, self._call)
        self.call.provider_call_id = self._call

    async def connect(self, provider_call_id):
        if _call_id(provider_call_id) != self._call:
            raise ValueError('provider call mismatch')
        connection = await self.controller.get_variable(self.call.leg_id, 'MEDIA_WEBSOCKET_CONNECTION_ID')
        # Asterisk generates an ephemeral UUID. Never follow a supplied URL.
        import re
        if not isinstance(connection, str) or not re.fullmatch(r'[a-fA-F0-9-]{36}', connection):
            raise ProviderError('diagnostic media connection unavailable')
        self._connection_id = connection
        url = self.controller.url.replace('http://', 'ws://', 1).replace('https://', 'wss://', 1)
        # This session has ARI authentication, never the provider bearer token.
        self._media_ws = await self.controller._session.ws_connect(url + '/media/' + connection,
            heartbeat=10, max_msg_size=65536)
        self._media_read_task = asyncio.create_task(self._read_media())
        self._media_write_task = asyncio.create_task(self._write_media())
        await asyncio.wait_for(self._media_ready.wait(), 5)

    async def _handle(self, raw):
        kind = raw.get('type')
        if kind == 'session.started':
            value = (raw.get('session') or {}).get('id')
            if not isinstance(value, str) or not 1 <= len(value) <= 128:
                raise ProviderError('invalid diagnostic session')
            self._call = _call_id(value)
            self._ready.set()
        elif kind == 'session.output_audio.delta':
            value = raw.get('delta')
            if not isinstance(value, str) or len(value) > 24000:
                raise ProviderError('diagnostic audio frame invalid')
            try:
                audio = base64.b64decode(value, validate=True)
            except ValueError:
                raise ProviderError('diagnostic audio frame invalid') from None
            if self._buffered_bytes + len(audio) > 16000:
                raise ProviderError('diagnostic audio backlog')
            self.output_stats.pcm(decode_ulaw(audio))
            try:
                self._audio.put_nowait(audio)
            except asyncio.QueueFull:
                raise ProviderError('diagnostic audio backlog') from None
            self._buffered_bytes += len(audio)
        else:
            await super()._handle(raw)

    async def _read_media(self):
        try:
            async for message in self._media_ws:
                if message.type == aiohttp.WSMsgType.BINARY:
                    if not self._media_ready.is_set() or not 0 < len(message.data) <= 8192:
                        raise ProviderError('diagnostic input frame invalid')
                    self.input_stats.pcm(decode_ulaw(message.data))
                    await self._send({'type': 'session.input_audio.append',
                                      'audio': base64.b64encode(message.data).decode()})
                elif message.type == aiohttp.WSMsgType.TEXT:
                    event = json.loads(message.data)
                    kind = event.get('event')
                    if kind == 'MEDIA_START':
                        if (event.get('channel_id') != self.call.leg_id or event.get('format') != 'ulaw'
                                or event.get('optimal_frame_size') != 160
                                or event.get('connection_id') != self._connection_id):
                            raise ProviderError('diagnostic media correlation failed')
                        self._media_ready.set()
                    elif kind == 'MEDIA_XOFF':
                        raise ProviderError('diagnostic playback backlog')
            if not self._finalized:
                raise ProviderError('diagnostic media disconnected')
        except asyncio.CancelledError:
            raise
        except Exception:
            await self._emit({'type': 'error', 'code': 'provider_unavailable'})

    async def _write_media(self):
        try:
            await self._media_ready.wait()
            remainder = bytearray()
            while True:
                audio = await self._audio.get()
                remainder.extend(audio)
                length = len(remainder) // 160 * 160
                if length:
                    await asyncio.wait_for(self._media_ws.send_bytes(bytes(remainder[:length])), 2)
                    del remainder[:length]
                self._buffered_bytes -= len(audio)
        except asyncio.CancelledError:
            raise
        except Exception:
            await self._emit({'type': 'error', 'code': 'provider_unavailable'})

    async def hangup(self, provider_call_id):
        if self._ws is not None and not self._ws.closed and not self._closed_event.is_set():
            await self._send({'type': 'session.close'})
            try:
                await asyncio.wait_for(self._closed_event.wait(), 2)
            except asyncio.TimeoutError:
                pass

    async def close(self):
        if self._finalized:
            return
        self._finalized = True
        if self._media_read_task:
            self._media_read_task.cancel()
            await asyncio.gather(self._media_read_task, return_exceptions=True)
        try:
            await self.hangup(self._call)
        finally:
            if self._media_write_task:
                self._media_write_task.cancel()
                await asyncio.gather(self._media_write_task, return_exceptions=True)
            if self._media_ws:
                await self._media_ws.close()
            try:
                await super().close()
            finally:
                while not self._audio.empty():
                    self._audio.get_nowait()
                self._buffered_bytes = 0
                if self.record:
                    self.record(self.measurements())
