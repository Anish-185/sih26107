"""HTTP layer for the inspection pipeline.

    POST /inspection/analyze   multipart/form-data, field "image"
      -> InspectionAnalysisOut   (image info + quality + raw OCR regions)
"""

from __future__ import annotations

from functools import lru_cache

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.inspection import (
    MAX_BYTES,
    ImageError,
    InspectionAnalysisOut,
    InspectionAnalyzer,
)
from app.ocr import OcrError

router = APIRouter(prefix="/inspection", tags=["inspection"])


@lru_cache(maxsize=1)
def get_analyzer() -> InspectionAnalyzer:
    return InspectionAnalyzer()


@router.post("/analyze", response_model=InspectionAnalysisOut)
async def analyze(image: UploadFile = File(...)) -> InspectionAnalysisOut:
    """Decode the uploaded package image, run quality checks and local OCR,
    and return the raw OCR regions. No declaration extraction or rule checks
    happen here — those are later phases."""
    content_type = (image.content_type or "").lower()
    if content_type and not content_type.startswith("image/"):
        raise HTTPException(
            status_code=415,
            detail=f"Expected an image upload, got '{content_type}'.",
        )

    data = await image.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Image exceeds the {MAX_BYTES // (1024 * 1024)} MB limit.",
        )

    try:
        return get_analyzer().analyze(data, image.filename or "upload")
    except ImageError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except OcrError as exc:
        raise HTTPException(status_code=503, detail=f"OCR unavailable: {exc}") from exc
