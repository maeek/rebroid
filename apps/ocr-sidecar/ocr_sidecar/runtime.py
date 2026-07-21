from __future__ import annotations

from threading import BoundedSemaphore, Lock
from typing import Any

import numpy as np
from PIL import Image


class OcrRuntime:
    def __init__(self, language: str, concurrency: int) -> None:
        self.language = language
        self._capacity = BoundedSemaphore(concurrency)
        self._lock = Lock()
        self._engine: Any | None = None
        self._message = "OCR model is initializing."

    @property
    def ready(self) -> bool:
        with self._lock:
            return self._engine is not None

    @property
    def message(self) -> str:
        with self._lock:
            return self._message

    def initialize(self) -> None:
        try:
            from paddleocr import PaddleOCR

            try:
                engine = PaddleOCR(use_angle_cls=True, lang=self.language, show_log=False)
            except TypeError:
                engine = PaddleOCR(use_angle_cls=True, lang=self.language)
            engine.ocr(np.zeros((32, 128, 3), dtype=np.uint8), cls=True)
            with self._lock:
                self._engine = engine
                self._message = "OCR model is ready."
        except Exception:
            with self._lock:
                self._engine = None
                self._message = "OCR model initialization failed."

    def try_acquire(self) -> bool:
        return self._capacity.acquire(blocking=False)

    def release(self) -> None:
        self._capacity.release()

    def recognize(self, image: Image.Image) -> Any:
        with self._lock:
            engine = self._engine
        if engine is None:
            raise RuntimeError("OCR model is not ready.")
        return engine.ocr(np.array(image), cls=True)
