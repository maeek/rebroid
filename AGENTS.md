# Repository instructions

## Development and verification

- Prefix shell commands with `rtk`. Use Node.js 24 and pnpm through Corepack.
- Run the owning workspace's check for a local change. Use `pnpm check` from the root for cross-app changes. Report any relevant checks you could not run.
- Follow [Contributing](CONTRIBUTING.md) for local setup, API contract generation and dependency updates. Use the root workspace and shared catalog for dependency changes.
- During prerelease, edit the initial SQLite schemas directly. When testing against existing state, follow the [reset procedures](docs/operations.md#stored-state).

## Where to look

| When changing | Read |
| --- | --- |
| Service ownership, request paths, state or feature flags | [Architecture](docs/architecture.md) |
| Domain terminology or an architectural decision | [Domain docs](docs/agents/domain.md) |
| Lifecycle, provisioning, firewall reconciliation, Docker operations or workflow execution | [Orchestrator architecture](docs/orchestrator-architecture.md) |
| Device decisions, evidence, provider selection or AI shell escalation | [AI automation](apps/orchestrator/src/automations/ai/README.md) |
| Viewer transport, media recovery, scrcpy or controls | [Display streaming](docs/display-streaming.md) |
| External device enrollment, attachment or broker configuration | [Deployment](docs/deployment.md#external-android-devices) and [web security](docs/web-security.md) |
| Web routes, server actions, BFF reads or browser/server imports | [Web contributor guide](docs/web-contributor-guide.md) |
| Web UI, interaction or loading states | The relevant sections of the [design system](docs/web-design-system.md). [Operator console](docs/operator-console.md) describes the user-facing workflows. |
| Permissions, sessions, audit scope, viewer grants or terminal access | [Web security](docs/web-security.md) |
| Package placement, exports or generated contracts | [Workspace packages](packages/README.md) |
| Reading, filing or updating GitHub issues | [Issue tracker](docs/agents/issue-tracker.md). Use the [triage labels](docs/agents/triage-labels.md) when mapping roles. |

## Code placement

- Runtime integrations belong in the owning app. New handwritten packages need two runtime app consumers. Generated API contracts are type-only. App code imports from the owning file. Packages expose explicit public entrypoints.
- Keep transport translation in controllers, persistence in repositories, and pure policy independent of either. Use the owning module's folder conventions and co-locate focused tests.
- Orchestrator modules consume each other's contracts, facades or module exports. Declare capability interfaces independently of their adapters and bind implementations to tokens with `useExisting`. Docker callers use `docker/contracts` and `DockerModule`. Automations use `ANDROID_APPS_AUTOMATION`.
- Browser/server DTOs live in `apps/web/src/shared/contracts`. Client modules may import a server-owned module to invoke a Server Action if its first directive is `'use server'`. Ordinary browser requests use the BFF. The edge routes viewer media, authorized event subscriptions and terminal connections.
- Keep TypeScript strict, validate untrusted values at boundaries, and avoid nested ternaries.

## Runtime invariants

- Managed app list and detail reads use stored state. Reconcile Docker explicitly. Guard lifecycle claims, handoffs and writes by reservation and runtime identity. Drain admitted work before Stop or Remove. Preserve shared or untracked profile volumes during cleanup and all profiles during Recreate.
- Enforce the trusted owner's open-device limit in the reservation transaction, including workflow startup and external attachment. Authorize attachment, startup and profile changes separately. Bind external operations to the current verified attachment.
- Firewall changes share the per-app policy gate. Guard restricted startup before Docker starts. Preserve protection until policy installation succeeds or the runtime is confirmed stopped or removed. A bulk replacement requires complete inventory. Stage changes before applying host rules, commit the forwarding jump and chains atomically, and recover from the last committed rules after rollback failure.
- Preserve the identity and ordering of workflow runs and events through cancellation, replay and restart. Reauthorize the account, commands and target before preparation. Bind mutating AI actions to fresh evidence. Raw AI shell access requires a separately authorized one-run allowlist.
- Gate new work on the owning feature's effective state. Preserve the feature's disable policy, permission checks, revocation and cleanup paths. Account changes commit pending viewer revocation with the access change. Verify the initiating session and capabilities again after minting a viewer grant.
- The display sidecar owns scrcpy sources. A consumer disconnect releases its own transport. Changes to ADB or scrcpy startup, socket acquisition, retry or cleanup ordering require the [manual Redroid verification](docs/display-streaming.md#protected-scrcpy-lifecycle).
- Keep APK publication, owner records and orphan deletion serialized by content hash. The managed GApps worker runs without root, secrets or the Docker socket. Hold its operation slot through cancellation and cleanup.
- Use `getCurrentUser()` for protected web operations. The protected routing shell and forced-password-change completion flow may use `getAuthenticatedUser()`. Keep secrets and raw upstream failures out of public results, client bundles and logs.

Update the owning guide when a contract, deployment step or operator workflow changes. Link to the defining code or test for defaults, option lists and component details. Keep a comment when it explains a constraint a maintainer could otherwise miss. [Documentation index](docs/README.md)
