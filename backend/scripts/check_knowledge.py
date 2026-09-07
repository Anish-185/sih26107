"""Validate the BIS knowledge base and print a report.

Usage:

    cd backend
    ./.venv/bin/python scripts/check_knowledge.py [path/to/knowledge/dir]

Exit code 0 = valid, 1 = problems found.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.knowledge.loader import main  # noqa: E402

if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
