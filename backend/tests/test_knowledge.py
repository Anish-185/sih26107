"""Checks for the BIS knowledge-base schema and loader.

Plain Python, no test framework (keeps Phase 2A dependency-free). Run it with:

    cd backend
    ./.venv/bin/python tests/test_knowledge.py

Exit code 0 = all checks passed, 1 = something failed.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Make `import app...` work when running this file directly.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pydantic import ValidationError  # noqa: E402

from app.knowledge.loader import DEFAULT_KNOWLEDGE_DIR, load_knowledge_base  # noqa: E402
from app.knowledge.schema import KnowledgeItem  # noqa: E402

FIXTURES = Path(__file__).resolve().parent / "fixtures"

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


def expect_rejected(name: str, data: dict) -> None:
    """Pass only if the schema refuses this record."""
    try:
        KnowledgeItem.model_validate(data)
    except ValidationError as exc:
        print(f"  PASS  {name}  ({exc.error_count()} error(s) reported)")
        globals()["_passed"] += 1
    else:
        globals()["_failed"] += 1
        print(f"  FAIL  {name} -- record was accepted but should have been rejected")


VALID_BASE = {
    "id": "valid-base-item",
    "title": "A valid knowledge item",
    "category": "faqs",
    "content": "This item has everything the schema needs and should validate cleanly.",
    "verification_status": "sample",
    "source_organization": "N/A — test",
}


def test_valid_record_accepted() -> None:
    print("\n[schema] a well-formed record is accepted")
    try:
        item = KnowledgeItem.model_validate(VALID_BASE)
        check("valid record validates", item.id == "valid-base-item")
    except ValidationError as exc:  # pragma: no cover - failure path
        check("valid record validates", False, str(exc))


def test_invalid_records_rejected() -> None:
    print("\n[schema] malformed records are rejected")

    expect_rejected("id that is not a slug", {**VALID_BASE, "id": "Not A Slug!"})
    expect_rejected("content too short", {**VALID_BASE, "content": "tiny"})
    expect_rejected("title too short", {**VALID_BASE, "title": "x"})
    expect_rejected("unknown category", {**VALID_BASE, "category": "made_up"})
    expect_rejected(
        "unknown extra field",
        {**VALID_BASE, "surprise": "should not be allowed"},
    )
    expect_rejected(
        "verified without source_url",
        {
            **VALID_BASE,
            "verification_status": "verified",
            "last_verified": "2026-01-01",
            "source_url": None,
        },
    )
    expect_rejected(
        "non-sample without source_url",
        {**VALID_BASE, "verification_status": "unverified"},
    )
    expect_rejected(
        "indian_standards without standard_number",
        {**VALID_BASE, "category": "indian_standards", "id": "is-no-number"},
    )
    expect_rejected(
        "source_url that is not a URL",
        {**VALID_BASE, "source_url": "www.example.com"},
    )
    expect_rejected(
        "last_verified in the future",
        {
            **VALID_BASE,
            "verification_status": "verified",
            "source_url": "https://www.bis.gov.in/",
            "last_verified": "2999-12-31",
        },
    )


def test_loader_reports_broken_kb() -> None:
    print("\n[loader] a broken knowledge dir is reported, not crashed on")
    result = load_knowledge_base(FIXTURES / "broken_kb")

    check("loader did not raise", True)
    check("result is not ok", not result.ok)

    messages = "\n".join(str(e) for e in result.errors)
    check("invalid JSON reported", "invalid JSON" in messages, messages)
    check("duplicate id reported", "duplicate id" in messages, messages)
    check(
        "category/file mismatch reported",
        "does not match file" in messages,
        messages,
    )


def test_real_kb_loads() -> None:
    print("\n[loader] the real data/knowledge directory loads cleanly")
    result = load_knowledge_base(DEFAULT_KNOWLEDGE_DIR)

    for err in result.errors:
        print(f"    error: {err}")

    check("real knowledge base is valid", result.ok)
    check("at least one item loaded", len(result.items) >= 1)


def main() -> int:
    test_valid_record_accepted()
    test_invalid_records_rejected()
    test_loader_reports_broken_kb()
    test_real_kb_loads()

    print(f"\n{_passed} passed, {_failed} failed")
    return 1 if _failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
