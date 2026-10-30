# OCR sidecar

FastAPI/PaddleOCR service for automation text recognition. It validates images, owns preprocessing
and model readiness, and bounds inference capacity. The orchestrator owns automation policy and
gates calls with `feature.ocr`.

## Runtime behavior

- `OCR_LANGUAGE` selects one deployment language/model; a different request language is rejected.
- `/health/live` reports process liveness; `/health` returns `503` until model warmup finishes.
- Inference is bounded; saturation returns `429` with `ocr_busy`.
- A quality-gated cascade tries raw input, grayscale, contrast, and threshold, returning the best result.
- PNG, JPEG, and WebP inputs are validated against encoded/decoded size, pixel, and dimension limits.

| Variable                    |    Default |
| --------------------------- | ---------: |
| `OCR_LANGUAGE`              |       `en` |
| `OCR_MIN_CONFIDENCE`        |      `0.4` |
| `OCR_MAX_IMAGE_DIMENSION`   |     `1600` |
| `OCR_MAX_ENCODED_BYTES`     | `33554432` |
| `OCR_MAX_DECODED_BYTES`     | `25165824` |
| `OCR_MAX_PIXELS`            | `16000000` |
| `OCR_INFERENCE_CONCURRENCY` |        `1` |
| `PORT`                      |     `8100` |

## Development

Use a Python environment for the sidecar, then run from `apps/ocr-sidecar`.
Lightweight tests do not load or download Paddle:

```bash
python3 -m pip install -r requirements.txt
python3 -m pytest -q
```

For model integration, install the runtime and start the API from the same directory:

```bash
python3 -m pip install -r requirements-runtime.txt
python3 -m uvicorn main:app --host 127.0.0.1 --port 8100
```

After readiness succeeds, submit a known image to `/ocr/screenshot` and verify language,
selected preprocessing pass, and detections. Unit tests do not replace this model check.

Build the production image from the repository root:

```bash
docker build -f apps/ocr-sidecar/Dockerfile -t rebroid/ocr-sidecar:local .
```

Runtime dependencies are pinned in `requirements-runtime.txt`. Model provenance is covered in
[third-party notices](../../THIRD_PARTY_NOTICES.md); service ownership is in the
[architecture overview](../../docs/architecture.md).
