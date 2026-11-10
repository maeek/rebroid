# Repository Instructions

## Local Codex Runtime

- Prefix shell commands with `rtk`.
- Use Node.js 24 and pnpm through Corepack.
- Run repo-level checks from the root when practical: `pnpm check`.
- Manage dependency updates from the root pnpm workspace and shared catalog. Keep Node types on the deployed Node 24 major; compiler, ESLint, and ESM-only dependency major upgrades need explicit compatibility verification. See `CONTRIBUTING.md#dependency-updates`.
- For narrower verification, use the owning workspace script first, for example `pnpm --filter rebroid-web test`, `pnpm --filter rebroid-orchestrator typecheck`, or the package-specific `build`, `test`, and `typecheck` scripts.

## Agent skills

### Issue tracker

Read `docs/agents/issue-tracker.md` when reading, filing, or updating issues in GitHub Issues for `maeek/rebroid`.

### Triage labels

Read `docs/agents/triage-labels.md` when mapping a triage role to a GitHub label.

### Domain docs

Read `docs/agents/domain.md` before exploring domain terminology or architecture. Rebroid uses a single context.

## High-Level Structure

This is a pnpm/Turbo monorepo. Runtime applications live in `apps/*`; reusable contracts and domain libraries live in `packages/*`.

- `apps/web`: Next.js UI and backend-for-frontend. Browser code lives under `src/app`, `src/features`, `src/components`, `src/hooks`, `src/lib`, and `src/utils`. Server-only code lives under `src/server`. Shared permission/runtime vocabulary that must be used by both client and server belongs under `src/shared`. Reusable UI/layout primitives that are not owned by one feature live under `src/shared/ui`.
- `apps/orchestrator`: NestJS API that owns Android application lifecycle state, Docker operations, scheduled tasks, automations, APK handling, network policy coordination, metrics, settings, and system resources. Preserve the existing top-level module split in `src/*`; improve discoverability by splitting oversized files inside the owning module. Keep controllers, DTOs, services, facades, contracts, policies, mappers, repositories, entities, utils, and modules in the appropriate subfolders used by that domain.
- `apps/display-sidecar`: NestJS sidecar for ADB, scrcpy, WebSocket, and WebRTC display sessions. Server modules live under `src/modules/*`. The embedded viewer client lives under `src/modules/display/viewer`.
- `apps/firewall-agent`: host firewall reconciler. Keep host-network/firewall execution code here. Shared policy calculation belongs in `packages/firewall-policy-core`, not in this app.
- `packages/*`: a deliberately small layer for code used by at least two runtime apps or generated cross-app contracts. Packages may expose explicit public entrypoints through `package.json` `exports` and small entrypoint files.
- `deploy`: Docker Compose files and image transfer scripts.
- `docs`: focused architecture, deployment, operations, and contributor guides indexed in `docs/README.md`. Update the relevant guide and index when behavior or deployment assumptions change; keep file-placement rules here and avoid feature-specific implementation diaries.
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
- Resolve the orchestrator's local hostname through the container engine and use the full container ID for app-network attachment. A missing self lookup is nonfatal. Surface failures attaching an identified orchestrator.
- Normal Android application list/get operations read stored state and must not contact Docker. Use the explicit runtime-state reconciliation services or API endpoints when fresh Docker state is required.
- Recreate is a last-resort lifecycle command for stopped or errored apps. Reserve the app before cleanup, replace only its runtime container and managed network, and preserve all profile volumes. Mark interrupted recreation as failed.
- Automations consume Android runtime behavior through the `ANDROID_APPS_AUTOMATION` token and types under `android-apps/contracts`; do not inject `AndroidAppsFacadeService` or import Android lifecycle, viewer, network, state, or persistence implementations directly.
- In `apps/orchestrator/src/docker/sidecar`, keep sidecar orchestration, repair, network, and ADB coordination in `DockerSidecarService`; keep display sidecar image existence/build work in `DockerSidecarImageService`; keep pure parsing helpers in `utils`.
- Run Docker image builds through the image runtime port. The Docker adapter owns progress stream interpretation and cancellation. Build callers own context, job state, and artifact validation.
- In `apps/orchestrator/src/android-apps/lifecycle`, keep `AndroidAppsLifecycleService` as the thin request-facing facade, definition/profile/APK commands in `AndroidAppsConfigurationService`, start/stop commands in `AndroidAppsPowerService`, persisted-job startup recovery in `AndroidAppsLifecycleRecoveryService`, and bounded removal retries/cleanup in the removal services. Provision and start share `AndroidAppsRuntimeActivationService`; application/job transitions go through `AndroidAppsLifecycleTransitionService`, with one active job per application. Guard claim, handoff, progress, and completion by reservation ID. Stop and Remove drain admitted runtime work before replacing the reservation. Recreate keeps its reservation through APK installation.
- In `apps/orchestrator/src/android-apps/runtime`, keep runtime download use-case routing and running-container media-scan orchestration in `RuntimeDownloadFilesService`; keep persistent volume lookup, listing, reads, and writes in `RuntimeDownloadVolumeService`.
- In `apps/orchestrator/src/android-apps/provisioning`, keep provisioning orchestration in `AndroidAppsProvisioningService`, Android boot/remote-access preparation in `AndroidAppsProvisioningAndroidService`, APK install/launch orchestration in `AndroidAppsProvisioningApkService`, and pure APK shell/package-resolution plus Android boot diagnostic helpers under `provisioning/utils`.
- In `apps/orchestrator/src/automations`, keep `AutomationsModule` as the composition root for internal commands, events, AI/vision, execution, definition, and scheduling modules, and keep `AutomationsService` as the controller-facing facade. Keep enqueue/cancel/dispatch/abort-controller ownership in `AutomationRunnerService`; keep target preparation, step execution, guarded terminalization, metrics, and cleanup in `AutomationRunExecutionService`. Keep the snapshot-grounded deadline/action loop in `AutomationAiHarnessService`, provider controller/planner calls in `AutomationAiDecisionService`, grounded action validation/execution in `AutomationAiActionExecutor`, and provider streaming normalization in `AutomationAiChatClientService`. Keep vision capture, provider description, OCR adapters, set-of-marks rendering, and deterministic evidence fusion separate behind `AutomationVisionService`.
- Device-decision compatibility normalization may repair known provider envelopes, naming aliases, and omitted descriptive boilerplate, but it must not invent grounding. Mutating actions remain bound to the current snapshot, and taps require an observed candidate ID or normalized coordinates before execution.
- AI controller turns expose one `DeviceDecision` schema or one fallback decision tool, never the full automation command registry. Bind actions to the latest snapshot and target fingerprint, observe after screen changes, and require known evidence IDs for successful completion.
- Refresh evidence after dispatched screen mutations, including uncertain command failures. Block the turn if observation fails. Keep direct coordinate and live text tap commands out of AI capability routing.
- Raw `android.adbShell` is never a default AI capability. AI escalation requires an explicit allowlisted policy and a validated read-only `{program,args}` command; human-authored automation commands remain separately permission checked.
- A chat approval for AI shell escalation creates a new one-run follow-up with `rawShellPolicy: allowlisted`; the web server action must verify `automations:run-adb-shell`, keep `android.adbShell` hidden from routed capabilities, and never turn approval into a persistent provider or conversation setting.
- Automation targets are reserved by the queued row before preparation. All status updates must use guarded expected-status transitions; never save a stale run entity or overwrite a terminal status. Startup recovery fails queued/running rows instead of resuming them. Workflow and trigger summaries read the newest recorded run. Keep scheduler enqueue failures separate from run transitions.
- Authorize workflow attachment and startup as distinct operations. Cancel unadmitted preparation and keep the run reservation through any dispatched Start admission. Check the requested profile again after Android reports readiness.
- Automation event sequence allocation and insertion must remain one transaction backed by the unique `(runId, sequence)` index. WebSocket listeners must be registered before replay queries and must buffer, deduplicate, and clean up live delivery during replay.
- In `apps/orchestrator/src/settings`, keep generic settings facade methods in `SettingsService`, persistence/default normalization in `OrchestratorSettingsStore`, AI-provider CRUD/execution lookup in `AiProviderSettingsService`, provider connectivity checks in `AiProviderHealthService`, and provider model downloads in `AiProviderModelDownloadService`.
- Keep AI transport protocol (`openai-chat-completions` or native Ollama) separate from detected server flavor. Probe Lemonade before Ollama compatibility endpoints and preserve exact model IDs returned by the selected transport.
- Browser UI must not call the orchestrator directly. It should go through the Next.js backend-for-frontend in `apps/web/src/server/orchestrator`.
- Web client modules must not import server-owned types. Browser/server DTOs belong in `apps/web/src/shared/contracts`; the only allowed runtime import from `apps/web/src/server` is a module whose first directive is `'use server'`, used to invoke a Server Action.
- Cross-cutting web reads should use validated `/api/bff/*` handlers backed by focused server query services. Feature-owned mutations may use Server Actions, but both transports must return the shared operation result with a request ID and stable error code.
- Create app preserves the draft on failure and only navigates after receiving a valid app ID. Use the orchestrator's structured validation fields for inline corrections and stable service error codes for form-level notices with the request ID. Keep raw upstream error details server-side. Incompatible Server Action responses need a new action name so already-open pages cannot interpret them using the old contract.
- Web persistence has no migration or legacy compatibility path. Schema changes assume a clean deployment and use `pnpm reset:all-state -- --execute`; preserve external environment files and bind-mounted secrets.
- The orchestrator owns Android application lifecycle state. The display sidecar owns viewer session state. The firewall agent owns host firewall reconciliation.
- `deploy/edge` nginx owns public HTTPS ingress. Keep Next.js internal and route
  display viewer/media paths directly to the display sidecar; do not
  reintroduce a Node media proxy. Short-lived display-session tokens remain the
  viewer authorization boundary.
