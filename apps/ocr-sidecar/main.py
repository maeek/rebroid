from __future__ import annotations

import base64
import io
import os
import time
from functools import lru_cache
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from PIL import Image, ImageEnhance, ImageOps
import numpy as np

MAX_INPUT_BYTES = int(os.getenv("OCR_MAX_INPUT_BYTES", str(24 * 1024 * 1024)))
SUPPORTED_PREPROCESS_MODES = {"raw", "grayscale", "contrast", "threshold"}
DEFAULT_LANGUAGES = [
    item.strip()
    for item in os.getenv("OCR_LANGUAGES", "en").split(",")
    if item.strip()
] or ["en"]
DEFAULT_MIN_CONFIDENCE = float(os.getenv("OCR_MIN_CONFIDENCE", "0.4"))
DEFAULT_MAX_IMAGE_DIMENSION = int(os.getenv("OCR_MAX_IMAGE_DIMENSION", "1600"))
DEFAULT_PREPROCESS_MODES = [
    item.strip()
    for item in os.getenv(
        "OCR_PREPROCESS_MODES",
        "raw,grayscale,contrast,threshold",
    ).split(",")
    if item.strip()
] or ["raw"]

app = FastAPI(title="Rebroid OCR sidecar")


class OcrRequest(BaseModel):
    dataUrl: str | None = None
    imageBase64: str | None = None
    languages: list[str] | None = None
    preprocessingModes: list[str] | None = None
    minConfidence: float = Field(default=DEFAULT_MIN_CONFIDENCE, ge=0, le=1)
    maxImageDimension: int = Field(
        default=DEFAULT_MAX_IMAGE_DIMENSION,
        ge=320,
        le=4096,
    )


