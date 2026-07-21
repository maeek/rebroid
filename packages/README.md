# Workspace packages

`packages/*` is intentionally small. A new handwritten package is admitted only when the same framework-neutral
behavior is used by at least two runtime applications. Generated contracts between separately owned applications are
the only standing exception. Pure or testable code with one application owner stays in that application.

## Current packages

| Package                              | Kind        | Runtime consumers                  | Owns                                                                                        |
| ------------------------------------ | ----------- | ---------------------------------- | ------------------------------------------------------------------------------------------- |
| `@rebroid/android-application-core`  | Handwritten | Web, orchestrator, display sidecar | Redroid runtime vocabulary and viewer-control contracts                                     |
| `@rebroid/automation-core`           | Handwritten | Web, orchestrator                  | Automation definitions, metadata, YAML draft contracts, shared public AI-text normalization |
| `@rebroid/firewall-policy-core`      | Handwritten | Web, orchestrator, firewall agent  | Firewall policy contracts, validation, CIDR/access policy, chain names                      |
| `@rebroid/orchestrator-contracts`    | Generated   | Web                                | Orchestrator OpenAPI schema types                                                           |
| `@rebroid/display-sidecar-contracts` | Generated   | Orchestrator                       | Display-sidecar OpenAPI schema types                                                        |

Packages do not own Nest providers, controllers, persistence, React components, Server Actions, environment parsing,
HTTP execution, or other application integrations. Public subpath exports should be capability-oriented and backed by
real consumers; do not add a root barrel for convenience.

## Changing packages

1. Confirm a handwritten change has at least two application consumers. If it has one owner, put it in that app.
2. Add only the necessary explicit `package.json#exports` entry and a short package description.
3. Add focused tests beside handwritten behavior.
4. Run `pnpm packages:check`, package typechecks/tests, and dependency boundaries.
5. When an API DTO or controller changes, run `pnpm openapi:generate` and commit the generated contract drift.

The generated `packages/orchestrator-contracts/src/schema.ts` and
`packages/display-sidecar-contracts/src/schema.ts` files must never be edited manually. Normal clone verification uses
the committed OpenAPI documents and does not require running services.

```bash
pnpm --filter './packages/*' typecheck
pnpm --filter './packages/*' test
pnpm packages:check
pnpm openapi:check
pnpm boundaries
```

`pnpm packages:duplication` excludes generated schemas and enforces the handwritten duplication ceiling. Keep it below
3%. `pnpm packages:duplication:generated` reports generated OpenAPI/schema similarity separately without applying a
threshold; that output is generator-owned and reviewed alongside OpenAPI drift.
