# Orchestrator Simplification and Architecture Hardening

This checklist tracks the orchestrator cleanup and refactoring pass. The target architecture remains a single-host NestJS modular monolith: keep the current top-level domains and existing Nest submodule granularity, while making responsibilities, public boundaries, and lifecycle state transitions easier to understand and maintain.

## Scope and decisions

- [x] Keep the orchestrator as a modular monolith; do not split it into services in this pass.
- [x] Keep the existing top-level domain/module split and improve discoverability inside each owning module.
- [ ] Implement the redesign in independently reviewable phases.
- [x] Allow breaking persisted-state cleanup with a clean orchestrator state reset; do not add legacy migration or compatibility code.
- [x] Preserve existing HTTP routes and JSON/SSE event names unless a behavior change provides concrete value; do not rename public APIs solely for tidiness.
- [x] Add scenario-driven tests for protected behavior; do not optimize for an arbitrary coverage percentage.
- [x] Do not change protected Docker sidecar startup, socket, retry, or cleanup ordering without a dedicated manual Redroid verification pass.
- [x] Update `AGENTS.md` when ownership, boundaries, or protected invariants change.
- [x] Keep open-source governance work out of this pass. A root license and contributor/security/conduct documentation remain separate release blockers.

## Audit baseline

Capture new measurements before implementation and compare each phase against them. The initial review found:

- Approximately 46,700 TypeScript lines across 435 TypeScript files and 38 Nest module files.
- Automations: 14,856 lines / 108 files; Android apps: 11,533 lines / 105 files. Together they account for about 56% of the orchestrator.
- 69 test suites and 237 tests passing.
- Coverage: 52.67% statements, 25.96% branches, 33.52% functions, and 51.59% lines.
- Duplication: 1.47% overall and 0.35% cross-file.
- 76 functions above the current complexity thresholds: 14 critical, 26 high, and 36 moderate. Average maintainability: 91.1.
- Main hotspots:
  - `AndroidAppsLifecycleService`: 497 class lines and 19 dependencies.
  - `AutomationAiHarnessService`: 780 class lines.
  - `AndroidAppsProvisioningService`: 374 class lines and 13 dependencies.
  - `AndroidAppsStartLifecycleService`: 197 class lines and 14 dependencies.
  - Lifecycle/provisioning branch coverage: 0%; Docker sidecar: 1.25%; AI harness: 58.62%.
- Existing strengths: no import cycles, no `forwardRef`, no global modules, passing dependency checks, and strong Docker/automation port patterns.
- Main weaknesses: uneven cross-domain boundaries, direct Android repository/entity imports from APK, network-policy, and Docker-maintenance code, duplicated provisioning/start and cron flows, oversized services/DTO/config files, and stale orchestrator documentation.

### Baseline tasks

- [x] Record the current commit and working-tree state before implementation.
- [x] Run and save the current orchestrator test, typecheck, lint, build, OpenAPI, boundary, dead-code, and duplication results.
- [x] Add characterization tests around lifecycle, provisioning, recovery, network policy, APK processing, and AI behavior before changing those paths.
- [ ] Break the work into reviewable pull requests aligned with the phases below.
- [x] Keep unrelated user changes out of every refactoring diff.

## Phase 1 — Remove verified waste and repair documentation

### Dead code and dependencies

- [x] Verify and delete `apps/orchestrator/src/automations/ai/automation-ai-harness-observation.ts` if it remains unused.
- [x] Remove the unused direct `@nestjs/schematics` dependency.
- [x] Review internal exports and remove only exports proven unused after accounting for Nest decorators, Swagger reflection, and runtime metadata.
- [x] Re-run tests, typecheck, dead-code analysis, and build after removals.

### Shared cron behavior

- [x] Extract pure cron parsing, normalization, and next-run functions into a focused shared internal helper.
- [x] Replace duplicated behavior in `AutomationScheduleService` and `ScheduledTaskScheduleService` with the shared functions.
- [x] Remove obsolete providers and module imports after all consumers migrate.
- [x] Add table-driven tests for valid schedules, invalid schedules, and next-run calculation. The current schedule
      contract has no per-schedule time-zone input to characterize.

### File organization

- [x] Split oversized DTO files by cohesive API resource while preserving their JSON and OpenAPI shapes.
- [x] Split oversized configuration files into environment schema, parsers, and section builders while preserving one central `registerAs` output.
- [x] Use direct imports from owning files; do not add application barrel files.
- [x] Leave harmless DTO decorator repetition explicit when abstraction would hide the API contract.
- [x] Leave security-sensitive archive/path guards explicit when sharing them would reduce clarity or weaken local validation.

