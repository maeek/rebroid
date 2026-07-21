from __future__ import annotations

import base64
import binascii
import io
import time
from typing import Any, Callable

from PIL import Image, ImageEnhance, ImageOps

SUPPORTED_MEDIA_TYPES = {"image/png", "image/jpeg", "image/webp"}
CASCADE_MODES = ("raw", "grayscale", "contrast", "threshold")


class ImagePayloadError(ValueError):
    pass


def decode_image(
    *,
    data_url: str | None,
    image_base64: str | None,
    media_type: str | None,
    max_encoded_bytes: int,
    max_decoded_bytes: int,
    max_pixels: int,
) -> Image.Image:
    encoded = image_base64
    declared_type = media_type
    if data_url:
        if "," not in data_url or not data_url.startswith("data:"):
            raise ImagePayloadError("Invalid data URL.")
        metadata, encoded = data_url.split(",", 1)
        declared_type = metadata[5:].split(";", 1)[0].lower()
        if ";base64" not in metadata.lower():
            raise ImagePayloadError("Image data URL must use base64 encoding.")
    if not encoded:
        raise ImagePayloadError("Missing image payload.")
    if declared_type not in SUPPORTED_MEDIA_TYPES:
        raise ImagePayloadError("Unsupported image media type.")
    if len(encoded.encode("ascii", errors="ignore")) > max_encoded_bytes:
        raise ImagePayloadError("Encoded image payload is too large.")
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ImagePayloadError("Invalid base64 image.") from exc
    if len(raw) > max_decoded_bytes:
        raise ImagePayloadError("Decoded image payload is too large.")
    try:
        with Image.open(io.BytesIO(raw)) as source:
            width, height = source.size
            if width <= 0 or height <= 0 or width * height > max_pixels:
                raise ImagePayloadError("Image dimensions exceed the pixel limit.")
            source.verify()
        with Image.open(io.BytesIO(raw)) as source:
            return source.convert("RGB")
    except ImagePayloadError:
        raise
    except Exception as exc:
        raise ImagePayloadError("Unsupported or malformed image payload.") from exc


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


def detections_from_result(raw_result: Any, width: int, height: int, min_confidence: float):
    batches = raw_result[0] if isinstance(raw_result, list) and len(raw_result) == 1 else raw_result
    detections: list[dict[str, Any]] = []
    for item in batches or []:
        if not isinstance(item, (list, tuple)) or len(item) < 2:
            continue
        box, text_conf = item[0], item[1]
        if not isinstance(text_conf, (list, tuple)) or len(text_conf) < 2:
            continue
        text = " ".join(str(text_conf[0]).split())
        confidence = float(text_conf[1])
        points = [point for point in box if isinstance(point, (list, tuple)) and len(point) >= 2]
        if not text or confidence < min_confidence or not points:
            continue
        xs, ys = [float(point[0]) for point in points], [float(point[1]) for point in points]
        left, top = max(0.0, min(xs) / width), max(0.0, min(ys) / height)
        right, bottom = min(1.0, max(xs) / width), min(1.0, max(ys) / height)
        bounds = {"left": left, "top": top, "width": max(0.0, right - left), "height": max(0.0, bottom - top)}
        detections.append({
            "id": f"ocr-{len(detections) + 1}",
            "text": text,
            "label": text,
            "confidence": max(0.0, min(1.0, confidence)),
            "bounds": bounds,
            "center": {"x": left + bounds["width"] / 2, "y": top + bounds["height"] / 2},
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


def run_cascade(image: Image.Image, infer: Callable[[Image.Image], Any], min_confidence: float):
    width, height = image.size
    target = max(0.65, min_confidence)
    attempts: list[dict[str, Any]] = []
    best: dict[str, Any] | None = None
    for mode in CASCADE_MODES:
        started = time.perf_counter()
        try:
            detections = detections_from_result(infer(preprocess(image, mode)), width, height, min_confidence)
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
        except Exception:
            attempts.append({"mode": mode, "status": "failed", "error": "OCR pass failed.", "elapsedMs": round((time.perf_counter() - started) * 1000)})
    return best, attempts
