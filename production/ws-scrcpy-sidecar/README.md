# Shop Me Alone ws-scrcpy Sidecar

This image builds a single internal ws-scrcpy service for the platform. Do not publish it directly to users. The web app should reach it only through the authenticated `/viewer/ws-scrcpy/*` Next.js proxy.

The orchestrator attaches this container to each managed application network when a viewer session is opened, then runs `adb connect <containerName>:5555` inside the sidecar.

## Build

```bash
docker build -t shop-me-alone/ws-scrcpy-sidecar ./ws-scrcpy-sidecar
```

To pin a fork or tag:

```bash
docker build \
  --build-arg WS_SCRCPY_REPOSITORY=https://github.com/your-org/ws-scrcpy.git \
  --build-arg WS_SCRCPY_REF=your-branch-or-tag \
  -t shop-me-alone/ws-scrcpy-sidecar ./ws-scrcpy-sidecar
```

## Runtime

The sidecar listens on port `8000` and is configured with:

```bash
WS_SCRCPY_PATHNAME=/viewer/ws-scrcpy
WS_SCRCPY_CONFIG=/etc/ws-scrcpy/config.yaml
```

The service needs `adb` in `PATH`; this Dockerfile installs Debian's `android-sdk-platform-tools` package.

In deployment:

- set `WS_SCRCPY_IMAGE=shop-me-alone/ws-scrcpy-sidecar:latest` on the orchestrator,
- keep the default `WS_SCRCPY_CONTAINER_NAME=sma-ws-scrcpy`, or set the same custom name in the orchestrator and web env,
- set `WS_SCRCPY_INTERNAL_BASE_URL=http://sma-ws-scrcpy:8000` on the Next.js server when overriding the default,
- keep the sidecar on an internal platform network shared with Next.js,
- do not expose `8000` publicly.
