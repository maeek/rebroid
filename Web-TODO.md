# Web Architecture Cleanup and Open-Source Readiness

This checklist tracks the web cleanup pass. The current feature-oriented Next.js architecture remains in place: keep thin App Router entries, feature ownership, the BFF boundary, shared UI primitives, and co-located tests while repairing browser/server contract drift, consolidating proven duplication, reducing selected hotspots, and improving contributor onboarding.

## Scope and decisions

- [ ] Deliver the cleanup as one comprehensive pull request organized into logical commits.
- [x] Keep the current hybrid transport model:
  - [x] Use Server Components and server loaders for initial reads.
  - [x] Use validated `/api/bff/*` routes for client refreshes and HTTP-style reads.
  - [x] Use Server Actions for feature-owned mutations.
  - [x] Keep external and webhook interfaces as Route Handlers.
- [x] Preserve existing URLs, permissions, operation-result envelopes, request IDs, stable error codes, loading geometry, and persistence behavior.
- [x] Do not change the orchestrator API, OpenAPI contract, database schema, or generated clients in this pass.
- [x] Keep thin `page.tsx`, `loading.tsx`, Suspense, and page-entry repetition explicit.
- [x] Do not introduce a generic web framework layer or abstract domain-specific configuration solely to reduce similar-looking code.
- [x] Retain the WebGL login effect while removing its general-purpose rendering dependencies and unused options.
- [x] Keep repository-wide licensing, security-policy, code-of-conduct, and community-governance work out of this pass.
- [x] Keep unrelated user changes out of the cleanup diff.

## Audit baseline

The initial review found:

- Approximately 999 TypeScript source files and 69,357 production lines.
- 599 feature files, 137 server files, 91 shared files, and 48 reusable component files.
- 24 production files above 300 lines and two above 500 lines.
- 253 feature files importing from `src/server`; 84 client-side type imports crossing the documented shared-contract boundary.
- 35 re-export-only files, of which 29 are intentional Next.js route/loading entries.
- Exact duplication at approximately 2.34%, concentrated mainly in platform runtime grids, search-param parsing, and AI-provider fields.
- No circular dependencies, unresolved imports, or dependency-boundary violations.
- 111 test files and 426 tests passing.
- Coverage at 27.97% statements, 25.56% branches, 23.28% functions, and 28.28% lines.
- Typecheck, tests, dependency checks, and production build passing.
- Lint failing with 20 errors and one warning.
- The auth decoration contributing roughly 970 KB gzip through Three/postprocessing and a transpiled inline SVG.
- A production build contacting the unavailable orchestrator for optional settings and logging avoidable request failures.

### Baseline tasks

- [x] Record the current commit and working-tree state before implementation.
- [x] Save the current web lint, typecheck, test, coverage, build, boundary, dead-code, duplication, health, and bundle-analysis output.
- [x] Confirm the build baseline with the orchestrator stopped.
- [x] Add characterization tests before changing runtime image-builder and casting-sidecar behavior.

## Phase 1 — Restore a clean baseline

### Lint and test hygiene

- [x] Fix all existing import-order lint errors.
- [x] Remove obsolete lint suppressions from the root web layout.
- [x] Replace direct Testing Library container/node access in breadcrumb skeleton tests with user-facing queries.
- [x] Confirm `pnpm --filter rebroid-web lint` is green before structural refactoring.

### Verified dead code

- [x] Delete `apps/web/src/features/automations/automations-page/steps/value-ref/automation-value-ref-path-field.tsx` after one final reference check.
- [x] Delete `apps/web/src/features/settings/scheduled-tasks/scheduled-tasks-page/scheduled-tasks-table-parts.tsx` after one final reference check.
- [x] Delete `apps/web/src/server/web-settings/actions/get-web-settings-action.ts` after one final reference check.
- [x] Delete `apps/web/src/server/web-settings/actions/reset-web-settings-action.ts` after one final reference check.
- [x] Keep `apps/web/src/test/server-only.ts`; it is required by the Vitest alias.
- [x] Remove only exports proven unused by both full-workspace search and dead-code analysis.
- [x] Drop unnecessary `export` modifiers without deleting symbols still used internally.

