import pytest

from ocr_sidecar.config import Settings


def test_confidence_threshold_rejects_nan(monkeypatch):
    monkeypatch.setenv("OCR_MIN_CONFIDENCE", "nan")
    with pytest.raises(ValueError, match="OCR_MIN_CONFIDENCE"):
        Settings.from_environment()


def test_concurrency_requires_an_integer_and_confidence_accepts_a_fraction(monkeypatch):
    monkeypatch.setenv("OCR_INFERENCE_CONCURRENCY", "1.5")
    with pytest.raises(ValueError):
        Settings.from_environment()
    monkeypatch.setenv("OCR_INFERENCE_CONCURRENCY", "2")
    monkeypatch.setenv("OCR_MIN_CONFIDENCE", "0.75")
    config = Settings.from_environment()
    assert config.inference_concurrency == 2
    assert config.min_confidence == 0.75
