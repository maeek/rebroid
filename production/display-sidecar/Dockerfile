# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS builder

WORKDIR /opt/rebroid-display-sidecar

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
RUN npm run build \
  && npm prune --omit=dev \
  && npm cache clean --force

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
  SCRCPY_SERVER_PATH=/opt/rebroid-display-sidecar/scrcpy-server

WORKDIR /opt/rebroid-display-sidecar

COPY --from=builder /opt/rebroid-display-sidecar/dist ./dist
COPY --from=builder /opt/rebroid-display-sidecar/node_modules ./node_modules
COPY --from=builder /opt/rebroid-display-sidecar/package.json ./package.json
COPY --from=scrcpy-server /tmp/scrcpy/scrcpy-server ./scrcpy-server

EXPOSE 8000

CMD ["node", "dist/main.js"]