def _decode_image(payload: OcrRequest) -> Image.Image:
    raw_value = payload.imageBase64
    if payload.dataUrl:
        if "," not in payload.dataUrl:
            raise HTTPException(status_code=400, detail="Invalid data URL.")
        raw_value = payload.dataUrl.split(",", 1)[1]
    if not raw_value:
        raise HTTPException(status_code=400, detail="Missing image payload.")

    try:
        image_bytes = base64.b64decode(raw_value, validate=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid base64 image.") from exc
    if len(image_bytes) > MAX_INPUT_BYTES:
        raise HTTPException(status_code=413, detail="Image payload is too large.")

    try:
        return Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Unsupported image payload.") from exc


def _resize_image(image: Image.Image, max_dimension: int) -> Image.Image:
    width, height = image.size
    largest = max(width, height)
    if largest <= max_dimension:
        return image
    scale = max_dimension / float(largest)
    return image.resize(
        (max(1, int(width * scale)), max(1, int(height * scale))),
        Image.Resampling.LANCZOS,
    )


def _preprocess_image(image: Image.Image, mode: str) -> Image.Image:
    if mode == "raw":
        return image.convert("RGB")
    grayscale = ImageOps.grayscale(image)
    if mode == "grayscale":
        return grayscale.convert("RGB")
    if mode == "contrast":
        contrasted = ImageEnhance.Contrast(ImageOps.autocontrast(grayscale)).enhance(1.8)
        return contrasted.convert("RGB")
    if mode == "threshold":
        contrasted = ImageEnhance.Contrast(ImageOps.autocontrast(grayscale)).enhance(1.8)
        thresholded = contrasted.point(lambda pixel: 255 if pixel >= 150 else 0)
        return thresholded.convert("RGB")
    return image.convert("RGB")


def _normalize_preprocessing_modes(modes: list[str] | None) -> list[str]:
    selected = modes or DEFAULT_PREPROCESS_MODES
    normalized: list[str] = []
    for mode in selected:
        value = mode.strip().lower()
        if value in SUPPORTED_PREPROCESS_MODES and value not in normalized:
            normalized.append(value)
    return normalized or ["raw"]


@lru_cache(maxsize=4)
def _ocr_engine(language: str):
    PaddleOCR = _paddle_ocr_class()

    try:
        return PaddleOCR(use_angle_cls=True, lang=language, show_log=False)
    except TypeError:
        return PaddleOCR(use_angle_cls=True, lang=language)


@lru_cache(maxsize=1)
def _paddle_ocr_class():
    from paddleocr import PaddleOCR

    return PaddleOCR


@lru_cache(maxsize=1)
def _ocr_runtime_probe():
    try:
        _paddle_ocr_class()
    except Exception as exc:
        return {
            "ready": False,
            "message": f"OCR runtime import failed: {_sanitize_error(exc)}",
        }
    return {"ready": True, "message": "OCR runtime is ready."}


def _iter_lines(raw_result: Any):
    if not raw_result:
        return
    batches = raw_result
    if isinstance(raw_result, list) and len(raw_result) == 1 and isinstance(raw_result[0], list):
        batches = raw_result[0]
    for item in batches:
        if not isinstance(item, (list, tuple)) or len(item) < 2:
            continue
        box = item[0]
        text_conf = item[1]
        if not isinstance(text_conf, (list, tuple)) or len(text_conf) < 2:
            continue
        yield box, str(text_conf[0]), float(text_conf[1])


def _bounds_from_box(box: Any, width: int, height: int):
    points = [
        point
        for point in box
        if isinstance(point, (list, tuple)) and len(point) >= 2
    ]
    if not points:
        return None
    xs = [float(point[0]) for point in points]
    ys = [float(point[1]) for point in points]
    left = max(0.0, min(xs) / width)
    top = max(0.0, min(ys) / height)
    right = min(1.0, max(xs) / width)
    bottom = min(1.0, max(ys) / height)
    return {
        "left": left,
        "top": top,
        "width": max(0.0, right - left),
        "height": max(0.0, bottom - top),
    }


def _sanitize_error(error: Exception) -> str:
    message = str(error).strip() or error.__class__.__name__
    return message[:500]


def _detections_from_result(
    raw_result: Any,
    width: int,
    height: int,
    min_confidence: float,
):
    detections = []
    for index, (box, text, confidence) in enumerate(_iter_lines(raw_result) or [], start=1):
        normalized_text = " ".join(text.split())
        if not normalized_text or confidence < min_confidence:
            continue
        bounds = _bounds_from_box(box, width, height)
        if bounds is None:
            continue
        detections.append(
            {
                "id": f"ocr-{index}",
                "text": normalized_text,
                "label": normalized_text,
                "confidence": max(0.0, min(1.0, confidence)),
                "bounds": bounds,
                "center": {
                    "x": bounds["left"] + bounds["width"] / 2,
                    "y": bounds["top"] + bounds["height"] / 2,
                },
                "source": "ocr",
            }
        )
    return detections


def _score_detections(detections: list[dict[str, Any]]) -> tuple[int, float]:
    if not detections:
        return (0, 0.0)
    confidence = sum(float(item.get("confidence") or 0) for item in detections)
    return (len(detections), confidence / len(detections))


@app.get("/health")
def health():
    runtime = _ocr_runtime_probe()
    ready = bool(runtime["ready"])
    payload = {
        "ok": ready,
        "status": "healthy" if ready else "unhealthy",
        "service": "rebroid-ocr-sidecar",
        "engine": "paddleocr",
        "languages": DEFAULT_LANGUAGES,
        "preprocessingModes": _normalize_preprocessing_modes(None),
        "ready": ready,
        "message": runtime["message"],
    }
    if ready:
        return payload
    return JSONResponse(status_code=503, content=payload)


@app.post("/ocr/screenshot")
def ocr_screenshot(payload: OcrRequest):
    started = time.perf_counter()
    languages = payload.languages or DEFAULT_LANGUAGES
    language = languages[0] if languages else "en"
    image = _resize_image(_decode_image(payload), payload.maxImageDimension)
    width, height = image.size
    attempts = []
    best = None
    try:
        engine = _ocr_engine(language)
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "message": "OCR runtime is not ready.",
                "error": _sanitize_error(exc),
            },
        ) from exc

    for mode in _normalize_preprocessing_modes(payload.preprocessingModes):
        mode_started = time.perf_counter()
        try:
            processed = _preprocess_image(image, mode)
            result = engine.ocr(np.array(processed), cls=True)
            detections = _detections_from_result(
                result,
                width,
                height,
                payload.minConfidence,
            )
            score = _score_detections(detections)
            attempt = {
                "mode": mode,
                "status": "available",
                "textBoxCount": len(detections),
                "averageConfidence": score[1],
                "elapsedMs": round((time.perf_counter() - mode_started) * 1000),
            }
            attempts.append(attempt)
            candidate = {"mode": mode, "detections": detections, "score": score}
            if best is None or candidate["score"] > best["score"]:
                best = candidate
        except Exception as exc:
            attempts.append(
                {
                    "mode": mode,
                    "status": "failed",
                    "error": _sanitize_error(exc),
                    "elapsedMs": round((time.perf_counter() - mode_started) * 1000),
                }
            )

    if best is None:
        raise HTTPException(
            status_code=500,
            detail={
                "message": "OCR execution failed for all preprocessing modes.",
                "attempts": attempts,
            },
        )

    return {
        "status": "available",
        "engine": "paddleocr",
        "model": "PP-OCR",
        "languages": languages,
        "preprocessingMode": best["mode"],
        "preprocessingAttempts": attempts,
        "elapsedMs": round((time.perf_counter() - started) * 1000),
        "image": {"width": width, "height": height},
        "detections": best["detections"],
    }
