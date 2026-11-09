"""
Unit tests for the AI provider metrics registry.
"""
import httpx
import openai
import pytest
from deepgram.clients.common.v1.errors import DeepgramApiError

import metrics
from tests.metrics_helpers import sample_value


def _sample(text: str, name: str, **labels) -> str:
    return sample_value(name, text, **labels)


def _openai_error(status: int, code: str | None) -> openai.APIStatusError:
    request = httpx.Request("POST", "https://api.openai.com/v1/chat/completions")
    response = httpx.Response(status, request=request)
    body = {"message": "boom", "type": code, "code": code}
    if status == 429:
        return openai.RateLimitError("boom", response=response, body=body)
    return openai.APIStatusError("boom", response=response, body=body)


def _http_status_error(status: int) -> httpx.HTTPStatusError:
    request = httpx.Request("POST", "https://api.deepgram.com/v1/listen")
    response = httpx.Response(status, request=request)
    return httpx.HTTPStatusError("boom", request=request, response=response)


class TestCreditExhausted:
    def test_unknown_at_start(self):
        text = metrics.render()

        assert _sample(text, "satellite_ai_credit_exhausted", provider="deepgram") == "-1"
        assert _sample(text, "satellite_ai_credit_exhausted", provider="openai") == "-1"

    def test_success_sets_zero(self):
        metrics.record_call("openai", "summary", ok=True)

        assert _sample(metrics.render(), "satellite_ai_credit_exhausted", provider="openai") == "0"

    def test_credit_error_sets_one(self):
        metrics.record_call("deepgram", "transcription", ok=False, error=_http_status_error(402))

        assert _sample(metrics.render(), "satellite_ai_credit_exhausted", provider="deepgram") == "1"

    def test_other_error_keeps_previous_value(self):
        metrics.record_call("deepgram", "transcription", ok=False, error=_http_status_error(402))
        metrics.record_call("deepgram", "transcription", ok=False, error=httpx.ReadTimeout("slow"))

        assert _sample(metrics.render(), "satellite_ai_credit_exhausted", provider="deepgram") == "1"

    def test_success_after_credit_error_clears(self):
        metrics.record_call("deepgram", "tts", ok=False, error=_http_status_error(402))
        metrics.record_call("deepgram", "tts", ok=True)

        assert _sample(metrics.render(), "satellite_ai_credit_exhausted", provider="deepgram") == "0"


class TestIsCreditError:
    def test_deepgram_http_402(self):
        assert metrics.is_credit_error(_http_status_error(402)) is True

    def test_deepgram_sdk_402(self):
        assert metrics.is_credit_error(DeepgramApiError("no credits", "402")) is True

    def test_openai_insufficient_quota(self):
        assert metrics.is_credit_error(_openai_error(429, "insufficient_quota")) is True

    def test_openai_rate_limit_is_not_credit(self):
        assert metrics.is_credit_error(_openai_error(429, "rate_limit_exceeded")) is False

    def test_auth_error_is_not_credit(self):
        assert metrics.is_credit_error(_http_status_error(401)) is False

    def test_wrapped_error_is_found(self):
        try:
            try:
                raise _openai_error(429, "insufficient_quota")
            except Exception as inner:
                raise RuntimeError("wrapped") from inner
        except RuntimeError as outer:
            assert metrics.is_credit_error(outer) is True

    def test_none_is_not_credit(self):
        assert metrics.is_credit_error(None) is False


class TestCalls:
    def test_known_series_start_at_zero(self):
        text = metrics.render()

        for provider, operation in metrics.OPERATIONS:
            for result in ("success", "failure"):
                assert _sample(
                    text, "satellite_ai_calls_total",
                    provider=provider, operation=operation, result=result,
                ) == "0"

    def test_counts_success_and_failure(self):
        metrics.record_call("openai", "clean", ok=True)
        metrics.record_call("openai", "clean", ok=True)
        metrics.record_call("openai", "clean", ok=False)

        text = metrics.render()
        assert _sample(text, "satellite_ai_calls_total", provider="openai", operation="clean", result="success") == "2"
        assert _sample(text, "satellite_ai_calls_total", provider="openai", operation="clean", result="failure") == "1"

    def test_render_declares_types(self):
        text = metrics.render()

        assert "# TYPE satellite_ai_credit_exhausted gauge" in text
        assert "# TYPE satellite_ai_calls_total counter" in text

    def test_render_includes_process_metrics(self):
        text = metrics.render()

        assert "process_resident_memory_bytes " in text
        assert "python_gc_objects_collected_total" in text


class TestSnapshotMerge:
    def test_merge_adds_counts_and_applies_known_credit_state(self):
        metrics.record_call("openai", "summary", ok=True)
        metrics.record_call("openai", "sentiment", ok=False, error=_openai_error(429, "insufficient_quota"))
        snapshot = metrics.snapshot()

        metrics.reset()
        metrics.record_call("openai", "summary", ok=True)
        metrics.merge(snapshot)

        text = metrics.render()
        assert _sample(text, "satellite_ai_calls_total", provider="openai", operation="summary", result="success") == "2"
        assert _sample(text, "satellite_ai_calls_total", provider="openai", operation="sentiment", result="failure") == "1"
        assert _sample(text, "satellite_ai_credit_exhausted", provider="openai") == "1"

    def test_merge_keeps_credit_state_when_child_did_not_know(self):
        metrics.record_call("deepgram", "transcription", ok=True)

        metrics.merge({"calls": [], "credit_exhausted": {"deepgram": -1, "openai": -1}})

        assert _sample(metrics.render(), "satellite_ai_credit_exhausted", provider="deepgram") == "0"

    def test_merge_ignores_malformed_input(self):
        metrics.merge({"calls": [["openai"]], "credit_exhausted": "nope"})
        metrics.merge(None)

        assert _sample(metrics.render(), "satellite_ai_credit_exhausted", provider="openai") == "-1"
