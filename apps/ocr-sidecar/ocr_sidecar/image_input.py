from __future__ import annotations

import asyncio
import base64
import binascii
import io
from threading import BoundedSemaphore

from PIL import Image
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool
from starlette.requests import Request

from .config import Settings

_IMAGE_FORMATS = {"image/png": "PNG", "image/jpeg": "JPEG", "image/webp": "WEBP"}
_JSON_OVERHEAD_BYTES = 4096


class ImagePayloadError(ValueError):
    pass


class ImageLimitExceeded(ImagePayloadError):
    pass


class RequestBodyBusy(Exception):
    pass


class RequestBodyDeadline(Exception):
    pass


class OcrRequest(BaseModel):
    dataUrl: str | None = None
    imageBase64: str | None = None
    mediaType: str | None = None
    language: str | None = None
    minConfidence: float | None = Field(default=None, ge=0, le=1)
    maxImageDimension: int | None = Field(default=None, ge=320, le=4096)
    timeoutMs: int | None = Field(default=None, ge=1, le=120_000)


class OcrRequestReader:
    def __init__(self, config: Settings):
        self._slots = BoundedSemaphore(config.request_concurrency)
        self._max_encoded_bytes = config.max_encoded_bytes
        self._timeout_seconds = config.request_read_timeout_ms / 1000

    async def read(self, request: Request) -> OcrRequest:
        if not self._slots.acquire(blocking=False):
            raise RequestBodyBusy()
        try:
            try:
                async with asyncio.timeout(self._timeout_seconds):
                    body = await _read_body(request, self._max_encoded_bytes)
            except TimeoutError as exc:
                raise RequestBodyDeadline() from exc
            parser = asyncio.create_task(run_in_threadpool(OcrRequest.model_validate_json, body))
        except BaseException:
            self._slots.release()
            raise

        def release(done: asyncio.Task):
            self._slots.release()
            if not done.cancelled():
                done.exception()

        # Keep ingress capacity reserved if the HTTP task is canceled during JSON validation.
        parser.add_done_callback(release)
        return await asyncio.shield(parser)


async def _read_body(request: Request, max_encoded_bytes: int) -> bytearray:
    limit = max_encoded_bytes + _JSON_OVERHEAD_BYTES
    content_length = request.headers.get("content-length")
    if content_length is not None:
        try:
            declared_length = int(content_length)
        except ValueError as exc:
            raise ImagePayloadError("Invalid request length.") from exc
        if declared_length < 0:
            raise ImagePayloadError("Invalid request length.")
        if declared_length > limit:
            raise ImageLimitExceeded("OCR request body is too large.")
    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > limit:
            raise ImageLimitExceeded("OCR request body is too large.")
        body.extend(chunk)
    return body


def decode_image(payload: OcrRequest, config: Settings) -> Image.Image:
    encoded = payload.imageBase64
    declared_type = payload.mediaType
    if payload.dataUrl is not None:
        if encoded is not None:
            raise ImagePayloadError("Provide one image payload.")
        if "," not in payload.dataUrl or not payload.dataUrl.startswith("data:"):
            raise ImagePayloadError("Invalid data URL.")
        metadata, encoded = payload.dataUrl[5:].split(",", 1)
        declared_type, *parameters = metadata.lower().split(";")
        if "base64" not in parameters:
            raise ImagePayloadError("Image data URL must use base64 encoding.")
    if not encoded:
        raise ImagePayloadError("Missing image payload.")
    image_format = _IMAGE_FORMATS.get(declared_type or "")
    if image_format is None:
        raise ImagePayloadError("Unsupported image media type.")
    if len(encoded) > config.max_encoded_bytes:
        raise ImageLimitExceeded("Encoded image payload is too large.")
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ImagePayloadError("Invalid base64 image.") from exc
    if len(raw) > config.max_decoded_bytes:
        raise ImageLimitExceeded("Decoded image payload is too large.")
    try:
        with Image.open(io.BytesIO(raw)) as source:
            if source.format != image_format:
                raise ImagePayloadError("Image format does not match its media type.")
            width, height = source.size
            if width <= 0 or height <= 0 or width * height > config.max_pixels:
                raise ImageLimitExceeded("Image dimensions exceed the pixel limit.")
            source.verify()
        with Image.open(io.BytesIO(raw)) as source:
            return source.convert("RGB")
    except ImagePayloadError:
        raise
    except Exception as exc:
        raise ImagePayloadError("Unsupported or malformed image payload.") from exc
