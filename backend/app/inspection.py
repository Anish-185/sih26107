"""Inspection analysis — the IMAGE -> OCR step of the MetrIQ pipeline.

Scope of this phase: decode the uploaded package image, run lightweight quality
checks, run local OCR, and return the raw OCR regions. Nothing here extracts
declarations, applies legal rules, or produces a PASS/FAIL — those are separate
downstream phases and their fields are returned as ``"Pending extraction"`` /
empty, never invented.
"""

from __future__ import annotations

import io
import uuid
from datetime import datetime, timezone

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, Field

from app.ocr import OCR_ENGINE, OcrError, run_ocr

# Guard rails for a demo backend on a laptop.
MAX_BYTES = 20 * 1024 * 1024          # 20 MB upload cap
MIN_DIMENSION = 80                    # px — smaller than this cannot hold a label
MAX_DIMENSION = 6000                  # px — anything larger is downscaled for OCR
OCR_MAX_SIDE = 2000                   # px — long side the OCR engine actually sees
SUPPORTED_FORMATS = {"JPEG", "PNG", "WEBP", "BMP", "TIFF", "MPO"}


class ImageError(ValueError):
    """The uploaded bytes are not a usable image."""


# ---------------------------------------------------------------------------
# Response models  (mirrors backend/app/api.py conventions: `*Out` suffix)
# ---------------------------------------------------------------------------

class ImageInfoOut(BaseModel):
    filename: str
    format: str
    width: int
    height: int
    bytes: int


class QualityOut(BaseModel):
    blur_score: float = Field(
        description="Variance of the Laplacian. Higher = sharper; "
        "roughly < 100 indicates a blurred image."
    )
    brightness: float = Field(description="Mean luma, 0-255.")
    contrast: float = Field(description="Std-dev of luma, 0-255.")
    is_low_quality: bool
    notes: list[str]


class OcrRegionOut(BaseModel):
    id: str = Field(description="Stable within one analysis, e.g. OCR-001.")
    text: str = Field(description="Raw recognised text, exactly as OCR returned it.")
    confidence: float = Field(ge=0.0, le=1.0)
    bbox: list[int] = Field(
        description="Axis-aligned [x1, y1, x2, y2] in source-image pixels."
    )
    polygon: list[list[int]] = Field(
        description="Original [[x,y] x4] quad (may be rotated), pixels."
    )


class OcrOut(BaseModel):
    engine: str
    text: str = Field(description="All region texts joined in reading order.")
    region_count: int
    mean_confidence: float
    duration_ms: int
    regions: list[OcrRegionOut]


