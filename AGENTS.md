# Repository Instructions

## Local Codex Runtime

- Follow the local Codex shell rule from `/Users/maek/.codex/RTK.md`: prefix shell commands with `rtk`.
- Use Node.js 24 and pnpm through Corepack.
- Run repo-level checks from the root when practical: `pnpm check`.
- For narrower verification, use the owning workspace script first, for example `pnpm --filter rebroid-web test`, `pnpm --filter rebroid-orchestrator typecheck`, or the package-specific `build`, `test`, and `typecheck` scripts.

## High-Level Structure

This is a pnpm/Turbo monorepo. Runtime applications live in `apps/*`; reusable contracts and domain libraries live in `packages/*`.

- `apps/web`: Next.js UI and backend-for-frontend. Browser code lives under `src/app`, `src/features`, `src/components`, `src/hooks`, `src/lib`, and `src/utils`. Server-only code lives under `src/server`. Shared permission/runtime vocabulary that must be used by both client and server belongs under `src/shared`. Reusable UI/layout primitives that are not owned by one feature live under `src/shared/ui`.
- `apps/orchestrator`: NestJS API that owns Android application lifecycle state, Docker operations, scheduled tasks, automations, APK handling, network policy coordination, metrics, settings, and system resources. Preserve the existing top-level module split in `src/*`; improve discoverability by splitting oversized files inside the owning module. Keep controllers, DTOs, services, facades, contracts, policies, mappers, repositories, entities, utils, and modules in the appropriate subfolders used by that domain.
- `apps/display-sidecar`: NestJS sidecar for ADB, scrcpy, WebSocket, and WebRTC display sessions. Server modules live under `src/modules/*`. The embedded viewer client lives under `src/modules/display/viewer`.
- `apps/firewall-agent`: host firewall reconciler. Keep host-network/firewall execution code here. Shared policy calculation belongs in `packages/firewall-policy-core`, not in this app.
- `packages/*`: a deliberately small layer for code used by at least two runtime apps or generated cross-app contracts. Packages may expose explicit public entrypoints through `package.json` `exports` and small entrypoint files.
- `deploy`: Docker Compose files and image transfer scripts.
- `docs`: architecture, operations, and invariant notes. Update docs when behavior or deployment assumptions change.
- `scripts`: repository automation such as OpenAPI client generation.

## Package Placement Rules

Put code in `packages/*` only when it is genuinely reusable across apps or is a generated/shared contract.

- `packages/automation-core`: automation definitions, metadata, condition/control vocabulary, YAML draft contracts, and public AI-text normalization shared by orchestrator and web.
- `packages/android-application-core`: shared Redroid runtime vocabulary and viewer-control contracts used by web, orchestrator, and display sidecar. Keep container-image registry policy in the orchestrator and keep command-line parsing internal to the Redroid runtime entrypoint.
- `packages/firewall-policy-core`: pure firewall policy types, validation, CIDR/access helpers, and chain naming logic shared by the firewall agent and other apps.
- `packages/orchestrator-contracts`: generated, type-only OpenAPI contract for the orchestrator API. Regenerate with `pnpm openapi:generate`; never hand-edit `schema.ts`.
- `packages/display-sidecar-contracts`: generated, type-only OpenAPI contract consumed by the orchestrator. Keep request execution, authentication, retry, timeout, and error translation in the owning app.

AI provider normalization and persistence belong under `apps/orchestrator/src/settings`; provider request helpers are app-local under `apps/orchestrator/src/common`; device-agent policy and harness behavior belong under `apps/orchestrator/src/automations/ai`; provider form/catalog/recommendation and conversation presentation belong to the owning web feature or shared web model. Do not recreate a general AI package unless two applications require a concrete framework-neutral contract.

New handwritten packages require dependencies from at least two runtime applications. Generated contract packages are the only standing exception; `pnpm packages:check` enforces this admission rule.

Do not move runtime integrations, framework adapters, database access, HTTP controllers, React components, or environment parsing into a package unless multiple apps already need them and the code can remain framework-neutral.

## Architecture Rules

