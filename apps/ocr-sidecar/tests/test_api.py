import base64
import io
from concurrent.futures import ThreadPoolExecutor
from threading import BoundedSemaphore, Event
from types import SimpleNamespace

from fastapi.testclient import TestClient
from PIL import Image

from ocr_sidecar.api import create_app
from ocr_sidecar import api
from ocr_sidecar.config import Settings


class FakeRuntime:
    def __init__(self, *, ready=True, available=True):
        self.ready = ready
        self.message = "OCR model is ready." if ready else "OCR model initialization failed."
        self.available = available

    def initialize(self):
        return None

    def try_acquire(self):
        return self.available

    def release(self):
        return None

    def recognize(self, _image):
        return [[[[[0, 0], [80, 0], [80, 20], [0, 20]], ["Settings", 0.99]]]]


def settings():
    return Settings(
        language="en",
        min_confidence=0.4,
        max_image_dimension=1600,
        max_encoded_bytes=100_000,
        max_decoded_bytes=100_000,
        max_pixels=100_000,
        inference_concurrency=1,
    )


def image_data_url():
    buffer = io.BytesIO()
    Image.new("RGB", (100, 50), "white").save(buffer, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode()


def test_readiness_is_separate_from_liveness():
    with TestClient(create_app(settings(), FakeRuntime(ready=False))) as client:
        assert client.get("/health/live").status_code == 200
        response = client.get("/health")
        assert response.status_code == 503
        assert response.json()["ready"] is False


def test_busy_and_language_errors_use_stable_codes():
    with TestClient(create_app(settings(), FakeRuntime(available=False))) as client:
        busy = client.post("/ocr/screenshot", json={"dataUrl": image_data_url()})
        assert busy.status_code == 429
        assert busy.json()["detail"]["code"] == "ocr_busy"

    with TestClient(create_app(settings(), FakeRuntime())) as client:
        unsupported = client.post(
            "/ocr/screenshot",
            json={"dataUrl": image_data_url(), "language": "fr"},
        )
        assert unsupported.status_code == 422
        assert unsupported.json()["detail"]["code"] == "unsupported_language"


def test_valid_request_reports_selected_pass_without_internal_errors():
    with TestClient(create_app(settings(), FakeRuntime())) as client:
        response = client.post("/ocr/screenshot", json={"dataUrl": image_data_url()})
        assert response.status_code == 200
        payload = response.json()
        assert payload["language"] == "en"
        assert payload["preprocessingMode"] == "raw"
        assert payload["detections"][0]["text"] == "Settings"


def test_expired_request_skips_later_passes_and_holds_capacity_until_inference_returns(monkeypatch):
    now = [0.0]
    monkeypatch.setattr(api, "time", SimpleNamespace(monotonic=lambda: now[0], perf_counter=api.time.perf_counter))
    entered = Event()
    resume = Event()
    capacity = BoundedSemaphore(1)

    class PausedRuntime(FakeRuntime):
        calls = 0

        def try_acquire(self):
            return capacity.acquire(blocking=False)

        def release(self):
            capacity.release()

        def recognize(self, _image):
            self.calls += 1
            entered.set()
            assert resume.wait(5)
            return []

    runtime = PausedRuntime()
    with TestClient(create_app(settings(), runtime)) as client, ThreadPoolExecutor(1) as executor:
        payload = {"dataUrl": image_data_url()}
        in_flight = executor.submit(client.post, "/ocr/screenshot", json={**payload, "timeoutMs": 1000})
        try:
            assert entered.wait(5)
            now[0] = 2.0
            assert client.post("/ocr/screenshot", json=payload).status_code == 429
        finally:
            resume.set()
        response = in_flight.result(timeout=5)
        assert response.status_code == 504
        assert response.json()["detail"]["code"] == "ocr_deadline_exceeded"
        assert runtime.calls == 1
        assert runtime.try_acquire()
        runtime.release()
