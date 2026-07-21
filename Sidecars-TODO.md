# Sidecar Simplification and Open-Source Readiness

This checklist tracks the display, ADB, WebRTC bridge, and OCR sidecar cleanup. The target architecture remains one stateful display sidecar per host: the display sidecar owns ADB, scrcpy, viewer sessions, and display transport state; the orchestrator owns container and network orchestration; and OCR remains an advisory vision service.

The goal is to reduce duplicated contracts and control paths, bound singleton state, remove unused features, and make the sidecar code understandable to a new contributor without destabilizing the protected display startup sequence.

Status re-audited on 2026-07-17: this remains a future implementation plan. The completed contract-package rename and
orchestrator type-consumer coordination are marked below, but recording removal, bounded sessions/OCR, control-path
unification, source-rewrite removal, and the manual Redroid matrix are still open. No completion boxes were inferred
from the package or orchestrator cleanup.

## Scope and decisions

- [ ] Keep one display sidecar per host; do not add horizontal scaling or shared session state in this pass.
- [ ] Preserve user-visible viewer, control, ADB fallback, audio, reconnect, and cleanup behavior.
- [ ] Allow coordinated internal API breaks before open source when they remove duplication or misleading contracts.
- [ ] Remove display recording completely across the sidecar, orchestrator, generated APIs, web, and automation surfaces.
- [ ] Keep virtual displays as an experimental feature, disabled by default.
- [ ] Standardize OCR on one primary language/model per deployment.
- [ ] Use a quality-gated OCR preprocessing cascade rather than running every preprocessing mode unconditionally.
- [ ] Freeze scrcpy lifecycle decomposition in this pass.
- [ ] Do not reorder awaited ADB commands, socket listener registration, socket reads, process launch, retry, or cleanup in `ScrcpyService`.
- [ ] Require a dedicated manual Redroid verification pass for any unavoidable edit touching protected scrcpy startup or cleanup behavior.
- [ ] Keep sidecar CI integration and root check wiring out of this pass; document the required commands instead.
- [ ] Keep the repository unlicensed until a license is chosen; treat this as a blocker for public release.
- [ ] Update `AGENTS.md` when ownership, contracts, feature flags, or protected invariants change.

## Audit baseline

The initial review found:

- Approximately 11,688 TypeScript/Go lines across 72 tracked display-sidecar files, plus roughly 5,060 relevant orchestrator viewer, Docker-sidecar, and vision lines.
- `ScrcpyService` is the main hotspot at approximately 1,960 lines, 148 functions, and very high measured complexity. Its order-sensitive lifecycle is intentionally protected.
- `AdbService` is approximately 861 lines and contains a reusable command-runner concern plus input/UI parsing that can be separated without changing device behavior.
- The embedded viewer's `webrtc-stream.ts` and `h264-mp4-recorder.ts` are approximately 640 and 595 lines respectively.
- The Go WebRTC bridge is approximately 556 lines and mixes peer, signaling/protocol, Annex-B video, and Opus audio concerns.
- OCR is a single approximately 343-line FastAPI module with no focused tests.
- Repository-wide static duplication was approximately 5.31%, with relevant duplication concentrated in control payloads, control routing, raw sidecar HTTP clients, and local scrcpy/ADB helpers.
- No circular dependencies or dependency-boundary violations were found.
- Display sessions can remain in memory after release/expiry, and recording buffers completed media in memory without a quota or expiry.
- The generated display-sidecar contract exists, but orchestrator integrations still duplicate request/response interfaces and raw-fetch behavior.
- Display configuration is registered in multiple Nest modules and several services read environment variables directly.
- OCR accepts multiple languages but uses only the first, eagerly runs every preprocessing mode, has no inference concurrency bound, and reports healthy before the selected model is initialized.
- Display documentation contains package-manager, Docker-build, and authentication-behavior drift.
- OCR Python and the Go bridge sit outside the normal root TypeScript quality gate.
- Baseline verification passed:
  - [x] Display sidecar tests: 27 tests.
  - [x] Focused orchestrator viewer, Docker-sidecar, OCR, and vision tests: 6 suites / 13 tests.
  - [x] Go WebRTC bridge tests: 6 tests.
  - [x] OpenAPI drift check.
  - [x] Dependency-boundary checks.

### Baseline tasks