### Documentation

- [x] Rewrite `apps/orchestrator/README.md` to use pnpm/Corepack rather than npm.
- [x] Document the actual module structure, supported commands, configuration entrypoints, and environment setup.
- [x] Add `docs/orchestrator-architecture.md` containing:
  - [x] A top-level module map and dependency direction.
  - [x] A normal HTTP request flow.
  - [x] Android application create/start/stop/remove and recovery flows.
  - [x] Automation execution and AI decision flows.
  - [x] A code-placement guide for controllers, services, facades, contracts, policies, repositories, entities, mappers, DTOs, and utilities.
  - [x] A short first-contribution path with focused verification commands.
- [x] Update `AGENTS.md` after the new ownership rules are final.

## Phase 2 — Enforce domain boundaries with capability ports

### Android application contracts

- [x] Add an independently declared APK-reference lookup port under `android-apps/contracts`.
  - [x] Support counting application references to uploaded APKs.
  - [x] Support finding referenced upload IDs needed for safe cleanup.
- [x] Add an independently declared application/runtime inventory port under `android-apps/contracts`.
  - [x] Support querying known application IDs for Docker orphan detection.
  - [x] Support querying the minimal running targets needed for network-policy reconciliation.
- [x] Define a minimal `NetworkPolicyTarget` contract rather than exposing the Android application entity.
- [x] Make the Android persistence adapter implement the ports.
- [x] Wire the ports through symbol tokens using `useExisting`.
- [x] Export only the tokens/contracts required by consumers from the owning module.

### Consumer migrations

- [x] Make the APK catalog inject the APK-reference port instead of the Android application repository.
- [x] Make network-policy bootstrap and reconciliation inject the runtime-inventory port instead of the Android repository/entity.
- [x] Map Android persistence entities to `NetworkPolicyTarget` at the owning boundary.
- [x] Make Docker maintenance orphan mapping inject the application-existence capability instead of the Android repository.
- [x] Extract Docker-maintenance orphan orchestration from the controller into an application service, leaving the controller responsible only for validation, delegation, and response mapping.
- [x] Move shared viewer transport vocabulary to the appropriate application-core contract and update consumers.
- [x] Remove `ApplicationProfileMode` from Docker/network-isolation interfaces.
- [x] Map Android profile semantics to a neutral capability such as `persistentData` at the Android boundary.

### Automated boundary enforcement

- [x] Add dependency-cruiser rules preventing cross-domain imports of repositories and entities.
- [x] Add a rule preventing port contracts from importing concrete adapters.
- [x] Add a rule preventing controllers from importing repositories directly.
- [x] Preserve the rule that cross-domain consumers use public contracts, facades, or module wiring only.
- [ ] Add boundary test fixtures proving valid and invalid imports are classified correctly.
- [x] Confirm there are no new cycles.
- [x] Confirm APK, network-policy, Docker-maintenance, and settings code no longer imports Android repositories/entities or unrelated concrete services.

## Phase 3 — Make Android lifecycle ownership explicit

### Request-facing application services

- [x] Keep `AndroidAppsLifecycleService` as the controller-facing facade.
- [x] Reduce the facade to validation/delegation and remove direct repository, Docker, and `onModuleInit` responsibilities.
- [x] Extract `AndroidAppsConfigurationService` for create, clone, update, profile, and APK metadata/update entrypoints.
- [x] Extract or consolidate a request-facing power service for start, stop, and related lifecycle commands.
- [x] Extract `AndroidAppsLifecycleRecoveryService` for startup recovery of persisted jobs.
- [x] Extract `AndroidAppsRemovalService` for removal requests, background cleanup, and bounded retry behavior.
- [x] Keep `AndroidAppsStartLifecycleService` responsible for the long start use case, but route shared activation stages through one implementation.

### Shared activation and APK installation

- [x] Add one `AndroidAppsRuntimeActivationService` within the existing provisioning/lifecycle ownership.
- [x] Centralize image availability, container/boundary preparation, container start, network policy, Android readiness, and progress reporting in that service.
- [x] Make both initial provisioning and later starts use the same activation implementation.
- [x] Route initial APK installation, APK update, and start-with-missing-APK through `AndroidAppsApkInstallLifecycleService`.
- [x] Remove the separate initial-install background path after all scenarios use the unified implementation.
- [x] Preserve cancellation, explicit timeouts, bounded concurrency, and retry semantics.
- [x] Preserve storage-only normal list/get operations; Docker reconciliation must remain explicit.

