# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS builder

ARG WS_SCRCPY_REPOSITORY=https://github.com/NetrisTV/ws-scrcpy.git
ARG WS_SCRCPY_REF=master

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  android-sdk-platform-tools \
  ca-certificates \
  g++ \
  git \
  make \
  python3 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/ws-scrcpy

RUN git clone --depth 1 --branch "${WS_SCRCPY_REF}" "${WS_SCRCPY_REPOSITORY}" .
COPY build.config.override.json ./build.config.override.json
RUN npm install && npm run dist

FROM node:20-bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  android-sdk-platform-tools \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
  WS_SCRCPY_CONFIG=/etc/ws-scrcpy/config.yaml \
  WS_SCRCPY_PATHNAME=/viewer/ws-scrcpy

WORKDIR /opt/ws-scrcpy

COPY --from=builder /opt/ws-scrcpy/dist ./
COPY --from=builder /opt/ws-scrcpy/node_modules ./node_modules
COPY ws-scrcpy.config.yaml /etc/ws-scrcpy/config.yaml

EXPOSE 8000

CMD ["node", "index.js"]
