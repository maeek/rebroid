# Packages Cleanup TODO

## Objective

Make `packages/*` a small, predictable layer for code that is genuinely shared across runtime applications or represents a generated cross-application contract.

The cleanup should reduce package count and public surface area, move single-owner behavior back to its owning application, remove unused runtime dependencies, and make the package quality gates useful for contributors.

## Previous Baseline

- Seven workspace packages.
- Five handwritten/buildable packages and two generated OpenAPI packages.
- About 6,037 lines of handwritten production TypeScript.
- About 8,923 lines of generated OpenAPI schema TypeScript.
- About 2,430 lines of package tests.
- 108 package tests passing.
- Package typechecks, OpenAPI drift checks, and dependency-cruiser checks passing.
- No package dependency cycles or unresolved imports found.
- Reported package duplication is dominated by generated OpenAPI output; handwritten duplication is small.
- The current dead-code check has package configuration gaps and cannot fail because it runs Knip with `--no-exit-code`.

## Package Admission Rule

A package should exist only when at least one of these is true:

1. The same behavior is actively consumed by at least two runtime applications.
2. It is a generated contract between separately owned applications.
3. It is intentionally maintained as an independently publishable library with a documented public API and support policy.

Framework-neutral or pure code does not qualify by itself. Single-application code stays in the owning application even when it is pure and highly testable.

## Target Package Set

| Target package                       | Purpose                                                                                               | Expected consumers                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `@rebroid/automation-core`           | Automation definitions, command metadata, condition vocabulary, and other shared automation contracts | Web, orchestrator                      |
| `@rebroid/android-application-core`  | Shared Redroid runtime vocabulary and viewer-control contracts                                        | Web, orchestrator, display sidecar     |
| `@rebroid/firewall-policy-core`      | Firewall policy types, validation, CIDR policy, and chain naming                                      | Web, orchestrator, firewall agent      |
| `@rebroid/orchestrator-contracts`    | Generated orchestrator OpenAPI types                                                                  | Web and contract verification          |
| `@rebroid/display-sidecar-contracts` | Generated display-sidecar OpenAPI types                                                               | Orchestrator and contract verification |

Preferred end state: reduce the package layer from seven packages to five. Do not retain `ai-core` or `vision-core` solely to isolate pure code.

## Phase 0: Guardrails and Documentation

- [x] Add `packages/README.md` with:
  - [x] The package admission rule.
  - [x] A package/consumer matrix.
  - [x] The distinction between handwritten packages and generated contracts.
  - [x] Instructions for adding or changing a package.
  - [x] Package-specific verification commands.
- [x] Update the root `README.md` repository layout to include `packages/*`.
- [x] Update `AGENTS.md` whenever a package is renamed, removed, or changes responsibility.
- [x] Add a dependency-cruiser rule forbidding imports from `packages/*` into `apps/*`.
- [x] Add a rule or review check that rejects new packages without two application consumers or an explicit generated-contract exception.
- [x] Document that generated `schema.ts` files must not be edited manually.

### Toolchain consistency

- [x] Add one root Node version declaration for Node.js 24.
- [x] Update or remove the stale `apps/web/.nvmrc` Node 20 declaration.
- [x] Add an appropriate root `engines.node` constraint.
- [x] Align TypeScript versions across the root, apps, and packages.
- [x] Align `@types/node` with the supported Node.js runtime.
- [x] Introduce a shared package TypeScript base configuration.
- [x] Use the pnpm catalog or another single source of truth for repeated tooling versions.
- [x] Keep workspace-level scripts required by Turbo, but remove avoidable manifest drift.

### Cleanup gate

- [x] Configure Knip for every package entrypoint and `*.spec.ts` file.
- [x] Mark generated OpenAPI schemas as generated/ignored where appropriate.
- [x] Remove known false positives from the dead-code baseline.
- [x] Add a strict package-scoped Knip gate without `--no-exit-code`; keep the broader repository scan advisory until its app-owned baseline is addressed.
- [x] Make new dead code, unresolved imports, and unused dependencies fail CI.
- [x] Track duplication separately for handwritten and generated code.
- [x] Set the handwritten duplication target below 3%.

## Phase 1: Make Generated Packages Contract-Only

Preferred decision: these packages are contract packages, not runtime HTTP client libraries.

### Orchestrator contract

