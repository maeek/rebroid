from __future__ import annotations

import asyncio
import errno
import logging
import re
import socket
from dataclasses import dataclass
from math import isfinite
from pathlib import Path
from queue import Queue
from threading import Lock
from traceback import extract_tb
from typing import Any, Literal

import numpy as np
from PIL import Image

from .preprocessing import TextDetection

_LOGGER = logging.getLogger(__name__)
_WARMUP_RETRY_DELAYS = (1, 2)
_DOWNLOAD_STATUS = re.compile(r"Downloading from .+ failed with code (\d{3})!")


@dataclass(frozen=True)
class RuntimeReadiness:
    state: Literal["initializing", "retrying", "ready", "failed"]
    message: str
    failure_code: str | None = None

    @property
    def ready(self) -> bool:
        return self.state == "ready"


@dataclass(frozen=True)
class _WarmupFailure:
    code: str
    message: str
    retryable: bool = False
    http_status: int | None = None


def _warmup_failure(error: Exception) -> _WarmupFailure:
    if isinstance(error, ImportError):
        return _WarmupFailure("ocr_runtime_unavailable", "Paddle runtime could not be loaded.")
    if isinstance(error, PermissionError) or (isinstance(error, OSError) and error.errno == errno.ENOSPC):
        return _WarmupFailure("ocr_model_cache_inaccessible", "OCR model cache could not be accessed.")

    http_status = None
    download_exhausted = False
    if isinstance(error, RuntimeError):
        # PaddleOCR 2.9.1 reports model download failures as untyped RuntimeErrors.
        message = str(error)
        status_match = _DOWNLOAD_STATUS.fullmatch(message)
        if status_match:
            http_status = int(status_match[1])
        download_exhausted = message.startswith("Download from ") and message.endswith(" failed. Retry limit reached")

    if (
        isinstance(error, (ConnectionError, TimeoutError))
        or (isinstance(error, socket.gaierror) and error.errno == socket.EAI_AGAIN)
        or download_exhausted
        or (http_status is not None and (http_status in (408, 429) or 500 <= http_status < 600))
    ):
        return _WarmupFailure(
            "ocr_model_download_unavailable", "OCR model download is temporarily unavailable.", True, http_status,
        )
    if http_status is not None:
        return _WarmupFailure("ocr_model_download_failed", "OCR model download failed.", http_status=http_status)
    return _WarmupFailure("ocr_model_initialization_failed", "OCR model initialization failed.")


class OcrRuntime:
    def __init__(self, language: str, concurrency: int) -> None:
        self.language = language
        self._concurrency = concurrency
        self._lock = Lock()
        self._engines: Queue[Any] | None = None
        self._readiness = RuntimeReadiness("initializing", "OCR model is initializing.")

    @property
    def readiness(self) -> RuntimeReadiness:
        with self._lock:
            return self._readiness

    async def warmup(self) -> None:
        max_attempts = len(_WARMUP_RETRY_DELAYS) + 1
        for attempt in range(1, max_attempts + 1):
            try:
                engines = await asyncio.to_thread(self._initialize_engines)
            except Exception as error:
                failure = _warmup_failure(error)
                retry = failure.retryable and attempt < max_attempts
                frame = extract_tb(error.__traceback__, limit=-1)[0]
                _LOGGER.log(
                    logging.WARNING if retry else logging.ERROR,
                    "OCR warmup attempt %d/%d failed: %s (%s at %s:%d in %s, errno=%s, http_status=%s, retry=%s)",
                    attempt, max_attempts, failure.code, type(error).__name__, Path(frame.filename).name, frame.lineno, frame.name,
                    error.errno if isinstance(error, OSError) else None, failure.http_status, retry,
                )
                with self._lock:
                    self._readiness = RuntimeReadiness(
                        "retrying" if retry else "failed", failure.message, failure.code,
                    )
                if not retry:
                    return
                await asyncio.sleep(_WARMUP_RETRY_DELAYS[attempt - 1])
            else:
                with self._lock:
                    self._engines = engines
                    self._readiness = RuntimeReadiness("ready", "OCR model is ready.")
                return

    def _initialize_engines(self) -> Queue[Any]:
        from paddleocr import PaddleOCR

        engines: Queue[Any] = Queue(self._concurrency)
        sample = np.zeros((32, 128, 3), dtype=np.uint8)
        for _ in range(self._concurrency):
            try:
                engine = PaddleOCR(use_angle_cls=True, lang=self.language, show_log=False)
            except TypeError:
                engine = PaddleOCR(use_angle_cls=True, lang=self.language)
            engine.ocr(sample, cls=True)
            engines.put_nowait(engine)
        return engines

    def recognize(self, image: Image.Image) -> list[TextDetection]:
        with self._lock:
            engines = self._engines
        if engines is None:
            raise RuntimeError("OCR model is not ready.")
        engine = engines.get_nowait()
        try:
            raw_result = engine.ocr(np.array(image), cls=True)
            return decode_paddle_detections(raw_result, *image.size)
        finally:
            engines.put_nowait(engine)


def decode_paddle_detections(raw_result: Any, width: int, height: int) -> list[TextDetection]:
    batches = raw_result[0] if isinstance(raw_result, list) and len(raw_result) == 1 else raw_result
    detections: list[TextDetection] = []
    for item in batches or []:
        if not isinstance(item, (list, tuple)) or len(item) < 2:
            continue
        box, text_conf = item[:2]
        if not isinstance(text_conf, (list, tuple)) or len(text_conf) < 2:
            continue
        text = " ".join(str(text_conf[0]).split())
        confidence = float(text_conf[1])
        points = [point for point in box if isinstance(point, (list, tuple)) and len(point) >= 2]
        if not text or not isfinite(confidence) or not points:
            continue
        xs, ys = [float(point[0]) for point in points], [float(point[1]) for point in points]
        if not all(isfinite(value) for value in (*xs, *ys)):
            continue
        left, top = max(0.0, min(xs) / width), max(0.0, min(ys) / height)
        right, bottom = min(1.0, max(xs) / width), min(1.0, max(ys) / height)
        if right <= left or bottom <= top:
            continue
        detections.append({
            "text": text,
            "confidence": max(0.0, min(1.0, confidence)),
            "bounds": {"left": left, "top": top, "width": right - left, "height": bottom - top},
        })
    return detections