- Follow clean architecture boundaries: keep domain logic and pure policy decisions independent from framework, HTTP, database, Docker, filesystem, and process APIs.
- Controllers and route handlers should be thin. They validate/translate input, call application services/actions, and return DTOs.
- Application services orchestrate use cases. Push detailed parsing, mapping, validation, and policy decisions into focused helpers or domain services.
- Repositories/entities own persistence details. Do not leak database-specific assumptions into UI, controllers, or shared packages.
- In the orchestrator, cross-module imports should use the other module's `facades`, `contracts`, or module file when those surfaces exist. Do not import another module's low-level services, controllers, repositories, entities, or random utilities just to bypass its public surface.
- Keep managed GApps patching in `container-images`: one queued patch job at a time, a non-root worker without the Docker socket or secrets, revision-addressed verified package caches, bounded safe extraction, payload APK/XML validation through the public APK inspection port, and final image-label validation. Interrupted running jobs fail instead of resuming.
- Port contracts must be independently declared, capability-focused interfaces. Do not define a port as `Pick<ConcreteService, keyof ConcreteService>` or import a concrete adapter into a `.port.ts` file. Concrete adapters implement the port and remain wired to symbol tokens through `useExisting`.
- Code outside `apps/orchestrator/src/docker` must consume Docker behavior through the tokenized ports in `docker/contracts` and import `DockerModule` for provider wiring. Do not inject concrete Docker implementation services across module boundaries.
- Normal Android application list/get operations read stored state and must not contact Docker. Use the explicit runtime-state reconciliation services or API endpoints when fresh Docker state is required.
- Automations consume Android runtime behavior through the `ANDROID_APPS_AUTOMATION` token and types under `android-apps/contracts`; do not inject `AndroidAppsFacadeService` or import Android lifecycle, viewer, network, state, or persistence implementations directly.
- In `apps/orchestrator/src/docker/sidecar`, keep sidecar orchestration, repair, network, and ADB coordination in `DockerSidecarService`; keep display sidecar image existence/build work in `DockerSidecarImageService`; keep pure parsing helpers in `utils`.
- In `apps/orchestrator/src/android-apps/lifecycle`, keep `AndroidAppsLifecycleService` as the thin request-facing facade, definition/profile/APK commands in `AndroidAppsConfigurationService`, start/stop commands in `AndroidAppsPowerService`, persisted-job startup recovery in `AndroidAppsLifecycleRecoveryService`, and bounded removal retries/cleanup in the removal services. Provision and start share `AndroidAppsRuntimeActivationService`; application/job transitions go through `AndroidAppsLifecycleTransitionService`, with one active job per application and guarded progress/completion.
- In `apps/orchestrator/src/android-apps/runtime`, keep runtime download use-case routing and running-container media-scan orchestration in `RuntimeDownloadFilesService`; keep persistent volume lookup, listing, reads, and writes in `RuntimeDownloadVolumeService`.
- In `apps/orchestrator/src/android-apps/provisioning`, keep provisioning orchestration in `AndroidAppsProvisioningService`, Android boot/remote-access preparation in `AndroidAppsProvisioningAndroidService`, APK install/launch orchestration in `AndroidAppsProvisioningApkService`, and pure APK shell/package-resolution plus Android boot diagnostic helpers under `provisioning/utils`.
- In `apps/orchestrator/src/automations`, keep `AutomationsModule` as the composition root for internal commands, events, AI/vision, execution, definition, and scheduling modules, and keep `AutomationsService` as the controller-facing facade. Keep enqueue/cancel/dispatch/abort-controller ownership in `AutomationRunnerService`; keep target preparation, step execution, guarded terminalization, metrics, and cleanup in `AutomationRunExecutionService`. Keep the snapshot-grounded deadline/action loop in `AutomationAiHarnessService`, provider controller/planner calls in `AutomationAiDecisionService`, grounded action validation/execution in `AutomationAiActionExecutor`, and provider streaming normalization in `AutomationAiChatClientService`. Keep vision capture, provider description, OCR adapters, set-of-marks rendering, and deterministic evidence fusion separate behind `AutomationVisionService`.
- Device-decision compatibility normalization may repair known provider envelopes, naming aliases, and omitted descriptive boilerplate, but it must not invent grounding. Mutating actions remain bound to the current snapshot, and taps require an observed candidate ID or normalized coordinates before execution.
- AI controller turns expose one `DeviceDecision` schema or one fallback decision tool, never the full automation command registry. Bind actions to the latest snapshot and target fingerprint, observe after screen changes, and require known evidence IDs for successful completion.
- Raw `android.adbShell` is never a default AI capability. AI escalation requires an explicit allowlisted policy and a validated read-only `{program,args}` command; human-authored automation commands remain separately permission checked.
- A chat approval for AI shell escalation creates a new one-run follow-up with `rawShellPolicy: allowlisted`; the web server action must verify `automations:run-adb-shell`, keep `android.adbShell` hidden from routed capabilities, and never turn approval into a persistent provider or conversation setting.
- Automation targets are reserved by the queued row before preparation. All status updates must use guarded expected-status transitions; never save a stale run entity or overwrite a terminal status. Startup recovery fails queued/running rows instead of resuming them.
- Automation event sequence allocation and insertion must remain one transaction backed by the unique `(runId, sequence)` index. WebSocket listeners must be registered before replay queries and must buffer, deduplicate, and clean up live delivery during replay.
- In `apps/orchestrator/src/settings`, keep generic settings facade methods in `SettingsService`, persistence/default normalization in `OrchestratorSettingsStore`, AI-provider CRUD/execution lookup in `AiProviderSettingsService`, provider connectivity checks in `AiProviderHealthService`, and provider model downloads in `AiProviderModelDownloadService`.
- Keep AI transport protocol (`openai-chat-completions` or native Ollama) separate from detected server flavor. Probe Lemonade before Ollama compatibility endpoints and preserve exact model IDs returned by the selected transport.
- Browser UI must not call the orchestrator directly. It should go through the Next.js backend-for-frontend in `apps/web/src/server/orchestrator`.
- Web client modules must not import server-owned types. Browser/server DTOs belong in `apps/web/src/shared/contracts`; the only allowed runtime import from `apps/web/src/server` is a module whose first directive is `'use server'`, used to invoke a Server Action.
- Cross-cutting web reads should use validated `/api/bff/*` handlers backed by focused server query services. Feature-owned mutations may use Server Actions, but both transports must return the shared operation result with a request ID and stable error code.
- Web persistence has no migration or legacy compatibility path. Schema changes assume a clean deployment and use `pnpm reset:all-state -- --execute`; preserve external environment files and bind-mounted secrets.
- The orchestrator owns Android application lifecycle state. The display sidecar owns viewer session state. The firewall agent owns host firewall reconciliation.
- The orchestrator `feature-flags` module owns the typed registry, persisted runtime intent, revision, and immutable hot-path snapshot. Sidecars receive only their owned effective subset through authenticated synchronization and never persist platform feature values. Gate coarse use-case boundaries; feature flags do not replace permissions, health, or authentication.
- `feature.ocr`, `feature.firewall`, and `feature.image-builder` are enforced locally by the orchestrator. `feature.display-virtual` is synchronized to the display sidecar and must fail closed for new virtual surfaces when state is absent, stale, or disabled.
- OCR uses one deployment language through `OCR_LANGUAGE` and one request/response `language` value. Keep image validation, the quality-gated preprocessing cascade, and Paddle runtime ownership separated under `apps/ocr-sidecar/ocr_sidecar`.
- Display recording has been removed. Do not reintroduce recording routes, state, generated contracts, or viewer controls without a new bounded-storage and lifecycle design.
- Treat display sidecar scrcpy/server/socket startup ordering as a protected invariant. Do not reorder awaited ADB commands, socket listener registration, socket reads, process launch, retry, or cleanup without a dedicated manual Redroid verification pass. Refactoring without that pass is limited to pure SPS parsing, compatibility-probe parsing, retry classification, and stream-option selection.
- Respect existing dependency-boundary checks in `.dependency-cruiser.cjs`; do not introduce circular dependencies.

