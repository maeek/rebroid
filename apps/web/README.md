# Rebroid Web

Next.js frontend and backend-for-frontend for Rebroid.

## Defaults

The Docker image is designed to run without a `.env` file:

- `ORCHESTRATOR_API_URL` defaults to `http://orchestrator:4100`.
- `DISPLAY_SIDECAR_INTERNAL_BASE_URL` defaults to `http://rebroid-display-sidecar:8000` for server-side health and session checks.
- Browser viewer traffic is same-origin through the web container. The display sidecar is addressed only by `DISPLAY_SIDECAR_INTERNAL_BASE_URL`.
- `NEXTAUTH_SECRET` is generated into `/app/data` when missing.
- `ORCHESTRATOR_SHARED_SECRET` is read from `/app/secrets/rebroid-shared-secret`, shared with the orchestrator container.
- `NEXTAUTH_URL` is not required for the compose setup.

The first admin user is created automatically. If `INITIAL_ADMIN_PASSWORD` is not provided, the entrypoint generates one and prints it in the container logs before creating `/app/data/users.json`.

## Development

```bash
npm install
npm run dev
```

For local development, set only the values you actually need to override. A typical local web-to-local-orchestrator setup is:

```bash
ORCHESTRATOR_API_URL=http://localhost:4100
ORCHESTRATOR_SHARED_SECRET=change-me
NEXTAUTH_SECRET=dev-secret
```

## Upload Limits

The app defaults the Next.js transport ceiling to `512mb`. The effective APK limit shown in the UI is owned by orchestrator settings. If you need a larger transport ceiling, rebuild the web image with:

```bash
NEXT_PROXY_CLIENT_MAX_BODY_SIZE=8192mb docker compose build web
```

## Viewer

The browser connects to the display sidecar viewer URL using a short-lived app-scoped display-session token. Next.js still performs authorization before creating that session, while the sidecar owns ADB viewer actions and streaming.