- The orchestrator `feature-flags` module owns the typed registry, persisted runtime intent, revision, and immutable hot-path snapshot. Sidecars receive only their owned effective subset through authenticated synchronization and never persist platform feature values. Gate coarse use-case boundaries; feature flags do not replace permissions, health, or authentication.
- `feature.ocr`, `feature.firewall`, and `feature.image-builder` are enforced locally by the orchestrator. `feature.display-virtual` is synchronized to the display sidecar and must fail closed for new virtual surfaces when state is absent, stale, or disabled.
- Firewall feature checks must allow saving and applying disabled app policies and creating unrestricted apps. Gate restricted operations on the resulting policy state before persisting; preserve ownership and unrestricted-internet permissions. Disabling the feature leaves existing host rules unchanged.
- Restricted runtime activation requires an acknowledged forwarding guard on the managed IPv4 subnet before Docker starts the container. Keep the guard through policy installation and do not clear it if stopping an unverified runtime fails.
- Enforce owner open-app quotas inside the lifecycle reservation transaction for Create, Clone, Start, and Recreate, including automation-triggered starts. Take the limit from the trusted web service.
- Runtime reconciliation clears a missing container with a guarded state update, then removes only the firewall policy that still targets that container.
- Firewall reconciliation orders bulk snapshots, individual updates, and removals in the agent. Persist removal ordering across restarts and use the snapshot start time for bulk policy generations.
  A guarded removal records ordering for the expected container even if its policy has yet to arrive.
