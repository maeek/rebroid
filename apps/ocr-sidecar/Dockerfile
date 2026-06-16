FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8100 \
    OCR_LANGUAGES=en \
    OCR_MIN_CONFIDENCE=0.4 \
    OCR_MAX_IMAGE_DIMENSION=1600 \
    XDG_CACHE_HOME=/app/cache \
    PADDLEOCR_HOME=/app/cache/paddleocr

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    libglib2.0-0 \
    libgl1 \
    libgomp1 \
  && rm -rf /var/lib/apt/lists/*

COPY apps/ocr-sidecar/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY apps/ocr-sidecar/main.py /app/main.py

RUN useradd --create-home --uid 10001 --user-group rebroid \
  && mkdir -p /app/cache \
  && chown -R rebroid:rebroid /app

USER rebroid
EXPOSE 8100

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null || exit 1

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
