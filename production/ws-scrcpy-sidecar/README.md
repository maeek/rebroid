# Rebroid ws-scrcpy Sidecar

This image builds a single internal ws-scrcpy service for the platform. Do not publish it directly to users. The web app should reach it only through the authenticated `/viewer/ws-scrcpy/*` Next.js proxy.

The orchestrator attaches this container to each managed application network when a viewer session is opened, then runs `adb connect <containerName>:5555` inside the sidecar.

## Default Setup

The root `docker-compose.yml` builds this image automatically and keeps it on the internal platform network. You do not need to publish port `8000` or set any sidecar environment variables for the default setup.

## Manual Build

```bash
docker build -t rebroid/ws-scrcpy-sidecar ./ws-scrcpy-sidecar
```

To pin a fork or tag:

```bash
docker build \
  --build-arg WS_SCRCPY_REPOSITORY=https://github.com/your-org/ws-scrcpy.git \
  --build-arg WS_SCRCPY_REF=your-branch-or-tag \
  -t rebroid/ws-scrcpy-sidecar ./ws-scrcpy-sidecar
```

## Runtime Defaults

The sidecar listens on port `8000` and the image already sets:

```bash
WS_SCRCPY_PATHNAME=/viewer/ws-scrcpy
WS_SCRCPY_CONFIG=/etc/ws-scrcpy/config.yaml
```

The service needs `adb` in `PATH`; this Dockerfile installs Debian's `android-sdk-platform-tools` package.

In custom deployments, keep the sidecar on an internal network shared with Next.js and do not expose `8000` publicly. The web image defaults to `http://rebroid-ws-scrcpy:8000`, so only override `WS_SCRCPY_INTERNAL_BASE_URL` when you also change the sidecar service name.