- [ ] Record the implementation commit and working-tree state before starting cleanup.
- [ ] Save current display, orchestrator, web, OCR, Go, OpenAPI, boundary, dead-code, duplication, and build results.
- [ ] Add characterization tests before changing control routing, session lifetime, OCR behavior, or bridge protocol handling.
- [ ] Break implementation into independently reviewable pull requests aligned with the phases below.
- [ ] Keep unrelated user changes out of each refactoring diff.

## Phase 1 — Remove recording and bound display state

### Remove display recording end to end

- [ ] Remove the H.264-to-MP4 recorder and its viewer integration.
- [ ] Remove recording state, commands, events, routes, DTOs, and response types from the display sidecar.
- [ ] Remove recording hooks from `ScrcpyService` surgically without changing startup, socket, retry, or cleanup order.
- [ ] Remove orchestrator recording APIs, adapters, automation ports, and automation commands.
- [ ] Remove web recording actions, controls, status, download handling, and UI copy.
- [ ] Remove recording fields and operations from both OpenAPI contracts and regenerate generated artifacts.
- [ ] Remove recording configuration, documentation, tests, and unused dependencies.
- [ ] Search the repository and confirm that every recording surface has been removed.

### Bound viewer session ownership

- [ ] Add `DISPLAY_SESSION_MAX_ACTIVE` with a default of `64`.
- [ ] Count only live sessions toward the limit.
- [ ] Purge expired and released sessions from the in-memory session map.
- [ ] Return HTTP 429 with a stable error code when the active-session limit is reached.
- [ ] Make session-list responses expose live sessions only.
- [ ] Preserve valid session reuse and token behavior.
- [ ] Add tests for reuse, expiry, explicit release, automatic purge, and capacity exhaustion.

### Gate virtual displays

- [ ] Add `DISPLAY_EXPERIMENTAL_VIRTUAL_DISPLAYS=false`.
- [ ] Reject virtual-display creation with HTTP 409 and a stable disabled-feature error while the flag is off.
- [ ] Expose the feature state through the display capability/session contract.
- [ ] Hide or disable virtual-display UI when the feature is unavailable.
- [ ] Preserve existing virtual-display behavior when the flag is enabled.
- [ ] Remove legacy capability aliases such as `stream` and `input`; keep one canonical capability vocabulary.
- [ ] Add flag-off and flag-on tests.

## Phase 2 — Unify display contracts and control routing

### Generated display-sidecar contract

- [x] Choose generated types only for `@rebroid/display-sidecar-contracts`; runtime HTTP behavior stays with the orchestrator.
- [ ] Make every orchestrator display and ADB adapter consume the generated display-sidecar contract instead of handwritten response interfaces.
- [x] Keep timeout, authentication, retry, and error translation in the focused orchestrator `DockerSidecarApiService` HTTP adapter.
- [x] Remove `createSidecarClient` and its unused `openapi-fetch` dependency instead of retaining a runtime client.
- [x] Preserve orchestrator-owned readiness retry and domain-error translation.
- [ ] Remove duplicate display session, ADB, readiness, and error response interfaces after all consumers migrate.
- [ ] Add injected-fetch tests for authentication, timeout, malformed responses, non-2xx responses, and error mapping.
- [x] Move both committed OpenAPI artifacts and generation paths to the renamed contract packages without schema drift.
- [x] Run the OpenAPI drift check after the package-contract phase.

### Canonical control application service

- [ ] Add one `DisplayControlService` as the application boundary for control actions.
- [ ] Define one discriminated request contract for action, keyboard, touch, and clipboard control.
- [ ] Define one canonical keyboard payload type.
- [ ] Define one canonical touch payload type.
- [ ] Make HTTP, WebSocket, and WebRTC transports validate and delegate to the same service.
- [ ] Remove duplicated control routing and ADB/scrcpy fallback decisions from controllers, gateways, and transport services.
- [ ] Standardize transport-independent error codes:
  - [ ] `invalid_control`.
  - [ ] `missing_capability`.
  - [ ] `control_reconnecting`.
  - [ ] `execution_failed`.
- [ ] Preserve protocol-appropriate HTTP, WebSocket, and WebRTC envelopes while keeping the underlying result semantics identical.
- [ ] Add table-driven parity tests that run the same control scenarios through all three transports.

### Thin HTTP controllers

- [ ] Split the current display controller into focused viewer-assets, protected-session, and public-token controllers.
- [ ] Keep controllers limited to validation, authentication/authorization context, delegation, and response mapping.
- [ ] Keep public token routes visibly separate from shared-secret-protected internal routes.
- [ ] Preserve fail-closed internal authentication behavior.
- [ ] Confirm secret values never appear in logs, errors, OpenAPI responses, or viewer assets.

