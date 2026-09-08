# SIH26107 — Evidence-Backed AI Assistant for Indian Standards & BIS Services

## What this project is

A polished, reliable hackathon prototype. A user (industry, MSME, startup, student,
or consumer) asks a BIS-related question in natural language and receives:

1. Relevant BIS information
2. Applicable or candidate Indian Standards **only when supported by evidence**
3. A simple explanation
4. "Why this result?" reasoning grounded in retrieved evidence
5. Official BIS sources
6. Useful next steps

## Core principle (do not violate)

This is an **evidence-backed retrieval and explanation system**.

```
natural language
  -> query understanding
  -> BIS knowledge retrieval
  -> evidence ranking
  -> grounded LLM explanation
  -> answer + evidence + next steps
```

**The LLM is NOT the source of truth. Retrieved BIS information is the source of truth.**

## MVP features (exactly these five)

1. BIS Q&A
2. Product -> Standard discovery  **(flagship)**
3. BIS certification guidance
4. BIS-recognized laboratory search
5. Hallmarking / HUID information

Flagship experience: **"Why this result?"** — for Product -> Standard queries, explain
why a candidate standard was retrieved using actual evidence (product category,
material, intended use, or other info present in the retrieved BIS source).

A standard may only be shown as a recommendation if it exists in the retrieved
knowledge base. **Never invent a standard number.**

## Trust & hallucination rules

The system must NEVER invent:

- Indian Standard numbers
- BIS clauses
- certification schemes
- fees
- testing requirements
- laboratory capabilities
- legal requirements
- HUID results
- certification outcomes

If evidence is insufficient, **explicitly communicate uncertainty or abstain** —
do not guess. Distinguish between: verified information, inferred relevance, uncertainty.

## Architecture

- **Frontend:** React + TypeScript + Vite + Tailwind CSS. shadcn/ui only where useful.
- **Backend:** Python + FastAPI.
- **Database:** PostgreSQL.
- **Retrieval:** Start with simple keyword / full-text retrieval. Add semantic/vector
  retrieval **only if** testing shows a meaningful improvement. Do not add vector
  infrastructure just because it sounds advanced.
- **AI:** LLM provider must be replaceable. Do not architect around Claude specifically.
  The LLM understands and explains retrieved information; retrieved BIS evidence is
  the source of truth.

## Scope limits

Hackathon prototype. **DO NOT introduce:** microservices, Kubernetes, Kafka, agent
swarms, multi-agent architecture, custom LLM training, fine-tuning, computer vision,
mobile apps, voice assistants, fake BIS APIs, fake HUID verification, fake laboratory
results, autonomous legal decisions, unnecessary infrastructure, massive scraping
infrastructure.

Prefer the smallest architecture that produces a reliable and impressive demo.

## Engineering rules

1. Inspect the existing repository before changing anything.
2. Preserve useful existing work.
3. Implement only the current milestone. Do not implement future milestones.
4. Do not add dependencies unless necessary.
5. Do not redesign the architecture without a concrete technical reason.
6. Do not refactor unrelated code.
7. Reuse existing patterns where appropriate.
8. Run relevant tests / checks / builds after changes.
9. Never claim something works without verifying it.
10. Prefer deterministic logic for retrieval, ranking, validation, and structured data.
11. Keep the code understandable to a beginner.
12. Do not create abstractions for hypothetical future requirements.
13. Do not create unnecessary files.
14. Do not use subagents for simple inspection, small edits, or straightforward debugging.
15. Parallelize independent tool operations; keep dependent work sequential.

## The developer

A complete beginner. Work incrementally. Explain what changed and why. Do not assume
familiarity with the codebase, the tools, or the frameworks.

## UI design direction

Aesthetic inspired by the *design philosophy* of Supermemory, but the product must
remain an original BIS interface. Do not copy Supermemory branding, logo, content,
or exact layouts.

Feel: minimal, premium, calm, editorial, modern, spacious, intentional, slightly
futuristic, content-first.

Color system:

- warm off-white / cream background
- very dark charcoal / near-black primary text
- muted warm-gray secondary text
- restrained cyan/blue accent

Avoid: purple AI gradients, blue-purple gradients, excessive neon, glassmorphism,
heavy shadows, huge rounded cards, excessive pills, noisy dashboards, decorative clutter.

Prefer: generous whitespace, strong typography, thin subtle borders, minimal surfaces,
small/moderate corner radii, subtle interaction states, precise alignment, editorial
composition. Premium information/research assistant, not a generic AI SaaS dashboard.

## Knowledge base

