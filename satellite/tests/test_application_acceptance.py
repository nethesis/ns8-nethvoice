"""Phase 4 tests against disposable PostgreSQL; no production/provider credentials."""

import asyncio
import base64
import copy
import os
import ipaddress
import socket
import ssl
import tempfile
import time
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from datetime import datetime, timedelta, timezone
import aiohttp
from aiohttp import web
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

import httpx
from fastapi import FastAPI

from agent.application.api import create_application_routers
from agent.application.contracts import ApplicationError, canonical, connector, schema
from agent.application.crypto import ContentKey
from agent.application.http import HttpTransport, PolicyResolver, RemoteError, bounded_json, mapped_request, permitted_address
from agent.application.repository import ApplicationRepository
from agent.application.responses import OpenAIResponses
from agent.application.service import Application, wire_name
from agent.events import EventSink
from agent.monitoring import Monitoring
from agent.monitoring.repository import HistoryRepository
from agent.tools import ToolRegistry


def object_schema(properties, required):
    return {"type": "object", "properties": properties, "required": required, "additionalProperties": False}


def definition():
    text = {"type": "string", "minLength": 1, "maxLength": 128}
    read = dict(id="lookup", description="Read an authorized customer", method="GET", path="/customers/{customer_id}",
        input_schema=object_schema({"customer_id": text}, ["customer_id"]),
        output_schema=object_schema({"id": text}, ["id"]), query={}, body={}, projection={"id": "id"},
        read_only=True, public_voice=False, timeout_seconds=2, identity_field="customer_id")
    write = dict(id="create_ticket", description="Create the explicitly requested ticket", method="POST", path="/tickets",
        input_schema=object_schema({"customer_id": text, "summary": text, "description": text}, ["customer_id", "summary", "description"]),
        output_schema=object_schema({"id": text}, ["id"]), query={},
        body={"customer_id": "customer_id", "summary": "summary", "description": "description"}, projection={"id": "id"},
        read_only=False, public_voice=False, timeout_seconds=2, identity_field="customer_id", idempotency_header="Idempotency-Key")
    return dict(name="Test service", origin="https://business.example", secret_ref="business-key",
                auth={"type": "bearer"}, private_networks=[], operations=[read, write])


REFS = [{"connector_id": "business", "version": 1, "operation_id": key} for key in ("lookup", "create_ticket")]


class Transport:
    def __init__(self):
        self.calls = []
        self.failure = None
        self.delay = 0

    async def json_request(self, origin, path, method, headers, query, body, networks, timeout, **kw):
        self.calls.append((method, path, copy.deepcopy(headers), body))
        if self.delay:
            await asyncio.sleep(self.delay)
        if self.failure:
            raise self.failure
        return {"id": "ticket-1" if method == "POST" else "customer-1", "private_data": "must be projected out"}


class Adapter:
    async def execute(self, preset, request, context, tools, dispatch, credential, check):
        await check()
        name = wire_name(REFS[1 if request["action"] == "create_ticket" else 0])
        args = {k: v for k, v in request.items() if k != "action"}
        result = await dispatch(name, args, "model-call-1", context)
        return {"summary": "Verified test outcome", "operations": [{"tool": name, **result}]}


