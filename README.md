# SIH26107 — Evidence-Backed AI Assistant for Indian Standards & BIS Services

Ask a BIS-related question in natural language and get relevant BIS information,
candidate Indian Standards (only when the evidence supports them), a plain
explanation, the official source, **why the result is relevant**, and useful
next steps.

The retrieved BIS information is the source of truth — not the LLM.

See [`CLAUDE.md`](./CLAUDE.md) for the full project rules and roadmap.

## Status

**Phase 3 — complete.** Deterministic lexical retrieval over the knowledge base,
exposed as `GET/POST /search`. No LLM, RAG, embeddings, or database.
Next: Phase 4 (RAG / AI answers).

## Project layout

```
backend/    Python + FastAPI service
  app/knowledge/    knowledge-base schema + loader
  app/retrieval/    deterministic lexical search (text.py, engine.py)
  app/api.py        GET/POST /search endpoint
  app/main.py       FastAPI app (/health, /search)
  scripts/          check_knowledge.py — validate the knowledge base
  tests/            plain-Python checks
data/
  knowledge/        the BIS knowledge base — one JSON file per category
frontend/   React + Vite app (added when the UI phase begins)
```

## Knowledge base

The knowledge base in `data/knowledge/` is the source of truth for BIS
information. Validate it any time:

```bash
cd backend
./.venv/bin/python scripts/check_knowledge.py
```

See [`data/knowledge/README.md`](./data/knowledge/README.md) for the schema and rules.

## Search (Phase 3)

Deterministic keyword retrieval over the knowledge base — no LLM, no embeddings.

```bash
# with the server running (see below):
curl "http://127.0.0.1:8000/search?q=what%20is%20HUID"
curl -X POST http://127.0.0.1:8000/search -H 'content-type: application/json' \
     -d '{"query": "IS 1786:2008", "limit": 3}'
```

**How it scores** — each query term is matched against a record's fields and the
weights are added up (all configurable in `app/retrieval/engine.py`):
standard-number match 8 (12 if the year also matches), title 4, keyword 3,
category hint 2, document name 1.5, reference 1, buried content mention 1.

**Confidence** of the top hit, from its total score: `high` ≥ 7.5, `medium` ≥ 4.0,
`low` ≥ 1.0, else `none`. If the top hit covers less than ~1/3 of the query terms
the confidence is capped at `low`. When nothing matches, the response has
`confidence: "none"`, `abstained: true`, and an empty `results` list — the system
never invents a result.

Every result carries its `matched_terms` and a `reasons` list (which field each
term matched and its weight), plus the record's `source_url` and
`verification_status`, so a later phase can build "Why this result?" from real
signals.

Run the retrieval checks:

```bash
cd backend
./.venv/bin/python tests/test_retrieval.py
```

## Running the backend

You need Python 3.11+ installed.

```bash
cd backend

# 1. Create an isolated environment (once)
python3 -m venv .venv

# 2. Activate it (do this every new terminal)
source .venv/bin/activate

# 3. Install dependencies (once, or when requirements.txt changes)
pip install -r requirements.txt

# 4. Start the dev server (auto-reloads on file changes)
uvicorn app.main:app --reload
```

Then check it works:

- Health check: <http://127.0.0.1:8000/health> → `{"status":"ok",...}`
- Interactive API docs: <http://127.0.0.1:8000/docs>

To stop the server press `Ctrl+C`. To leave the environment run `deactivate`.
