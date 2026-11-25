# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS builder

WORKDIR /workspace
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.package.json ./
COPY apps/display-sidecar/package.json apps/display-sidecar/package.json
COPY packages/android-application-core/package.json packages/android-application-core/package.json
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --filter @rebroid/display-sidecar... --frozen-lockfile
COPY packages/android-application-core /workspace/packages/android-application-core
RUN pnpm --filter @rebroid/android-application-core build
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm --filter @rebroid/display-sidecar deploy --prod /out

WORKDIR /workspace/apps/display-sidecar
COPY apps/display-sidecar/tsconfig.json ./
COPY apps/display-sidecar/scripts ./scripts
COPY apps/display-sidecar/src ./src
RUN pnpm build

FROM golang:1.24-bookworm AS webrtc-bridge

WORKDIR /src
COPY apps/display-sidecar/webrtc-bridge/go.mod apps/display-sidecar/webrtc-bridge/go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY apps/display-sidecar/webrtc-bridge ./
RUN --mount=type=cache,target=/go/pkg/mod \
  --mount=type=cache,target=/root/.cache/go-build \
  CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /out/rebroid-webrtc-bridge .

FROM docker.io/library/eclipse-temurin:21-jdk-jammy AS android-input

ENV ANDROID_HOME=/opt/android-sdk
ADD --checksum=sha256:0988cacad01b38a18a47bac14a0695f246bc76c1b06c0eeb8eb0dc825ab0c8e0 https://dl.google.com/android/repository/platform-35_r02.zip /tmp/platform.zip
ADD --checksum=sha256:bd3a4966912eb8b30ed0d00b0cda6b6543b949d5ffe00bea54c04c81e1561d88 https://dl.google.com/android/repository/build-tools_r35_linux.zip /tmp/build-tools.zip
WORKDIR /opt/android-sdk/platforms
RUN jar xf /tmp/platform.zip android-35/android.jar android-35/uiautomator.jar android-35/optional/android.test.base.jar
WORKDIR /opt/android-sdk/build-tools
RUN jar xf /tmp/build-tools.zip android-15/lib/d8.jar && mv android-15 35.0.0
WORKDIR /src/android-input
COPY apps/display-sidecar/android-input/FocusedTextInput.java apps/display-sidecar/android-input/build.sh ./
RUN sh build.sh

FROM node:24-bookworm-slim AS scrcpy-server

ARG SCRCPY_VERSION=5.0.1
ARG SCRCPY_LINUX_X86_64_SHA256=9f969d30cc574816077edecda65719c1c70b0aee1df1ba5fa00779ac07b8fd6e

RUN apt-get -o Acquire::Check-Date=false update \
  && apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  tar \
  && rm -rf /var/lib/apt/lists/*

RUN curl -fL --retry 3 --max-time 60 \
  -o /tmp/scrcpy.tar.gz \
  "https://github.com/Genymobile/scrcpy/releases/download/v${SCRCPY_VERSION}/scrcpy-linux-x86_64-v${SCRCPY_VERSION}.tar.gz" \
  && echo "${SCRCPY_LINUX_X86_64_SHA256}  /tmp/scrcpy.tar.gz" | sha256sum -c - \
  && mkdir -p /tmp/scrcpy \
  && tar -xzf /tmp/scrcpy.tar.gz -C /tmp/scrcpy --strip-components=1 \
  && test -f /tmp/scrcpy/scrcpy-server

FROM node:24-bookworm-slim AS runtime

ARG SCRCPY_VERSION=5.0.1

RUN apt-get -o Acquire::Check-Date=false update \
  && apt-get install -y --no-install-recommends \
  adb \
  ca-certificates \
  && command -v adb \
  && install -d -m 0700 -o 1000 -g 1000 /app/adb-keys \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
  PORT=8000 \
  SCRCPY_VERSION=${SCRCPY_VERSION} \
  SCRCPY_SERVER_PATH=/opt/rebroid-display-sidecar/scrcpy-server \
  DISPLAY_WEBRTC_BRIDGE_PATH=/opt/rebroid-display-sidecar/rebroid-webrtc-bridge \
  DISPLAY_WEBRTC_UDP_PORT=40000

WORKDIR /opt/rebroid-display-sidecar

COPY --from=builder /workspace/apps/display-sidecar/dist ./dist
COPY --from=builder /out/node_modules ./node_modules
COPY --from=builder /out/package.json ./package.json
COPY --from=android-input /src/dist/android-input/focused-text-input.jar ./dist/android-input/focused-text-input.jar
# Only the Android server is used. The desktop client and its VA-API decoder
# are not part of this relay; the viewer's browser decodes the video.
COPY --from=scrcpy-server /tmp/scrcpy/scrcpy-server ./scrcpy-server
COPY --from=webrtc-bridge /out/rebroid-webrtc-bridge ./rebroid-webrtc-bridge

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD node -e "fetch('http://127.0.0.1:8000/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
