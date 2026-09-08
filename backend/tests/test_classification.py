"""Checks for product classification (app/classification.py).

Plain Python, no test framework. Run:

    cd backend
    ./.venv/bin/python tests/test_classification.py

The local model is stubbed — no LM Studio needed. These lock in:
  * the deterministic rule path (no model call for the chana sample);
  * strict-JSON parsing of a model reply;
  * REVIEW (never a guess) when the model is unavailable or unsure;
  * the model can NEVER inject an Indian Standard number.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.classification import classify_product  # noqa: E402
from app.declarations import extract_declarations  # noqa: E402
from app.llm import LLMError  # noqa: E402

PASS = 0
FAIL = 0


def check(name: str, condition: bool, detail: str = "") -> None:
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  PASS  {name}")
    else:
        FAIL += 1
        print(f"  FAIL  {name}{' — ' + detail if detail else ''}")


@dataclass
class Region:
    id: str
    text: str
    confidence: float
    bbox: list


class FakeLLM:
    """Stands in for app.llm.LocalLLM.generate()."""

    def __init__(self, reply: str | None = None, raises: Exception | None = None) -> None:
        self.reply = reply
        self.raises = raises
        self.calls = 0

    def generate(self, **_kw) -> str:
        self.calls += 1
        if self.raises is not None:
            raise self.raises
        return self.reply


CHANA = [
    Region("OCR-001", "ROASTED MASALA CHANA", 0.96, [0, 0, 10, 10]),
    Region("OCR-002", "(Roasted Bengal gram with spices)", 0.9, [0, 20, 10, 30]),
    Region("OCR-003", "Net Quantity: 200 g", 0.86, [0, 40, 10, 50]),
]
UNKNOWN = [
    Region("OCR-001", "GLIMMER SHINE DELUXE", 0.9, [0, 0, 10, 10]),
    Region("OCR-002", "Net Quantity: 500 ml", 0.8, [0, 20, 10, 30]),
]


def _stage(regions):
    return extract_declarations(regions)


def test_deterministic_path_no_model_call() -> None:
    llm = FakeLLM(reply='{"should":"not be used"}')
    c = classify_product(_stage(CHANA), "\n".join(r.text for r in CHANA), llm=llm)
    check("chana -> CLASSIFIED", c.status == "CLASSIFIED", c.status)
    check("chana -> normalized 'Roasted Bengal Gram'", c.normalized_product == "Roasted Bengal Gram")
    check("chana -> method deterministic", c.method == "deterministic")
    check("chana -> the model was NOT called", llm.calls == 0)
    check("chana -> confidence is a real score", 0.5 < c.confidence <= 0.97, str(c.confidence))
    check("chana -> reason cites the matched phrase", "roasted bengal gram" in c.reason.lower())


def test_llm_path_strict_json() -> None:
    reply = (
        'Sure. {"product_name": "Glimmer Shine Deluxe", '
        '"normalized_product": "Liquid Dishwash Gel", "category": "household", '
        '"subcategory": "dishwash", "confidence": 0.88, '
        '"reason": "Label says dishwash gel."}'
    )
    llm = FakeLLM(reply=reply)
    c = classify_product(_stage(UNKNOWN), "\n".join(r.text for r in UNKNOWN), llm=llm)
    check("unknown + model -> CLASSIFIED", c.status == "CLASSIFIED", c.status)
    check("model result parsed: normalized product", c.normalized_product == "Liquid Dishwash Gel")
    check("model result parsed: category", c.category == "household")
    check("model result parsed: confidence clamped/kept", c.confidence == 0.88)
    check("method is llm", c.method == "llm")
    check("model WAS called", llm.calls == 1)


def test_model_cannot_inject_a_standard_number() -> None:
    reply = (
        '{"product_name": "X", "normalized_product": "Roasted Bengal Gram", '
        '"category": "food", "subcategory": "gram", "confidence": 0.9, '
        '"standard_number": "IS 99999:2099", "is_number": "IS 12345", '
        '"reason": "Applies IS 99999:2099 for roasted gram."}'
    )
    # Deterministic rule would fire for chana, so use a non-rule product name and
    # only description text that avoids the rule, forcing the llm branch.
    regions = [
        Region("OCR-001", "MYSTERY SNACK", 0.9, [0, 0, 1, 1]),
        Region("OCR-002", "Net Quantity: 100 g", 0.8, [0, 2, 1, 3]),
    ]
    llm = FakeLLM(reply=reply)
    c = classify_product(_stage(regions), "MYSTERY SNACK\nNet Quantity: 100 g", llm=llm)
    check("classification produced", c.status in {"CLASSIFIED", "REVIEW"})
    # Whatever the status, there must be no standard-number field anywhere on it.
    blob = repr(c)
    check("no IS number leaks onto the classification object",
          "IS 99999" not in blob and "IS 12345" not in blob, blob)
    check("standard number stripped from the reason text",
          "IS 99999" not in c.reason, c.reason)


def test_model_unavailable_is_review() -> None:
    llm = FakeLLM(raises=LLMError("could not reach LM Studio (ConnectError)"))
    c = classify_product(_stage(UNKNOWN), "GLIMMER SHINE DELUXE", llm=llm)
    check("model down + no rule -> REVIEW", c.status == "REVIEW", c.status)
    check("REVIEW -> no normalized product invented", c.normalized_product is None)
    check("REVIEW reason mentions the model", "model" in c.reason.lower())


def test_no_model_and_no_rule_is_review() -> None:
    c = classify_product(_stage(UNKNOWN), "GLIMMER SHINE DELUXE", llm=None)
    check("no model + no rule -> REVIEW", c.status == "REVIEW", c.status)
    check("says no model was available", "no local model" in c.reason.lower())


def test_low_confidence_model_reply_is_review() -> None:
    reply = '{"product_name":"?","normalized_product":"thing","category":"other","subcategory":"","confidence":0.2,"reason":"unclear"}'
    llm = FakeLLM(reply=reply)
    c = classify_product(_stage(UNKNOWN), "GLIMMER SHINE DELUXE", llm=llm)
    check("low-confidence model reply -> REVIEW", c.status == "REVIEW", c.status)


def main() -> int:
    print("product classification")
    for fn in (
        test_deterministic_path_no_model_call,
        test_llm_path_strict_json,
        test_model_cannot_inject_a_standard_number,
        test_model_unavailable_is_review,
        test_no_model_and_no_rule_is_review,
        test_low_confidence_model_reply_is_review,
    ):
        print(f"\n{fn.__name__}")
        fn()
    print(f"\n{PASS} passed, {FAIL} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