- Stage policy state before changing host rules and publish it only after the host accepts the change. Build later operations and startup recovery from committed state.
- Replace the iptables forwarding jump and all active Rebroid chains in a single no-flush filter-table commit. Preserve unrelated host rules and retire obsolete chains only after a successful replacement.
- Orchestrator firewall startup recovery verifies every recorded restricted runtime regardless of stored application status. An incomplete inventory must not trigger a bulk replacement. Refresh verified live policies individually. Recheck uncertain runtimes at fallback and verify ownership, live state, and the saved policy revision before stopping.
- Viewer activity and policy observations use targeted writes scoped to the observed runtime. Never save a whole application snapshot to record a viewer observation.
- Viewer firewall refresh shares the per-app policy gate with administrative updates and reloads policy after checking the runtime identity. Use the refresh-only agent operation for the same installed runtime and revision. Policy writes carry the saved revision, and agent removals retain that revision across restart.
- OCR uses one deployment language through `OCR_LANGUAGE` and one request/response `language` value. Keep image validation, the quality-gated preprocessing cascade, and Paddle runtime ownership separated under `apps/ocr-sidecar/ocr_sidecar`.
- Display recording has been removed. Do not reintroduce recording routes, state, generated contracts, or viewer controls without a new bounded-storage and lifecycle design.
- Treat display sidecar scrcpy/server/socket startup ordering as a protected invariant. Do not reorder awaited ADB commands, socket listener registration, socket reads, process launch, retry, or cleanup without a dedicated manual Redroid verification pass. Refactoring without that pass is limited to pure SPS parsing, compatibility-probe parsing, retry classification, and stream-option selection.
- The display media wire protocol is `RBD1`: preserve unsigned scrcpy PTS and
  configuration/keyframe/discontinuity flags. Every consumer owns a bounded
  live-edge queue; overflow discards the queued GOP and resumes with cached
  configuration plus an IDR. Never pause the scrcpy source or continue after an
  arbitrary delta-frame drop. WebRTC senders must continuously drain RTCP.
