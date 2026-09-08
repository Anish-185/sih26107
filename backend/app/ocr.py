"""Local OCR engine wrapper.

MetrIQ's inspection pipeline is:

    IMAGE -> OCR -> raw OCR regions -> (later phases) extraction / rules

This module owns the OCR step and nothing else. It does not normalise,
interpret or rewrite the text — that belongs to the deterministic declaration
extraction phase.

Engine
------
The reference engine for this project is PaddleOCR (PP-OCR). PaddlePaddle
publishes no wheels for the Python version this backend runs on, so we run the
*same PP-OCR model weights* through ONNX Runtime via ``rapidocr-onnxruntime``.
Detection + angle classification + recognition, all local, no network at
inference, no paid service. If a Python <= 3.12 environment becomes available,
swapping in the ``paddleocr`` package is a change contained entirely to this
file — ``run_ocr`` is the only surface the rest of the app sees.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from functools import lru_cache

import numpy as np

OCR_ENGINE = "rapidocr-onnxruntime (PP-OCRv3 weights via ONNX Runtime)"


class OcrError(RuntimeError):
    """Raised when the OCR engine fails to process an image."""


@dataclass(frozen=True)
class RawRegion:
    """One text region exactly as the OCR engine reported it.

    ``bbox`` is an axis-aligned box ``[x1, y1, x2, y2]`` in source-image
    pixels; ``polygon`` keeps the original (possibly rotated) quad.
    ``confidence`` is the engine's recognition score in ``[0, 1]``.
    """

    text: str
    confidence: float
    bbox: tuple[int, int, int, int]
    polygon: list[list[int]]


@lru_cache(maxsize=1)
def _engine():
    """Load the OCR engine once. First call is a few hundred ms; the model
    files ship inside the wheel, so there is no download."""
    try:
        from rapidocr_onnxruntime import RapidOCR
    except ImportError as exc:  # pragma: no cover - install-time problem
        raise OcrError(
            "OCR engine not installed. Run: pip install -r requirements.txt"
        ) from exc
    return RapidOCR()


_engine_lock = threading.Lock()


def warm_up() -> None:
    """Build the engine ahead of the first request (optional)."""
    with _engine_lock:
        _engine()


def run_ocr(image: np.ndarray) -> tuple[list[RawRegion], float]:
    """Run OCR on an RGB ``uint8`` numpy array.

    Returns ``(regions, elapsed_seconds)``. An image with no legible text is a
    valid result — it returns ``([], elapsed)``, never fabricated text.
    """
    if image.ndim != 3 or image.shape[2] != 3:
        raise OcrError("OCR expects an RGB image array")

    started = time.perf_counter()
    try:
        with _engine_lock:  # the ONNX session is not guaranteed thread-safe
            result, _ = _engine()(image)
    except Exception as exc:  # noqa: BLE001 - surface any engine failure cleanly
        raise OcrError(f"OCR engine failed: {exc}") from exc
    elapsed = time.perf_counter() - started

    regions: list[RawRegion] = []
    for entry in result or []:
        try:
            poly_raw, text, score = entry
        except (TypeError, ValueError):
            continue
        poly = [[int(round(p[0])), int(round(p[1]))] for p in poly_raw]
        xs = [p[0] for p in poly]
        ys = [p[1] for p in poly]
        regions.append(
            RawRegion(
                text=str(text),
                confidence=_as_float(score),
                bbox=(min(xs), min(ys), max(xs), max(ys)),
                polygon=poly,
            )
        )

    # Reading order: top-to-bottom, then left-to-right within a rough line band.
    regions.sort(key=lambda r: (round(r.bbox[1] / 12), r.bbox[0]))
    return regions, elapsed


def _as_float(value: object) -> float:
    try:
        return max(0.0, min(1.0, float(value)))  # engine returns a str score
    except (TypeError, ValueError):
        return 0.0
