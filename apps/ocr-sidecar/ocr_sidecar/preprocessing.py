from __future__ import annotations

import time
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


def preprocess(image: Image.Image, mode: str) -> Image.Image:
    if mode == "raw":
        return image
    grayscale = ImageOps.grayscale(image)
    if mode == "grayscale":
        return grayscale.convert("RGB")
    contrasted = ImageEnhance.Contrast(ImageOps.autocontrast(grayscale)).enhance(1.8)
    if mode == "contrast":
        return contrasted.convert("RGB")
    return contrasted.point(lambda pixel: 255 if pixel >= 150 else 0).convert("RGB")


def select_detections(candidates: list[TextDetection], min_confidence: float):
    detections: list[dict[str, Any]] = []
    for detection in candidates:
        if detection["confidence"] < min_confidence:
            continue
        bounds = detection["bounds"]
        detections.append({
            **detection,
            "id": f"ocr-{len(detections) + 1}",
            "label": detection["text"],
            "center": {"x": bounds["left"] + bounds["width"] / 2, "y": bounds["top"] + bounds["height"] / 2},
            "source": "ocr",
        })
    return deduplicate(detections)


def deduplicate(detections: list[dict[str, Any]]):
    best: dict[tuple[str, float, float], dict[str, Any]] = {}
    for detection in detections:
        bounds = detection["bounds"]
        key = (detection["text"].lower(), round(bounds["left"], 2), round(bounds["top"], 2))
        if key not in best or detection["confidence"] > best[key]["confidence"]:
            best[key] = detection
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
    for mode in CASCADE_MODES:
        check_active()
        started = time.perf_counter()
        try:
            prepared = preprocess(image, mode)
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
