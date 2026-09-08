"""Checks for deterministic declaration extraction (app/declarations.py).

Plain Python, no test framework (matches tests/test_api_contract.py). Run:

    cd backend
    ./.venv/bin/python tests/test_declarations.py

Exit 0 = all checks passed, 1 = something failed.

No OCR engine, no model, no network: the extractor is fed hand-built regions
that mimic the OcrRegionOut shape (id / text / confidence / bbox).
"""

from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.declarations import extract_declarations  # noqa: E402

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


CHANA_REGIONS = [
    Region("OCR-001", "PRINCIPAL DISPLAY PANEL", 0.95, [10, 10, 300, 40]),
    Region("OCR-002", "ROASTED MASALA CHANA", 0.96, [10, 50, 320, 90]),
    Region("OCR-003", "(Roasted Bengal gram with spices)", 0.90, [10, 95, 340, 120]),
    Region("OCR-004", "Net Quantity: 200 g", 0.86, [10, 130, 240, 160]),
    Region("OCR-005", "M.R.P. Rs. 45.00 (inclusive of all taxes)", 0.84, [10, 165, 360, 195]),
    Region("OCR-006", "Packed by: SUNRISE FOODS PVT LTD", 0.80, [10, 200, 360, 230]),
    Region("OCR-007", "Plot 14, MIDC Industrial Area, Pune 411019, Maharashtra", 0.78, [10, 235, 420, 265]),
    Region("OCR-008", "Mfg Date: 03/2026", 0.82, [10, 270, 200, 300]),
    Region("OCR-009", "Batch No: SR2026-0342", 0.83, [10, 305, 240, 335]),
    Region("OCR-010", "Best Before: 9 months from date of packaging", 0.80, [10, 340, 380, 370]),
    Region("OCR-011", "Consumer Care: care@sunrisefoods.example", 0.77, [10, 375, 360, 405]),
    Region("OCR-012", "Toll Free 1800-000-1234", 0.79, [10, 410, 240, 440]),
    Region("OCR-013", "FSSAI Lic. No. 10012345000123", 0.80, [10, 445, 300, 475]),
]


def by_field(stage) -> dict:
    return {d.field: d for d in stage.declarations}


def test_chana_all_fields() -> None:
    stage = extract_declarations(CHANA_REGIONS)
    d = by_field(stage)

    check("stage status COMPLETED", stage.status == "COMPLETED", stage.status)
    check("principal display panel detected", stage.principal_display_panel is True)

    check("product_name found", d.get("product_name") and d["product_name"].value == "Roasted Masala Chana",
          str(d.get("product_name")))
    check("product_description found",
          d.get("product_description") and d["product_description"].value == "Roasted Bengal gram with spices")

    nq = d.get("net_quantity")
    check("net_quantity numeric = 200", nq and nq.numeric_value == 200.0, str(nq))
    check("net_quantity unit = g", nq and nq.unit == "g")
    check("net_quantity source region = OCR-004", nq and nq.source_region_id == "OCR-004")
    check("net_quantity keeps its bbox", nq and nq.bbox == [10, 130, 240, 160])
    check("net_quantity keeps OCR confidence", nq and abs(nq.ocr_confidence - 0.86) < 1e-6)

    mrp = d.get("mrp")
    check("mrp numeric = 45.0", mrp and mrp.numeric_value == 45.0, str(mrp))
    check("mrp unit INR", mrp and mrp.unit == "INR")

    check("manufacturer = SUNRISE FOODS PVT LTD",
          d.get("manufacturer") and "SUNRISE FOODS PVT LTD" in d["manufacturer"].value, str(d.get("manufacturer")))
    check("manufacturer_address has the PIN code",
          d.get("manufacturer_address") and "411019" in d["manufacturer_address"].value)
    check("manufacturing_date = 03/2026", d.get("manufacturing_date") and d["manufacturing_date"].value == "03/2026")
    check("batch_number = SR2026-0342", d.get("batch_number") and d["batch_number"].value == "SR2026-0342")
    check("best_before captured", d.get("best_before") and "9 months" in d["best_before"].value)
    check("consumer_care email", d.get("consumer_care") and d["consumer_care"].value == "care@sunrisefoods.example")
    check("toll_free number", d.get("toll_free") and "1800" in d["toll_free"].value)

    fssai = d.get("fssai_license")
    check("fssai_license = 14 digits", fssai and fssai.value == "10012345000123", str(fssai))
    check("fssai_license labelled as NOT a BIS standard",
          fssai and "not a bis standard" in fssai.label.lower())
    check("fssai_license note keeps it separate from Indian Standards",
          fssai and "not an indian standard" in fssai.note.lower())

    check("every declaration keeps a source region id",
          all(x.source_region_id for x in stage.declarations))
    check("every declaration keeps a bbox",
          all(x.bbox is not None for x in stage.declarations))
    check("methods are from the allowed set",
          all(x.method in {"regex", "keyword", "heuristic"} for x in stage.declarations))


def test_ocr_noise_tolerated() -> None:
    # OCR often drops the space after a colon and mangles case.
    noisy = [
        Region("OCR-001", "PRINCIPALDISPLAYPANEL", 0.9, [0, 0, 10, 10]),
        Region("OCR-002", "NetQuantity:200g", 0.8, [0, 20, 10, 30]),
        Region("OCR-003", "MRP Rs45", 0.8, [0, 40, 10, 50]),
    ]
    stage = extract_declarations(noisy)
    d = by_field(stage)
    check("PDP detected without spaces", stage.principal_display_panel is True)
    check("net_quantity parsed from 'NetQuantity:200g'",
          d.get("net_quantity") and d["net_quantity"].numeric_value == 200.0, str(d.get("net_quantity")))
    check("mrp parsed from 'MRP Rs45'", d.get("mrp") and d["mrp"].numeric_value == 45.0, str(d.get("mrp")))


def test_empty_and_no_fields() -> None:
    empty = extract_declarations([])
    check("no regions -> REVIEW", empty.status == "REVIEW")
    check("no regions -> no declarations", empty.declarations == [])

    junk = [Region("OCR-001", "!!! ~~~ ###", 0.5, [0, 0, 1, 1])]
    stage = extract_declarations(junk)
    check("unreadable text -> REVIEW", stage.status == "REVIEW", stage.status)
    check("unreadable text -> nothing invented", stage.declarations == [])


def main() -> int:
    print("declaration extraction")
    for fn in (test_chana_all_fields, test_ocr_noise_tolerated, test_empty_and_no_fields):
        print(f"\n{fn.__name__}")
        fn()
    print(f"\n{PASS} passed, {FAIL} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
