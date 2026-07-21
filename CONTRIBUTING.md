# Contributing to Rebroid

Rebroid is a Node.js 24 pnpm/Turbo monorepo. Install from the repository root with Corepack enabled:

```bash
corepack enable
pnpm install
```

Runtime applications live in `apps/*`. Put code in `packages/*` only when framework-neutral behavior is already needed
by at least two runtime applications, or when it is a generated cross-application contract. See
[`packages/README.md`](packages/README.md) for the package matrix and admission rule.

Keep changes focused, preserve domain boundaries in `AGENTS.md`, and add tests beside changed behavior. Generated
OpenAPI `schema.ts` files are never edited by hand; update the owning API DTO/controller and run
`pnpm openapi:generate`.

Start with the narrow check owned by the changed workspace, then run the repository gates for cross-cutting work:

```bash
pnpm --filter rebroid-web test
pnpm --filter rebroid-orchestrator test
pnpm --filter './packages/*' test
pnpm packages:check
pnpm openapi:check
pnpm boundaries
pnpm check
```

Pull requests should explain the user-visible or architectural reason for the change, list verification performed, and
call out security, deployment, generated-contract, or manual Redroid implications. Do not include secrets, local data,
generated runtime state, or unrelated formatting churn.

Use GitHub issues for reproducible bugs and scoped feature proposals. Report vulnerabilities privately as described in
[`SECURITY.md`](SECURITY.md).
