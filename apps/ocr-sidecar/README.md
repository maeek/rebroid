# OCR sidecar

The OCR sidecar is an advisory FastAPI vision service. It owns image validation, preprocessing, one selected PaddleOCR runtime, and bounded inference. It does not own automation policy or feature state; the orchestrator gates calls with `feature.ocr`.

## Runtime behavior

- `OCR_LANGUAGE` selects one deployment language/model (default `en`). Requests may omit `language`; a different requested language is rejected.
- Startup initializes and warms PaddleOCR in the background. `/health/live` reports process liveness, while `/health` returns `503` until the model is ready.
- Inference concurrency defaults to one. Saturated requests return `429` with `ocr_busy`.
- The quality cascade runs raw input first, then grayscale, contrast, and threshold only while quality is below `max(0.65, minConfidence)`. The best attempted result is returned.
- PNG, JPEG, and WebP are accepted. Encoded bytes, decoded bytes, pixels, dimensions, confidence, and concurrency are bounded before expensive work.

| Variable | Default |
| --- | ---: |
| `OCR_LANGUAGE` | `en` |
| `OCR_MIN_CONFIDENCE` | `0.4` |
| `OCR_MAX_IMAGE_DIMENSION` | `1600` |
| `OCR_MAX_ENCODED_BYTES` | `33554432` |
| `OCR_MAX_DECODED_BYTES` | `25165824` |
| `OCR_MAX_PIXELS` | `16000000` |
| `OCR_INFERENCE_CONCURRENCY` | `1` |
| `PORT` | `8100` |

## Development

Lightweight unit tests do not import or download Paddle:

```bash
python3 -m pip install -r apps/ocr-sidecar/requirements.txt
cd apps/ocr-sidecar
python3 -m pytest -q
```

Install the real runtime only for model integration work:

```bash
python3 -m pip install -r apps/ocr-sidecar/requirements-runtime.txt
uvicorn main:app --host 127.0.0.1 --port 8100
curl -f http://127.0.0.1:8100/health
```

Build the production image from the repository root:

```bash
docker build -f apps/ocr-sidecar/Dockerfile -t rebroid/ocr-sidecar:local .
```

The container run is the opt-in integration test for the configured real model: wait for readiness, then submit a known PNG to `/ocr/screenshot` and verify the selected language, pass, and detections. Model files originate from the pinned PaddleOCR runtime and its configured download infrastructure; production deployments should cache and review those artifacts according to their supply-chain policy.
