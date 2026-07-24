# Sidecar architecture

## Ownership

| Process          | Owns                                                                                     | Does not own                                          |
| ---------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Orchestrator     | Android lifecycle, Docker/network operations, persisted feature intent and revision      | Display sockets/sessions, OCR inference               |
| Display sidecar  | ADB execution, scrcpy processes/sockets, viewer sessions, WebSocket and WebRTC transport | Android container lifecycle, persisted feature values |
| Go WebRTC bridge | One peer connection, SDP/data-channel protocol, PTS-driven H.264/Opus RTP, RTCP feedback | Sessions, ADB, feature decisions                      |
| OCR sidecar      | Image bounds, preprocessing cascade, selected Paddle model, inference capacity           | Automation policy, persisted feature values           |

One display sidecar serves one host. Session state is bounded and intentionally local; do not add a database or distributed session layer without changing the deployment architecture.

## Display session lifecycle

The orchestrator prepares a reachable ADB target and asks the sidecar to create or reuse a session. The sidecar validates capacity, connects ADB, returns a token-scoped viewer URL, and refreshes activity while the viewer streams. Explicit release or expiry removes the session from memory and closes its WebRTC and scrcpy resources. Released and expired sessions never count toward the default 64-session limit.

Virtual surfaces are child sessions. New creation requires a synchronized, enabled `feature.display-virtual` snapshot. Disabling the flag blocks new virtual surfaces and lets existing sessions drain.

## Streaming and controls

- The segmented scrcpy parser emits complete access units without repeatedly
  concatenating its input. Each consumer receives a versioned `RBD1` envelope
  containing media kind, flags, sequence, unsigned source PTS, and payload
  length. H.264 configuration remains distinct from media access units.
- Every consumer owns a three-frame/75 ms video live-edge queue and a 100 ms
  audio queue. Overflow clears queued delta frames and resumes only with cached
  SPS/PPS plus an IDR. Consumer writes never pause the scrcpy source.
- WebSocket: nginx routes the token-scoped connection directly to the sidecar.
  A dedicated browser worker parses H.264 and owns `VideoDecoder`, using a track
  generator or `OffscreenCanvas` ahead of the main-thread Canvas2D fallback.
- WebRTC: the viewer posts an offer; the TypeScript service launches the Go
  bridge and passes `RBD1` video/audio file descriptors. The bridge packetizes
  one access unit at a time, derives the 90 kHz RTP clock from source PTS, and
  continuously drains sender RTCP for reports, NACK, PLI, and transport-wide
  congestion feedback. RTP travels directly between Pion and the browser.
- HTTP, WebSocket, and WebRTC control messages enter the same `DisplayControlService`. It validates the session capability and delegates to scrcpy control, with the existing ADB fallback. Transport envelopes differ, but semantic errors are `invalid_control`, `missing_capability`, `control_reconnecting`, or `execution_failed`.

The public token controllers are separate from shared-secret-protected internal session controllers. Viewer asset serving is separate from both.

## Protected scrcpy boundary

`ScrcpyService` deliberately remains a large lifecycle owner because its awaited
ADB commands, listener registration, socket reads, process launch, retry
classification, and cleanup are order-sensitive. `RBD1` framing and queueing
were added around that lifecycle without reordering it. See
[scrcpy-invariants.md](scrcpy-invariants.md). A real Redroid matrix is mandatory
after edits to protected methods.

## ADB boundary

`AdbService` is the application facade. `AdbCommandRunner` owns process spawning, timeout/cancellation, output quotas, and normalized failures. `adb-input.ts` owns pure keyboard/touch command construction. Do not create a generic process package: the limits and diagnostics are ADB-sidecar policy.

## OCR flow

The orchestrator checks its local `feature.ocr` snapshot and service configuration, then sends one language and bounded options. FastAPI validates media and size before Pillow decoding, resizes to the deployment maximum, acquires bounded inference capacity, and runs a quality-gated raw/grayscale/contrast/threshold cascade. Paddle is isolated behind `OcrRuntime`; readiness stays false until model warmup succeeds.

## Feature flags

Definitions live once in `apps/orchestrator/src/feature-flags`. Runtime intent and revision are persisted inside the serialized orchestrator settings document. Request checks read an immutable in-memory snapshot in O(1); they do not read settings, Docker, HTTP, or a sidecar.

`GET /features` returns desired value, deployment support, mutability, effective state, synchronization state, revision, owner, lifecycle, dependencies/conflicts, and disable policy. `PATCH /features` validates a complete multi-key proposal against an expected revision and atomically publishes it. Unknown, stale, unsupported, read-only, and invalid combinations have stable error codes.

Only cross-process enforcement is synchronized. The display sidecar receives its one owned key and revision through the existing shared-secret boundary. OCR, firewall, and image-building checks remain local to the orchestrator. The protected web shell loads one manifest through the BFF; navigation and page/action boundaries read that snapshot, while server routes/actions check again. Flags never replace permissions, authentication, or health.

Initial disable policies are:

- OCR: block new inference and let in-flight work finish.
- Firewall: block work whose restricted policy cannot be enforced; never remove existing host rules merely because the flag is off.
- Image builder: block new submissions and let running jobs finish; existing images remain readable.
- Virtual display: block new surfaces and drain existing sessions.

## Configuration and secrets

Each process validates deployment configuration at startup. Runtime feature values are not environment variables. The orchestrator owns the shared secret; Compose mounts it into the sidecar. Secrets must not be baked into images, logged, returned by OpenAPI, or placed in viewer assets. The display API fails closed if its secret is absent unless the explicit development override is true.

## Where code belongs

- Display HTTP/token/assets controllers: `apps/display-sidecar/src/modules/display`.
- Session/control/transport application services: the same display module.
- ADB facade, runner, and pure command parsing: `modules/adb`.
- Protected scrcpy protocol lifecycle: `modules/scrcpy`.
- Go peer/protocol/audio/video concerns: `webrtc-bridge`.
- OCR API, preprocessing, and runtime: `apps/ocr-sidecar/ocr_sidecar`.
- Persisted registry and mutation semantics: orchestrator `feature-flags`.
- Shared generated API shapes only: contract packages.

Good first contributions are pure ADB input cases, `RBD1`/Annex-B/Opus parsing
fixtures, OCR cascade/limit tests, and docs. Run the focused display test,
`go test ./...`, or `python3 -m pytest -q` before broader repository checks.
