# OCR sidecar

FastAPI/PaddleOCR service for automation text recognition. It validates images, owns preprocessing
and model readiness, and bounds inference capacity. The orchestrator owns automation policy and
gates calls with `feature.ocr`.

## Runtime behavior

- `OCR_LANGUAGE` selects one deployment language/model; a different request language is rejected.
- `/health/live` reports process liveness. `/health` returns `503` until the model is ready
  and reports `warmupState` plus a `failureCode` when a warmup attempt fails. Recognized
  transient download failures get up to two retries after 1 and 2 seconds. The sidecar logs
  the exception type and available error codes.
- The sidecar checks capacity before submitting worker work. Saturation returns `429` with
  `ocr_busy`. Each configured inference slot gets its own warmed Paddle predictor.
- A quality-gated cascade tries raw input, grayscale, contrast, and threshold, returning the best result.
  If any attempted pass fails, the result carries `searchComplete: false`. The orchestrator
  can use detections from successful passes and treats an unmatched partial search as inconclusive.
- A request can pass its remaining budget as `timeoutMs`. An expired or disconnected request skips later
  passes. An active Paddle inference keeps its slot until it returns. Expiration returns `504` with
  `ocr_deadline_exceeded`.
- The JSON request body is limited to `OCR_MAX_ENCODED_BYTES` plus 4 KiB for metadata.
  `OCR_REQUEST_CONCURRENCY` limits how many bodies the sidecar buffers and validates at once.
  Saturation returns `429` with `ocr_busy`. Bodies that exceed `OCR_REQUEST_READ_TIMEOUT_MS`
  while uploading receive `504` with `ocr_deadline_exceeded`. The ingress limit is independent
  of inference capacity.
  PNG, JPEG, and WebP inputs must match their declared media type and meet encoded, decoded,
  and pixel limits before resizing.
- The orchestrator accepts up to 16 KiB for readiness responses and 2 MiB for recognition
  responses. A recognition response can contain up to 512 detections.

| Variable                      |    Default |
| ----------------------------- | ---------: |
| `OCR_LANGUAGE`                |       `en` |
| `OCR_MIN_CONFIDENCE`          |      `0.4` |
| `OCR_MAX_IMAGE_DIMENSION`     |     `1600` |
| `OCR_MAX_ENCODED_BYTES`       | `33554432` |
| `OCR_MAX_DECODED_BYTES`       | `25165824` |
| `OCR_MAX_PIXELS`              | `16000000` |
| `OCR_INFERENCE_CONCURRENCY`   |        `1` |
| `OCR_REQUEST_CONCURRENCY`     |        `2` |
| `OCR_REQUEST_READ_TIMEOUT_MS` |     `5000` |
| `PORT`                        |     `8100` |

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
