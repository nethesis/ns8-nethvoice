"""Optional encrypted debug text; failures never take ownership of voice control."""
import asyncio
import base64
import hashlib
import json
import os
import uuid
from datetime import datetime, timedelta, timezone

from nacl.secret import SecretBox


class Transcripts:
    def __init__(self, storage, monitoring):
        self.storage, self.monitoring = storage, monitoring
        self.queue = asyncio.Queue(maxsize=128)
        self.worker = None

    async def start(self):
        self.worker = asyncio.create_task(self._write())

    def capture(self, call, event):
        policy = call.snapshot.get('debug', {})
        if policy.get('transcription_enabled') is not True or call.binding['provider'] != 'openai':
            return
        item, index, position = event.get('item_id'), event.get('content_index'), event.get('position')
        text, role = event.get('text'), event.get('role')
        if (not isinstance(item, str) or not 1 <= len(item) <= 128 or type(index) is not int or
                not 0 <= index <= 100 or type(position) is not int or not 1 <= position <= 2048 or
                not isinstance(text, str) or not text or role not in ('caller', 'assistant')):
            return
        key = (item, index)
        if key in call.transcript_keys:
            return
        if len(call.transcript_keys) >= 64 or self.queue.full():
            self.failed(call)
            return
        remaining = min(16384, 65536 - call.transcript_bytes)
        data = text.encode('utf-8')
        clipped = data[:remaining].decode('utf-8', errors='ignore')[:4000]
        if not clipped:
            self.failed(call)
            return
        now = datetime.now(timezone.utc)
        expires = call.started_at + timedelta(hours=policy['retention_hours'])
        if now >= expires:
            return
        event_id = str(uuid.uuid5(uuid.UUID(call.run_id), f'transcript:{item}:{index}'))
        content = {'run_id': call.run_id, 'event_id': event_id, 'role': role, 'text': clipped,
                   'interrupted': event.get('interrupted') is True,
                   'truncated': event.get('truncated') is True or clipped != text}
        try:
            master = os.environ['SATELLITE_AGENT_CONFIG_KEY']
            encrypted = base64.b64encode(SecretBox(hashlib.sha256(master.encode()).digest()).encrypt(
                json.dumps(content, ensure_ascii=False).encode())).decode()
        except Exception:
            self.failed(call)
            return
        call.transcript_keys.add(key)
        call.transcript_bytes += len(clipped.encode())
        self.queue.put_nowait({'event_id': event_id, 'run_id': call.run_id, 'position': position,
                               'content_encrypted': encrypted, 'occurred_at': now,
                               'expires_at': expires})

    def failed(self, call):
        self.monitoring.emit(call.run_id, 'transcription_failed', error='debug_transcription_unavailable')

    async def _write(self):
        while True:
            turn = await self.queue.get()
            try:
                try:
                    await asyncio.wait_for(asyncio.to_thread(self.storage.transcript, turn), timeout=4)
                except Exception:
                    self.monitoring.emit(turn['run_id'], 'transcription_failed', error='debug_transcription_unavailable')
            finally:
                self.queue.task_done()

    async def stop(self):
        try:
            await asyncio.wait_for(self.queue.join(), timeout=5)
        except asyncio.TimeoutError:
            pass
        if self.worker:
            self.worker.cancel()
            await asyncio.gather(self.worker, return_exceptions=True)
