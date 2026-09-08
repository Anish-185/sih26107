"""Checks for Phase 8 Hallmarking / HUID information.

Plain Python, no test framework (matches tests/test_retrieval.py). Run with:

    cd backend
    ./.venv/bin/python tests/test_hallmarking.py

Exit code 0 = all checks passed, 1 = something failed.

Phase 8 adds NO new retrieval engine and NO new endpoint: hallmarking / HUID
questions go through the existing deterministic SearchEngine + grounded /ask
pipeline. These checks lock in that behaviour and the trust rules:

  - hallmarking / HUID questions retrieve real BIS hallmarking evidence;
  - the knowledge base contains no HUID number to leak;
  - /ask stays grounded, keeps source provenance, and abstains (no LLM call)
    when retrieval finds nothing;
  - the shared system prompt forbids claiming to verify a specific article or
    emitting a HUID that is not in the supplied context.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api import ask_post, AskRequest  # noqa: E402
from app.rag import SYSTEM_PROMPT, BISQuestionAnswerer  # noqa: E402
from app.retrieval import SearchEngine  # noqa: E402

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


class FakeLLM:
    """Stand-in for LocalLLM — records calls, returns a fixed string."""

    def __init__(self) -> None:
        self.calls: list[dict] = []

    def generate(self, *, system_prompt: str, user_prompt: str,
                 temperature: float = 0.1) -> str:
        self.calls.append({"system": system_prompt, "user": user_prompt})
        return "GROUNDED ANSWER (fake LLM, evidence supplied)."


ENGINE = SearchEngine()
DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "knowledge"

HALLMARK_CATEGORIES = {"hallmarking", "faqs", "consumer_information"}
# "HUID: 1A2B3C" / "HUID is AB1234" — a HUID label followed by an actual code.
HUID_VALUE_RE = re.compile(r"huid\W{0,4}(?:is|no\.?|number|:)?\W{0,4}([a-z0-9]{6})\b", re.I)
_ALLOWED_AFTER_HUID = {"number", "consist", "stands", "allows", "i", "e"}


def _looks_like_real_huid(text: str) -> bool:
    for m in HUID_VALUE_RE.finditer(text):
        token = m.group(1).lower()
        if token in _ALLOWED_AFTER_HUID:
            continue
        if token.isalpha():  # ordinary word, not a code
            continue
        return True
    return False


# --------------------------------------------- 1. knowledge base is sufficient

def test_knowledge_base_covers_hallmarking_and_huid() -> None:
    records: list[dict] = []
    for path in DATA_DIR.glob("*.json"):
        records.extend(json.load(open(path)))

    by_id = {r["id"] for r in records}
    for needed in (
        "what-is-hallmarking",
        "what-is-huid",
        "consumer-verification-of-hallmark",
        "bis-care-app-for-consumers",
        "buying-hallmarked-jewellery-checklist",
        "hallmark-components-since-huid",
    ):
        check(f"KB has record '{needed}'", needed in by_id)

    hallmark_records = [r for r in records if r["category"] == "hallmarking"]
    check("every hallmarking record is verified with a source",
          all(r["verification_status"] == "verified" and r.get("source_url")
              for r in hallmark_records))
    check("every hallmarking source is an official BIS domain",
          all("bis.gov.in" in (r.get("source_url") or "")
              for r in hallmark_records))


# ------------------------------------------------- 2. no HUID number to leak

def test_no_real_huid_in_knowledge_base() -> None:
    offenders: list[str] = []
    for path in DATA_DIR.glob("*.json"):
        for r in json.load(open(path)):
            if _looks_like_real_huid(r.get("content", "")) or _looks_like_real_huid(
                r.get("title", "")
            ):
                offenders.append(r["id"])
    check("no knowledge-base record contains a concrete HUID value",
          not offenders, f"offenders: {offenders}")


# ----------------------------------------------- 3. retrieval stays grounded

def test_hallmarking_questions_retrieve_bis_evidence() -> None:
    for q in (
        "What is HUID and how can a consumer verify it?",
        "What are the three marks on a hallmarked gold article?",
        "How do I check hallmarked jewellery with the BIS Care App?",
        "Which gold purities can be hallmarked in India?",
    ):
        out = ENGINE.search(q, limit=5)
        check(f"{q!r}: not abstained", not out.abstained)
        check(f"{q!r}: top hit is hallmarking-related",
              out.results and out.results[0].item.category in HALLMARK_CATEGORIES)
        check(f"{q!r}: retrieved evidence carries no HUID value",
              not any(_looks_like_real_huid(r.item.content) for r in out.results))


# --------------------------------------- 4. grounded /ask keeps provenance

def test_ask_pipeline_grounds_hallmarking_answer() -> None:
    llm = FakeLLM()
    answerer = BISQuestionAnswerer(search_engine=ENGINE, llm=llm)

    result = answerer.ask("What is HUID and how can a consumer verify it?")
    check("ask: HUID answer is grounded", bool(result.results))
    check("ask: LLM was called once", len(llm.calls) == 1)
    check("ask: evidence was passed to the LLM",
          "BIS EVIDENCE:" in llm.calls[0]["user"])
    check("ask: every source keeps its BIS provenance",
          all(r.item.source_url and r.item.verification_status == "verified"
              for r in result.results))
    check("ask: a hallmarking record is among the sources",
          any(r.item.category in HALLMARK_CATEGORIES for r in result.results))


# ------------------------------------------- 5. abstains, never fabricates

def test_ask_abstains_without_evidence() -> None:
    llm = FakeLLM()
    answerer = BISQuestionAnswerer(search_engine=ENGINE, llm=llm)

    out = answerer.ask("zzzzz qqqqq vvvvv nonsense token")
    check("ask: abstains with no context", out.results == [])
    check("ask: LLM NOT called on abstention", llm.calls == [])
    check("ask: abstention message, not a guess", "couldn't find" in out.answer)


def test_fabrication_request_gets_no_huid_evidence() -> None:
    # "Give me the HUID of a random jewellery item." must not surface a HUID.
    llm = FakeLLM()
    answerer = BISQuestionAnswerer(search_engine=ENGINE, llm=llm)
    out = answerer.ask("Give me the HUID of a random jewellery item.")
    check("fabrication request: no source carries a HUID value",
          not any(_looks_like_real_huid(r.item.content) for r in out.results))
    check("fabrication request: evidence is BIS hallmarking material only",
          all(r.item.category in HALLMARK_CATEGORIES | {"indian_standards"}
              for r in out.results))


# ---------------------------------------------- 6. system prompt trust rule

def test_system_prompt_has_huid_safety_rule() -> None:
    lowered = SYSTEM_PROMPT.lower()
    check("system prompt forbids verifying a specific item",
          "verify" in lowered and "specific" in lowered)
    check("system prompt forbids emitting a HUID not in context",
          "huid" in lowered and "not present in the supplied context" in lowered)


# --------------------------------------------------- 7. /ask API endpoint

def test_ask_api_mapping_and_empty_input() -> None:
    from app.api import _result_to_source

    answerer = BISQuestionAnswerer(search_engine=ENGINE, llm=FakeLLM())
    grounded = answerer.ask("What are the three marks on a hallmarked article?")

    # The /ask route maps each RetrievalResult through _result_to_source.
    sources = [_result_to_source(r) for r in grounded.results]
    check("api mapping: sources keep verification_status",
          sources and all(s.verification_status == "verified" for s in sources))
    check("api mapping: at least one source keeps its source_url",
          any(s.source_url for s in sources))
    check("api mapping: last_verified preserved where present",
          any(s.last_verified for s in sources))

    empty = ask_post(AskRequest(question=""))
    check("api: empty question is not grounded",
          not empty.grounded and empty.source_count == 0 and empty.sources == [])


def main() -> int:
    test_knowledge_base_covers_hallmarking_and_huid()
    test_no_real_huid_in_knowledge_base()
    test_hallmarking_questions_retrieve_bis_evidence()
    test_ask_pipeline_grounds_hallmarking_answer()
    test_ask_abstains_without_evidence()
    test_fabrication_request_gets_no_huid_evidence()
    test_system_prompt_has_huid_safety_rule()
    test_ask_api_mapping_and_empty_input()

    print(f"\n{_passed} passed, {_failed} failed")
    return 1 if _failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
