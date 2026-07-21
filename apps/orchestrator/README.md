# Rebroid Orchestrator

The orchestrator is Rebroid's internal NestJS control plane. It owns persisted
Android application state, lifecycle jobs, Docker operations, APK inspection,
network-policy coordination, automations, settings, metrics, and scheduled
maintenance. It is a modular monolith intended for a single host.

The browser never calls this service directly. `apps/web` is the authenticated
backend-for-frontend, while the display sidecar owns viewer sessions and the
firewall agent owns host firewall reconciliation.

See [the orchestrator architecture guide](../../docs/orchestrator-architecture.md)
before changing a module boundary or a background lifecycle flow.

## Requirements

- Node.js 24
- Corepack and pnpm
- A Docker-compatible rootful engine socket
- The display sidecar and firewall agent for full Android/viewer operation

## Local development

From the repository root:

```sh
corepack enable
corepack pnpm install
cp apps/orchestrator/.env.example apps/orchestrator/.env
corepack pnpm --filter rebroid-orchestrator dev
```

The API defaults to `http://127.0.0.1:4100/api/v1`. Swagger is available at
`http://127.0.0.1:4100/docs` when API documentation is enabled.

To run the complete local stack instead:

```sh
docker compose up --build
```

The orchestrator needs a mounted engine socket. Native Linux rootful Docker is
the primary target. Native Linux rootful Podman with Netavark can use its
Docker-compatible API socket; rootless and VM-based desktop engines cannot
provide the privileged Android runtime required by Redroid.

## Module map

Runtime domains live directly under `src`:

- `android-apps`: application definitions, stored state, lifecycle jobs,
  provisioning, runtime access, network coordination, and viewer integration.
- `apk`: upload storage, bounded ZIP/resource/manifest inspection, metadata, and
  APK-reference-safe cleanup.
- `automations`: definitions, commands, conditions, scheduling, execution,
  durable events, AI control, and vision evidence.
- `docker`: the only owner of Docker adapters; other domains use tokenized ports
  from `docker/contracts`.
- `container-images` and `docker-maintenance`: managed image workflows and
  platform maintenance use cases.
- `network-isolation` and `network-policy`: resource naming/boundaries and host
  egress-policy coordination.
- `settings`, `scheduled-tasks`, `system-resources`, `health`, and `metrics`:
  operational control-plane capabilities.
- `config`, `database`, and `security`: composition and infrastructure shared by
  the application.

Keep new code inside its owning domain. Cross-domain consumers should depend on
that domain's module, facade, or capability contract—not its repositories,
entities, controllers, or implementation helpers.

## Configuration and state

`src/config/app.config.ts` is the single configuration entrypoint.
Environment validation lives in `environment-schema.ts`, primitive parsing in
`environment-values.ts`, and nested section construction in
`app-config-sections.ts`. The supported environment variables and examples are
listed in `.env.example`.

Important state paths default to:

- SQLite: `./data/orchestrator.sqlite`
- runtime settings: `./data/orchestrator-settings.json`
- runtime logs: `./data/runtime-logs`
- APK uploads: `./uploads`

This pre-release schema assumes a clean state rather than compatibility
migrations. Preview a targeted reset from the repository root with:

```sh
corepack pnpm reset:orchestrator-state
```

Stop the orchestrator before applying it:

```sh
corepack pnpm reset:orchestrator-state -- --execute
```

## Lifecycle model

Creating, starting, installing an APK, or removing an application reserves one
persisted lifecycle job for that application. Application state and job
handoffs are committed together. Stop cancels the active job; remove preempts
it. Background work can update or complete state only while it still owns the
matching job, preventing a stale provision/start task from overwriting a newer
stop or remove command.

Normal list and get operations read stored state only. Docker reconciliation is
an explicit runtime-state command.

## Verification

Use the smallest relevant check while editing:

```sh
corepack pnpm --filter rebroid-orchestrator test
corepack pnpm --filter rebroid-orchestrator typecheck
corepack pnpm --filter rebroid-orchestrator lint
corepack pnpm --filter rebroid-orchestrator build
```

For contract or boundary changes, also run:

```sh
corepack pnpm openapi:orchestrator:check
corepack pnpm boundaries
```

Before a large change is handed off, run the repository gate from the root:

```sh
corepack pnpm check
```

## Security notes

The orchestrator controls privileged containers, the Docker socket, filesystem
uploads, ADB operations, and network policy. Keep it on the internal network,
validate all names/paths/URLs, use bounded reads and timeouts, and never expose
stored secrets or raw engine errors through public responses. AI runs do not
receive raw ADB shell by default; approved escalation is limited to validated,
allowlisted read-only commands for one run.
