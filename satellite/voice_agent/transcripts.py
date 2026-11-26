"""Optional encrypted debug text; failures never take ownership of voice control."""
import asyncio
import base64
import hashlib
import json
import os
import uuid
from datetime import datetime, timedelta, timezone

from nacl.secret import SecretBox

MAX_TURN_CHARS = 4000
MAX_ENVELOPE_BYTES = 24000 // 4 * 3 - SecretBox.NONCE_SIZE - SecretBox.MACBYTES


def encode_turn(content):
    payload = json.dumps(content, ensure_ascii=False).encode()
    if len(payload) <= MAX_ENVELOPE_BYTES:
        return payload
    # Escaped control characters can exceed the database limit even after
    # bounding the original text bytes. Find the longest prefix that fits.
    original = content['text']
    content['truncated'] = True
    low, high = 0, len(original)
    while low < high:
        count = (low + high + 1) // 2
        content['text'] = original[:count]
        if len(json.dumps(content, ensure_ascii=False).encode()) <= MAX_ENVELOPE_BYTES:
            low = count
        else:
            high = count - 1
    content['text'] = original[:low]
    return json.dumps(content, ensure_ascii=False).encode()


class Transcripts:
    def __init__(self, storage, monitoring):
        self.storage, self.monitoring = storage, monitoring
        self.queue = asyncio.Queue(maxsize=128)
        self.worker = None

    async def start(self):
        self.worker = asyncio.create_task(self._write())

    @staticmethod
    def enabled(call):
        return (call.snapshot.get('debug', {}).get('transcription_enabled') is True
                and call.binding.get('provider') == 'openai')

    def capture(self, call, event):
        if not self.enabled(call):
            return
        live = call.binding.get('adapter') in ('live', 'live_ws')
        item, index, position = event.get('item_id'), event.get('content_index'), event.get('position')
        text, role = event.get('text'), event.get('role')
        if (not isinstance(item, str) or not 1 <= len(item) <= 128 or type(index) is not int or
                not 0 <= index <= 100 or type(position) is not int or position < 1 or
                (not live and position > 2048) or
                not isinstance(text, str) or not text or role not in ('caller', 'assistant')):
            return
        now = datetime.now(timezone.utc)
        expires = call.started_at + timedelta(hours=call.snapshot['debug']['retention_hours'])
        if now >= expires:
            return
        if not live:
            self._enqueue(call, event, now, expires)
            return

        # Live emits fragments without turn boundaries. Keep adjacent fragments
        # from the same speaker together and preserve the spaces in each delta.
        pending = call.transcript_pending
        if pending and pending['role'] == role and len(pending['text']) + len(text) <= MAX_TURN_CHARS:
            pending['text'] += text
            pending['interrupted'] |= event.get('interrupted') is True
            pending['truncated'] |= event.get('truncated') is True
            return
        self.flush(call)
        call.transcript_pending = {
            'item_id': item, 'content_index': index, 'position': len(call.transcript_keys) + 1,
            'role': role, 'text': text[:MAX_TURN_CHARS], 'interrupted': event.get('interrupted') is True,
            'truncated': event.get('truncated') is True or len(text) > MAX_TURN_CHARS,
            'occurred_at': now, 'expires_at': expires,
        }

    def flush(self, call):
        pending, call.transcript_pending = call.transcript_pending, None
        if pending and self.enabled(call) and datetime.now(timezone.utc) < pending['expires_at']:
            self._enqueue(call, pending, pending['occurred_at'], pending['expires_at'])

    def _enqueue(self, call, event, now, expires):
        item, index = event['item_id'], event['content_index']
        key = (item, index)
        if key in call.transcript_keys:
            return
        if len(call.transcript_keys) >= 64 or self.queue.full():
            self.failed(call)
            return
        remaining = min(16384, 65536 - call.transcript_bytes)
        text = event['text']
        data = text.encode('utf-8')
        clipped = data[:remaining].decode('utf-8', errors='ignore')[:MAX_TURN_CHARS]
        if not clipped:
            self.failed(call)
            return
        event_id = str(uuid.uuid5(uuid.UUID(call.run_id), f'transcript:{item}:{index}'))
        content = {'run_id': call.run_id, 'event_id': event_id, 'role': event['role'], 'text': clipped,
                   'interrupted': event.get('interrupted') is True,
                   'truncated': event.get('truncated') is True or clipped != text}
        try:
            master = os.environ['SATELLITE_AGENT_CONFIG_KEY']
            encrypted = base64.b64encode(SecretBox(hashlib.sha256(master.encode()).digest()).encrypt(
                encode_turn(content))).decode()
        except Exception:
            self.failed(call)
            return
        call.transcript_keys.add(key)
        call.transcript_bytes += len(content['text'].encode())
        self.queue.put_nowait({'event_id': event_id, 'run_id': call.run_id, 'position': event['position'],
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
