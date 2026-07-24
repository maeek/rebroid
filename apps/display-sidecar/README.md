# Display sidecar

The display sidecar is the stateful display process for one Rebroid host. It owns ADB command execution, scrcpy processes and sockets, viewer sessions, WebSocket streaming, and the small Go WebRTC bridge. The orchestrator owns Android containers, networking, and the desired feature state.

The current deployment model is deliberately one sidecar per host. Sessions are in memory and are not designed for horizontal scaling.

## Supported behavior

- Redroid 13 and 14 with the bundled scrcpy 4.0 server.
- Native-resolution H.264 at 60 FPS with a 16 Mbps encoder target and
  one-second IDR interval. WebRTC is the default; WebSocket uses
  WebCodecs/WebGL2 in Chromium and fragmented MP4/MediaSource in Firefox.
- Timestamped `RBD1` access-unit framing and per-consumer, GOP-aware live-edge
  queues. The sidecar does not transcode media.
- Token-scoped viewer sessions and a bundled browser viewer.
- One experimental virtual display per application when `feature.display-virtual` is enabled.
- Touch, keyboard, clipboard, navigation, power, rotation, volume, logcat, screenshot, and bounded ADB operations.

Redroid 15 and 16 are rejected because current images can answer ADB while failing scrcpy video startup. The container is currently `linux/amd64`: its downloaded scrcpy release artifact is x86-64, and Redroid/device access is coordinated around a Linux Docker host.

## Develop locally

Use Node.js 24, Corepack, and pnpm from the repository root:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @rebroid/display-sidecar typecheck
pnpm --filter @rebroid/display-sidecar test
pnpm --filter @rebroid/display-sidecar build
pnpm --filter @rebroid/display-sidecar start:dev
```

The build compiles NestJS and the viewer's explicit ESM imports, then copies the viewer assets into `dist`. There is no post-build import rewrite.

Swagger is available at `http://localhost:8000/docs` outside production, or when `ENABLE_API_DOCS=true`. Health endpoints are `/health/live` for the process and `/rebroid/display/health` for the display API.

## Authentication

Internal APIs fail closed. Configure `DISPLAY_SIDECAR_SHARED_SECRET` or mount a file and set `DISPLAY_SIDECAR_SHARED_SECRET_FILE`. The default file locations are `/app/secrets/display-sidecar-secret` and `/data/secrets/display-sidecar-secret`.

For isolated development only, `DISPLAY_SIDECAR_ALLOW_UNAUTHENTICATED_INTERNAL_API=true` explicitly disables internal authentication. An absent secret without this override returns `401`.

Public viewer routes require a short-lived session token. Feature flags are neither authentication nor authorization.

## Configuration

Configuration is validated once at startup. Important settings are:

| Variable                               |       Default | Purpose                                               |
| -------------------------------------- | ------------: | ----------------------------------------------------- |
| `PORT`                                 |        `8000` | HTTP and WebSocket port.                              |
| `DISPLAY_SESSION_TTL_SECONDS`          |         `900` | Sliding session TTL.                                  |
| `DISPLAY_SESSION_MAX_LIFETIME_SECONDS` |        `3600` | Hard session lifetime.                                |
| `DISPLAY_SESSION_MAX_ACTIVE`           |          `64` | Maximum live sessions; excess creation returns `429`. |
| `DISPLAY_WEBRTC_UDP_PORT_RANGE`        | `40000-40100` | Published WebRTC UDP ports.                           |
| `DISPLAY_WEBRTC_ICE_HOST`              |         empty | Browser-reachable ICE host override.                  |
| `DISPLAY_WEBRTC_STUN_URLS`             |         empty | Comma-separated STUN URLs.                            |
| `ADB_PATH`                             |         `adb` | ADB executable.                                       |
| `ADB_TEXT_OUTPUT_MAX_BYTES`            |     `2097152` | Maximum buffered text command output.                 |
| `ADB_BINARY_OUTPUT_MAX_BYTES`          |    `67108864` | Maximum buffered binary command output.               |
| `SCRCPY_TUNNEL_MODE`                   |     automatic | Optional `direct`, `forward`, or `reverse` override.  |
| `SCRCPY_CONTROL_CHANNEL`               |        `true` | Enable the scrcpy control channel.                    |
| `SCRCPY_VIDEO_ENCODER`                 |     automatic | Validated MediaCodec encoder selected by benchmark.   |
| `SCRCPY_LOGCAT_ON_SERVER_EXIT`         |        `true` | Collect bounded diagnostics after an early exit.      |

See [sidecar architecture](../../docs/sidecar-architecture.md) for ownership and control flows. Do not reorder the lifecycle steps described in [scrcpy invariants](../../docs/scrcpy-invariants.md).

The compatibility probe logs the advertised AVC encoders. Benchmark each
candidate with the deterministic native-motion workload and compare source
FPS, source PTS jitter, startup failures, and SPS profile/level in
`ViewerStreamMetricsV4`. Pin `SCRCPY_VIDEO_ENCODER` only when a candidate
sustains a higher source rate or lower jitter without reordered PTS or failed
starts. Keep that selection scoped to the tested Redroid image/device
capability; the sidecar never guesses a vendor encoder or lowers the profile.

## Container deployment

The Docker build context must be the repository root:

```bash
docker build -f apps/display-sidecar/Dockerfile -t rebroid/display-sidecar:local .
docker compose -f deploy/compose.yaml up --build display-sidecar
```

Publish the configured UDP range and place the sidecar on a network that can
reach Android ADB endpoints. The image bundles a checksum-verified official
scrcpy 4.0 x86-64 release artifact and a statically built Pion WebRTC bridge.
Public viewer routes reach this service through the nginx edge without passing
through Next.js. WebRTC RTP uses the published UDP range directly.

WebRTC waits for the source SPS/PPS and IDR before answering, negotiates the
exact compatible H.264 profile, and keeps receiver jitter targets between 20
and 40 ms. Both WebSocket backends stay at the live edge and report
`ViewerStreamMetricsV4` stage metrics and sequence watermarks. Reduced
resolution/frame-rate requests are rejected rather than silently applied.

The process currently runs as root because ADB/device access and shared-secret mount permissions are deployment-wide concerns. Moving it to a non-root user requires coordinated host-device and secret-volume changes; it is not safe as an isolated Dockerfile edit. Secrets must be mounted at runtime, never copied into image layers.

## Feature synchronization

`feature.display-virtual` is owned by the orchestrator and disabled by default. Before virtual-display creation, the orchestrator sends only that flag's effective value and the platform feature revision to the authenticated `/rebroid/display/features` endpoint. The sidecar validates the complete snapshot and atomically replaces its local state. Missing or stale state fails closed for new virtual displays; existing sessions drain normally.

## Manual Redroid verification

Any change touching `ScrcpyService` startup or cleanup requires a Linux Redroid host and evidence for:

1. Redroid 13 and 14 physical display through WebRTC and WebSocket.
2. Video with audio enabled and disabled.
3. Touch, keyboard, action, and clipboard through scrcpy control and ADB fallback.
4. Direct connection and direct-to-forward fallback.
5. Disconnect, retry, reconnect, final cleanup, and repeated create/release.
6. Virtual display rejection while disabled, then creation and release after enabling the flag.

Record host/image versions, commands, relevant logs, and observed results in the pull request. This repository cannot perform that hardware-backed matrix in the normal unit-test environment.

## Publication status

The repository and package remain `UNLICENSED`. Do not publish until a root license and the remaining governance policy are chosen.