Prioritize official BIS information. For the prototype, use a **focused curated
dataset** — do not pretend to have complete BIS coverage. Potential categories:
BIS general info, Indian Standards, certification, certification procedures, testing,
laboratories, hallmarking, consumer information, FAQs.

## Development order (do not skip ahead)

| Phase | Name |
|------:|------|
| 1  | Foundation |
| 2  | BIS knowledge base |
| 3  | Retrieval |
| 4  | RAG / AI answers |
| 5  | Product -> Standard |
| 6  | Certification |
| 7  | Laboratories |
| 8  | Hallmarking |
| 9  | Why this result |
| 10 | UI polish |
| 11 | Testing |
| 12 | Demo hardening |

*Current status: Phase 12 complete — demo hardening. Full clean-shell startup,
frontend<->backend integration and the deterministic demo path
(Product -> Standard -> Why this result -> evidence, LLM-free) were verified
end to end; no white screens, console errors or contract mismatches. One small
fix: `app/llm.py` now raises a short user-facing `LLMError` on an LM Studio HTTP
error / timeout ("LM Studio returned HTTP 400", "could not reach LM Studio
(ReadTimeout)") instead of stringifying the raw httpx exception, which had been
leaking an internal URL and an MDN link into the error callout. Behaviour is
unchanged — still a 503, still no fabricated answer. Regression test:
`backend/tests/test_llm_adapter.py` (15 checks, stubbed `httpx.post`). README
gained a "Demoing" note (lead with the LLM-free Product -> Standard path) and
the authoritative-test command.
Phase 11 recap: testing. No application code changed.
Added `backend/tests/test_rag.py` (dedicated grounded-RAG / `/ask` coverage:
evidence reaches the LLM, abstention makes no LLM call, sources preserved,
`/ask` returns 503 on an LLM outage, no invented standard numbers, system-prompt
trust rules), `backend/tests/test_api_contract.py` (drives the real ASGI app via
`TestClient`: every endpoint's shape + status codes, `limit` bounds -> 422,
malformed body -> 422, an adversarial product sweep proving every returned
`standard_number` exists in the KB), and `backend/tests/test_plain_runners.py`
(a pytest bridge that runs every plain-Python runner as a subprocess and fails
if any exits non-zero — so `python -m pytest -q` is now an authoritative gate,
not just the direct runners). Fake / raising local-model stand-ins keep every
LLM test deterministic and independent of LM Studio.
Phase 10 recap: targeted frontend polish only (no visual-identity change) —
`standardTitle()` helper, "Why this result" hierarchy, calmer timeout/model
error copy.
Phase 9 recap: deterministic "Why this result?" for
Product -> Standard discovery. Phase 9 adds NO new endpoint, NO new retrieval
engine and NO LLM call. The Phase 3 `SearchEngine` already records every scoring
point as a `MatchReason`; `app/product.py` gains a pure function
`explain_candidate(RetrievalResult) -> WhyThisResult` that turns those existing
reasons into a fixed-order list of `signals` plus one plain-language `summary`
("Retrieved as a candidate standard (strong/moderate/weak match) because …").
`strength` mirrors retrieval confidence; the wording never claims legal
applicability. `ProductStandardOutcome` gains a parallel `explanations` list
(empty on abstention) and a standing grounded `note`; `POST /product-standard`
exposes it as `why` on each result (alongside the untouched raw `reasons`).
Frontend: `StandardsView.tsx` shows `result.why.summary` as the lead of the
"Why this result" block, keeping the detailed reason breakdown beneath. Tests:
`backend/tests/test_why_this_result.py` (41 checks).
Phase 8 recap: Hallmarking / HUID information. Phase 8 added
NO new retrieval engine and NO new endpoint: hallmarking / HUID questions go
through the existing deterministic `SearchEngine` + grounded `/ask` pipeline
(`app/rag.py`). The curated KB's `hallmarking` category (plus hallmarking FAQs
and consumer pages) supplies the evidence; it contains no concrete HUID value to
leak. `rag.py`'s shared `SYSTEM_PROMPT` gained rule 6: never claim to verify /
authenticate a specific physical item's HUID, hallmark, licence or registration,
and never output a HUID not present in the supplied context. Frontend:
`frontend/src/features/HallmarkingView.tsx` (route `/hallmarking`, nav
"Hallmarking") calls `api.ask` and renders via the shared `<GroundedAnswer/>`;
it states plainly it does not run live HUID verification. Tests:
`backend/tests/test_hallmarking.py` (37 checks). No individual-lab / no
fabrication rules carry over from Phase 7.
Phase 7 recap: BIS-recognized laboratory search (`app/laboratory.py`,
`POST /laboratory-search`) — runs the Phase 3 `SearchEngine` over
`laboratories` / `testing`, never names a laboratory (KB has no lab records),
points to BIS's official lists + the LIMS portal, abstains with a fixed message
when no evidence is retrieved.
Phase 6 recap: certification guidance (`app/certification.py`,
`POST /certification-guidance`). Phase 5 recap: Product -> Standard discovery
(`app/product.py`, `POST /product-standard`).