## Phase 3 — Reduce internal display-sidecar bloat

### Configuration and Nest composition

- [ ] Create one shared display-sidecar Nest module for the canonical configuration and internal-auth providers.
- [ ] Define one Zod environment schema for display, ADB, scrcpy, viewer, session-capacity, authentication, and experimental-feature settings.
- [ ] Remove repeated configuration registration from `AppModule`, `AdbModule`, `DisplayModule`, and `ScrcpyModule`.
- [ ] Remove direct environment reads from `ScrcpyService`, `AdbService`, compatibility probes, guards, and controllers.
- [ ] Inject typed configuration at owning boundaries.
- [ ] Keep secrets redacted from validation and startup errors.
- [ ] Add configuration tests for defaults, invalid values, authentication fail-closed behavior, and experimental flags.

### ADB service decomposition

- [ ] Keep `AdbService` as the stable ADB application facade.
- [ ] Extract a bounded ADB command runner responsible for argument execution, timeouts, output limits, cancellation, and normalized failures.
- [ ] Extract pure input parsing and command construction.
- [ ] Extract pure UI hierarchy parsing where behavior is currently mixed into the facade.
- [ ] Preserve explicit allowlists and input bounds for shell/control operations.
- [ ] Add command-runner tests for timeout, oversized output, process failure, cancellation, and sanitized diagnostics.
- [ ] Add table-driven parser and command-construction tests.
- [ ] Avoid a generic process utility package; keep ADB execution owned by the display sidecar.

### Embedded viewer build

- [ ] Use explicit `.js` import specifiers in viewer TypeScript source.
- [ ] Remove the post-build import-rewrite script after every viewer module builds and loads correctly.
- [ ] Consolidate asset cleaning and copying into one small, documented build step.
- [ ] Remove obsolete build scripts and dependencies.
- [ ] Keep the existing WebRTC and WebSocket viewer state machines intact in this pass.
- [ ] Verify a clean viewer build and browser load without source-rewrite output drift.

### Scrcpy protected area

- [ ] Do not extract the scrcpy lifecycle or split order-sensitive methods in this pass.
- [ ] Limit `ScrcpyService` edits to recording deletion and typed configuration plumbing.
- [ ] Keep `docs/scrcpy-invariants.md` current and explicit about protected ordering.
- [ ] Add comments only where they explain an actual ordering or protocol invariant.
- [ ] Record every touched protected method in the pull-request verification notes.
- [ ] Run the manual Redroid matrix before merging any change that touches a protected method.

## Phase 4 — Clarify the Go WebRTC bridge

- [ ] Split the bridge entrypoint into focused peer/session, signaling/protocol, Annex-B video, and Opus audio files.
- [ ] Keep one small composition entrypoint responsible for startup and shutdown.
- [ ] Preserve current wire protocol, codec negotiation, packet ordering, and shutdown behavior.
- [ ] Replace narrational comments with concise protocol or ordering invariants.
- [ ] Keep malformed-input handling bounded and fail closed.
- [ ] Add or extend tests for Annex-B boundaries, malformed NAL units, Opus framing, protocol messages, peer cleanup, and process shutdown.
- [ ] Run `go test ./...` after each bridge extraction.
- [ ] Do not introduce a shared abstraction between the Go bridge and TypeScript viewer solely because they implement adjacent protocol layers.

## Phase 5 — Make OCR bounded and honest

### Module ownership and contracts

- [ ] Split the OCR service into a small FastAPI composition/API module, a pure image preprocessing pipeline, and a Paddle runtime adapter.
- [ ] Keep framework, image, and inference concerns independently testable.
- [ ] Replace `OCR_LANGUAGES` with one `OCR_LANGUAGE` deployment setting.
- [ ] Replace request and response `languages` arrays with one `language` value.
- [ ] Update orchestrator settings, DTOs, health reporting, automation vision events, web forms, documentation, and tests in the same change.
- [ ] Reject unsupported language/model values during startup or request validation.

### Quality-gated preprocessing cascade

- [ ] Run the raw image first.
- [ ] Stop when quality reaches `max(0.65, minConfidence)`.
- [ ] Attempt grayscale, contrast, and threshold fallbacks only while quality remains below the target.
- [ ] Return the best attempted result when no pass reaches the quality target.
- [ ] Deduplicate equivalent OCR detections across passes.
- [ ] Report which preprocessing pass produced the selected result without leaking internal paths or model details.
- [ ] Add deterministic tests for early success, fallback ordering, best-result selection, deduplication, and minimum-confidence bounds.

