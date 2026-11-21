from __future__ import annotations

import os
from dataclasses import dataclass
from typing import TypeVar


_Number = TypeVar("_Number", int, float)


def _bounded_number(name: str, default: _Number, minimum: float, maximum: float) -> _Number:
    value = type(default)(os.getenv(name, str(default)))
    if not minimum <= value <= maximum:
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
    request_concurrency: int = 2
    request_read_timeout_ms: int = 5000

    @classmethod
    def from_environment(cls) -> "Settings":
        language = os.getenv("OCR_LANGUAGE", "en").strip()
        if not language or len(language) > 16 or not language.replace("-", "").isalnum():
            raise ValueError("OCR_LANGUAGE is invalid.")
        return cls(
            language=language,
            min_confidence=_bounded_number("OCR_MIN_CONFIDENCE", 0.4, 0, 1),
            max_image_dimension=_bounded_number("OCR_MAX_IMAGE_DIMENSION", 1600, 320, 4096),
            max_encoded_bytes=_bounded_number("OCR_MAX_ENCODED_BYTES", 32 * 1024 * 1024, 1024, 64 * 1024 * 1024),
            max_decoded_bytes=_bounded_number("OCR_MAX_DECODED_BYTES", 24 * 1024 * 1024, 1024, 48 * 1024 * 1024),
            max_pixels=_bounded_number("OCR_MAX_PIXELS", 16_000_000, 1024, 64_000_000),
            inference_concurrency=_bounded_number("OCR_INFERENCE_CONCURRENCY", 1, 1, 8),
            request_concurrency=_bounded_number("OCR_REQUEST_CONCURRENCY", 2, 1, 8),
            request_read_timeout_ms=_bounded_number("OCR_REQUEST_READ_TIMEOUT_MS", 5000, 100, 60_000),
        )
