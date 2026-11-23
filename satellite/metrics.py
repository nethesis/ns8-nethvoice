"""
Prometheus metrics for AI provider calls (Deepgram, OpenAI).

The AI enrichment runs in a call_processor subprocess, which records into its
own registry and hands a snapshot() back to the API process to merge().
"""
from typing import Any, Optional

from prometheus_client import (
    CONTENT_TYPE_LATEST,
    CollectorRegistry,
    Counter,
    Gauge,
    GCCollector,
    PlatformCollector,
    ProcessCollector,
    disable_created_metrics,
    generate_latest,
)

PROVIDERS = ("deepgram", "openai")

# Known (provider, operation) pairs, exposed with value 0 before the first call.
OPERATIONS = (
    ("deepgram", "transcription"),
    ("deepgram", "realtime_transcription"),
    ("deepgram", "tts"),
    ("openai", "embedding"),
    ("openai", "clean"),
    ("openai", "summary"),
    ("openai", "sentiment"),
)

RESULTS = ("success", "failure")

UNKNOWN = -1

# Drop the *_created series: they add noise and nothing alerts on them.
disable_created_metrics()

_registry: CollectorRegistry
_credit_exhausted: Gauge
_calls: Counter


def reset() -> None:
    """Start from a fresh registry (process start, and between tests)."""
    global _registry, _credit_exhausted, _calls
    _registry = CollectorRegistry()
    ProcessCollector(registry=_registry)
    PlatformCollector(registry=_registry)
    GCCollector(registry=_registry)
    _credit_exhausted = Gauge(
        "satellite_ai_credit_exhausted",
        "1 if the provider reported no credit left, 0 if its last call succeeded, -1 if not known yet.",
        ["provider"],
        registry=_registry,
    )
    _calls = Counter(
        "satellite_ai_calls",
        "AI provider calls by operation and result.",
        ["provider", "operation", "result"],
        registry=_registry,
    )
    for provider in PROVIDERS:
        _credit_exhausted.labels(provider).set(UNKNOWN)
    for provider, operation in OPERATIONS:
        for result in RESULTS:
            _calls.labels(provider, operation, result)


reset()


def _status_code(error: BaseException) -> Optional[int]:
    status = getattr(error, "status_code", None)  # openai
    if status is None:
        response = getattr(error, "response", None)  # httpx.HTTPStatusError
        status = getattr(response, "status_code", None)
    if status is None:
        status = getattr(error, "status", None)  # DeepgramApiError (str)
    try:
        return int(status)
    except (TypeError, ValueError):
        return None


def is_credit_error(error: Optional[BaseException]) -> bool:
    """True when the provider says the account has no credit left.

    Deepgram answers 402 (Insufficient credits); OpenAI answers 429 with
    code "insufficient_quota". Wrapped exceptions are followed via
    __cause__/__context__.
    """
    seen = set()
    while error is not None and id(error) not in seen:
        seen.add(id(error))
        status = _status_code(error)
        if status == 402:
            return True
        if status == 429 and getattr(error, "code", None) == "insufficient_quota":
            return True
        error = error.__cause__ or error.__context__
    return False


def record_call(provider: str, operation: str, *, ok: bool, error: Optional[BaseException] = None) -> None:
    _calls.labels(provider, operation, "success" if ok else "failure").inc()
    if ok:
        _credit_exhausted.labels(provider).set(0)
    elif is_credit_error(error):
        _credit_exhausted.labels(provider).set(1)


def snapshot() -> dict[str, Any]:
    calls = []
    for metric in _calls.collect():
        for sample in metric.samples:
            if sample.value:
                labels = sample.labels
                calls.append([labels["provider"], labels["operation"], labels["result"], int(sample.value)])
    credit = {}
    for metric in _credit_exhausted.collect():
        for sample in metric.samples:
            credit[sample.labels["provider"]] = int(sample.value)
    return {"calls": calls, "credit_exhausted": credit}


def merge(data: Any) -> None:
    """Merge a snapshot() taken in another process. Malformed input is ignored."""
    if not isinstance(data, dict):
        return
    calls = data.get("calls")
    credit = data.get("credit_exhausted")
    if isinstance(calls, list):
        for item in calls:
            if not (isinstance(item, list) and len(item) == 4):
                continue
            provider, operation, result, count = item
            if result not in RESULTS or not isinstance(count, int) or count <= 0:
                continue
            _calls.labels(str(provider), str(operation), result).inc(count)
    if isinstance(credit, dict):
        for provider, value in credit.items():
            if provider in PROVIDERS and value in (0, 1):
                _credit_exhausted.labels(provider).set(value)


CONTENT_TYPE = CONTENT_TYPE_LATEST


def render() -> str:
    """Return the metrics in Prometheus text exposition format."""
    return generate_latest(_registry).decode("utf-8")