### Dependencies

- [x] Remove unused `dayjs` from the web package.
- [x] Remove unused `@rebroid/vision-core` from the web package only.
- [x] Update the pnpm lockfile through normal package-manager commands.
- [x] Re-run typecheck, tests, dead-code analysis, and build after dependency removal.

### App-local barrels and proxy exports

- [x] Remove `src/shared/ui/data-grid/index.ts` and migrate consumers to direct DataGrid source imports.
- [x] Remove the Monaco YAML `index.ts` barrel and import the editor and schema directly.
- [x] Remove both platform page-skeleton re-export shims and import the owning skeleton files directly.
- [x] Remove the runtime image-builder Dockerfile-context barrel and use direct model imports.
- [x] Remove proxy type re-exports from display-viewer, auth-user, resource-limit, and recent-app helpers.
- [x] Preserve real composition façades such as `userService` while removing their unnecessary type proxy exports.
- [x] Rename the runtime tools panel `index.tsx` implementation to a descriptive component filename.
- [x] Keep intentional Next.js `page.tsx` and `loading.tsx` re-exports.
- [x] Add an architecture test rejecting new non-route re-export-only modules.

## Phase 2 — Repair the browser/server contract boundary

### Canonical shared contracts

- [x] Make `apps/web/src/shared/contracts` the sole source of serializable browser/server models.
- [x] Expand the existing application contract with every application DTO used by browser code.
- [x] Expand the existing automation-run contract while keeping run/event wire shapes unchanged.
- [x] Add a focused automation contract for definitions, grid queries/pages, commands, and AI draft/prompt results.
- [x] Keep AI-provider catalog, provider, model, and health types in the existing shared AI-provider contract.
- [x] Add a platform-runtime contract for container, image, network, query, and grid-page models.
- [x] Keep platform runtime and image-build wire types together in the focused shared platform contract.
- [x] Add an audit contract for browser-visible events, filters, sort state, rows, and pages.
- [x] Add an auth-user contract for public users, groups, roles, and editor inputs.
- [x] Add a scheduled-task contract for browser-visible tasks and actions.
- [x] Add a system-stats contract and keep capacity/resource contracts in the existing system-resources file.
- [x] Keep persistence-only models such as stored users, files, audit inputs, and secret-bearing representations under `src/server`.
- [x] Ensure every contract crossing an RSC boundary is a plain serializable object with strings instead of `Date`, and no maps, sets, classes, or functions.

### Consumer migration

- [x] Migrate all client components from orchestrator adapter types to shared contracts.
- [x] Migrate activity UI away from persistence repository types.
- [x] Migrate user and shell UI away from auth implementation types.
- [x] Migrate system UI away from server-owned stats types.
- [x] Migrate application, automation, platform, and settings clients away from server type modules.
- [x] Update Server Action signatures to accept and return shared contracts.
- [x] Update BFF handlers and server loaders to map generated or persistence representations before crossing the boundary.
- [x] Remove duplicate browser-visible declarations from server type modules after all consumers migrate.
- [x] Keep adapter-only generated aliases under `src/server` when they never cross a browser boundary.
- [x] Reach zero client-side type imports from `@/server`.

### Automated enforcement

- [x] Add a source contract test that identifies modules with a top-level `'use client'` directive.
- [x] Reject type-only imports from `@/server` in every client module.
- [x] Reject client runtime imports from `@/server` except explicit Server Action modules.
- [x] Keep existing dependency-cruiser rules for shared UI/model and cross-feature boundaries.
- [x] Add fixtures proving allowed Server Action imports and rejected server-model imports.
- [x] Confirm the migration creates no new cycles or unresolved aliases.

## Phase 3 — Consolidate proven duplication

### Search-parameter parsing

