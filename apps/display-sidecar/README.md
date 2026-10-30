# Display sidecar

NestJS service for viewer sessions, ADB controls, and scrcpy H.264/Opus streaming, with a Go/Pion
WebRTC bridge and an embedded browser viewer. One instance serves one host; session state is
bounded and held in memory.

See the [architecture overview](../../docs/architecture.md) and
[display protocol and recovery rules](../../docs/display-streaming.md).

## Development

Follow the [local setup](../../CONTRIBUTING.md#local-development), then run from the repository root:

```bash
./apps/display-sidecar/dev.sh
```

The script builds the service/viewer and starts port `8000`. Local ADB/scrcpy access must be available.
The image bundles checksum-verified scrcpy 4.0 and the WebRTC bridge. Use the
[Compose deployment](../../docs/deployment.md) for complete runtime wiring.

## Configuration and access

[`.env.example`](.env.example) contains local examples;
[`sidecar-config.service.ts`](src/modules/shared/sidecar-config.service.ts) validates the full configuration.

| Setting                                                                | Purpose                                                  |
| ---------------------------------------------------------------------- | -------------------------------------------------------- |
| `DISPLAY_SIDECAR_SHARED_SECRET` / `DISPLAY_SIDECAR_SHARED_SECRET_FILE` | Internal session/control authentication.                 |
| `DISPLAY_WEBRTC_UDP_PORT_RANGE`                                        | Published media range, default `40000-40100`.            |
| `DISPLAY_WEBRTC_ICE_HOST`                                              | Browser-reachable ICE host override.                     |
| `DISPLAY_SESSION_TTL_SECONDS`                                          | Sliding session lifetime, default 900 seconds.           |
| `DISPLAY_SESSION_MAX_ACTIVE`                                           | Session capacity, default 64.                            |
| `SCRCPY_VIDEO_ENCODER`                                                 | Explicit encoder chosen through host/image benchmarking. |

Internal APIs fail closed without a secret. The unauthenticated development override must remain
limited to isolated development. Public viewer routes require short-lived session tokens.
New virtual displays require an enabled, synchronized `feature.display-virtual` snapshot;
missing or stale state blocks creation.

The process currently runs as root for device and secret-volume access. Changing that requires
coordinated host/volume permissions, not an isolated image edit. Secrets are mounted at runtime.

## Verification

```bash
pnpm --filter @rebroid/display-sidecar typecheck
pnpm --filter @rebroid/display-sidecar test
pnpm --filter @rebroid/display-sidecar build
```

Run `go test ./...` from `apps/display-sidecar/webrtc-bridge` for bridge changes.
Scrcpy startup/cleanup changes require the [manual Redroid matrix](../../docs/display-streaming.md#manual-verification).
A transport disconnect must never tear down the shared ADB/scrcpy source.