Frontend (MetrIQ): `frontend/` — React + TS + Vite + Tailwind v4. The product
is presented as "MetrIQ — AI-Assisted Legal Metrology Inspection". Standards,
Certification, Laboratories, Hallmarking and the header health dot call the real API; the
Inspection / OCR / compliance / history / review surfaces run on clearly
labelled placeholder data (`frontend/src/mocks.tsx`, `<MockDataBanner/>`)
because the backend has no OCR/rules engine. Run: backend on :8000, then
`cd frontend && npm install && npm run dev` (proxies `/api` -> :8000).

All 12 development phases are complete. There is no next milestone; further work
is maintenance only.

Only implement the current milestone. Do not start a new phase without being asked.

## Repository layout

```
sih26107/
  CLAUDE.md            # this file — project rules
  README.md            # setup & run instructions
  backend/             # Python + FastAPI service
    app/
      main.py          # FastAPI app: /health + the api.py router
      api.py           # /search, /ask, /product-standard, /certification-guidance
      llm.py           # LM Studio / Qwen3-8B local LLM adapter
      rag.py           # grounded BIS question-answering pipeline (/ask)
      product.py       # Phase 5: Product -> Standard discovery + Phase 9 "Why this result?"
      certification.py # Phase 6: BIS certification guidance
      laboratory.py    # Phase 7: BIS-recognized laboratory search
      knowledge/       # knowledge-base schema + loader
        schema.py      # KnowledgeItem pydantic model + validation rules
        loader.py      # load + validate data/knowledge/, report every problem
      retrieval/       # Phase 3: deterministic lexical search
        text.py        # normalize / tokenize / parse standard numbers
        engine.py      # SearchEngine, scoring, ranking, confidence, abstention
    scripts/
      check_knowledge.py   # CLI: validate the knowledge base
    tests/                 # plain-Python runners: `./.venv/bin/python tests/<file>`
      test_knowledge.py    # KB schema + loader (broken-KB fixtures)
      test_retrieval.py    # retrieval ranking / abstention + /search API
      test_product.py      # Product -> Standard
      test_why_this_result.py # deterministic why-this-result
      test_certification.py # certification guidance
      test_laboratory.py   # laboratory search
      test_hallmarking.py  # hallmarking / HUID (via /ask)
      test_rag.py          # grounded RAG pipeline + /ask (fake LLM, 503 path)
      test_api_contract.py # real ASGI app via TestClient: shapes, 422, 404, 503
      test_llm_adapter.py  # app/llm.py: healthy parse + clean LLMError on every failure
      test_plain_runners.py # pytest bridge — runs every runner, makes pytest authoritative
      fixtures/broken_kb/  # deliberately invalid KB for the loader tests
    requirements.txt
    .env.example
  data/
    knowledge/         # the BIS knowledge base: one JSON file per category
  frontend/            # React + Vite app — added when the UI phase begins
```

### Knowledge base

`data/knowledge/` holds one JSON array file per category. `KnowledgeItem`
(`backend/app/knowledge/schema.py`) is a flat structure that maps 1:1 to a future
PostgreSQL row. Rules: unique slug IDs, non-sample items need a `source_url`,
`indian_standards` items need a `standard_number` (unique within that category),
`verified` items need `source_url` + `last_verified`. Validate with
`./.venv/bin/python scripts/check_knowledge.py`.

Phase 2B populated it from official BIS pages only (`bis.gov.in`,
`services.bis.gov.in`). Indian Standards records come mostly from the BIS "Products
under Compulsory Certification" lists (Scheme I / Scheme II), so they carry BIS's
own product description, not the verbatim catalogue title — each record's `content`
states this. Do not treat the dataset as complete BIS coverage.

### Retrieval (Phase 3)

`app/retrieval/engine.py` — `SearchEngine.search(query)` returns a `SearchOutcome`
with ranked `RetrievalResult`s. Scoring is a transparent weighted sum over
`title` / `keywords` / `standard_number` / `category` / `document_name` /
`reference` / `content`; every point is recorded as a `MatchReason` (for the future
"Why this result?"). Confidence (`high` / `medium` / `low` / `none`) comes from the
top hit's score plus query-term coverage; all weights and thresholds live in
`RetrievalConfig`. `abstained` is true (and `results` empty) when nothing matches.
The LLM must never generate the match reasons — retrieval produces them.
