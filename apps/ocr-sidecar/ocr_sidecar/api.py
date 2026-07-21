from __future__ import annotations

import asyncio
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .config import Settings
from .preprocessing import CASCADE_MODES, ImagePayloadError, decode_image, resize_image, run_cascade
from .runtime import OcrRuntime


class OcrRequest(BaseModel):
    dataUrl: str | None = None
    imageBase64: str | None = None
    mediaType: str | None = None
    language: str | None = None
    minConfidence: float | None = Field(default=None, ge=0, le=1)
    maxImageDimension: int | None = Field(default=None, ge=320, le=4096)


def create_app(settings: Settings | None = None, runtime: OcrRuntime | None = None) -> FastAPI:
    config = settings or Settings.from_environment()
    engine = runtime or OcrRuntime(config.language, config.inference_concurrency)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        task = asyncio.create_task(asyncio.to_thread(engine.initialize))
        app.state.warmup_task = task
        yield
        if not task.done():
            task.cancel()

    app = FastAPI(title="Rebroid OCR sidecar", lifespan=lifespan)

    @app.get("/health/live")
    def liveness():
        return {"ok": True, "service": "rebroid-ocr-sidecar"}

    @app.get("/health")
    def readiness():
        payload = {
            "ok": engine.ready,
            "status": "healthy" if engine.ready else "unhealthy",
            "service": "rebroid-ocr-sidecar",
            "engine": "paddleocr",
            "language": config.language,
            "preprocessingModes": list(CASCADE_MODES),
            "ready": engine.ready,
            "message": engine.message,
        }
        return payload if engine.ready else JSONResponse(status_code=503, content=payload)

    @app.post("/ocr/screenshot")
    def ocr_screenshot(payload: OcrRequest):
        language = payload.language or config.language
        if language != config.language:
            raise HTTPException(status_code=422, detail={"code": "unsupported_language", "message": "Requested OCR language is not deployed."})
        if not engine.ready:
            raise HTTPException(status_code=503, detail={"code": "ocr_not_ready", "message": "OCR model is not ready."})
        if not engine.try_acquire():
            raise HTTPException(status_code=429, detail={"code": "ocr_busy", "message": "OCR inference capacity is busy."})
        started = time.perf_counter()
        try:
            try:
                image = decode_image(
                    data_url=payload.dataUrl,
                    image_base64=payload.imageBase64,
                    media_type=payload.mediaType,
                    max_encoded_bytes=config.max_encoded_bytes,
                    max_decoded_bytes=config.max_decoded_bytes,
                    max_pixels=config.max_pixels,
                )
            except ImagePayloadError as exc:
                status = 413 if "too large" in str(exc) or "limit" in str(exc) else 400
                raise HTTPException(status_code=status, detail={"code": "invalid_image", "message": str(exc)}) from exc
            max_dimension = min(payload.maxImageDimension or config.max_image_dimension, config.max_image_dimension)
            min_confidence = payload.minConfidence if payload.minConfidence is not None else config.min_confidence
            image = resize_image(image, max_dimension)
            best, attempts = run_cascade(image, engine.recognize, min_confidence)
            if best is None:
                raise HTTPException(status_code=500, detail={"code": "ocr_failed", "message": "OCR execution failed.", "attempts": attempts})
            return {
                "status": "available",
                "engine": "paddleocr",
                "model": "PP-OCR",
                "language": language,
                "preprocessingMode": best["mode"],
                "preprocessingAttempts": attempts,
                "elapsedMs": round((time.perf_counter() - started) * 1000),
                "image": {"width": image.width, "height": image.height},
                "detections": best["detections"],
            }
        finally:
            engine.release()

    return app
