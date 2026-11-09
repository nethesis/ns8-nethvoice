"""
Unit tests for the call_processor subprocess entry point.
"""
import io
import json

import httpx
import openai

import call_processor


def _run(monkeypatch, payload) -> tuple[int, dict]:
    stdout = io.StringIO()
    monkeypatch.setattr(call_processor.sys, "stdin", io.StringIO(json.dumps(payload)))
    monkeypatch.setattr(call_processor.sys, "stdout", stdout)
    rc = call_processor.main()
    return rc, json.loads(stdout.getvalue())


def _insufficient_quota() -> openai.RateLimitError:
    request = httpx.Request("POST", "https://api.openai.com/v1/chat/completions")
    response = httpx.Response(429, request=request)
    return openai.RateLimitError("boom", response=response, body={"code": "insufficient_quota"})


def test_success_reports_metrics_snapshot(monkeypatch):
    import metrics

    def fake_embeddings(**kwargs):
        metrics.record_call("openai", "embedding", ok=True)

    monkeypatch.setattr(call_processor.db, "is_configured", lambda: True)
    monkeypatch.setattr(call_processor.db, "replace_transcript_embeddings", fake_embeddings)

    rc, out = _run(monkeypatch, {"transcript_id": 1, "raw_transcription": "hi", "summary": False})

    assert rc == 0
    assert out["ok"] is True
    assert ["openai", "embedding", "success", 1] in out["metrics"]["calls"]
    assert out["metrics"]["credit_exhausted"]["openai"] == 0


def test_failure_reports_metrics_snapshot(monkeypatch):
    import metrics

    def fake_embeddings(**kwargs):
        error = _insufficient_quota()
        metrics.record_call("openai", "embedding", ok=False, error=error)
        raise error

    monkeypatch.setattr(call_processor.db, "is_configured", lambda: True)
    monkeypatch.setattr(call_processor.db, "replace_transcript_embeddings", fake_embeddings)

    rc, out = _run(monkeypatch, {"transcript_id": 1, "raw_transcription": "hi", "summary": True})

    assert rc == 1
    assert out["ok"] is False
    assert ["openai", "embedding", "failure", 1] in out["metrics"]["calls"]
    assert out["metrics"]["credit_exhausted"]["openai"] == 1
