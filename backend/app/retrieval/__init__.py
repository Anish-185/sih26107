"""Deterministic lexical retrieval over the BIS knowledge base (Phase 3).

No LLM, no embeddings, no vector store. See engine.py for the algorithm.
"""

from app.retrieval.engine import (
    CATEGORY_HINTS,
    CONFIDENCE_ORDER,
    MatchReason,
    RetrievalConfig,
    RetrievalResult,
    SearchEngine,
    SearchOutcome,
)

__all__ = [
    "CATEGORY_HINTS",
    "CONFIDENCE_ORDER",
    "MatchReason",
    "RetrievalConfig",
    "RetrievalResult",
    "SearchEngine",
    "SearchOutcome",
]
