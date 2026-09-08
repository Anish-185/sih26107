"""Product classification (Phase 14).

Turns extracted declarations / OCR text into a normalised product name and
category, so the standards registry can be searched.

Order of preference:
  1. Deterministic product rules (a small, explicit keyword table). No model call.
  2. The local Qwen3-4B model via LM Studio, asked for STRICT JSON — used only
     when the rules do not fire and a model is available.
  3. Otherwise: status "REVIEW". Never guess.

The model classifies; it does NOT choose an Indian Standard. Any standard-number
-like key it returns is dropped here, and the standard is looked up separately
from the verified registry.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field

from app.declarations import DeclarationStage
from app.llm import LLMError, LocalLLM


@dataclass(frozen=True)
class ProductClassification:
    status: str  # "CLASSIFIED" | "REVIEW"
    product_name: str | None
    normalized_product: str | None
    category: str | None
    subcategory: str | None
    confidence: float
    method: str  # "deterministic" | "llm"
    reason: str
    source_declarations: list[str] = field(default_factory=list)


# (keyword phrases, normalized product, category, subcategory)
# Phrases are matched on normalized (lowercase, punctuation-stripped) text.
_RULES: list[tuple[tuple[str, ...], str, str, str]] = [
    (
        ("roasted bengal gram", "roasted split bengal gram", "roasted chana",
         "roasted masala chana", "masala chana", "bhuna chana", "roasted gram"),
        "Roasted Bengal Gram", "food", "roasted gram / chana",
    ),
    (
        ("bengal gram", "chana dal", "split bengal gram", "gram dal"),
        "Bengal Gram", "food", "pulses",
    ),
    (
        ("packaged drinking water", "drinking water", "packaged water"),
        "Packaged Drinking Water", "food", "water",
    ),
    (
        ("packaged natural mineral water", "natural mineral water", "mineral water"),
        "Packaged Natural Mineral Water", "food", "water",
    ),
    (
        ("self ballasted led lamp", "led lamp", "led bulb", "led light bulb"),
        "Self-Ballasted LED Lamp", "household", "lighting / LED lamp",
    ),
    (
        ("electric kettle", "cordless kettle", "electric jug"),
        "Electric Kettle", "household", "electrical appliance / heats liquid",
    ),
]

_CLASSIFY_SYSTEM = """You classify a retail product from the text printed on its
package. You are NOT choosing a standard or a law.

Rules:
1. Use ONLY the package text provided. Do not use outside knowledge as fact.
2. Reply with a SINGLE JSON object and nothing else. No prose, no markdown fence.
3. Keys, all required:
   "product_name": string, as printed;
   "normalized_product": string, the plain generic product name;
   "category": one of "food", "beverage", "cosmetic", "household", "other";
   "subcategory": short string;
   "confidence": number 0..1;
   "reason": one sentence citing the package text.
