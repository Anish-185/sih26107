"""Checks for the verified standards registry + lookup (app/standards_registry.py).

Plain Python, no test framework. Run:

    cd backend
    ./.venv/bin/python tests/test_standards_registry.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.standards_registry import load_registry, lookup_standard  # noqa: E402

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


def test_registry_is_verified_only() -> None:
    reg = load_registry()
    check("registry loads with entries", len(reg) >= 1)
    check("every entry is verified", all(s.status == "verified" for s in reg))
    check("every entry has an http(s) source_url",
          all(s.source_url.startswith(("http://", "https://")) for s in reg))
    check("every entry has product keywords", all(s.product_keywords for s in reg))
    check("no FSSAI regulation is stored as an Indian Standard",
          all(s.source == "BIS" for s in reg))
    check("IS 18140:2023 is present",
          any(s.standard_number == "IS 18140:2023" for s in reg))


def test_chana_matches_is_18140() -> None:
    m = lookup_standard("Roasted Bengal Gram", extra_terms="Roasted Masala Chana")
    check("status MATCHED", m.status == "MATCHED", m.status)
    check("standard is IS 18140:2023",
          m.standard is not None and m.standard.standard_number == "IS 18140:2023",
          str(m.standard))
    check("title is the roasted bengal gram spec",
          m.standard and "Roasted Bengal Gram" in m.standard.title)
    check("source is BIS", m.standard and m.standard.source == "BIS")
    check("confidence is a real score in (0,1]", 0.0 < m.confidence <= 1.0, str(m.confidence))
    check("matched keywords recorded", len(m.matched_keywords) >= 1)
    check("reason cites the matched keywords", "roasted bengal gram" in m.reason.lower())


def test_unknown_product_is_review_not_a_guess() -> None:
    for product in ("Ordinary Portland Cement", "LED bulb", "wrist watch", ""):
        m = lookup_standard(product)
        check(f"{product!r} -> REVIEW", m.status == "REVIEW", m.status)
        check(f"{product!r} -> no standard invented", m.standard is None)


def test_single_generic_word_does_not_match() -> None:
    # "water" alone must not pull in a packaged-water standard.
    m = lookup_standard("water")
    check("bare 'water' -> REVIEW", m.status == "REVIEW", m.status)
    m2 = lookup_standard("gram")
    check("bare 'gram' -> REVIEW", m2.status == "REVIEW", m2.status)


def test_mineral_water_matches_its_own_standard() -> None:
    m = lookup_standard("Packaged Natural Mineral Water")
    check("mineral water -> MATCHED", m.status == "MATCHED", m.status)
    check("mineral water -> IS 13428:2005",
          m.standard and m.standard.standard_number == "IS 13428:2005", str(m.standard))


def main() -> int:
    print("standards registry")
    for fn in (
        test_registry_is_verified_only,
        test_chana_matches_is_18140,
        test_unknown_product_is_review_not_a_guess,
        test_single_generic_word_does_not_match,
        test_mineral_water_matches_its_own_standard,
    ):
        print(f"\n{fn.__name__}")
        fn()
    print(f"\n{PASS} passed, {FAIL} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