- Display transports are consumers of a session/profile source supervisor.
  Browser, decoder, WebSocket, bridge, and peer failures detach only that
  consumer; they must not tear down ADB or the scrcpy source. Encoder recovery
  uses the rate-limited scrcpy v4 reset-video control message over the existing
  control socket without changing socket startup order.
- Scope WebRTC offer work and bridge events to their consumer attempt. Scope keyboard capture to the active viewer surface.
  The Go bridge owns peer shutdown and joins its media workers. Keep audio-only failures local to audio and end
  the attempt on shared timestamp regression. The sidecar test suite requires Go 1.24 and local UDP loopback.
  Bind WebRTC negotiation and media attachment to the same source codec generation. Keep an outstanding
  encoder reset on its original deadline. Route expired viewer session recovery through the authorized web viewer.
  Correlate discrete control outcomes and choose fallback before dispatch. Fence MediaSource fragments and callbacks by recovery epoch.
  Acknowledge reconnect-queued controls only after socket dispatch. Never replay live pointer phases after reconnect.
  Reserve control queue capacity for releases of admitted pointer gestures. Require stream control for virtual surfaces.
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
- Neutral panels, editor sections, and summary cards share the `Surface` panel treatment (`surface-editor`, panel radius, no visible border/shadow/blur). Use `DetailFields` for resource metadata and reuse it during loading.
- Keep canvas, panels, controls, and floating surfaces in the same neutral palette, independent of the selected accent. Reserve accent tints for actions, links, focus, and selection; do not reintroduce a global accent wash or transparent editor panels.
- Treat `Surface` `data-tone` styling as authoritative across notices, service banners, and toasts; successful mutation
  completion uses the success variant and must retain its visible semantic tint in light, dark, and OLED themes.
- Use `Section.headingSpacing` and `Section.description` for heading rhythm and helper copy. Do not add ad-hoc title
  padding in protected feature pages.
- Use the Base UI-backed `MultiSelectCombobox` for searchable multiple relationships instead of rendering an expanded
  checkbox list. Keep its removable chips, keyboard behavior, option descriptions, and empty state intact.
- Use `MutationButton` for asynchronous actions so the pending label, spinner, disabled state, and `aria-busy` remain
  visible and consistent.
- Web UI changes do not retain deprecated design-system variants or token aliases; migrate all consumers and remove the
  old API in the same change.
- Web loading states must be implemented by the component that owns the ready-state geometry. Reuse the actual page
  shell, responsive layout, `Section`, `DataGrid` column definitions, table markup, and scroll container; do not copy
  widths or layout class strings into route loaders. Keep `loading.tsx` files as thin feature entrypoints, render known
  page chrome immediately, and describe cell placeholders through the owning grid column metadata.
- Scope index-page loading boundaries to leaf route groups when their URL also has nested pages. Platform overview,
  provider-list, and services-inventory loaders must not wrap other platform destinations; retain shared authorization.
- Loading content uses neutral surfaces and placeholders, including notice panels, health badges, metric markers,
  and resource icons. Reserve semantic status colors for loaded content; use `Notice.loading` for notice skeletons.
- Form loading may reuse real field groups through `FormLoadingBoundary`; keep controls inert and separately disable data fetching and mutations. Preserve query-selected resource views during loading instead of falling back to Overview or Models.
- Compose every interactive `DataGrid` through the shared `DataGridWorkspace`. Grids use an unboxed toolbar,
  a transparent body, quiet header fill with the shared control radius, and horizontal separators; do not add feature-specific
  rounded table frames. Use filter sheets only for
  page-level datasets with meaningful structured facets; embedded related-resource grids and small fixed datasets use
  its search-only mode. Keep enabled filter chrome real during loading, and keep feature-specific filter controls and
  validated state in the owning feature. Filter sheets start closed and never reduce table width; preserve the filter button, active
  count/chips, reset behavior, and keyboard focus restoration. Do not add separate search buttons, filter popovers, or column-header
  filtering.
