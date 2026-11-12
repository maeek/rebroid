import base64
import io

import pytest
from PIL import Image

from ocr_sidecar.config import Settings
from ocr_sidecar.image_input import ImagePayloadError, OcrRequest, decode_image
from ocr_sidecar.preprocessing import deduplicate, run_cascade


def result(text: str, confidence: float):
    return [{"text": text, "confidence": confidence,
             "bounds": {"left": 0, "top": 0, "width": 0.8, "height": 0.4}}]


def image_data_url(width: int = 100, height: int = 50) -> str:
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), "white").save(buffer, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode()


def test_cascade_stops_after_raw_quality_reaches_target():
    calls = []

    def infer(_image):
        calls.append("infer")
        return result("Settings", 0.99)

    best, attempts = run_cascade(Image.new("RGB", (100, 50)), infer, 0.4)
    assert best["mode"] == "raw"
    assert len(calls) == 1
    assert [attempt["mode"] for attempt in attempts] == ["raw"]


def test_cascade_uses_fallbacks_and_returns_best_attempt():
    results = iter([result("weak", 0.2), result("best", 0.9)])
    best, attempts = run_cascade(Image.new("RGB", (100, 50)), lambda _image: next(results), 0.4)
    assert best["mode"] == "grayscale"
    assert [attempt["mode"] for attempt in attempts] == ["raw", "grayscale"]


def test_deduplication_keeps_highest_confidence_detection():
    detections = [
        {"text": "OK", "confidence": 0.5, "bounds": {"left": 0.1, "top": 0.2}},
        {"text": "ok", "confidence": 0.9, "bounds": {"left": 0.1, "top": 0.2}},
    ]
    assert deduplicate(detections) == [detections[1]]


def test_decode_rejects_media_type_malformed_data_and_pixel_limit():
    config = Settings("en", 0.4, 1600, 100_000, 100_000, 100, 1)
    with pytest.raises(ImagePayloadError, match="media type"):
        decode_image(OcrRequest(dataUrl="data:text/plain;base64,SGVsbG8="), config)
    with pytest.raises(ImagePayloadError, match="pixel limit"):
        decode_image(OcrRequest(dataUrl=image_data_url()), config)
