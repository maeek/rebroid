import asyncio
import sys
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from types import SimpleNamespace

from PIL import Image
import pytest

from ocr_sidecar import runtime as runtime_module
from ocr_sidecar.runtime import OcrRuntime


def test_parallel_inference_uses_distinct_warmed_predictors(monkeypatch):
    predictions = Barrier(2)
    instances = []

    class Paddle:
        def __init__(self, **_options):
            self.warmed = False
            instances.append(self)

        def ocr(self, _image, *, cls):
            if not self.warmed:
                self.warmed = True
                return []
            predictions.wait(timeout=2)
            return [[[[[0, 0], [80, 0], [80, 20], [0, 20]], [str(instances.index(self)), 0.99]]]]

    monkeypatch.setitem(sys.modules, "paddleocr", SimpleNamespace(PaddleOCR=Paddle))
    runtime = OcrRuntime("en", 2)
    asyncio.run(runtime.warmup())
    assert runtime.readiness.ready
    with ThreadPoolExecutor(2) as executor:
        image = Image.new("RGB", (100, 50))
        results = list(executor.map(runtime.recognize, (image, image)))
    assert {result[0]["text"] for result in results} == {"0", "1"}
    assert results[0][0]["bounds"] == {"left": 0, "top": 0, "width": 0.8, "height": 0.4}


@pytest.mark.parametrize("recover", [True, False])
@pytest.mark.parametrize("message, status", [
    ("Downloading from https://model.invalid/private failed with code 503!", "503"),
    ("Download from https://model.invalid/private failed. Retry limit reached", "None"),
])
def test_transient_model_download_failure_retries_with_a_fixed_limit(monkeypatch, caplog, recover, message, status):
    class Paddle:
        attempts = 0

        def __init__(self, **_options):
            Paddle.attempts += 1
            if not recover or Paddle.attempts == 1:
                raise RuntimeError(message)

        def ocr(self, _image, *, cls):
            return []

    monkeypatch.setitem(sys.modules, "paddleocr", SimpleNamespace(PaddleOCR=Paddle))
    monkeypatch.setattr(runtime_module, "_WARMUP_RETRY_DELAYS", (0, 0))
    runtime = OcrRuntime("en", 1)
    asyncio.run(runtime.warmup())
    assert Paddle.attempts == (2 if recover else 3)
    assert runtime.readiness.ready is recover
    assert runtime.readiness.state == ("ready" if recover else "failed")
    assert runtime.readiness.failure_code == (None if recover else "ocr_model_download_unavailable")
    assert "RuntimeError" in caplog.text
    assert f"http_status={status}" in caplog.text
    assert "model.invalid" not in caplog.text


@pytest.mark.parametrize("error, code", [
    (PermissionError("sensitive cache path"), "ocr_model_cache_inaccessible"),
    (RuntimeError("Downloading from https://model.invalid/private failed with code 404!"), "ocr_model_download_failed"),
])
def test_permanent_initialization_failure_is_reported_without_retry(monkeypatch, error, code):
    class Paddle:
        attempts = 0

        def __init__(self, **_options):
            Paddle.attempts += 1
            raise error

    monkeypatch.setitem(sys.modules, "paddleocr", SimpleNamespace(PaddleOCR=Paddle))
    runtime = OcrRuntime("en", 1)
    asyncio.run(runtime.warmup())
    assert Paddle.attempts == 1
    assert runtime.readiness.state == "failed"
    assert runtime.readiness.failure_code == code
    assert str(error) not in runtime.readiness.message


def test_shutdown_cancels_retry_backoff(monkeypatch):
    class Paddle:
        attempts = 0

        def __init__(self, **_options):
            Paddle.attempts += 1
            raise TimeoutError("download timed out")

    monkeypatch.setitem(sys.modules, "paddleocr", SimpleNamespace(PaddleOCR=Paddle))
    runtime = OcrRuntime("en", 1)

    async def exercise():
        warmup = asyncio.create_task(runtime.warmup())
        async with asyncio.timeout(2):
            while runtime.readiness.state == "initializing":
                await asyncio.sleep(0)
        assert runtime.readiness.state == "retrying"
        warmup.cancel()
        with pytest.raises(asyncio.CancelledError):
            await warmup

    asyncio.run(exercise())
    assert Paddle.attempts == 1
