# SIH26107 — Evidence-Backed AI Assistant for Indian Standards & BIS Services

Ask a BIS-related question in natural language and get relevant BIS information,
candidate Indian Standards (only when the evidence supports them), a plain
explanation, the official source, **why the result is relevant**, and useful
next steps.

The retrieved BIS information is the source of truth — not the LLM.

See [`CLAUDE.md`](./CLAUDE.md) for the full project rules and roadmap.

## Status

**Phase 1 (Foundation) — complete.** Backend runs and answers a health check.
No retrieval, knowledge base, or LLM yet. Next: Phase 2 (BIS knowledge base).

## Project layout

```
backend/    Python + FastAPI service
data/       curated BIS knowledge base source files (Phase 2)
frontend/   React + Vite app (added when the UI phase begins)
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
