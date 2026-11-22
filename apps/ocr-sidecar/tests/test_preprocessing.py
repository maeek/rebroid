import base64
import io

import pytest
from PIL import Image, ImageOps

from ocr_sidecar.config import Settings
from ocr_sidecar.image_input import ImagePayloadError, OcrRequest, decode_image
from ocr_sidecar.preprocessing import run_cascade, select_detections


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


def test_cascade_shares_fallback_transforms_after_an_inference_failure(monkeypatch):
    gray_calls, contrast_calls = [], []
    grayscale, autocontrast = ImageOps.grayscale, ImageOps.autocontrast

    def count_grayscale(image):
        gray_calls.append(image.size)
        return grayscale(image)

    def count_contrast(image):
        contrast_calls.append(image.size)
        return autocontrast(image)

    monkeypatch.setattr(ImageOps, "grayscale", count_grayscale)
    monkeypatch.setattr(ImageOps, "autocontrast", count_contrast)
    modes = []

    def infer(image):
        modes.append(image.mode)
        if len(modes) == 2:
            raise ValueError("failed grayscale inference")
        return []

    _, attempts = run_cascade(Image.new("RGB", (64, 32)), infer, 0.8)
    assert modes == ["RGB"] * 4
    assert [item["status"] for item in attempts] == ["available", "failed", "available", "available"]
    assert gray_calls == contrast_calls == [(64, 32)]


def test_selection_preserves_candidate_ids_and_first_seen_order_when_deduplicating():
    candidates = [
        *result("discarded", 0.1), *result("OK", 0.5), *result("Next", 0.8),
        *result("ok", 0.9), *result("Ok", 0.9),
    ]
    kept = select_detections(candidates, 0.4)
    assert [(item["id"], item["text"]) for item in kept] == [("ocr-3", "ok"), ("ocr-2", "Next")]
    assert kept[0]["center"] == {"x": 0.4, "y": 0.2}


def test_decode_rejects_media_type_malformed_data_and_pixel_limit():
    config = Settings("en", 0.4, 1600, 100_000, 100_000, 100, 1)
    with pytest.raises(ImagePayloadError, match="media type"):
        decode_image(OcrRequest(dataUrl="data:text/plain;base64,SGVsbG8="), config)
    with pytest.raises(ImagePayloadError, match="pixel limit"):
        decode_image(OcrRequest(dataUrl=image_data_url()), config)


def test_data_url_checks_the_encoded_length_and_accepts_a_complete_base64_parameter():
    encoded = image_data_url(8, 8).split(",", 1)[1]
    config = Settings("en", 0.4, 1600, len(encoded), 1000, 100, 1)
    data_url = "data:IMAGE/PNG;charset=utf-8;BASE64;extra," + encoded
    assert decode_image(OcrRequest(dataUrl=data_url), config).size == (8, 8)
    with pytest.raises(ImagePayloadError, match="payload is too large"):
        decode_image(OcrRequest(dataUrl=data_url + "A"), config)
    with pytest.raises(ImagePayloadError, match="must use base64"):
        decode_image(OcrRequest(dataUrl=data_url.replace(";BASE64;", ";BASE64x;")), config)
