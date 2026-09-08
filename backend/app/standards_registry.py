"""Verified Indian Standard registry + Product -> Standard lookup (Phase 14).

The registry is a small, hand-verified JSON file (``data/standards_registry.json``).
It is intentionally separate from ``data/knowledge/`` (the BIS Q&A knowledge base),
which contains no food-product standards.

Hard rules:
  * Only ``status == "verified"`` records are ever returned.
  * A standard number is NEVER synthesised. If nothing in the registry clears the
    match threshold, the lookup returns ``status == "REVIEW"`` with ``standard is
    None`` and an explanation.
  * FSSAI regulations are not Indian Standards and are not in this registry.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

# data/standards_registry.json  (repo_root/data/…)
_REGISTRY_PATH = Path(__file__).resolve().parents[2] / "data" / "standards_registry.json"

# A match is only accepted when the best registry entry clears this score and the
# longest matched keyword phrase is at least two words (so a single generic word
# like "water" or "gram" alone can never pull in a standard).
_MATCH_THRESHOLD = 0.75
_MIN_PHRASE_WORDS = 2


class RegistryError(RuntimeError):
    """The standards registry file is missing or malformed."""


@dataclass(frozen=True)
class VerifiedStandard:
    standard_number: str
    title: str
    product_keywords: tuple[str, ...]
    category: str
    source: str
    source_url: str
    reference: str
    status: str
    last_verified: str


@dataclass(frozen=True)
class StandardMatch:
    """Outcome of one Product -> Standard lookup."""

    status: str  # "MATCHED" | "REVIEW"
    normalized_product: str
    standard: VerifiedStandard | None
    confidence: float
    matched_keywords: list[str] = field(default_factory=list)
    reason: str = ""


# --------------------------------------------------------------------------- load


def _normalize(text: str) -> str:
    """Lowercase, drop punctuation, collapse whitespace."""
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", " ", (text or "").lower())).strip()


@lru_cache(maxsize=1)
def load_registry(path: str | None = None) -> tuple[VerifiedStandard, ...]:
    p = Path(path) if path else _REGISTRY_PATH
    try:
        raw = json.loads(p.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise RegistryError(f"standards registry not found at {p}") from exc
    except json.JSONDecodeError as exc:
        raise RegistryError(f"standards registry is not valid JSON: {exc}") from exc

    rows = raw.get("standards") if isinstance(raw, dict) else raw
    if not isinstance(rows, list) or not rows:
        raise RegistryError("standards registry has no 'standards' list")

    out: list[VerifiedStandard] = []
    for i, r in enumerate(rows):
        try:
            std = VerifiedStandard(
                standard_number=str(r["standard_number"]).strip(),
                title=str(r["title"]).strip(),
                product_keywords=tuple(
                    _normalize(k) for k in r.get("product_keywords", []) if k.strip()
                ),
                category=str(r.get("category", "")).strip().lower(),
                source=str(r.get("source", "")).strip(),
                source_url=str(r.get("source_url", "")).strip(),
                reference=str(r.get("reference", "")).strip(),
                status=str(r.get("status", "")).strip().lower(),
                last_verified=str(r.get("last_verified", "")).strip(),
            )
        except (KeyError, TypeError) as exc:
            raise RegistryError(f"standards registry row {i} is missing a field: {exc}") from exc

        if std.status != "verified":
            # Refuse to load an unverified row rather than silently keep it out of
            # results — the registry is meant to be verified-only.
            raise RegistryError(
                f"registry row {std.standard_number!r} is not 'verified' "
                f"(status={std.status!r}); remove it or verify it"
            )
        if not std.source_url.startswith(("http://", "https://")):
            raise RegistryError(
                f"registry row {std.standard_number!r} has no usable source_url"
            )
        if not std.product_keywords:
            raise RegistryError(
                f"registry row {std.standard_number!r} has no product_keywords"
            )
        out.append(std)
    return tuple(out)


# ------------------------------------------------------------------------- lookup


def _phrase_present(phrase: str, haystack: str) -> bool:
    """Whole-token phrase containment on normalized text."""
    if not phrase:
        return False
    return f" {phrase} " in f" {haystack} "


def _score(entry: VerifiedStandard, product_blob: str) -> tuple[float, list[str], int]:
    matched = [kw for kw in entry.product_keywords if _phrase_present(kw, product_blob)]
    if not matched:
        return 0.0, [], 0
    longest_words = max(len(kw.split()) for kw in matched)
    # Deterministic, bounded score. More matched keywords and a longer matched
    # phrase both raise confidence; capped below a claim of certainty.
    raw = 0.5 + 0.10 * len(matched) + 0.09 * longest_words
    return min(raw, 0.97), matched, longest_words


def lookup_standard(
    normalized_product: str,
    *,
    extra_terms: str = "",
    registry_path: str | None = None,
) -> StandardMatch:
    """Match a classified product against the verified registry.

    ``normalized_product`` is the classifier's normalised product name (e.g.
    "Roasted Bengal Gram"). ``extra_terms`` may carry the raw product name /
    description for a little extra recall; it never overrides the threshold.
    """
    normalized_product = (normalized_product or "").strip()
    blob = _normalize(f"{normalized_product} {extra_terms}")

    if not blob:
        return StandardMatch(
            status="REVIEW",
            normalized_product=normalized_product,
            standard=None,
            confidence=0.0,
            reason="No classified product to match against the standards registry.",
        )

    try:
        registry = load_registry(registry_path)
    except RegistryError as exc:
        return StandardMatch(
            status="REVIEW",
            normalized_product=normalized_product,
            standard=None,
            confidence=0.0,
            reason=f"Standards registry unavailable: {exc}",
        )

    best: tuple[float, list[str], int, VerifiedStandard] | None = None
    for entry in registry:
        score, matched, longest = _score(entry, blob)
        if score <= 0:
            continue
        if best is None or score > best[0]:
            best = (score, matched, longest, entry)

    if best is None:
        return StandardMatch(
            status="REVIEW",
            normalized_product=normalized_product,
            standard=None,
            confidence=0.0,
            reason=(
                "No verified standard in the registry shares product keywords with "
                f"'{normalized_product or extra_terms.strip()}'."
            ),
        )

    score, matched, longest, entry = best
    if score < _MATCH_THRESHOLD or longest < _MIN_PHRASE_WORDS:
        return StandardMatch(
            status="REVIEW",
            normalized_product=normalized_product,
            standard=None,
            confidence=round(score, 2),
            matched_keywords=matched,
            reason=(
                "Closest verified standard "
                f"({entry.standard_number}) matched only weakly "
                f"({', '.join(matched) or 'no strong keyword'}); needs officer review."
            ),
        )

    return StandardMatch(
        status="MATCHED",
        normalized_product=normalized_product,
        standard=entry,
        confidence=round(score, 2),
        matched_keywords=matched,
        reason=(
            f"Classified product '{normalized_product}' matched verified "
            f"{entry.source} product keyword(s): {', '.join(matched)}."
        ),
    )
