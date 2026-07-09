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
- `packages/*`: reusable, app-agnostic code. Packages may expose explicit public entrypoints through `package.json` `exports` and small entrypoint files.
- `deploy`: Docker Compose files and image transfer scripts.
- `docs`: architecture, operations, and invariant notes. Update docs when behavior or deployment assumptions change.
- `scripts`: repository automation such as OpenAPI client generation.

## Package Placement Rules

Put code in `packages/*` only when it is genuinely reusable across apps or is a generated/shared contract.

- `packages/ai-core`: provider configuration, model metadata, AI harness helpers, and shared AI domain types. Do not put app-specific UI state, Nest providers, or Next server actions here.
- `packages/automation-core`: automation definitions, metadata, condition/control vocabulary, and pure helpers shared by orchestrator and web.
- `packages/firewall-policy-core`: pure firewall policy types, validation, CIDR/access helpers, and chain naming logic shared by the firewall agent and other apps.
- `packages/orchestrator-client`: generated OpenAPI client/schema for the orchestrator API. Regenerate with `pnpm openapi:generate`; do not hand-edit generated schema drift unless the generator is broken.
- `packages/sidecar-client`: generated OpenAPI client/schema for the display sidecar API. Keep it contract-focused.

Do not move runtime integrations, framework adapters, database access, HTTP controllers, React components, or environment parsing into a package unless multiple apps already need them and the code can remain framework-neutral.

## Architecture Rules

- Follow clean architecture boundaries: keep domain logic and pure policy decisions independent from framework, HTTP, database, Docker, filesystem, and process APIs.
- Controllers and route handlers should be thin. They validate/translate input, call application services/actions, and return DTOs.
- Application services orchestrate use cases. Push detailed parsing, mapping, validation, and policy decisions into focused helpers or domain services.
- Repositories/entities own persistence details. Do not leak database-specific assumptions into UI, controllers, or shared packages.
- In the orchestrator, cross-module imports should use the other module's `facades`, `contracts`, or module file when those surfaces exist. Do not import another module's low-level services, controllers, repositories, entities, or random utilities just to bypass its public surface.
- Port contracts must be independently declared, capability-focused interfaces. Do not define a port as `Pick<ConcreteService, keyof ConcreteService>` or import a concrete adapter into a `.port.ts` file. Concrete adapters implement the port and remain wired to symbol tokens through `useExisting`.
- Code outside `apps/orchestrator/src/docker` must consume Docker behavior through the tokenized ports in `docker/contracts` and import `DockerModule` for provider wiring. Do not inject concrete Docker implementation services across module boundaries.
- Normal Android application list/get operations read stored state and must not contact Docker. Use the explicit runtime-state reconciliation services or API endpoints when fresh Docker state is required.
- Automations consume Android runtime behavior through the `ANDROID_APPS_AUTOMATION` token and types under `android-apps/contracts`; do not inject `AndroidAppsFacadeService` or import Android lifecycle, viewer, network, state, or persistence implementations directly.
- In `apps/orchestrator/src/docker/sidecar`, keep sidecar orchestration, repair, network, and ADB coordination in `DockerSidecarService`; keep display sidecar image existence/build work in `DockerSidecarImageService`; keep pure parsing helpers in `utils`.
- In `apps/orchestrator/src/android-apps/lifecycle`, keep request-facing lifecycle operations in `AndroidAppsLifecycleService`; keep the long background container start/image/network/readiness/APK launch sequence in `AndroidAppsStartLifecycleService`.
- In `apps/orchestrator/src/android-apps/runtime`, keep runtime download use-case routing and running-container media-scan orchestration in `RuntimeDownloadFilesService`; keep persistent volume lookup, listing, reads, and writes in `RuntimeDownloadVolumeService`.
- In `apps/orchestrator/src/android-apps/provisioning`, keep provisioning orchestration in `AndroidAppsProvisioningService`, Android boot/remote-access preparation in `AndroidAppsProvisioningAndroidService`, APK install/launch orchestration in `AndroidAppsProvisioningApkService`, and pure APK shell/package-resolution plus Android boot diagnostic helpers under `provisioning/utils`.
- In `apps/orchestrator/src/automations`, keep `AutomationsModule` as the composition root for internal commands, events, AI/vision, execution, definition, and scheduling modules, and keep `AutomationsService` as the controller-facing facade. Keep enqueue/cancel/dispatch/abort-controller ownership in `AutomationRunnerService`; keep target preparation, step execution, guarded terminalization, metrics, and cleanup in `AutomationRunExecutionService`. Keep the planner loop in `AutomationAiHarnessService` and provider streaming in `AutomationAiChatClientService`. Keep vision capture, provider description, and evidence fusion separate behind `AutomationVisionService`.
- Automation targets are reserved by the queued row before preparation. All status updates must use guarded expected-status transitions; never save a stale run entity or overwrite a terminal status. Startup recovery fails queued/running rows instead of resuming them.
- Automation event sequence allocation and insertion must remain one transaction backed by the unique `(runId, sequence)` index. WebSocket listeners must be registered before replay queries and must buffer, deduplicate, and clean up live delivery during replay.
- In `apps/orchestrator/src/settings`, keep generic settings facade methods in `SettingsService`, persistence/default normalization in `OrchestratorSettingsStore`, AI-provider CRUD/execution lookup in `AiProviderSettingsService`, provider connectivity checks in `AiProviderHealthService`, and provider model downloads in `AiProviderModelDownloadService`.
- Browser UI must not call the orchestrator directly. It should go through the Next.js backend-for-frontend in `apps/web/src/server/orchestrator`.
- The orchestrator owns Android application lifecycle state. The display sidecar owns viewer session state. The firewall agent owns host firewall reconciliation.
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

## Security and Performance

- Consider security implications for every change touching auth, permissions, secrets, uploads, filesystem paths, network access, Docker/container operations, ADB/scrcpy control, firewall rules, database queries, server actions, or generated clients.
- Never trust browser input, uploaded files, container names, image names, host paths, URLs, or network policy values without validation and normalization.
- Do not expose secrets in logs, errors, OpenAPI responses, client bundles, or generated artifacts.
- Preserve authorization checks in web server actions before calling orchestrator operations that expose backend details or change runtime behavior.
- Be cautious with privileged host/container operations. Prefer allowlists, bounded inputs, explicit timeouts, and safe defaults.
- Consider performance costs before adding polling, broad scans, synchronous filesystem work, large bundle dependencies, unbounded concurrency, or repeated Docker/API/database calls.
- For long-running or concurrent work, use bounded concurrency, cancellation/timeout-aware APIs where available, and clear error handling.

## API Contracts and Generated Code

- When the orchestrator API changes, update DTOs/controllers first, then run `pnpm openapi:generate` and include generated client/schema changes.
- Keep generated clients contract-only. Put feature-specific mapping and UI behavior in the consuming app.
- Add or update contract tests when changing OpenAPI-visible behavior.

## Verification Expectations

- Run the smallest meaningful checks for the changed area, then broader checks when touching shared packages, API contracts, or cross-app behavior.
- For the approved pre-release state reset, use `pnpm reset:orchestrator-state` as a dry run and add `-- --execute` only after stopping the orchestrator. This targeted reset preserves web data, shared secrets, and orchestrator settings.
- Use `pnpm check` before finishing large or cross-cutting work when time permits.
- If you cannot run a relevant check, state exactly what was not run and why.
- Review AGENTS.md file and update it if the change affects any agent's behavior, capabilities, or assumptions.