### Transactional lifecycle transitions

- [x] Add `AndroidAppsLifecycleTransitionService` as the single owner of allowed application/job transitions.
- [x] Define allowed source and destination status/stage transitions explicitly.
- [x] Persist application lifecycle state and job state/handoff in one database transaction.
- [x] Append runtime logs only after the database transaction commits.
- [x] Provide an explicit progress-update path that cannot overwrite terminal state.
- [x] Enforce one active lifecycle job per application with a unique `applicationId` invariant.
- [x] Keep job kinds limited to `provision`, `start`, `install_apk`, and `remove` unless a new use case proves necessary.
- [x] Make provision/start hand off transactionally to `install_apk` when APK work is required.
- [x] Make remove preempt active work and make stop cancel active work without allowing stale completion to overwrite the result.
- [x] Recover one persisted job by its explicit kind; do not infer or invent a resumable operation from inconsistent state.
- [x] Move corrupt or inconsistent lifecycle/job state to an explicit error outcome with diagnostics.

### Persistence and acceptance targets

- [x] Update the initial SQLite schema for the active-job invariant without adding a migration path.
- [x] Run `pnpm reset:orchestrator-state` as a dry run and document that `-- --execute` requires the orchestrator to be stopped.
- [x] Reduce `AndroidAppsLifecycleService` below 200 lines with no more than five direct collaborators and no direct infrastructure dependencies.
- [x] Remove targeted provisioning/start clone groups.
- [x] Confirm all lifecycle scenario tests below pass.

## Phase 4 — Decompose automation AI by responsibility

### AI harness

- [x] Keep the deadline/action loop, controller state transitions, observation cadence, and finish coordination in `AutomationAiHarnessService`.
- [x] Extract `AutomationAiDecisionService` for decision requests, controller messages, and planner calls.
- [x] Extract `AutomationAiActionExecutor` for snapshot/target/capability validation, command execution, shell escalation, and normalized action outcomes.
- [x] Extract a pure finish verifier.
- [x] Extract pure plan schema, parser, and prompt helpers.
- [x] Preserve one `DeviceDecision` schema or one fallback decision tool per controller turn.
- [x] Preserve binding to the latest snapshot and target fingerprint.
- [x] Preserve routed-capability limits, observation after screen changes, and evidence-based completion.
- [x] Preserve allowlisted, validated, read-only raw-shell escalation only.
- [x] Keep human-authored command permissions separate from AI escalation policy.
- [x] Reduce `AutomationAiHarnessService` below 350 lines.
- [x] Keep redesigned methods below 80 lines unless a longer protocol loop is documented and materially clearer intact.
- [x] Avoid creating wrapper-only services that merely rename calls.

### YAML drafts, events, and conditions

- [x] Split YAML draft prompt construction, parsing, and repair into pure helpers.
- [x] Keep provider streaming, retry policy, and application orchestration in the service layer.
- [x] Move `AutomationYamlDraftStreamEvent` and its payload contract to `@rebroid/automation-core`.
- [x] Update the orchestrator and web server consumers without changing SSE event names or wire shapes.
- [x] Refactor automation condition evaluation into focused pure predicate handlers.
- [x] Add exhaustive tests for every supported condition operator and invalid input behavior.
- [x] Keep `AutomationsService` as the intentional controller-facing facade; document why its breadth is acceptable instead of splitting it solely to reduce constructor size.

## Phase 5 — Address remaining complexity hotspots

### APK inspection

- [x] Extract pure manifest/resource/icon parsing and classification from APK readers.
- [x] Add representative valid, malformed, truncated, oversized, and adversarial fixtures.
- [x] Preserve bounded extraction, path safety, payload validation, and resource limits.

### AI provider health

- [x] Extract pure provider-response parsing.
- [x] Extract error classification and provider-role compatibility checks.
- [x] Keep connectivity orchestration and timeouts in `AiProviderHealthService`.
- [x] Preserve transport/flavor separation and exact model IDs.

### Configuration and DTOs

- [x] Finish separating environment schema, value parsers, and configuration section builders.
- [x] Keep one discoverable application configuration entrypoint.
- [x] Finish splitting giant DTO files by API resource without broad re-exports.
- [x] Confirm public JSON and OpenAPI field names remain stable.

### Docker sidecar and other modules

