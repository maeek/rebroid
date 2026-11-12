from __future__ import annotations

import asyncio
import time
from threading import BoundedSemaphore, Event

from .config import Settings
from .image_input import OcrRequest, decode_image
from .preprocessing import RecognitionStopped, resize_image, run_cascade
from .runtime import OcrRuntime


class RecognitionRejected(Exception):
    def __init__(self, code: str, message: str, attempts: list | None = None):
        super().__init__(message)
        self.code = code
        self.attempts = attempts


class Recognition:
    def __init__(self, config: Settings, runtime: OcrRuntime):
        self.config = config
        self.runtime = runtime
        self._capacity = BoundedSemaphore(config.inference_concurrency)

    async def recognize(self, payload: OcrRequest, stopped: Event):
        deadline = time.monotonic() + payload.timeoutMs / 1000 if payload.timeoutMs is not None else None

        def check_active():
            if stopped.is_set() or (deadline is not None and time.monotonic() >= deadline):
                raise RecognitionStopped()

        check_active()
        language = payload.language or self.config.language
        if language != self.config.language:
            raise RecognitionRejected("unsupported_language", "Requested OCR language is not deployed.")
        if not self.runtime.readiness.ready:
            raise RecognitionRejected("ocr_not_ready", "OCR model is not ready.")
        if not self._capacity.acquire(blocking=False):
            raise RecognitionRejected("ocr_busy", "OCR inference capacity is busy.")

        try:
            worker = asyncio.get_running_loop().run_in_executor(None, self._recognize, payload, check_active)
        except BaseException:
            self._capacity.release()
            raise

        def release(done: asyncio.Future):
            self._capacity.release()
            if not done.cancelled():
                done.exception()

        # Cancellation of the HTTP task cannot release capacity while native inference is active.
        worker.add_done_callback(release)
        return await asyncio.shield(worker)

    def _recognize(self, payload: OcrRequest, check_active):
        started = time.perf_counter()
        check_active()
        image = decode_image(payload, self.config)
        max_dimension = min(payload.maxImageDimension or self.config.max_image_dimension, self.config.max_image_dimension)
        min_confidence = payload.minConfidence if payload.minConfidence is not None else self.config.min_confidence
        check_active()
        image = resize_image(image, max_dimension)
        best, attempts = run_cascade(image, self.runtime.recognize, min_confidence, check_active)
        if best is None:
            raise RecognitionRejected("ocr_failed", "OCR execution failed.", attempts)
        return {
            "status": "available",
            "engine": "paddleocr",
            "model": "PP-OCR",
            "language": self.config.language,
            "searchComplete": all(attempt["status"] == "available" for attempt in attempts),
            "preprocessingMode": best["mode"],
            "preprocessingAttempts": attempts,
            "elapsedMs": round((time.perf_counter() - started) * 1000),
            "image": {"width": image.width, "height": image.height},
            "detections": best["detections"],
        }
