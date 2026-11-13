from types import SimpleNamespace

import ai


class _FakeChain:
    def __init__(self, responses):
        self._responses = list(responses)
        self.calls = []

    def invoke(self, payload):
        self.calls.append(payload)
        response = self._responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return SimpleNamespace(content=response)


def test_sanitize_text_for_llm_removes_nulls_and_surrogates():
    raw = "hello\x00world\ud800!"

    sanitized = ai._sanitize_text_for_llm(raw)

    assert sanitized == "helloworld!"


def test_invoke_chain_retries_after_invalid_json_body_error():
    chain = _FakeChain(
        [
            Exception("Error code: 400 - We could not parse the JSON body of your request."),
            "final summary",
        ]
    )

    content = ai._invoke_chain(chain, "hello\x00world", "reduce summaries", "summary")

    assert content == "final summary"
    assert len(chain.calls) == 2
    assert chain.calls[0]["text"] == "helloworld"
    assert chain.calls[1]["text"] == "helloworld"


def _openai_metric(operation: str, result: str) -> str:
    from tests.metrics_helpers import sample_value

    return sample_value("satellite_ai_calls_total", provider="openai", operation=operation, result=result)


def test_invoke_chain_counts_success_under_operation():
    chain = _FakeChain(["ok"])

    ai._invoke_chain(chain, "hello", "sentiment scoring", "sentiment")

    assert _openai_metric("sentiment", "success") == "1"
    assert _openai_metric("sentiment", "failure") == "0"


def test_invoke_chain_counts_failure_and_reraises():
    chain = _FakeChain([RuntimeError("boom")])

    try:
        ai._invoke_chain(chain, "hello", "clean chunk 1/1", "clean")
    except RuntimeError:
        pass
    else:
        raise AssertionError("expected RuntimeError")

    assert _openai_metric("clean", "failure") == "1"


def test_invoke_chain_counts_one_success_after_json_retry():
    chain = _FakeChain([Exception("We could not parse the JSON body of your request."), "ok"])

    ai._invoke_chain(chain, "hello", "reduce summaries", "summary")

    assert _openai_metric("summary", "success") == "1"
    assert _openai_metric("summary", "failure") == "0"