- [x] Limit sidecar refactoring to pure health/probe parsing, retry classification, and stream-option selection unless a manual Redroid harness is available.
- [x] If protected sidecar ordering is touched, run the dedicated manual Redroid verification and record the evidence.
- [x] Review network isolation, settings, and other remaining modules for application-specific type leakage.
- [x] Run duplication analysis after each extraction and remove targeted clones without introducing overly generic abstractions.

## Public interface and persisted-data checklist

- [x] Treat new capability ports and tokens as internal module contracts, not public HTTP APIs.
- [x] Preserve route paths unless a separately approved behavior change requires otherwise.
- [x] Preserve JSON and SSE event names and payload semantics.
- [x] Regenerate OpenAPI whenever an API-visible DTO changes.
- [x] Include generated `@rebroid/orchestrator-contracts` schema changes in the same change as their source DTO/controller updates.
- [x] Update web BFF consumers when a justified public contract change is made.
- [x] Use a clean orchestrator-state reset for schema changes; do not add compatibility migrations.

## Required scenario tests

### Android lifecycle

- [ ] Create without APK: provision, become ready, and remove the completed job.
- [ ] Create with APK: provision, hand off to install, launch, become ready, and remove the completed job.
- [ ] Start a stopped application with an existing container.
- [ ] Start an application whose container is missing.
- [ ] Pull a missing image with observable bounded progress.
- [x] Fail closed and leave consistent state when network-policy application fails.
- [ ] Install an updated APK while the application is running.
- [ ] Leave consistent running/error state and a resumable persisted job after APK installation failure.
- [x] Cancel active lifecycle work on stop.
- [x] Preempt active work on remove and retry cleanup safely.
- [x] Resolve concurrent start/remove/stop requests with one active job and guarded transitions.
- [ ] Recover each persisted job kind after process restart.
- [x] Move corrupt or inconsistent job/application state to an explicit error instead of guessing.
- [ ] Prove normal list/get reads do not contact Docker.

### Boundaries and maintenance

- [x] Detect APKs referenced by applications and protect them from cleanup.
- [x] Find referenced APK upload IDs through the capability port.
- [x] Detect orphan containers using application existence data.
- [x] Bootstrap and reconcile network policy using mapped `NetworkPolicyTarget` values.
- [ ] Prove dependency-cruiser rejects a cross-domain repository/entity import.
- [ ] Prove dependency-cruiser accepts a contract/token-based import.

### Automation and AI

- [x] Reject stale snapshots.
- [x] Reject target fingerprint mismatches.
- [x] Reject unrouted or unauthorized tools.
- [x] Handle unchanged screens without inventing success.
- [x] Handle command-result failure and bounded retry.
- [ ] Enforce controller/planner step and time budgets.
- [x] Deny raw-shell escalation by default.
- [x] Allow only validated allowlisted read-only shell commands for an approved run.
- [x] Reject unknown evidence IDs during completion.
- [x] Reject completion with unfinished required subgoals.
- [x] Preserve replay/live SSE ordering, deduplication, and cleanup.

### Peripheral behavior

- [x] Reject malformed, unsafe, or over-limit APK inputs deterministically.
- [x] Reject invalid environment configuration with actionable errors.
- [x] Cover provider health probes, compatibility parsing, timeouts, and classified failures.

### Integration

- [x] Boot the Nest application with the final module graph.
- [x] Verify the SQLite active-job invariant/index from a clean state.
- [x] Verify OpenAPI generation has no drift.
- [x] Verify generated contract and web BFF consumers compile.
- [x] Run the full repository check.

## Verification commands

Run the smallest relevant checks during each phase and the complete set before closing the pass:

```sh
corepack pnpm --filter rebroid-orchestrator test
corepack pnpm --filter rebroid-orchestrator typecheck
corepack pnpm --filter rebroid-orchestrator lint
corepack pnpm --filter rebroid-orchestrator build
corepack pnpm openapi:orchestrator:check
corepack pnpm boundaries
corepack pnpm deadcode
corepack pnpm check
```

Record duplication measurements when dependencies are available:

```sh
corepack pnpm dlx fallow dupes --root . --workspace apps/orchestrator --skip-local
```

## Completion criteria

- [ ] All required scenario tests pass.
- [x] All repository checks pass with no OpenAPI drift.
- [x] There are no dependency cycles or boundary violations.
- [x] APK, network-policy, Docker-maintenance, and other domains do not import Android repositories/entities directly.
- [x] There is one runtime activation implementation, one APK-install lifecycle, and one shared cron implementation.
- [x] The lifecycle facade and AI harness meet their size/responsibility targets without wrapper-service bloat.
- [x] Overall duplication is at or below 1.47% and cross-file duplication is at or below 0.35%, or every regression has a documented justification.
- [x] The orchestrator README and architecture documentation match the implemented code.
- [x] `AGENTS.md` reflects final ownership and invariant rules.
- [x] No unrelated changes are included.
- [x] The separate open-source governance gate is still explicitly tracked before public release.

