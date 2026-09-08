"""Deterministic declaration extraction (Phase 14).

Turns raw OCR regions into structured legal-metrology declarations
(``net_quantity``, ``mrp``, ``manufacturer`` …). No LLM: this is regex and
keyword parsing, which is what the task actually needs.

MetrIQ is evidence-first, so EVERY extracted declaration keeps a pointer back to
the OCR region it came from — its id, bounding box and OCR confidence — plus the
exact source text and the method used.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from typing import Iterable, Protocol


class RegionLike(Protocol):
    id: str
    text: str
    confidence: float
    bbox: list[int]


@dataclass(frozen=True)
class Declaration:
    field: str
    label: str
    value: str
    raw_text: str
    source_region_id: str | None
    bbox: list[int] | None
    ocr_confidence: float
    method: str  # "regex" | "keyword" | "heuristic"
    unit: str | None = None
    numeric_value: float | None = None
    note: str = ""

    def as_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class DeclarationStage:
    status: str  # "COMPLETED" | "PARTIAL" | "REVIEW"
    declarations: list[Declaration]
    principal_display_panel: bool
    found_fields: list[str]
    missing_fields: list[str]
    notes: list[str] = field(default_factory=list)


# The fields we try to read off a declaration panel. "core" fields drive the
# COMPLETED / PARTIAL / REVIEW status.
FIELD_LABELS: dict[str, str] = {
    "product_name": "Product name",
    "product_description": "Product description",
    "net_quantity": "Net quantity",
    "mrp": "Maximum retail price",
    "manufacturer": "Manufacturer / packer",
    "manufacturer_address": "Manufacturer address",
    "manufacturing_date": "Date of manufacture / packing",
    "batch_number": "Batch / lot number",
    "best_before": "Best before / use by",
    "consumer_care": "Consumer care",
    "toll_free": "Toll-free number",
    "fssai_license": "FSSAI licence (food safety — not a BIS standard)",
    "principal_display_panel": "Principal display panel",
}
CORE_FIELDS = ("product_name", "net_quantity", "mrp", "manufacturer")

_UNIT_CANON = {
    "g": "g", "gm": "g", "gms": "g", "gram": "g", "grams": "g",
    "kg": "kg", "kgs": "kg", "kilogram": "kg", "kilograms": "kg",
    "mg": "mg",
    "ml": "ml", "milliliter": "ml", "millilitre": "ml",
    "l": "l", "ltr": "l", "litre": "l", "liter": "l", "litres": "l", "liters": "l",
    # "N" is the Legal Metrology unit for a count of articles.
    "n": "N", "u": "N", "pcs": "N", "pc": "N", "piece": "N", "pieces": "N",
}


def _num(s: str) -> float | None:
    try:
        return float(s.replace(",", ""))
    except (TypeError, ValueError):
        return None


# --------------------------------------------------------------------------- api


def extract_declarations(regions: Iterable[RegionLike]) -> DeclarationStage:
    regions = list(regions)
    notes: list[str] = []

    if not regions:
        return DeclarationStage(
            status="REVIEW",
            declarations=[],
            principal_display_panel=False,
            found_fields=[],
            missing_fields=[f for f in FIELD_LABELS if f != "principal_display_panel"],
            notes=["No OCR text to extract declarations from."],
        )

    found: dict[str, Declaration] = {}

    for extractor in (
        _pdp_flag,  # sets principal_display_panel note only
        _product_description,
        _net_quantity,
        _mrp,
        _manufacturer,
        _manufacturer_address,
        _manufacturing_date,
        _batch_number,
        _best_before,
        _consumer_care,
        _toll_free,
        _fssai_license,
    ):
        try:
            decl = extractor(regions)
        except Exception as exc:  # noqa: BLE001 — one bad field must not kill the stage
            notes.append(f"{extractor.__name__}: {exc}")
            continue
        if decl is not None:
            found[decl.field] = decl

    # product_name last: it is a heuristic over "leftover" prominent text, so it
    # helps to know which regions were already claimed by a labelled field.
    claimed_regions = {d.source_region_id for d in found.values() if d.source_region_id}
    pdp = _has_pdp(regions)
    name = _product_name(regions, claimed_regions, pdp)
    if name is not None:
        found[name.field] = name

    declarations = [found[f] for f in FIELD_LABELS if f in found]
    found_fields = [d.field for d in declarations]
    missing_fields = [
        f for f in FIELD_LABELS
        if f not in found and f != "principal_display_panel"
    ]

    core_hits = sum(1 for f in CORE_FIELDS if f in found)
    if core_hits >= 3:
        status = "COMPLETED"
    elif len(found) >= 1:
        status = "PARTIAL"
    else:
        status = "REVIEW"
        notes.append("No recognisable declaration fields were found in the OCR text.")

    return DeclarationStage(
        status=status,
        declarations=declarations,
        principal_display_panel=pdp,
        found_fields=found_fields,
        missing_fields=missing_fields,
        notes=notes,
    )


# --------------------------------------------------------------- field extractors
#
# Each takes the region list and returns a Declaration or None. They scan regions
# in reading order and stop at the first hit, so the source pointer is exact.


def _mk(region: RegionLike, field_name: str, value: str, method: str, **kw) -> Declaration:
    return Declaration(
        field=field_name,
        label=FIELD_LABELS[field_name],
        value=value.strip(),
        raw_text=region.text.strip(),
        source_region_id=region.id,
        bbox=list(region.bbox) if region.bbox is not None else None,
        ocr_confidence=round(float(region.confidence), 4),
        method=method,
        **kw,
    )


def _scan(regions, pattern: re.Pattern):
    for r in regions:
        m = pattern.search(r.text)
        if m:
            return r, m
    return None, None


_RE_NET_QTY = re.compile(
    r"net\s*(?:quantity|qty|wt|weight|content[s]?|vol(?:ume)?)?\s*[:\-]?\s*"
    r"(\d+(?:[.,]\d+)?)\s*"
    r"(g|gm|gms|gram|grams|kg|kgs|mg|ml|l|ltr|litre|liter|litres|liters|pcs|pc|pieces?|n|u)\b",
    re.IGNORECASE,
)


def _net_quantity(regions):
    r, m = _scan(regions, _RE_NET_QTY)
    if not r:
        return None
    raw_unit = m.group(2).lower()
    unit = _UNIT_CANON.get(raw_unit, raw_unit)
    val = _num(m.group(1))
    display = f"{m.group(1)} {unit}".strip()
    return _mk(r, "net_quantity", display, "regex", unit=unit, numeric_value=val)


_RE_MRP = re.compile(
    r"(?:m\.?\s*r\.?\s*p\.?|maximum\s+retail\s+price)\s*[:\-]?\s*"
    r"(?:rs\.?|inr|₹|rupees)?\s*(\d+(?:[.,]\d{1,2})?)",
    re.IGNORECASE,
)


def _mrp(regions):
    r, m = _scan(regions, _RE_MRP)
    if not r:
        return None
    val = _num(m.group(1))
    inclusive = bool(re.search(r"inclusive of all taxes|incl\.? of all taxes", r.text, re.I))
    display = f"₹ {m.group(1)}" + (" (incl. of all taxes)" if inclusive else "")
    return _mk(r, "mrp", display, "regex", unit="INR", numeric_value=val)


_RE_MFR = re.compile(
    r"(packed|manufactured|mfd|mfg\.? by|marketed|produced)\s*(?:&\s*packed\s*)?(?:by)?\s*[:\-]\s*(.+)",
    re.IGNORECASE,
)
_RE_MFR_INLINE = re.compile(
    r"\b(packed by|manufactured by|marketed by|mfd by|produced by)\b\s*(.+)",
    re.IGNORECASE,
)


def _manufacturer(regions):
    r, m = _scan(regions, _RE_MFR)
    if not r:
        r, m = _scan(regions, _RE_MFR_INLINE)
    if not r:
        return None
    who = m.group(2).strip(" :.-")
    verb = m.group(1).lower().split()[0]
    who = re.split(r"\s{2,}|\s+plot\s+\d|\s+\d{1,3}[/-]", who)[0].strip(" :.-,")
    return _mk(r, "manufacturer", who, "keyword", note=f"declared as '{verb} by'")


_RE_PIN = re.compile(r"\b(\d{6})\b")
_STATES = (
    "andhra pradesh|arunachal|assam|bihar|chhattisgarh|goa|gujarat|haryana|himachal|"
    "jharkhand|karnataka|kerala|madhya pradesh|maharashtra|manipur|meghalaya|mizoram|"
    "nagaland|odisha|orissa|punjab|rajasthan|sikkim|tamil nadu|telangana|tripura|"
    "uttar pradesh|uttarakhand|west bengal|delhi|puducherry|chandigarh|jammu"
)
_RE_STATE = re.compile(_STATES, re.IGNORECASE)


def _manufacturer_address(regions):
    for r in regions:
        t = r.text
        if _RE_PIN.search(t) and ("," in t) and (
            _RE_STATE.search(t)
            or re.search(r"\b(road|street|plot|lane|nagar|industrial|area|estate|midc|gidc|sipcot)\b", t, re.I)
        ):
            return _mk(r, "manufacturer_address", t.strip(), "heuristic",
                       note="line with a 6-digit PIN code and address tokens")
    return None


_RE_MFG_DATE = re.compile(
    r"(?:mfg|mfd|manufactured|packed|pkd|packing|date of (?:manufacture|packing))\.?\s*"
    r"(?:date|dt)?\s*[:\-]?\s*"
    r"(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d{1,2}[/\-.]\d{2,4}|[A-Za-z]{3,9}[/\-.\s]\d{2,4})",
    re.IGNORECASE,
)


def _manufacturing_date(regions):
    r, m = _scan(regions, _RE_MFG_DATE)
    if not r:
        return None
    return _mk(r, "manufacturing_date", m.group(1).strip(), "regex")


_RE_BATCH = re.compile(
    r"(?:batch|lot|b\.?\s*no|batch\s*no|lot\s*no|code)\.?\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\-/]{2,})",
    re.IGNORECASE,
)


def _batch_number(regions):
    r, m = _scan(regions, _RE_BATCH)
    if not r:
        return None
    val = m.group(1).strip(" .-")
    if val.lower() in {"no", "number"}:
        return None
    return _mk(r, "batch_number", val, "regex")


_RE_BEST_BEFORE = re.compile(
    r"(?:best\s*before|use\s*by|consume\s*before|expiry|exp\.?\s*date|best\s*before\s*use)\s*[:\-]?\s*(.+)",
    re.IGNORECASE,
)


def _best_before(regions):
    r, m = _scan(regions, _RE_BEST_BEFORE)
    if not r:
        return None
    return _mk(r, "best_before", m.group(1).strip(" :.-"), "regex")


_RE_EMAIL = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")


def _consumer_care(regions):
    r, m = _scan(regions, _RE_EMAIL)
    if not r:
        return None
    return _mk(r, "consumer_care", m.group(0), "regex",
               note="email address on the declaration panel")


_RE_TOLLFREE = re.compile(
    r"(?:toll\s*free|customer\s*care|helpline|consumer\s*care)\D{0,12}"
    r"(1\s?800[\s\-]?\d{2,4}[\s\-]?\d{3,4}|\d{3,5}[\s\-]?\d{3,4}[\s\-]?\d{3,4})",
    re.IGNORECASE,
)
_RE_1800 = re.compile(r"\b(1\s?800[\s\-]?\d{2,4}[\s\-]?\d{3,4})\b")


def _toll_free(regions):
    r, m = _scan(regions, _RE_TOLLFREE)
    if not r:
        r, m = _scan(regions, _RE_1800)
    if not r:
        return None
    return _mk(r, "toll_free", re.sub(r"\s+", " ", m.group(1)).strip(), "regex")


_RE_FSSAI = re.compile(
    r"(?:fssai|f\.?\s*s\.?\s*s\.?\s*a\.?\s*i\.?)\D{0,20}(\d[\d\s]{11,16}\d)",
    re.IGNORECASE,
)


def _fssai_license(regions):
    r, m = _scan(regions, _RE_FSSAI)
    if not r:
        return None
    digits = re.sub(r"\D", "", m.group(1))
    if len(digits) < 12:
        return None
    return _mk(
        r, "fssai_license", digits, "regex",
        note="FSSAI food-safety licence — a food regulator ID, NOT an Indian Standard",
    )


_RE_PDP = re.compile(r"principal\s*display\s*panel|principal\s*display", re.IGNORECASE)
# OCR often drops the space: "PRINCIPALDISPLAYPANEL"
_RE_PDP_NOSPACE = re.compile(r"principal\s*display\s*panel", re.IGNORECASE)


def _has_pdp(regions) -> bool:
    for r in regions:
        squashed = re.sub(r"\s+", "", r.text).lower()
        if "principaldisplay" in squashed or _RE_PDP.search(r.text):
            return True
    return False


def _pdp_flag(regions):
    # Present for symmetry with the extractor loop; the boolean is surfaced
    # separately via _has_pdp so it does not consume a "field" slot.
    return None


_RE_PARENS = re.compile(r"^\s*\((.+)\)\s*$")


def _product_description(regions):
    for r in regions:
        m = _RE_PARENS.match(r.text)
        if m and len(m.group(1).split()) >= 2:
            return _mk(r, "product_description", m.group(1).strip(), "regex")
    return None


_LABEL_WORDS = re.compile(
    r"\b(net|quantity|mrp|price|batch|mfg|mfd|packed|manufactured|marketed|best before|"
    r"use by|fssai|consumer|toll|care|licence|license|date|address|www\.|http|@|display panel)\b",
    re.IGNORECASE,
)


def _product_name(regions, claimed_region_ids: set[str], pdp: bool):
    """Heuristic: the most prominent line that is not a labelled field and not the
    PDP header. Prefer an early, mostly-uppercase, 2–6 word line."""
    candidates = []
    for i, r in enumerate(regions):
        t = r.text.strip()
        if not t or r.id in claimed_region_ids:
            continue
        squashed = re.sub(r"\s+", "", t).lower()
        if "principaldisplay" in squashed or _RE_PDP.search(t):
            continue
        if _LABEL_WORDS.search(t):
            continue
        if _RE_PARENS.match(t):
            continue
        words = re.findall(r"[A-Za-z][A-Za-z&'-]*", t)
        if not (2 <= len(words) <= 6):
            continue
        letters = re.sub(r"[^A-Za-z]", "", t)
        if not letters:
            continue
        upper_ratio = sum(c.isupper() for c in letters) / len(letters)
        # earlier + more uppercase => more likely the product name
        score = upper_ratio - 0.04 * i
        candidates.append((score, r, t))

    if not candidates:
        return None
    candidates.sort(key=lambda c: -c[0])
    _, r, t = candidates[0]
    value = t.title() if t.isupper() else t
    return _mk(r, "product_name", value, "heuristic",
               note="most prominent unlabelled line on the panel")