4. Never output an IS number, BIS number, FSSAI number, standard, or legal rule.
5. If the text is too unclear to classify, use "other", confidence <= 0.3.
"""


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", " ", (text or "").lower())).strip()


def _phrase_present(phrase: str, haystack: str) -> bool:
    return bool(phrase) and f" {phrase} " in f" {haystack} "


def _declared(stage: DeclarationStage, name: str) -> str | None:
    for d in stage.declarations:
        if d.field == name:
            return d.value
    return None


# --------------------------------------------------------------------------- api


def classify_product(
    stage: DeclarationStage,
    ocr_text: str,
    llm: LocalLLM | None = None,
) -> ProductClassification:
    declared_name = _declared(stage, "product_name")
    declared_desc = _declared(stage, "product_description")

    # The blob the rules search: declared name/description carry the most signal,
    # then the whole OCR text.
    blob = _normalize(" ".join(p for p in (declared_name, declared_desc, ocr_text) if p))

    # 1) deterministic rules -------------------------------------------------
    rule_hit = _match_rules(blob)
    if rule_hit is not None:
        normalized, category, subcategory, matched_phrase, longest = rule_hit
        used = [f for f in ("product_name", "product_description")
                if _declared(stage, f) is not None]
        # confidence: a longer matched phrase in a declared field is stronger
        conf = min(0.97, 0.62 + 0.08 * longest + (0.08 if used else 0.0))
        return ProductClassification(
            status="CLASSIFIED",
            product_name=declared_name or matched_phrase.title(),
            normalized_product=normalized,
            category=category,
            subcategory=subcategory,
            confidence=round(conf, 2),
            method="deterministic",
            reason=(
                f"Package text contains '{matched_phrase}', which maps to "
                f"'{normalized}' by a fixed product rule."
            ),
            source_declarations=used,
        )

    # 2) local model, strict JSON -----------------------------------------
    if llm is not None:
        try:
            parsed = _classify_with_llm(llm, declared_name, declared_desc, ocr_text)
        except (LLMError, ValueError) as exc:
            return _review(
                declared_name,
                f"No deterministic product rule matched and the local model "
                f"could not classify it ({exc}).",
            )
        if parsed is not None:
            return parsed

    # 3) nothing reliable --------------------------------------------------
    return _review(
        declared_name,
        "No deterministic product rule matched"
        + ("" if llm is not None else " and no local model was available")
        + "; needs officer review.",
    )


def _review(name: str | None, reason: str) -> ProductClassification:
    return ProductClassification(
        status="REVIEW",
        product_name=name,
        normalized_product=None,
        category=None,
        subcategory=None,
        confidence=0.0,
        method="deterministic",
        reason=reason,
    )


def _match_rules(blob: str):
    best = None
    for phrases, normalized, category, subcategory in _RULES:
        for phrase in phrases:
            if _phrase_present(phrase, blob):
                longest = len(phrase.split())
                if best is None or longest > best[4]:
                    best = (normalized, category, subcategory, phrase, longest)
    return best


_ALLOWED_CATEGORIES = {"food", "beverage", "cosmetic", "household", "other"}
_STANDARDISH_KEY = re.compile(r"standard|is[_ ]?number|bis|fssai|licence|license|law|rule", re.I)


def _classify_with_llm(
    llm: LocalLLM,
    declared_name: str | None,
    declared_desc: str | None,
    ocr_text: str,
) -> ProductClassification | None:
    user = (
        "PACKAGE TEXT:\n"
        + (f"Declared product name: {declared_name}\n" if declared_name else "")
        + (f"Declared description: {declared_desc}\n" if declared_desc else "")
        + "Full OCR text:\n"
        + ocr_text.strip()[:1500]
        + "\n\nReturn the JSON object now."
    )
    raw = llm.generate(
        system_prompt=_CLASSIFY_SYSTEM,
        user_prompt=user,
        temperature=0.0,
        max_tokens=250,
    )

    obj = _first_json_object(raw)
    if obj is None:
        raise ValueError("model did not return a JSON object")

    # Drop any standard/law-ish keys the model may have added despite the prompt.
    obj = {k: v for k, v in obj.items() if not _STANDARDISH_KEY.search(str(k))}

    normalized = str(obj.get("normalized_product") or obj.get("product_name") or "").strip()
    if not normalized:
        raise ValueError("model JSON has no product name")

    category = str(obj.get("category", "other")).strip().lower()
    if category not in _ALLOWED_CATEGORIES:
        category = "other"

    try:
        conf = float(obj.get("confidence", 0.0))
    except (TypeError, ValueError):
        conf = 0.0
    conf = max(0.0, min(1.0, conf))

    reason = str(obj.get("reason", "")).strip() or "Classified by the local model from the package text."
    # Strip any IS/FSSAI number the model slipped into the free-text reason.
    reason = re.sub(r"\b(IS|BIS)\s?\d{2,5}(?:[:\-]\d{2,4})?\b", "[standard removed]", reason)

    if conf < 0.35 or category == "other":
        return _review(
            declared_name or normalized,
            f"Local model was not confident about the product ({reason}).",
        )

    return ProductClassification(
        status="CLASSIFIED",
        product_name=str(obj.get("product_name") or declared_name or normalized).strip(),
        normalized_product=normalized,
        category=category,
        subcategory=str(obj.get("subcategory", "")).strip() or None,
        confidence=round(conf, 2),
        method="llm",
        reason=reason,
        source_declarations=[f for f in ("product_name", "product_description")
                             if (declared_name if f == "product_name" else declared_desc)],
    )


def _first_json_object(text: str) -> dict | None:
    """Pull the first balanced {...} out of a model reply and parse it."""
    start = text.find("{")
    while start != -1:
        depth = 0
        for i in range(start, len(text)):
            c = text[i]
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    try:
                        val = json.loads(text[start : i + 1])
                        return val if isinstance(val, dict) else None
                    except json.JSONDecodeError:
                        break
        start = text.find("{", start + 1)
    return None
