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
The image bundles checksum-verified scrcpy 5.0.1 and the WebRTC bridge. Use the
[Compose deployment](../../docs/deployment.md) for complete runtime wiring.
Only scrcpy's Android server is copied from the release archive. The sidecar relays
encoded media; the viewer's browser decodes it. Scrcpy 5 desktop hardware decoding
does not require GPU passthrough to this sidecar. See
[GPU acceleration](../../docs/deployment.md#gpu-acceleration-and-scrcpy-5).

## Configuration and access

[`.env.example`](.env.example) contains local examples;
[`sidecar-config.service.ts`](src/modules/shared/sidecar-config.service.ts) validates the full configuration.

| Setting                                                                | Purpose                                                  |
| ---------------------------------------------------------------------- | -------------------------------------------------------- |
| `DISPLAY_SIDECAR_SHARED_SECRET` / `DISPLAY_SIDECAR_SHARED_SECRET_FILE` | Internal session/control authentication.                 |
| `DISPLAY_WEBRTC_UDP_PORT`                                        | Published media port, default `40000`.            |
| `DISPLAY_WEBRTC_ICE_HOST`                                              | Browser-reachable ICE host override.                     |
| `DISPLAY_SESSION_TTL_SECONDS`                                          | Sliding session lifetime, default 900 seconds.           |
| `DISPLAY_SESSION_MAX_ACTIVE`                                           | Session capacity, default 64.                            |
| `SCRCPY_VIDEO_ENCODER`                                                 | Explicit encoder chosen through host/image benchmarking. |

Internal APIs fail closed without a secret. The unauthenticated development override must remain
limited to isolated development. Public viewer routes require short-lived session tokens.
New virtual displays and WebRTC offers require enabled, synchronized state for
`feature.display-virtual` and `feature.display-webrtc` respectively. The viewer uses WebSocket
when WebRTC is unavailable under the synchronized feature settings.

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
