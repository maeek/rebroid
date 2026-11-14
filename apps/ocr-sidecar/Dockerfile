FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8100 \
    XDG_CACHE_HOME=/app/cache \
    PADDLEOCR_HOME=/app/cache/paddleocr

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    libglib2.0-0 \
    libgl1 \
    libgomp1 \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt requirements-runtime.txt /app/
RUN --mount=type=cache,target=/root/.cache/pip \
  PIP_CACHE_DIR=/root/.cache/pip pip install --no-compile -r /app/requirements-runtime.txt

COPY main.py /app/main.py
COPY ocr_sidecar /app/ocr_sidecar

RUN useradd --create-home --uid 10001 --user-group rebroid \
  && mkdir -p /app/cache \
  && chown rebroid:rebroid /app/cache

USER rebroid
EXPOSE 8100

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD python -c 'import os, urllib.request; urllib.request.urlopen("http://127.0.0.1:" + os.environ["PORT"] + "/health", timeout=4).close()'

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