- [x] Add one shared helper for extracting the first scalar search-param value.
- [x] Add focused helpers for bounded positive integers and validated sort values where the existing parsers share semantics.
- [x] Replace duplicate parsing in automation lists/triggers, audit, platform grids, and platform services.
- [x] Keep feature-specific enums, defaults, filters, and validation in their owning feature.
- [x] Add table-driven tests for missing, scalar, repeated, invalid, negative, and out-of-range parameters.

### Platform runtime grids

- [x] Add `useRuntimeResourceGridController<TItem, TQuery>` inside the platform feature.
- [x] Give it explicit inputs for items, current query, page size, item identity, sort parsing, and href construction.
- [x] Make it own synchronized search text, URL query updates, sorting state, visible-selection pruning, and selected-item resolution.
- [x] Migrate containers, images, and networks to the shared controller.
- [x] Keep container/image/network filter construction and mutation policy resource-specific.
- [x] Extract container mutation orchestration into a focused container-actions hook.
- [x] Extract image mutation orchestration into a focused image-actions hook.
- [x] Extract network mutation orchestration into a focused network-actions hook.
- [x] Move image column definitions and cells into a dedicated table-parts file.
- [x] Move network column definitions and cells into a dedicated table-parts file.
- [x] Leave each runtime section as composition-only UI without inline column declarations or mutation orchestration.
- [x] Preserve DataGridWorkspace behavior, filter chrome, bulk actions, loading geometry, and URL semantics.
- [x] Add tests for query replacement, sort serialization, selection pruning, bulk outcomes, filters, and pagination.

### AI-provider forms

- [x] Replace repeated feature-local `Field` wrappers with shared `FormField`.
- [x] Add `ProviderConnectionFields` for connection fields genuinely shared by provider add and edit flows.
- [x] Add a feature-local `ProviderNumberField` built from `FormField` and `Input` for optional numeric model settings.
- [x] Preserve labels, descriptions, validation, disabled state, layout, and accessibility relationships.
- [x] Remove the repeated wrappers from provider dialog, provider edit sections, provider model download, and provider model settings dialog.
- [x] Add form tests for IDs, labels, descriptions, optional numeric values, and disabled states.

## Phase 4 — Split selected complexity hotspots

### Runtime image builder

- [x] Add characterization tests for context selection, upload planning, recipe editing, build start, progress, errors, and cancellation.
- [x] Extract page state and asynchronous actions into a focused controller hook.
- [x] Keep Dockerfile parsing, resolution, and upload planning in their existing pure model files.
- [x] Compose the client page from its focused recipe, context, validation, and build-state sections.
- [x] Keep the page client responsible only for composing the controller and sections.
- [x] Preserve current server-action calls, validation, progress behavior, and navigation.

### Casting sidecar operations

- [x] Add characterization tests for refresh, restart, session ending, filtering, and error feedback.
- [x] Extract data/mutation state into a focused controller hook.
- [x] Split service health/actions from the display-session workspace.
- [x] Keep permission checks and mutation feedback unchanged.
- [x] Preserve documented DataGridWorkspace and semantic-token usage.

### Refactoring guardrails

- [x] Do not split components solely to satisfy an arbitrary line-count target.
- [x] Keep feature-owned hooks and models inside their feature.
- [x] Do not move framework adapters, Server Actions, or React components into shared packages.
- [x] Do not add cross-feature imports to share a small implementation detail.
- [x] Re-run Fallow health analysis and confirm the selected hotspots improve without creating wrapper-only abstractions.

## Phase 5 — Retain WebGL and remove auth-page bloat

### Static artwork

- [x] Extract the Android artwork from `android-logo-3d.tsx` into `apps/web/public/auth-android-backdrop.svg`.
- [x] Preserve the existing view box, gradients, masks, filters, colors, and responsive placement.
- [x] Render it as an `aria-hidden` decorative static image with intrinsic dimensions.
- [x] Delete the transpiled React SVG component after visual verification.

### Native WebGL backdrop

