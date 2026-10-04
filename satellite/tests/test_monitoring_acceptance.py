"""Phase 3 acceptance against the packaged runtime and a disposable PostgreSQL.

Run inside the published Satellite image with this directory mounted. Database
tests deliberately reset agent_monitoring; they require the isolated hostname
nv-phase3-db and SATELLITE_MONITORING_ACCEPTANCE=isolated.
"""
import asyncio
import base64
import copy
import hashlib
import os
import time
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from agent.monitoring import Monitoring
from agent.monitoring.policy import validate_policy
from agent.monitoring.repository import HistoryRepository, decode_cursor
from agent.providers.realtime import OpenAIAdapter


def call(index=1, agent="internal", provider="openai"):
    return SimpleNamespace(run_id=f"phase3-run-{index}", session_id=f"phase3-session-{index}",
        profile_key=agent, binding={"provider": provider}, profile={}, caller_id=f"phase3-cdr-{index}",
        destination_id="phase3-test", revision=1, payload_hash="a" * 64)


def event(c, sequence=1, kind="call_ended", **extra):
    return dict(event_id=hashlib.sha256(f"{c.run_id}:{sequence}".encode()).hexdigest(),
        run_id=c.run_id, sequence=sequence, timestamp=time.time(), event_type=kind,
        outcome="completed", reason_code="phase3_test", **extra)


