# Workspace packages

`packages/*` is intentionally small. A new handwritten package is admitted only when the same framework-neutral
behavior is used by at least two runtime applications. Generated contracts between separately owned applications are
the only standing exception. Pure or testable code with one application owner stays in that application.

Each package manifest describes its purpose and exposes its public imports through `exports`.
Keep framework adapters, persistence, UI and HTTP execution in their owning applications.
Co-locate tests with shared behavior. For a DTO or controller change, follow the
[OpenAPI contract workflow](../CONTRIBUTING.md#openapi-contracts).

## Verification

```bash
pnpm --filter './packages/*' typecheck
pnpm --filter './packages/*' test
pnpm packages:check
pnpm openapi:check
pnpm boundaries
```

`pnpm packages:check` checks package admission, unused exports and handwritten duplication.
Generated schema similarity can be inspected separately with `pnpm packages:duplication:generated`.
