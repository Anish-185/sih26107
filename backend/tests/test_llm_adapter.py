"""Checks for the local-LLM adapter (app/llm.py).

Plain Python, no test framework (matches tests/test_retrieval.py). Run with:

    cd backend
    ./.venv/bin/python tests/test_llm_adapter.py

Exit code 0 = all checks passed, 1 = something failed.

The adapter talks to a local LM Studio server. These checks use a stubbed
`httpx.post` so no server is needed. They lock in that:

  - a healthy response is parsed into the assistant message text;
  - every failure mode raises LLMError (never returns a fabricated answer);
  - the LLMError message stays short and user-facing — no internal URL, no
    library hint text — because it is shown verbatim in the UI when the local
    model is unavailable.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx  # noqa: E402

from app import llm as llm_module  # noqa: E402
from app.llm import LLMError, LocalLLM  # noqa: E402

_passed = 0
_failed = 0


def check(name: str, condition: bool, detail: str = "") -> None:
    global _passed, _failed
    if condition:
        _passed += 1
        print(f"  PASS  {name}")
    else:
        _failed += 1
        print(f"  FAIL  {name}" + (f" -- {detail}" if detail else ""))


class FakeResponse:
    def __init__(self, *, json_body=None, status_code: int = 200) -> None:
        self._json = json_body if json_body is not None else {}
        self.status_code = status_code

    def json(self):
        return self._json

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError(
                f"Client error '{self.status_code}'",
                request=httpx.Request("POST", "http://127.0.0.1:1234/v1/chat/completions"),
                response=httpx.Response(self.status_code),
            )


def with_fake_post(fake):
    """Swap app.llm.httpx.post for the duration of a call; restore after."""
    original = llm_module.httpx.post
    llm_module.httpx.post = fake
    return original


def _ask() -> str:
    return LocalLLM().generate(system_prompt="s", user_prompt="u")


# ----------------------------------------------------------------- happy path

def test_healthy_response_is_parsed() -> None:
    def fake_post(*a, **k):
        return FakeResponse(json_body={
            "choices": [{"message": {"content": "  Grounded reply.  "}}]
        })

    original = with_fake_post(fake_post)
    try:
        check("healthy: returns the trimmed assistant message",
              _ask() == "Grounded reply.")
    finally:
        llm_module.httpx.post = original


# --------------------------------------------------------------- failure modes

def test_http_error_status_message_is_clean() -> None:
    def fake_post(*a, **k):
        return FakeResponse(status_code=400)

    original = with_fake_post(fake_post)
    try:
        raised = None
        try:
            _ask()
        except LLMError as exc:
            raised = exc
        check("http 400: raises LLMError", raised is not None)
        msg = str(raised)
        check("http 400: message names the status", "HTTP 400" in msg)
        check("http 400: message does not leak an internal URL",
              "http://" not in msg and "://" not in msg)
        check("http 400: message does not leak a docs link",
              "developer.mozilla.org" not in msg and "For more information" not in msg)
    finally:
        llm_module.httpx.post = original


def test_timeout_message_is_clean() -> None:
    def fake_post(*a, **k):
        raise httpx.ReadTimeout("timed out")

    original = with_fake_post(fake_post)
    try:
        raised = None
        try:
            _ask()
        except LLMError as exc:
            raised = exc
        check("timeout: raises LLMError", raised is not None)
        check("timeout: message names the failure kind",
              "ReadTimeout" in str(raised) and "LM Studio" in str(raised))
        check("timeout: no URL / stack noise in the message",
              "://" not in str(raised))
    finally:
        llm_module.httpx.post = original


def test_connection_error_raises_llm_error() -> None:
    def fake_post(*a, **k):
        raise httpx.ConnectError("connection refused")

    original = with_fake_post(fake_post)
    try:
        raised = None
        try:
            _ask()
        except LLMError as exc:
            raised = exc
        check("connect error: raises LLMError", raised is not None)
        check("connect error: mentions LM Studio", "LM Studio" in str(raised))
        check("connect error: message is short (< 80 chars)",
              len(str(raised)) < 80, str(raised))
    finally:
        llm_module.httpx.post = original


def test_malformed_json_raises_llm_error_not_a_guess() -> None:
    for body in ({}, {"choices": []}, {"choices": [{"message": {}}]},
                 {"choices": [{"message": {"content": "   "}}]}):
        def fake_post(*a, _b=body, **k):
            return FakeResponse(json_body=_b)

        original = with_fake_post(fake_post)
        try:
            raised = None
            try:
                _ask()
            except LLMError as exc:
                raised = exc
            check(f"malformed body {body}: raises LLMError, never a fake answer",
                  raised is not None)
        finally:
            llm_module.httpx.post = original


def main() -> int:
    test_healthy_response_is_parsed()
    test_http_error_status_message_is_clean()
    test_timeout_message_is_clean()
    test_connection_error_raises_llm_error()
    test_malformed_json_raises_llm_error_not_a_guess()

    print(f"\n{_passed} passed, {_failed} failed")
    return 1 if _failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