- [x] Rename `packages/orchestrator-client` to `packages/orchestrator-contracts`.
- [x] Rename the workspace package to `@rebroid/orchestrator-contracts`.
- [x] Replace all existing `@rebroid/orchestrator-client` imports.
- [x] Update `scripts/openapi-generate.mjs` paths.
- [x] Update Dockerfiles, dependency rules, documentation, and package manifests.
- [x] Remove the unused `createOrchestratorClient` runtime factory.
- [x] Remove the package's `openapi-fetch` dependency.
- [x] Export only generated schema types and intentionally named contract aliases.

### Display-sidecar contract

- [x] Rename `packages/sidecar-client` to `packages/display-sidecar-contracts`.
- [x] Rename the workspace package to `@rebroid/display-sidecar-contracts`.
- [x] Update `scripts/openapi-generate.mjs` paths.
- [x] Remove the unused `createSidecarClient` runtime factory.
- [x] Remove the package's `openapi-fetch` dependency.
- [x] Add the contract package as an orchestrator dependency.
- [x] Replace the handwritten `DisplaySidecarSession` and response interfaces in `DockerSidecarApiService` with generated contract types.
- [x] Preserve the orchestrator-owned request timeout, error translation, readiness retry, and authentication behavior.

### Contract package verification

- [x] Give both contract packages explicit `format:check`, `typecheck`, and contract verification coverage, or document why they are intentionally type-source-only.
- [x] Ensure Turbo does not silently skip required checks for these workspaces.
- [x] Keep `pnpm openapi:check` deterministic from the committed OpenAPI documents.
- [x] Do not require running services for a normal clone-and-check workflow.

## Phase 2: Move Single-Owner Code Home

### `vision-core`

- [x] Move geometry, observation types, UI XML parsing, and their tests into `apps/orchestrator/src/automations/vision` using the existing domain folder conventions.
- [x] Update orchestrator imports to app-local paths.
- [x] Remove the unused `@rebroid/vision-core` dependency from `apps/web`.
- [x] Remove `@rebroid/vision-core` from the web Docker build list.
- [x] Remove `@rebroid/vision-core` from the orchestrator Docker build list after its imports migrate.
- [x] Delete the `vision-core` workspace after all consumers migrate.

### `automation-core/schedule`

- [x] Move schedule form state, weekday labels, and cron conversion to the web shared schedule model.
- [x] Update web imports to the owning web module.
- [x] Move or add focused schedule conversion tests beside the web implementation.
- [x] Remove the `./schedule` package export.
- [x] Keep `automation-core` focused on behavior shared by web and orchestrator.

### `application-core`

- [x] Move `resolveContainerImage` and its tests into the owning orchestrator container-image or Android lifecycle domain.
- [x] Remove the `./container-image` package export.
- [x] Remove the separate `./command-line` entrypoint.
- [x] Keep command-line parsing private to the Redroid runtime implementation unless another application directly needs it.
- [x] Update the orchestrator Docker provisioning import without duplicating the parser.
- [x] Decide whether to rename `application-core` to `android-application-core`; preferred before open source because the current name is broad and invites unrelated additions.
- [x] If renamed, update all consumers, Dockerfiles, package metadata, docs, and `AGENTS.md` in the same change.

### `firewall-policy-core`

- [x] Keep the package as a shared policy boundary.
- [x] Stop exporting generic helpers that are only package internals, including `parseJsonStringArray` when no external consumer requires it.
- [x] Keep the small orchestrator JSON-array helper local instead of coupling unrelated application DTO code to firewall policy.
- [x] Treat that small duplicate as intentional boundary preservation rather than creating a generic utility package.
- [x] Review the remaining exports and retain only policy-domain concepts.

## Phase 3: Dissolve `ai-core` by Ownership

Do this incrementally. Introduce app-local modules or temporary facades, migrate consumers and tests, then remove old package exports. Avoid combining file moves with behavior changes.

### Web-owned AI code

- [x] Move provider form state and editing helpers into the AI provider settings feature.
- [x] Move model catalog selection hooks/helpers into web shared AI UI/model code.
- [x] Move provider/model display labels into web UI code.
- [x] Move model recommendation copy and UI recommendation policy into web-owned model code.
- [x] Move conversation presentation helpers into the AI agent web feature.
- [x] Replace `ProviderFormState` and `ProviderModelRow` package types with web-owned view models.
- [x] Derive API-facing types from validated BFF/shared contracts generated from the orchestrator API instead of importing orchestrator domain types through `ai-core`.