## File Organization

- Split large files into smaller files when a file mixes responsibilities or becomes hard to scan. Use the local folder conventions before inventing new ones.
- Put DTOs in `dto`, controllers in `controllers`, services in `services`, repositories/persistence code in `persistence` or existing repository folders, entities in `entities`, pure helpers in `utils`, event code in `events`, scheduler code in `scheduler`, and framework modules in `*.module.ts`.
- In `apps/web`, keep feature UI under `src/features/<feature>`, reusable primitives under `src/components` or `src/shared/ui`, server actions/clients under `src/server`, route files under `src/app`, and app-agnostic client/server vocabulary under `src/shared`.
- New or migrated feature pages should use `src/features/<feature>/pages/<page>/page-entry.tsx` as the route entry component. Put server loaders in `page-data.server.ts`, client boundaries in `page-client.tsx`, composed sections in `sections`, leaf UI in `ui`, page/domain state in `model`, and local hooks in `hooks`.
- Co-locate focused tests with the code they verify using the existing `*.spec.ts` or `*.spec.tsx` patterns.
- Avoid dumping new code into broad catch-all files such as `utils.ts`, `types.ts`, or `service.ts` when a narrower subfolder/file name would describe the responsibility better.

## Exports and Imports

- Do not add barrel files or broad re-export files in apps.
- Do not re-export symbols just to shorten imports. Import from the owning file directly inside app code.
- Packages are the exception: they may use explicit, small public entrypoints and `package.json` `exports` to define their API. Keep package entrypoints intentional and stable.
- Prefer existing workspace package imports like `@rebroid/automation-core/...` when consuming shared package APIs.

