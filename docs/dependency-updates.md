# Dependency updates

Manage npm dependencies as one pnpm workspace from the repository root. Dependabot
uses `/` so app manifests, packages, the shared catalog, and `pnpm-lock.yaml` are
updated together. Weekly minor/patch updates are grouped into NestJS, development,
and production PRs; security fixes have a separate group. Unrelated major updates
remain individually reviewable, with five open version-update PRs at most.

Use Node 24 and Corepack pnpm. Update shared tooling in `pnpm-workspace.yaml`,
regenerate the root lockfile, and run `pnpm check`. Pin reviewed framework, CLI, native SQLite, ZIP declaration, and formatter updates
to their tested versions. Keep NestJS runtime/testing packages aligned, and align direct Fastify dependencies with the NestJS adapter.
Root overrides align the auto-installed optional NestJS Express/WebSocket peers
with the same framework patch; update those overrides with the NestJS group to
avoid duplicate nominal framework types.
Do not resolve old PR conflicts by restoring removed dependencies or replacing
`catalog:` and `workspace:` references with standalone versions.

## Deferred major upgrades

- `@types/node` 25/26: the deployment runtime is Node 24. Keep the catalog on 24.x
  until the runtime and deployment images move together.
- TypeScript 6/7: upgrade the shared catalog and all consumers together. The
  orchestrator still uses CommonJS with legacy resolution; TypeScript 6 requires
  a deliberate configuration migration, while installed `ts-jest` 29.4.11 declares
  TypeScript `<7`. Verify build, lint, generated contracts, and all test runners
  before changing the compiler major.
- Web ESLint 10: `eslint-plugin-import` 2.32.0 and `eslint-plugin-react` 7.37.5
  declare ESLint support only through 9. Upgrade the lint configuration/plugins
  before raising the web major. Orchestrator ESLint 10 remains supported.
- `p-limit` 4+: ESM-only releases fail the existing CommonJS Jest concurrency
  tests (`Cannot use import statement outside a module`). Keep 3.1.0 until runtime
  loading and Jest ESM support are migrated and verified together.

These constraints are recorded in `.github/dependabot.yml`; remove the matching
ignore rule when completing its migration. They do not suppress other dependency
updates or patch/minor updates within the supported majors.

## Backlog resolution

The old standalone app and `production/*` PRs predate the root workspace. Their
changes were reviewed against current manifests rather than merging old lockfiles.

| Original PRs | Resolution |
| --- | --- |
| #14, #15, #22, #23, #24, #26 | Align NestJS common/core/adapters/websockets/testing on 11.1.26 in both Nest apps; retain compatible Fastify 5.8.5. |
| #16 | Update the orchestrator Nest CLI requirement to 11.0.22. |
| #21 | Update yauzl to 3.4.0 and its declarations to 3.3.0. |
| #28 | Update better-sqlite3 to 12.10.1 in web and orchestrator. |
| #6, #13 | Apply the TypeScript import resolver 4.4.5 update to the current web workspace. |
| #27, #36 | Update the shared Prettier catalog to 3.9.5 and apply its required formatting changes. |
| #1, #3, #8, #9 | The lockfile already includes these updates; raise current manifest minimums to ESLint 10.4.1 (orchestrator), typescript-eslint 8.60.1, and eslint-plugin-prettier 5.5.6. |
| #4, #7, #19 | Obsolete: zustand, eslint-config-next, and i18next were removed from the web app. |
| #2 | Defer web ESLint 10 pending plugin compatibility. |
| #5, #11 | Defer p-limit 7 pending CommonJS/Jest ESM migration. |
| #10, #37 | Defer TypeScript 6/7 pending a shared compiler migration. |
| #25, #38 | Decline Node 25/26 declarations for the Node 24 runtime. |