### Orchestrator-owned provider code

- [x] Move provider defaults, normalization, model normalization, masking, and remote-model parsing under the orchestrator's provider/settings ownership.
- [x] Keep provider CRUD and persistence normalization within the existing settings boundaries.
- [x] Move provider HTTP request scope, bounded response reading, and abort classification into an app-local provider execution surface.
- [x] If provider transport is shared across orchestrator modules, expose it through a focused contract/facade rather than a broad utility barrel.
- [x] Preserve exact transport-versus-server-flavor behavior.
- [x] Preserve secret redaction and bounded provider error handling.

### Orchestrator-owned automation AI code

- [x] Move the device decision schema and normalization into `apps/orchestrator/src/automations/ai`.
- [x] Move controller/planner prompts and message builders into the automation AI domain.
- [x] Move streaming normalization into the automation AI provider transport area.
- [x] Move tool policy, failure classification, outcome classification, and screen-state policy into the automation AI domain.
- [x] Move AI observation sanitization and ADB shell safety policy into the owning automation AI area.
- [x] Remove the app-local re-export wrapper once the implementation is local.
- [x] Remove duplicate package/app tests for the same observation helpers.

### AI test organization

- [x] Move tests with their implementation before changing behavior.
- [x] Split the monolithic `harness.spec.ts` into focused, co-located specs.
- [x] Split `provider.spec.ts` by provider normalization, catalog/UI behavior, and remote model parsing ownership.
- [x] After migration, split oversized production files by responsibility:
  - [x] Device decision schema, normalization, and validation.
  - [x] Tool preflight, failure classification, outcome classification, and display labels.
  - [x] SSE parsing, Ollama NDJSON parsing, and shared stream accumulation.
  - [x] Screen-state correction, candidate ranking, and summarization.

### Remove the package

- [x] Confirm no application imports `@rebroid/ai-core`.
- [x] Remove `@rebroid/ai-core` from application dependencies.
- [x] Remove it from Docker build and symlink steps.
- [x] Delete the package only after app-local tests and package-equivalent tests pass.
- [x] Do not retain an `ai-contracts` package because no qualifying shared contract remains.

## Phase 4: Tighten Remaining Public APIs

- [x] Review every `package.json#exports` entry against real consumers.
- [x] Remove unused internal export modifiers such as `aiToolName`, `toolNameAliases`, and `normalizeAiModelDefaultFor` during the AI migration.
- [x] Do not add broad root barrels.
- [x] Keep subpath exports intentional and capability-oriented.
- [x] Add package descriptions explaining ownership and non-goals.
- [x] Keep packages private unless there is an explicit publishing decision.
- [x] Keep publishing metadata out while all workspaces remain private; add it only with an explicit package-publishing decision.

## Phase 5: Open-Source Readiness Adjacent to Packages

These are repository-level blockers but affect whether the package layer can be safely presented publicly.

- [ ] Add a tracked root `LICENSE` after the maintainer chooses the license.
- [x] Add `CONTRIBUTING.md` with package placement and verification guidance.
- [x] Add `SECURITY.md` with a private vulnerability reporting path.
- [x] Defer a code of conduct until a private moderation/enforcement path is chosen.
- [x] Ensure the root README describes generated artifacts and dependency boundaries.
- [x] Ensure the normal clone workflow can install, generate/check contracts, typecheck, test, and build using the documented Node/pnpm versions.

## Suggested Pull Request Sequence

1. **Package guardrails and tooling**
   - Documentation, Node/TypeScript alignment, shared package config, Knip cleanup, and dependency boundaries.
2. **Generated contracts cleanup**
   - Rename contract packages, remove runtime factories/dependency, and integrate sidecar contract types.
3. **Single-owner package cleanup**
   - Move schedule, container-image, and vision code; tighten firewall/application exports.
4. **AI web ownership**
   - Move form, catalog, labels, recommendations, and conversation presentation to web.
5. **AI orchestrator ownership**
   - Move provider runtime and automation harness logic with behavior-preserving tests.
6. **Remove `ai-core` and split hotspots**
   - Remove build/dependency plumbing, then split large files and monolithic tests.

