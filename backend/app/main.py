"""FastAPI application entry point.

Phase 1 (Foundation): this only exposes a health check so we can confirm the
backend runs. Retrieval, the knowledge base, and the LLM are added in later phases.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="BIS Assistant API",
    description="Evidence-backed AI assistant for Indian Standards and BIS services.",
    version="0.1.0",
)

# The frontend (added in a later phase) will run on a different port during
# development, so allow local origins to call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    """Liveness check. Returns 200 with a small JSON body when the API is up."""
    return {"status": "ok", "service": "bis-assistant-api", "version": "0.1.0"}