class Contracts(unittest.IsolatedAsyncioTestCase):
    async def test_network_policy_ipv4_ipv6(self):
        for ip in ("127.0.0.1", "169.254.169.254", "::1", "fe80::1", "::ffff:8.8.8.8", "0.0.0.0", "224.0.0.1", "10.1.1.1"):
            self.assertFalse(permitted_address(ip, []), ip)
        self.assertTrue(permitted_address("8.8.8.8", []))
        self.assertTrue(permitted_address("10.1.1.1", ["10.1.0.0/16"]))
        self.assertTrue(permitted_address("fd01::1", ["fd01::/48"]))
        self.assertFalse(permitted_address("169.254.169.254", ["169.254.0.0/16"]))

    async def test_dns_answers_revalidated(self):
        resolver = PolicyResolver("business.example", [])
        answer = [(2, 1, 6, "", ("8.8.8.8", 443))]
        async def resolve(*args, **kwargs):
            return answer
        with patch.object(asyncio.get_running_loop(), "getaddrinfo", resolve):
            self.assertEqual((await resolver.resolve("business.example", 443))[0]["host"], "8.8.8.8")
            answer[:] = [(2, 1, 6, "", ("127.0.0.1", 443))]
            with self.assertRaises(ApplicationError):
                await resolver.resolve("business.example", 443)

    async def test_schema_and_endpoint_policy(self):
        connector(definition())
        for change in ("http://business.example", "https://user:password@business.example", "https://business.example/other", "https://business.example:8080"):
            value = definition(); value["origin"] = change
            with self.assertRaises(ApplicationError):
                connector(value)
        value = definition(); value["operations"][1]["idempotency_header"] = "Authorization"
        with self.assertRaises(ApplicationError):
            connector(value)
        with self.assertRaises(ApplicationError):
            schema({"type": "object", "additionalProperties": False, "$ref": "https://attacker.example/schema"})
        value = definition(); value["private_networks"] = ["169.254.0.0/16"]
        with self.assertRaises(ApplicationError):
            connector(value)

    async def test_mapping_and_json_limits(self):
        path, _, _ = mapped_request(definition()["operations"][0], {"customer_id": "../../other?url=https://elsewhere"})
        self.assertTrue(path.startswith("/customers/..%2F..%2F"))
        self.assertNotIn("?url", path)
        with self.assertRaises(ApplicationError):
            mapped_request(definition()["operations"][0], {"customer_id": ".."})
        for value in (b'{"number":NaN}', b"[" * 25 + b"]" * 25, b"x" * (256 * 1024 + 1)):
            with self.assertRaises(ApplicationError):
                bounded_json(value)

    async def test_encryption_purpose_and_missing_key(self):
        key = ContentKey(base64.b64encode(b"x" * 32).decode())
        raw = key.encrypt("input:1", {"text": "private-content"})
        self.assertNotIn(b"private-content", raw)
        self.assertEqual(key.decrypt("input:1", raw)["text"], "private-content")
        with self.assertRaises(ApplicationError):
            key.decrypt("input:2", raw)
        with self.assertRaises(ApplicationError):
            ContentKey("").encrypt("secret", "value")

    async def test_responses_stateless_tool_loop(self):
        class Provider:
            def __init__(self): self.requests = []
            async def json_request(self, origin, path, method, headers, query, body, networks, timeout):
                self.requests.append(body)
                if len(self.requests) == 1:
                    return {"status": "completed", "usage": {"total_tokens": 30, "output_tokens": 10}, "output": [
                        {"type": "reasoning", "encrypted_content": "opaque", "summary": []},
                        {"type": "function_call", "call_id": "call-1", "name": "lookup", "arguments": '{"customer_id":"customer-1"}'}]}
                return {"status": "completed", "usage": {"total_tokens": 40, "output_tokens": 10}, "output": [
                    {"type": "message", "content": [{"type": "output_text", "text": '{"summary":"Customer found"}'}]}]}
        provider = Provider()
        async def check(): pass
        async def dispatch(*args): return {"ok": True, "result": {"id": "customer-1"}}
        result = await OpenAIResponses(provider).execute({"model": "configured-model", "prompt": "Read customer", "max_output_tokens": 1024},
            {"action": "lookup"}, {"deadline_monotonic": time.monotonic() + 30}, [], dispatch, "isolated-key", check)
        self.assertEqual(result["summary"], "Customer found")
        self.assertFalse(provider.requests[0]["store"])
        self.assertEqual(provider.requests[1]["max_output_tokens"], 1014)
        self.assertTrue(any(item.get("type") == "reasoning" for item in provider.requests[1]["input"]))


