# Rebroid Web

Next.js frontend and backend-for-frontend for Rebroid.

## Defaults

The Docker image is designed to run without a `.env` file:

- `ORCHESTRATOR_API_URL` defaults to `http://orchestrator:4100`.
- `WS_SCRCPY_INTERNAL_BASE_URL` defaults to `http://rebroid-ws-scrcpy:8000` at build time.
- `NEXTAUTH_SECRET` and `SCRCPY_VIEWER_TOKEN_SECRET` are generated into `/app/data` when missing.
- `ORCHESTRATOR_SHARED_SECRET` is read from `/app/secrets/orchestrator-secret`, shared with the orchestrator container.
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

The app defaults the Next.js transport ceiling to `4096mb`. The effective APK limit shown in the UI is owned by orchestrator settings. If you need a larger transport ceiling, rebuild the web image with:

```bash
NEXT_PROXY_CLIENT_MAX_BODY_SIZE=8192mb docker compose build web
```

## Viewer Proxy

The browser never connects directly to ws-scrcpy. Next.js proxies authenticated `/viewer/ws-scrcpy/*` requests to the internal sidecar URL and requires a short-lived app-scoped viewer token for the raw ADB websocket.
