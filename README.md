# SIH26107 — Evidence-Backed AI Assistant for Indian Standards & BIS Services

Ask a BIS-related question in natural language and get relevant BIS information,
candidate Indian Standards (only when the evidence supports them), a plain
explanation, the official source, **why the result is relevant**, and useful
next steps.

The retrieved BIS information is the source of truth — not the LLM.

See [`CLAUDE.md`](./CLAUDE.md) for the full project rules and roadmap.

## Status

Phases 1–12 complete. The backend exposes deterministic retrieval plus grounded
explanation; the frontend (MetrIQ) is a complete inspection-oriented UI.

| Endpoint | What it does | LLM? |
|---|---|---|
| `GET /health` | liveness check | no |
| `GET`/`POST /search` | deterministic lexical retrieval over the knowledge base | no |
| `POST /product-standard` | Product → candidate Indian Standard, with deterministic "Why this result?" | no |
| `POST /ask` | grounded BIS Q&A (used by the Hallmarking / HUID screen) | yes |
| `POST /certification-guidance` | grounded BIS certification guidance | yes |
| `POST /laboratory-search` | BIS-recognised laboratory directories (`explain=false` skips the LLM) | optional |

Deterministic retrieval is always the source of truth. The LLM only explains
already-retrieved evidence; when the evidence is insufficient the system abstains
and does **not** call the LLM.

## Project layout

```
backend/    Python + FastAPI service
  app/knowledge/    knowledge-base schema + loader
  app/retrieval/    deterministic lexical search (text.py, engine.py)
  app/rag.py        grounded question answering (/ask)
  app/product.py    Product -> Standard + "Why this result?"
  app/certification.py, app/laboratory.py
  app/llm.py        local LM Studio adapter (OpenAI-compatible)
  app/api.py        the API router;  app/main.py  the FastAPI app
  scripts/          check_knowledge.py — validate the knowledge base
  tests/            plain-Python checks + pytest
data/
  knowledge/        the BIS knowledge base — one JSON file per category
frontend/   React + TypeScript + Vite + Tailwind v4 (see frontend/README.md)
```

## Knowledge base

The knowledge base in `data/knowledge/` is the source of truth for BIS
information. Validate it any time:

```bash
cd backend
./.venv/bin/python scripts/check_knowledge.py
```

See [`data/knowledge/README.md`](./data/knowledge/README.md) for the schema and rules.

## Running the backend

Requires Python 3.11+.

```bash
cd backend

python3 -m venv .venv                 # once
source .venv/bin/activate             # every new terminal
pip install -r requirements.txt       # once, or when requirements.txt changes

uvicorn app.main:app --reload         # http://127.0.0.1:8000
```

Check it works:

- Health: <http://127.0.0.1:8000/health> → `{"status":"ok",...}`
- API docs: <http://127.0.0.1:8000/docs>

## Local LLM (for the grounded endpoints)

`/ask`, `/certification-guidance` and `/laboratory-search?explain=true` call a
local [LM Studio](https://lmstudio.ai) server that exposes an OpenAI-compatible
API. Load a small instruction model (default: `qwen/qwen3-8b`) and start the
LM Studio server on port `1234`. Override with environment variables if needed:

```bash
export LLM_BASE_URL=http://127.0.0.1:1234/v1   # default
export LLM_MODEL=qwen/qwen3-8b                  # default
```

If LM Studio is not running, the deterministic endpoints (`/search`,
`/product-standard`) still work fully, and the grounded endpoints return a clear
`503` instead of a fabricated answer.

### Demoing

The reliable, LLM-free path is **Product → Standard** (the "Standards" screen):
type a product, get candidate Indian Standards with a deterministic "Why this
result?" and the official BIS source — no local model involved. The header
health dot and the Laboratories screen (default, `explain` off) are also
LLM-free. The grounded Q&A screens (Certification, Hallmarking) need LM Studio;
on this machine local inference can be slow, so lead with Product → Standard.

## Running the frontend

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173  (proxies /api -> :8000)
```

See [`frontend/README.md`](./frontend/README.md) for the production build and the
map of which screens call which endpoint.

## Tests

```bash
cd backend
./.venv/bin/python -m pytest -q                 # all suites (bridged to the runners below)
./.venv/bin/python scripts/check_knowledge.py   # knowledge-base validation

# the authoritative runners can also be run one by one:
for t in tests/test_*.py; do ./.venv/bin/python "$t"; done

cd ../frontend
npx tsc --noEmit                                # type check
npm run build                                   # production build
```

The backend suites are plain-Python runners (each exits non-zero on failure);
`tests/test_plain_runners.py` runs them all under pytest, so `pytest -q` is an
authoritative gate. LLM tests use a fake local model — no LM Studio needed.

## Retrieval scoring (reference)

Each query term is matched against a record's fields and the weights are added up
(all configurable in `app/retrieval/engine.py`): standard-number match 8 (12 if
the year also matches), title 4, keyword 3, category hint 2, document name 1.5,
reference 1, buried content mention 1.

**Confidence** of the top hit, from its total score: `high` ≥ 7.5, `medium` ≥ 4.0,
`low` ≥ 1.0, else `none`. If the top hit covers less than ~1/3 of the query terms
the confidence is capped at `low`. When nothing matches, the response has
`confidence: "none"`, `abstained: true`, and an empty `results` list — the system
never invents a result. Every result carries its `matched_terms` and a `reasons`
list (which field each term matched and its weight).
