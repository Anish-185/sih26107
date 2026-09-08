"""HTTP layer for retrieval and grounded question answering.

Endpoints:
  - GET/POST /search
  - POST /ask

/search remains deterministic lexical retrieval.
/ask retrieves BIS evidence first, then uses the local Qwen3 model
to generate an answer grounded in that evidence.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.llm import LLMError, LocalLLM
from app.rag import BISQuestionAnswerer
from app.retrieval import RetrievalResult, SearchEngine, SearchOutcome

router = APIRouter(tags=["search"])


@lru_cache(maxsize=1)
def get_engine() -> SearchEngine:
    """One SearchEngine for the whole process (loads the knowledge base once)."""
    return SearchEngine()


@lru_cache(maxsize=1)
def get_answerer() -> BISQuestionAnswerer:
    """One grounded QA pipeline for the whole process."""
    return BISQuestionAnswerer(
        search_engine=get_engine(),
        llm=LocalLLM(),
    )


# --------------------------------------------------------------------- responses


class ReasonOut(BaseModel):
    field: str
    term: str
    weight: float
    detail: str = ""


class ResultOut(BaseModel):
    id: str
    title: str
    category: str
    content: str
    score: float
    confidence: str
    matched_terms: list[str]
    reasons: list[ReasonOut]
    standard_number: str | None = None
    source_organization: str
    source_url: str | None = None
    document_name: str | None = None
    reference: str | None = None
    verification_status: str
    last_verified: str | None = None


class SearchResponse(BaseModel):
    query: str
    normalized_query: str
    query_terms: list[str]
    query_standard_numbers: list[str]
    confidence: str
    abstained: bool
    note: str = ""
    count: int
    results: list[ResultOut]


class SearchRequest(BaseModel):
    query: str = Field(default="", description="Natural-language question")
    limit: int | None = Field(default=None, ge=1, le=50)


# --------------------------------------------------------------------- ask models


class SourceOut(BaseModel):
    id: str
    title: str
    category: str
    standard_number: str | None = None
    score: float
    confidence: str
    matched_terms: list[str]
    source_organization: str
    source_url: str | None = None
    document_name: str | None = None
    reference: str | None = None
    verification_status: str
    last_verified: str | None = None


class AskRequest(BaseModel):
    question: str = Field(
        default="",
        description="Question about BIS standards or BIS information",
    )


class AskResponse(BaseModel):
    question: str
    answer: str
    grounded: bool
    source_count: int
    sources: list[SourceOut]


# --------------------------------------------------------------------- helpers


def _result_to_out(result: RetrievalResult) -> ResultOut:
    item = result.item
    return ResultOut(
        id=item.id,
        title=item.title,
        category=item.category,
        content=item.content,
        score=result.score,
        confidence=result.confidence,
        matched_terms=result.matched_terms,
        reasons=[
            ReasonOut(
                field=r.field,
                term=r.term,
                weight=r.weight,
                detail=r.detail,
            )
            for r in result.reasons
        ],
        standard_number=item.standard_number,
        source_organization=item.source_organization,
        source_url=item.source_url,
        document_name=item.document_name,
        reference=item.reference,
        verification_status=item.verification_status,
        last_verified=(
            item.last_verified.isoformat()
            if item.last_verified
            else None
        ),
    )


def _outcome_to_response(outcome: SearchOutcome) -> SearchResponse:
    return SearchResponse(
        query=outcome.query,
        normalized_query=outcome.normalized_query,
        query_terms=outcome.query_terms,
        query_standard_numbers=outcome.query_standard_numbers,
        confidence=outcome.confidence,
        abstained=outcome.abstained,
        note=outcome.note,
        count=len(outcome.results),
        results=[_result_to_out(r) for r in outcome.results],
    )


def _result_to_source(result: RetrievalResult) -> SourceOut:
    item = result.item

    return SourceOut(
        id=item.id,
        title=item.title,
        category=item.category,
        standard_number=item.standard_number,
        score=result.score,
        confidence=result.confidence,
        matched_terms=result.matched_terms,
        source_organization=item.source_organization,
        source_url=item.source_url,
        document_name=item.document_name,
        reference=item.reference,
        verification_status=item.verification_status,
        last_verified=(
            item.last_verified.isoformat()
            if item.last_verified
            else None
        ),
    )


# --------------------------------------------------------------------- routes


@router.get("/search", response_model=SearchResponse)
def search_get(
    q: Annotated[str, Query(description="Natural-language question")] = "",
    limit: Annotated[int | None, Query(ge=1, le=50)] = None,
) -> SearchResponse:
    return _outcome_to_response(get_engine().search(q, limit))


@router.post("/search", response_model=SearchResponse)
def search_post(request: SearchRequest) -> SearchResponse:
    return _outcome_to_response(
        get_engine().search(request.query, request.limit)
    )


@router.post("/ask", response_model=AskResponse)
def ask_post(request: AskRequest) -> AskResponse:
    question = request.question.strip()

    if not question:
        return AskResponse(
            question="",
            answer=(
                "Please provide a question about BIS standards or "
                "BIS information."
            ),
            grounded=False,
            source_count=0,
            sources=[],
        )

    try:
        result = get_answerer().ask(question)
    except LLMError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Local LLM unavailable: {exc}",
        ) from exc

    return AskResponse(
        question=question,
        answer=result.answer,
        grounded=bool(result.results),
        source_count=len(result.results),
        sources=[
            _result_to_source(result_item)
            for result_item in result.results
        ],
    )
