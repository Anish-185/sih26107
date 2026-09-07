"""Query text processing for retrieval: normalize, tokenize, find standard numbers.

Everything here is deterministic and dependency-free so the retrieval results are
predictable and easy to explain.
"""

from __future__ import annotations

import re
import unicodedata

# Common English words plus a few BIS-domain words that appear in almost every
# record (so they carry no ranking signal). Kept small on purpose.
STOPWORDS: frozenset[str] = frozenset(
    {
        "a", "an", "and", "are", "as", "at", "be", "by", "can", "do", "does",
        "for", "from", "how", "i", "in", "is", "it", "its", "me", "my", "of",
        "on", "or", "that", "the", "their", "them", "there", "these", "this",
        "to", "was", "what", "when", "where", "which", "who", "why", "will",
        "with", "you", "your",
        # domain words that match nearly everything
        "bis", "bureau", "indian", "india", "standard", "standards",
    }
)

# "IS 1786", "IS1786", "IS 1786:2008", "IS/IEC 62368", "IS 302 (Part 2/Sec 3)"
_STANDARD_RE = re.compile(
    r"\bis\s*/?\s*(?:iec\s*)?(\d{2,6})(?:\s*[:\-]\s*(\d{4}))?",
    re.IGNORECASE,
)


def normalize(text: str) -> str:
    """Lowercase, strip accents, and turn every run of non-alphanumerics into a
    single space. 'What is HUID?' -> 'what is huid'."""
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return text.strip()


def tokenize(text: str) -> list[str]:
    """Normalize, split on spaces, drop stopwords and 1-character tokens.
    Order is preserved and duplicates are removed."""
    seen: list[str] = []
    for token in normalize(text).split():
        if len(token) < 2 or token in STOPWORDS:
            continue
        if token not in seen:
            seen.append(token)
    return seen


def find_standard_numbers(text: str) -> list[str]:
    """Pull standard-number references out of a query.

    Returns normalized strings: just the primary number ('1786'), or number and
    year joined by a colon ('1786:2008') when a year is present. Used to match
    against a knowledge item's `standard_number`.
    """
    found: list[str] = []
    for number, year in _STANDARD_RE.findall(text or ""):
        value = f"{number}:{year}" if year else number
        if value not in found:
            found.append(value)
    return found


def standard_number_key(standard_number: str | None) -> tuple[str, str] | None:
    """Break an item's standard_number into (primary_number, year).

    'IS 1786:2008' -> ('1786', '2008'); 'IS 302 (Part 2/Sec 3)' -> ('302', '').
    Returns None when there is no number at all.
    """
    if not standard_number:
        return None
    numbers = re.findall(r"\d+", standard_number)
    if not numbers:
        return None
    primary = numbers[0]
    year = ""
    for candidate in numbers[1:]:
        if len(candidate) == 4 and candidate.startswith(("19", "20")):
            year = candidate
            break
    return primary, year