class InspectionAnalysisOut(BaseModel):
    inspection_id: str
    created_at: str
    image: ImageInfoOut
    quality: QualityOut
    ocr: OcrOut
    # Downstream phases — explicitly not done yet.
    product: str = "Pending extraction"
    declarations: list[dict] = Field(default_factory=list)
    checks: list[dict] = Field(default_factory=list)
    status: str = "PENDING"
    pipeline_stage: str = "ocr"
    notes: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class InspectionAnalyzer:
    """Decode -> quality -> OCR. Stateless; safe to reuse."""

    def analyze(self, data: bytes, filename: str) -> InspectionAnalysisOut:
        if not data:
            raise ImageError("Empty upload.")
        if len(data) > MAX_BYTES:
            raise ImageError(
                f"Image is {len(data) // (1024 * 1024)} MB; the limit is "
                f"{MAX_BYTES // (1024 * 1024)} MB."
            )

        image = self._decode(data)
        fmt = (image.format or "").upper() or "UNKNOWN"

        # Respect EXIF orientation so bounding boxes line up with what the
        # frontend renders, then work in RGB.
        image = ImageOps.exif_transpose(image).convert("RGB")
        width, height = image.size

        if min(width, height) < MIN_DIMENSION:
            raise ImageError(
                f"Image is {width}x{height}px — too small to read a label."
            )

        arr = np.asarray(image, dtype=np.uint8)
        quality = self._quality(arr)

        ocr_arr, scale = self._prepare_for_ocr(arr)
        try:
            raw_regions, elapsed = run_ocr(ocr_arr)
        except OcrError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise OcrError(f"OCR failed unexpectedly: {exc}") from exc

        regions: list[OcrRegionOut] = []
        for i, r in enumerate(raw_regions, start=1):
            bbox = [int(round(v / scale)) for v in r.bbox]
            polygon = [[int(round(x / scale)), int(round(y / scale))] for x, y in r.polygon]
            regions.append(
                OcrRegionOut(
                    id=f"OCR-{i:03d}",
                    text=r.text,
                    confidence=round(r.confidence, 4),
                    bbox=bbox,
                    polygon=polygon,
                )
            )

        mean_conf = (
            round(sum(x.confidence for x in regions) / len(regions), 4)
            if regions
            else 0.0
        )
        joined = "\n".join(x.text for x in regions)

        notes: list[str] = []
        if not regions:
            notes.append(
                "OCR found no legible text in this image. "
                "Try a sharper, straight-on photo of the declaration panel."
            )
        notes.extend(quality.notes)

        return InspectionAnalysisOut(
            inspection_id=f"INS-{datetime.now(timezone.utc):%Y%m%d}-{uuid.uuid4().hex[:6].upper()}",
            created_at=datetime.now(timezone.utc).isoformat(),
            image=ImageInfoOut(
                filename=filename or "upload",
                format=fmt,
                width=width,
                height=height,
                bytes=len(data),
            ),
            quality=quality,
            ocr=OcrOut(
                engine=OCR_ENGINE,
                text=joined,
                region_count=len(regions),
                mean_confidence=mean_conf,
                duration_ms=int(elapsed * 1000),
                regions=regions,
            ),
            notes=notes,
        )

    # -- internals ---------------------------------------------------------

    @staticmethod
    def _decode(data: bytes) -> Image.Image:
        try:
            image = Image.open(io.BytesIO(data))
            image.load()  # force decode now so corrupt files fail here
        except (UnidentifiedImageError, OSError) as exc:
            raise ImageError(
                "Could not read this file as an image. Supported: JPG, PNG, WEBP."
            ) from exc
        if (image.format or "").upper() not in SUPPORTED_FORMATS:
            raise ImageError(
                f"Unsupported image format: {image.format or 'unknown'}. "
                "Use JPG, PNG or WEBP."
            )
        return image

    @staticmethod
    def _quality(arr: np.ndarray) -> QualityOut:
        luma = (
            0.299 * arr[..., 0] + 0.587 * arr[..., 1] + 0.114 * arr[..., 2]
        ).astype(np.float64)

        brightness = float(luma.mean())
        contrast = float(luma.std())

        # Variance of the Laplacian (a 3x3 kernel) as a blur proxy — the same
        # measure OpenCV's cv2.Laplacian(...).var() gives, done with numpy.
        lap = (
            -4.0 * luma
            + np.roll(luma, 1, 0)
            + np.roll(luma, -1, 0)
            + np.roll(luma, 1, 1)
            + np.roll(luma, -1, 1)
        )
        blur_score = float(lap[1:-1, 1:-1].var())

        notes: list[str] = []
        if blur_score < 80:
            notes.append("Image looks blurred — OCR confidence may be low.")
        if brightness < 55:
            notes.append("Image is quite dark.")
        elif brightness > 225:
            notes.append("Image is over-exposed / washed out.")
        if contrast < 25:
            notes.append("Low contrast between text and background.")

        return QualityOut(
            blur_score=round(blur_score, 2),
            brightness=round(brightness, 2),
            contrast=round(contrast, 2),
            is_low_quality=bool(notes),
            notes=notes,
        )

    @staticmethod
    def _prepare_for_ocr(arr: np.ndarray) -> tuple[np.ndarray, float]:
        """Downscale very large images so OCR stays quick. Returns the array
        the engine sees and the scale factor (ocr_px / source_px) so boxes can
        be mapped back to source coordinates."""
        h, w = arr.shape[:2]
        long_side = max(h, w)
        if long_side <= OCR_MAX_SIDE:
            return arr, 1.0
        scale = OCR_MAX_SIDE / long_side
        new_size = (max(1, int(w * scale)), max(1, int(h * scale)))
        resized = Image.fromarray(arr).resize(new_size, Image.LANCZOS)
        return np.asarray(resized, dtype=np.uint8), scale