Each pull request should remain behavior-preserving and independently buildable. Use temporary facades/re-exports only during migration and remove them before the phase is complete.

## Completion Metrics

- [x] Package count reduced from seven to five, unless an explicitly documented package exception is approved.
- [x] Every handwritten package has at least two runtime application consumers.
- [x] Every generated contract has a real consumer or a documented contract-verification purpose.
- [x] No app-specific UI state remains in `packages/*`.
- [x] No Nest providers, controllers, persistence, runtime HTTP adapters, or environment parsing are introduced into packages.
- [x] No unused runtime dependencies remain in package manifests.
- [x] Package dead-code output has zero unexplained findings.
- [x] Handwritten duplication remains below 3%; generated duplication is reported separately.
- [x] All package entrypoints participate in typecheck and format verification.
- [x] The package admission and ownership model is documented for new contributors.

## Implementation result

Completed in the working tree on 2026-07-16:

- The package layer now contains five workspaces: three handwritten shared-domain packages and two generated,
  type-only OpenAPI contract packages.
- `ai-core` and `vision-core` were removed. Web-owned UI/model behavior and orchestrator-owned provider, vision, and
  automation AI behavior now live with their runtime owners. The former 1,274-line AI test was split into six focused
  specs, and duplicated public-text tests were removed.
- `application-core` was narrowed and renamed to `android-application-core`; schedule and container-image behavior
  moved to their single owners, and generic firewall helpers are no longer public API.
- Runtime HTTP factories and `openapi-fetch` were removed from the generated contracts. The orchestrator sidecar
  adapter consumes the generated session schema while retaining its local timeout, authentication, retry, and error
  behavior.
- Node 24, TypeScript 5.9, Node types, and Prettier versions now have repository-level declarations. Handwritten
  packages share one TypeScript base and expose package-export-compatible type metadata.
- Package admission, strict package dead-code checks, dependency boundaries, OpenAPI drift checks, and a 3%
  handwritten duplication ceiling are automated. Current handwritten package duplication is 0.00%.
- `CONTRIBUTING.md`, `SECURITY.md`, package documentation, the root README, and `AGENTS.md` describe the new ownership
  model. Public release still needs a maintainer-selected root license.
- Frozen install and the full root `pnpm check` pass with the documented Node/pnpm versions. This covers package
  admission, dead code, duplication, formatting, lint, tests, OpenAPI drift, dependency boundaries, all workspace
  typechecks, and production builds.

Re-audited on 2026-07-17:

- The five-package target, two-runtime-consumer admission rule for handwritten packages, and generated type-only
  contract policy still match the workspace and pass their automated checks.
- The generated-schema-only dead-code findings remain expected public OpenAPI namespace members; no newly introduced
  handwritten package dead code was found.
- The root license decision remains the only package-plan completion item and continues to block publication.

## Verification Checklist

Run the smallest relevant checks after every pull request and the full check before completing a phase.

```bash
corepack pnpm --filter './packages/*' typecheck
corepack pnpm --filter './packages/*' test
corepack pnpm openapi:check
corepack pnpm boundaries
corepack pnpm packages:check
corepack pnpm packages:duplication:generated
corepack pnpm check
```

When an OpenAPI-visible API changes:

```bash
corepack pnpm openapi:generate
corepack pnpm openapi:check
```

Before merging a package removal or rename:

```bash
rg '@rebroid/(ai-core|vision-core|application-core|orchestrator-client|sidecar-client)' apps packages deploy scripts
git status --short
```

Do not hand-edit generated schema drift. Update the owning API DTO/controller, regenerate the contract, and include the generated changes.

## Coordination note — orchestrator cleanup (2026-07-16)

- `AutomationYamlDraft` and `AutomationYamlDraftStreamEvent` now live at the focused
  `@rebroid/automation-core/yaml-draft` entrypoint and have two real consumers: orchestrator and Web. Preserve this
  entrypoint during the package cleanup rather than moving either consumer back to a local duplicate.
- Viewer transport/control vocabulary now lives in `@rebroid/android-application-core/viewer-control`; its
  orchestrator, Web, and display-sidecar consumers migrated atomically.
- Neither addition introduces framework providers, runtime adapters, environment parsing, or app-owned UI state into
  a package; both satisfy the package admission rule.
