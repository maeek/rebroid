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

Internal APIs require a shared secret. Compose mounts the orchestrator's generated secret read-only
at `/app/secrets/rebroid-shared-secret`. Limit the unauthenticated override to isolated development.
Viewer URLs carry a display session ID. The sidecar verifies the same-origin account session,
runtime identity, and capabilities with web before attachment and while transports are active.
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

### Android text entry

The automation text command uses Android key events first. When Android cannot map
the text to key events, the sidecar pushes a temporary UI Automator helper to the
device. It inserts text at the selection in the focused editable field and checks
the value Android reports. The helper requires an unmasked field and a known
selection when it contains text. It leaves the clipboard and IME alone.

To run the device regression, focus a test text field containing only
`rebroid-input-test`, set `REBROID_INPUT_TEST_SERIAL` to its ADB serial, and run
the sidecar test suite. It checks exact Unicode insertion and cursor placement.

Docker compiles `android-input/FocusedTextInput.java` in a dedicated build stage
and copies the DEX jar into the runtime image. For local device testing, set
`ANDROID_HOME` to an SDK with Platform 35 and Build Tools 35.0.0. With JDK 21
on the path, run `sh apps/display-sidecar/android-input/build.sh` from the
repository root. Its output goes under the ignored `dist/android-input/` directory.