### Resource limits and readiness

- [ ] Allow one concurrent Paddle inference by default through a bounded semaphore or queue.
- [ ] Return HTTP 429 with `ocr_busy` when capacity is saturated rather than allowing unbounded concurrent inference.
- [ ] Validate request media type before decoding.
- [ ] Bound encoded request size, decoded byte size, pixel count, dimensions, preprocessing modes, and numeric options.
- [ ] Defend against decompression bombs and malformed image payloads.
- [ ] Initialize and warm the selected OCR model during startup.
- [ ] Return readiness 503 until initialization and warmup succeed.
- [ ] Keep liveness separate from model readiness.
- [ ] Sanitize Paddle and image-library failures before returning or logging them.
- [ ] Add tests for busy behavior, warmup failure, readiness transitions, oversized input, pixel limits, malformed images, invalid options, and sanitized errors.

### Python development experience

- [ ] Separate lightweight test/lint dependencies from heavyweight Paddle runtime dependencies.
- [ ] Pin runtime and test dependency versions deterministically.
- [ ] Add focused unit tests that do not require downloading or initializing Paddle.
- [ ] Add a smaller opt-in integration test for the real selected model.
- [ ] Document exact local test, integration-test, and container-build commands.

## Phase 6 — Open-source and contributor cleanup

### Documentation

- [ ] Rewrite the display-sidecar README around Node.js 24, Corepack, and pnpm.
- [ ] Correct Docker build context and Compose instructions.
- [ ] Document that internal APIs fail closed unless `DISPLAY_SIDECAR_ALLOW_UNAUTHENTICATED_INTERNAL_API=true` is explicitly enabled for development.
- [ ] Document the one-sidecar-per-host ownership model and active-session capacity.
- [ ] Document the virtual-display feature flag and experimental support status.
- [ ] Document supported Redroid assumptions, ADB/scrcpy ownership, WebRTC bridge responsibilities, and `linux/amd64` constraints.
- [ ] Add the manual Redroid verification matrix and expected evidence.
- [ ] Expand the OCR README with language selection, warmup/readiness, resource limits, cascade behavior, and development commands.
- [ ] Add `docs/sidecar-architecture.md` containing:
  - [ ] Process and ownership map.
  - [ ] Display session lifecycle.
  - [ ] HTTP, WebSocket, and WebRTC control flow.
  - [ ] Scrcpy protected-order boundary.
  - [ ] ADB fallback flow.
  - [ ] OCR request and preprocessing flow.
  - [ ] Configuration and secret flow.
  - [ ] Code-placement guide.
  - [ ] First-contribution paths with focused verification commands.
- [ ] Update `AGENTS.md` for removed recording, singular OCR language, unified display contract use, and the virtual-display flag.

### Container and supply-chain hygiene

- [ ] Pin downloaded scrcpy artifacts to an exact version and verified checksum.
- [ ] Document the provenance of downloaded binaries and model/runtime dependencies.
- [ ] Add required third-party notices for bundled or downloaded components.
- [ ] Review display and OCR images for unnecessary build tools, caches, and runtime packages.
- [ ] Keep image optimization and stage separation behavior-preserving.
- [ ] Document why the display image currently requires its platform and privilege model.
- [ ] Treat a non-root display runtime as a coordinated follow-up because shared-secret file permissions and host/device access cross service boundaries.
- [ ] Confirm secrets are mounted rather than copied into image layers.

### Publication gates

- [ ] Choose and add a root open-source license before publication.
- [ ] Remove or update package-level `UNLICENSED` metadata only after the license decision.
- [ ] Complete repository-level governance documentation before publication.
  - [x] Add contributor and private security-reporting documentation.
  - [ ] Add conduct and support documentation after their enforcement and support paths are chosen.
- [ ] Confirm generated artifacts and third-party notices are compatible with the selected license.
- [ ] Do not publish the repository while the license remains unresolved.
- [ ] Do not add GitHub Actions or root OCR/Go check integration in this pass; keep required commands documented for a later CI pass.

## Verification and acceptance matrix

### Automated checks