## TypeScript and Style

- Keep TypeScript strict and explicit at module boundaries. Prefer precise types over `any`; validate untrusted runtime data with existing validation patterns.
- Do not nest ternary operators. Use clear `if`, local variables, or small helper functions.
- Avoid large functions/classes. Extract helpers when it improves naming, testability, or separation of concerns.
- Prefer immutable data transformations and pure helpers for domain rules.
- Keep comments sparse and useful. Explain non-obvious constraints, security decisions, or protocol ordering; do not narrate simple code.
- Match existing formatting. Do not introduce unrelated formatting churn.
- Follow `docs/web-design-system.md` for web UI work. Feature code must use semantic tokens, documented page families,
  shared surfaces, `FormField`, and shared feedback components instead of feature-local visual recipes.
- Web UI changes do not retain deprecated design-system variants or token aliases; migrate all consumers and remove the
  old API in the same change.
- Web loading states must be implemented by the component that owns the ready-state geometry. Reuse the actual page
  shell, responsive layout, `Section`, `DataGrid` column definitions, table markup, and scroll container; do not copy
  widths or layout class strings into route loaders. Keep `loading.tsx` files as thin feature entrypoints, render known
  page chrome immediately, and describe cell placeholders through the owning grid column metadata.
- Compose every interactive `DataGrid` through the shared `DataGridWorkspace`. Use its filter sidebar/drawer only for
  page-level datasets with meaningful structured facets; embedded related-resource grids and small fixed datasets use
  its search-only mode. Keep enabled filter chrome real during loading, and keep feature-specific filter controls and
  validated state in the owning feature. Do not add separate search buttons, filter popovers, or column-header
  filtering.

## Security and Performance

- Consider security implications for every change touching auth, permissions, secrets, uploads, filesystem paths, network access, Docker/container operations, ADB/scrcpy control, firewall rules, database queries, server actions, or generated contracts.
- Never trust browser input, uploaded files, container names, image names, host paths, URLs, or network policy values without validation and normalization.
- Do not expose secrets in logs, errors, OpenAPI responses, client bundles, or generated artifacts.
- Preserve authorization checks in web server actions before calling orchestrator operations that expose backend details or change runtime behavior.
- Use `getCurrentUser()` for authenticated web operations so auth epoch, session version, disabled state, and required password changes are enforced. Only the protected routing shell and forced-password-change completion flow may use `getAuthenticatedUser()`.
- Automation command permissions fail closed: reject unknown required permissions and revalidate stored definitions, targets, and profile permissions when triggers are updated or run.
- Keep TOTP secrets encrypted with `MFA_ENCRYPTION_KEY`, store only hashed recovery codes, and invalidate sessions when MFA state changes.
- Be cautious with privileged host/container operations. Prefer allowlists, bounded inputs, explicit timeouts, and safe defaults.
- Consider performance costs before adding polling, broad scans, synchronous filesystem work, large bundle dependencies, unbounded concurrency, or repeated Docker/API/database calls.
- For long-running or concurrent work, use bounded concurrency, cancellation/timeout-aware APIs where available, and clear error handling.

## API Contracts and Generated Code

- When the orchestrator API changes, update DTOs/controllers first, then run `pnpm openapi:generate` and include generated contract/schema changes.
- Keep generated contract packages type-only. Put runtime HTTP clients, feature-specific mapping, and UI behavior in the consuming app.
- Add or update contract tests when changing OpenAPI-visible behavior.

## Verification Expectations

- Run the smallest meaningful checks for the changed area, then broader checks when touching shared packages, API contracts, or cross-app behavior.
- For the approved pre-release state reset, use `pnpm reset:orchestrator-state` as a dry run and add `-- --execute` only after stopping the orchestrator. This targeted reset preserves web data, shared secrets, and orchestrator settings.
- Use `pnpm check` before finishing large or cross-cutting work when time permits.
- If you cannot run a relevant check, state exactly what was not run and why.
- Review AGENTS.md file and update it if the change affects any agent's behavior, capabilities, or assumptions.
