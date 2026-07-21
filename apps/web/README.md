# Rebroid Web

Next.js frontend and backend-for-frontend for Rebroid.

See the [web contributor guide](../../docs/web-contributor-guide.md) for ownership boundaries, data-access choices, and
the page-development workflow.

## Defaults

The Docker image is designed to run without a `.env` file:

- `ORCHESTRATOR_API_URL` defaults to `http://orchestrator:4100`.
- `DISPLAY_SIDECAR_INTERNAL_BASE_URL` defaults to `http://rebroid-display-sidecar:8000` for server-side health and session checks.
- Browser viewer traffic is same-origin through the web container. The display sidecar is addressed only by `DISPLAY_SIDECAR_INTERNAL_BASE_URL`.
- `NEXTAUTH_SECRET` is generated into `/app/data` when missing.
- `MFA_ENCRYPTION_KEY` is generated into `/app/data` when missing.
- `ORCHESTRATOR_SHARED_SECRET` is read from `/app/secrets/rebroid-shared-secret`, shared with the orchestrator container.
- `NEXTAUTH_URL` is not required for the compose setup.

The first admin user is created automatically and must change its password on first login. If `INITIAL_ADMIN_PASSWORD` is not provided, the entrypoint writes a generated password to `/app/data/initial-admin-password` with mode `0600`; it is never printed to logs.

## Development

```bash
corepack pnpm install
corepack pnpm --filter rebroid-web dev
```

Copy `.env.example` to `.env.local` and set random values for every secret. The development server binds only to `127.0.0.1` unless `DEV_HOST` is explicitly changed.

```bash
ORCHESTRATOR_API_URL=http://localhost:4100
ORCHESTRATOR_SHARED_SECRET=<random-secret>
NEXTAUTH_SECRET=<random-secret>
MFA_ENCRYPTION_KEY=<random-secret>
INITIAL_ADMIN_PASSWORD=<temporary-random-password>
```

## Upload Limits

The app defaults the Next.js transport ceiling to `512mb`. The effective APK limit shown in the UI is owned by orchestrator settings. If you need a larger transport ceiling, rebuild the web image with:

```bash
NEXT_PROXY_CLIENT_MAX_BODY_SIZE=8192mb docker compose build web
```

## Viewer

The browser connects to the display sidecar viewer URL using a short-lived app-scoped display-session token. Next.js still performs authorization before creating that session, while the sidecar owns ADB viewer actions and streaming.
