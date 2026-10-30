# Contributing

Rebroid is a pnpm/Turbo monorepo. Runtime apps live in `apps/*`; shared libraries and generated
contracts live in `packages/*`. Read the [architecture overview](docs/architecture.md) before
changing service boundaries, and [AGENTS.md](AGENTS.md) for repository-specific constraints.

## Local development

Use Node.js 24 and pnpm through Corepack. Run commands from the repository root unless noted.
Full Android operation still requires a supported native Linux rootful engine and binder devices;
a local UI/API development environment does not provide those host capabilities.

```bash
corepack enable
pnpm install
```

Copy missing environment templates; keep any existing local files:

```bash
cp -n apps/web/.env.example apps/web/.env.local
cp -n apps/orchestrator/.env.example apps/orchestrator/.env
cp -n apps/display-sidecar/.env.example apps/display-sidecar/.env
cp -n apps/firewall-agent/.env.example apps/firewall-agent/.env
```

Before starting services:

- Set independent random values for `NEXTAUTH_SECRET` and `MFA_ENCRYPTION_KEY` in the web env file;
  the encryption key needs at least 32 characters. Set `INITIAL_ADMIN_PASSWORD` there as well.
- Set the same random internal secret as web/orchestrator `ORCHESTRATOR_SHARED_SECRET`, display
  `DISPLAY_SIDECAR_SHARED_SECRET`, and firewall `FIREWALL_AGENT_SHARED_SECRET`.
- Check the orchestrator's engine socket path. `DOCKER_HOST=unix:///var/run/docker.sock` is an explicit
  option; `dev.sh` also checks `DOCKER_SOCKET_PATH` and common local socket locations.

Start each service in its own terminal, infrastructure first:

```bash
./apps/firewall-agent/dev.sh
./apps/display-sidecar/dev.sh
./apps/orchestrator/dev.sh
./apps/web/dev.sh
```

| Service         | Local default                       |
| --------------- | ----------------------------------- |
| Web             | `https://127.0.0.1:3000`.           |
| Orchestrator    | `http://localhost:4100`.            |
| Display sidecar | `http://localhost:8000`.            |
| Firewall agent  | `/tmp/rebroid-firewall/agent.sock`. |

The web script requires its four configured credentials, binds to loopback, and does not require
`NEXTAUTH_URL`. For LAN testing, set `DEV_HOST=0.0.0.0` and include the browser origin in
`NEXT_ALLOWED_DEV_ORIGINS`.

The orchestrator dev script disables firewall bootstrap so API/UI work can start on hosts without
a working firewall backend. Enforcement still requires the supported Linux host and privileges.
OCR development is described in its [workspace README](apps/ocr-sidecar/README.md).
For running the full container stack, use the [deployment guide](docs/deployment.md).

## Code ownership

Keep runtime integrations, framework adapters, persistence, and environment parsing in their owning
application. Extract a handwritten package only when at least two runtime apps use the same
framework-neutral behavior. Generated API contracts are the exception; see the
[package guide](packages/README.md).

- Web work: [page and data boundaries](docs/web-contributor-guide.md),
  [design system](docs/web-design-system.md), and [security rules](docs/web-security.md).
- Orchestrator work: [domain boundaries and lifecycle guarantees](docs/orchestrator-architecture.md).
- Display work: [protocol and lifecycle invariants](docs/display-streaming.md).

## Verification

Start with the owning workspace's check, then broaden for shared or cross-app changes:

```bash
pnpm --filter rebroid-web test
pnpm --filter rebroid-orchestrator test
pnpm --filter @rebroid/display-sidecar test
pnpm --filter './packages/*' test
```

The repository gate checks formatting, lint, types, tests, API drift, dependency boundaries,
package admission, dead code, and production builds:

```bash
pnpm check
```

When an API changes, update its DTO/controller, run `pnpm openapi:generate`, and include generated
contracts. Never edit generated `schema.ts` files by hand. Use `pnpm openapi:check` and
`pnpm boundaries` to verify contracts and imports.

Scrcpy startup/cleanup changes require the [manual Redroid matrix](docs/display-streaming.md#manual-verification).
Model tests use recorded fixtures, not live AI providers. Schema changes follow the
[state reset procedures](docs/operations.md#stored-state); do not create a compatibility layer.

## Dependency updates

Manage dependencies from the root workspace, shared `pnpm-workspace.yaml` catalog, and one lockfile.
Keep `catalog:` and `workspace:` references; do not restore removed packages to resolve old PR conflicts.

Dependabot's grouping and deferred upgrades are defined in
[`.github/dependabot.yml`](.github/dependabot.yml). Current major-upgrade constraints are:

| Area              | Required coordination                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| Node declarations | Keep `@types/node` on 24.x until the runtime and deployment images move together.                                  |
| TypeScript        | Upgrade the shared compiler and consumers together; verify CommonJS resolution, Jest, lint, contracts, and builds. |
| Web ESLint        | Verify plugin/config compatibility before raising the major.                                                       |
| `p-limit`         | ESM-only releases require migration of orchestrator runtime loading and CommonJS Jest tests.                       |
| NestJS            | Align runtime/testing packages, adapter dependencies, and root peer overrides.                                     |

Remove a deferred-upgrade rule only after completing its migration and verification. Run `pnpm check`
after dependency changes.

## Pull requests and reports

Explain the concrete problem and resulting behavior. List verification performed and any security,
deployment, generated-contract, or manual Redroid implications. Keep changes focused and exclude
secrets, local state, private APKs, and unrelated formatting.

Use GitHub issues for reproducible bugs and scoped feature requests. Report vulnerabilities privately
through the [security policy](SECURITY.md).
