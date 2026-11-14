FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8100 \
    XDG_CACHE_HOME=/app/cache \
    PADDLEOCR_HOME=/app/cache/paddleocr

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    libgomp1 \
  && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
RUN apt-get update \
  && apt-get install -y --no-install-recommends binutils \
  && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/ocr
ENV PATH=/opt/ocr/bin:$PATH

COPY requirements.txt requirements-runtime.txt install_runtime.py /app/
RUN --mount=type=cache,target=/root/.cache/pip \
  export PIP_CACHE_DIR=/root/.cache/pip \
  && pip install --no-compile --target /tmp/wheel-tools wheel==0.46.3 \
  && PYTHONPATH=/tmp/wheel-tools python install_runtime.py \
  && rm -rf /tmp/wheel-tools

COPY trim_runtime.py /app/
RUN python trim_runtime.py && pip check

FROM base AS runtime
ENV PATH=/opt/ocr/bin:$PATH
COPY --from=dependencies /opt/ocr /opt/ocr
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
