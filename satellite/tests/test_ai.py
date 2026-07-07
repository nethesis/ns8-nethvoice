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

    content = ai._invoke_chain(chain, "hello\x00world", "reduce summaries")

    assert content == "final summary"
    assert len(chain.calls) == 2
    assert chain.calls[0]["text"] == "helloworld"
    assert chain.calls[1]["text"] == "helloworld"