- Grid selection swaps search and bulk-action toolbar modes in the same reserved space. Keep inactive
  controls inert and hidden from assistive technology; selecting rows must not move the table.
- Grid selection uses softly rounded background emphasis without accent stripes. Bulk toolbars swap immediately, with ghost actions and `danger-ghost` for destructive actions. Sheet transitions use Base UI starting/ending states and keep the backdrop transparent through unmount.
- Query-selected nested service loaders must retain the Docker/Orchestrator detail layout; profile route and inner Suspense loaders must both retain the profile list and device pane. Feature loaders may show stable shell-manifest metadata, but must mask availability and enabled values.
- Display sessions reads sidecar logs through its administrator-only log endpoint. Keep logs out of health responses and caches, decode Docker log frames before rendering, and bound both Docker reads and returned tails.
- Keep the protected route loading matrix at 36 renderable routes with thin feature-owned loaders; the legacy
  display-sessions redirect is the only loader-free exclusion. Explicit Suspense boundaries reuse the same feature
  loading component as the route loader.

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

## Standard editor composition

- Text inputs and selection controls fill their assigned field column consistently; size columns in the form layout, not through control-specific width caps. Keep numeric inputs compact and toolbar/table controls explicitly sized.
- Ordinary create/edit and settings pages use `EditorPage`, a full-width canvas with a normal page header, rounded semantic section panels, and labels above compact controls. Keep workspace and list pages on their existing page family.
- Use compact Select or SingleSelectCombobox choices, FileUploadField uploads, and exact numeric inputs; reserve sliders for streaming settings. Keep section headings inside panels and remove row dividers. Collapse optional advanced groups through unboxed Section expanders, retaining drafts and revealing validation errors.
- Keep editable runtime defaults separate from read-only deployment details and immediate maintenance actions. Preserve drafts during maintenance refreshes, and explain the scope of cleanup and restore operations before running them.
- FormField places descriptions directly beneath labels, before controls; use its shared spacing rather than per-feature label margins. Validation errors remain associated with their controls.
- Reuse feature-owned editor geometry in loading states and keep dialog actions in their footer. Use ConfirmMutationDialog for action confirmations. State the target and impact clearly, and reserve typed confirmation for broad irreversible operations.
- Empty/error feedback uses scope-sized `StateView`; grids use `DataGridEmptyState` outside table scrolling. Distinguish no data, filtered results, unavailable data, and not-applicable role rules; recovery never removes fixed authorization or app scope.
- Page failures use shared, theme-aware local illustrations; section/grid failures stay compact. Overview hides metric/operation cards and sampling hints when initial reads fail, but retains real snapshots with stale-data notices after refresh failures. Outage recovery links to Overview rather than assuming another runtime-backed page can load. Classify orchestrator page-read failures in the shared server module and preserve framework and authorization errors.
- Small administrative policies and operation limits use a saved-value summary with an explicit Edit action and a focused single-column dialog. Save applies the draft; Cancel discards it. Keep failed drafts and restore trigger focus on close.
- User/group editors use retained-draft tabs through `AccessEditorLayout`. Membership and permission catalogs use
  shared paginated DataGridWorkspace/DataGrid; membership dialogs use MultiSelectCombobox with a bounded chip area.
  Reorder using the full membership order, not searched/page positions. Keep quotas in their own tab and section,
  explain unlimited quotas there, and block user Save while a profile photo is being prepared. Profile photos remain local drafts until explicit Save, including in the current-user profile dialog. Editor dialogs provide their own containment; keep their sections flat without nested panels or outer section padding.
- User/group editors reuse their feature-owned access layout and permission editor. Distinguish effective access from Inherit/Allow/Deny user overrides; Inherit removes an override; group Not set removes a group decision rather than writing a denial. Use the shared effective-access resolver for server enforcement and draft previews, including ordered group decisions, fallback, and unconditional Admin access. Preserve multi-select chips and keyboard behavior; do not turn category filtering into hidden bulk permission changes.

- Image builders remain workspaces with shared feature-owned ready/loading layouts, rounded resource panels, one header Build action, explicit template application, grouped validation, and stable-height build logs. Keep uploaded context selection searchable, preserve upload/validation bounds, and use the shared active-build module for start, cancel, polling, and guarded job updates.

## Operator console navigation

