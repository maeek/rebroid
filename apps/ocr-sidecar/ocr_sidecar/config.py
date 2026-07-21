from __future__ import annotations

import os
from dataclasses import dataclass


def _integer(name: str, default: int, minimum: int, maximum: int) -> int:
    value = int(os.getenv(name, str(default)))
    if value < minimum or value > maximum:
        raise ValueError(f"{name} must be between {minimum} and {maximum}.")
    return value


def _number(name: str, default: float, minimum: float, maximum: float) -> float:
    value = float(os.getenv(name, str(default)))
    if value < minimum or value > maximum:
        raise ValueError(f"{name} must be between {minimum} and {maximum}.")
    return value


@dataclass(frozen=True)
class Settings:
    language: str
    min_confidence: float
    max_image_dimension: int
    max_encoded_bytes: int
    max_decoded_bytes: int
    max_pixels: int
    inference_concurrency: int

    @classmethod
    def from_environment(cls) -> "Settings":
        language = os.getenv("OCR_LANGUAGE", "en").strip()
        if not language or len(language) > 16 or not language.replace("-", "").isalnum():
            raise ValueError("OCR_LANGUAGE is invalid.")
        return cls(
            language=language,
            min_confidence=_number("OCR_MIN_CONFIDENCE", 0.4, 0, 1),
            max_image_dimension=_integer("OCR_MAX_IMAGE_DIMENSION", 1600, 320, 4096),
            max_encoded_bytes=_integer("OCR_MAX_ENCODED_BYTES", 32 * 1024 * 1024, 1024, 64 * 1024 * 1024),
            max_decoded_bytes=_integer("OCR_MAX_DECODED_BYTES", 24 * 1024 * 1024, 1024, 48 * 1024 * 1024),
            max_pixels=_integer("OCR_MAX_PIXELS", 16_000_000, 1024, 64_000_000),
            inference_concurrency=_integer("OCR_INFERENCE_CONCURRENCY", 1, 1, 8),
        )
