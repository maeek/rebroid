from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from threading import Event

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from starlette.requests import ClientDisconnect

from .config import Settings
from .image_input import (
    ImageLimitExceeded,
    ImagePayloadError,
    OcrRequest,
    OcrRequestReader,
    RequestBodyBusy,
    RequestBodyDeadline,
)
from .preprocessing import CASCADE_MODES, RecognitionStopped
from .recognition import Recognition, RecognitionRejected
from .runtime import OcrRuntime

_RECOGNITION_STATUS = {
    "unsupported_language": 422,
    "ocr_not_ready": 503,
    "ocr_busy": 429,
    "ocr_failed": 500,
}


def create_app(settings: Settings | None = None, runtime: OcrRuntime | None = None) -> FastAPI:
    config = settings or Settings.from_environment()
    engine = runtime or OcrRuntime(config.language, config.inference_concurrency)
    request_reader = OcrRequestReader(config)
    recognition = Recognition(config, engine)

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        task = asyncio.create_task(engine.warmup())
        try:
            yield
        finally:
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)

    app = FastAPI(title="Rebroid OCR sidecar", lifespan=lifespan)

    @app.get("/health/live")
    def liveness():
        return {"ok": True, "service": "rebroid-ocr-sidecar"}

    @app.get("/health")
    def readiness():
        warmup = engine.readiness
        ready = warmup.ready
        payload = {
            "ok": ready,
            "status": "healthy" if ready else "unhealthy",
            "service": "rebroid-ocr-sidecar",
            "engine": "paddleocr",
            "language": config.language,
            "preprocessingModes": list(CASCADE_MODES),
            "ready": ready,
            "message": warmup.message,
            "warmupState": warmup.state,
        }
        if warmup.failure_code is not None:
            payload["failureCode"] = warmup.failure_code
        return payload if ready else JSONResponse(status_code=503, content=payload)

    @app.post("/ocr/screenshot", openapi_extra={
        "requestBody": {"required": True, "content": {"application/json": {"schema": OcrRequest.model_json_schema()}}},
    })
    async def ocr_screenshot(request: Request):
        content_type = request.headers.get("content-type", "application/json").split(";", 1)[0].strip().lower()
        if content_type != "application/json" and not (content_type.startswith("application/") and content_type.endswith("+json")):
            raise HTTPException(status_code=415, detail={"code": "invalid_image", "message": "Expected a JSON OCR request."})
        stopped = Event()
        disconnect: asyncio.Task | None = None

        async def watch_disconnect():
            while (await request.receive())["type"] != "http.disconnect":
                pass
            stopped.set()

        try:
            payload = await request_reader.read(request)
            disconnect = asyncio.create_task(watch_disconnect())
            return await recognition.recognize(payload, stopped)
        except ValidationError as exc:
            raise HTTPException(status_code=422, detail={"code": "invalid_image", "message": "Invalid OCR request."}) from exc
        except RequestBodyBusy as exc:
            raise HTTPException(status_code=429, detail={"code": "ocr_busy", "message": "OCR request capacity is busy."}) from exc
        except RequestBodyDeadline as exc:
            raise HTTPException(status_code=504, detail={"code": "ocr_deadline_exceeded", "message": "OCR request body timed out."}) from exc
        except ImagePayloadError as exc:
            status = 413 if isinstance(exc, ImageLimitExceeded) else 400
            raise HTTPException(status_code=status, detail={"code": "invalid_image", "message": str(exc)}) from exc
        except RecognitionRejected as exc:
            detail = {"code": exc.code, "message": str(exc)}
            if exc.attempts is not None:
                detail["attempts"] = exc.attempts
            raise HTTPException(status_code=_RECOGNITION_STATUS[exc.code], detail=detail) from exc
        except (ClientDisconnect, RecognitionStopped) as exc:
            raise HTTPException(
                status_code=504,
                detail={"code": "ocr_deadline_exceeded", "message": "OCR request expired or was canceled."},
            ) from exc
        finally:
            stopped.set()
            if disconnect is not None:
                disconnect.cancel()
                await asyncio.gather(disconnect, return_exceptions=True)

    return app
