# Contributing

Rebroid is a pnpm/Turbo monorepo. Runtime apps live in `apps/*`; shared libraries and generated
contracts live in `packages/*`. Read the [architecture overview](docs/architecture.md) before
changing service boundaries, and [AGENTS.md](AGENTS.md) for repository-specific constraints.

## Local development

Use Node.js 24 and pnpm through Corepack. Run commands from the repository root unless noted.
The display sidecar tests use Go 1.24 and local UDP sockets for WebRTC loopback.
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
- Set the same random internal secret as web/orchestrator `ORCHESTRATOR_SHARED_SECRET` and firewall
  `FIREWALL_AGENT_SHARED_SECRET`. The display dev launcher uses the orchestrator secret unless you
  provide `DISPLAY_SIDECAR_SHARED_SECRET` or `DISPLAY_SIDECAR_SHARED_SECRET_FILE`.
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

The web script requires its four configured credentials, binds to loopback by default, and does not
require `NEXTAUTH_URL`. For LAN testing, set `DEV_HOST=0.0.0.0` in `apps/web/.env.local` and add the
laptop's LAN IP to `NEXT_ALLOWED_DEV_ORIGINS`. Set `DEV_HTTPS_KEY` and `DEV_HTTPS_CERT` to the key and
certificate paths relative to `apps/web` or to absolute paths. The certificate should cover the LAN IP,
`localhost`, and `127.0.0.1`. Open `https://<LAN-IP>:3000` on a device that trusts the certificate's
issuing CA.

The orchestrator dev script disables firewall bootstrap so API/UI work can start on hosts without
a working firewall backend. Enforcement still requires the supported Linux host and privileges.
OCR development is described in its [workspace README](apps/ocr-sidecar/README.md).
For running the full container stack, use the [deployment guide](docs/deployment.md).

### External ADB development

`pnpm dev` starts the managed display sidecar and also starts an external ADB broker when a
local HTTP broker URL and shared secret are configured. The broker runs in a separate process
with its own ADB server and keys.

1. In `apps/orchestrator/.env`, set `EXTERNAL_ADB_BROKER_URL=http://127.0.0.1:8001`,
   `WEB_INTERNAL_URL=https://127.0.0.1:3000`, and `EXTERNAL_ADB_BROKER_SECRET` to a new secret of
   at least 32 characters. Put the same broker secret in `apps/web/.env.local`. Restart any
   running web and orchestrator processes after changing their environment.
2. Run `pnpm dev` from the repository root. For the URL above, check
   `http://127.0.0.1:8001/health/live` to confirm the broker is listening.
3. In the console, turn on **External devices** under **Administration → Feature management**.
   Open **Devices → All devices** in the sidebar. The authenticated broker check works without an
   attached Android device.

Use this setup for console and API development on macOS, including the broker availability check.
Use the [main Compose stack on Linux](docs/deployment.md#external-android-devices) for live Android
connections and viewer testing. For broker-only debugging, run `pnpm dev:external-adb`.

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

Install the [OCR test dependencies](apps/ocr-sidecar/README.md#development) and use Docker Compose
2.24.4 or later for the [test overlay](docs/deployment.md#start-the-stack). Then run
`pnpm test:backend-services` for OCR, resolved Compose wiring, and the GApps worker fixture.
The checks are also available individually as `pnpm test:ocr`, `pnpm test:compose`, and
`pnpm test:gapps-patcher`. Set `CONTAINER_ENGINE` to select the engine executable and
`OCR_TEST_PYTHON` to select the Python interpreter from your OCR test environment.

When an API changes, update its DTO/controller, run `pnpm openapi:generate`, and include generated
contracts. Never edit generated `schema.ts` files by hand. Use `pnpm openapi:check` and
`pnpm boundaries` to verify contracts and imports.

Scrcpy startup/cleanup changes require the [manual Redroid matrix](docs/display-streaming.md#manual-verification).
Model tests use recorded fixtures. While Rebroid is in prerelease, update the initial SQLite schema
in the owning service. Follow the [state reset procedures](docs/operations.md#stored-state) to test
schema changes against existing local state.

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