- Device-agent workspaces constrain desktop height at the resource layout, not in the transcript. Keep conversation scrolling independent, preserve draft access while stopped, and share composer/loading geometry.
- Device-agent composers keep setup/device guidance inside the composer, suggestions on the left, and direct model selection beside send. Group model choices by provider; optional vision and time limits belong in More options. Preserve provider/model pairs and existing capability checks.

- Preserve readable resource identity: shared page titles and breadcrumbs wrap; header actions remain reachable.
  Keep the sidebar bounded to the viewport, give the page its width back when collapsed, and preserve the shell
  skip-to-content destination. Gate sidebar creation shortcuts with the same access and feature checks as their destinations.
- Keep decorative icons on shared tabs and resource navigation. In the app workspace, Files opens in Downloads,
  the clipboard belongs in the live viewer toolbar, and the desktop mini player reuses the mounted display as a
  read-only preview. Let the chat transcript pass scroll through to the page at its boundaries.
- Filters must remove explicitly cleared URL fields. Use resource names in filter chips, label each filter control,
  and keep whole-dataset actions available without row selection. Pending mutations prevent conflicting actions;
  partial bulk failures retain failed items for retry.
- Routed inventory and audit grids accumulate pending query edits separately from committed results. Use committed search to classify empty results and preserve feature-owned filters and fixed audit scope.

- Settings mutations send only fields owned by the editing workflow. Services saves connections, Runtime defaults saves runtime fields, and image-builder default actions save only the image; never resend hidden settings snapshots.
- Runtime Restore resets the runtime defaults and optional service connections. Preserve unrelated settings and return authoritative saved values for the editing workflow.
- App power and clone actions return the accepted command result. Gallery and detail refreshes track eventual lifecycle state. Clean up icons and recent-app metadata only after confirmed deletion and keep that work separate from command acceptance.
- AI providers use Models and Connection resource views. Keep model purposes and per-provider defaults explicit, preserving planning-to-controller compatibility and first-enabled default fallback. Registration/download save immediately; other model and connection changes remain a page draft. Block registration/download and saved-connection checks while that draft is dirty. Provider discovery, manual model ID registration, and Ollama download are distinct actions; preserve exact IDs and existing permission checks.
- Services owns the Connections and Features views. Keep disabled services discoverable, preserve requested versus effective feature state, and keep feature toggles immediate while connection edits require Save. Feature management remains at `/platform/features`, nested under Services in navigation and breadcrumbs.

- Runtime Maintenance and overview Infrastructure diagnostics remain visible as regular sections, without collapse controls.
- Infrastructure service pages suppress Docker limits/metrics sections and requests when orchestrator health is missing or offline, using one service warning; unknown health uses warning tone. Keep orchestrator-owned diagnostics available for Docker-only failures. Runtime defaults checks dependencies before reading settings/images, uses the shared illustrated page failure on initial outages, and retains mounted drafts with disabled mutations on refresh failures.
- Runtime-backed server pages use `OrchestratorPageBoundary` before dependent loaders and feature checks. Render one shared page failure for unavailable dependencies; never substitute empty datasets, editable defaults, or not-found responses for service failures. Preserve independent host/sidecar diagnostics during partial outages and retain mounted connection drafts with unavailable mutations disabled.

