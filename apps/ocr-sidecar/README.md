# Rebroid OCR Sidecar

FastAPI service for screenshot text grounding. It uses PaddleOCR on CPU and exposes:

- `GET /health`
- `POST /ocr/screenshot`

The orchestrator calls it through `OCR_SIDECAR_BASE_URL`. OCR output is advisory grounding data; UI XML and confirmed Android facts still take precedence.