- [x] Create a feature-owned auth WebGL component under `src/features/auth`.
- [x] Reuse the current square fragment-shader appearance with the current color, density, size, jitter, speed, and edge-fade values.
- [x] Implement the full-screen shader directly with WebGL2 rather than Three or postprocessing.
- [x] Remove unused liquid, touch, ripple, click, shape-variant, and general-purpose component APIs.
- [x] Dynamically import the WebGL component with SSR disabled so it remains confined to auth routes.
- [x] Pause animation while the document or canvas is hidden.
- [x] Resize through a bounded observer and device-pixel-ratio cap.
- [x] Render one stable frame when reduced motion is requested.
- [x] Provide a semantic CSS fallback when WebGL2 initialization or shader compilation fails.
- [x] Delete GPU programs, buffers, animation frames, and observers during cleanup.
- [x] Delete the generic `pixel-blast.tsx` component after migration.

### Dependency and bundle cleanup

- [x] Remove `three`, `@types/three`, and `postprocessing` from the web package.
- [x] Rebuild and confirm no Three/postprocessing chunk remains.
- [x] Confirm the inline SVG is no longer emitted as a large JavaScript chunk.
- [x] Compare auth route raw and gzip client-JS sizes against the saved baseline.
- [x] Confirm the dark-theme Android silhouette and animated pixel effect remain visually equivalent.
- [x] Confirm OLED mode still hides the decorative backdrop.

## Phase 6 — Build and contributor hygiene

### Request-time rendering

- [x] Import `connection` from `next/server` in the server UI-settings loader.
- [x] Call `await connection()` before optional database and orchestrator settings reads in `getServerOrchestratorUiSettings`.
- [x] Keep the existing fallback settings behavior for runtime failures.
- [x] Build with the orchestrator stopped and confirm no `/settings` request is attempted during prerendering.
- [x] Confirm the build emits no `orchestrator.request_failed` messages.

### Contributor documentation

- [x] Add a concise web contributor guide under `docs`.
- [x] Document the route → page entry → server loader/client boundary → section/UI structure.
- [x] Document feature, shared UI, shared model, shared contract, and server placement rules.
- [x] Include the Server Component/BFF/Server Action/Route Handler decision table.
- [x] Document the client-contract rule and the explicit Server Action import exception.
- [x] Document DataGridWorkspace, FormField, loading geometry, semantic-token, and direct-import conventions.
- [x] Include one representative recipe for adding a page and its focused verification commands.
- [x] Link the guide from `apps/web/README.md` and `docs/web-architecture.md`.
- [x] Correct the root README development host so it matches the `127.0.0.1` default.
- [x] Correct the root README initial-admin-password instructions so they point to `/app/data/initial-admin-password` rather than logs.
- [x] Update `AGENTS.md` with the clarified client-contract/Server Action invariant without duplicating the contributor guide.

## Public interface and compatibility checklist

- [x] Keep all HTTP paths and methods stable.
- [x] Keep all orchestrator OpenAPI schemas stable.
- [x] Keep web persistence and authentication behavior stable.
- [x] Keep shared operation-result shapes and error codes stable.
- [x] Treat new shared contracts as internal web compile-time interfaces, not new public APIs.
- [x] Remove server adapter import paths as browser-visible type APIs.
- [x] Remove internal DataGrid and Monaco barrel import paths.
- [x] Remove the internal generic `PixelBlast` and inline `AndroidLogo3D` component APIs.
- [x] Confirm no secrets or persistence-only fields become part of shared browser contracts.

## Verification and acceptance

### Automated tests

- [x] Add architecture tests for client/server imports and non-route barrels.
- [x] Add unit tests for shared search-param parsing.
- [x] Add hook tests for runtime-grid query, sorting, and selection behavior.
- [x] Add tests for resource-specific bulk-action outcomes.
- [x] Add AI-provider form composition and accessibility tests.
- [x] Add characterization tests for runtime image-builder and casting-sidecar settings.
- [x] Add WebGL tests for initialization failure, reduced motion, resize, pause/resume, and cleanup.
- [x] Add deterministic Playwright coverage for dark and OLED auth states.
- [x] Set web coverage thresholds to 27% statements, 25% branches, 23% functions, and 28% lines.

