"""Monitoring independent of call ownership and optional legacy transcription."""

import asyncio
import base64
import copy
import json
import os
import time
import threading
import uuid
from collections import deque

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from .policy import validate_policy
from .repository import HistoryRepository


class Monitoring:
    def __init__(self, repository=None):
        self.repository = repository or HistoryRepository()
        self.epoch = uuid.uuid4().hex
        self.policy = validate_policy()
        self._queue = deque()
        self._queue_lock = threading.Lock()
        self._bytes = 0
        self._gate = asyncio.Lock()
        self._read_slots = asyncio.Semaphore(8)
        self._task = None
        self._stopping = False
        self._initialized = False
        self._configured = False
        self._policy_dirty = False
        self._policy_generation = 0
        self._error = "starting"
        self.dropped = 0
        self.last_write = None
        self._key = None
        try:
            key=base64.b64decode(os.getenv("SATELLITE_MONITORING_CONTENT_KEY", ""),validate=True)
            if len(key)==32: self._key=AESGCM(key)
        except (ValueError,TypeError): pass

    async def start(self):
        self._stopping=False
        self._task=asyncio.create_task(self._writer())

    async def stop(self):
        self._stopping=True
        if self._task:
            try: await asyncio.wait_for(asyncio.shield(self._task),5)
            except asyncio.TimeoutError:
                self._task.cancel()
                await asyncio.gather(self._task,return_exceptions=True)
        with self._queue_lock:
            self._queue.clear();self._bytes=0

    def health(self):
        return {"available":self._initialized and self._configured and not self._policy_dirty and self._error is None,
            "error_code":self._error or ("configuration_pending" if not self._configured or self._policy_dirty else None),
            "queued_records":len(self._queue),"queued_bytes":self._bytes,"dropped":self.dropped,
            "last_write":self.last_write,"epoch":self.epoch,"content_key_available":self._key is not None}

    async def configure(self, policy):
        policy=validate_policy(policy)
        self._configured=True
        if self._initialized and not self._policy_dirty and self.policy==policy:
            return
        self.policy=policy
        self._policy_generation+=1
        self._policy_dirty=True
        # In-flight DB writes finish before capture revocation is acknowledged.
        try:
            async with self._gate:
                if self._initialized and self._policy_dirty:
                    generation=self._policy_generation
                    await asyncio.to_thread(self.repository.apply_policy,copy.deepcopy(self.policy))
                    self._policy_dirty=self._policy_generation!=generation
        except Exception:
            self._error="storage_unavailable"

    def capture_available(self, agent, provider):
        return bool(self.policy["transcripts"].get(agent) and provider=="openai" and self._key and self.health()["available"])

    def enqueue(self, kind, value):
        try:
            # Encryption already occurred; the queue never stores plaintext text.
            size=len(json.dumps(value,default=lambda v:base64.b64encode(v).decode(),allow_nan=False).encode())
            record=copy.deepcopy(value)
            with self._queue_lock:
                if size>(8192 if kind=="event" else 65536) or len(self._queue)>=4096 or self._bytes+size>4*1024*1024:
                    self.dropped+=1
                    return False
                self._queue.append(({"kind":kind,"value":record},size))
                self._bytes+=size
            return True
        except Exception:
            self.dropped+=1
            return False

    def register(self, call):
        provider=call.binding["provider"];agent=call.profile_key
        requested=self.policy["transcripts"].get(agent,False)
        enabled=self.capture_available(agent,provider)
        call.profile["_capture_transcripts"]=enabled
        call.profile["_capture_version"]=self.policy["capture_versions"][agent]
        value={"run_id":call.run_id,"session_id":call.session_id,"agent_id":agent,
            "provider":provider,"cdr_id":call.caller_id,"destination_id":call.destination_id,
            "epoch":self.epoch,"revision":call.revision,"payload_hash":call.payload_hash,
            "started":time.time(),"capture_version":self.policy["capture_versions"][agent],
            "transcript_state":("pending" if enabled else ("unsupported" if provider!="openai" and requested else
                "unavailable" if requested else "disabled"))}
        self.enqueue("run",value)

    def event(self, value):
        self.enqueue("event",value)

    def transcript(self, call, event):
        if not self.policy["transcripts"].get(call.profile_key) or not call.profile.get("_capture_transcripts") or not self._key or call.profile.get("_capture_version") != self.policy["capture_versions"].get(call.profile_key):
            return
        text=event.get("text")
        item_id=event.get("item_id")
        if not isinstance(text,str) or not isinstance(item_id,str) or not 1<=len(item_id)<=128: return
        data=text.encode("utf-8");truncated=len(data)>16384 or bool(event.get("truncated"))
        data=data[:16384].decode("utf-8",errors="ignore").encode()
        nonce=os.urandom(12)
        index=event.get("content_index",0)
        if type(index) is not int or not 0<=index<=100: return
        aad=f"{call.run_id}:{item_id}:{index}".encode()
        value={"run_id":call.run_id,"item_id":item_id,"content_index":index,
            "role":event.get("role"),"position":event.get("position",0),
            "response_id":event.get("response_id"),"ciphertext":nonce+self._key.encrypt(nonce,data,aad),
            "bytes":len(data),"truncated":truncated,"interrupted":event.get("interrupted",False)}
        if value["role"] not in ("caller","assistant") or type(value["position"]) is not int: return
        self.enqueue("text",value)

    async def _writer(self):
        next_purge=0
        while not self._stopping or self._queue:
            try:
                async with self._gate:
                    if not self._initialized:
                        await asyncio.to_thread(self.repository.initialize,self.epoch)
                        persisted=await asyncio.to_thread(self.repository.policy)
                        if not self._policy_dirty:
                            self.policy=validate_policy(persisted)
                        self._initialized=True
                    if self._policy_dirty:
                        generation=self._policy_generation
                        await asyncio.to_thread(self.repository.apply_policy,copy.deepcopy(self.policy))
                        self._policy_dirty=self._policy_generation!=generation
                    if time.monotonic()>=next_purge:
                        await asyncio.to_thread(self.repository.purge);next_purge=time.monotonic()+60
                    with self._queue_lock:
                        batch=list(self._queue)[:25]
                        dropped_baseline=self.dropped
                    result=await asyncio.to_thread(self.repository.write,[x[0] for x in batch],self.epoch,dropped_baseline)
                    with self._queue_lock:
                        for _,size in batch:
                            self._queue.popleft();self._bytes-=size
                        self.dropped+=max(0,result["dropped"]-dropped_baseline)
                    self.last_write=time.time()
                    self._error="monitoring_storage_limit" if result["limit"] else None
            except Exception as exc:
                code=str(exc)
                self._error=code if code in ("monitoring_storage_limit","monitoring_run_limit","monitoring_event_limit") else "storage_unavailable"
            if self._stopping and not self._queue: break
            await asyncio.sleep((0.05 if self._queue else 1) if self._error is None else 3)

    async def read(self, operation, *args, **kwargs):
        if not self._initialized or not self._configured or self._policy_dirty: raise RuntimeError("monitoring_unavailable")
        async with self._read_slots:
            return await asyncio.to_thread(getattr(self.repository,operation),*args,**kwargs)

    async def conversation(self, run_id):
        run=await self.read("run",run_id)
        if run is None: return None
        result={"state":run["transcript_state"],"items":[],"generated_audio_warning":True}
        if not self._key:
            if result["state"] in ("available","partial","truncated","capture_stopped","pending"):
                result["state"]="unavailable"
            return result
        segments=await self.read("segments",run_id)
        for value in segments:
            try:
                data=bytes(value.pop("ciphertext"));aad=f'{run_id}:{value["item_id"]}:{value["content_index"]}'.encode()
                value["text"]=self._key.decrypt(data[:12],data[12:],aad).decode()
            except Exception:
                result["state"]="partial";continue
            result["items"].append(value)
        if not segments and run["text_bytes"] > 0 and result["state"] in ("available","capture_stopped","truncated","partial"):
            result["state"]="expired"
        return result

    async def delete_text(self, run_id, actor):
        # Serialize deletion against the writer; the DB run row is a persistent tombstone.
        async with self._gate:
            return await self.read("delete_text",run_id,actor)
