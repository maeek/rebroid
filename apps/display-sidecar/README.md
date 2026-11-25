# Display sidecar

NestJS service for viewer sessions, ADB controls, and scrcpy H.264/Opus streaming, with a Go/Pion
WebRTC bridge and an embedded browser viewer. Compose runs separate instances for managed
runtimes and external devices. Each holds its own bounded session state in memory.

See the [architecture overview](../../docs/architecture.md) and
[display protocol and recovery rules](../../docs/display-streaming.md).

## Development

Follow the [local setup](../../CONTRIBUTING.md#local-development), then run from the repository root:

```bash
./apps/display-sidecar/dev.sh
```

The launcher builds the service and viewer. Live streaming needs an ADB target and the scrcpy
server artifact. The [Compose image](Dockerfile) bundles the server and WebRTC bridge.

## Configuration and access

See [local examples](.env.example) and the [sidecar configuration](src/modules/shared/sidecar-config.service.ts)
for media ports, session limits and encoder settings.

Internal APIs require a shared secret. The managed sidecar reads `/app/secrets/rebroid-shared-secret`.
The external ADB broker reads its dedicated credential at `/run/rebroid-external-adb/broker-secret`.
Compose mounts both read-only. Limit the unauthenticated override to isolated development.
Viewer URLs carry a display session ID. The sidecar verifies the same-origin account session,
runtime identity, and capabilities with web before attachment and while transports are active.
New virtual displays and WebRTC offers require enabled, synchronized state for
`feature.display-virtual` and `feature.display-webrtc` respectively. The viewer uses WebSocket
when WebRTC is unavailable under the synchronized feature settings.

The managed sidecar runs as root in Compose. The external ADB broker runs as UID 1000 with
its own key volume and opt-in USB access. [Broker deployment](../../docs/deployment.md#external-android-devices)

## Verification

```bash
pnpm --filter @rebroid/display-sidecar typecheck
pnpm --filter @rebroid/display-sidecar test
pnpm --filter @rebroid/display-sidecar build
```

Run `go test ./...` from `apps/display-sidecar/webrtc-bridge` for bridge changes.
For changes to ADB or scrcpy lifecycle ordering, follow the [Redroid verification requirements](../../docs/display-streaming.md#protected-scrcpy-lifecycle).

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
