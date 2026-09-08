"""Grounded BIS question answering.

Retrieval remains deterministic and is performed by SearchEngine.
The LLM only receives the retrieved BIS context.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.llm import LocalLLM
from app.retrieval import RetrievalResult, SearchEngine


SYSTEM_PROMPT = """You are the BIS Assistant for an evidence-backed Indian
Standards information system.

Rules:
1. Answer ONLY using the BIS context supplied by the application.
2. Do not use pretrained knowledge as evidence.
3. Do not invent standards, clauses, requirements, dates, numbers, fees,
   procedures, or legal claims.
4. If the supplied context is insufficient, say so clearly.
5. Do not make a final legal or enforcement decision.
6. Keep the answer concise and directly address the user's question.
"""


@dataclass(frozen=True)
class GroundedAnswer:
    answer: str
    results: list[RetrievalResult]


def _build_context(results: list[RetrievalResult]) -> str:
    blocks: list[str] = []

    for index, result in enumerate(results, start=1):
        item = result.item

        blocks.append(
            f"""SOURCE {index}
ID: {item.id}
TITLE: {item.title}
CATEGORY: {item.category}
STANDARD: {item.standard_number or "N/A"}

CONTENT:
{item.content}

SOURCE ORGANIZATION: {item.source_organization}
DOCUMENT: {item.document_name or "N/A"}
REFERENCE: {item.reference or "N/A"}
VERIFICATION STATUS: {item.verification_status}
SOURCE URL: {item.source_url or "N/A"}
"""
        )

    return "\n---\n".join(blocks)


class BISQuestionAnswerer:
    """Deterministic retrieval followed by grounded local generation."""

    def __init__(
        self,
        search_engine: SearchEngine,
        llm: LocalLLM,
        retrieval_limit: int = 5,
    ) -> None:
        self.search_engine = search_engine
        self.llm = llm
        self.retrieval_limit = retrieval_limit

    def ask(self, question: str) -> GroundedAnswer:
        outcome = self.search_engine.search(
            question,
            limit=self.retrieval_limit,
        )

        # Retrieval abstention means the LLM receives no context.
        if outcome.abstained or not outcome.results:
            return GroundedAnswer(
                answer=(
                    "I couldn't find sufficient information in the available "
                    "BIS knowledge base to answer this reliably."
                ),
                results=[],
            )

        context = _build_context(outcome.results)

        user_prompt = f"""Answer the user's question using ONLY the BIS evidence
below.

USER QUESTION:
{question}

BIS EVIDENCE:
{context}

Give a concise answer grounded in the supplied evidence.
"""

        answer = self.llm.generate(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
            temperature=0.1,
        )

        return GroundedAnswer(
            answer=answer,
            results=outcome.results,
        )
