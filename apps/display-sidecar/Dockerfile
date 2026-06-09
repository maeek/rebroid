# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS builder

WORKDIR /workspace
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/display-sidecar/package.json apps/display-sidecar/package.json
COPY packages/application-core/package.json packages/application-core/package.json
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --filter @rebroid/display-sidecar... --frozen-lockfile
COPY packages/application-core /workspace/packages/application-core
RUN pnpm --filter @rebroid/application-core build
RUN pnpm --filter @rebroid/display-sidecar deploy --prod /out

WORKDIR /workspace/apps/display-sidecar
COPY apps/display-sidecar/tsconfig.json ./
COPY apps/display-sidecar/scripts ./scripts
COPY apps/display-sidecar/src ./src
RUN pnpm build

FROM golang:1.24-bookworm AS webrtc-bridge

WORKDIR /src
COPY apps/display-sidecar/webrtc-bridge/go.mod ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY apps/display-sidecar/webrtc-bridge ./
RUN --mount=type=cache,target=/root/.cache/go-build CGO_ENABLED=0 go build -o /out/rebroid-webrtc-bridge .

FROM node:24-bookworm-slim AS scrcpy-server

ARG SCRCPY_VERSION=4.0

RUN apt-get -o Acquire::Check-Date=false update \
  && apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  tar \
  && rm -rf /var/lib/apt/lists/*

RUN curl -fL --retry 3 --max-time 60 \
  -o /tmp/scrcpy.tar.gz \
  "https://github.com/Genymobile/scrcpy/releases/download/v${SCRCPY_VERSION}/scrcpy-linux-x86_64-v${SCRCPY_VERSION}.tar.gz" \
  && mkdir -p /tmp/scrcpy \
  && tar -xzf /tmp/scrcpy.tar.gz -C /tmp/scrcpy --strip-components=1 \
  && test -f /tmp/scrcpy/scrcpy-server

FROM node:24-bookworm-slim AS runtime

ARG SCRCPY_VERSION=4.0

RUN apt-get -o Acquire::Check-Date=false update \
  && apt-get install -y --no-install-recommends \
  adb \
  ca-certificates \
  && command -v adb \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
  PORT=8000 \
  SCRCPY_VERSION=${SCRCPY_VERSION} \
  SCRCPY_SERVER_PATH=/opt/rebroid-display-sidecar/scrcpy-server \
  DISPLAY_WEBRTC_BRIDGE_PATH=/opt/rebroid-display-sidecar/rebroid-webrtc-bridge \
  DISPLAY_WEBRTC_UDP_PORT_RANGE=40000-40100

WORKDIR /opt/rebroid-display-sidecar

COPY --from=builder /workspace/apps/display-sidecar/dist ./dist
COPY --from=builder /out ./
COPY --from=scrcpy-server /tmp/scrcpy/scrcpy-server ./scrcpy-server
COPY --from=webrtc-bridge /out/rebroid-webrtc-bridge ./rebroid-webrtc-bridge

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD node -e "fetch('http://127.0.0.1:8000/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