- App resource URLs open the overview; retain the viewer at `/viewer/apps/[id]` and resource destinations at `/app/[id]?view=<section>` (including configuration, AI agent, and workflows). Use the feature-owned resource layout in ready and loading states.
- The Viewer layout menu moves the same mounted device pane above the full-width resource content while keeping breadcrumbs first. Apply the browser preference on the first render and expose it in Preferences → General. Redirect old Viewer tab URLs to Overview and retain the separate viewer window route. Preserve vertical scroll when switching app resource tabs.
- Keep the Android device visible across app resource views through AppDeviceLayout, sized to available viewport height. App Configuration shows Runtime settings as a visible section panel; technical Details and Logs belong only in Diagnostics. Use one resource navigation row for overview, configuration, activity, diagnostics, and permitted runtime tools. Size the display from observed stream dimensions within the available width and height. Keep streaming settings in the display chrome and device controls on its outer right edge. Breadcrumbs use the same section labels as URLs; old manage/workspace URLs redirect. Local management destinations use links with aria-current. Preserve permission and foreign-owner checks for diagnostics and runtime interaction.
- App diagnostics infrastructure references link to container/image/network pages only when the viewer has administrator access; backend-detail permission alone must not enable infrastructure links. Destination server authorization remains authoritative.
- Use shared `ResourceLink` for navigable resource names/references in grid cells and details; show accent color at rest, hover/focus underline, and visible keyboard focus. Keep descriptive metadata muted. Application references use `ApplicationReference` with resolved names above IDs; resolve names in authorized server reads through one application-summary lookup per dataset.
- Runtime container, image, and network actions belong in the resource page header, including loading geometry; Overview sections hold information. Preserve mutation confirmation and disabled states.
- Use shared `ResourceNavigation` for resource section switchers (including app and container views), keeping visual states, overflow handling, and focus styles in one place.
- Workflow workspaces place details above the sequence/inspector, expose Visual editor and YAML modes, and share Editor / Run history navigation. Mobile step inspectors open only on explicit selection and restore focus on dismissal. Trigger dialogs group identity, target, and schedule without nested panels; grids show a single last-run result and contextual resource links. Loading states reuse those same compositions.
- Workflow run history uses `?run=` selection and must verify owner and workflow membership for runs outside the recent page. Historical replay must preserve known terminal state.
- App Activity reuses the audit grid with server-enforced application resource scope and existing administrator authorization; embedded search/reset/sort/pagination and export must retain that scope. Global audit maintenance actions stay on the audit page.
- Platform Operations groups totals and bounded previews (at most five rows per group); avoid per-app error banners. Directory/resource links use shared link styling, and failed refreshes retain a warning instead of suggesting zero failures.
- Platform operations snapshots use the admin-only BFF query, bounded previews, and explicit refresh semantics. Do not imply the lifecycle timestamp summary is a complete audit log.

## Audit activity presentation

- Audit log and embedded app activity share the time-first grid, compact summary, and event inspector. Keep raw IDs/actions, exact timestamps, request data, and JSON in the inspector instead of duplicating them in every row. Use readable attempt labels, shared DetailFields/JsonViewer, and labeled searchable actor/action filters.
- Preserve admin authorization and server-enforced app scope through filtering, reset, pagination, sorting, and CSV export. Retention and purge remain global audit actions. Ready/loading states reuse the same feature-owned shell and grid columns.
- Use the same validated URL filters for controls, queries, navigation, and export. Date-only filters use inclusive UTC boundaries. Export follows the current sort with an explicit 5,000-event cap; readable operation labels remain searchable through the shared audit presentation model. Show app Activity navigation only to administrators.

- Services uses the shell health snapshot for Orchestrator, Docker/runtime, Display, Firewall, and OCR. Docker diagnostics and persisted operation limits belong to the Docker service resource view; preserve active and queued operations during limit changes. Runtime-default resets must not reset separately managed Docker limits.
- Keep dialog payloads mounted until `onOpenChangeComplete(false)` before clearing them; closing animation must never render an empty/header-only form. Combobox empty-state live regions remain mounted, with padding on their message content only.
- Trigger dialogs use searchable resource choices with descriptions/IDs and selected context. Reuse owner-scoped tag facets and workflow tags through the shared MultiSelectCombobox with explicit creation; never commit typed tag searches on blur. Trigger descriptions persist through the API and participate in grid search.

- App discovery retains the icon gallery, shared search/selection toolbar, and visible app action menus. Scope bulk actions to selected visible results. Overview recent shortcuts use authenticated per-user visit order, excluding deleted/inaccessible apps; do not reuse the sidebar’s running-first ordering.

- Automation execution must reauthorize current account state, command permissions, target ownership,
  and startup permissions/quotas through the secret-authenticated web internal authorization endpoint
  before target preparation. Configure `WEB_INTERNAL_URL` for non-Compose deployments; failure is closed.
- Runtime image name detection is not a publisher trust policy. Keep Redroid-only authorization scoped
  to the official repository, and never log query strings containing viewer or event-stream tokens.

- Nest development Swagger UI must retain explicit compatible `@fastify/static` runtime dependencies
  in both services; bootstrap tests must exercise Swagger assets as well as guarded API routes.
- Validate viewer control payloads at the shared dispatch boundary, bound WebSocket input, and retain
  server-owned HTTP action types. Account/group access changes revoke viewer sessions before and
  after persistence; recheck in-flight viewer grants against fresh account state before returning tokens.
