"""Local LLM adapter for LM Studio."""

from __future__ import annotations

import os
import re

import httpx

# Reasoning models (Qwen3) emit a <think>...</think> block before the answer.
# We ask the server to skip it, but strip any that slips through so the grounded
# text stays clean and short.
_THINK_BLOCK = re.compile(r"<think>.*?</think>", re.DOTALL)


class LLMError(RuntimeError):
    """Raised when the local LLM cannot generate a response."""


class LocalLLM:
    """Client for an OpenAI-compatible LM Studio server."""

    def __init__(
        self,
        base_url: str | None = None,
        model: str | None = None,
        timeout: float = 150.0,
    ) -> None:
        # LM_STUDIO_* are the documented names; LLM_* kept as a fallback so
        # existing setups keep working.
        self.base_url = (
            base_url
            or os.getenv("LM_STUDIO_BASE_URL")
            or os.getenv("LLM_BASE_URL")
            or "http://127.0.0.1:1234/v1"
        ).rstrip("/")
        self.model = (
            model
            or os.getenv("LM_STUDIO_MODEL")
            or os.getenv("LLM_MODEL")
            or "qwen/qwen3-4b"
        )
        self.timeout = timeout

    def generate(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.1,
        max_tokens: int = 400,
    ) -> str:
        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": f"{system_prompt}\n\n/no_think",
                },
                {
                    "role": "user",
                    "content": f"{user_prompt}\n\n/no_think",
                },
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
            # Qwen3 / LM Studio: disable the reasoning pass entirely.
            "chat_template_kwargs": {"enable_thinking": False},
        }

        try:
            response = httpx.post(
                f"{self.base_url}/chat/completions",
                json=payload,
                timeout=self.timeout,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            # LM Studio answered, but with an error status. Keep the message
            # short and user-facing — no internal URL or library hint text.
            raise LLMError(
                f"LM Studio returned HTTP {exc.response.status_code}"
            ) from exc
        except httpx.HTTPError as exc:
            # Timeout, connection refused, DNS, etc. Name the failure kind
            # without dumping the full transport exception.
            raise LLMError(
                f"could not reach LM Studio ({exc.__class__.__name__})"
            ) from exc

        try:
            data = response.json()
            content = data["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            raise LLMError(
                "LM Studio returned an unexpected response"
            ) from exc

        if not isinstance(content, str) or not content.strip():
            raise LLMError("LM Studio returned an empty response")

        content = _THINK_BLOCK.sub("", content).strip()
        if not content:
            raise LLMError("LM Studio returned an empty response")

        return content
