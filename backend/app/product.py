
"""Product-to-Standard discovery using the existing BIS retrieval engine."""

from __future__ import annotations

from dataclasses import dataclass

from app.retrieval.engine import RetrievalResult, SearchEngine


@dataclass(frozen=True)
class ProductStandardOutcome:
    """Result of one product-to-standard discovery query."""

    product: str
    results: list[RetrievalResult]
    confidence: str
    grounded: bool
    note: str = ""


class ProductStandardFinder:
    """Thin Product -> Standard layer over the existing SearchEngine."""

    def __init__(self, search_engine: SearchEngine) -> None:
        self.search_engine = search_engine

    def find(
        self,
        product: str,
        limit: int = 5,
    ) -> ProductStandardOutcome:
        product = product.strip()

        if not product:
            return ProductStandardOutcome(
                product="",
                results=[],
                confidence="none",
                grounded=False,
                note="product description is empty",
            )

        # Reuse the existing deterministic retrieval and ranking.
        search = self.search_engine.search(product, limit=50)

        # The retrieval engine matches single query words across many fields, so a
        # generic material word ("steel", "water") alone can pull in an unrelated
        # standard (structural steel tubes, packaged drinking water) for a product
        # like "stainless steel water bottle". For Product -> Standard discovery we
        # need the standard to actually describe the product, not just share a word
        # with it. So a candidate is kept only when the retrieved standard matches
        # more than half of the product's search terms, or at least two of them.
        query_terms = set(search.query_terms) | set(search.query_standard_numbers)
        total_terms = len(query_terms)

        def describes_product(result: RetrievalResult) -> bool:
            hits = sum(1 for term in result.matched_terms if term in query_terms)
            if hits >= 2:
                return True
            return total_terms > 0 and hits / total_terms > 0.5

        candidates = [
            result
            for result in search.results
            if result.item.category == "indian_standards"
            and result.item.standard_number
            and result.confidence != "none"
            and describes_product(result)
        ]

        candidates = candidates[: max(1, min(limit, 50))]

        if not candidates:
            return ProductStandardOutcome(
                product=product,
                results=[],
                confidence="none",
                grounded=False,
                note=(
                    "no Indian Standard in the knowledge base clearly describes "
                    "this product; only loose single-word matches were found, so "
                    "no recommendation is made"
                ),
            )

        return ProductStandardOutcome(
            product=product,
            results=candidates,
            confidence=candidates[0].confidence,
            grounded=True,
        )
