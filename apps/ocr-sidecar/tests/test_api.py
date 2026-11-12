import asyncio
import base64
import io
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from threading import Event
from types import SimpleNamespace

from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from PIL import Image
import pytest

from ocr_sidecar.api import create_app
from ocr_sidecar import recognition
from ocr_sidecar.config import Settings
from ocr_sidecar.image_input import OcrRequest
from ocr_sidecar.runtime import RuntimeReadiness


class FakeRuntime:
    def __init__(self, *, ready=True):
        self.readiness = (
            RuntimeReadiness("ready", "OCR model is ready.")
            if ready
            else RuntimeReadiness("failed", "OCR model initialization failed.", "ocr_model_initialization_failed")
        )

    async def warmup(self):
        return None

    def recognize(self, _image):
        return [{"text": "Settings", "confidence": 0.99,
                 "bounds": {"left": 0, "top": 0, "width": 0.8, "height": 0.4}}]


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


def image_data_url(image_format="PNG"):
    buffer = io.BytesIO()
    Image.new("RGB", (100, 50), "white").save(buffer, format=image_format)
    return f"data:image/{image_format.lower()};base64," + base64.b64encode(buffer.getvalue()).decode()


def test_readiness_is_separate_from_liveness():
    with TestClient(create_app(settings(), FakeRuntime(ready=False))) as client:
        assert client.get("/health/live").status_code == 200
        response = client.get("/health")
        assert response.status_code == 503
        assert response.json()["ready"] is False
        assert response.json()["warmupState"] == "failed"
        assert response.json()["failureCode"] == "ocr_model_initialization_failed"


def test_language_errors_use_stable_codes():
    with TestClient(create_app(settings(), FakeRuntime())) as client:
        unsupported = client.post(
            "/ocr/screenshot",
            json={"dataUrl": image_data_url(), "language": "fr"},
        )
        assert unsupported.status_code == 422
        assert unsupported.json()["detail"]["code"] == "unsupported_language"


@pytest.mark.parametrize("image_format", ["PNG", "JPEG", "WEBP"])
def test_valid_request_reports_selected_pass_without_internal_errors(image_format):
    with TestClient(create_app(settings(), FakeRuntime())) as client:
        response = client.post("/ocr/screenshot", json={"dataUrl": image_data_url(image_format)})
        assert response.status_code == 200
        payload = response.json()
        assert payload["language"] == "en"
        assert payload["searchComplete"] is True
        assert payload["preprocessingMode"] == "raw"
        assert payload["detections"][0]["text"] == "Settings"


def test_partial_cascade_reports_incomplete_search():
    class FailingFallbacks(FakeRuntime):
        calls = 0

        def recognize(self, _image):
            self.calls += 1
            if self.calls == 1:
                return []
            raise RuntimeError("OCR pass failed")

    with TestClient(create_app(settings(), FailingFallbacks())) as client:
        response = client.post("/ocr/screenshot", json={"dataUrl": image_data_url()})
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "available"
        assert payload["detections"] == []
        assert payload["searchComplete"] is False


def test_busy_request_does_not_wait_for_an_executor_worker():
    entered = Event()
    resume = Event()

    class PausedRuntime(FakeRuntime):
        def recognize(self, image):
            entered.set()
            assert resume.wait(5)
            return super().recognize(image)

    async def exercise():
        executor = ThreadPoolExecutor(1)
        asyncio.get_running_loop().set_default_executor(executor)
        app = create_app(settings(), PausedRuntime())
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            payload = {"dataUrl": image_data_url()}
            first = asyncio.create_task(client.post("/ocr/screenshot", json=payload))
            try:
                async with asyncio.timeout(2):
                    while not entered.is_set():
                        await asyncio.sleep(0)
                    busy = await client.post("/ocr/screenshot", json=payload)
                assert busy.status_code == 429
                assert busy.json()["detail"]["code"] == "ocr_busy"
            finally:
                resume.set()
                await first

    asyncio.run(exercise())


def test_slow_body_holds_one_ingress_slot_and_expires():
    async def exercise():
        started = asyncio.Event()
        resume = asyncio.Event()

        async def slow_body():
            yield b'{"dataUrl":"'
            started.set()
            await resume.wait()

        app = create_app(replace(settings(), request_concurrency=1, request_read_timeout_ms=100), FakeRuntime())
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            payload = {"dataUrl": image_data_url()}
            slow = asyncio.create_task(client.post("/ocr/screenshot", content=slow_body()))
            try:
                await asyncio.wait_for(started.wait(), 2)
                busy = await client.post("/ocr/screenshot", json=payload)
                assert busy.status_code == 429
                assert busy.json()["detail"]["code"] == "ocr_busy"
                expired = await asyncio.wait_for(slow, 2)
                assert expired.status_code == 504
                assert expired.json()["detail"]["code"] == "ocr_deadline_exceeded"
                assert (await client.post("/ocr/screenshot", json=payload)).status_code == 200
            finally:
                resume.set()
                await asyncio.gather(slow, return_exceptions=True)

    asyncio.run(exercise())


