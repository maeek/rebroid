from __future__ import annotations

import time
from functools import cached_property
from typing import Any, Callable, TypedDict

from PIL import Image, ImageEnhance, ImageOps

CASCADE_MODES = ("raw", "grayscale", "contrast", "threshold")


class Bounds(TypedDict):
    left: float
    top: float
    width: float
    height: float


class TextDetection(TypedDict):
    text: str
    confidence: float
    bounds: Bounds


def resize_image(image: Image.Image, max_dimension: int) -> Image.Image:
    width, height = image.size
    largest = max(width, height)
    if largest <= max_dimension:
        return image
    scale = max_dimension / float(largest)
    return image.resize(
        (max(1, int(width * scale)), max(1, int(height * scale))),
        Image.Resampling.LANCZOS,
    )


class _CascadeImages:
    def __init__(self, image: Image.Image):
        self.image = image

    @cached_property
    def grayscale(self) -> Image.Image:
        return ImageOps.grayscale(self.image)

    @cached_property
    def contrasted(self) -> Image.Image:
        return ImageEnhance.Contrast(ImageOps.autocontrast(self.grayscale)).enhance(1.8)

    def prepare(self, mode: str) -> Image.Image:
        if mode == "raw":
            return self.image
        if mode == "grayscale":
            return self.grayscale.convert("RGB")
        if mode == "contrast":
            return self.contrasted.convert("RGB")
        return self.contrasted.point(lambda pixel: 255 if pixel >= 150 else 0).convert("RGB")


def select_detections(candidates: list[TextDetection], min_confidence: float):
    best: dict[tuple[str, float, float], dict[str, Any]] = {}
    eligible = (item for item in candidates if item["confidence"] >= min_confidence)
    for sequence, detection in enumerate(eligible, start=1):
        bounds = detection["bounds"]
        key = (detection["text"].lower(), round(bounds["left"], 2), round(bounds["top"], 2))
        previous = best.get(key)
        if previous is not None and previous["confidence"] >= detection["confidence"]:
            continue
        best[key] = {
            **detection,
            "id": f"ocr-{sequence}",
            "label": detection["text"],
            "center": {"x": bounds["left"] + bounds["width"] / 2, "y": bounds["top"] + bounds["height"] / 2},
            "source": "ocr",
        }
    return list(best.values())


def quality(detections: list[dict[str, Any]]) -> tuple[float, float, int]:
    if not detections:
        return (0.0, 0.0, 0)
    average = sum(item["confidence"] for item in detections) / len(detections)
    unique = len({item["text"].lower() for item in detections})
    coverage = min(1.0, sum(item["bounds"]["width"] * item["bounds"]["height"] for item in detections) * 8)
    return (average * 0.6 + unique / len(detections) * 0.25 + coverage * 0.15, average, unique)


class RecognitionStopped(Exception):
    pass


def run_cascade(
    image: Image.Image,
    infer: Callable[[Image.Image], list[TextDetection]],
    min_confidence: float,
    check_active: Callable[[], None] = lambda: None,
):
    target = max(0.65, min_confidence)
    attempts: list[dict[str, Any]] = []
    best: dict[str, Any] | None = None
    images = _CascadeImages(image)
    for mode in CASCADE_MODES:
        check_active()
        started = time.perf_counter()
        try:
            prepared = images.prepare(mode)
            check_active()
            candidates = infer(prepared)
            check_active()
            detections = select_detections(candidates, min_confidence)
            score = quality(detections)
            attempts.append({
                "mode": mode,
                "status": "available",
                "textBoxCount": len(detections),
                "averageConfidence": score[1],
                "qualityScore": score[0],
                "elapsedMs": round((time.perf_counter() - started) * 1000),
            })
            candidate = {"mode": mode, "detections": detections, "score": score}
            if best is None or candidate["score"] > best["score"]:
                best = candidate
            if score[0] >= target:
                break
        except RecognitionStopped:
            raise
        except Exception:
            attempts.append({"mode": mode, "status": "failed", "error": "OCR pass failed.", "elapsedMs": round((time.perf_counter() - started) * 1000)})
    check_active()
    return best, attempts