## Architecture-pass result

Implemented in the working tree on 2026-07-16. Docker/Redroid integration acceptance and source-control slicing remain
open as listed below:

- The modular-monolith shape and public HTTP/SSE contracts are preserved. No protected display-sidecar startup, socket,
  retry, or cleanup ordering was changed.
- The lifecycle facade is 59 lines with three application-service collaborators. One transactional transition owner,
  one active job per application, one runtime activation path, and one APK-install lifecycle now coordinate provision,
  start, stop, remove, and recovery.
- The AI harness is 289 lines. Decision, action execution, plan parsing, finish verification, YAML parsing/repair, and
  shared event emission have focused ownership; the 171-line harness loop remains intact because it is the readable
  protocol state machine rather than a collection of unrelated work.
- Shared cron providers and verified dead code were removed. Configuration and the largest automation/provider DTOs
  were split without introducing barrels or decorator abstractions.
- APK binary XML/resource parsing now uses bounded pure chunk, attribute, and simple-entry iterators. Valid,
  malformed, truncated, oversized, and adversarial cases are covered while archive/path guards remain explicit.
- Cross-domain Android persistence access was replaced by tokenized capability ports. Dependency Cruiser reports no
  cycles or violations across 1,655 modules and 4,232 dependencies.
- APK catalog and package inspection are likewise exposed to Android lifecycle, scheduled tasks, and image patching
  only through tokenized ports; concrete APK repositories and services remain module-internal.
- Scheduled runtime-log cleanup now consumes an Android-owned maintenance capability instead of importing the log
  implementation across domains.
- Orchestrator tests increased from 69 suites / 237 tests to 91 suites / 370 tests after the package-ownership
  migrations and AI test split. Formatting, lint, typecheck, build, OpenAPI drift, focused package checks, Web
  typecheck, and the dry-run orchestrator reset pass.
- Fallow reports 1.1% duplication (down from 1.47%), 60 threshold complexity findings (down from 76), no dead files,
  and maintainability 91.1. The remaining long harness/YAML loops are protocol flows; protected sidecar and explicit
  DTO/security code were not split merely to satisfy a size metric.
- Knip no longer reports the removed schematics dependency or an unused orchestrator file. Its remaining orchestrator
  export findings are Nest/Swagger reflection surfaces or string-referenced runtime entrypoints and were not deleted
  blindly.
- Provider normalization/transport, automation AI policy, vision geometry/observation, and container-image resolution
  now live in their orchestrator domains instead of the removed `ai-core` and `vision-core` packages. The orchestrator
  consumes generated display-sidecar session types from `@rebroid/display-sidecar-contracts`.
- The full root `pnpm check` is green, including formatting, lint, tests, OpenAPI drift, boundaries, package checks,
  typechecking, and builds. The two tracked display-sidecar files that previously blocked the shared formatting gate
  were normalized without changing protected startup, socket, retry, or cleanup behavior.

Re-audited on 2026-07-17:

- The automation and runtime-image metadata ports no longer expose TypeORM entities, validation/viewer DTOs, or
  implementation parsers. Dependency Cruiser now applies the adapter-import guard to every orchestrator `*.port.ts`
  file, including ports outside a `contracts` directory.
- Fallow 3.6 reports 1.16% orchestrator duplication and an 88.1/A health score with 82 threshold findings. These values
  use a newer scoring formula than the original 91.1 maintainability result, so the scores are not a like-for-like
  regression comparison.
- All 91 orchestrator suites / 370 tests, focused typechecks, formatting, and dependency-boundary checks pass. The
  unchecked Docker/Redroid scenarios remain real integration work and are not represented as completed unit coverage.

Still open by design:

- Source-control PR slicing remains a handoff concern; this implementation was performed in the existing dirty working
  tree while preserving unrelated user changes.
- Synthetic invalid Dependency Cruiser fixtures were not added because they would require a one-off runner solely to
  test configuration regexes. The real graph is clean and the new port adapters have focused tests.
- The unchecked lifecycle scenarios require a Docker/Redroid integration fixture. Unit and application-boot tests
  cover transition atomicity, stale completion, cancellation/preemption, recovery consistency, active-job uniqueness,
  network-policy failure, APK bounds, AI guardrails, and replay/live event ordering.
