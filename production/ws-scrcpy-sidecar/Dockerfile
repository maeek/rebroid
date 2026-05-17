# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS builder

ARG WS_SCRCPY_REPOSITORY=https://github.com/NetrisTV/ws-scrcpy.git
ARG WS_SCRCPY_REF=master

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  ca-certificates \
  g++ \
  git \
  make \
  python3 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/ws-scrcpy

RUN git clone --depth 1 --branch "${WS_SCRCPY_REF}" "${WS_SCRCPY_REPOSITORY}" .
COPY build.config.override.json ./build.config.override.json
RUN --mount=type=cache,target=/root/.npm npm install \
  && npm run dist \
  && npm prune --omit=dev \
  && npm cache clean --force

FROM node:24-bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  adb \
  ca-certificates \
  && command -v adb \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
  PATH=/usr/local/bin:/usr/bin:$PATH \
  WS_SCRCPY_CONFIG=/etc/ws-scrcpy/config.yaml \
  WS_SCRCPY_PATHNAME=/viewer/ws-scrcpy

WORKDIR /opt/ws-scrcpy

COPY --from=builder /opt/ws-scrcpy/dist ./
COPY --from=builder /opt/ws-scrcpy/node_modules ./node_modules
COPY ws-scrcpy.config.yaml /etc/ws-scrcpy/config.yaml

EXPOSE 8000

CMD ["node", "index.js"]