### Commands

- [x] Run `pnpm --filter rebroid-web lint`.
- [x] Run `pnpm --filter rebroid-web typecheck`.
- [x] Run `pnpm --filter rebroid-web test`.
- [x] Run targeted web Playwright tests.
- [x] Run `pnpm --filter rebroid-web build` with the orchestrator unavailable.
- [x] Run `pnpm boundaries`.
- [x] Run `pnpm fallow:web:dead-code`.
- [x] Run `pnpm fallow:web:dupes`.
- [x] Run `pnpm fallow:web:health`.
- [x] Run a final Next.js bundle analysis and save the comparison.
- [x] Run `pnpm check` from the repository root.

### Final acceptance

- [x] Lint, typecheck, tests, boundaries, and the build are green, including the full repository check.
- [x] There are zero client-side server-model/type imports.
- [x] There are no non-route re-export-only app modules.
- [x] There are no new circular dependencies, unresolved imports, or boundary violations.
- [x] Exact duplication does not regress above the 2.34% baseline.
- [x] The four verified unused modules and all verified unused dependencies are gone.
- [x] The auth route no longer ships Three, postprocessing, or the inline-SVG JavaScript chunk.
- [x] Offline production builds do not contact the orchestrator or emit request-failure noise.
- [x] Existing UI behavior, URLs, permissions, loading layouts, and operation results remain compatible.
- [x] Web architecture and first-contribution documentation match the implemented code.

## Implementation result

- Web lint, formatting, typecheck, 123 Vitest files/471 tests, dependency boundaries, offline production build, and
  targeted desktop/mobile Playwright checks pass.
- Coverage is 30.92% statements, 27.50% branches, 25.42% functions, and 31.27% lines, above the new floors.
- Exact duplication is 1.60%, down from the 2.34% baseline; Fallow reports 90.5 maintainability (good).
- Fallow's advisory dead-code and health commands still exit non-zero with 89 findings and 289 threshold findings.
  They include known entrypoint/string-reference false positives, so this pass did not apply its broad autofix blindly.
- The login payload is approximately 459 KB raw / 148 KB gzip including shared and dynamic chunks, down from roughly
  970 KB gzip. Production chunks contain no Three.js, postprocessing, generic PixelBlast, or inline Android component.
- The offline build emitted no `/settings` request and no `orchestrator.request_failed` event during prerendering.
- The subsequent package cleanup removed `@rebroid/vision-core` and `@rebroid/ai-core`, renamed the shared Android
  package to `@rebroid/android-application-core`, and renamed the generated API package to
  `@rebroid/orchestrator-contracts`. Web-owned AI catalog, recommendation, form, conversation, and schedule behavior
  now lives with its feature/shared-model owners; focused Web tests and the full Web suite remain green.
- The subsequent orchestrator cleanup moved YAML draft wire types to
  `@rebroid/automation-core/yaml-draft`. Web imports them directly in its editor, viewer workflow-draft hook, and
  server action; no shared-contract proxy re-export was reintroduced, and Web typecheck remains green.
- The subsequent package cleanup also normalized the two tracked display-sidecar files that had failed the shared
  formatting gate. The full root `pnpm check` is now green.

Re-audited on 2026-07-17:

- Fallow 3.6 reports 1.56% web duplication and an 87.0/A health score with 289 threshold findings. The duplication
  result remains below the recorded 2.34% baseline; the health score uses a newer formula than the earlier 90.5
  maintainability result.
- Five newly introduced but unconsumed web exports/types were removed after full-workspace reference checks. The
  changed-code audit now reports no newly introduced handwritten dead-code finding, boundary violation, cycle, or
  unresolved import.
- Pull-request packaging remains unchecked because it is source-control delivery work, not an implementation claim.
