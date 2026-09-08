"""Local LLM adapter for LM Studio."""

from __future__ import annotations

import os

import httpx


class LLMError(RuntimeError):
    """Raised when the local LLM cannot generate a response."""


class LocalLLM:
    """Client for an OpenAI-compatible LM Studio server."""

    def __init__(
        self,
        base_url: str | None = None,
        model: str | None = None,
        timeout: float = 120.0,
    ) -> None:
        self.base_url = (
            base_url
            or os.getenv("LLM_BASE_URL", "http://127.0.0.1:1234/v1")
        ).rstrip("/")
        self.model = model or os.getenv("LLM_MODEL", "qwen/qwen3-8b")
        self.timeout = timeout

    def generate(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.1,
    ) -> str:
        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": f"{user_prompt}\n\n/no_think",
                },
            ],
            "temperature": temperature,
        }

        try:
            response = httpx.post(
                f"{self.base_url}/chat/completions",
                json=payload,
                timeout=self.timeout,
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise LLMError(f"LM Studio request failed: {exc}") from exc

        try:
            data = response.json()
            content = data["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            raise LLMError(
                "LM Studio returned an unexpected response"
            ) from exc

        if not isinstance(content, str) or not content.strip():
            raise LLMError("LM Studio returned an empty response")

        return content.strip()
