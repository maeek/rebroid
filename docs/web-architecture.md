# Web architecture

The web application is a Next.js backend-for-frontend. Browser code never calls the orchestrator directly and never
imports server-owned models. The repository intentionally has no compatibility or state-migration layer: deployments
that change persisted state start from a clean state with `pnpm reset:all-state -- --execute`.

## Dependency direction

The enforced dependency direction is:

```text
app routes -> feature page entries -> feature UI/model -> shared UI/model/contracts
     |                 |
     +----------> server BFF/services -> generated orchestrator client
```

- `src/app` owns routing, layouts, error boundaries, and BFF route handlers.
- `src/features/<feature>` owns page composition and feature-specific browser behavior.
- `src/shared/contracts` owns DTOs that cross browser/server boundaries.
- `src/shared/model` and `src/shared/ui` cannot import `src/server`, including type-only imports.
- `src/server` owns authentication, authorization, persistence, upstream transport, auditing, and orchestration.
- Cross-feature imports are forbidden. Shared code must be promoted deliberately, not reached through another feature.

`pnpm boundaries` runs separate runtime and type dependency passes. This avoids treating erased TypeScript edges as
runtime cycles while still enforcing ownership of shared DTOs.

## Browser/server contracts

Read operations and shared cross-cutting mutations use `/api/bff/*`. Route handlers validate untrusted input and call
focused server services. Feature-owned mutations may use Server Actions, but they must use the same operation envelope.

Every operation returns an `ActionResult<T>` with a request ID. Errors have a stable code, a public message, and the same
request ID. The BFF propagates request IDs upstream, applies bounded deadlines, validates response envelopes, and writes
structured redacted logs.

## Persistence

Web state uses the relational schema in `src/server/persistence/schema.ts`. Repositories own SQL and runtime parsing.
There are no migrations or legacy document adapters. Startup creates an empty schema or refuses an incompatible schema.

The destructive reset is dry-run by default:

```bash
pnpm reset:all-state
pnpm reset:all-state -- --execute
```

Execution refuses to run while Rebroid containers are active. It removes managed web/orchestrator state, uploads,
containers, networks, and named state volumes. External environment files and bind-mounted secrets are not removed.

## Testing and gates

- Vitest `server` project: Node environment for server and persistence tests.
- Vitest `client` project: JSDOM for React component and hook tests.
- Playwright: desktop and mobile Chromium smoke journeys.
- Coverage floors preserve the current baseline and must move upward as high-risk areas gain tests.
- CI runs formatting, lint (including accessibility), TypeScript, unit/integration tests, OpenAPI drift, dependency
  boundaries, dead-code analysis, production builds, and browser tests.