- [ ] Display control characterization tests pass for HTTP, WebSocket, and WebRTC.
- [ ] Control tests cover valid action, keyboard, touch, clipboard, missing capability, reconnecting control, invalid input, transport failure, and execution failure.
- [ ] Session tests cover reuse, expiry, release, purge, capacity, and virtual-display flag states.
- [ ] Generated-contract/HTTP-adapter tests cover authentication, injected fetch, timeouts, retries, runtime validation, and stable error mapping.
- [ ] ADB tests cover command bounds, timeout, cancellation, parsing, and sanitized errors.
- [ ] OCR tests cover language validation, limits, cascade order, quality gating, best fallback, deduplication, busy behavior, warmup, readiness, and sanitized failures.
- [ ] Go tests cover protocol messages, Annex-B parsing, malformed input, Opus framing, peer cleanup, and shutdown.
- [ ] Repository search confirms all recording routes, commands, state, UI, OpenAPI operations, and dependencies are gone.
- [ ] `pnpm --filter @rebroid/display-sidecar test` passes.
- [ ] Display-sidecar typecheck, lint, and build pass.
- [ ] `go test ./...` passes in the WebRTC bridge.
- [ ] OCR unit tests pass without Paddle runtime initialization.
- [ ] OCR model integration test passes in the runtime image or documented integration environment.
- [ ] Focused orchestrator display, Docker-sidecar, OCR, automation-vision, and contract tests pass.
- [ ] Focused web viewer/settings tests and build pass.
- [ ] `pnpm openapi:check` passes.
- [ ] `pnpm boundaries` passes with no new cycles or violations.
- [ ] Dead-code and duplication analysis is rerun and relevant results are recorded.
- [ ] Full `pnpm check` passes after the cross-application changes.

### Manual Redroid verification

Required because removing recording and plumbing configuration touches `ScrcpyService`, even though lifecycle ordering must remain unchanged.

- [ ] Start a physical-display viewer through WebRTC.
- [ ] Start a viewer through the WebSocket fallback path.
- [ ] Verify video with audio enabled.
- [ ] Verify video with audio disabled.
- [ ] Verify touch, keyboard, action, and clipboard controls.
- [ ] Verify normal scrcpy control and ADB control fallback.
- [ ] Verify direct connection and direct-to-forward fallback.
- [ ] Verify disconnect, retry, reconnect, and final cleanup.
- [ ] Verify repeated session create/release does not leak sessions, ports, processes, or sockets.
- [ ] Verify virtual-display requests fail predictably while the flag is off.
- [ ] Enable the virtual-display flag and verify existing virtual-display behavior.
- [ ] Record environment, image versions, commands, logs, and observed results in the pull request.

## Completion criteria

- [ ] Recording is absent from runtime code, contracts, generated clients, automation commands, and UI.
- [ ] Display session memory and OCR inference concurrency are explicitly bounded.
- [ ] HTTP, WebSocket, and WebRTC controls share one application service and one semantic result model.
- [ ] Orchestrator display integrations no longer maintain handwritten copies of generated sidecar contracts.
- [ ] Display configuration has one validated source of truth.
- [ ] ADB execution and parsing are testable without expanding the scrcpy protected surface.
- [ ] The Go bridge and OCR service have clear, focused module boundaries.
- [ ] The embedded viewer no longer relies on a source-rewrite build step.
- [ ] Sidecar architecture, development, deployment, authentication, platform, and manual verification assumptions are documented.
- [ ] Automated checks and the manual Redroid matrix pass.
- [ ] No protected scrcpy startup, socket, retry, or cleanup ordering was changed.
- [ ] Public release remains blocked until a compatible license and repository governance files are added.

## Coordination note — orchestrator cleanup (2026-07-16)

- Canonical viewer transport/control vocabulary now comes from `@rebroid/android-application-core/viewer-control`; preserve
  that contract when the sidecar pass unifies generated display contracts.
- `DockerSidecarApiService` now derives display session/list response shapes from
  `@rebroid/display-sidecar-contracts`. The broader adapter/controller contract consolidation in Phase 2 remains open.
- The generated sidecar contract is now type-only: its unused runtime client factory and `openapi-fetch` dependency
  were removed. Runtime validation, authentication, timeout, retry, and stable error mapping remain app-adapter
  responsibilities for the broader sidecar pass.
- This orchestrator pass did not change display-sidecar code or protected scrcpy/server/socket startup, retry, or
  cleanup ordering. The manual Redroid matrix remains required only when the sidecar pass touches those paths.
- The package pass normalized formatting in the two tracked scrcpy session-registry files without changing behavior.
  The full root `pnpm check` is green; the sidecar completion matrix remains open until its planned runtime changes and
  manual Redroid verification are complete.