def test_canceled_request_keeps_its_ingress_slot_until_json_validation_finishes(monkeypatch):
    validating = Event()
    resume = Event()
    validate = OcrRequest.model_validate_json

    def paused_validation(body):
        validating.set()
        assert resume.wait(5)
        return validate(body)

    monkeypatch.setattr(OcrRequest, "model_validate_json", paused_validation)

    async def exercise():
        app = create_app(replace(settings(), request_concurrency=1), FakeRuntime())
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            payload = {"dataUrl": image_data_url()}
            first = asyncio.create_task(client.post("/ocr/screenshot", json=payload))
            try:
                async with asyncio.timeout(2):
                    while not validating.is_set():
                        await asyncio.sleep(0)
                    first.cancel()
                    with pytest.raises(asyncio.CancelledError):
                        await first
                    assert (await client.get("/health/live")).status_code == 200
                    assert (await client.post("/ocr/screenshot", json=payload)).status_code == 429
                    resume.set()
                    response = await client.post("/ocr/screenshot", json=payload)
                    while response.status_code == 429:
                        await asyncio.sleep(0.01)
                        response = await client.post("/ocr/screenshot", json=payload)
                    assert response.status_code == 200
            finally:
                resume.set()
                await asyncio.gather(first, return_exceptions=True)

    asyncio.run(exercise())


def test_disconnected_request_keeps_its_slot_until_the_native_pass_returns():
    entered = Event()
    resume = Event()

    class PausedRuntime(FakeRuntime):
        calls = 0

        def recognize(self, _image):
            self.calls += 1
            entered.set()
            assert resume.wait(5)
            return []

    async def exercise():
        drop = asyncio.Event()
        disconnected = asyncio.Event()
        runtime = PausedRuntime()
        app = create_app(settings(), runtime)

        async def with_disconnect(scope, receive, send):
            body_complete = False

            async def receive_or_disconnect():
                nonlocal body_complete
                if body_complete and scope["path"] == "/ocr/screenshot" and (b"x-drop", b"yes") in scope["headers"]:
                    await drop.wait()
                    disconnected.set()
                    return {"type": "http.disconnect"}
                message = await receive()
                body_complete = not message.get("more_body", False)
                return message

            await app(scope, receive_or_disconnect, send)

        async with AsyncClient(transport=ASGITransport(app=with_disconnect), base_url="http://test") as client:
            payload = {"dataUrl": image_data_url()}
            first = asyncio.create_task(client.post("/ocr/screenshot", json=payload, headers={"x-drop": "yes"}))
            try:
                async with asyncio.timeout(2):
                    while not entered.is_set():
                        await asyncio.sleep(0)
                    drop.set()
                    await disconnected.wait()
                    assert (await client.post("/ocr/screenshot", json=payload)).status_code == 429
            finally:
                resume.set()
                response = await first
            assert response.status_code == 504
            assert runtime.calls == 1

    asyncio.run(exercise())


def test_rejects_oversized_request_body_and_mislabeled_image_before_inference():
    class UnexpectedInference(FakeRuntime):
        def recognize(self, _image):
            raise AssertionError("Invalid input reached inference")

    with TestClient(create_app(settings(), UnexpectedInference())) as client:
        payload = {"dataUrl": image_data_url(), "ignored": "x" * 110_000}
        assert client.post("/ocr/screenshot", json=payload).status_code == 413
        assert client.post("/ocr/screenshot", content=iter([
            b'{"ignored":"', b"x" * 55_000, b"x" * 55_000, b'"}',
        ])).status_code == 413
        response = client.post("/ocr/screenshot", json={
            "dataUrl": image_data_url().replace("image/png", "image/jpeg"),
        })
        assert response.status_code == 400
        assert response.json()["detail"]["code"] == "invalid_image"


def test_expired_request_skips_later_passes_and_holds_capacity_until_inference_returns(monkeypatch):
    now = [0.0]
    monkeypatch.setattr(recognition, "time", SimpleNamespace(monotonic=lambda: now[0], perf_counter=recognition.time.perf_counter))
    entered = Event()
    resume = Event()
    class PausedRuntime(FakeRuntime):
        calls = 0

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
        assert client.post("/ocr/screenshot", json=payload).status_code == 200
