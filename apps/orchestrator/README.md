# Orchestrator

Rebroid's internal NestJS control plane owns Android application state, lifecycle jobs,
Docker operations, APKs, workflows, network policy, and settings.

Read the [system overview](../../docs/architecture.md) and
[orchestrator architecture](../../docs/orchestrator-architecture.md) for ownership and execution guarantees.

## Development

Follow the [local setup](../../CONTRIBUTING.md#local-development), then run from the repository root:

```bash
./apps/orchestrator/dev.sh
```

The API listens on `http://localhost:4100/api/v1`. Swagger is at `/docs` when enabled.
Full runtime operation requires the engine socket, display sidecar, and firewall agent.
Use [Compose](../../docs/deployment.md) for the complete container stack.

## Configuration

[`src/config/app.config.ts`](src/config/app.config.ts) assembles validated configuration;
[`.env.example`](.env.example) shows local overrides. SQLite, runtime settings, logs, and uploads
belong to this service. Schema changes use the [state reset workflow](../../docs/operations.md#stored-state).

## Verification

```bash
pnpm --filter rebroid-orchestrator test
pnpm --filter rebroid-orchestrator typecheck
pnpm --filter rebroid-orchestrator lint
pnpm --filter rebroid-orchestrator build
```

For DTO or controller changes, [refresh the OpenAPI contract](../../CONTRIBUTING.md#openapi-contracts).