class Acceptance(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        if (os.getenv("SATELLITE_MONITORING_ACCEPTANCE") != "isolated"
                or os.getenv("PGVECTOR_HOST") != "nv-phase3-db"):
            self.skipTest("requires explicitly isolated nv-phase3-db")
        self.repo = HistoryRepository()
        with self.repo.connect() as db:
            db.execute("DROP SCHEMA IF EXISTS agent_monitoring CASCADE")
        self.repo.initialize("phase3-epoch")
        self.env = patch.dict(os.environ, {
            "SATELLITE_MONITORING_CONTENT_KEY": base64.b64encode(b"x" * 32).decode()})
        self.env.start()
        self.monitor = Monitoring(self.repo)
        self.monitor._initialized = self.monitor._configured = True
        self.monitor._error = None
        self.addCleanup(self.env.stop)

    def flush(self):
        m = self.monitor
        records = [item[0] for item in m._queue]
        result = self.repo.write(records, m.epoch, m.dropped)
        m._queue.clear(); m._bytes = 0
        return result

    async def capture(self, c=None):
        c = c or call()
        policy = validate_policy()
        policy["transcripts"]["internal"] = True
        await self.monitor.configure(policy)
        self.monitor.register(c)
        self.monitor.transcript(c, dict(item_id="test-item", role="caller", text="Synthetic Phase 3 speech", position=1))
        self.flush()
        return c

    async def test_policy_and_cursor_validation(self):
        self.assertFalse(validate_policy()["transcripts"]["internal"])
        for key, value in [("metadata_retention_days", True), ("transcript_retention_days", 366),
                           ("transcript_retention_days", 31)]:
            policy = validate_policy(); policy[key] = value
            with self.assertRaises(ValueError): validate_policy(policy)
        for bad in ["!", "a" * 513, "e30", "WyJ4Il0"]:
            with self.assertRaises(ValueError): decode_cursor(bad, 2)

    async def test_default_off_and_unsupported_provider(self):
        c = call(); self.monitor.register(c)
        self.monitor.transcript(c, dict(item_id="test", role="caller", text="must not persist"))
        self.flush()
        self.assertEqual(self.repo.run(c.run_id)["transcript_state"], "disabled")
        self.assertEqual(self.repo.segments(c.run_id), [])
        policy = validate_policy(); policy["transcripts"]["internal"] = True
        await self.monitor.configure(policy)
        c = call(2, provider="grok"); self.monitor.register(c); self.flush()
        self.assertEqual(self.repo.run(c.run_id)["transcript_state"], "unsupported")

    async def test_encryption_and_deletion_tombstone(self):
        c = await self.capture()
        segment = self.repo.segments(c.run_id)[0]
        self.assertNotIn(b"Synthetic Phase 3 speech", bytes(segment["ciphertext"]))
        self.assertEqual((await self.monitor.conversation(c.run_id))["items"][0]["text"], "Synthetic Phase 3 speech")
        # Retry already queued before deletion must not revive the content.
        self.monitor.transcript(c, dict(item_id="late", role="assistant", text="late text"))
        self.assertTrue(await self.monitor.delete_text(c.run_id, "phase3-test"))
        self.assertTrue(await self.monitor.delete_text(c.run_id, "phase3-test"))
        self.flush()
        self.assertEqual((await self.monitor.conversation(c.run_id))["state"], "deleted")
        self.assertEqual(self.repo.segments(c.run_id), [])
        with self.repo.connect() as db:
            self.assertEqual(db.execute("SELECT count(*) AS n FROM agent_monitoring.audit").fetchone()["n"], 1)

    async def test_revocation_generation_and_concurrent_policy(self):
        c = await self.capture()
        self.monitor.transcript(c, dict(item_id="late", role="caller", text="late text"))
        policy = validate_policy(); policy["capture_versions"]["internal"] = 2
        await self.monitor.configure(policy)
        policy["transcripts"]["internal"] = True
        await self.monitor.configure(policy)
        self.flush()
        self.assertEqual(len(self.repo.segments(c.run_id)), 1)
        self.monitor.transcript(c, dict(item_id="later", role="caller", text="stale generation"))
        self.assertEqual(len(self.monitor._queue), 0)
        first=copy.deepcopy(policy); first["metadata_retention_days"]=29
        second=copy.deepcopy(policy); second["metadata_retention_days"]=28
        await asyncio.gather(self.monitor.configure(first), self.monitor.configure(second))
        self.assertEqual(self.repo.policy(), self.monitor.policy)
        self.assertFalse(self.monitor._policy_dirty)

    async def test_expiry_does_not_revive_on_extension(self):
        c = await self.capture()
        with self.repo.connect() as db:
            db.execute("UPDATE agent_monitoring.segments SET expires=%s", (time.time()-1,))
        policy = copy.deepcopy(self.monitor.policy); policy["transcript_retention_days"] = 20
        await self.monitor.configure(policy)
        self.assertEqual((await self.monitor.conversation(c.run_id))["state"], "expired")
        with self.repo.connect() as db:
            db.execute("UPDATE agent_monitoring.runs SET expires=%s", (time.time()-1,))
        policy["metadata_retention_days"] = 60
        await self.monitor.configure(policy)
        self.assertIsNone(self.repo.run(c.run_id))
        self.repo.purge()
        with self.repo.connect() as db:
            self.assertEqual(db.execute("SELECT count(*) AS n FROM agent_monitoring.runs").fetchone()["n"], 0)

    async def test_deduplication_sequences_terminal_outcomes_and_restart(self):
        for i in range(10):
            c = call(i); self.monitor.register(c)
            self.monitor.event(event(c, 1, "call_admitted"))
            self.monitor.event(event(c, 2))
        records = [item[0] for item in self.monitor._queue]
        self.flush(); self.repo.write(records, self.monitor.epoch, 0)
        self.assertEqual(len(self.repo.list_runs()["items"]), 10)
        self.assertEqual(len(self.repo.events(call(0).run_id)["items"]), 2)
        self.assertTrue(self.repo.run(call(0).run_id)["complete"])
        c = call(20); self.monitor.register(c)
        self.monitor.event(event(c, 3)); self.flush()
        self.assertFalse(self.repo.run(c.run_id)["complete"])
        c = call(21); self.monitor.register(c); self.flush()
        self.repo.initialize("new-epoch")
        row=self.repo.run(c.run_id)
        self.assertEqual((row["status"],row["reason"],row["ended"],row["complete"]),
                         ("interrupted","runtime_restart",None,False))

    async def test_transcript_limits_and_missing_or_wrong_key(self):
        c = await self.capture()
        self.monitor.transcript(c, dict(item_id="large", role="assistant", text="à" * 12000))
        self.flush()
        self.assertEqual(self.repo.run(c.run_id)["transcript_state"], "truncated")
        self.assertLessEqual(self.repo.run(c.run_id)["text_bytes"], 16410)
        self.monitor._key = None
        self.assertEqual((await self.monitor.conversation(c.run_id))["state"], "unavailable")
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        self.monitor._key = AESGCM(b"y"*32)
        self.assertEqual((await self.monitor.conversation(c.run_id))["state"], "partial")

    async def test_queue_bounds_and_loss_marker(self):
        c = call(); self.monitor.register(c); self.flush()
        for i in range(5000): self.monitor.enqueue("event", event(c, i+1, "call_admitted"))
        self.assertLessEqual(len(self.monitor._queue),4096)
        self.assertLessEqual(self.monitor._bytes,4*1024*1024)
        self.assertGreater(self.monitor.dropped,0)
        # Persist a bounded batch and the loss observation, not the entire flood.
        self.repo.write([self.monitor._queue[0][0]], self.monitor.epoch, self.monitor.dropped)
        self.assertFalse(self.repo.run(c.run_id)["complete"])
        self.assertFalse(self.repo.overview(0)["history_complete"])

    async def test_storage_capacity_preserves_terminal_state_and_reads(self):
        import agent.monitoring.repository as repository
        c=call(); self.monitor.register(c); self.flush()
        self.monitor.event(event(c))
        with patch.object(repository,"MAX_EVENTS",0):
            result=self.flush()
        self.assertTrue(result["limit"])
        self.assertEqual(result["lost"],1)
        row=self.repo.run(c.run_id)
        self.assertEqual(row["status"],"completed")
        self.assertFalse(row["complete"])
        self.assertEqual(len(self.repo.list_runs()["items"]),1)

    async def test_schema_version_guard(self):
        with self.repo.connect() as db:
            db.execute("INSERT INTO agent_monitoring.migrations VALUES(3)")
        with self.assertRaisesRegex(RuntimeError,"monitoring_schema_newer"):
            self.repo.initialize("new-runtime")

    async def test_database_failure_keeps_event_loop_and_recovers(self):
        m=self.monitor; m._initialized=False
        with patch.dict(os.environ,{"PGVECTOR_PORT":"1"}):
            await m.start()
            start=time.monotonic()
            for i in range(100):
                m.enqueue("event", dict(event_id=str(i),run_id=None,sequence=0,
                    timestamp=time.time(),event_type="phase3_test"))
                await asyncio.sleep(.001)
            self.assertLess(time.monotonic()-start,1)
            self.assertEqual(m.health()["error_code"],"storage_unavailable")
        deadline=time.monotonic()+15
        while (not m.health()["available"] or m._queue) and time.monotonic()<deadline:
            await asyncio.sleep(.05)
        self.assertTrue(m.health()["available"])
        self.assertEqual(len(m._queue),0)
        await m.stop()

    async def test_private_api_authorization_bounds_and_cache(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from agent.monitoring.api import create_monitoring_router
        c=await self.capture()
        runtime=SimpleNamespace(monitoring=self.monitor,calls={},store=SimpleNamespace(snapshot={}),
            readiness=lambda:{},call_status=lambda _: {})
        app=FastAPI(); app.include_router(create_monitoring_router(runtime))
        with patch.dict(os.environ,{"API_TOKEN":"phase3-test-token"}),TestClient(app) as client:
            root="/api/agent/v1/monitoring"
            self.assertEqual(client.get(root+"/health").status_code,401)
            headers={"Authorization":"Bearer phase3-test-token"}
            self.assertEqual(client.get(root+"/runs?limit=101",headers=headers).status_code,422)
            self.assertEqual(client.get(root+"/runs?cursor=!!",headers=headers).status_code,400)
            response=client.get(root+"/runs/"+c.run_id+"/transcript",headers=headers)
            self.assertEqual(response.status_code,200)
            self.assertEqual(response.headers["Cache-Control"],"no-store")
            self.assertEqual(client.get(root+"/runs/"+c.run_id,headers=headers).json()["status"],"unknown")
            self.assertEqual(client.delete(root+"/runs/"+c.run_id+"/transcript",headers=headers).status_code,400)

    async def test_provider_optional_errors_ordering_and_overflow(self):
        adapter=OpenAIAdapter({"api_key":"synthetic-test-key"})
        adapter._capture=True; adapter._optional_updates.add("monitoring-0")
        await adapter._handle({"type":"error","error":{"event_id":"monitoring-0"}})
        self.assertFalse(adapter._capture)
        self.assertTrue(adapter._queue.empty())
        self.assertEqual(adapter._observation_queue.get_nowait()["type"],"transcript_failed")
        adapter._capture=True
        for i in range(70):
            await adapter._handle({"type":"conversation.item.input_audio_transcription.completed",
                "item_id":f"item-{i}","transcript":"synthetic","content_index":0})
        self.assertLessEqual(adapter._observation_queue.qsize(),64)
        self.assertTrue(adapter._queue.empty())
        await adapter._handle({"type":"response.function_call_arguments.done",
            "call_id":"tool-1","name":"synthetic_tool","arguments":"{}"})
        self.assertEqual(adapter._queue.get_nowait()["type"],"tool_call")

    async def test_100000_runs_pagination_and_admission(self):
        now=time.time()
        with self.repo.connect() as db:
            # Bulk fixture creation is outside the bounded application query path.
            db.execute("SET LOCAL statement_timeout='30s'")
            db.execute("INSERT INTO agent_monitoring.runs(run_id,session_id,agent_id,provider,epoch,started,status,capture_version,transcript_state,expires) "
                "SELECT 'load-'||n,'load-session-'||n,'internal','openai','load-epoch',%s-n*.001,'completed',1,'disabled',%s "
                "FROM generate_series(1,100000) n",(now,now+86400))
        start=time.monotonic()
        page=self.repo.list_runs(limit=100)
        second=self.repo.list_runs(limit=100,cursor=page["next_cursor"])
        duration=time.monotonic()-start
        self.assertEqual(len(page["items"]),100)
        self.assertTrue(set(row["run_id"] for row in page["items"]).isdisjoint(row["run_id"] for row in second["items"]))
        c=call(); self.monitor.register(c)
        result=self.flush()
        self.assertEqual(result["lost"],1)
        self.assertIsNone(self.repo.run(c.run_id))
        self.assertEqual(self.repo.overview(0)["outcomes"],[{"status":"completed","count":100000}])
        print(f"100000-run two-page read: {duration:.3f}s")


if __name__ == "__main__":
    unittest.main(verbosity=2)