class Storage(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        if os.getenv("SATELLITE_APPLICATION_ACCEPTANCE") != "isolated" or os.getenv("PGVECTOR_HOST") != "nv-phase4-db":
            self.skipTest("requires explicitly isolated nv-phase4-db")
        self.repo = ApplicationRepository()
        with self.repo.connect() as db:
            db.execute("DROP SCHEMA IF EXISTS agent_application CASCADE")
            db.execute("DROP SCHEMA IF EXISTS agent_monitoring CASCADE")
        self.key = ContentKey(base64.b64encode(b"y" * 32).decode())
        self.repo.initialize("epoch-test")
        self.repo.add_secret("business-key", "isolated-business-key", self.key, "test-admin")
        self.repo.add_secret("provider-key", "isolated-provider-key", self.key, "test-admin")
        self.repo.save("connector", "business", connector(definition()), 0, "test-admin")
        self.repo.publish("connector", "business", 1, "test-admin", connector)
        preset = dict(name="Support", provider="openai_responses", model="configured-model", secret_ref="provider-key", prompt="Use the supplied tools\nReport verified outcomes",
                      operations=REFS, deadline_seconds=30, max_output_tokens=1024, result_retention_hours=24)
        from agent.application.contracts import preset as validate_preset
        self.repo.save("preset", "support-request", preset, 0, "test-admin")
        self.repo.publish("preset", "support-request", 1, "test-admin", validate_preset)
        self.repo.save_grants("support-request", REFS, 0, "test-admin")
        client_definition = dict(scopes=["runs:create", "runs:read", "runs:cancel", "operations:write"], presets=["support-request"], operations=REFS, customer_ids=["customer-1"])
        self.token = self.repo.create_client("client-one", client_definition, time.time() + 3600, "test-admin")["token"]
        self.client = self.repo.authenticate(self.token)
        self.transport = Transport()
        runtime = SimpleNamespace(events=EventSink(), monitoring=Monitoring(), store=SimpleNamespace(revision=9, payload_hash="a" * 64), tools=ToolRegistry())
        self.app = Application(runtime, self.repo, self.key, self.transport, Adapter())
        runtime.tools.extensions = self.app
        self.app.available, self.app.error = True, None
        self.app.epoch = "epoch-test"
        self.repo.set_enabled(True, "test-admin")
        self.app.enabled = True
        self.http = FastAPI()
        for router in create_application_routers(self.app):
            self.http.include_router(router)
        self.http_client = httpx.AsyncClient(transport=httpx.ASGITransport(app=self.http), base_url="https://instance.example")

    async def asyncTearDown(self):
        if hasattr(self, "app"):
            await self.app.stop()
            await self.http_client.aclose()

    def request(self, write=False):
        value = {"action": "create_ticket" if write else "lookup", "customer_id": "customer-1"}
        if write:
            value.update(summary="A support ticket", description="Explicit requested action")
        return {"preset_id": "support-request", "version": 1, "input": value}

    async def settle(self, run_id):
        task = self.app.active.get(run_id, {}).get("task")
        if task:
            await asyncio.wait_for(task, 5)
        return self.repo.run(run_id)

    async def test_admission_and_committed_result_without_ari(self):
        result = await self.app.submit(self.client, self.request(True), "business-request-1")
        row = await self.settle(result["run_id"])
        self.assertEqual(row["status"], "completed")
        self.assertEqual(self.repo.effects(row["run_id"])[0]["state"], "committed")
        self.assertIsNone(row["input"])
        stored = self.key.decrypt(f"result:{row['run_id']}", row["result"])
        self.assertEqual(stored["operations"][0]["result"], {"id": "ticket-1"})
        self.assertNotIn(b"ticket-1", bytes(row["result"]))
        self.assertTrue(self.transport.calls[0][2]["Idempotency-Key"])

    async def test_concurrent_duplicate_admission_and_input_conflict(self):
        results = await asyncio.gather(*(self.app.submit(self.client, self.request(), "same-request") for _ in range(2)))
        self.assertEqual(results[0]["run_id"], results[1]["run_id"])
        await self.settle(results[0]["run_id"])
        self.assertEqual(len(self.transport.calls), 1)
        with self.assertRaises(ApplicationError) as failure:
            await self.app.submit(self.client, self.request(True), "same-request")
        self.assertEqual(failure.exception.status, 409)

    async def test_distinct_model_ids_share_one_effect(self):
        admitted = await self.app.submit(self.client, self.request(True), "write-repeat")
        # Pin a server-owned context while the original admitted execution also runs.
        row = self.repo.run(admitted["run_id"])
        snapshot = self.key.decrypt(f"snapshot:{row['run_id']}", row["snapshot"])
        ctx = dict(run_id=row["run_id"], agent_id="support-request", execution_kind="api", principal="client-one", profile={"tools": {}},
                   connector_tools=snapshot["connectors"], authorized_input=self.request(True)["input"], deadline_monotonic=time.monotonic() + 10)
        args = {k: v for k, v in self.request(True)["input"].items() if k != "action"}
        a = await self.app.runtime.tools.dispatch(wire_name(REFS[1]), args, "second-model-call", ctx)
        await self.settle(row["run_id"])
        b = await self.app.runtime.tools.dispatch(wire_name(REFS[1]), args, "third-model-call", ctx)
        self.assertTrue(a["ok"] and b["ok"])
        self.assertEqual(sum(call[0] == "POST" for call in self.transport.calls), 1)

    async def test_ambiguous_write_is_not_retried(self):
        self.transport.failure = RemoteError("remote_unavailable")
        result = await self.app.submit(self.client, self.request(True), "uncertain-write")
        row = await self.settle(result["run_id"])
        self.assertTrue(row["reconciliation_required"])
        self.assertEqual(row["status"], "failed")
        self.assertEqual(len(self.transport.calls), 1)
        self.assertEqual(self.repo.effects(row["run_id"])[0]["state"], "unknown")

    async def test_malformed_success_preserves_uncertainty(self):
        async def malformed(*args, **kwargs): return {"other": "unexpected"}
        self.app.transport.json_request = malformed
        result = await self.app.submit(self.client, self.request(True), "invalid-output")
        row = await self.settle(result["run_id"])
        self.assertTrue(row["reconciliation_required"])

    async def test_live_grant_revocation_and_customer_scope(self):
        self.repo.save_grants("support-request", [], 1, "test-admin")
        with self.assertRaises(ApplicationError):
            await self.app.submit(self.client, self.request(), "revoked-grant")
        request = self.request(); request["input"]["customer_id"] = "another-customer"
        with self.assertRaises(ApplicationError) as error:
            await self.app.submit(self.client, request, "other-customer")
        self.assertEqual(error.exception.status, 403)
        self.assertEqual(self.transport.calls, [])

    async def test_cancel_write_keeps_effect_record(self):
        self.transport.delay = 5
        result = await self.app.submit(self.client, self.request(True), "cancel-write")
        for _ in range(100):
            if self.transport.calls: break
            await asyncio.sleep(.01)
        await self.app.cancel(self.client, result["run_id"])
        row = await self.settle(result["run_id"])
        self.assertEqual(row["status"], "failed")
        self.assertTrue(row["reconciliation_required"])
        self.assertEqual(len(self.repo.effects(row["run_id"])), 1)

    async def test_machine_ownership_tokens_and_input_limits(self):
        url = "/agents-api/v1/runs"
        response = await self.http_client.post(url, json=self.request())
        self.assertEqual(response.status_code, 401)
        headers = {"Authorization": "Bearer " + self.token, "Idempotency-Key": "http-request"}
        response = await self.http_client.post(url, json=self.request(), headers=headers)
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.headers["cache-control"], "no-store")
        run_id = response.json()["run_id"]
        await self.settle(run_id)
        other = copy.deepcopy(self.client["definition"])
        token = self.repo.create_client("client-two", other, time.time() + 3600, "test-admin")["token"]
        response = await self.http_client.get(url + "/" + run_id, headers={"Authorization": "Bearer " + token})
        self.assertEqual(response.status_code, 404)
        response = await self.http_client.post(url, headers={**headers, "Content-Type": "application/json"}, content=b'"' + b"x" * 33000 + b'"')
        self.assertEqual(response.status_code, 413)
        self.repo.revoke_client("client-one", "test-admin")
        response = await self.http_client.get(url + "/" + run_id, headers=headers)
        self.assertEqual(response.status_code, 401)

    async def test_restart_recovery_does_not_resume_or_repeat(self):
        self.transport.delay = 5
        result = await self.app.submit(self.client, self.request(True), "restart-write")
        for _ in range(100):
            if self.transport.calls: break
            await asyncio.sleep(.01)
        await self.app.stop()
        self.repo.initialize("new-epoch")
        row = self.repo.run(result["run_id"])
        self.assertTrue(row["reconciliation_required"])
        self.assertEqual(len(self.transport.calls), 1)

    async def test_secret_version_rotation_and_revocation(self):
        with self.assertRaises(ApplicationError):
            self.repo.add_secret("business-key", "replacement", self.key, "test-admin")
        self.repo.revoke_secret("business-key", "test-admin")
        result = await self.app.submit(self.client, self.request(), "revoked-secret")
        row = await self.settle(result["run_id"])
        self.assertEqual(row["status"], "failed")
        self.assertEqual(self.transport.calls, [])

    async def test_orphan_recovery_preserves_live_owner_and_unknown_effect(self):
        request = self.request(True)
        snapshot = {"preset": {"result_retention_hours": 24}, "connectors": []}
        first, _ = self.repo.admit("client-one", "orphan", request, snapshot, self.app.epoch, self.key, 9, {})
        second, _ = self.repo.admit("client-one", "owned", request, snapshot, self.app.epoch, self.key, 9, {})
        effect, _ = self.repo.prepare_effect(first["run_id"], "create_ticket", request["input"], REFS[1])
        self.repo.dispatch_effect(effect["operation_id"])
        self.repo.recover_orphans(self.app.epoch, [second["run_id"]])
        row = self.repo.run(first["run_id"])
        self.assertEqual(row["status"], "interrupted")
        self.assertTrue(row["reconciliation_required"])
        self.assertEqual(self.repo.effects(first["run_id"])[0]["state"], "unknown")
        self.assertEqual(self.repo.run(second["run_id"])["status"], "accepted")

    async def test_admission_capacity_includes_encrypted_snapshot(self):
        snapshot = {"preset": {"result_retention_hours": 24}, "large": "x" * 50000}
        with patch("agent.application.repository.MAX_CONTENT", 150000):
            with self.assertRaises(ApplicationError) as caught:
                self.repo.admit("client-one", "capacity", self.request(), snapshot, self.app.epoch, self.key, 9, {})
        self.assertEqual(caught.exception.code, "execution_capacity")

    async def test_expiry_and_clone_preserve_effect_protection(self):
        result = await self.app.submit(self.client, self.request(True), "expiry-write")
        row = await self.settle(result["run_id"])
        with self.repo.connect() as db:
            db.execute("UPDATE agent_application.runs SET result_expires=%s", (time.time() - 1,))
        self.repo.purge()
        self.assertEqual((await self.app.result(self.client, row["run_id"]))["state"], "expired")
        self.assertEqual(len(self.repo.effects(row["run_id"])), 1)
        self.repo.disable_clone()
        self.assertFalse(self.repo.enabled())
        with self.assertRaises(ApplicationError):
            self.repo.authenticate(self.token)

    async def test_monitoring_api_runs_and_terminal_events(self):
        monitor = self.app.runtime.monitoring
        monitor.repository.initialize(monitor.epoch)
        result = await self.app.submit(self.client, self.request(), "metadata-api")
        await self.settle(result["run_id"])
        # Events use the same sink as the voice runtime in the actual composition.
        for event in self.app.runtime.events.recent():
            monitor.event(event)
        monitor.repository.write([item[0] for item in monitor._queue], monitor.epoch, 0)
        row = monitor.repository.run(result["run_id"])
        self.assertEqual(row["execution_kind"], "api")
        self.assertEqual(row["status"], "completed")
        self.assertIsNone(row["session_id"])
        self.assertEqual(row["definition_revision"], 1)
        self.assertEqual(len(monitor.repository.list_runs(execution_kind="api")["items"]), 1)

    async def test_admin_actor_and_write_confirmation(self):
        with patch.dict(os.environ, {"API_TOKEN": "isolated-private-token"}):
            url = "/api/agent/v1/application/test-runs"
            headers = {"Authorization": "Bearer isolated-private-token"}
            payload = {"client_id": "client-one", "request": self.request(True), "idempotency_key": "admin-write", "confirm_write": False}
            response = await self.http_client.post(url, headers=headers, json=payload)
            self.assertEqual(response.status_code, 401)
            headers["X-Agents-Actor"] = "test-admin"
            response = await self.http_client.post(url, headers=headers, json=payload)
            self.assertEqual(response.status_code, 403)
            self.assertEqual(self.transport.calls, [])

    async def test_control_storage_failure_never_returns_admission(self):
        with patch.object(self.repo, "admit", side_effect=OSError("isolated database failure")):
            response = await self.http_client.post("/agents-api/v1/runs", json=self.request(), headers={
                "Authorization": "Bearer " + self.token, "Idempotency-Key": "db-failed-request"})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(self.app.active, {})
        self.assertEqual(self.transport.calls, [])

    async def test_admin_cancellation_and_bounded_audit(self):
        self.transport.delay = 2
        result = await self.app.submit(self.client, self.request(), "admin-cancel")
        with patch.dict(os.environ, {"API_TOKEN": "isolated-private-token"}):
            response = await self.http_client.post("/api/agent/v1/application/runs/" + result["run_id"] + "/cancel",
                headers={"Authorization": "Bearer isolated-private-token", "X-Agents-Actor": "test-admin"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual((await self.settle(result["run_id"]))["status"], "cancelled")
        with patch("agent.application.repository.MAX_RECORDS", 2):
            for _ in range(4):
                self.repo.record_audit("test-admin", "test", "bounded")
        with self.repo.connect() as db:
            self.assertLessEqual(db.execute("SELECT count(*) AS n FROM agent_application.audit").fetchone()["n"], 2)

    async def test_reconciliation_reads_receipt_without_repeating_write(self):
        cfg = definition()
        receipt = copy.deepcopy(cfg["operations"][0])
        receipt.update(id="receipt", path="/effects/{operation_id}", identity_field=None,
            input_schema=object_schema({"operation_id": {"type": "string"}}, ["operation_id"]))
        cfg["operations"].append(receipt)
        cfg["operations"][1]["reconcile"] = {"operation": "receipt", "argument": "operation_id", "result_field": "id"}
        self.repo.save("connector", "business", connector(cfg), 2, "test-admin")
        self.repo.publish("connector", "business", 3, "test-admin", connector)
        ref = {"connector_id": "business", "version": 2, "operation_id": "create_ticket"}
        row, _ = self.repo.admit("client-one", "reconcile", self.request(True),
            {"preset": {"result_retention_hours": 24}}, self.app.epoch, self.key, 9, {})
        effect, _ = self.repo.prepare_effect(row["run_id"], "create_ticket", self.request(True)["input"], ref)
        self.repo.dispatch_effect(effect["operation_id"])
        self.repo.settle_effect(effect["operation_id"], "unknown", None, self.key)
        result = await self.app.reconcile(effect["operation_id"], "test-admin")
        self.assertEqual(result["state"], "committed")
        self.assertEqual(len(self.transport.calls), 1)
        self.assertEqual(self.transport.calls[0][0:2], ("GET", "/effects/" + effect["operation_id"]))

    async def test_voice_grants_pin_version_and_revoke_before_request(self):
        cfg = definition()
        cfg["operations"][0]["public_voice"] = True
        cfg["operations"][0]["identity_field"] = None
        self.repo.save("connector", "business", connector(cfg), 2, "test-admin")
        self.repo.publish("connector", "business", 3, "test-admin", connector)
        ref = {"connector_id": "business", "version": 2, "operation_id": "lookup"}
        self.repo.save_grants("internal", [ref], 0, "test-admin")
        self.repo.save_grants("external", [ref], 0, "test-admin")
        bindings = await self.app.voice_bindings("internal", "external")
        self.assertEqual(bindings[0]["reference"]["version"], 2)
        context = {"run_id": "voice-test", "agent_id": "internal", "execution_kind": "voice", "origin": "external",
                   "profile": {"tools": {}}, "connector_tools": bindings, "deadline_monotonic": time.monotonic()+5}
        result = await self.app.runtime.tools.dispatch(wire_name(ref), {"customer_id": "public-customer"}, "voice-tool-1", context)
        self.assertTrue(result["ok"])
        self.repo.save_grants("external", [], 1, "test-admin")
        result = await self.app.runtime.tools.dispatch(wire_name(ref), {"customer_id": "public-customer"}, "voice-tool-2", context)
        self.assertFalse(result["ok"])
        self.assertEqual(len(self.transport.calls), 1)

    async def test_two_pinned_versions_dispatch_the_selected_version(self):
        cfg = definition()
        cfg["operations"][0]["path"] = "/v2/customers/{customer_id}"
        self.repo.save("connector", "business", connector(cfg), 2, "test-admin")
        self.repo.publish("connector", "business", 3, "test-admin", connector)
        newer = {"connector_id": "business", "version": 2, "operation_id": "lookup"}
        refs = [REFS[0], newer]
        self.repo.save_grants("support-request", refs, 1, "test-admin")
        client_definition = copy.deepcopy(self.client["definition"])
        client_definition["operations"] = refs
        token = self.repo.create_client("versions-client", client_definition, time.time()+3600, "test-admin")["token"]
        client = self.repo.authenticate(token)
        context = {"run_id": "versions-test", "agent_id": "support-request", "execution_kind": "api",
            "principal": client["client_id"], "authorized_input": self.request()["input"], "profile": {"tools": {}},
            "connector_tools": self.repo.resolve(refs), "deadline_monotonic": time.monotonic()+5}
        for index, ref in enumerate(refs):
            result = await self.app.runtime.tools.dispatch(wire_name(ref), {"customer_id": "customer-1"}, "version-"+str(index), context)
            self.assertTrue(result["ok"])
        self.assertEqual([call[1] for call in self.transport.calls], ["/customers/customer-1", "/v2/customers/customer-1"])

    async def test_https_transport_limits_redirects_and_tls(self):
        # Real HTTPS in the disposable test container; production trust stays intact.
        host = socket.gethostbyname(socket.gethostname())
        network = str(ipaddress.ip_network(host + "/16", strict=False))
        private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "isolated-transport")])
        cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(private.public_key())
            .serial_number(x509.random_serial_number()).not_valid_before(datetime.now(timezone.utc)-timedelta(minutes=1))
            .not_valid_after(datetime.now(timezone.utc)+timedelta(hours=1))
            .add_extension(x509.SubjectAlternativeName([x509.IPAddress(ipaddress.ip_address(host))]), False)
            .sign(private, hashes.SHA256()))
        with tempfile.TemporaryDirectory() as directory:
            cert_path, key_path = directory+'/cert.pem', directory+'/key.pem'
            with open(cert_path,'wb') as f: f.write(cert.public_bytes(serialization.Encoding.PEM))
            with open(key_path,'wb') as f: f.write(private.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()))
            server_ssl = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); server_ssl.load_cert_chain(cert_path,key_path)
            app = web.Application()
            counters = {"redirect_target": 0}
            async def valid(request): return web.json_response({"id":"visible", "private":"hidden"})
            async def redirect(request): return web.Response(status=302,headers={"Location":"/target"})
            async def target(request): counters["redirect_target"]+=1; return web.json_response({"id":"wrong"})
            async def huge(request): return web.json_response({"id":"x"*(256*1024)})
            async def media(request): return web.Response(text='<script>unsafe</script>',content_type='text/html')
            async def compressed(request): return web.Response(body=b'compressed',headers={"Content-Type":"application/json","Content-Encoding":"gzip"})
            for route,handler in [("/valid",valid),("/redirect",redirect),("/target",target),("/huge",huge),("/media",media),("/compressed",compressed)]:
                app.router.add_get(route,handler)
            runner=web.AppRunner(app); await runner.setup()
            await web.TCPSite(runner,'0.0.0.0',8443,ssl_context=server_ssl).start()
            try:
                transport=HttpTransport(); origin='https://'+host+':8443'
                with self.assertRaises(ApplicationError):
                    await transport.json_request(origin,'/valid','GET',{}, {},None,[network],2)
                client_ssl=ssl.create_default_context(cafile=cert_path)
                original=aiohttp.TCPConnector
                def trusted_connector(*args,**kwargs):
                    kwargs['ssl']=client_ssl
                    return original(*args,**kwargs)
                with patch('aiohttp.TCPConnector',trusted_connector):
                    self.assertEqual((await transport.json_request(origin,'/valid','GET',{}, {},None,[network],2))['id'],'visible')
                    for route in ('redirect','huge','media','compressed'):
                        with self.assertRaises(ApplicationError):
                            await transport.json_request(origin,'/'+route,'GET',{}, {},None,[network],2)
                self.assertEqual(counters['redirect_target'],0)
            finally:
                await runner.cleanup()


if __name__ == "__main__":
    unittest.main(verbosity=2)
